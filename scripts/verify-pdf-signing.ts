import forge from "node-forge";
import { degrees, PDFDocument } from "pdf-lib";

import { mapViewportRectToPdf } from "../src/lib/pdf/coordinate-transform";
import { inspectConfiguredCertificate, signPartnerPdfBuffer } from "../src/lib/pdf/sign-pdf";
import type { PdfPlacement } from "../src/types/partner-signage";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

// Minimal valid 1x1 RGBA PNG
const TINY_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function createTestP12(passphrase: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomBytes(8).toString("hex").toUpperCase();
  const now = new Date();
  const validTo = new Date(now);
  validTo.setFullYear(validTo.getFullYear() + 1);
  cert.validity.notBefore = now;
  cert.validity.notAfter = validTo;
  const attrs = [
    { name: "commonName", value: "GDG Jakarta Test Signer" },
    { name: "organizationName", value: "Google Developer Group Jakarta" },
    { name: "countryName", value: "ID" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: "3des",
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
}

function getBoxCorners(x: number, y: number, w: number, h: number, rotDeg: number) {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  const locals: Array<[number, number]> = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  return locals.map(([lx, ly]) => ({
    x: x + lx * cos - ly * sin,
    y: y + lx * sin + ly * cos,
  }));
}

function verifyCoordinateTransforms() {
  const cropBox = { x: 20, y: 30, width: 595, height: 842 };
  const input = { xPct: 0.6, yPct: 0.75, widthPct: 0.25, heightPct: 0.1 };

  for (const rot of [0, 90, 180, 270]) {
    const mapped = mapViewportRectToPdf({
      cropBox,
      rotationDegrees: rot,
      ...input,
    });
    assert.equal(mapped.rotateDegrees, rot);
    const corners = getBoxCorners(mapped.x, mapped.y, mapped.width, mapped.height, mapped.rotateDegrees);
    for (const pt of corners) {
      assert.ok(
        pt.x >= cropBox.x - 1e-6 && pt.x <= cropBox.x + cropBox.width + 1e-6,
        `rot=${rot} corner x=${pt.x} out of cropBox [${cropBox.x}, ${cropBox.x + cropBox.width}]`,
      );
      assert.ok(
        pt.y >= cropBox.y - 1e-6 && pt.y <= cropBox.y + cropBox.height + 1e-6,
        `rot=${rot} corner y=${pt.y} out of cropBox [${cropBox.y}, ${cropBox.y + cropBox.height}]`,
      );
    }
  }
  console.log("PASS: Coordinate transform verified across 0°, 90°, 180°, 270° + non-zero CropBox.");
}

function extractByteRangeAndContents(pdfBuffer: Buffer) {
  const byteRangeMatch = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(pdfBuffer.toString("latin1"));
  assert.ok(byteRangeMatch, "Expected numeric /ByteRange in signed PDF");
  const range = [
    Number(byteRangeMatch[1]),
    Number(byteRangeMatch[2]),
    Number(byteRangeMatch[3]),
    Number(byteRangeMatch[4]),
  ] as const;

  assert.equal(range[0], 0, "ByteRange[0] must be 0");
  assert.equal(range[2] + range[3], pdfBuffer.length, "ByteRange must cover until EOF");

  const contentsHexWithBrackets = pdfBuffer.subarray(range[1], range[2]).toString("ascii");
  assert.ok(contentsHexWithBrackets.startsWith("<") && contentsHexWithBrackets.endsWith(">"));
  const hexBody = contentsHexWithBrackets.slice(1, -1);
  const rawContents = Buffer.from(hexBody, "hex");

  // Compute exact DER SEQUENCE byte length to strip trailing 0x00 placeholder padding
  assert.equal(rawContents[0], 0x30, "PKCS#7 CMS must start with ASN.1 SEQUENCE (0x30)");
  const lenByte = rawContents[1];
  let headerBytes = 2;
  let contentLen = lenByte;
  if ((lenByte & 0x80) !== 0) {
    const numLenBytes = lenByte & 0x7f;
    headerBytes = 2 + numLenBytes;
    contentLen = 0;
    for (let i = 0; i < numLenBytes; i++) {
      contentLen = (contentLen << 8) | rawContents[2 + i];
    }
  }
  const derSlice = rawContents.subarray(0, headerBytes + contentLen);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(derSlice.toString("binary")));
  const cmsMessage = forge.pkcs7.messageFromAsn1(asn1) as unknown as {
    certificates: forge.pki.Certificate[];
    rawCapture: {
      authenticatedAttributes: forge.asn1.Asn1[];
      signature: string;
    };
  };

  const signedBytes = Buffer.concat([
    pdfBuffer.subarray(range[0], range[0] + range[1]),
    pdfBuffer.subarray(range[2], range[2] + range[3]),
  ]);

  return { range, signedBytes, cmsMessage };
}

function verifyPkcs7Signature(pdfBuffer: Buffer) {
  const { signedBytes, cmsMessage } = extractByteRangeAndContents(pdfBuffer);
  assert.ok(cmsMessage.certificates.length >= 1, "Expected embedded X.509 certificate inside PKCS#7");

  const cert = cmsMessage.certificates[0];
  const attrs = cmsMessage.rawCapture.authenticatedAttributes;

  // Locate messageDigest attribute (OID 1.2.840.113549.1.9.4)
  const messageDigestOid = forge.pki.oids.messageDigest;
  let embeddedDigestHex = "";
  for (const attr of attrs) {
    const seq = attr.value as forge.asn1.Asn1[];
    const oid = forge.asn1.derToOid(String(seq[0].value));
    if (oid === messageDigestOid) {
      const setVal = seq[1].value as forge.asn1.Asn1[];
      embeddedDigestHex = forge.util.bytesToHex(String(setVal[0].value));
    }
  }
  assert.equal(embeddedDigestHex.length, 64, "Expected SHA-256 messageDigest inside PKCS#7");

  const actualDigestHex = createHash("sha256").update(signedBytes).digest("hex");
  assert.equal(actualDigestHex, embeddedDigestHex, "ByteRange SHA-256 digest must match PKCS#7 messageDigest");

  // Verify RSA-SHA256 signature over DER-encoded SET OF authenticatedAttributes
  const attrsSetAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
  const attrsDer = forge.asn1.toDer(attrsSetAsn1).getBytes();
  const md = forge.md.sha256.create();
  md.update(attrsDer);

  const pubKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const isRsaValid = pubKey.verify(md.digest().getBytes(), cmsMessage.rawCapture.signature);
  assert.equal(isRsaValid, true, "RSA-SHA256 PKCS#7 signature verification must pass");

  // Tamper check: flip 1 byte in signedBytes and assert digest mismatch
  const tampered = Buffer.from(signedBytes);
  tampered[12] ^= 0xff;
  const tamperedDigest = createHash("sha256").update(tampered).digest("hex");
  assert.notEqual(tamperedDigest, embeddedDigestHex, "Tampered PDF bytes must fail SHA-256 digest match");
}

async function main() {
  verifyCoordinateTransforms();

  // Build 2-page PDF: page 1 portrait 0°, page 2 rotated 90° with non-zero CropBox
  const rawDoc = await PDFDocument.create();
  rawDoc.addPage([595, 842]);
  const p2 = rawDoc.addPage([600, 800]);
  p2.setCropBox(20, 30, 550, 740);
  p2.setRotation(degrees(90));
  const rawPdfBytes = await rawDoc.save();

  const passphrase = "test-gdg-passphrase";
  const p12Buffer = createTestP12(passphrase);

  const inspected = inspectConfiguredCertificate({ p12Buffer, passphrase });
  assert.equal(inspected.configured, true);
  assert.equal(inspected.isExpired, false);
  assert.equal(inspected.subjectCn, "GDG Jakarta Test Signer");

  const placements: PdfPlacement[] = [
    {
      id: "p1",
      kind: "signature",
      pageIndex: 0,
      xPct: 0.6,
      yPct: 0.72,
      widthPct: 0.25,
      heightPct: 0.1,
      assetId: "sig1",
    },
    {
      id: "p2",
      kind: "initials",
      pageIndex: 1,
      xPct: 0.75,
      yPct: 0.8,
      widthPct: 0.15,
      heightPct: 0.08,
      assetId: "sig1",
    },
    {
      id: "p3",
      kind: "text_stamp",
      pageIndex: 0,
      xPct: 0.6,
      yPct: 0.83,
      widthPct: 0.3,
      heightPct: 0.09,
      signerName: "Fachridan Tio M.",
      signerTitle: "GDG Jakarta Organizer",
      includeCertBadge: true,
    },
  ];

  const assets = new Map<string, Uint8Array>([["sig1", TINY_PNG_BYTES]]);
  const token = randomBytes(16).toString("hex");
  const signedAtIso = new Date().toISOString();

  const result = await signPartnerPdfBuffer({
    pdfBytes: rawPdfBytes,
    placements,
    assets,
    documentId: `psgn_${token}`,
    token,
    documentTitle: "Test Partner MOU",
    originalFileName: "partner-mou.pdf",
    companyName: "PT Test Partner",
    signerName: "Fachridan Tio M.",
    signerTitle: "GDG Jakarta Organizer",
    signerEmail: "info@gdgjakarta.org",
    reason: "Authorized Partnership Approval",
    location: "Jakarta, Indonesia",
    signedAtIso,
    includeCertificatePage: true,
    signatureMethodsUsed: ["draw", "initials"],
    p12Override: { p12Buffer, passphrase },
  });

  assert.equal(result.signedPdfBuffer.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(result.originalPageCount, 2);
  assert.equal(result.pageCount, 3, "Certificate of Completion page should increase pageCount to 3");
  assert.equal(result.ecertStatus, "signed_p12");
  assert.equal(result.originalSha256.length, 64);
  assert.equal(result.signedSha256.length, 64);
  assert.ok(result.signedPdfBuffer.includes("/adbe.pkcs7.detached"), "Missing SubFilter /adbe.pkcs7.detached");

  // Reload signed PDF with pdf-lib to confirm structural validity
  const reloaded = await PDFDocument.load(result.signedPdfBuffer);
  assert.equal(reloaded.getPageCount(), 3);

  // Verify real PKCS#7 RSA-SHA256 cryptographic signature & tamper check
  verifyPkcs7Signature(result.signedPdfBuffer);
  console.log("PASS: X.509 PKCS#7 RSA-SHA256 signature & tamper detection verified.");

  // Verify hash_only fallback when .p12 is absent
  const hashOnlyResult = await signPartnerPdfBuffer({
    pdfBytes: rawPdfBytes,
    placements,
    assets,
    documentId: `psgn_${token}`,
    token,
    documentTitle: "Test Partner MOU",
    originalFileName: "partner-mou.pdf",
    companyName: "PT Test Partner",
    signerName: "Fachridan Tio M.",
    signerTitle: "GDG Jakarta Organizer",
    signerEmail: "info@gdgjakarta.org",
    reason: "Authorized Partnership Approval",
    location: "Jakarta, Indonesia",
    signedAtIso,
    includeCertificatePage: true,
    signatureMethodsUsed: ["initials"],
    p12Override: null,
  });

  assert.equal(hashOnlyResult.ecertStatus, "hash_only");
  assert.equal(hashOnlyResult.originalSha256.length, 64);
  assert.equal(hashOnlyResult.signedSha256.length, 64);
  console.log("PASS: hash_only fallback verified.");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
