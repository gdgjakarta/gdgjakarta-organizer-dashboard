"use client";

import type React from "react";
import { useRef, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileSearch,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/r2/utils";
import type { PartnerSignedDocument } from "@/types/partner-signage";

interface PublicSignedDocumentVerifierProps {
  document: PartnerSignedDocument;
}

type VerificationVerdict =
  | { state: "match"; fileName: string; sha256: string }
  | { state: "original_match"; fileName: string; sha256: string }
  | { state: "mismatch"; fileName: string; sha256: string };

async function computeFileSha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PublicSignedDocumentVerifier({ document: doc }: PublicSignedDocumentVerifierProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHashing, setIsHashing] = useState(false);
  const [verdict, setVerdict] = useState<VerificationVerdict | null>(null);

  const signedAtWib = `${new Date(doc.signed_at).toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })} WIB`;

  const copyText = (value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    toast.success(`${label} copied!`);
  };

  const inspectLocalFile = async (file: File) => {
    setIsHashing(true);
    try {
      const hex = await computeFileSha256Hex(file);
      if (hex.toLowerCase() === doc.signed_sha256.toLowerCase()) {
        setVerdict({ state: "match", fileName: file.name, sha256: hex });
      } else if (hex.toLowerCase() === doc.original_sha256.toLowerCase()) {
        setVerdict({ state: "original_match", fileName: file.name, sha256: hex });
      } else {
        setVerdict({ state: "mismatch", fileName: file.name, sha256: hex });
      }
    } catch {
      toast.error("Failed to compute SHA-256 hash for this file.");
    } finally {
      setIsHashing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Official Verification Header Banner */}
      <Card className="overflow-hidden border-border">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white/15 text-white hover:bg-white/20 border-white/25 text-[11px] gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified by Google Developer Group Jakarta
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/25 border-emerald-300/30 text-[11px]">
                  {doc.ecert_status === "signed_p12" ? "X.509 PKCS#7 Certified" : "SHA-256 Tamper-Evident"}
                </Badge>
              </div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{doc.document_title}</h1>
              <p className="text-xs text-blue-100">
                Countersigned for <strong className="text-white">{doc.company_name}</strong> on {signedAtWib}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                asChild
                size="sm"
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs gap-1.5"
              >
                <a href={doc.signed_pdf_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5" />
                  Download Signed PDF
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(doc.signed_pdf_url, "Signed PDF URL")}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white text-xs gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Document & Signer Summary */}
            <div className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Document &amp; Signatory Summary
              </h2>
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Verification ID</span>
                  <span className="font-mono font-medium text-foreground">{doc.id}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Partner / Company</span>
                  <span className="font-medium text-right text-foreground">{doc.company_name}</span>
                </div>
                {doc.event_title && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Event</span>
                    <span className="font-medium text-right text-foreground">{doc.event_title}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Authorized Signer</span>
                  <span className="font-medium text-right text-foreground">
                    {doc.signer_name} ({doc.signer_title})
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Original File</span>
                  <span className="font-mono text-right text-foreground truncate max-w-[200px]">
                    {doc.original_file_name}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Signed Output</span>
                  <span className="font-medium text-foreground">
                    {doc.page_count} pages • {formatFileSize(doc.signed_pdf_size_bytes)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Signature Methods</span>
                  <span className="font-medium capitalize text-foreground">
                    {doc.signature_methods_used.join(", ") || "signature"}
                  </span>
                </div>
              </div>
            </div>

            {/* Cryptographic E-Certificate Details */}
            <div className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Lock className="h-4 w-4 text-emerald-600" />
                E-Certificate &amp; Cryptographic Digests
              </h2>
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2.5 text-xs">
                {doc.ecert_metadata ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Certificate Subject</span>
                      <span className="font-medium text-right text-foreground">{doc.ecert_metadata.subject_cn}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Issuer</span>
                      <span className="font-medium text-right text-foreground">
                        {doc.ecert_metadata.issuer_cn}
                        {doc.ecert_metadata.is_self_signed ? " (Self-Signed)" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Serial Number</span>
                      <span className="font-mono text-[11px] text-right text-foreground truncate max-w-[190px]">
                        {doc.ecert_metadata.serial_number}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Validity Period</span>
                      <span className="font-medium text-foreground">
                        {doc.ecert_metadata.valid_from.slice(0, 10)} → {doc.ecert_metadata.valid_to.slice(0, 10)}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Cert SHA-256 Fingerprint</span>
                        <button
                          type="button"
                          onClick={() => copyText(doc.ecert_metadata?.fingerprint_sha256 || "", "Cert fingerprint")}
                          className="text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                      <code className="block break-all rounded bg-background p-1.5 font-mono text-[10px] border border-border">
                        {doc.ecert_metadata.fingerprint_sha256}
                      </code>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Sealed with SHA-256 cryptographic file hashing by GDG Jakarta Dashboard.
                  </p>
                )}

                <div className="pt-1 border-t border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Signed PDF SHA-256</span>
                    <button
                      type="button"
                      onClick={() => copyText(doc.signed_sha256, "Signed PDF SHA-256")}
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                  <code className="block break-all rounded bg-background p-1.5 font-mono text-[10px] border border-border">
                    {doc.signed_sha256}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client-Side File Integrity Checker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-4 w-4 text-primary" />
            Local File Tamper Checker (Browser-Only)
          </CardTitle>
          <CardDescription className="text-xs">
            Drop your downloaded PDF copy below to verify bit-for-bit integrity against our cryptographic SHA-256
            record. Hashing happens locally in your browser — your file is never uploaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void inspectLocalFile(f);
            }}
          />

          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void inspectLocalFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <UploadCloud className="h-7 w-7 text-primary mb-2" />
            <p className="text-xs font-semibold text-foreground">
              {isHashing ? "Computing SHA-256 digest locally..." : "Drop signed PDF here or click to verify"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Instant Web Crypto SHA-256 verification</p>
          </button>

          {verdict && (
            <div
              className={`rounded-lg border p-4 text-xs ${
                verdict.state === "match"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                  : verdict.state === "original_match"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-start gap-3">
                {verdict.state === "match" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                ) : verdict.state === "original_match" ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                )}
                <div className="space-y-1 min-w-0">
                  <p className="font-bold text-sm">
                    {verdict.state === "match"
                      ? "Authentic — Exact Bit-for-Bit Match"
                      : verdict.state === "original_match"
                        ? "Unsigned Original Document Detected"
                        : "Mismatch — File Differs from Signed Record"}
                  </p>
                  <p className="opacity-90">
                    {verdict.state === "match"
                      ? `"${verdict.fileName}" matches the exact cryptographic SHA-256 hash recorded when GDG Jakarta signed this document.`
                      : verdict.state === "original_match"
                        ? `"${verdict.fileName}" matches the pre-signature original uploaded before signing. Please download the countersigned PDF above.`
                        : `"${verdict.fileName}" has a different SHA-256 hash and may have been modified after signing.`}
                  </p>
                  <code className="block break-all rounded bg-background/70 px-2 py-1 font-mono text-[10px]">
                    Computed SHA-256: {verdict.sha256}
                  </code>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
