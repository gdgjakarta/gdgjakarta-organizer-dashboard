"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { format } from "date-fns";
import {
  BookOpen,
  Check,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  Filter,
  Hourglass,
  Layers,
  Loader2,
  Mail,
  MoreHorizontal,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
  Truck,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CapacityFullDialog } from "@/components/capacity-full-dialog";
import { Shimmer } from "@/components/shimmer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BevyAttendee } from "@/lib/bevy/types";
import { formatFirestoreDate } from "@/lib/date-utils";
import { buildApprovedAttendeePayload } from "@/lib/events/approved-attendee-webhook";
import { validateAttendeeApprovalCapacity, validateBatchApprovalCapacity } from "@/lib/events/capacity-validator";
import {
  buildRegistrationPaymentPayload,
  calculateRegistrationTotalAmount,
  hasRegistrationPaymentRequirements,
} from "@/lib/events/doku-payment";
import {
  getEffectiveRegistrationStatus,
  getRegistrationPaymentDeadline,
  isEventCurationMode,
  isPaidRegistration,
  isRegistrationPaymentOverdue,
} from "@/lib/events/payment-deadline";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import {
  deleteBatchEventRegistrationsAction,
  deleteEventRegistrationAction,
  updateRegistrationCheckInAction,
  updateRegistrationStatusAction,
} from "@/lib/firestore/actions";
import { normalizeRegistrationDoc } from "@/lib/firestore/normalization";
import type {
  CustomQuestion,
  EventSession,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";
import { checkInBevyAttendeeAction, fetchAllBevyEventAttendeesAction } from "@/server/bevy-actions";
import {
  rejectAttendeeAction,
  resendInterestEmailAction,
  sendCancelAttendeeEmailAction,
  sendPaidWaitlistAttendeeEmailAction,
  sendWaitlistAttendeeEmailAction,
} from "@/server/email-template-actions";
import { checkDokuPaymentStatusAction, generatePaymentLinkAction } from "@/server/payment-actions";
import { approveAttendeeWebhookAction } from "@/server/registration-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { ApplicantDetailDialog } from "./applicant-detail-dialog";
import { AttendeeStatusGuideDialog } from "./attendee-status-guide-dialog";
import { CheckPaymentStatusDialog } from "./check-payment-status-dialog";
import { type AvailableQuestionField, ColumnCustomizer } from "./column-customizer";
import {
  collectMerchandiseFilterOptions,
  formatMerchandiseSummary,
  parseMerchandiseVariations,
} from "./merchandise-helpers";
import { QuestionColumnValueCell } from "./question-column-value-cell";
import { QuestionResponsesCell } from "./question-responses-cell";
import { RegistrantStatistics } from "./registrant-statistics";
import { ResendPaymentLinkDialog } from "./resend-payment-link-dialog";

interface RegistrantsTabProps {
  eventId: string;
  registrations: FirestoreRegistration[];
  event?: FirestoreEvent;
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string; dotClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  waiting_for_payment: {
    label: "Waiting for Payment",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  paid_and_registered: {
    label: "Paid & Registered",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  expired: {
    label: "Expired",
    badgeClass: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    dotClass: "bg-zinc-500",
  },
  failed: {
    label: "Failed",
    badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
  canceled: {
    label: "Canceled",
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
  },
  cancelled: {
    label: "Canceled",
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
  },
  approved: {
    label: "Approved",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  registered: {
    label: "Registered",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  paid_waitlisted: {
    label: "Paid Waitlist",
    badgeClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    dotClass: "bg-indigo-500",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
};

function getTicketBadgeText(type?: string, price?: number): string {
  if (type === "free") return "Free RSVP";
  if (type === "paid") return `Rp ${(price ?? 0).toLocaleString("id-ID")}`;
  return `Deposit Rp ${(price ?? 0).toLocaleString("id-ID")}`;
}

function resolveAnswerValue(
  answers: Record<string, unknown> | undefined,
  fieldKey: string,
  questionLabelMap: Map<string, string>,
): unknown {
  if (!answers) return undefined;
  if (answers[fieldKey] !== undefined) return answers[fieldKey];

  const lower = fieldKey.toLowerCase().trim();
  for (const [k, v] of Object.entries(answers)) {
    const kLower = k.toLowerCase().trim();
    if (kLower === lower) return v;
    const mappedK = (questionLabelMap.get(kLower) ?? k).toLowerCase().trim();
    const mappedField = (questionLabelMap.get(lower) ?? fieldKey).toLowerCase().trim();
    if (mappedK === mappedField) return v;
  }
  return undefined;
}

function getQuestionFilterOptions(
  field: AvailableQuestionField,
  registrations: FirestoreRegistration[],
  questionLabelMap: Map<string, string>,
): Array<{ value: string; label: string; count: number }> {
  const valueCounts = new Map<string, number>();

  if (field.options && Array.isArray(field.options)) {
    for (const opt of field.options) {
      if (opt && typeof opt === "string" && opt.trim()) {
        valueCounts.set(opt.trim(), 0);
      }
    }
  }

  for (const reg of registrations) {
    const rawVal = resolveAnswerValue(reg.answers, field.key, questionLabelMap);
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;

    if (Array.isArray(rawVal)) {
      for (const item of rawVal) {
        const str = String(item).trim();
        if (str) {
          valueCounts.set(str, (valueCounts.get(str) ?? 0) + 1);
        }
      }
    } else {
      const str = String(rawVal).trim();
      if (str) {
        valueCounts.set(str, (valueCounts.get(str) ?? 0) + 1);
      }
    }
  }

  return Array.from(valueCounts.entries())
    .map(([val, count]) => ({
      value: val,
      label: `${val} (${count})`,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const SKELETON_ROW_IDS = ["row-1", "row-2", "row-3", "row-4", "row-5"];
const SKELETON_COL_IDS = [
  "col-1",
  "col-2",
  "col-3",
  "col-4",
  "col-5",
  "col-6",
  "col-7",
  "col-8",
  "col-9",
  "col-10",
  "col-11",
  "col-12",
  "col-13",
  "col-14",
  "col-15",
  "col-16",
  "col-17",
  "col-18",
  "col-19",
  "col-20",
];

function RegistrantsTableSkeleton({
  hasSessions,
  hasTickets = false,
  hasMerchandise = false,
  visibleStandardColumns = {},
  questionColumnCount = 0,
  isCurationMode = true,
}: {
  hasSessions: boolean;
  hasTickets?: boolean;
  hasMerchandise?: boolean;
  visibleStandardColumns?: Record<string, boolean>;
  questionColumnCount?: number;
  isCurationMode?: boolean;
}) {
  return (
    <>
      {SKELETON_ROW_IDS.map((rowId) => (
        <TableRow key={rowId}>
          <TableCell className="w-10">
            <div className="relative size-4 overflow-hidden rounded-xs bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <div className="relative h-3.5 w-28 overflow-hidden rounded bg-muted">
                  <div className="shimmer-wave" aria-hidden="true" />
                </div>
                <div className="relative h-3 w-36 overflow-hidden rounded bg-muted/70">
                  <div className="shimmer-wave" aria-hidden="true" />
                </div>
              </div>
            </div>
          </TableCell>
          {visibleStandardColumns.status !== false && (
            <TableCell>
              <div className="relative h-5 w-24 overflow-hidden rounded-full bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {isCurationMode && visibleStandardColumns.reviewed_by !== false && (
            <TableCell>
              <div className="relative h-4 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {hasTickets && visibleStandardColumns.ticket !== false && (
            <TableCell>
              <div className="relative h-5 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {hasMerchandise && visibleStandardColumns.merchandise !== false && (
            <TableCell>
              <div className="relative h-5 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {hasSessions && visibleStandardColumns.session !== false && (
            <TableCell>
              <div className="relative h-4 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {visibleStandardColumns.checkin !== false && (
            <TableCell>
              <div className="relative h-5 w-20 overflow-hidden rounded-md bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {SKELETON_COL_IDS.slice(0, questionColumnCount).map((colId) => (
            <TableCell key={colId}>
              <div className="relative h-4 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          ))}
          {visibleStandardColumns.all_responses !== false && (
            <TableCell className="max-w-[380px]">
              <div className="relative h-4 w-44 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {visibleStandardColumns.registered_at !== false && (
            <TableCell className="whitespace-nowrap">
              <div className="relative h-3.5 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          {visibleStandardColumns.actions !== false && (
            <TableCell className="whitespace-nowrap text-right">
              <div className="relative ml-auto size-7 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  );
}

function parseSearchTokens(query: string): string[] {
  if (!query.trim()) return [];
  const tokens = query
    .split(";")
    .map((token) => token.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

function matchesRegistrationToken(reg: FirestoreRegistration, tokenLower: string): boolean {
  if (!tokenLower) return true;

  const matchesMerch = Boolean(
    reg.selected_merchandise?.some((m) => {
      if (m.name.toLowerCase().includes(tokenLower)) return true;
      if (m.selected_size?.toLowerCase().includes(tokenLower)) return true;
      if (m.selected_variant?.toLowerCase().includes(tokenLower)) return true;
      if (m.selected_variations) {
        return Object.entries(m.selected_variations).some(
          ([k, v]) => k.toLowerCase().includes(tokenLower) || v.toLowerCase().includes(tokenLower),
        );
      }
      return false;
    }),
  );

  return Boolean(
    reg.member_name.toLowerCase().includes(tokenLower) ||
      reg.member_email.toLowerCase().includes(tokenLower) ||
      Boolean(reg.referral_code?.toLowerCase().includes(tokenLower)) ||
      Boolean(reg.referrer_name?.toLowerCase().includes(tokenLower)) ||
      Boolean(reg.voucher_code?.toLowerCase().includes(tokenLower)) ||
      Boolean(reg.reviewed_by_name?.toLowerCase().includes(tokenLower)) ||
      Boolean(reg.reviewed_by_email?.toLowerCase().includes(tokenLower)) ||
      Boolean(reg.ticket_name?.toLowerCase().includes(tokenLower)) ||
      Boolean(reg.bundle_name?.toLowerCase().includes(tokenLower)) ||
      matchesMerch ||
      (reg.answers && JSON.stringify(reg.answers).toLowerCase().includes(tokenLower)),
  );
}

export function RegistrantsTab({ eventId, registrations, event }: RegistrantsTabProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading || s.isLoggingOut);
  const [registrationsList, setRegistrationsList] = useState<FirestoreRegistration[]>(() =>
    registrations.map((r) => normalizeRegistrationDoc(r as unknown as Record<string, unknown>, r.id)),
  );
  const [isLoading, setIsLoading] = useState(registrations.length === 0);
  const [isFiltering, setIsFiltering] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [merchandiseFilter, setMerchandiseFilter] = useState<string>("all");
  const [merchandiseVariantFilter, setMerchandiseVariantFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [isStatusGuideOpen, setIsStatusGuideOpen] = useState(false);
  const [sessions, setSessions] = useState<EventSession[]>(event?.sessions ?? []);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(event?.custom_questions ?? []);
  const [emailTemplates, setEmailTemplates] = useState(event?.email_templates);
  const [firestoreEventDoc, setFirestoreEventDoc] = useState<FirestoreEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectRegistration, setInspectRegistration] = useState<FirestoreRegistration | null>(null);
  const [deleteConfirmRegistration, setDeleteConfirmRegistration] = useState<FirestoreRegistration | null>(null);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelConfirmRegistration, setCancelConfirmRegistration] = useState<FirestoreRegistration | null>(null);
  const [isBatchCancelConfirmOpen, setIsBatchCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [capacityAlert, setCapacityAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
    reason?: "venue_full" | "session_full";
    attendeeName?: string;
    attendeeEmail?: string;
    sessionTitle?: string;
    currentCount?: number;
    maxCapacity?: number;
    batchOverreachedItems?: Array<{
      type: "venue" | "session";
      title: string;
      currentApproved: number;
      maxCapacity: number;
      requestedToApprove: number;
      exceededBy: number;
    }>;
  } | null>(null);

  // Dynamic table column customization and question filters
  const [selectedQuestionColumns, setSelectedQuestionColumns] = useState<string[]>([]);
  const [visibleStandardColumns, setVisibleStandardColumns] = useState<Record<string, boolean>>({
    applicant: true,
    status: true,
    reviewed_by: true,
    ticket: true,
    merchandise: true,
    session: true,
    checkin: true,
    all_responses: true,
    registered_at: true,
    actions: true,
  });
  const [questionFilters, setQuestionFilters] = useState<Record<string, string>>({});
  const [bevyAttendeesMap, setBevyAttendeesMap] = useState<Map<string, BevyAttendee>>(new Map());
  const [isSyncingBevy, setIsSyncingBevy] = useState(false);
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [isCheckingInId, setIsCheckingInId] = useState<string | null>(null);
  const [approvingRegistrationId, setApprovingRegistrationId] = useState<string | null>(null);
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [rejectingRegistrationId, setRejectingRegistrationId] = useState<string | null>(null);
  const [isBatchRejecting, setIsBatchRejecting] = useState(false);
  const [waitlistingRegistrationId, setWaitlistingRegistrationId] = useState<string | null>(null);
  const [isBatchWaitlisting, setIsBatchWaitlisting] = useState(false);
  const [isResendingInterestId, setIsResendingInterestId] = useState<string | null>(null);
  const [isBatchResendingInterest, setIsBatchResendingInterest] = useState(false);
  const [isResendingWaitlistId, setIsResendingWaitlistId] = useState<string | null>(null);
  const [isResendingPaidWaitlistId, setIsResendingPaidWaitlistId] = useState<string | null>(null);
  const [resendPaymentRegistration, setResendPaymentRegistration] = useState<FirestoreRegistration | null>(null);
  const [checkingPaymentRegistration, setCheckingPaymentRegistration] = useState<FirestoreRegistration | null>(null);
  const [isCheckPaymentDialogOpen, setIsCheckPaymentDialogOpen] = useState(false);
  const [isBatchCheckingPayment, setIsBatchCheckingPayment] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (registrations.length > 0) {
      setRegistrationsList(
        registrations.map((r) => normalizeRegistrationDoc(r as unknown as Record<string, unknown>, r.id)),
      );
      setIsLoading(false);
    }
  }, [registrations]);

  useEffect(() => {
    // If auth is still resolving, hold off until credentials and session are ready
    if (isAuthLoading) {
      return;
    }

    let unsubscribe: () => void = () => {
      // No-op initial cleanup
    };

    async function initRegistrations() {
      try {
        const { getGlobalAuthUser } = await import("@/stores/auth/auth-store");
        const { hasTeamOperationalAccess } = await import("@/lib/auth-roles");
        const currentUser = user ?? getGlobalAuthUser();

        // Non-team users lack permissions to list all event registrations in Firestore rules.
        if (!hasTeamOperationalAccess(currentUser)) {
          setIsLoading(false);
          return;
        }

        const { getEventRegistrations, subscribeEventRegistrations } = await import("@/lib/firestore/client");

        // 1. Initial direct load
        const directList = await getEventRegistrations(eventId);
        if (directList && directList.length > 0) {
          setRegistrationsList(directList);
          setIsLoading(false);
          const { recalculateEventCapacityCounters } = await import("@/lib/firestore/client");
          void recalculateEventCapacityCounters(eventId, directList);
        }

        // 2. Real-time subscription listener
        unsubscribe = subscribeEventRegistrations(
          eventId,
          (liveList) => {
            setRegistrationsList(liveList);
            setIsLoading(false);
          },
          (err) => {
            const isPermission =
              err &&
              typeof err === "object" &&
              ("code" in err
                ? (err as { code?: string }).code === "permission-denied"
                : "message" in err &&
                  typeof (err as { message?: string }).message === "string" &&
                  (err as { message?: string }).message?.includes("permission"));
            if (isPermission) {
              console.warn(`[RegistrantsTab] Live registrations listener restricted for event: ${eventId}`);
            } else {
              console.warn("[RegistrantsTab] Live registrations listener warning:", err);
            }
            setIsLoading(false);
          },
        );
      } catch (err) {
        console.warn("[RegistrantsTab] Failed to initialize registrations listener:", err);
        setIsLoading(false);
      }
    }

    void initRegistrations();

    return () => {
      unsubscribe();
    };
  }, [eventId, isAuthLoading, user]);

  useEffect(() => {
    let unsub = () => {
      // cleanup
    };
    void (async () => {
      try {
        const { subscribeFirestoreEventDoc } = await import("@/lib/firestore/client");
        unsub = subscribeFirestoreEventDoc(eventId, (doc) => {
          if (doc) {
            setFirestoreEventDoc(doc);
            if (doc.sessions && doc.sessions.length > 0) {
              setSessions(doc.sessions);
            }
          }
        });
      } catch (err) {
        console.warn("[RegistrantsTab] Failed to subscribe to event doc:", err);
      }
    })();
    return () => unsub();
  }, [eventId]);

  const syncBevyAttendees = useCallback(
    async (showNotification = false) => {
      setIsSyncingBevy(true);
      try {
        const res = await fetchAllBevyEventAttendeesAction(eventId);
        if (!res.success) {
          console.warn("[RegistrantsTab] Failed to fetch Bevy attendees for check-in sync:", res.error);
          if (showNotification) {
            toast.error(res.error ?? "Failed to sync attendees from Bevy.");
          }
          return;
        }

        const attendees = res.results;
        const map = new Map<string, BevyAttendee>();
        for (const att of attendees) {
          if (att.email) {
            map.set(att.email.toLowerCase().trim(), att);
          }
        }
        setBevyAttendeesMap(map);

        // Silently sync check-in states to registrationsList & update Firestore when there's new data
        if (map.size > 0) {
          setRegistrationsList((prev) =>
            prev.map((reg) => {
              const email = (reg.member_email || "").toLowerCase().trim();
              const bevyAtt = map.get(email);
              if (bevyAtt) {
                const isCheckedIn = Boolean(bevyAtt.is_checked_in);
                const bevyId = bevyAtt.id;
                const checkinDate = bevyAtt.checkin_date || (isCheckedIn ? new Date().toISOString() : null);

                if (reg.is_checked_in !== isCheckedIn || reg.bevy_attendee_id !== bevyId) {
                  void updateRegistrationCheckInAction(reg.id, eventId, isCheckedIn, bevyId, checkinDate);
                  return {
                    ...reg,
                    is_checked_in: isCheckedIn,
                    bevy_attendee_id: bevyId,
                    checkin_date: checkinDate,
                    checked_in_at: isCheckedIn ? (checkinDate ?? new Date().toISOString()) : undefined,
                  };
                }
              }
              return reg;
            }),
          );
        }

        if (showNotification) {
          toast.success(`Synced ${attendees.length} attendee(s) from Bevy API.`);
        }
      } catch (err) {
        console.warn("[RegistrantsTab] Failed to sync Bevy attendees:", err);
        if (showNotification) {
          toast.error("Failed to sync attendees from Bevy.");
        }
      } finally {
        setIsSyncingBevy(false);
      }
    },
    [eventId],
  );

  const handleSyncBevyAttendeeStatus = useCallback(async () => {
    setIsSyncingStatus(true);
    try {
      // 1. Fetch complete Bevy attendee roster across all pages
      const res = await fetchAllBevyEventAttendeesAction(eventId);
      if (!res.success) {
        console.error("[handleSyncBevyAttendeeStatus] Bevy fetch error:", res.error);
        toast.error(res.error ?? "Failed to fetch attendees from Bevy API.");
        return;
      }

      const attendees = res.results;
      const bevyEmailSet = new Set<string>();
      const nextBevyMap = new Map<string, BevyAttendee>();

      for (const att of attendees) {
        if (att.email) {
          const normalized = att.email.toLowerCase().trim();
          bevyEmailSet.add(normalized);
          nextBevyMap.set(normalized, att);
        }
      }
      setBevyAttendeesMap(nextBevyMap);

      // 2. Identify attendees who are approved on dashboard but NOT in Bevy
      const missingApproved = registrationsList.filter((reg) => {
        const isApproved = (reg.status ?? "").toLowerCase().trim() === "approved";
        if (!isApproved) return false;
        const email = (reg.member_email || "").toLowerCase().trim();
        return !email || !bevyEmailSet.has(email);
      });

      if (missingApproved.length === 0) {
        const totalApproved = registrationsList.filter(
          (reg) => (reg.status ?? "").toLowerCase().trim() === "approved",
        ).length;
        toast.success(`Bevy attendee sync complete. All ${totalApproved} approved attendee(s) are present in Bevy.`);
        return;
      }

      // 3. Reset missing approved attendees to "pending" (Pending Review)
      const missingIds = new Set(missingApproved.map((r) => r.id));
      const updatePromises = missingApproved.map(async (reg) => {
        await updateRegistrationStatusAction(reg.id, eventId, "pending");
        if (reg.is_checked_in || reg.bevy_attendee_id) {
          await updateRegistrationCheckInAction(reg.id, eventId, false, null, null);
        }
      });

      await Promise.allSettled(updatePromises);

      // 4. Synchronize local registrations state
      setRegistrationsList((prev) =>
        prev.map((reg) => {
          if (missingIds.has(reg.id)) {
            return {
              ...reg,
              status: "pending",
              reviewed_at: undefined,
              reviewed_by_id: undefined,
              reviewed_by_name: undefined,
              reviewed_by_email: undefined,
              is_checked_in: false,
              bevy_attendee_id: undefined,
              checkin_date: undefined,
              checked_in_at: undefined,
            };
          }
          return reg;
        }),
      );

      setInspectRegistration((prev) => {
        if (prev && missingIds.has(prev.id)) {
          return {
            ...prev,
            status: "pending",
            reviewed_at: undefined,
            reviewed_by_id: undefined,
            reviewed_by_name: undefined,
            reviewed_by_email: undefined,
            is_checked_in: false,
            bevy_attendee_id: undefined,
            checkin_date: undefined,
            checked_in_at: undefined,
          };
        }
        return prev;
      });

      toast.success(
        `Synced Bevy attendee status: ${missingApproved.length} attendee(s) removed from Bevy reset to Pending Review.`,
      );
    } catch (err) {
      console.error("[RegistrantsTab] Error syncing Bevy attendee status:", err);
      toast.error("Failed to sync attendee status from Bevy.");
    } finally {
      setIsSyncingStatus(false);
    }
  }, [eventId, registrationsList]);

  useEffect(() => {
    if (eventId) {
      void syncBevyAttendees(false);
    }
  }, [eventId, syncBevyAttendees]);

  const handleStatusFilterChange = (val: string) => {
    setIsFiltering(true);
    setStatusFilter(val);
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const handleSessionFilterChange = (val: string) => {
    setIsFiltering(true);
    setSessionFilter(val);
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const handleTicketFilterChange = (val: string) => {
    setIsFiltering(true);
    setTicketFilter(val);
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const handleSearchChange = (val: string) => {
    setIsFiltering(true);
    setSearch(val);
    setTimeout(() => {
      setIsFiltering(false);
    }, 150);
  };

  const searchTokens = useMemo(() => parseSearchTokens(search), [search]);

  const handleRemoveSearchToken = (indexToRemove: number) => {
    setIsFiltering(true);
    const updatedTokens = searchTokens.filter((_, idx) => idx !== indexToRemove);
    setSearch(updatedTokens.join("; "));
    setTimeout(() => {
      setIsFiltering(false);
    }, 150);
  };

  useEffect(() => {
    if (event?.sessions && event.sessions.length > 0) {
      setSessions(event.sessions);
    }
    if (event?.custom_questions && event.custom_questions.length > 0) {
      setCustomQuestions(event.custom_questions);
    }
    if (event?.email_templates) {
      setEmailTemplates(event.email_templates);
    }

    const needsSessions = !event?.sessions || event.sessions.length === 0;
    const needsQuestions = !event?.custom_questions || event.custom_questions.length === 0;
    const needsEmailTemplates = !event?.email_templates;

    if (needsSessions || needsQuestions || needsEmailTemplates) {
      async function fetchEventDetails() {
        try {
          const { getFirestoreEventById } = await import("@/lib/firestore/client");
          const docData = await getFirestoreEventById(eventId);
          if (docData?.sessions && docData.sessions.length > 0) {
            setSessions(docData.sessions);
          }
          if (docData?.custom_questions && docData.custom_questions.length > 0) {
            setCustomQuestions(docData.custom_questions);
          }
          if (docData?.email_templates) {
            setEmailTemplates(docData.email_templates);
          }
        } catch (err) {
          console.warn("[RegistrantsTab] Failed to load event details:", err);
        }
      }
      void fetchEventDetails();
    }
  }, [eventId, event?.sessions, event?.custom_questions, event?.email_templates]);

  const currentEvent = useMemo(() => {
    return {
      ...event,
      ...firestoreEventDoc,
      sessions,
      custom_questions: customQuestions,
      ...(emailTemplates ? { email_templates: emailTemplates } : {}),
    } as FirestoreEvent;
  }, [event, firestoreEventDoc, sessions, customQuestions, emailTemplates]);

  const isCurationMode = useMemo(() => {
    return isEventCurationMode(currentEvent);
  }, [currentEvent]);

  // If curation mode is disabled, reset any active curation-only filters to 'all'
  useEffect(() => {
    if (!isCurationMode) {
      if (["pending", "approved", "rejected", "waitlisted"].includes(statusFilter)) {
        setStatusFilter("all");
      }
      if (reviewerFilter !== "all") {
        setReviewerFilter("all");
      }
    }
  }, [isCurationMode, statusFilter, reviewerFilter]);

  const autoSyncingExpiredIdsRef = useRef<Set<string>>(new Set());

  // Auto-sync overdue registrations to 'expired' in Firestore
  useEffect(() => {
    if (!currentEvent || registrationsList.length === 0) return;

    const overdueRegistrations = registrationsList.filter(
      (r) =>
        r.status === "waiting_for_payment" &&
        !autoSyncingExpiredIdsRef.current.has(r.id) &&
        isRegistrationPaymentOverdue(r, currentEvent),
    );

    if (overdueRegistrations.length === 0) return;

    for (const reg of overdueRegistrations) {
      autoSyncingExpiredIdsRef.current.add(reg.id);
    }

    let isCancelled = false;
    void (async () => {
      try {
        for (const reg of overdueRegistrations) {
          if (isCancelled) break;
          await updateRegistrationStatusAction(
            reg.id,
            eventId,
            "expired",
            undefined,
            "Payment deadline overdue by payment deadline minutes (auto-expired).",
            { payment_status: "expired" },
          );
        }
      } catch (err) {
        for (const reg of overdueRegistrations) {
          autoSyncingExpiredIdsRef.current.delete(reg.id);
        }
        console.warn("[RegistrantsTab] Background expired status sync:", err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [registrationsList, currentEvent, eventId]);

  // Status Counters for Filters & Badges
  const statusCounts = useMemo(() => {
    let pending = 0;
    let waitingPayment = 0;
    let paidRegistered = 0;
    let expired = 0;
    let failed = 0;
    let canceled = 0;
    let approved = 0;
    let checkedIn = 0;
    let notCheckedIn = 0;
    let waitlisted = 0;
    let paidWaitlisted = 0;
    let rejected = 0;

    for (const reg of registrationsList) {
      const eff = getEffectiveRegistrationStatus(reg, currentEvent);
      const s = (eff ?? "").toLowerCase().trim();
      const ps = (reg.payment_status ?? "").toLowerCase().trim();

      if (s === "pending" || s === "applied" || s === "review" || !s) {
        pending++;
      } else if (s === "waiting_for_payment") {
        waitingPayment++;
      } else if (s === "expired") {
        expired++;
      } else if (s === "failed" || ps === "failed") {
        failed++;
      } else if (s === "canceled" || s === "cancelled") {
        canceled++;
      } else if (s === "waitlisted") {
        waitlisted++;
      } else if (s === "paid_waitlisted") {
        paidWaitlisted++;
      } else if (s === "rejected") {
        rejected++;
      }

      if (
        s === "paid_and_registered" ||
        ((s === "approved" || s === "registered" || s === "attended") && (isPaidRegistration(reg) || ps === "paid"))
      ) {
        paidRegistered++;
      }

      const isAppr =
        s === "approved" || s === "paid_and_registered" || s === "attended" || s === "confirmed" || s === "registered";
      if (isAppr) {
        approved++;
        if (reg.is_checked_in || s === "attended") {
          checkedIn++;
        } else {
          notCheckedIn++;
        }
      } else if (reg.is_checked_in || s === "attended") {
        checkedIn++;
      }
    }

    return {
      all: registrationsList.length,
      pending,
      waiting_for_payment: waitingPayment,
      paid_and_registered: paidRegistered,
      paid_waitlisted: paidWaitlisted,
      expired,
      failed,
      canceled,
      approved,
      checked_in: checkedIn,
      not_checked_in: notCheckedIn,
      waitlisted,
      rejected,
    };
  }, [registrationsList, currentEvent]);

  // Compute email occurrences to detect duplicate registrant attempts
  const emailCounts = new Map<string, number>();
  for (const r of registrationsList) {
    const email = (r.member_email || "").toLowerCase();
    if (email) {
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
  }

  const availableTickets = useMemo(() => {
    const list: Array<{ id: string; name: string; type?: string }> = [];
    const seen = new Set<string>();

    if (event?.tickets) {
      for (const t of event.tickets) {
        if (!seen.has(t.name)) {
          seen.add(t.name);
          list.push({ id: t.id, name: t.name, type: t.type });
        }
      }
    }

    for (const r of registrationsList) {
      if (r.ticket_name && !seen.has(r.ticket_name)) {
        seen.add(r.ticket_name);
        list.push({ id: r.ticket_id || r.ticket_name, name: r.ticket_name, type: r.ticket_type });
      }
    }

    return list;
  }, [event?.tickets, registrationsList]);

  const hasTickets = availableTickets.length > 0;
  const hasMerchandise = useMemo(() => {
    return (
      Boolean(event?.merchandise && event.merchandise.length > 0) ||
      registrationsList.some((r) => r.selected_merchandise && r.selected_merchandise.length > 0)
    );
  }, [event?.merchandise, registrationsList]);

  const merchandiseFilterOptions = useMemo(() => {
    return collectMerchandiseFilterOptions(registrationsList, event?.merchandise);
  }, [registrationsList, event?.merchandise]);

  // Map question IDs/keys to human-readable question labels
  const questionLabelMap = useMemo(() => {
    const map = new Map<string, string>();

    // 1. Seed with DEFAULT_COMBINED_QUESTIONS
    for (const q of DEFAULT_COMBINED_QUESTIONS) {
      if (q.id && q.label) {
        map.set(q.id.toLowerCase().trim(), q.label);
      }
    }

    // 2. Override / supplement with event's custom_questions
    for (const q of customQuestions) {
      if (q.id && q.label) {
        map.set(q.id.toLowerCase().trim(), q.label);
      }
    }

    return map;
  }, [customQuestions]);

  const formatQuestionLabel = useCallback(
    (key: string): string => {
      const trimmed = key.trim();
      const mapped = questionLabelMap.get(trimmed.toLowerCase());
      if (mapped) return mapped;

      // Handle auto-generated internal question IDs that are orphaned/deleted
      if (/^q_\d+/i.test(trimmed)) {
        return "Archived Question";
      }

      // Preserve strings that are already natural sentence case or title case with spaces
      if (/[A-Z]/.test(trimmed) && trimmed.includes(" ") && !trimmed.includes("_")) {
        return trimmed;
      }

      // Convert snake_case or kebab-case to Title Case
      const words = trimmed
        .replace(/[_-]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => {
          const lower = word.toLowerCase();
          if (lower === "url") return "URL";
          if (lower === "id") return "ID";
          if (lower === "github") return "GitHub";
          if (lower === "linkedin") return "LinkedIn";
          if (lower === "whatsapp") return "WhatsApp";
          if (lower === "ai") return "AI";
          if (lower === "gdg") return "GDG";
          if (lower === "rsvp") return "RSVP";
          if (lower === "faq") return "FAQ";
          if (lower === "ui") return "UI";
          if (lower === "ux") return "UX";
          return word.charAt(0).toUpperCase() + word.slice(1);
        });

      return words.join(" ") || trimmed;
    },
    [questionLabelMap],
  );

  // Discover all available question fields from event definition and registrant answers
  const availableQuestionFields = useMemo<AvailableQuestionField[]>(() => {
    const fieldMap = new Map<string, { label: string; type?: string; options?: string[]; count: number }>();

    // 1. Defined custom questions
    for (const q of customQuestions) {
      if (q.id && q.label) {
        fieldMap.set(q.id, {
          label: q.label,
          type: q.type,
          options: q.options,
          count: 0,
        });
      }
    }

    // 2. Discover from answers across all registrations
    for (const reg of registrationsList) {
      if (!reg.answers) continue;
      for (const [k, v] of Object.entries(reg.answers)) {
        if (k === "session_id" || k === "session_title" || k === "bevy_user_id") continue;
        if (v === undefined || v === null || v === "") continue;

        // Skip orphaned/deleted internal question IDs (e.g. q_1791887936517_d35sr)
        // that are no longer defined in the event's custom_questions
        if (!fieldMap.has(k) && /^q_\d+/i.test(k)) continue;

        const formattedLabel = formatQuestionLabel(k);
        let targetKey = k;

        let existing = fieldMap.get(k);
        if (!existing) {
          for (const [existingKey, existingData] of fieldMap.entries()) {
            if (existingData.label.toLowerCase() === formattedLabel.toLowerCase()) {
              targetKey = existingKey;
              existing = existingData;
              break;
            }
          }
        }

        if (existing) {
          existing.count += 1;
        } else {
          fieldMap.set(targetKey, {
            label: formattedLabel,
            count: 1,
          });
        }
      }
    }

    return Array.from(fieldMap.entries())
      .map(([key, data]) => ({
        key,
        label: data.label,
        type: data.type,
        options: data.options,
        responseCount: data.count,
      }))
      .sort((a, b) => b.responseCount - a.responseCount || a.label.localeCompare(b.label));
  }, [customQuestions, registrationsList, formatQuestionLabel]);

  useEffect(() => {
    if (typeof window === "undefined" || !eventId) return;
    try {
      const saved = localStorage.getItem(`gdg_event_cols_${eventId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.questions)) {
          setSelectedQuestionColumns(
            parsed.questions.filter((col: string) => {
              if (/^q_\d+/i.test(col)) {
                return (customQuestions ?? []).some((q) => q.id === col);
              }
              return true;
            }),
          );
        }
        if (parsed.standard && typeof parsed.standard === "object") {
          setVisibleStandardColumns((prev) => ({ ...prev, ...parsed.standard }));
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [eventId, customQuestions]);

  const saveColumnsToStorage = (questions: string[], standard: Record<string, boolean>) => {
    if (typeof window === "undefined" || !eventId) return;
    try {
      localStorage.setItem(`gdg_event_cols_${eventId}`, JSON.stringify({ questions, standard }));
    } catch {
      // Ignore localStorage write errors
    }
  };

  const handleToggleQuestion = (key: string) => {
    setSelectedQuestionColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      saveColumnsToStorage(next, visibleStandardColumns);
      return next;
    });
    if (questionFilters[key]) {
      setQuestionFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSelectAllQuestions = () => {
    const allKeys = availableQuestionFields.map((q) => q.key);
    setSelectedQuestionColumns(allKeys);
    saveColumnsToStorage(allKeys, visibleStandardColumns);
  };

  const handleClearAllQuestions = () => {
    setSelectedQuestionColumns([]);
    setQuestionFilters({});
    saveColumnsToStorage([], visibleStandardColumns);
  };

  const handleToggleStandardColumn = (id: string) => {
    setVisibleStandardColumns((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveColumnsToStorage(selectedQuestionColumns, next);
      return next;
    });
  };

  const handleResetColumnDefaults = () => {
    const defaultStandard = {
      applicant: true,
      status: true,
      reviewed_by: true,
      ticket: hasTickets,
      merchandise: hasMerchandise,
      session: hasSessions,
      checkin: true,
      all_responses: true,
      registered_at: true,
      actions: true,
    };
    setSelectedQuestionColumns([]);
    setVisibleStandardColumns(defaultStandard);
    setQuestionFilters({});
    saveColumnsToStorage([], defaultStandard);
    toast.info("Table columns reset to default view");
  };

  const handleQuestionFilterChange = (qKey: string, val: string) => {
    setIsFiltering(true);
    setQuestionFilters((prev) => ({
      ...prev,
      [qKey]: val,
    }));
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const availableReviewers = useMemo(() => {
    const names = new Set<string>();
    for (const r of registrationsList) {
      if (r.reviewed_by_name) {
        names.add(r.reviewed_by_name);
      }
    }
    return Array.from(names).sort();
  }, [registrationsList]);

  const handleReviewerFilterChange = (val: string) => {
    setIsFiltering(true);
    setReviewerFilter(val);
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const handleMerchandiseFilterChange = (val: string) => {
    setIsFiltering(true);
    setMerchandiseFilter(val);
    if (val === "no_merchandise" || val === "all") {
      setMerchandiseVariantFilter("all");
    }
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const handleMerchandiseVariantFilterChange = (val: string) => {
    setIsFiltering(true);
    setMerchandiseVariantFilter(val);
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  const handleMerchandiseStatsFilter = useCallback((merchandise: string, variant?: string) => {
    setIsFiltering(true);
    if (merchandise === "no_merchandise") {
      setMerchandiseFilter("no_merchandise");
      setMerchandiseVariantFilter("all");
    } else {
      setMerchandiseFilter(merchandise);
      if (variant) {
        const sizeMatch = variant.match(/size:\s*([^\s,]+)/i);
        if (sizeMatch?.[1]) {
          setMerchandiseVariantFilter(sizeMatch[1].toUpperCase().trim());
        } else {
          setMerchandiseVariantFilter(variant);
        }
      } else {
        setMerchandiseVariantFilter("all");
      }
    }
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  }, []);

  const handleResetAllFilters = () => {
    setIsFiltering(true);
    setStatusFilter("all");
    setSessionFilter("all");
    setTicketFilter("all");
    setMerchandiseFilter("all");
    setMerchandiseVariantFilter("all");
    setReviewerFilter("all");
    setSearch("");
    setQuestionFilters({});
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  // Filter logic
  const filtered = useMemo(() => {
    const tokensLower = searchTokens.map((t) => t.toLowerCase());

    return registrationsList.filter((reg) => {
      const matchesSearch =
        tokensLower.length === 0 || tokensLower.some((tokenLower) => matchesRegistrationToken(reg, tokenLower));

      const effectiveStatus = getEffectiveRegistrationStatus(reg, currentEvent);
      const regStatus = (effectiveStatus ?? "").toLowerCase().trim();
      const filterStatus = (statusFilter ?? "all").toLowerCase().trim();

      // "all" matches ANY status without exception
      let matchesStatus = filterStatus === "all";
      if (!matchesStatus) {
        if (filterStatus === "not_checked_in") {
          const isApproved =
            regStatus === "approved" ||
            regStatus === "paid_and_registered" ||
            regStatus === "attended" ||
            regStatus === "confirmed" ||
            regStatus === "registered";
          const isCheckedIn = Boolean(reg.is_checked_in) || regStatus === "attended";
          matchesStatus = isApproved && !isCheckedIn;
        } else if (filterStatus === "checked_in") {
          matchesStatus = Boolean(reg.is_checked_in) || regStatus === "attended";
        } else if (filterStatus === "approved") {
          matchesStatus =
            regStatus === "approved" ||
            regStatus === "attended" ||
            regStatus === "confirmed" ||
            regStatus === "registered";
        } else if (filterStatus === "paid_and_registered") {
          matchesStatus =
            regStatus === "paid_and_registered" ||
            ((regStatus === "approved" || regStatus === "registered" || regStatus === "attended") &&
              (isPaidRegistration(reg) || reg.payment_status === "paid"));
        } else if (filterStatus === "waiting_for_payment") {
          matchesStatus = regStatus === "waiting_for_payment";
        } else if (filterStatus === "expired") {
          matchesStatus = regStatus === "expired";
        } else if (filterStatus === "failed") {
          matchesStatus = regStatus === "failed" || reg.payment_status === "failed";
        } else if (filterStatus === "canceled") {
          matchesStatus = regStatus === "canceled" || regStatus === "cancelled";
        } else if (filterStatus === "pending") {
          matchesStatus = regStatus === "pending" || regStatus === "applied" || regStatus === "review";
        } else {
          matchesStatus = regStatus === filterStatus;
        }
      }

      const matchesSession =
        sessionFilter === "all" ||
        reg.session_id === sessionFilter ||
        (reg.answers?.session_id as string) === sessionFilter;

      const matchesTicket =
        ticketFilter === "all" ||
        reg.ticket_id === ticketFilter ||
        reg.ticket_name === ticketFilter ||
        reg.ticket_type === ticketFilter;

      const matchesReviewer =
        reviewerFilter === "all" ||
        (reviewerFilter === "unreviewed" ? !reg.reviewed_by_name : reg.reviewed_by_name === reviewerFilter);

      let matchesMerchandise = true;
      if (merchandiseFilter !== "all") {
        const regMerch = reg.selected_merchandise || [];
        if (merchandiseFilter === "has_merchandise") {
          matchesMerchandise = regMerch.length > 0;
        } else if (merchandiseFilter === "no_merchandise") {
          matchesMerchandise = regMerch.length === 0;
        } else {
          const filterLower = merchandiseFilter.toLowerCase().trim();
          matchesMerchandise = regMerch.some(
            (m) =>
              (m.name || "").toLowerCase().trim() === filterLower ||
              (m.id || "").toLowerCase().trim() === filterLower ||
              (m.merchandise_id || "").toLowerCase().trim() === filterLower,
          );
        }
      }

      let matchesMerchandiseVariant = true;
      if (merchandiseVariantFilter !== "all") {
        const regMerch = reg.selected_merchandise || [];
        const targetVar = merchandiseVariantFilter.toLowerCase().trim();
        matchesMerchandiseVariant = regMerch.some((m) => {
          const variations = parseMerchandiseVariations(m, reg.answers);
          return variations.some((v) => {
            const vVal = v.value.toLowerCase().trim();
            const vCombined = `${v.label}: ${v.value}`.toLowerCase().trim();
            return vVal === targetVar || vCombined === targetVar || targetVar.includes(vVal);
          });
        });
      }

      if (
        !matchesSearch ||
        !matchesStatus ||
        !matchesSession ||
        !matchesTicket ||
        !matchesReviewer ||
        !matchesMerchandise ||
        !matchesMerchandiseVariant
      ) {
        return false;
      }

      // Dynamic question columns filtering
      for (const qKey of selectedQuestionColumns) {
        const filterVal = questionFilters[qKey];
        if (!filterVal || filterVal === "all") continue;

        const rawAnswer = resolveAnswerValue(reg.answers, qKey, questionLabelMap);
        if (rawAnswer === undefined || rawAnswer === null || rawAnswer === "") {
          return false;
        }

        const filterLower = filterVal.toLowerCase().trim();
        if (Array.isArray(rawAnswer)) {
          const matched = rawAnswer.some((item) => {
            const itemLower = String(item).toLowerCase().trim();
            return itemLower === filterLower || itemLower.includes(filterLower);
          });
          if (!matched) return false;
        } else {
          const strLower = String(rawAnswer).toLowerCase().trim();
          if (strLower !== filterLower && !strLower.includes(filterLower)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    registrationsList,
    searchTokens,
    statusFilter,
    sessionFilter,
    ticketFilter,
    merchandiseFilter,
    merchandiseVariantFilter,
    reviewerFilter,
    selectedQuestionColumns,
    questionFilters,
    questionLabelMap,
    currentEvent,
  ]);

  const handleStatusChange = (
    registrationId: string,
    newStatus: RegistrationStatus,
    updatedRegistration?: FirestoreRegistration,
  ) => {
    if (updatedRegistration) {
      setRegistrationsList((prev) => prev.map((r) => (r.id === registrationId ? { ...r, ...updatedRegistration } : r)));
      setInspectRegistration((prev) => (prev?.id === registrationId ? { ...prev, ...updatedRegistration } : prev));
      return;
    }

    // If attendee is already approved or canceled, prevent changing status
    const targetReg = registrationsList.find((r) => r.id === registrationId);
    if (
      targetReg?.status === "canceled" ||
      targetReg?.status === "cancelled" ||
      targetReg?.refund_request?.status === "refund_completed"
    ) {
      toast.error("This registration has been canceled / refunded and cannot be modified.");
      return;
    }
    if (targetReg?.status === "approved" && newStatus !== "approved") {
      toast.error("This attendee is already approved. Their status cannot be changed except by removal.");
      return;
    }

    if (newStatus === "approved" && targetReg) {
      void handleApproveAttendee(targetReg);
      return;
    }

    if (newStatus === "rejected" && targetReg) {
      void handleRejectAttendee(targetReg);
      return;
    }

    if (newStatus === "waitlisted" && targetReg) {
      void handleWaitlistAttendee(targetReg);
      return;
    }

    startTransition(async () => {
      try {
        const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
        const now = new Date().toISOString();
        await updateRegistrationStatusAction(registrationId, eventId, newStatus, reviewerPayload);
        const isPending = newStatus === "pending";
        const newLogEntry: RegistrationStatusLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: newStatus,
          previous_status: targetReg?.status,
          changed_at: now,
          changed_by_id: user?.id ?? "unknown",
          changed_by_name: user?.name ?? "Organizer",
          changed_by_email: user?.email,
          notes: newStatus === "paid_and_registered" ? "Marked as Paid & Registered by organizer." : undefined,
        };
        setRegistrationsList((prev) =>
          prev.map((r) =>
            r.id === registrationId
              ? {
                  ...r,
                  status: newStatus,
                  reviewed_at: isPending ? undefined : now,
                  reviewed_by_id: isPending ? undefined : (user?.id ?? r.reviewed_by_id),
                  reviewed_by_name: isPending ? undefined : (user?.name ?? r.reviewed_by_name),
                  reviewed_by_email: isPending ? undefined : (user?.email ?? r.reviewed_by_email),
                  status_logs: [...(r.status_logs ?? []), newLogEntry],
                }
              : r,
          ),
        );
        setInspectRegistration((prev) =>
          prev?.id === registrationId
            ? {
                ...prev,
                status: newStatus,
                reviewed_at: isPending ? undefined : now,
                reviewed_by_id: isPending ? undefined : (user?.id ?? prev.reviewed_by_id),
                reviewed_by_name: isPending ? undefined : (user?.name ?? prev.reviewed_by_name),
                reviewed_by_email: isPending ? undefined : (user?.email ?? prev.reviewed_by_email),
                status_logs: [...(prev.status_logs ?? []), newLogEntry],
              }
            : prev,
        );
        toast.success(`Applicant marked as ${STATUS_VARIANTS[newStatus].label}`);
      } catch (err) {
        console.error("[RegistrantsTab] Failed to update registration status:", err);
        const msg = err instanceof Error ? err.message : "Failed to update status.";
        toast.error(msg);
      }
    });
  };

  const handleApproveAttendee = async (registration: FirestoreRegistration) => {
    const effectiveStatus = getEffectiveRegistrationStatus(registration, currentEvent);
    if (
      registration.status === "approved" ||
      effectiveStatus === "approved" ||
      effectiveStatus === "paid_and_registered" ||
      effectiveStatus === "waiting_for_payment" ||
      effectiveStatus === "canceled" ||
      registration.status === "canceled" ||
      registration.status === "cancelled" ||
      registration.refund_request?.status === "refund_completed"
    ) {
      if (
        effectiveStatus === "canceled" ||
        registration.status === "canceled" ||
        registration.status === "cancelled" ||
        registration.refund_request?.status === "refund_completed"
      ) {
        toast.error("This registration has been canceled / refunded and cannot be approved.");
      }
      return;
    }

    // 1. Validate Venue & Session Capacity before triggering approval
    const validation = validateAttendeeApprovalCapacity({
      event: currentEvent,
      registration,
      registrationsList,
    });

    if (!validation.allowed) {
      setCapacityAlert({
        open: true,
        title: validation.title,
        message: validation.message,
        reason: validation.reason,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        sessionTitle: validation.session?.title,
        currentCount:
          validation.reason === "venue_full"
            ? validation.venue.currentCount
            : (validation.session?.currentCount ?? validation.venue.currentCount),
        maxCapacity:
          validation.reason === "venue_full"
            ? (validation.venue.capacity ?? undefined)
            : (validation.session?.capacity ?? validation.venue.capacity ?? undefined),
      });
      toast.error(`Cannot approve applicant: ${validation.title}`);
      return;
    }

    setApprovingRegistrationId(registration.id);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const now = new Date().toISOString();
      const requiresPayment =
        hasRegistrationPaymentRequirements(registration) &&
        calculateRegistrationTotalAmount(registration, currentEvent) > 0;

      if (requiresPayment) {
        // If event ticket is paid or free with merchandise:
        // Curation accepted -> Call API Payment Link -> Attendee Status Waiting for Payment
        let paymentFields: Partial<FirestoreRegistration> = {};
        try {
          const ticketPrice = registration.ticket_price ?? 0;
          const merchTotal = (registration.selected_merchandise ?? []).reduce(
            (acc, m) => acc + (m.price ?? 0) * (m.quantity ?? 1),
            0,
          );
          const bundlePrice = registration.bundle_price ?? 0;
          const discount = (registration.voucher_discount_amount ?? 0) + (registration.referral_discount_amount ?? 0);
          const subtotal = Math.max(0, ticketPrice + merchTotal + bundlePrice - discount);
          const feeResult = calculatePaymentGatewayFee(subtotal, currentEvent);

          const paymentPayload = buildRegistrationPaymentPayload(registration, currentEvent, { sendEmail: true });
          const payRes = await generatePaymentLinkAction(paymentPayload);
          if (payRes.success && payRes.paymentUrl) {
            paymentFields = {
              payment_status: "unpaid",
              payment_url: payRes.paymentUrl,
              payment_invoice_number: payRes.invoiceNumber,
              payment_request_id: payRes.requestId,
              payment_amount: payRes.amount,
              payment_subtotal_amount: subtotal,
              payment_fee_amount: feeResult.feeAmount,
              payment_fee_bearer: feeResult.feeBearer,
              payment_expired_datetime: payRes.expiredDatetime,
            };
            toast.info(`Payment link generated and emailed to ${registration.member_name}`);
          } else {
            console.warn("[RegistrantsTab] Failed to generate payment link on approval:", payRes.error);
            toast.error(payRes.error ?? "Failed to generate payment link via DOKU.");
            return;
          }
        } catch (payErr) {
          console.warn("[RegistrantsTab] Exception generating payment link on approval:", payErr);
          toast.error("Network error while generating payment link.");
          return;
        }

        await updateRegistrationStatusAction(
          registration.id,
          eventId,
          "waiting_for_payment",
          reviewerPayload,
          "Application approved by organizer. Payment link sent to attendee.",
          paymentFields,
        );

        setRegistrationsList((prev) =>
          prev.map((r) =>
            r.id === registration.id
              ? {
                  ...r,
                  status: "waiting_for_payment",
                  reviewed_at: now,
                  reviewed_by_id: user?.id ?? r.reviewed_by_id,
                  reviewed_by_name: user?.name ?? r.reviewed_by_name,
                  reviewed_by_email: user?.email ?? r.reviewed_by_email,
                  ...paymentFields,
                }
              : r,
          ),
        );

        setInspectRegistration((prev) =>
          prev?.id === registration.id
            ? {
                ...prev,
                status: "waiting_for_payment",
                reviewed_at: now,
                reviewed_by_id: user?.id ?? prev.reviewed_by_id,
                reviewed_by_name: user?.name ?? prev.reviewed_by_name,
                reviewed_by_email: user?.email ?? prev.reviewed_by_email,
                ...paymentFields,
              }
            : prev,
        );

        toast.success(`Approved ${registration.member_name}. Status updated to Waiting for Payment.`);
        return;
      }

      // If event ticket is free (no merchandise to sell):
      // Curation accepted -> Call Add Bevy Attendee API -> Attendee Status Approved
      const payload = buildApprovedAttendeePayload(registration, currentEvent);
      const res = await approveAttendeeWebhookAction(payload);

      if (!res.success) {
        console.error("[RegistrantsTab] Approved attendee webhook error:", res.error, res.details);
        toast.error(res.error ?? "Approval webhook returned status false.", {
          description: typeof res.details === "string" ? res.details : undefined,
        });
        return;
      }

      // Success: persist status to Firestore and update local state
      await updateRegistrationStatusAction(registration.id, eventId, "approved", reviewerPayload);

      setRegistrationsList((prev) =>
        prev.map((r) =>
          r.id === registration.id
            ? {
                ...r,
                status: "approved",
                reviewed_at: now,
                reviewed_by_id: user?.id ?? r.reviewed_by_id,
                reviewed_by_name: user?.name ?? r.reviewed_by_name,
                reviewed_by_email: user?.email ?? r.reviewed_by_email,
              }
            : r,
        ),
      );

      setInspectRegistration((prev) =>
        prev?.id === registration.id
          ? {
              ...prev,
              status: "approved",
              reviewed_at: now,
              reviewed_by_id: user?.id ?? prev.reviewed_by_id,
              reviewed_by_name: user?.name ?? prev.reviewed_by_name,
              reviewed_by_email: user?.email ?? prev.reviewed_by_email,
            }
          : prev,
      );

      toast.success(`${registration.member_name} approved successfully!`);
    } catch (err) {
      console.error("[RegistrantsTab] Error approving attendee:", err);
      const msg = err instanceof Error ? err.message : "Failed to approve applicant.";
      toast.error(msg);
    } finally {
      setApprovingRegistrationId(null);
    }
  };

  const handleRejectAttendee = async (registration: FirestoreRegistration) => {
    if (
      registration.status === "canceled" ||
      registration.status === "cancelled" ||
      registration.refund_request?.status === "refund_completed"
    ) {
      toast.error("This registration has been canceled / refunded and cannot be modified.");
      return;
    }
    if (registration.status === "approved") {
      toast.error("This attendee is already approved. Their status cannot be changed except by removal.");
      return;
    }

    setRejectingRegistrationId(registration.id);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const res = await rejectAttendeeAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        reviewer: reviewerPayload,
        eventData: currentEvent,
      });

      if (!res.success) {
        console.error("[RegistrantsTab] Reject attendee error:", res.error, res.details);
        toast.error(res.error ?? "Failed to reject applicant.", {
          description: typeof res.details === "string" ? res.details : undefined,
        });
        return;
      }

      // Persist status update in Firestore (client-side)
      await updateRegistrationStatusAction(registration.id, eventId, "rejected", reviewerPayload);

      const now = new Date().toISOString();
      setRegistrationsList((prev) =>
        prev.map((r) =>
          r.id === registration.id
            ? {
                ...r,
                status: "rejected",
                reviewed_at: now,
                reviewed_by_id: user?.id ?? r.reviewed_by_id,
                reviewed_by_name: user?.name ?? r.reviewed_by_name,
                reviewed_by_email: user?.email ?? r.reviewed_by_email,
              }
            : r,
        ),
      );

      setInspectRegistration((prev) =>
        prev?.id === registration.id
          ? {
              ...prev,
              status: "rejected",
              reviewed_at: now,
              reviewed_by_id: user?.id ?? prev.reviewed_by_id,
              reviewed_by_name: user?.name ?? prev.reviewed_by_name,
              reviewed_by_email: user?.email ?? prev.reviewed_by_email,
            }
          : prev,
      );

      toast.success(res.message ?? `${registration.member_name} marked as rejected and regret email sent.`);
    } catch (err) {
      console.error("[RegistrantsTab] Error rejecting attendee:", err);
      const msg = err instanceof Error ? err.message : "Failed to reject applicant.";
      toast.error(msg);
    } finally {
      setRejectingRegistrationId(null);
    }
  };

  const handleWaitlistAttendee = async (registration: FirestoreRegistration) => {
    if (registration.status === "approved") {
      toast.error("This attendee is already approved. Their status cannot be changed except by removal.");
      return;
    }

    setWaitlistingRegistrationId(registration.id);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const res = await sendWaitlistAttendeeEmailAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        reviewer: reviewerPayload,
        eventData: currentEvent,
      });

      if (!res.success) {
        console.error("[RegistrantsTab] Waitlist attendee error:", res.error, res.details);
        toast.error(res.error ?? "Failed to send waitlist email.", {
          description: typeof res.details === "string" ? res.details : undefined,
        });
        return;
      }

      // Persist status update in Firestore (client-side)
      await updateRegistrationStatusAction(registration.id, eventId, "waitlisted", reviewerPayload);

      const now = new Date().toISOString();
      setRegistrationsList((prev) =>
        prev.map((r) =>
          r.id === registration.id
            ? {
                ...r,
                status: "waitlisted",
                reviewed_at: now,
                reviewed_by_id: user?.id ?? r.reviewed_by_id,
                reviewed_by_name: user?.name ?? r.reviewed_by_name,
                reviewed_by_email: user?.email ?? r.reviewed_by_email,
              }
            : r,
        ),
      );

      setInspectRegistration((prev) =>
        prev?.id === registration.id
          ? {
              ...prev,
              status: "waitlisted",
              reviewed_at: now,
              reviewed_by_id: user?.id ?? prev.reviewed_by_id,
              reviewed_by_name: user?.name ?? prev.reviewed_by_name,
              reviewed_by_email: user?.email ?? prev.reviewed_by_email,
            }
          : prev,
      );

      toast.success(res.message ?? `${registration.member_name} moved to waitlist and notification email sent.`);
    } catch (err) {
      console.error("[RegistrantsTab] Error moving attendee to waitlist:", err);
      const msg = err instanceof Error ? err.message : "Failed to move applicant to waitlist.";
      toast.error(msg);
    } finally {
      setWaitlistingRegistrationId(null);
    }
  };

  const handleResendWaitlistEmail = async (registration: FirestoreRegistration) => {
    setIsResendingWaitlistId(registration.id);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const res = await sendWaitlistAttendeeEmailAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        reviewer: reviewerPayload,
        eventData: currentEvent,
      });

      if (res.success) {
        toast.success(`Waitlist email successfully resent to ${registration.member_name}.`);
      } else {
        toast.error(res.error ?? "Failed to resend waitlist email.");
      }
    } catch (err) {
      console.error("[RegistrantsTab] Error resending waitlist email:", err);
      toast.error("Failed to resend waitlist email.");
    } finally {
      setIsResendingWaitlistId(null);
    }
  };

  const handleResendPaidWaitlistEmail = async (registration: FirestoreRegistration) => {
    setIsResendingPaidWaitlistId(registration.id);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const res = await sendPaidWaitlistAttendeeEmailAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        reviewer: reviewerPayload,
        eventData: currentEvent,
      });

      if (res.success) {
        toast.success(`Paid waitlist email successfully resent to ${registration.member_name}.`);
      } else {
        toast.error(res.error ?? "Failed to resend paid waitlist email.");
      }
    } catch (err) {
      console.error("[RegistrantsTab] Error resending paid waitlist email:", err);
      toast.error("Failed to resend paid waitlist email.");
    } finally {
      setIsResendingPaidWaitlistId(null);
    }
  };

  const handleResendInterestEmail = async (registration: FirestoreRegistration) => {
    if (registration.status !== "pending") {
      toast.info("Interest email can only be resent for attendees pending review.");
      return;
    }

    setIsResendingInterestId(registration.id);
    try {
      const res = await resendInterestEmailAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        eventData: currentEvent,
      });

      if (res.success) {
        toast.success(res.message ?? `Interest email resent to ${registration.member_name}.`);
      } else {
        toast.error(res.error ?? "Failed to resend interest email.", {
          description: typeof res.details === "string" ? res.details : undefined,
        });
      }
    } catch (err) {
      console.error("[RegistrantsTab] Error resending interest email:", err);
      const msg = err instanceof Error ? err.message : "Failed to resend interest email.";
      toast.error(msg);
    } finally {
      setIsResendingInterestId(null);
    }
  };

  const handleToggleCheckIn = async (registration: FirestoreRegistration, isCheckedIn: boolean) => {
    setIsCheckingInId(registration.id);
    try {
      const email = (registration.member_email || "").toLowerCase().trim();
      const matchedBevyAttendee =
        (registration.bevy_attendee_id ? { id: registration.bevy_attendee_id } : null) ?? bevyAttendeesMap.get(email);

      let bevySuccess = false;
      if (matchedBevyAttendee?.id) {
        const res = await checkInBevyAttendeeAction(eventId, matchedBevyAttendee.id, isCheckedIn);
        bevySuccess = Boolean(res.success);
      }

      const checkinDate = isCheckedIn ? new Date().toISOString() : null;

      // Persist to Firestore & recalculate total_checked_in counter
      await updateRegistrationCheckInAction(
        registration.id,
        eventId,
        isCheckedIn,
        matchedBevyAttendee?.id ?? registration.bevy_attendee_id ?? null,
        checkinDate,
      );

      const updatedReg: FirestoreRegistration = {
        ...registration,
        is_checked_in: isCheckedIn,
        bevy_attendee_id: matchedBevyAttendee?.id ?? registration.bevy_attendee_id,
        checkin_date: checkinDate,
        checked_in_at: isCheckedIn ? (checkinDate ?? new Date().toISOString()) : undefined,
      };

      setRegistrationsList((prev) => prev.map((r) => (r.id === registration.id ? updatedReg : r)));
      setInspectRegistration((prev) => (prev?.id === registration.id ? updatedReg : prev));

      if (email && bevyAttendeesMap.has(email)) {
        const existingBevy = bevyAttendeesMap.get(email);
        if (existingBevy) {
          setBevyAttendeesMap((prev) => {
            const next = new Map(prev);
            next.set(email, {
              ...existingBevy,
              is_checked_in: isCheckedIn,
              checkin_date: checkinDate,
            });
            return next;
          });
        }
      }

      if (matchedBevyAttendee?.id && bevySuccess) {
        toast.success(
          isCheckedIn
            ? `${registration.member_name} checked in via Bevy`
            : `Check-in undone for ${registration.member_name} on Bevy`,
        );
      } else if (matchedBevyAttendee?.id && !bevySuccess) {
        toast.warning("Checked in on dashboard, but Bevy check-in API returned an issue.");
      } else {
        toast.success(
          isCheckedIn
            ? `${registration.member_name} marked checked in (Dashboard only - not found in Bevy roster)`
            : `Check-in undone for ${registration.member_name}`,
        );
      }
    } catch (err) {
      console.error("[handleToggleCheckIn] error:", err);
      toast.error("Failed to update check-in status.");
    } finally {
      setIsCheckingInId(null);
    }
  };

  const hasApprovedSelected = useMemo(() => {
    return Array.from(selectedIds).some((id) => {
      const r = registrationsList.find((reg) => reg.id === id);
      return r?.status === "approved";
    });
  }, [selectedIds, registrationsList]);

  const pendingSelectedCount = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const r = registrationsList.find((reg) => reg.id === id);
      return r?.status === "pending";
    }).length;
  }, [selectedIds, registrationsList]);

  const selectedWithInvoice = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const r = registrationsList.find((reg) => reg.id === id);
      if (!r) return false;
      const status = getEffectiveRegistrationStatus(r, currentEvent);
      return (
        (status === "waiting_for_payment" || status === "expired") &&
        Boolean(
          r.payment_invoice_number ||
            (r.answers?.payment_invoice_number as string | undefined) ||
            (r.answers?.invoice_number as string | undefined),
        )
      );
    });
  }, [selectedIds, registrationsList, currentEvent]);

  const handleBatchCheckPayment = async () => {
    if (selectedWithInvoice.length === 0) return;
    setIsBatchCheckingPayment(true);
    toast.loading(`Checking DOKU payment status for ${selectedWithInvoice.length} attendees...`, {
      id: "batch-payment-check",
    });
    let paidCount = 0;
    let checkedCount = 0;
    try {
      for (const id of selectedWithInvoice) {
        const reg = registrationsList.find((r) => r.id === id);
        const inv =
          reg?.payment_invoice_number ||
          (reg?.answers?.payment_invoice_number as string) ||
          (reg?.answers?.invoice_number as string);
        if (!inv) continue;
        checkedCount++;
        const res = await checkDokuPaymentStatusAction({
          invoiceNumber: inv,
          eventId: currentEvent?.id ? String(currentEvent.id) : reg?.event_id,
          registrationId: reg?.id,
          isProduction: currentEvent?.payment_environment === "production" || !currentEvent?.is_test,
        });
        if (res.isPaid) {
          paidCount++;
          const newLog: RegistrationStatusLog = res.logEntry ?? {
            id: `log_${Date.now()}_doku`,
            status: "paid_and_registered",
            previous_status: reg?.status,
            changed_at: res.paidAt ?? new Date().toISOString(),
            changed_by_id: "doku_payment_gateway",
            changed_by_name: "DOKU Payment Gateway",
            notes: `Payment confirmed via ${res.paymentChannel ?? "QRIS"}. Status updated to Paid & Registered.`,
          };
          setRegistrationsList((prev) =>
            prev.map((r) =>
              r.id === id
                ? {
                    ...r,
                    status: "paid_and_registered",
                    payment_status: "paid",
                    payment_channel: res.paymentChannel ?? r.payment_channel,
                    paid_at: res.paidAt ?? new Date().toISOString(),
                    status_logs: res.statusLogs ?? [...(r.status_logs ?? []), newLog],
                  }
                : r,
            ),
          );
        }
      }
      toast.success(`Checked ${checkedCount} attendees. ${paidCount} confirmed paid & updated!`, {
        id: "batch-payment-check",
      });
    } catch (err) {
      console.error("Batch payment check error:", err);
      toast.error("Failed to finish batch payment check.", { id: "batch-payment-check" });
    } finally {
      setIsBatchCheckingPayment(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    const toApprove = registrationsList.filter((r) => {
      if (!selectedIds.has(r.id)) return false;
      const effective = getEffectiveRegistrationStatus(r, currentEvent);
      return (
        r.status !== "approved" &&
        effective !== "approved" &&
        effective !== "paid_and_registered" &&
        effective !== "waiting_for_payment"
      );
    });
    if (toApprove.length === 0) {
      toast.info("All selected attendees are already approved or waiting for payment.");
      return;
    }

    // 1. Validate Venue & Session Capacity before triggering batch approval
    const batchValidation = validateBatchApprovalCapacity({
      event: currentEvent,
      toApprove,
      registrationsList,
    });

    if (!batchValidation.allowed) {
      setCapacityAlert({
        open: true,
        title: batchValidation.title ?? "Capacity Exceeded for Selected Applicants",
        message:
          batchValidation.message ?? "Approving all selected applicants would exceed the configured capacity limit.",
        reason: batchValidation.overreachedItems[0]?.type === "venue" ? "venue_full" : "session_full",
        batchOverreachedItems: batchValidation.overreachedItems,
      });
      toast.error(batchValidation.title ?? "Cannot batch approve: capacity would be exceeded.");
      return;
    }

    setIsBatchApproving(true);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const now = new Date().toISOString();
      let successCount = 0;
      const failedErrors: string[] = [];

      for (const reg of toApprove) {
        const requiresPayment =
          hasRegistrationPaymentRequirements(reg) && calculateRegistrationTotalAmount(reg, currentEvent) > 0;
        if (requiresPayment) {
          try {
            const ticketPrice = reg.ticket_price ?? 0;
            const merchTotal = (reg.selected_merchandise ?? []).reduce(
              (acc, m) => acc + (m.price ?? 0) * (m.quantity ?? 1),
              0,
            );
            const bundlePrice = reg.bundle_price ?? 0;
            const discount = (reg.voucher_discount_amount ?? 0) + (reg.referral_discount_amount ?? 0);
            const subtotal = Math.max(0, ticketPrice + merchTotal + bundlePrice - discount);
            const feeResult = calculatePaymentGatewayFee(subtotal, currentEvent);

            const paymentPayload = buildRegistrationPaymentPayload(reg, currentEvent, { sendEmail: true });
            const payRes = await generatePaymentLinkAction(paymentPayload);
            if (payRes.success && payRes.paymentUrl) {
              const paymentFields: Partial<FirestoreRegistration> = {
                payment_status: "unpaid",
                payment_url: payRes.paymentUrl,
                payment_invoice_number: payRes.invoiceNumber,
                payment_request_id: payRes.requestId,
                payment_amount: payRes.amount,
                payment_subtotal_amount: subtotal,
                payment_fee_amount: feeResult.feeAmount,
                payment_fee_bearer: feeResult.feeBearer,
                payment_expired_datetime: payRes.expiredDatetime,
              };
              await updateRegistrationStatusAction(
                reg.id,
                eventId,
                "waiting_for_payment",
                reviewerPayload,
                "Batch approved: payment link issued.",
                paymentFields,
              );
              successCount++;
              setRegistrationsList((prev) =>
                prev.map((r) =>
                  r.id === reg.id
                    ? {
                        ...r,
                        status: "waiting_for_payment",
                        reviewed_at: now,
                        reviewed_by_id: user?.id ?? r.reviewed_by_id,
                        reviewed_by_name: user?.name ?? r.reviewed_by_name,
                        reviewed_by_email: user?.email ?? r.reviewed_by_email,
                        ...paymentFields,
                      }
                    : r,
                ),
              );
            } else {
              failedErrors.push(`${reg.member_name}: ${payRes.error ?? "Failed to generate payment link"}`);
            }
          } catch {
            failedErrors.push(`${reg.member_name}: Failed to generate payment link`);
          }
        } else {
          const payload = buildApprovedAttendeePayload(reg, currentEvent);
          const res = await approveAttendeeWebhookAction(payload);
          if (res.success) {
            await updateRegistrationStatusAction(reg.id, eventId, "approved", reviewerPayload);
            successCount++;
            setRegistrationsList((prev) =>
              prev.map((r) =>
                r.id === reg.id
                  ? {
                      ...r,
                      status: "approved",
                      reviewed_at: now,
                      reviewed_by_id: user?.id ?? r.reviewed_by_id,
                      reviewed_by_name: user?.name ?? r.reviewed_by_name,
                      reviewed_by_email: user?.email ?? r.reviewed_by_email,
                    }
                  : r,
              ),
            );
          } else {
            failedErrors.push(`${reg.member_name}: ${res.error ?? "Webhook returned false"}`);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully approved ${successCount} applicant(s).`);
      }
      if (failedErrors.length > 0) {
        toast.error(`Approval webhook failed for ${failedErrors.length} applicant(s):`, {
          description: failedErrors.slice(0, 3).join("\n"),
        });
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error("[RegistrantsTab] Batch approve error:", err);
      toast.error("Batch approval failed.");
    } finally {
      setIsBatchApproving(false);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    const toReject = registrationsList.filter(
      (r) => selectedIds.has(r.id) && r.status !== "approved" && r.status !== "rejected",
    );
    if (toReject.length === 0) {
      toast.info("All selected attendees are already approved or rejected.");
      return;
    }

    setIsBatchRejecting(true);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      let successCount = 0;
      const failedErrors: string[] = [];

      // Process one by one sequentially
      for (const reg of toReject) {
        const res = await rejectAttendeeAction({
          registrationId: reg.id,
          eventId,
          attendeeName: reg.member_name,
          attendeeEmail: reg.member_email,
          reviewer: reviewerPayload,
          eventData: currentEvent,
        });

        if (res.success) {
          await updateRegistrationStatusAction(reg.id, eventId, "rejected", reviewerPayload);
          successCount++;
          const now = new Date().toISOString();
          setRegistrationsList((prev) =>
            prev.map((r) =>
              r.id === reg.id
                ? {
                    ...r,
                    status: "rejected",
                    reviewed_at: now,
                    reviewed_by_id: user?.id ?? r.reviewed_by_id,
                    reviewed_by_name: user?.name ?? r.reviewed_by_name,
                    reviewed_by_email: user?.email ?? r.reviewed_by_email,
                  }
                : r,
            ),
          );
        } else {
          failedErrors.push(`${reg.member_name}: ${res.error ?? "Failed to reject"}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully rejected ${successCount} applicant(s) and sent regret emails.`);
      }
      if (failedErrors.length > 0) {
        toast.error(`Rejection failed for ${failedErrors.length} applicant(s):`, {
          description: failedErrors.slice(0, 3).join("\n"),
        });
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error("[RegistrantsTab] Batch reject error:", err);
      toast.error("Batch reject failed.");
    } finally {
      setIsBatchRejecting(false);
    }
  };

  const handleBatchResendInterestEmail = async () => {
    if (selectedIds.size === 0) return;
    const toResend = registrationsList.filter((r) => selectedIds.has(r.id) && r.status === "pending");
    if (toResend.length === 0) {
      toast.info("No selected attendees are currently pending review.");
      return;
    }

    setIsBatchResendingInterest(true);
    try {
      let successCount = 0;
      const failedErrors: string[] = [];

      // Process one by one sequentially
      for (const reg of toResend) {
        const res = await resendInterestEmailAction({
          registrationId: reg.id,
          eventId,
          attendeeName: reg.member_name,
          attendeeEmail: reg.member_email,
          eventData: currentEvent,
        });

        if (res.success) {
          successCount++;
        } else {
          failedErrors.push(`${reg.member_name}: ${res.error ?? "Failed to send"}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully resent interest email to ${successCount} applicant(s).`);
      }
      if (failedErrors.length > 0) {
        toast.error(`Failed to resend interest email to ${failedErrors.length} applicant(s):`, {
          description: failedErrors.slice(0, 3).join("\n"),
        });
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error("[RegistrantsTab] Batch resend interest email error:", err);
      toast.error("Batch resend interest email failed.");
    } finally {
      setIsBatchResendingInterest(false);
    }
  };

  const handleBatchWaitlist = async () => {
    if (selectedIds.size === 0) return;
    const eligibleRegistrations = registrationsList.filter(
      (r) => selectedIds.has(r.id) && r.status !== "approved" && r.status !== "waitlisted",
    );

    if (eligibleRegistrations.length === 0) {
      toast.warning("No eligible attendees selected for waitlist (approved or already waitlisted).");
      return;
    }

    setIsBatchWaitlisting(true);
    try {
      let successCount = 0;
      const failedErrors: string[] = [];
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const now = new Date().toISOString();

      for (const reg of eligibleRegistrations) {
        const res = await sendWaitlistAttendeeEmailAction({
          registrationId: reg.id,
          eventId,
          attendeeName: reg.member_name,
          attendeeEmail: reg.member_email,
          reviewer: reviewerPayload,
          eventData: currentEvent,
        });

        if (res.success) {
          await updateRegistrationStatusAction(reg.id, eventId, "waitlisted", reviewerPayload);
          successCount++;
          setRegistrationsList((prev) =>
            prev.map((r) =>
              r.id === reg.id
                ? {
                    ...r,
                    status: "waitlisted",
                    reviewed_at: now,
                    reviewed_by_id: user?.id ?? r.reviewed_by_id,
                    reviewed_by_name: user?.name ?? r.reviewed_by_name,
                    reviewed_by_email: user?.email ?? r.reviewed_by_email,
                  }
                : r,
            ),
          );
        } else {
          failedErrors.push(`${reg.member_name}: ${res.error ?? "Failed to send waitlist email"}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully moved ${successCount} applicant(s) to waitlist and sent notifications.`);
      }
      if (failedErrors.length > 0) {
        toast.error(`Waitlist email failed for ${failedErrors.length} applicant(s):`, {
          description: failedErrors.slice(0, 3).join("\n"),
        });
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error("[RegistrantsTab] Batch waitlist error:", err);
      toast.error("Batch waitlist failed.");
    } finally {
      setIsBatchWaitlisting(false);
    }
  };

  const handleBatchAction = (newStatus: RegistrationStatus) => {
    if (selectedIds.size === 0) return;
    if (newStatus === "approved") {
      void handleBatchApprove();
      return;
    }
    if (newStatus === "rejected") {
      void handleBatchReject();
      return;
    }
    if (newStatus === "waitlisted") {
      void handleBatchWaitlist();
      return;
    }

    // Filter out already approved attendees so their status cannot be modified
    const eligibleIds = Array.from(selectedIds).filter((id) => {
      const r = registrationsList.find((reg) => reg.id === id);
      return r?.status !== "approved";
    });

    if (eligibleIds.length === 0) {
      toast.warning("Selected attendees are already approved and their status cannot be modified.");
      return;
    }

    startTransition(async () => {
      try {
        const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
        const now = new Date().toISOString();
        const promises = eligibleIds.map((id) =>
          updateRegistrationStatusAction(id, eventId, newStatus, reviewerPayload),
        );
        await Promise.all(promises);
        const isPending = newStatus === "pending";
        setRegistrationsList((prev) =>
          prev.map((r) =>
            eligibleIds.includes(r.id)
              ? {
                  ...r,
                  status: newStatus,
                  reviewed_at: isPending ? undefined : now,
                  reviewed_by_id: isPending ? undefined : (user?.id ?? r.reviewed_by_id),
                  reviewed_by_name: isPending ? undefined : (user?.name ?? r.reviewed_by_name),
                  reviewed_by_email: isPending ? undefined : (user?.email ?? r.reviewed_by_email),
                }
              : r,
          ),
        );
        toast.success(`Updated ${eligibleIds.length} registrants to ${STATUS_VARIANTS[newStatus].label}`);
        setSelectedIds(new Set());
      } catch (err) {
        console.error("[RegistrantsTab] Batch update failed:", err);
        const msg = err instanceof Error ? err.message : "Batch update failed.";
        toast.error(msg);
      }
    });
  };

  const handleDeleteRegistration = (registration: FirestoreRegistration) => {
    const email = (registration.member_email || "").toLowerCase().trim();
    const matchedBevyAttendeeId =
      registration.bevy_attendee_id ?? (email ? bevyAttendeesMap.get(email)?.id : undefined);

    startTransition(async () => {
      setIsDeleting(true);
      // Optimistic removal from table
      setRegistrationsList((prev) => prev.filter((r) => r.id !== registration.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(registration.id);
        return next;
      });
      if (inspectRegistration?.id === registration.id) {
        setInspectRegistration(null);
      }
      setDeleteConfirmRegistration(null);

      try {
        const res = await deleteEventRegistrationAction(
          registration.id,
          eventId,
          matchedBevyAttendeeId,
          email,
          registration,
        );
        if (res.success) {
          if (email && bevyAttendeesMap.has(email)) {
            setBevyAttendeesMap((prev) => {
              const next = new Map(prev);
              next.delete(email);
              return next;
            });
          }
          toast.success(
            matchedBevyAttendeeId
              ? `Removed ${registration.member_name} from dashboard & Bevy.`
              : `Removed ${registration.member_name}. They can now re-register.`,
          );
        } else {
          // Revert on failure
          setRegistrationsList((prev) => [registration, ...prev]);
          toast.error(res.error ?? "Failed to remove attendee registration.");
        }
      } catch (err) {
        console.error("[handleDeleteRegistration] error:", err);
        setRegistrationsList((prev) => [registration, ...prev]);
        toast.error("Failed to remove attendee registration.");
      } finally {
        setIsDeleting(false);
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    const regsToDelete = registrationsList.filter((r) => selectedIds.has(r.id));
    const count = idsToDelete.length;

    const matchedBevyIds: (number | string)[] = [];
    for (const r of regsToDelete) {
      const email = (r.member_email || "").toLowerCase().trim();
      const matchedId = r.bevy_attendee_id ?? (email ? bevyAttendeesMap.get(email)?.id : undefined);
      if (matchedId) {
        matchedBevyIds.push(matchedId);
      }
    }

    startTransition(async () => {
      setIsDeleting(true);
      // Optimistic removal
      setRegistrationsList((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      if (inspectRegistration && selectedIds.has(inspectRegistration.id)) {
        setInspectRegistration(null);
      }
      setIsBatchDeleteConfirmOpen(false);

      try {
        const res = await deleteBatchEventRegistrationsAction(idsToDelete, eventId, matchedBevyIds);
        if (res.success) {
          if (matchedBevyIds.length > 0) {
            setBevyAttendeesMap((prev) => {
              const next = new Map(prev);
              for (const r of regsToDelete) {
                const email = (r.member_email || "").toLowerCase().trim();
                if (email) next.delete(email);
              }
              return next;
            });
          }
          toast.success(
            matchedBevyIds.length > 0
              ? `Removed ${count} attendee${count === 1 ? "" : "s"} from dashboard & Bevy.`
              : `Removed ${count} attendee${count === 1 ? "" : "s"}. They can now re-register.`,
          );
        } else {
          // Revert on failure
          setRegistrationsList((prev) => [...regsToDelete, ...prev]);
          toast.error(res.error ?? "Failed to remove selected attendees.");
        }
      } catch (err) {
        console.error("[handleBatchDelete] error:", err);
        setRegistrationsList((prev) => [...regsToDelete, ...prev]);
        toast.error("Failed to remove selected attendees.");
      } finally {
        setIsDeleting(false);
      }
    });
  };

  const handleCancelRegistration = (registration: FirestoreRegistration) => {
    const email = (registration.member_email || "").toLowerCase().trim();
    const matchedBevyAttendeeId =
      registration.bevy_attendee_id ?? (email ? bevyAttendeesMap.get(email)?.id : undefined);

    startTransition(async () => {
      setIsCancelling(true);
      try {
        // 1. Dispatch cancellation email to attendee
        const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
        const emailRes = await sendCancelAttendeeEmailAction({
          registrationId: registration.id,
          eventId,
          attendeeName: registration.member_name,
          attendeeEmail: registration.member_email,
          reviewer: reviewerPayload,
          eventData: currentEvent,
        });

        if (!emailRes.success) {
          toast.error(emailRes.error ?? "Failed to send cancellation email. Registration not removed.", {
            description: typeof emailRes.details === "string" ? emailRes.details : undefined,
          });
          setIsCancelling(false);
          return;
        }

        // 2. Remove registration from Firestore and Bevy
        const deleteRes = await deleteEventRegistrationAction(
          registration.id,
          eventId,
          matchedBevyAttendeeId,
          email,
          registration,
        );
        if (!deleteRes.success) {
          toast.error(deleteRes.error ?? "Cancellation email sent, but failed to remove registration from database.");
          setIsCancelling(false);
          return;
        }

        // 3. Update local state
        setRegistrationsList((prev) => prev.filter((r) => r.id !== registration.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(registration.id);
          return next;
        });
        if (email && bevyAttendeesMap.has(email)) {
          setBevyAttendeesMap((prev) => {
            const next = new Map(prev);
            next.delete(email);
            return next;
          });
        }
        if (inspectRegistration?.id === registration.id) {
          setInspectRegistration(null);
        }
        setCancelConfirmRegistration(null);

        toast.success(
          `Registration cancelled for ${registration.member_name}. Notification sent and capacity released.`,
        );
      } catch (err) {
        console.error("[handleCancelRegistration] error:", err);
        toast.error("Failed to cancel attendee registration.");
      } finally {
        setIsCancelling(false);
      }
    });
  };

  const handleBatchCancel = () => {
    if (selectedIds.size === 0) return;
    const regsToCancel = registrationsList.filter((r) => selectedIds.has(r.id));

    startTransition(async () => {
      setIsCancelling(true);
      setIsBatchCancelConfirmOpen(false);

      let successCount = 0;
      let failCount = 0;
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;

      for (const reg of regsToCancel) {
        try {
          const email = (reg.member_email || "").toLowerCase().trim();
          const matchedBevyAttendeeId = reg.bevy_attendee_id ?? (email ? bevyAttendeesMap.get(email)?.id : undefined);

          // 1. Send cancellation email
          const emailRes = await sendCancelAttendeeEmailAction({
            registrationId: reg.id,
            eventId,
            attendeeName: reg.member_name,
            attendeeEmail: reg.member_email,
            reviewer: reviewerPayload,
            eventData: currentEvent,
          });

          if (!emailRes.success) {
            console.warn(`[handleBatchCancel] Failed to email ${reg.member_email}:`, emailRes.error);
            failCount++;
            continue;
          }

          // 2. Delete registration
          const deleteRes = await deleteEventRegistrationAction(reg.id, eventId, matchedBevyAttendeeId, email, reg);
          if (deleteRes.success) {
            successCount++;
            setRegistrationsList((prev) => prev.filter((r) => r.id !== reg.id));
            if (email && bevyAttendeesMap.has(email)) {
              setBevyAttendeesMap((prev) => {
                const next = new Map(prev);
                next.delete(email);
                return next;
              });
            }
          } else {
            failCount++;
          }
        } catch (err) {
          console.error("[handleBatchCancel] item error:", err);
          failCount++;
        }
      }

      setSelectedIds(new Set());
      if (inspectRegistration && selectedIds.has(inspectRegistration.id)) {
        setInspectRegistration(null);
      }
      setIsCancelling(false);

      if (successCount > 0 && failCount === 0) {
        toast.success(`Cancelled ${successCount} registration${successCount === 1 ? "" : "s"} and sent notifications.`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`Cancelled ${successCount} registration(s); ${failCount} failed to process.`);
      } else {
        toast.error("Failed to cancel selected registrations.");
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((r) => r.id)));
  }, [filtered]);

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error("No registrants to export.");
      return;
    }

    const dynamicHeaders = selectedQuestionColumns.map((qKey) => formatQuestionLabel(qKey));
    const headers = [
      "Name",
      "Email",
      "Status",
      ...(isCurationMode ? ["Reviewed By", "Reviewed At"] : []),
      ...(hasTickets ? ["Ticket Pass", "Ticket Type", "Ticket Price", "Bundle Package", "Bundle Price"] : []),
      ...(hasMerchandise ? ["Merchandise Orders"] : []),
      "Voucher Code",
      "Voucher Discount",
      "Referral Code",
      "Referral Belongs To",
      "Bevy Check-In",
      "Session Track",
      ...dynamicHeaders,
      "Registered At",
      "All Responses",
    ];

    const rows = filtered.map((r) => {
      const sessionTitle =
        r.session_title ||
        (r.answers?.session_title as string) ||
        (r.session_id ? `Session ID: ${r.session_id}` : "Standard RSVP");

      const questionColsData = selectedQuestionColumns.map((qKey) => {
        const val = resolveAnswerValue(r.answers, qKey, questionLabelMap);
        if (val === undefined || val === null) return '""';
        const strVal = Array.isArray(val) ? val.join("; ") : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      });

      const cleanAnswers = r.answers
        ? Object.entries(r.answers)
            .filter(([k]) => k !== "session_id" && k !== "session_title")
            .map(([k, v]) => `${formatQuestionLabel(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
            .join("; ")
        : "";

      const merchText = (r.selected_merchandise ?? []).map((m) => formatMerchandiseSummary(m, r.answers)).join("; ");

      return [
        `"${(r.member_name || "").replace(/"/g, '""')}"`,
        `"${(r.member_email || "").replace(/"/g, '""')}"`,
        `"${(r.status || "").replace(/"/g, '""')}"`,
        ...(isCurationMode
          ? [
              `"${(r.reviewed_by_name || "").replace(/"/g, '""')}"`,
              `"${formatFirestoreDate(r.reviewed_at, "yyyy-MM-dd HH:mm:ss", "").replace(/"/g, '""')}"`,
            ]
          : []),
        ...(hasTickets
          ? [
              `"${(r.ticket_name || "General RSVP").replace(/"/g, '""')}"`,
              `"${(r.ticket_type || "free").replace(/"/g, '""')}"`,
              `"${r.ticket_price || 0}"`,
              `"${(r.bundle_name || "").replace(/"/g, '""')}"`,
              `"${r.bundle_price || 0}"`,
            ]
          : []),
        ...(hasMerchandise ? [`"${merchText.replace(/"/g, '""')}"`] : []),
        `"${(r.voucher_code || "").replace(/"/g, '""')}"`,
        `"${r.voucher_discount_amount || 0}"`,
        `"${(r.referral_code || "").replace(/"/g, '""')}"`,
        `"${(r.referrer_name || "").replace(/"/g, '""')}"`,
        `"${r.is_checked_in ? "Checked In" : "Not Checked In"}"`,
        `"${sessionTitle.replace(/"/g, '""')}"`,
        ...questionColsData,
        `"${formatFirestoreDate(r.registered_at, "yyyy-MM-dd HH:mm:ss", "").replace(/"/g, '""')}"`,
        `"${cleanAnswers.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `registrants-${eventId}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} registrants to CSV.`);
  };

  const hasSessions = sessions.length > 0;

  const totalColumnCount = useMemo(() => {
    let count = 2; // Checkbox + Applicant
    if (visibleStandardColumns.status !== false) count += 1;
    if (isCurationMode && visibleStandardColumns.reviewed_by !== false) count += 1;
    if (hasTickets && visibleStandardColumns.ticket !== false) count += 1;
    if (hasMerchandise && visibleStandardColumns.merchandise !== false) count += 1;
    if (hasSessions && visibleStandardColumns.session !== false) count += 1;
    if (visibleStandardColumns.checkin !== false) count += 1;
    count += selectedQuestionColumns.length;
    if (visibleStandardColumns.all_responses !== false) count += 1;
    if (visibleStandardColumns.registered_at !== false) count += 1;
    if (visibleStandardColumns.actions !== false) count += 1;
    return count;
  }, [visibleStandardColumns, hasSessions, hasTickets, hasMerchandise, selectedQuestionColumns.length, isCurationMode]);

  const activeQuestionFilterCount = useMemo(() => {
    return Object.values(questionFilters).filter((v) => Boolean(v) && v !== "all").length;
  }, [questionFilters]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter !== "all" ||
      sessionFilter !== "all" ||
      ticketFilter !== "all" ||
      merchandiseFilter !== "all" ||
      merchandiseVariantFilter !== "all" ||
      reviewerFilter !== "all" ||
      activeQuestionFilterCount > 0,
  );

  return (
    <div className="space-y-6">
      <RegistrantStatistics
        registrations={registrationsList}
        customQuestions={customQuestions}
        sessions={sessions}
        maxAttendees={event?.max_attendees}
        activeStatusFilter={statusFilter}
        event={currentEvent}
        isLoading={isLoading}
        onSelectStatusFilter={handleStatusFilterChange}
        onSelectSearchFilter={handleSearchChange}
        onSelectSessionFilter={handleSessionFilterChange}
        onSelectMerchandiseFilter={handleMerchandiseStatsFilter}
      />

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                Registrants & Attendance Filtration ({isLoading ? "..." : filtered.length}
                {!isLoading && registrationsList.length > 0 && filtered.length !== registrationsList.length
                  ? ` of ${registrationsList.length}`
                  : ""}
                )
              </CardTitle>
              <CardDescription>
                {isCurationMode
                  ? "Review attendee applications, session tracks, and approve or reject participants."
                  : "Manage registered attendees, track payment deadlines, and verify Bevy check-ins."}
              </CardDescription>
            </div>
          </div>

          {/* Batch Actions Toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-primary/20 dark:bg-primary/10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/30 bg-background px-2.5 py-1 font-semibold text-foreground text-xs shadow-2xs"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  <span>
                    {selectedIds.size} {selectedIds.size === 1 ? "attendee" : "attendees"} selected
                  </span>
                </Badge>

                {selectedIds.size < filtered.length && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleSelectAllFiltered}
                    className="h-7 text-muted-foreground text-xs hover:text-foreground"
                  >
                    Select all ({filtered.length})
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSelection}
                  className="h-7 gap-1 text-muted-foreground text-xs hover:text-foreground"
                >
                  <X className="size-3.5" />
                  Clear
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {isCurationMode && (
                  <>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-emerald-600 font-medium text-white shadow-2xs hover:bg-emerald-700"
                      onClick={() => handleBatchAction("approved")}
                      disabled={isPending || isBatchApproving || isBatchRejecting || isBatchResendingInterest}
                      title="Approve selected attendee registrations"
                    >
                      {isBatchApproving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="size-3.5" />
                      )}
                      <span>Approve</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                      onClick={() => handleBatchAction("waitlisted")}
                      disabled={
                        isPending ||
                        isBatchApproving ||
                        isBatchRejecting ||
                        isBatchWaitlisting ||
                        isBatchResendingInterest ||
                        hasApprovedSelected
                      }
                      title={
                        hasApprovedSelected
                          ? "Cannot modify status of approved attendees"
                          : "Set selected attendees to Waitlisted"
                      }
                    >
                      {isBatchWaitlisting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Hourglass className="size-3.5" />
                      )}
                      <span>Waitlist</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                      onClick={() => handleBatchAction("pending")}
                      disabled={
                        isPending ||
                        isBatchApproving ||
                        isBatchRejecting ||
                        isBatchResendingInterest ||
                        hasApprovedSelected
                      }
                      title={
                        hasApprovedSelected
                          ? "Cannot modify status of approved attendees"
                          : "Set selected attendees back to Pending"
                      }
                    >
                      <Clock className="size-3.5" />
                      <span>Pending</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => handleBatchAction("rejected")}
                      disabled={
                        isPending ||
                        isDeleting ||
                        isBatchApproving ||
                        isBatchRejecting ||
                        isBatchResendingInterest ||
                        hasApprovedSelected
                      }
                      title={
                        hasApprovedSelected
                          ? "Cannot modify status of approved attendees"
                          : "Reject selected attendee applications"
                      }
                    >
                      {isBatchRejecting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserX className="size-3.5" />
                      )}
                      <span>Reject</span>
                    </Button>

                    {pendingSelectedCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => void handleBatchResendInterestEmail()}
                        disabled={
                          isPending || isDeleting || isBatchApproving || isBatchRejecting || isBatchResendingInterest
                        }
                        title="Resend interest email to selected pending attendees"
                      >
                        {isBatchResendingInterest ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Mail className="size-3.5" />
                        )}
                        <span>Resend Interest ({pendingSelectedCount})</span>
                      </Button>
                    )}
                  </>
                )}

                {selectedWithInvoice.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    onClick={() => void handleBatchCheckPayment()}
                    disabled={
                      isPending ||
                      isDeleting ||
                      isCancelling ||
                      isBatchApproving ||
                      isBatchRejecting ||
                      isBatchCheckingPayment
                    }
                    title="Check live DOKU payment status and sync for selected attendees"
                  >
                    {isBatchCheckingPayment ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="size-3.5" />
                    )}
                    <span>Check Payment ({selectedWithInvoice.length})</span>
                  </Button>
                )}

                <div className="mx-0.5 hidden h-4 w-px bg-border/80 sm:block" />

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsBatchCancelConfirmOpen(true)}
                  disabled={
                    isPending ||
                    isDeleting ||
                    isCancelling ||
                    isBatchApproving ||
                    isBatchRejecting ||
                    isBatchResendingInterest
                  }
                  title="Cancel registrations and send notification emails to selected attendees"
                >
                  {isCancelling ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />}
                  <span>Cancel</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-border/70 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsBatchDeleteConfirmOpen(true)}
                  disabled={
                    isPending ||
                    isDeleting ||
                    isCancelling ||
                    isBatchApproving ||
                    isBatchRejecting ||
                    isBatchResendingInterest
                  }
                  title="Permanently remove selected attendee records"
                >
                  <Trash2 className="size-3.5" />
                  <span>Remove</span>
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {/* Filtration Controls */}
          <div className="flex flex-col gap-3">
            {/* Search Row */}
            <div className="flex items-center gap-2">
              <InputGroup className="h-8 w-full">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-8 text-xs"
                  placeholder="Search name, email, details... (';' to multi-filter)"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {search.length > 0 && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleSearchChange("")}
                      aria-label="Clear search text"
                      className="size-5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>

              {searchTokens.length > 1 && (
                <Badge
                  variant="outline"
                  className="h-8 shrink-0 gap-1 border-primary/30 bg-primary/5 px-2 font-medium text-primary text-xs"
                >
                  <span>{searchTokens.length} filter terms</span>
                </Badge>
              )}
            </div>

            {/* Filters & Actions Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger size="sm" className="h-8 text-xs">
                      <span className="text-muted-foreground">Status:</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Statuses ({isLoading ? "..." : statusCounts.all})</SelectItem>
                        {isCurationMode && (
                          <SelectItem value="pending">
                            Pending Review ({isLoading ? "..." : statusCounts.pending})
                          </SelectItem>
                        )}
                        <SelectItem value="waiting_for_payment">
                          Waiting for Payment ({isLoading ? "..." : statusCounts.waiting_for_payment})
                        </SelectItem>
                        <SelectItem value="paid_and_registered">
                          Paid & Registered ({isLoading ? "..." : statusCounts.paid_and_registered})
                        </SelectItem>
                        <SelectItem value="paid_waitlisted">
                          Paid Waitlist ({isLoading ? "..." : statusCounts.paid_waitlisted})
                        </SelectItem>
                        <SelectItem value="expired">Expired ({isLoading ? "..." : statusCounts.expired})</SelectItem>
                        <SelectItem value="failed">Failed ({isLoading ? "..." : statusCounts.failed})</SelectItem>
                        <SelectItem value="canceled">Canceled ({isLoading ? "..." : statusCounts.canceled})</SelectItem>
                        {isCurationMode && (
                          <SelectItem value="approved">
                            Approved ({isLoading ? "..." : statusCounts.approved})
                          </SelectItem>
                        )}
                        <SelectItem value="checked_in">
                          Checked In ({isLoading ? "..." : statusCounts.checked_in})
                        </SelectItem>
                        <SelectItem value="not_checked_in">
                          Not Checked In (Drop) ({isLoading ? "..." : statusCounts.not_checked_in})
                        </SelectItem>
                        {isCurationMode && (
                          <SelectItem value="waitlisted">
                            Waitlisted ({isLoading ? "..." : statusCounts.waitlisted})
                          </SelectItem>
                        )}
                        {isCurationMode && (
                          <SelectItem value="rejected">
                            Rejected ({isLoading ? "..." : statusCounts.rejected})
                          </SelectItem>
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsStatusGuideOpen(true)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Attendee Status & Metric Reference Guide"
                  >
                    <BookOpen className="size-3.5 text-primary" />
                  </Button>
                </div>

                {hasSessions && (
                  <Select value={sessionFilter} onValueChange={handleSessionFilterChange}>
                    <SelectTrigger size="sm" className="h-8 text-xs">
                      <span className="text-muted-foreground">Session:</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Sessions ({registrationsList.length})</SelectItem>
                        {sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}

                {hasTickets && (
                  <Select value={ticketFilter} onValueChange={handleTicketFilterChange}>
                    <SelectTrigger size="sm" className="h-8 text-xs">
                      <Ticket className="mr-1 size-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Ticket:</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Ticket Passes</SelectItem>
                        {availableTickets.map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}

                {hasMerchandise && (
                  <>
                    <Select value={merchandiseFilter} onValueChange={handleMerchandiseFilterChange}>
                      <SelectTrigger size="sm" className="h-8 text-xs">
                        <Package className="mr-1 size-3 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">Merchandise:</span>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">
                            All Merchandise (
                            {merchandiseFilterOptions.totalWithMerch + merchandiseFilterOptions.totalWithoutMerch})
                          </SelectItem>
                          <SelectItem value="has_merchandise">
                            Has Merchandise ({merchandiseFilterOptions.totalWithMerch})
                          </SelectItem>
                          <SelectItem value="no_merchandise">
                            No Merchandise ({merchandiseFilterOptions.totalWithoutMerch})
                          </SelectItem>
                          {merchandiseFilterOptions.items.length > 0 && (
                            <>
                              <SelectItem
                                disabled
                                value="__items_header__"
                                className="font-semibold text-[10px] text-muted-foreground uppercase"
                              >
                                By Product Item
                              </SelectItem>
                              {merchandiseFilterOptions.items.map((item) => (
                                <SelectItem key={item.id} value={item.name}>
                                  {item.name} ({item.count})
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    {(merchandiseFilterOptions.sizes.length > 0 || merchandiseFilterOptions.variants.length > 0) && (
                      <Select value={merchandiseVariantFilter} onValueChange={handleMerchandiseVariantFilterChange}>
                        <SelectTrigger size="sm" className="h-8 text-xs">
                          <Layers className="mr-1 size-3 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground">Variant / Size:</span>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="all">All Variants & Sizes</SelectItem>
                            {merchandiseFilterOptions.sizes.length > 0 && (
                              <>
                                <SelectItem
                                  disabled
                                  value="__size_header__"
                                  className="font-semibold text-[10px] text-muted-foreground uppercase"
                                >
                                  Sizes
                                </SelectItem>
                                {merchandiseFilterOptions.sizes.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label} ({s.count})
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            {merchandiseFilterOptions.variants.length > 0 && (
                              <>
                                <SelectItem
                                  disabled
                                  value="__variant_header__"
                                  className="font-semibold text-[10px] text-muted-foreground uppercase"
                                >
                                  Other Variations
                                </SelectItem>
                                {merchandiseFilterOptions.variants.map((v) => (
                                  <SelectItem key={v.value} value={v.value}>
                                    {v.label} ({v.count})
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}

                {isCurationMode && availableReviewers.length > 0 && (
                  <Select value={reviewerFilter} onValueChange={handleReviewerFilterChange}>
                    <SelectTrigger size="sm" className="h-8 text-xs">
                      <UserCheck className="mr-1 size-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Reviewer:</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Reviewers ({availableReviewers.length})</SelectItem>
                        <SelectItem value="unreviewed">Not Reviewed Yet</SelectItem>
                        {availableReviewers.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}

                {/* Dynamic Question Field Filters */}
                {selectedQuestionColumns.map((qKey) => {
                  const fieldInfo = availableQuestionFields.find((f) => f.key === qKey) || {
                    key: qKey,
                    label: formatQuestionLabel(qKey),
                    responseCount: 0,
                  };
                  const qLabel = fieldInfo.label;
                  const options = getQuestionFilterOptions(fieldInfo, registrationsList, questionLabelMap);
                  if (options.length === 0) return null;

                  const currentVal = questionFilters[qKey] || "all";

                  return (
                    <Select
                      key={qKey}
                      value={currentVal}
                      onValueChange={(val) => handleQuestionFilterChange(qKey, val)}
                    >
                      <SelectTrigger size="sm" className="h-8 max-w-[220px] text-xs">
                        <Filter className="mr-1 size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate text-muted-foreground">{qLabel}:</span>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All {qLabel}</SelectItem>
                          {options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ColumnCustomizer
                  availableQuestions={availableQuestionFields}
                  selectedQuestionKeys={selectedQuestionColumns}
                  onToggleQuestion={handleToggleQuestion}
                  onSelectAllQuestions={handleSelectAllQuestions}
                  onClearAllQuestions={handleClearAllQuestions}
                  visibleStandardColumns={visibleStandardColumns}
                  onToggleStandardColumn={handleToggleStandardColumn}
                  hasSessions={hasSessions}
                  hasTickets={hasTickets}
                  hasMerchandise={hasMerchandise}
                  isCurationMode={isCurationMode}
                  onResetDefaults={handleResetColumnDefaults}
                />

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCheckingPaymentRegistration(null);
                    setIsCheckPaymentDialogOpen(true);
                  }}
                  className="h-8 gap-1.5 border-emerald-500/30 text-emerald-600 text-xs hover:bg-emerald-500/10 dark:text-emerald-400"
                  title="Check DOKU payment status by invoice number or attendee"
                >
                  <CreditCard className="size-3.5" />
                  <span>Check Payment</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncBevyAttendeeStatus}
                  disabled={isSyncingStatus || isSyncingBevy}
                  className="h-8 gap-1.5 text-xs"
                  title="Check if attendees are removed on Bevy and reset their status back to Pending Review"
                >
                  <RotateCcw className={cn("size-3", isSyncingStatus && "animate-spin")} />
                  <span>{isSyncingStatus ? "Syncing Status..." : "Sync Bevy Attendee Status"}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncBevyAttendees(true)}
                  disabled={isSyncingBevy || isSyncingStatus}
                  className="h-8 gap-1.5 text-xs"
                  title="Sync attendee roster and live on-site check-in statuses from Bevy API"
                >
                  <RefreshCw className={cn("size-3", isSyncingBevy && "animate-spin")} />
                  <span>{isSyncingBevy ? "Syncing Bevy..." : "Sync Bevy Check-Ins"}</span>
                </Button>

                <Button size="sm" variant="outline" onClick={handleExportCsv} className="h-8 gap-1 text-xs">
                  <Download className="size-3" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Status Filter Pills & Counters */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              {
                key: "all",
                label: "All",
                count: statusCounts.all,
                activeClass: "border-primary/50 bg-primary/10 text-primary font-medium",
              },
              ...(isCurationMode
                ? [
                    {
                      key: "pending",
                      label: "Pending",
                      count: statusCounts.pending,
                      activeClass: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium",
                    },
                  ]
                : []),
              {
                key: "waiting_for_payment",
                label: "Waiting for Payment",
                count: statusCounts.waiting_for_payment,
                activeClass: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium",
              },
              {
                key: "paid_and_registered",
                label: "Paid & Registered",
                count: statusCounts.paid_and_registered,
                activeClass:
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
              },
              {
                key: "paid_waitlisted",
                label: "Paid Waitlist",
                count: statusCounts.paid_waitlisted,
                activeClass: "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium",
              },
              {
                key: "expired",
                label: "Expired",
                count: statusCounts.expired,
                activeClass: "border-zinc-500/50 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 font-medium",
              },
              {
                key: "failed",
                label: "Failed",
                count: statusCounts.failed,
                activeClass: "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium",
              },
              {
                key: "canceled",
                label: "Canceled",
                count: statusCounts.canceled,
                activeClass: "border-slate-500/50 bg-slate-500/10 text-slate-700 dark:text-slate-300 font-medium",
              },
              ...(isCurationMode
                ? [
                    {
                      key: "approved",
                      label: "Approved",
                      count: statusCounts.approved,
                      activeClass:
                        "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
                    },
                  ]
                : []),
              {
                key: "checked_in",
                label: "Checked In",
                count: statusCounts.checked_in,
                activeClass: "border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium",
              },
              ...(isCurationMode
                ? [
                    {
                      key: "waitlisted",
                      label: "Waitlisted",
                      count: statusCounts.waitlisted,
                      activeClass: "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium",
                    },
                    {
                      key: "rejected",
                      label: "Rejected",
                      count: statusCounts.rejected,
                      activeClass: "border-destructive/50 bg-destructive/10 text-destructive font-medium",
                    },
                  ]
                : []),
            ]
              .filter(
                (item) =>
                  item.key === "all" ||
                  item.count > 0 ||
                  ["waiting_for_payment", "paid_and_registered", "paid_waitlisted", "expired"].includes(item.key),
              )
              .map((item) => {
                const isActive = statusFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleStatusFilterChange(item.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      isActive
                        ? item.activeClass
                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0 font-semibold text-[10px] tabular-nums",
                        isActive ? "bg-background/80" : "bg-muted text-foreground",
                      )}
                    >
                      {isLoading ? <Shimmer className="inline-block h-2.5 w-4 rounded-xs align-middle" /> : item.count}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="font-medium text-muted-foreground text-xs">Active Filters:</span>
              {searchTokens.length > 1 ? (
                searchTokens.map((token, index) => (
                  <Badge key={token} variant="secondary" className="gap-1 font-normal text-xs">
                    <span>Search: &quot;{token}&quot;</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSearchToken(index)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`Clear search filter for ${token}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              ) : search.trim() ? (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <span>Search: &quot;{searchTokens[0] ?? search.trim()}&quot;</span>
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear search filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ) : null}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <span>
                    Status:{" "}
                    {statusFilter === "checked_in"
                      ? "Checked In"
                      : statusFilter === "not_checked_in"
                        ? "Not Checked In (Drop)"
                        : STATUS_VARIANTS[statusFilter as RegistrationStatus]?.label || statusFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStatusFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear status filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {sessionFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <span>Session: {sessions.find((s) => s.id === sessionFilter)?.title || sessionFilter}</span>
                  <button
                    type="button"
                    onClick={() => handleSessionFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear session filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {ticketFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <Ticket className="size-3 text-primary" />
                  <span>Ticket: {ticketFilter}</span>
                  <button
                    type="button"
                    onClick={() => handleTicketFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear ticket filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {merchandiseFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <Package className="size-3 text-primary" />
                  <span>
                    Merchandise:{" "}
                    {merchandiseFilter === "has_merchandise"
                      ? "Has Merchandise"
                      : merchandiseFilter === "no_merchandise"
                        ? "No Merchandise"
                        : merchandiseFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMerchandiseFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear merchandise filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {merchandiseVariantFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <Layers className="size-3 text-primary" />
                  <span>Variant/Size: {merchandiseVariantFilter}</span>
                  <button
                    type="button"
                    onClick={() => handleMerchandiseVariantFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear variant filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {isCurationMode && reviewerFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <UserCheck className="size-3 text-primary" />
                  <span>Reviewer: {reviewerFilter === "unreviewed" ? "Not Reviewed" : reviewerFilter}</span>
                  <button
                    type="button"
                    onClick={() => handleReviewerFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear reviewer filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {selectedQuestionColumns.map((qKey) => {
                const val = questionFilters[qKey];
                if (!val || val === "all") return null;
                const fieldInfo = availableQuestionFields.find((f) => f.key === qKey);
                const label = fieldInfo?.label || formatQuestionLabel(qKey);
                return (
                  <Badge key={qKey} variant="secondary" className="gap-1 font-normal text-xs">
                    <span className="max-w-[200px] truncate">
                      {label}: {val}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuestionFilterChange(qKey, "all")}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`Clear ${label} filter`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Reset All
              </Button>
            </div>
          )}

          {/* Registrants Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  {visibleStandardColumns.status !== false && <TableHead>Status</TableHead>}
                  {isCurationMode && visibleStandardColumns.reviewed_by !== false && <TableHead>Reviewed By</TableHead>}
                  {hasTickets && visibleStandardColumns.ticket !== false && <TableHead>Ticket Pass</TableHead>}
                  {hasMerchandise && visibleStandardColumns.merchandise !== false && <TableHead>Merchandise</TableHead>}
                  {hasSessions && visibleStandardColumns.session !== false && <TableHead>Session Track</TableHead>}
                  {visibleStandardColumns.checkin !== false && <TableHead>Check-In (Bevy)</TableHead>}
                  {selectedQuestionColumns.map((qKey) => {
                    const fieldInfo = availableQuestionFields.find((f) => f.key === qKey);
                    const label = fieldInfo?.label || formatQuestionLabel(qKey);
                    const isFiltered = Boolean(questionFilters[qKey] && questionFilters[qKey] !== "all");
                    return (
                      <TableHead key={qKey} className="min-w-[150px] max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{label}</span>
                          {isFiltered && (
                            <Badge variant="secondary" className="bg-primary/10 px-1 py-0 text-[10px] text-primary">
                              Filtered
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                  {visibleStandardColumns.all_responses !== false && (
                    <TableHead className="min-w-[240px] max-w-[380px]">Question Responses & Details</TableHead>
                  )}
                  {visibleStandardColumns.registered_at !== false && (
                    <TableHead className="whitespace-nowrap">Registered At</TableHead>
                  )}
                  {visibleStandardColumns.actions !== false && (
                    <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isLoading || isFiltering) && (
                  <RegistrantsTableSkeleton
                    hasSessions={hasSessions}
                    hasTickets={hasTickets}
                    hasMerchandise={hasMerchandise}
                    visibleStandardColumns={visibleStandardColumns}
                    questionColumnCount={selectedQuestionColumns.length}
                    isCurationMode={isCurationMode}
                  />
                )}

                {!isLoading && !isFiltering && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={totalColumnCount} className="h-40 text-center text-muted-foreground text-sm">
                      {registrationsList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                            <Users className="size-5 text-muted-foreground" />
                          </div>
                          <p className="font-semibold text-foreground text-sm">No registrations received yet</p>
                          <p className="max-w-md text-muted-foreground text-xs leading-relaxed">
                            When members RSVP or submit registration forms for this event, their details will appear
                            here automatically in real-time.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                            <Search className="size-5 text-muted-foreground" />
                          </div>
                          <p className="font-semibold text-foreground text-sm">
                            No applicants match the selected filter
                          </p>
                          <p className="max-w-md text-muted-foreground text-xs leading-relaxed">
                            {statusFilter !== "all"
                              ? `No applicants currently have status "${statusFilter === "checked_in" ? "Checked In" : statusFilter === "not_checked_in" ? "Not Checked In (Drop)" : STATUS_VARIANTS[statusFilter as RegistrationStatus]?.label || statusFilter}".`
                              : "No applicants match your search criteria."}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 h-7 text-xs"
                            onClick={handleResetAllFilters}
                          >
                            Reset All Filters
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  !isFiltering &&
                  filtered.map((reg) => {
                    const effectiveStatus = getEffectiveRegistrationStatus(reg, currentEvent);
                    const rawStatus = ((effectiveStatus as string) || "").toLowerCase().trim();
                    const statusMeta =
                      STATUS_VARIANTS[rawStatus as RegistrationStatus] ||
                      (rawStatus === "confirmed" || rawStatus === "registered"
                        ? STATUS_VARIANTS.approved
                        : STATUS_VARIANTS.pending);
                    const deadlineInfo = getRegistrationPaymentDeadline(reg, currentEvent);
                    const sessionTitle =
                      reg.session_title ||
                      (reg.answers?.session_title as string) ||
                      (reg.session_id ? `Track: ${reg.session_id}` : null);

                    const regDate = formatFirestoreDate(reg.registered_at, "dd MMM yyyy, h:mm a");

                    const isCanceled =
                      rawStatus === "canceled" ||
                      rawStatus === "cancelled" ||
                      reg.status === "canceled" ||
                      reg.status === "cancelled" ||
                      reg.refund_request?.status === "refund_completed" ||
                      reg.payment_status === "refunded";

                    let approveTitle = "Approve application";
                    if (isCanceled) {
                      approveTitle = "Registration canceled (Refunded / Canceled)";
                    } else if (rawStatus === "approved" || rawStatus === "paid_and_registered") {
                      approveTitle = rawStatus === "paid_and_registered" ? "Paid & Registered" : "Approved";
                    } else if (rawStatus === "waiting_for_payment") {
                      approveTitle = "Waiting for payment (Disabled until expired)";
                    } else if (rawStatus === "expired") {
                      approveTitle = "Payment Expired (Click to regenerate payment link)";
                    } else if (approvingRegistrationId === reg.id) {
                      approveTitle = "Approving...";
                    }

                    let pendingTitle = reg.status === "pending" ? "Pending Review" : "Mark as Pending";
                    if (isCanceled) {
                      pendingTitle = "Status locked (Canceled)";
                    } else if (reg.status === "approved") {
                      pendingTitle = "Status locked (Approved)";
                    }

                    let rejectTitle = reg.status === "rejected" ? "Rejected" : "Reject application";
                    if (isCanceled) {
                      rejectTitle = "Status locked (Canceled)";
                    } else if (reg.status === "approved") {
                      rejectTitle = "Status locked (Approved)";
                    }

                    return (
                      <TableRow key={reg.id} className="cursor-pointer hover:bg-muted/40">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(reg.id)}
                            onCheckedChange={() => toggleSelectRow(reg.id)}
                            aria-label={`Select ${reg.member_name}`}
                          />
                        </TableCell>

                        <TableCell onClick={() => setInspectRegistration(reg)}>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-full border">
                              <AvatarImage src={reg.member_avatar} alt={reg.member_name} />
                              <AvatarFallback className="font-medium text-xs">
                                {getInitials(reg.member_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-foreground text-sm hover:underline">
                                {reg.member_name}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">{reg.member_email}</span>
                                {(emailCounts.get((reg.member_email || "").toLowerCase()) || 0) > 1 && (
                                  <Badge
                                    variant="destructive"
                                    className="px-1.5 py-0 font-normal text-[10px]"
                                    title="Multiple registrations detected with this email address"
                                  >
                                    Duplicate Email
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {visibleStandardColumns.status !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)}>
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                variant="outline"
                                className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", statusMeta.badgeClass)}
                              >
                                <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                                {statusMeta.label}
                              </Badge>
                              {rawStatus === "expired" && deadlineInfo.timeStatusText && (
                                <span className="font-medium text-[10px] text-rose-500">
                                  {deadlineInfo.timeStatusText}
                                </span>
                              )}
                              {rawStatus === "waiting_for_payment" && deadlineInfo.timeStatusText && (
                                <span className="font-normal text-[10px] text-amber-600 dark:text-amber-400">
                                  {deadlineInfo.timeStatusText}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        )}

                        {isCurationMode && visibleStandardColumns.reviewed_by !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)} className="max-w-[180px]">
                            {reg.reviewed_by_name ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                                  <UserCheck className="size-3.5 shrink-0 text-primary" />
                                  <span className="truncate">{reg.reviewed_by_name}</span>
                                </div>
                                {reg.reviewed_at && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatFirestoreDate(reg.reviewed_at, "dd MMM, HH:mm")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">—</span>
                            )}
                          </TableCell>
                        )}

                        {hasTickets && visibleStandardColumns.ticket !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)}>
                            {reg.ticket_name ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground text-xs">{reg.ticket_name}</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "w-fit px-1.5 py-0 font-semibold text-[10px]",
                                    reg.ticket_type === "free" &&
                                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                                    reg.ticket_type === "paid" &&
                                      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                                    reg.ticket_type === "commitment_fee" &&
                                      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                  )}
                                >
                                  {getTicketBadgeText(reg.ticket_type, reg.ticket_price)}
                                </Badge>
                                {reg.voucher_code && (
                                  <Badge
                                    variant="outline"
                                    className="w-fit border-primary/30 bg-primary/10 px-1.5 py-0 font-mono font-semibold text-[9px] text-primary"
                                  >
                                    Promo: {reg.voucher_code}
                                  </Badge>
                                )}
                                {reg.referral_code && (
                                  <Badge
                                    variant="outline"
                                    className="w-fit border-border/80 bg-muted/60 px-1.5 py-0 font-mono font-semibold text-[9px] text-foreground"
                                  >
                                    Referral: {reg.referral_code}
                                  </Badge>
                                )}
                                {reg.bundle_name && (
                                  <Badge
                                    variant="outline"
                                    className="w-fit border-primary/40 bg-primary/10 px-1.5 py-0 font-semibold text-[9px] text-primary"
                                  >
                                    Bundle: {reg.bundle_name}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-muted-foreground text-xs">General RSVP</span>
                                {reg.referral_code && (
                                  <Badge
                                    variant="outline"
                                    className="w-fit border-border/80 bg-muted/60 px-1.5 py-0 font-mono font-semibold text-[9px] text-foreground"
                                  >
                                    Referral: {reg.referral_code}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                        )}

                        {hasMerchandise && visibleStandardColumns.merchandise !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)}>
                            {reg.selected_merchandise && reg.selected_merchandise.length > 0 ? (
                              <div className="flex min-w-[140px] max-w-[260px] flex-col gap-1.5">
                                {reg.selected_merchandise.map((m, mIdx) => {
                                  const variations = parseMerchandiseVariations(m, reg.answers);
                                  return (
                                    <div
                                      key={m.id || mIdx}
                                      className="flex flex-col gap-1 rounded-md border border-border/50 bg-muted/40 p-1.5"
                                    >
                                      <div className="flex items-center gap-1.5 font-medium text-[11px] text-foreground leading-tight">
                                        <Package className="size-3 shrink-0 text-primary" />
                                        <span className="font-semibold text-primary">{m.quantity}x</span>
                                        <span className="truncate">{m.name}</span>
                                      </div>
                                      {variations.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1 pl-4.5">
                                          {variations.map((v) => (
                                            <Badge
                                              key={v.key + v.value}
                                              variant="outline"
                                              className={cn(
                                                "h-4 px-1 py-0 font-medium text-[9px] leading-none",
                                                v.isSize
                                                  ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                                                  : "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
                                              )}
                                            >
                                              {v.label ? `${v.label}: ` : ""}
                                              {v.value}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {reg.delivery_request && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "w-fit gap-1 font-medium text-[9px] capitalize",
                                      reg.delivery_request.status === "approved" &&
                                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                      reg.delivery_request.status === "pending_review" &&
                                        "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                                      reg.delivery_request.status === "delivered" &&
                                        "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
                                      reg.delivery_request.status === "pending_payment" &&
                                        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                      reg.delivery_request.status === "rejected" &&
                                        "border-destructive/30 bg-destructive/10 text-destructive",
                                    )}
                                  >
                                    <Truck className="size-2.5" />
                                    <span>Delivery: {reg.delivery_request.status.replace("_", " ")}</span>
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        )}

                        {hasSessions && visibleStandardColumns.session !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)}>
                            {sessionTitle ? (
                              <Badge variant="secondary" className="gap-1 font-normal text-xs">
                                <Layers className="size-3 text-primary" />
                                {sessionTitle}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Main Event</span>
                            )}
                          </TableCell>
                        )}

                        {visibleStandardColumns.checkin !== false && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {reg.is_checked_in ? (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-600 dark:text-emerald-400"
                                >
                                  <UserCheck className="size-3" />
                                  <span>Checked In</span>
                                </Badge>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  className="size-6 text-muted-foreground hover:text-destructive"
                                  title="Undo check-in in Bevy"
                                  onClick={() => handleToggleCheckIn(reg, false)}
                                  disabled={isCheckingInId === reg.id}
                                >
                                  <RotateCcw className="size-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 gap-1 px-2 font-normal text-[11px] text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600"
                                onClick={() => handleToggleCheckIn(reg, true)}
                                disabled={isCheckingInId === reg.id}
                              >
                                <UserCheck className="size-3" />
                                <span>Check In</span>
                              </Button>
                            )}
                          </TableCell>
                        )}

                        {/* Dynamic Question Columns */}
                        {selectedQuestionColumns.map((qKey) => {
                          const rawVal = resolveAnswerValue(reg.answers, qKey, questionLabelMap);
                          return (
                            <TableCell
                              key={qKey}
                              onClick={() => setInspectRegistration(reg)}
                              className="max-w-[240px] align-top"
                            >
                              <QuestionColumnValueCell value={rawVal} />
                            </TableCell>
                          );
                        })}

                        {visibleStandardColumns.all_responses !== false && (
                          <TableCell
                            onClick={() => setInspectRegistration(reg)}
                            className="max-w-[380px] overflow-hidden"
                          >
                            <QuestionResponsesCell answers={reg.answers} formatQuestionLabel={formatQuestionLabel} />
                          </TableCell>
                        )}

                        {visibleStandardColumns.registered_at !== false && (
                          <TableCell
                            onClick={() => setInspectRegistration(reg)}
                            className="whitespace-nowrap text-muted-foreground text-xs"
                          >
                            {regDate}
                          </TableCell>
                        )}

                        {visibleStandardColumns.actions !== false && (
                          <TableCell className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Curation Action Buttons: Approve, Pending, Reject */}
                              {isCurationMode && (
                                <>
                                  {/* 1. Approve Button */}
                                  <Button
                                    size="icon-xs"
                                    variant={
                                      rawStatus === "approved" || rawStatus === "paid_and_registered"
                                        ? "default"
                                        : "ghost"
                                    }
                                    className={cn(
                                      "size-7 transition-colors",
                                      rawStatus === "approved" || rawStatus === "paid_and_registered"
                                        ? "cursor-default bg-emerald-600 text-white opacity-90 shadow-xs hover:bg-emerald-600"
                                        : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700",
                                      (rawStatus === "waiting_for_payment" || isCanceled) &&
                                        "disabled:pointer-events-auto disabled:cursor-not-allowed opacity-40",
                                    )}
                                    title={approveTitle}
                                    onClick={() => handleApproveAttendee(reg)}
                                    disabled={
                                      isPending ||
                                      approvingRegistrationId === reg.id ||
                                      rawStatus === "approved" ||
                                      rawStatus === "paid_and_registered" ||
                                      rawStatus === "waiting_for_payment" ||
                                      isCanceled
                                    }
                                  >
                                    {approvingRegistrationId === reg.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Check className="size-3.5" />
                                    )}
                                  </Button>

                                  {/* 2. Pending Button */}
                                  <Button
                                    size="icon-xs"
                                    variant={reg.status === "pending" ? "default" : "ghost"}
                                    className={cn(
                                      "size-7 transition-colors",
                                      reg.status === "pending"
                                        ? "bg-amber-600 text-white shadow-xs hover:bg-amber-700"
                                        : "text-amber-600 hover:bg-amber-500/10 hover:text-amber-700",
                                      isCanceled &&
                                        "disabled:pointer-events-auto disabled:cursor-not-allowed opacity-40",
                                    )}
                                    title={pendingTitle}
                                    onClick={() => handleStatusChange(reg.id, "pending")}
                                    disabled={
                                      isPending ||
                                      approvingRegistrationId === reg.id ||
                                      rawStatus === "approved" ||
                                      rawStatus === "paid_and_registered" ||
                                      isCanceled
                                    }
                                  >
                                    <Clock className="size-3.5" />
                                  </Button>

                                  {/* 3. Reject Button */}
                                  <Button
                                    size="icon-xs"
                                    variant={reg.status === "rejected" ? "default" : "ghost"}
                                    className={cn(
                                      "size-7 transition-colors",
                                      reg.status === "rejected"
                                        ? "bg-destructive text-white shadow-xs hover:bg-destructive/90"
                                        : "text-destructive hover:bg-destructive/10 hover:text-destructive",
                                      isCanceled &&
                                        "disabled:pointer-events-auto disabled:cursor-not-allowed opacity-40",
                                    )}
                                    title={rejectTitle}
                                    onClick={() => handleStatusChange(reg.id, "rejected")}
                                    disabled={
                                      isPending ||
                                      approvingRegistrationId === reg.id ||
                                      rejectingRegistrationId === reg.id ||
                                      rawStatus === "approved" ||
                                      rawStatus === "paid_and_registered" ||
                                      isCanceled
                                    }
                                  >
                                    {rejectingRegistrationId === reg.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <X className={cn("size-3.5", reg.status === "rejected" && "text-white")} />
                                    )}
                                  </Button>
                                </>
                              )}

                              {/* Quick Regenerate Payment Link Button */}
                              {(rawStatus === "expired" || rawStatus === "waiting_for_payment") &&
                                hasRegistrationPaymentRequirements(reg) && (
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    className="size-7 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                                    title="Regenerate Payment Link with new deadline"
                                    onClick={() => setResendPaymentRegistration(reg)}
                                  >
                                    <RefreshCw className="size-3.5" />
                                  </Button>
                                )}

                              {/* Quick Check DOKU Payment Status Button (when waiting for payment or expired) */}
                              {(rawStatus === "waiting_for_payment" ||
                                (rawStatus === "expired" && hasRegistrationPaymentRequirements(reg))) && (
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  className="size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                  title="Check DOKU payment status & sync"
                                  onClick={() => {
                                    setCheckingPaymentRegistration(reg);
                                    setIsCheckPaymentDialogOpen(true);
                                  }}
                                >
                                  <CreditCard className="size-3.5" />
                                </Button>
                              )}

                              {/* 4. View Dossier / Details Button */}
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="View application details"
                                onClick={() => setInspectRegistration(reg)}
                              >
                                <Eye className="size-3.5" />
                              </Button>

                              {/* 5. More Actions Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon-xs" variant="ghost" className="size-7 text-muted-foreground">
                                    <MoreHorizontal className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setInspectRegistration(reg)}>
                                    <Eye className="mr-2 size-3.5" />
                                    View application dossier
                                  </DropdownMenuItem>
                                  {(rawStatus === "waiting_for_payment" ||
                                    (rawStatus === "expired" && hasRegistrationPaymentRequirements(reg))) && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCheckingPaymentRegistration(reg);
                                        setIsCheckPaymentDialogOpen(true);
                                      }}
                                    >
                                      <CreditCard className="mr-2 size-3.5 text-emerald-600" />
                                      Check payment status (DOKU)
                                    </DropdownMenuItem>
                                  )}
                                  {(rawStatus === "expired" || rawStatus === "waiting_for_payment") &&
                                    hasRegistrationPaymentRequirements(reg) && (
                                      <DropdownMenuItem onClick={() => setResendPaymentRegistration(reg)}>
                                        <RefreshCw className="mr-2 size-3.5" />
                                        Regenerate Payment Link
                                      </DropdownMenuItem>
                                    )}
                                  {isCurationMode && reg.status === "pending" && (
                                    <DropdownMenuItem
                                      disabled={
                                        isResendingInterestId === reg.id ||
                                        isPending ||
                                        rejectingRegistrationId === reg.id
                                      }
                                      onClick={() => void handleResendInterestEmail(reg)}
                                    >
                                      {isResendingInterestId === reg.id ? (
                                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                                      ) : (
                                        <Mail className="mr-2 size-3.5" />
                                      )}
                                      Resend Interest Email
                                    </DropdownMenuItem>
                                  )}
                                  {isCurationMode && reg.status === "waitlisted" && (
                                    <DropdownMenuItem
                                      disabled={
                                        isResendingWaitlistId === reg.id ||
                                        isPending ||
                                        approvingRegistrationId === reg.id
                                      }
                                      onClick={() => void handleResendWaitlistEmail(reg)}
                                    >
                                      {isResendingWaitlistId === reg.id ? (
                                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                                      ) : (
                                        <Mail className="mr-2 size-3.5" />
                                      )}
                                      Resend Waitlist Email
                                    </DropdownMenuItem>
                                  )}
                                  {reg.status === "paid_waitlisted" && (
                                    <DropdownMenuItem
                                      disabled={
                                        isResendingPaidWaitlistId === reg.id ||
                                        isPending ||
                                        approvingRegistrationId === reg.id
                                      }
                                      onClick={() => void handleResendPaidWaitlistEmail(reg)}
                                    >
                                      {isResendingPaidWaitlistId === reg.id ? (
                                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                                      ) : (
                                        <Mail className="mr-2 size-3.5" />
                                      )}
                                      Resend Paid Waitlist Email
                                    </DropdownMenuItem>
                                  )}
                                  {isCurationMode && (
                                    <DropdownMenuItem
                                      disabled={
                                        rawStatus === "approved" ||
                                        rawStatus === "paid_and_registered" ||
                                        rawStatus === "waitlisted" ||
                                        isPending ||
                                        approvingRegistrationId === reg.id ||
                                        waitlistingRegistrationId === reg.id
                                      }
                                      onClick={() => handleStatusChange(reg.id, "waitlisted")}
                                    >
                                      {waitlistingRegistrationId === reg.id ? (
                                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                                      ) : (
                                        <Layers className="mr-2 size-3.5" />
                                      )}
                                      Move to Waitlist
                                    </DropdownMenuItem>
                                  )}
                                  {reg.member_email && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void navigator.clipboard.writeText(reg.member_email);
                                        toast.success("Email copied to clipboard");
                                      }}
                                    >
                                      <Copy className="mr-2 size-3.5" />
                                      Copy email address
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                    onClick={() => setCancelConfirmRegistration(reg)}
                                  >
                                    <UserX className="mr-2 size-3.5" />
                                    Cancel registration
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-muted-foreground focus:bg-destructive/10 focus:text-destructive"
                                    onClick={() => setDeleteConfirmRegistration(reg)}
                                  >
                                    <Trash2 className="mr-2 size-3.5" />
                                    Remove attendee
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Redesigned Applicant Details Dossier Dialog */}
      <ApplicantDetailDialog
        registration={inspectRegistration}
        event={currentEvent}
        isCurationMode={isCurationMode}
        onClose={() => setInspectRegistration(null)}
        onStatusChange={handleStatusChange}
        onUpdateRegistration={(updatedReg) => {
          setRegistrationsList((prev) => prev.map((r) => (r.id === updatedReg.id ? { ...r, ...updatedReg } : r)));
          setInspectRegistration(updatedReg);
        }}
        onApprove={handleApproveAttendee}
        onReject={handleRejectAttendee}
        onResendInterestEmail={handleResendInterestEmail}
        onResendWaitlistEmail={handleResendWaitlistEmail}
        onResendPaidWaitlistEmail={handleResendPaidWaitlistEmail}
        onToggleCheckIn={handleToggleCheckIn}
        onCancelRegistration={(reg) => {
          setInspectRegistration(null);
          setCancelConfirmRegistration(reg);
        }}
        onDelete={(reg) => {
          setInspectRegistration(null);
          setDeleteConfirmRegistration(reg);
        }}
        customQuestions={customQuestions}
        isPending={isPending || isCheckingInId === inspectRegistration?.id}
        isApproving={approvingRegistrationId === inspectRegistration?.id}
        isRejecting={rejectingRegistrationId === inspectRegistration?.id}
        isWaitlisting={waitlistingRegistrationId === inspectRegistration?.id}
        isResendingInterest={isResendingInterestId === inspectRegistration?.id}
        isResendingWaitlist={isResendingWaitlistId === inspectRegistration?.id}
        isResendingPaidWaitlist={isResendingPaidWaitlistId === inspectRegistration?.id}
        isCancelling={isCancelling}
      />

      {/* Confirmation Dialog: Single Attendee Cancellation */}
      <AlertDialog
        open={Boolean(cancelConfirmRegistration)}
        onOpenChange={(open) => !open && setCancelConfirmRegistration(null)}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Registration & Remove Attendee</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2.5 pt-1 text-left text-sm">
              <span className="block text-foreground">
                Are you sure you want to cancel the registration for{" "}
                <strong>{cancelConfirmRegistration?.member_name}</strong>
                {cancelConfirmRegistration?.member_email ? ` (${cancelConfirmRegistration.member_email})` : ""}?
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                A cancellation email will be dispatched to their address informing them that their registration has been
                cancelled by the organizer and they have been removed from the event. If they change their mind, they
                will need to re-register again.
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Their registration and allocated tickets will then be removed from the dashboard and Bevy roster,
                freeing up capacity for new attendees.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isCancelling}>Keep Registration</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isCancelling}
              onClick={() => {
                if (cancelConfirmRegistration) {
                  handleCancelRegistration(cancelConfirmRegistration);
                }
              }}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Registration & Send Email"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Batch Attendee Cancellation */}
      <AlertDialog open={isBatchCancelConfirmOpen} onOpenChange={(open) => !open && setIsBatchCancelConfirmOpen(false)}>
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Selected Registrations</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2.5 pt-1 text-left text-sm">
              <span className="block text-foreground">
                Are you sure you want to cancel the registrations for{" "}
                <strong className="text-foreground">{selectedIds.size}</strong> selected attendee
                {selectedIds.size === 1 ? "" : "s"}?
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Each attendee will receive a cancellation email informing them that their registration has been
                cancelled by the organizer, they have been removed from the event, and they must re-register if they
                change their mind.
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Their registrations will be permanently removed from the dashboard and Bevy roster, releasing attendee
                capacity.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isCancelling}>Keep Registrations</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isCancelling}
              onClick={handleBatchCancel}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Cancelling {selectedIds.size}...
                </>
              ) : (
                `Cancel ${selectedIds.size} Registration${selectedIds.size === 1 ? "" : "s"} & Send Emails`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Single Attendee Removal */}
      <AlertDialog
        open={Boolean(deleteConfirmRegistration)}
        onOpenChange={(open) => !open && setDeleteConfirmRegistration(null)}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Attendee</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1 text-left text-sm">
              <span className="block text-foreground">
                Are you sure you want to remove <strong>{deleteConfirmRegistration?.member_name}</strong>
                {deleteConfirmRegistration?.member_email ? ` (${deleteConfirmRegistration.member_email})` : ""}?
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Their registration will be permanently removed from the dashboard and Bevy roster, freeing up attendee
                capacity and allowing them to re-register for this event.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (deleteConfirmRegistration) {
                  handleDeleteRegistration(deleteConfirmRegistration);
                }
              }}
            >
              {isDeleting ? "Removing..." : "Remove Attendee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Batch Attendee Removal */}
      <AlertDialog open={isBatchDeleteConfirmOpen} onOpenChange={(open) => !open && setIsBatchDeleteConfirmOpen(false)}>
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Selected Attendees</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1 text-left text-sm">
              <span className="block text-foreground">
                Are you sure you want to remove the <strong>{selectedIds.size}</strong> selected attendee
                {selectedIds.size === 1 ? "" : "s"}?
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Their registrations will be permanently removed from the dashboard and Bevy roster, freeing up attendee
                capacity and allowing them to re-register for this event.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleBatchDelete}
            >
              {isDeleting ? "Removing..." : `Remove ${selectedIds.size} Attendee${selectedIds.size === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Capacity Limit Error Dialog */}
      {capacityAlert && (
        <CapacityFullDialog
          open={capacityAlert.open}
          onOpenChange={(open) => setCapacityAlert((prev) => (prev ? { ...prev, open } : null))}
          mode="organizer"
          title={capacityAlert.title}
          message={capacityAlert.message}
          reason={capacityAlert.reason}
          attendeeName={capacityAlert.attendeeName}
          attendeeEmail={capacityAlert.attendeeEmail}
          sessionTitle={capacityAlert.sessionTitle}
          currentCount={capacityAlert.currentCount}
          maxCapacity={capacityAlert.maxCapacity}
          venueName={currentEvent?.venue?.name}
          batchOverreachedItems={capacityAlert.batchOverreachedItems}
          onGoToSettings={() => {
            const formTabTrigger = document.querySelector<HTMLButtonElement>(
              '[data-slot="tabs-trigger"][value="form"], button[value="form"]',
            );
            formTabTrigger?.click();
          }}
        />
      )}

      {/* Resend Payment Link Dialog */}
      <ResendPaymentLinkDialog
        open={Boolean(resendPaymentRegistration)}
        onOpenChange={(open) => !open && setResendPaymentRegistration(null)}
        registration={resendPaymentRegistration}
        event={currentEvent}
        onSuccess={(updatedReg) => {
          setRegistrationsList((prev) => prev.map((r) => (r.id === updatedReg.id ? updatedReg : r)));
        }}
      />

      {/* Check DOKU Payment Status Dialog */}
      <CheckPaymentStatusDialog
        open={isCheckPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsCheckPaymentDialogOpen(open);
          if (!open) {
            setCheckingPaymentRegistration(null);
          }
        }}
        registration={checkingPaymentRegistration}
        event={currentEvent}
        onSuccess={(updatedReg) => {
          setRegistrationsList((prev) => prev.map((r) => (r.id === updatedReg.id ? updatedReg : r)));
        }}
      />

      {/* Attendee Status & Metric Reference Guide Dialog */}
      <AttendeeStatusGuideDialog open={isStatusGuideOpen} onOpenChange={setIsStatusGuideOpen} />
    </div>
  );
}
