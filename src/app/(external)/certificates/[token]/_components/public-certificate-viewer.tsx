"use client";

import { useState } from "react";

import { Award, Check, CheckCircle2, Copy, Download, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildCertificateVerifyUrl,
  buildLinkedInAddCertificationUrl,
  formatCertificateDate,
} from "@/lib/events/certificate-utils";
import type { EventCertificateRecord } from "@/lib/firestore/types";

interface PublicCertificateViewerProps {
  certificate: Omit<EventCertificateRecord, "recipient_email">;
}

export function PublicCertificateViewer({ certificate }: PublicCertificateViewerProps) {
  const [copied, setCopied] = useState(false);
  const verifyUrl = buildCertificateVerifyUrl(certificate.token);
  const linkedInUrl = buildLinkedInAddCertificationUrl(certificate);
  const isRevoked = certificate.status === "revoked";
  const certTitle =
    certificate.certificate_type === "speaker" ? "Certificate of Appreciation" : "Certificate of Attendance";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Verification link copied!");
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isRevoked ? "destructive" : "default"} className="gap-1">
                {isRevoked ? <ShieldAlert className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                {isRevoked ? "Revoked" : "Verified by GDG Jakarta"}
              </Badge>
              <Badge variant="secondary">{certTitle}</Badge>
            </div>
            <CardTitle className="text-2xl">{certificate.recipient_name}</CardTitle>
            <CardDescription>
              {certificate.presenter_role || "Attendee"} &bull; {certificate.event_title}
            </CardDescription>
          </div>

          {!isRevoked && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <a href={certificate.pdf_url} target="_blank" rel="noopener noreferrer" download>
                  <Download className="mr-1.5 size-4" />
                  Download PDF
                </a>
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <Check className="mr-1.5 size-4 text-emerald-600" /> : <Copy className="mr-1.5 size-4" />}
                {copied ? "Copied" : "Copy Link"}
              </Button>
              <Button variant="outline" asChild>
                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 size-4" />
                  Add to LinkedIn
                </a>
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {isRevoked ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              This certificate was revoked by GDG Jakarta organizers on{" "}
              {formatCertificateDate(certificate.revoked_at || certificate.updated_at)}.
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-lg border bg-background">
              <iframe
                src={`${certificate.pdf_url}#view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
                title={`${certTitle} - ${certificate.recipient_name}`}
                className="aspect-[4/3] w-full border-0"
              />
            </div>
          )}

          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Event</p>
              <p className="font-medium">{certificate.event_title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-medium">{certificate.presenter_role || "Attendee"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Issued Date</p>
              <p className="font-medium">{formatCertificateDate(certificate.issued_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Certificate ID</p>
              <p className="font-mono text-xs font-medium">{certificate.certificate_code || certificate.token}</p>
            </div>
          </div>

          {certificate.talk_title && (
            <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm">
              <Award className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Session:</span>
              <span className="font-medium">{certificate.talk_title}</span>
            </div>
          )}

          {certificate.sha256 && (
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              SHA-256: {certificate.sha256.slice(0, 24)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
