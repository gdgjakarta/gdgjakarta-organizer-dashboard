"use client";

import { useRef, useState, useTransition } from "react";

import { CheckCircle2, Copy, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatRupiah } from "@/lib/events/refund-utils";
import { approveAndCompleteRefundAction } from "@/lib/firestore/actions";
import type { FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface RefundApprovalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  eventId: string;
  eventTitle?: string;
  onSuccess: (updated: FirestoreRegistration) => void;
}

export function RefundApprovalDialog({
  isOpen,
  onOpenChange,
  registration,
  eventId,
  eventTitle,
  onSuccess,
}: RefundApprovalDialogProps) {
  const user = useAuthStore((s) => s.user);
  const refundReq = registration.refund_request;

  const [completionProofUrl, setCompletionProofUrl] = useState<string>("");
  const [completionProofName, setCompletionProofName] = useState<string>("");
  const [completionNotes, setCompletionNotes] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement | null>(null as unknown as HTMLInputElement);

  if (!refundReq) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard.`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventName", eventTitle ?? registration.event_title);
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
      setCompletionProofUrl(data.url);
      setCompletionProofName(file.name);
      toast.success("Transfer receipt proof uploaded.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error uploading file";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();

    if (!completionProofUrl.trim()) {
      toast.error("Please upload the proof of bank transfer receipt before completing the refund.");
      return;
    }

    startTransition(async () => {
      const reviewer = {
        id: user?.id ?? "organizer",
        name: user?.name ?? user?.email ?? "Organizer",
        email: user?.email,
      };

      const res = await approveAndCompleteRefundAction({
        registrationId: registration.id,
        eventId,
        completionProofUrl: completionProofUrl.trim(),
        completionNotes: completionNotes.trim() || undefined,
        reviewer,
      });

      if (res.success) {
        toast.success("Refund approved and marked as completed.");
        const now = new Date().toISOString();
        const updatedReq = {
          ...refundReq,
          status: "refund_completed" as const,
          completion_proof_url: completionProofUrl.trim(),
          completion_notes: completionNotes.trim() || undefined,
          completed_at: now,
          completed_by_id: reviewer.id,
          completed_by_name: reviewer.name,
          completed_by_email: reviewer.email,
          updated_at: now,
        };
        onSuccess({
          ...registration,
          payment_status: "refunded",
          refund_request: updatedReq,
          updated_at: now,
        });
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to approve refund.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg">Approve & Complete Refund</DialogTitle>
              <DialogDescription className="text-xs">Disburse commitment fee deposit to attendee</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Payee Bank Information Box */}
        <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Beneficiary Details</span>
            <Badge variant="outline" className="border-primary/30 font-bold text-primary">
              {formatRupiah(refundReq.refund_amount)}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded border border-border/50 bg-background p-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Bank Name:</span>
                <p className="font-semibold text-foreground text-xs">{refundReq.bank_name}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => handleCopy(refundReq.bank_name, "Bank Name")}
              >
                <Copy className="size-3" />
                Copy
              </Button>
            </div>

            <div className="flex items-center justify-between rounded border border-border/50 bg-background p-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Account Number:</span>
                <p className="font-bold font-mono text-foreground text-sm tracking-wider">
                  {refundReq.bank_account_number}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => handleCopy(refundReq.bank_account_number, "Account Number")}
              >
                <Copy className="size-3" />
                Copy
              </Button>
            </div>

            <div className="flex items-center justify-between rounded border border-border/50 bg-background p-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Account Holder:</span>
                <p className="font-semibold text-foreground text-xs">{refundReq.bank_account_name}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => handleCopy(refundReq.bank_account_name, "Account Holder Name")}
              >
                <Copy className="size-3" />
                Copy
              </Button>
            </div>
          </div>

          <div className="border-border/50 border-t pt-2 text-[11px]">
            <span className="text-muted-foreground">Attendee: </span>
            <span className="font-medium text-foreground">{registration.member_name}</span> ({registration.member_email}
            )
          </div>

          {refundReq.cancellation_reason && (
            <div className="border-border/50 border-t pt-2 text-[11px]">
              <span className="text-muted-foreground">Cancellation Reason: </span>
              <p className="mt-0.5 text-foreground italic leading-relaxed">
                &ldquo;{refundReq.cancellation_reason}&rdquo;
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleApprove} className="space-y-4">
          {/* Upload Proof of Transfer Receipt (Required) */}
          <div className="space-y-1.5">
            <Label className="font-medium text-xs">
              Upload Proof of Transfer Receipt <span className="text-destructive">*</span>
            </Label>

            {completionProofUrl ? (
              <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                  </span>
                  <div className="truncate">
                    <p className="truncate font-medium text-foreground">{completionProofName || "Receipt Attached"}</p>
                    <a
                      href={completionProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline"
                    >
                      View receipt preview ↗
                    </a>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setCompletionProofUrl("");
                    setCompletionProofName("");
                  }}
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
                  {isUploading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Uploading receipt...</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="size-5 text-muted-foreground" />
                      <span className="mt-1 font-medium text-foreground text-xs">Click to upload transfer receipt</span>
                      <span className="text-[10px] text-muted-foreground">Screenshot or PDF of m-banking transfer</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Internal Notes / Transfer Reference */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="font-medium text-xs">
              Internal Notes / Reference ID (Optional)
            </Label>
            <Input
              id="notes"
              placeholder="e.g. BCA Ref #202610160012, or remarks"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploading || !completionProofUrl}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Completing...
                </>
              ) : (
                "Confirm & Complete Refund"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
