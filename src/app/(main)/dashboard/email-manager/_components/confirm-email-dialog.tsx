"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Mail, Send, Users, Zap } from "lucide-react";

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
  sheetRowCount?: number;
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
  sheetRowCount,
}: ConfirmEmailDialogProps) {
  const isSingle = mode === "single";
  const isSheet = mode === "spreadsheet";

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
      <>
        <div className="flex items-start justify-between gap-2 border-t pt-2">
          <span className="text-muted-foreground text-xs">Recipient Source:</span>
          <Badge variant="outline" className="gap-1 border-teal-500/30 text-[11px] text-teal-700 dark:text-teal-400">
            <FileSpreadsheet className="size-3" />
            Google Sheets Import
          </Badge>
        </div>
        <div className="flex items-start justify-between gap-2 border-t pt-2">
          <span className="text-muted-foreground text-xs">Google Sheet Tab:</span>
          <span className="font-semibold text-foreground text-right text-xs">{sheetName ?? "Default Sheet"}</span>
        </div>
        {typeof sheetRowCount === "number" && sheetRowCount > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <span className="text-muted-foreground text-xs">Total Sheet Rows:</span>
            <Badge variant="secondary" className="font-semibold text-xs">
              {sheetRowCount.toLocaleString()} {sheetRowCount === 1 ? "recipient" : "recipients"}
            </Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <span className="text-muted-foreground text-xs">Recipient Data:</span>
            <span className="font-medium text-muted-foreground text-right text-xs">Imported from Google Sheet</span>
          </div>
        )}
      </>
    );
  };

  const confirmButtonLabel = (() => {
    if (isSubmitting) return "Dispatching...";
    if (isSingle) return "Confirm & Send Email";
    if (isSheet) {
      return typeof sheetRowCount === "number" && sheetRowCount > 0
        ? `Confirm & Send Bulk (${sheetRowCount.toLocaleString()})`
        : "Confirm & Send Bulk (Sheet)";
    }
    return `Confirm & Send Bulk (${audienceCount.toLocaleString()})`;
  })();

  const headerIconConfig = (() => {
    if (isSingle) {
      return {
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        icon: <Mail className="size-5" />,
      };
    }
    if (isSheet) {
      return {
        className: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
        icon: <FileSpreadsheet className="size-5" />,
      };
    }
    return {
      className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      icon: <Users className="size-5" />,
    };
  })();

  const dialogText = (() => {
    if (isSingle) {
      return {
        title: "Confirm Quick Send Email",
        description: "Please verify the recipient and email details before dispatching.",
      };
    }
    if (isSheet) {
      return {
        title: "Confirm Spreadsheet Bulk Campaign",
        description: "Please review the Google Sheets campaign details before dispatching.",
      };
    }
    return {
      title: "Confirm Bulk Email Campaign",
      description: "Please review the campaign delivery details before queueing.",
    };
  })();

  const warningBanner = (() => {
    if (isSingle) {
      return {
        icon: <Mail className="mt-0.5 size-4 shrink-0 text-emerald-500" />,
        content: (
          <span>
            This email will be dispatched directly to <strong>{singleRecipient?.email}</strong> with personal template
            variables substituted.
          </span>
        ),
      };
    }
    if (isSheet) {
      return {
        icon: <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />,
        content: (
          <span>
            This action will dispatch bulk emails to all recipient rows in Google Sheet tab{" "}
            <strong>&quot;{sheetName ?? "Sheet"}&quot;</strong>
            {typeof sheetRowCount === "number" && sheetRowCount > 0 ? (
              <>
                {" "}
                (<strong>{sheetRowCount.toLocaleString()} recipients</strong>)
              </>
            ) : null}
            . Once dispatched, queued emails cannot be recalled.
          </span>
        ),
      };
    }
    return {
      icon: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />,
      content: (
        <span>
          This action will queue emails for <strong>{audienceCount.toLocaleString()} recipients</strong> from the Bevy
          audience. Once dispatched, queued emails cannot be recalled.
        </span>
      ),
    };
  })();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${headerIconConfig.className}`}
            >
              {headerIconConfig.icon}
            </div>
            <div>
              <AlertDialogTitle className="text-lg">{dialogText.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">{dialogText.description}</AlertDialogDescription>
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
            {warningBanner.icon}
            <div>{warningBanner.content}</div>
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
