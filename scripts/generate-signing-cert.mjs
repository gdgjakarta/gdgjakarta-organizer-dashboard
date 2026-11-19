import forge from "node-forge";

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  let outPath = ".certs/gdgjakarta-signing.p12";
  let passphrase = process.env.PDF_SIGNING_P12_PASSPHRASE || "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      outPath = argv[i + 1];
      i++;
    } else if (arg === "--passphrase" && argv[i + 1]) {
      passphrase = argv[i + 1];
      i++;
    }
  }

  if (!passphrase) {
    passphrase = randomBytes(16).toString("hex");
  }

  return { outPath: resolve(process.cwd(), outPath), passphrase };
}

function main() {
  const { outPath, passphrase } = parseArgs(process.argv.slice(2));

  console.log("Generating 2048-bit RSA keypair and self-signed X.509 v3 certificate for GDG Jakarta...");
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomBytes(16).toString("hex").toUpperCase();

  const now = new Date();
  const validTo = new Date(now);
  validTo.setFullYear(validTo.getFullYear() + 5);

  cert.validity.notBefore = now;
  cert.validity.notAfter = validTo;

  const attrs = [
    { name: "commonName", value: "Google Developer Group Jakarta" },
    { name: "organizationName", value: "Google Developer Group Jakarta" },
    { name: "organizationalUnitName", value: "Partnership & Sponsorship" },
    { name: "localityName", value: "Jakarta" },
    { name: "stateOrProvinceName", value: "DKI Jakarta" },
    { name: "countryName", value: "ID" },
    { name: "emailAddress", value: "info@gdgjakarta.org" },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: "basicConstraints",
      cA: false,
    },
    {
      name: "keyUsage",
      digitalSignature: true,
      nonRepudiation: true,
    },
    {
      name: "extKeyUsage",
      emailProtection: true,
      codeSigning: true,
    },
    {
      name: "subjectKeyIdentifier",
    },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: "3des",
    friendlyName: "GDG Jakarta PDF Signing Certificate",
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, "binary");
  const p12Base64 = p12Buffer.toString("base64");

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha256.create();
  md.update(certDer);
  const fingerprintSha256 = md.digest().toHex().toUpperCase();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, p12Buffer);

  console.log("");
  console.log("Certificate created successfully!");
  console.log(`  Path:               ${outPath}`);
  console.log(`  Serial Number:      ${cert.serialNumber}`);
  console.log(`  SHA-256 Fingerprint:${fingerprintSha256}`);
  console.log(`  Valid From:         ${now.toISOString()}`);
  console.log(`  Valid To:           ${validTo.toISOString()}`);
  console.log("");
  console.log("Add these lines to .env.local for local development (never commit .env.local or .p12 files):");
  console.log(`PDF_SIGNING_P12_BASE64="${p12Base64}"`);
  console.log(`PDF_SIGNING_P12_PASSPHRASE="${passphrase}"`);
  console.log("");
  console.log("Configure Cloudflare Worker secrets for production:");
  console.log(`  printf '%s' "${p12Base64}" | npx wrangler secret put PDF_SIGNING_P12_BASE64`);
  console.log(`  printf '%s' "${passphrase}" | npx wrangler secret put PDF_SIGNING_P12_PASSPHRASE`);
  console.log("");
}

main();
