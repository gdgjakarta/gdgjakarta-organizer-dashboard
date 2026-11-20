"use client";

import { useState } from "react";

import { Award, Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  buildCertificateVerifyUrl,
  isEventWrappedUpForCertificates,
  isRegistrationEligibleForAttendanceCertificate,
} from "@/lib/events/certificate-utils";
import { auth } from "@/config/firebase";
import type { EventCertificateConfig, EventCertificateRecord, FirestoreRegistration } from "@/lib/firestore/types";
import { claimAttendanceCertificateAction } from "@/server/certificate-actions";

interface AttendanceCertificateActionsProps {
  event: {
    id: string;
    title: string;
    status?: string;
    end_date?: string;
    certificate_config?: EventCertificateConfig;
  };
  registration?: Pick<FirestoreRegistration, "id" | "is_checked_in" | "status"> | null;
  variant?: "compact" | "card" | "inline";
  className?: string;
}

export function AttendanceCertificateActions({
  event,
  registration,
  variant = "inline",
  className,
}: AttendanceCertificateActionsProps) {
  const [cachedCert, setCachedCert] = useState<EventCertificateRecord | null>(null);
  const [busyMode, setBusyMode] = useState<"download" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  const isEligible =
    Boolean(registration?.id) &&
    isEventWrappedUpForCertificates(event) &&
    isRegistrationEligibleForAttendanceCertificate(registration);

  if (!isEligible || !registration?.id) {
    return null;
  }

  const ensureCertificate = async (): Promise<{ cert: EventCertificateRecord; verifyUrl: string } | null> => {
    if (cachedCert) {
      return { cert: cachedCert, verifyUrl: buildCertificateVerifyUrl(cachedCert.token) };
    }

    const user = auth?.currentUser;
    if (!user) {
      toast.error("Please sign in to access your attendance certificate.");
      return null;
    }

    const idToken = await user.getIdToken();
    const res = await claimAttendanceCertificateAction({
      eventId: event.id,
      registrationId: registration.id,
      idToken,
    });

    if (!res.success || !res.certificate || !res.verifyUrl) {
      toast.error(res.error || "Could not generate your attendance certificate.");
      return null;
    }

    setCachedCert(res.certificate);
    return { cert: res.certificate, verifyUrl: res.verifyUrl };
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusyMode("download");
    const toastId = !cachedCert ? toast.loading("Generating your attendance certificate...") : undefined;
    try {
      const result = await ensureCertificate();
      if (toastId) toast.dismiss(toastId);
      if (!result) return;

      const link = document.createElement("a");
      link.href = result.cert.pdf_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = `Certificate-of-Attendance-${event.title.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Certificate ready for download!");
    } catch {
      if (toastId) toast.dismiss(toastId);
      toast.error("Failed to download certificate. Please try again.");
    } finally {
      setBusyMode(null);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusyMode("copy");
    const toastId = !cachedCert ? toast.loading("Preparing your verification link...") : undefined;
    try {
      const result = await ensureCertificate();
      if (toastId) toast.dismiss(toastId);
      if (!result) return;

      await navigator.clipboard.writeText(result.verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Certificate link copied!", {
        action: {
          label: "Open",
          onClick: () => window.open(result.verifyUrl, "_blank", "noopener,noreferrer"),
        },
      });
    } catch {
      if (toastId) toast.dismiss(toastId);
      toast.error("Failed to copy certificate link.");
    } finally {
      setBusyMode(null);
    }
  };

  if (variant === "card") {
    return (
      <div className={`rounded-xl border border-primary/20 bg-primary/5 p-4 ${className ?? ""}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Award className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Your Attendance Certificate is Ready</h4>
              <p className="text-xs text-muted-foreground">
                Thank you for checking in at {event.title}. Download your PDF or share your verified link.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleDownload} disabled={busyMode !== null}>
              {busyMode === "download" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-4" />
              )}
              {busyMode === "download" ? "Generating..." : "Download PDF"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyLink} disabled={busyMode !== null}>
              {busyMode === "copy" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : copied ? (
                <Check className="mr-1.5 size-4 text-emerald-600" />
              ) : (
                <Copy className="mr-1.5 size-4" />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            {cachedCert && (
              <Button size="sm" variant="ghost" asChild>
                <a href={buildCertificateVerifyUrl(cachedCert.token)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 size-3.5" />
                  View
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      <Button
        size={variant === "compact" ? "sm" : "default"}
        variant="default"
        className={variant === "compact" ? "h-8 text-xs" : ""}
        onClick={handleDownload}
        disabled={busyMode !== null}
      >
        {busyMode === "download" ? (
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        ) : (
          <Award className="mr-1.5 size-3.5" />
        )}
        {busyMode === "download" ? "Generating..." : "Certificate"}
      </Button>
      <Button
        size={variant === "compact" ? "sm" : "default"}
        variant="outline"
        className={variant === "compact" ? "h-8 text-xs" : ""}
        onClick={handleCopyLink}
        disabled={busyMode !== null}
        title="Copy public certificate verification link"
      >
        {busyMode === "copy" ? (
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        ) : copied ? (
          <Check className="mr-1.5 size-3.5 text-emerald-600" />
        ) : (
          <Copy className="mr-1.5 size-3.5" />
        )}
        {copied ? "Copied" : "Copy Link"}
      </Button>
    </div>
  );
}
