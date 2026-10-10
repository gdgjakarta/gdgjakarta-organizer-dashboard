"use client";

import { useState } from "react";

import { AlertTriangle, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteEventRegistrationAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { sendAttendeeCancelEmailAction } from "@/server/email-template-actions";

export interface CancelRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
  eventTitle?: string;
  onSuccess?: () => void;
}

export function CancelRegistrationDialog({
  open,
  onOpenChange,
  registration,
  event,
  eventTitle,
  onSuccess,
}: CancelRegistrationDialogProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const displayTitle = eventTitle ?? event?.title ?? registration.event_title ?? "this event";
  const memberEmail = registration.member_email ?? "";

  const handleConfirmCancel = async () => {
    try {
      setIsCancelling(true);
      const email = memberEmail.toLowerCase().trim();
      const name = registration.member_name ?? "Attendee";
      const eventId = String(registration.event_id);

      // 1. Send attendee cancellation email notification via webhook API
      const emailRes = await sendAttendeeCancelEmailAction({
        registrationId: registration.id,
        eventId,
        attendeeName: name,
        attendeeEmail: email,
        eventData: event,
      });

      if (!emailRes.success) {
        toast.error(emailRes.error ?? "Failed to send cancellation email. Registration was not cancelled.");
        setIsCancelling(false);
        return;
      }

      // 2. Delete registration from Firestore & Bevy roster, decrement capacity counters
      const deleteRes = await deleteEventRegistrationAction(registration.id, eventId, registration.bevy_attendee_id);

      if (!deleteRes.success) {
        toast.error(deleteRes.error ?? "Failed to remove event registration.");
        setIsCancelling(false);
        return;
      }

      toast.success("Your registration has been cancelled. Confirmation email sent.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("[CancelRegistrationDialog] Error cancelling registration:", err);
      toast.error("An unexpected error occurred while cancelling your registration.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(val) => !isCancelling && onOpenChange(val)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5 text-destructive">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle className="font-semibold text-base">Cancel Your Registration?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2 text-xs sm:text-sm">
            <span>
              Are you sure you want to cancel your registration for{" "}
              <strong className="text-foreground">{displayTitle}</strong>?
            </span>

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive leading-relaxed text-xs dark:bg-destructive/10">
              <p className="font-semibold">⚠️ Notice:</p>
              <p className="mt-1">
                Your registration has been canceled and your registration will be removed from the event. If you change
                your mind, you need to re-register again.
              </p>
            </div>

            <p className="text-muted-foreground text-xs">
              Your allocated ticket and spot will be released immediately. A confirmation email will be sent to{" "}
              {memberEmail ? <strong className="text-foreground">{memberEmail}</strong> : "your email address"}.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2 flex-row justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isCancelling} onClick={() => onOpenChange(false)}>
            Keep Registration
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isCancelling}
            onClick={handleConfirmCancel}
            className="gap-1.5"
          >
            {isCancelling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <UserX className="size-3.5" />
                Yes, Cancel Registration
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
