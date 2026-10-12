"use client";

import { useState, useTransition } from "react";

import { AlertTriangle, Loader2, XCircle } from "lucide-react";
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
import { rejectMerchandiseDeliveryAction } from "@/lib/firestore/actions";
import type { FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface DeliveryRejectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  eventId: string;
  onSuccess: (updated: FirestoreRegistration) => void;
}

export function DeliveryRejectDialog({
  isOpen,
  onOpenChange,
  registration,
  eventId,
  onSuccess,
}: DeliveryRejectDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [reason, setReason] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error("Please provide a reason for rejecting the delivery request.");
      return;
    }

    startTransition(async () => {
      const reviewer = {
        id: user?.id ?? "organizer",
        name: user?.name ?? user?.email ?? "Organizer",
        email: user?.email,
      };

      const res = await rejectMerchandiseDeliveryAction({
        registrationId: registration.id,
        eventId,
        reason: reason.trim(),
        reviewer,
      });

      if (res.success) {
        toast.success("Delivery request rejected.");
        if (registration.delivery_request) {
          const updated: FirestoreRegistration = {
            ...registration,
            delivery_request: {
              ...registration.delivery_request,
              status: "rejected",
              rejection_reason: reason.trim(),
              reviewed_by_id: reviewer.id,
              reviewed_by_name: reviewer.name,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          };
          onSuccess(updated);
        }
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to reject delivery request.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="size-5" />
            <DialogTitle className="text-lg">Reject Delivery Request</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Are you sure you want to reject the delivery request for <strong>{registration.member_name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReject} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rejectionReason" className="text-xs">
              Reason for Rejection <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejectionReason"
              placeholder="e.g. Delivery address outside coverage area / Merchandise stock defect / Item already claimed in person..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="text-xs"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>This reason will be visible to the attendee on their dashboard.</span>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="h-8 gap-1.5 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="size-3.5" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
