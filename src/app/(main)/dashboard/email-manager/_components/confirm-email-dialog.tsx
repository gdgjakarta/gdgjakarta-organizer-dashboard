"use client";

import { AlertTriangle, CheckCircle2, Loader2, Mail, Send, Users, Zap } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConfirmEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  mode: "single" | "audience" | "spreadsheet";
  eventTitle?: string;
  subject: string;
  singleRecipient?: {
    email: string;
    name?: string;
  };
  audienceCount?: number;
  audienceLabel?: string;
  sheetName?: string;
}

export function ConfirmEmailDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  mode,
  eventTitle,
  subject,
  singleRecipient,
  audienceCount = 0,
  audienceLabel,
  sheetName,
}: ConfirmEmailDialogProps) {
  const isSingle = mode === "single";

  const renderRecipientDetails = () => {
    if (isSingle) {
      return (
        <div className="flex items-start justify-between gap-2 border-t pt-2">
          <span className="text-muted-foreground text-xs">Recipient:</span>
          <div className="text-right">
            <div className="font-semibold text-foreground text-xs">{singleRecipient?.name ?? "Single Recipient"}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{singleRecipient?.email}</div>
          </div>
        </div>
      );
    }

    if (mode === "audience") {
      return (
        <>
          <div className="flex items-start justify-between gap-2 border-t pt-2">
            <span className="text-muted-foreground text-xs">Audience Segment:</span>
            <span className="font-medium text-foreground text-right text-xs">{audienceLabel ?? "Bevy Attendees"}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <span className="text-muted-foreground text-xs">Total Recipients:</span>
            <Badge variant="secondary" className="font-semibold text-xs">
              {audienceCount.toLocaleString()} {audienceCount === 1 ? "recipient" : "recipients"}
            </Badge>
          </div>
        </>
      );
    }

    return (
      <div className="flex items-start justify-between gap-2 border-t pt-2">
        <span className="text-muted-foreground text-xs">Google Sheet Tab:</span>
        <span className="font-medium text-foreground text-right text-xs">{sheetName ?? "Default Sheet"}</span>
      </div>
    );
  };

  const confirmButtonLabel = (() => {
    if (isSubmitting) return "Dispatching...";
    if (isSingle) return "Confirm & Send Email";
    return `Confirm & Send Bulk (${audienceCount})`;
  })();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                isSingle
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
              }`}
            >
              {isSingle ? <Mail className="size-5" /> : <Users className="size-5" />}
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                {isSingle ? "Confirm Quick Send Email" : "Confirm Bulk Email Campaign"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                {isSingle
                  ? "Please verify the recipient and email details before dispatching."
                  : "Please review the campaign delivery details before queueing."}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {/* Target Event */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground text-xs">Target Event:</span>
              <span className="font-semibold text-foreground text-right text-xs">
                {eventTitle ?? "GDG Jakarta Event"}
              </span>
            </div>

            {/* Recipient Details */}
            {renderRecipientDetails()}

            {/* Subject */}
            <div className="flex items-start justify-between gap-2 border-t pt-2">
              <span className="text-muted-foreground text-xs">Subject Line:</span>
              <span className="max-w-[260px] truncate font-medium text-foreground text-right text-xs" title={subject}>
                {subject}
              </span>
            </div>

            {/* Target API Method */}
            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <span className="text-muted-foreground text-xs">Delivery API:</span>
              {isSingle ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 text-[11px] text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="size-3" />
                  Send Email API (/send-email)
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-sky-500/30 text-[11px] text-sky-600 dark:text-sky-400">
                  <Zap className="size-3" />
                  Send Bulk Email API (/send-bulk-email)
                </Badge>
              )}
            </div>
          </div>

          {/* Warning / Caution Banner */}
          <div
            className={`flex items-start gap-2 rounded-md p-2.5 text-xs ${
              isSingle
                ? "bg-muted text-muted-foreground"
                : "border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300"
            }`}
          >
            {isSingle ? (
              <Mail className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            )}
            <div>
              {isSingle ? (
                <span>
                  This email will be dispatched directly to <strong>{singleRecipient?.email}</strong> with personal
                  template variables substituted.
                </span>
              ) : (
                <span>
                  This action will queue emails for <strong>{audienceCount.toLocaleString()} recipients</strong>. Once
                  dispatched, queued emails cannot be recalled.
                </span>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {confirmButtonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
