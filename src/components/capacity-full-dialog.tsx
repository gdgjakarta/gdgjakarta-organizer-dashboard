"use client";

import { AlertCircle, AlertTriangle, Layers, MapPin } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CapacityFullDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "organizer" | "attendee";
  title?: string;
  message?: string;
  reason?: "venue_full" | "session_full";
  attendeeName?: string;
  attendeeEmail?: string;
  sessionTitle?: string;
  currentCount?: number;
  maxCapacity?: number;
  venueName?: string;
  batchOverreachedItems?: Array<{
    type: "venue" | "session";
    title: string;
    currentApproved: number;
    maxCapacity: number;
    requestedToApprove: number;
    exceededBy: number;
  }>;
  onSelectAlternativeSession?: () => void;
  onGoToSettings?: () => void;
}

export function CapacityFullDialog({
  open,
  onOpenChange,
  mode = "attendee",
  title,
  message,
  reason = "venue_full",
  attendeeName,
  attendeeEmail,
  sessionTitle,
  currentCount,
  maxCapacity,
  venueName,
  batchOverreachedItems,
  onSelectAlternativeSession,
  onGoToSettings,
}: CapacityFullDialogProps) {
  const isOrganizer = mode === "organizer";
  const isSessionReason = reason === "session_full";

  let defaultTitle = "Event Registration Already Full";
  if (isOrganizer) {
    defaultTitle = isSessionReason ? "Session Capacity Limit Reached" : "Venue Capacity Limit Reached";
  } else if (isSessionReason) {
    defaultTitle = "Session Track Already Full";
  }
  const resolvedTitle = title ?? defaultTitle;

  let guidanceText =
    "This event is currently fully booked. Follow GDG Jakarta community channels for future announcements or seat openings.";
  if (isOrganizer) {
    guidanceText =
      "To approve this applicant, increase the session/venue capacity limit under the Registration Form tab, or change an existing attendee's status to Waitlisted/Rejected to free up a seat.";
  } else if (isSessionReason) {
    guidanceText =
      "Other session tracks may still have available seats. Please close this notice and select an alternate track to complete your registration.";
  }

  const defaultMessage = isOrganizer
    ? "This approval action was automatically blocked to prevent overreaching the configured attendee quota."
    : "We apologize, but no seats currently remain for this selection.";
  const resolvedMessage = message ?? defaultMessage;

  const percentage =
    currentCount !== undefined && maxCapacity !== undefined && maxCapacity > 0
      ? Math.min(100, Math.round((currentCount / maxCapacity) * 100))
      : 100;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[70] max-w-lg border-destructive/20 bg-background sm:p-6">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                <AlertCircle className="size-5" />
              </div>
              <Badge
                variant="outline"
                className="border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold"
              >
                {isSessionReason ? "Session Full" : "Venue Full"}
              </Badge>
            </div>
            {isOrganizer && (
              <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-wider">
                Organizer Protected
              </Badge>
            )}
          </div>

          <AlertDialogTitle className="text-left text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {resolvedTitle}
          </AlertDialogTitle>

          <AlertDialogDescription className="text-left text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {resolvedMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Breakdown Card */}
        <div className="my-2 space-y-3 rounded-lg border border-border/80 bg-muted/40 p-3.5 text-xs">
          {attendeeName && (
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
              <span className="font-medium text-muted-foreground">Applicant:</span>
              <span className="truncate font-semibold text-foreground">
                {attendeeName}
                {attendeeEmail && <span className="ml-1 font-normal text-muted-foreground">({attendeeEmail})</span>}
              </span>
            </div>
          )}

          {sessionTitle && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Layers className="size-3.5 text-primary" />
                Target Session:
              </span>
              <span className="font-semibold text-foreground">{sessionTitle}</span>
            </div>
          )}

          {venueName && !sessionTitle && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <MapPin className="size-3.5 text-primary" />
                Venue:
              </span>
              <span className="font-semibold text-foreground">{venueName}</span>
            </div>
          )}

          {currentCount !== undefined && maxCapacity !== undefined && maxCapacity > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Capacity Status:</span>
                <span className="font-semibold text-destructive">
                  {currentCount} / {maxCapacity} seats ({percentage}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-destructive transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Batch overreach breakdown if multiple items exceeded */}
          {batchOverreachedItems && batchOverreachedItems.length > 0 && (
            <div className="space-y-2 border-t border-border/50 pt-2">
              <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                Overreached Quotas:
              </span>
              <div className="space-y-1.5">
                {batchOverreachedItems.map((item) => (
                  <div
                    key={`${item.type}-${item.title}`}
                    className="flex items-center justify-between rounded-md bg-background/80 p-2 text-[11px]"
                  >
                    <span className="font-medium text-foreground">{item.title}</span>
                    <span className="font-mono text-destructive">
                      {item.currentApproved + item.requestedToApprove} / {item.maxCapacity} (+{item.exceededBy} over)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Guidance Box */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-left">
              <span className="font-semibold">{isOrganizer ? "How to resolve this:" : "What you can do:"}</span>
              <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">{guidanceText}</p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onSelectAlternativeSession && isSessionReason && !isOrganizer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                onOpenChange(false);
                onSelectAlternativeSession();
              }}
            >
              Choose Another Session
            </Button>
          )}

          {onGoToSettings && isOrganizer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                onOpenChange(false);
                onGoToSettings();
              }}
            >
              Adjust Capacity in Settings
            </Button>
          )}

          <AlertDialogAction className="text-xs" onClick={() => onOpenChange(false)}>
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
