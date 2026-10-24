"use client";

import Image from "next/image";

import { AlertCircle, CheckCircle2, Clock, Edit3, ExternalLink, FileText, Lock, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatFirestoreDate } from "@/lib/date-utils";
import { formatRupiah, getRegistrationRefundAmount } from "@/lib/events/refund-utils";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface RefundStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
  onEditRequest?: () => void;
}

export function RefundStatusDialog({
  isOpen,
  onOpenChange,
  registration,
  event,
  onEditRequest,
}: RefundStatusDialogProps) {
  const refundReq = registration.refund_request;
  if (!refundReq) return null;

  const status = refundReq.status;
  const isPending = status === "waiting_for_approval";
  const isApproved = status === "refund_completed";
  const isRejected = status === "rejected";

  const formattedDate = formatFirestoreDate(refundReq.requested_at, "dd MMM yyyy, HH:mm", "—");
  const completedDate = refundReq.completed_at
    ? formatFirestoreDate(refundReq.completed_at, "dd MMM yyyy, HH:mm", "—")
    : null;
  const rejectedDate = refundReq.rejected_at
    ? formatFirestoreDate(refundReq.rejected_at, "dd MMM yyyy, HH:mm", "—")
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                isPending && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                isApproved && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                isRejected && "bg-destructive/10 text-destructive",
              )}
            >
              {isPending && <Clock className="size-4" />}
              {isApproved && <CheckCircle2 className="size-4" />}
              {isRejected && <XCircle className="size-4" />}
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg">Refund Request Status</DialogTitle>
              <DialogDescription className="text-xs">{registration.event_title || event?.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge banner */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-3",
              isPending && "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
              isApproved && "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
              isRejected && "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs">Status:</span>
              <Badge
                variant="outline"
                className={cn(
                  "border-current font-semibold text-[11px] capitalize",
                  isPending && "bg-amber-500/20",
                  isApproved && "bg-emerald-500/20",
                  isRejected && "bg-destructive/20",
                )}
              >
                {isPending && "Waiting for Approval"}
                {isApproved && "Refund Completed ✓"}
                {isRejected && "Rejected ✕"}
              </Badge>
            </div>
            <span className="font-bold text-xs">{formatRupiah(getRegistrationRefundAmount(registration, event))}</span>
          </div>

          {/* Rejection Alert Box */}
          {isRejected && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold text-xs">Request Rejected by Organizer</AlertTitle>
              <AlertDescription className="mt-1 space-y-1 text-xs">
                <p>
                  <strong>Reason:</strong> {refundReq.rejection_reason ?? "No explanation provided."}
                </p>
                {rejectedDate && <p className="text-[11px] opacity-75">Reviewed on: {rejectedDate}</p>}
                <p className="mt-1 text-[11px] opacity-90">
                  You can edit your bank details or cancellation reason and resubmit below.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Completion Proof Box */}
          {isApproved && (
            <div className="space-y-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
                <span>Disbursement Completed</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your refund of <strong>{formatRupiah(refundReq.refund_amount)}</strong> has been processed by the
                organizer.
                {completedDate && ` Transferred on ${completedDate}.`}
              </p>

              {refundReq.completion_notes && (
                <div className="rounded bg-background/80 p-2 text-[11px]">
                  <span className="font-medium text-foreground">Notes: </span>
                  <span className="text-muted-foreground">{refundReq.completion_notes}</span>
                </div>
              )}

              {refundReq.completion_proof_url && (
                <div className="mt-2 rounded-md border border-border/80 bg-background p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <FileText className="size-3.5 text-primary" />
                      Proof of Transfer Receipt
                    </span>
                    <a
                      href={refundReq.completion_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[11px] text-primary hover:underline"
                    >
                      <span>View Receipt</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  {refundReq.completion_proof_url.match(/\.(png|jpg|jpeg|webp|avif)$/i) && (
                    <div className="mt-2 overflow-hidden rounded border border-border">
                      <Image
                        src={refundReq.completion_proof_url}
                        alt="Transfer Proof"
                        width={400}
                        height={250}
                        unoptimized
                        className="max-h-48 w-full bg-muted/20 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Lock className="size-3 text-muted-foreground" />
                <span>This registration is finalized and cannot be modified.</span>
              </div>
            </div>
          )}

          {/* Submitted Bank & Details Card */}
          <div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-3.5 text-xs">
            <h4 className="font-semibold text-foreground text-xs">Beneficiary Bank Details</h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground">Bank Provider:</span>
                <p className="font-medium text-foreground">{refundReq.bank_name}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Account Holder:</span>
                <p className="font-medium text-foreground">{refundReq.bank_account_name}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-muted-foreground">Account Number:</span>
                <p className="font-mono font-semibold text-foreground tracking-wider">
                  {refundReq.bank_account_number}
                </p>
              </div>
            </div>

            <div className="border-border/50 border-t pt-2">
              <span className="text-[10px] text-muted-foreground">Cancellation Reason:</span>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground text-xs leading-relaxed">
                {refundReq.cancellation_reason}
              </p>
            </div>

            {refundReq.proof_media_url && (
              <div className="border-border/50 border-t pt-2">
                <span className="text-[10px] text-muted-foreground">Uploaded Supporting Proof:</span>
                <div className="mt-1">
                  <a
                    href={refundReq.proof_media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary text-xs hover:underline"
                  >
                    <FileText className="size-3.5" />
                    <span>{refundReq.proof_media_name ?? "View proof document"}</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-border/50 border-t pt-2 text-[10px] text-muted-foreground">
              <span>Submitted: {formattedDate}</span>
              {refundReq.resubmitted_at && (
                <span>Resubmitted: {formatFirestoreDate(refundReq.resubmitted_at, "dd MMM yyyy", "")}</span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2">
          {(isPending || isRejected) && onEditRequest && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEditRequest();
              }}
              className="gap-1.5 text-xs"
            >
              <Edit3 className="size-3.5" />
              {isRejected ? "Edit & Resubmit Form" : "Edit Request"}
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
