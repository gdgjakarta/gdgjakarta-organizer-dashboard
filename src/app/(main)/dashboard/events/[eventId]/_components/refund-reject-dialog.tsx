"use client";

import { useState, useTransition } from "react";

import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/events/refund-utils";
import { rejectRefundAction } from "@/lib/firestore/actions";
import type { FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface RefundRejectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  eventId: string;
  onSuccess: (updated: FirestoreRegistration) => void;
}

export function RefundRejectDialog({
  isOpen,
  onOpenChange,
  registration,
  eventId,
  onSuccess,
}: RefundRejectDialogProps) {
  const user = useAuthStore((s) => s.user);
  const refundReq = registration.refund_request;
  const [reason, setReason] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  if (!refundReq) return null;

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error("Please provide a reason for rejecting the refund request.");
      return;
    }

    startTransition(async () => {
      const reviewer = {
        id: user?.id ?? "organizer",
        name: user?.name ?? user?.email ?? "Organizer",
        email: user?.email,
      };

      const res = await rejectRefundAction({
        registrationId: registration.id,
        eventId,
        reason: reason.trim(),
        reviewer,
      });

      if (res.success) {
        toast.success("Refund request has been rejected.");
        const now = new Date().toISOString();
        const updatedReq = {
          ...refundReq,
          status: "rejected" as const,
          rejection_reason: reason.trim(),
          rejected_at: now,
          rejected_by_id: reviewer.id,
          rejected_by_name: reviewer.name,
          rejected_by_email: reviewer.email,
          updated_at: now,
        };
        onSuccess({
          ...registration,
          refund_request: updatedReq,
          updated_at: now,
        });
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to reject refund request.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg">Reject Refund Request</DialogTitle>
              <DialogDescription className="text-xs">
                Provide feedback to the attendee on why their request cannot be processed
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-1.5 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Attendee:</span>
            <span className="font-semibold text-foreground">{registration.member_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bank Account:</span>
            <span className="font-mono text-muted-foreground">
              {refundReq.bank_name} - {refundReq.bank_account_number} ({refundReq.bank_account_name})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-semibold text-foreground">{formatRupiah(refundReq.refund_amount)}</span>
          </div>
        </div>

        <form onSubmit={handleReject} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rejectReason" className="font-medium text-xs">
              Rejection Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejectReason"
              placeholder="e.g. Bank account holder name does not match attendee, or request submitted past the allowed policy deadline."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none text-xs leading-relaxed"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              This message will be shown directly to the attendee so they can correct any inaccuracies and resubmit if
              appropriate.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting || !reason.trim()}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
