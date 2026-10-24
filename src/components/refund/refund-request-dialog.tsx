"use client";

import { useRef, useState, useTransition } from "react";

import { AlertCircle, AlertTriangle, CreditCard, FileText, Info, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatRupiah,
  getEventRefundCutoff,
  getEventRefundPolicyNotes,
  getRegistrationRefundAmount,
  POPULAR_INDONESIAN_BANKS,
} from "@/lib/events/refund-utils";
import { submitRefundRequestAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, RefundRequest } from "@/lib/firestore/types";

interface RefundRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
  onSuccess?: (updatedRefund: RefundRequest) => void;
}

export function RefundRequestDialog({
  isOpen,
  onOpenChange,
  registration,
  event,
  onSuccess,
}: RefundRequestDialogProps) {
  const existingRefund = registration.refund_request;
  const isRejected = existingRefund?.status === "rejected";
  const isEditing = Boolean(existingRefund);

  // Initial form values from existing request or defaults
  const [bankName, setBankName] = useState(existingRefund?.bank_name ?? "BCA");
  const [customBankName, setCustomBankName] = useState(
    existingRefund && !POPULAR_INDONESIAN_BANKS.some((b) => b.name === existingRefund.bank_name)
      ? existingRefund.bank_name
      : "",
  );
  const [bankAccountName, setBankAccountName] = useState(existingRefund?.bank_account_name ?? registration.member_name);
  const [bankAccountNumber, setBankAccountNumber] = useState(existingRefund?.bank_account_number ?? "");
  const [cancellationReason, setCancellationReason] = useState(existingRefund?.cancellation_reason ?? "");

  // Media upload state
  const [proofMediaUrl, setProofMediaUrl] = useState<string | null>(existingRefund?.proof_media_url ?? null);
  const [proofMediaName, setProofMediaName] = useState<string | null>(existingRefund?.proof_media_name ?? null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(Boolean(existingRefund));
  const fileInputRef = useRef<HTMLInputElement | null>(null as unknown as HTMLInputElement);

  const [isSubmitting, startTransition] = useTransition();

  const refundAmount = getRegistrationRefundAmount(registration, event);

  let statusExplanation =
    "Please provide valid Indonesian bank account details to receive your refund transfer. Requesting this refund will forfeit your attendance spot.";
  if (registration.status === "rejected") {
    statusExplanation =
      "Because your paid waitlist registration could not be accommodated due to venue capacity, your payment is eligible for a full refund (even after the standard refund cutoff date). Please provide valid bank account details below.";
  } else if (registration.status === "paid_waitlisted") {
    statusExplanation =
      "Because this session was over capacity, your waitlist fee is refundable. Please provide valid bank account information to receive your transfer.";
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    try {
      setIsUploadingProof(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventName", event?.title ?? registration.event_title);
      formData.append("maxSizeMb", "10");

      const res = await fetch("/api/events/upload-question-media", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? "Failed to upload file");
      }

      const data = (await res.json()) as { url: string };
      setProofMediaUrl(data.url);
      setProofMediaName(file.name);
      toast.success("Cancellation proof media uploaded successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error uploading file";
      toast.error(msg);
    } finally {
      setIsUploadingProof(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveProof = () => {
    setProofMediaUrl(null);
    setProofMediaName(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveBank = bankName === "OTHER" ? customBankName.trim() : bankName.trim();
    if (!effectiveBank) {
      toast.error("Please select or enter your bank name.");
      return;
    }
    if (!bankAccountNumber.trim()) {
      toast.error("Please enter your bank account number.");
      return;
    }
    if (!bankAccountName.trim()) {
      toast.error("Please enter the bank account holder name.");
      return;
    }
    if (!cancellationReason.trim()) {
      toast.error("Please provide a reason for cancellation.");
      return;
    }
    if (!hasAcknowledged) {
      toast.error("Please acknowledge that requesting a refund will cancel your RSVP.");
      return;
    }

    startTransition(async () => {
      const res = await submitRefundRequestAction({
        registrationId: registration.id,
        eventId: registration.event_id,
        bankName: effectiveBank,
        bankAccountName: bankAccountName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        cancellationReason: cancellationReason.trim(),
        proofMediaUrl: proofMediaUrl ?? undefined,
        proofMediaName: proofMediaName ?? undefined,
        refundAmount,
        isResubmission: isRejected,
        refundRequestId: existingRefund?.id,
        requestedAt: existingRefund?.requested_at,
      });

      if (res.success) {
        let msg = "Refund request submitted. Awaiting organizer approval.";
        if (isRejected) {
          msg = "Refund request resubmitted successfully.";
        } else if (isEditing) {
          msg = "Refund request updated successfully.";
        }
        toast.success(msg);
        onSuccess?.({
          id: existingRefund?.id ?? `ref_${registration.id}_${Date.now()}`,
          status: "waiting_for_approval",
          bank_name: effectiveBank,
          bank_account_name: bankAccountName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          cancellation_reason: cancellationReason.trim(),
          proof_media_url: proofMediaUrl ?? undefined,
          proof_media_name: proofMediaName ?? undefined,
          refund_amount: refundAmount,
          requested_at: existingRefund?.requested_at ?? new Date().toISOString(),
          resubmitted_at: isRejected ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        });
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to submit refund request.");
      }
    });
  };

  let dialogTitle = "Request Commitment Fee Refund 💸";
  if (isRejected) {
    dialogTitle = "Resubmit Refund Request 💸";
  } else if (isEditing) {
    dialogTitle = "Edit Refund Request ✏️";
  }

  let submitButtonLabel = "Submit Refund Request";
  if (isRejected) {
    submitButtonLabel = "Resubmit Request";
  } else if (isEditing) {
    submitButtonLabel = "Update Request";
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg">{dialogTitle}</DialogTitle>
              <DialogDescription className="text-xs">{registration.event_title || event?.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isRejected && existingRefund?.rejection_reason && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
            <AlertCircle className="size-4" />
            <AlertTitle className="font-semibold text-xs">Previous Request Rejected</AlertTitle>
            <AlertDescription className="mt-1 text-xs leading-relaxed">
              <strong>Organizer Reason:</strong> {existingRefund.rejection_reason}
              <div className="mt-1 text-[11px] opacity-80">
                You can correct your bank details or clarify your cancellation reason below and resubmit.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* RSVP Cancellation Warning Alert */}
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold text-xs">RSVP Cancellation Warning</AlertTitle>
          <AlertDescription className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Requesting a refund will <strong>cancel your RSVP and release your ticket/spot</strong>. Once processed, you
            will <strong>no longer be able to attend or join the event</strong> with this registration.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">
              {registration.status === "paid_waitlisted" || registration.status === "rejected"
                ? "Refundable Waitlist / Ticket Amount:"
                : "Refundable Ticket Amount:"}
            </span>
            <span className="font-bold text-primary">{formatRupiah(refundAmount)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            {statusExplanation}{" "}
            {event?.refund_include_fee
              ? "Refund includes your ticket deposit and payment gateway fee."
              : "Refund covers your ticket deposit nominal (payment gateway fee is non-refundable)."}
          </p>
        </div>

        {/* Refund Policy Guidelines */}
        <div className="space-y-1.5 rounded-lg border border-border/80 bg-muted/40 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Info className="size-3.5 text-primary" />
            <span>Refund Policy & Disbursement Guidelines</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {getEventRefundPolicyNotes(event)}
          </p>
          <div className="flex flex-wrap items-center justify-between border-border/50 border-t pt-1 text-[10px] text-muted-foreground">
            <span>Cutoff Deadline: {getEventRefundCutoff(event).formattedCutoff}</span>
            <span>Policy Status: {event?.refund_enabled !== false ? "Active" : "Disabled"}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bank Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="bankSelect" className="font-medium text-xs">
              Bank / E-Wallet Provider <span className="text-destructive">*</span>
            </Label>
            <Select
              value={POPULAR_INDONESIAN_BANKS.some((b) => b.name === bankName) ? bankName : "OTHER"}
              onValueChange={(val) => {
                setBankName(val);
                if (val !== "OTHER") {
                  setCustomBankName("");
                }
              }}
            >
              <SelectTrigger id="bankSelect" className="h-9 text-xs">
                <SelectValue placeholder="Select Bank" />
              </SelectTrigger>
              <SelectContent>
                {POPULAR_INDONESIAN_BANKS.map((b) => (
                  <SelectItem key={b.code} value={b.name} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(bankName === "OTHER" || bankName === "Other Bank / E-Wallet") && (
              <div className="mt-2">
                <Input
                  placeholder="Enter Bank or E-Wallet Name (e.g. Bank DKI, GoPay)"
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            )}
          </div>

          {/* Account Number */}
          <div className="space-y-1.5">
            <Label htmlFor="bankAccNumber" className="font-medium text-xs">
              Bank Account Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bankAccNumber"
              placeholder="e.g. 1234567890"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
              className="h-9 font-mono text-xs tracking-wider"
              required
            />
          </div>

          {/* Account Holder Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bankAccName" className="font-medium text-xs">
              Account Holder Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bankAccName"
              placeholder="Exact name registered on bank account"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className="h-9 text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Ensure this name matches your bank passbook/m-banking to prevent transfer rejections.
            </p>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="cancelReason" className="font-medium text-xs">
              Reason for Cancellation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancelReason"
              placeholder="Please provide the reason why you are cancelling your RSVP and requesting a refund..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
              className="resize-none text-xs leading-relaxed"
              required
            />
          </div>

          {/* Cancellation Proof Media (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-medium text-xs">Supporting Proof Document / Media (Optional)</Label>
              <span className="text-[10px] text-muted-foreground">PNG, JPG, PDF up to 10MB</span>
            </div>

            {proofMediaUrl ? (
              <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/30 p-2.5 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="truncate">
                    <p className="truncate font-medium text-foreground">
                      {proofMediaName || "Uploaded Proof Document"}
                    </p>
                    <a
                      href={proofMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline"
                    >
                      View uploaded file ↗
                    </a>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={handleRemoveProof}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-md border border-border border-dashed p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingProof ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Uploading proof document...</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="size-5 text-muted-foreground" />
                      <span className="mt-1 font-medium text-foreground text-xs">Click to upload proof</span>
                      <span className="text-[10px] text-muted-foreground">
                        e.g. Medical certificate, schedule conflict proof
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Acknowledgment Checkbox */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 transition-colors hover:bg-amber-500/10">
            <Checkbox
              id="refund-acknowledge"
              checked={hasAcknowledged}
              onCheckedChange={(checked) => setHasAcknowledged(Boolean(checked))}
              className="mt-0.5 shrink-0 border-amber-500/60 data-[state=checked]:border-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:text-white dark:border-amber-400 dark:data-[state=checked]:bg-amber-500"
            />
            <Label
              htmlFor="refund-acknowledge"
              className="block cursor-pointer select-none font-normal text-xs text-foreground leading-relaxed"
            >
              I understand and agree that submitting this refund request will{" "}
              <strong className="font-semibold text-destructive">cancel my RSVP</strong> and I will{" "}
              <strong className="font-semibold text-foreground">forfeit my spot</strong> to join this event.{" "}
              <span className="font-bold text-destructive">*</span>
            </Label>
          </div>

          <DialogFooter className="mt-4 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isUploadingProof}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploadingProof || !hasAcknowledged}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                submitButtonLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
