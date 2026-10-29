"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { format } from "date-fns";
import {
  BookOpen,
  Check,
  ChevronDown,
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
  PackageCheck,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { formatRupiah } from "@/lib/events/refund-utils";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import {
  deleteBatchEventRegistrationsAction,
  deleteEventRegistrationAction,
  updateRegistrationCheckInAction,
  updateRegistrationMerchandiseCollectionAction,
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
import { QrCheckInScannerDialog } from "./qr-checkin-scanner-dialog";
import { QuestionColumnValueCell } from "./question-column-value-cell";
import { QuestionResponsesCell } from "./question-responses-cell";
import { RegistrantStatistics } from "./registrant-statistics";
import { ResendPaymentLinkDialog } from "./resend-payment-link-dialog";

interface RegistrantsTabProps {
  eventId: string;
  registrations: FirestoreRegistration[];
  event?: FirestoreEvent;
  onSwitchTab?: (tab: string) => void;
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
          {hasMerchandise && visibleStandardColumns.merchandise_collected !== false && (
            <TableCell>
              <div className="relative h-5 w-20 overflow-hidden rounded-md bg-muted">
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

function matchesRegistrationToken(
  reg: FirestoreRegistration,
  tokenLower: string,
  bevyAttendee?: BevyAttendee,
): boolean {
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
      Boolean(reg.attendee_code?.toLowerCase().includes(tokenLower)) ||
      Boolean(bevyAttendee?.attendee_code?.toLowerCase().includes(tokenLower)) ||
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

interface FilterSelectOption {
  value: string;
  label: string;
  isHeader?: boolean;
}

function FilterSelect({
  value,
  onValueChange,
  options,
  icon,
  prefix,
  placeholder,
  className,
  align = "start",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterSelectOption[];
  icon?: ReactNode;
  prefix?: string;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const selectedLabel = options.find((opt) => !opt.isHeader && opt.value === value)?.label ?? placeholder ?? value;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-fit items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-xs whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {icon}
            {prefix && <span className="shrink-0 text-muted-foreground">{prefix}</span>}
            <span className="truncate">{selectedLabel}</span>
          </span>
          <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-80 w-auto min-w-(--radix-dropdown-menu-trigger-width)">
        {options.map((opt) =>
          opt.isHeader ? (
            <DropdownMenuLabel
              key={opt.value}
              className="px-1.5 py-1 font-semibold text-[10px] text-muted-foreground uppercase"
            >
              {opt.label}
            </DropdownMenuLabel>
          ) : (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onValueChange(opt.value)}
              className="justify-between gap-3 text-xs"
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.value && <Check className="size-3.5 shrink-0" />}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 3) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];
  return [currentPage - 1, currentPage, currentPage + 1];
}

export function RegistrantsTab({ eventId, registrations, event, onSwitchTab }: RegistrantsTabProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading || s.isLoggingOut);
  const [registrationsList, setRegistrationsList] = useState<FirestoreRegistration[]>(() =>
    registrations.map((r) => normalizeRegistrationDoc(r as unknown as Record<string, unknown>, r.id)),
  );
  const [isLoading, setIsLoading] = useState(registrations.length === 0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [bundleFilter, setBundleFilter] = useState<string>("all");
  const [promoReferralFilter, setPromoReferralFilter] = useState<string>("all");
  const [merchandiseFilter, setMerchandiseFilter] = useState<string>("all");
  const [merchandiseVariantFilter, setMerchandiseVariantFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
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
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [rejectConfirmRegistration, setRejectConfirmRegistration] = useState<FirestoreRegistration | null>(null);
  const [isBatchRejectConfirmOpen, setIsBatchRejectConfirmOpen] = useState(false);
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
    merchandise_collected: true,
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
  const [isCollectingMerchId, setIsCollectingMerchId] = useState<string | null>(null);
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
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isBatchCheckingPayment, setIsBatchCheckingPayment] = useState(false);
  const [isBatchResendPaymentOpen, setIsBatchResendPaymentOpen] = useState(false);
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
                const attendeeCode = bevyAtt.attendee_code || reg.attendee_code || null;

                if (
                  reg.is_checked_in !== isCheckedIn ||
                  reg.bevy_attendee_id !== bevyId ||
                  (bevyAtt.attendee_code && reg.attendee_code !== bevyAtt.attendee_code)
                ) {
                  void updateRegistrationCheckInAction(reg.id, eventId, isCheckedIn, bevyId, checkinDate, attendeeCode);
                  return {
                    ...reg,
                    is_checked_in: isCheckedIn,
                    bevy_attendee_id: bevyId,
                    attendee_code: attendeeCode,
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

      // 2. Identify attendees who are approved (or paid & registered on paid events) on dashboard but NOT in Bevy
      const activeEvent = firestoreEventDoc ?? event;
      const isPaidEvent =
        Boolean(
          activeEvent?.tickets?.some(
            (t) => t.type === "paid" || t.type === "commitment_fee" || (t.price && t.price > 0),
          ),
        ) ||
        Boolean(activeEvent?.merchandise && activeEvent.merchandise.length > 0) ||
        Boolean(activeEvent?.bundles && activeEvent.bundles.length > 0) ||
        registrationsList.some(
          (r) => isPaidRegistration(r) || (r.status ?? "").toLowerCase().trim() === "paid_and_registered",
        );

      const isEligibleForBevySync = (reg: FirestoreRegistration) => {
        const status = (reg.status ?? "").toLowerCase().trim();
        if (status === "approved") return true;
        if (isPaidEvent && status === "paid_and_registered") return true;
        return false;
      };

      const missingApproved = registrationsList.filter((reg) => {
        if (!isEligibleForBevySync(reg)) return false;
        const email = (reg.member_email || "").toLowerCase().trim();
        return !email || !bevyEmailSet.has(email);
      });

      if (missingApproved.length === 0) {
        const totalApproved = registrationsList.filter(isEligibleForBevySync).length;
        const statusDesc = isPaidEvent ? "approved / paid & registered" : "approved";
        toast.success(
          `Bevy attendee sync complete. All ${totalApproved} ${statusDesc} attendee(s) are present in Bevy.`,
        );
        return;
      }

      // 3. Move missing paid attendees to "paid_waitlisted" and unpaid approved attendees to "pending"
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const syncTime = new Date().toISOString();
      const targetStatusById = new Map<string, RegistrationStatus>();
      let paidWaitlistedCount = 0;
      let pendingResetCount = 0;

      const updatePromises = missingApproved.map(async (reg) => {
        const isPaid = (reg.status ?? "").toLowerCase().trim() === "paid_and_registered" || isPaidRegistration(reg);
        const targetStatus: RegistrationStatus = isPaid ? "paid_waitlisted" : "pending";
        targetStatusById.set(reg.id, targetStatus);
        if (isPaid) {
          paidWaitlistedCount++;
        } else {
          pendingResetCount++;
        }

        const syncNote = isPaid
          ? "Synced with Bevy: Paid attendee not found in Bevy roster; moved to Paid Waitlisted."
          : "Synced with Bevy: Attendee not found in Bevy roster; reset to Pending Review.";

        await updateRegistrationStatusAction(reg.id, eventId, targetStatus, reviewerPayload, syncNote);
        if (reg.is_checked_in || reg.bevy_attendee_id) {
          await updateRegistrationCheckInAction(reg.id, eventId, false, null, null);
        }
      });

      await Promise.allSettled(updatePromises);

      // 4. Synchronize local registrations state
      setRegistrationsList((prev) =>
        prev.map((reg) => {
          const targetStatus = targetStatusById.get(reg.id);
          if (targetStatus) {
            const isPendingReset = targetStatus === "pending";
            return {
              ...reg,
              status: targetStatus,
              reviewed_at: isPendingReset ? undefined : syncTime,
              reviewed_by_id: isPendingReset ? undefined : (user?.id ?? reg.reviewed_by_id),
              reviewed_by_name: isPendingReset ? undefined : (user?.name ?? reg.reviewed_by_name),
              reviewed_by_email: isPendingReset ? undefined : (user?.email ?? reg.reviewed_by_email),
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
        if (prev) {
          const targetStatus = targetStatusById.get(prev.id);
          if (targetStatus) {
            const isPendingReset = targetStatus === "pending";
            return {
              ...prev,
              status: targetStatus,
              reviewed_at: isPendingReset ? undefined : syncTime,
              reviewed_by_id: isPendingReset ? undefined : (user?.id ?? prev.reviewed_by_id),
              reviewed_by_name: isPendingReset ? undefined : (user?.name ?? prev.reviewed_by_name),
              reviewed_by_email: isPendingReset ? undefined : (user?.email ?? prev.reviewed_by_email),
              is_checked_in: false,
              bevy_attendee_id: undefined,
              checkin_date: undefined,
              checked_in_at: undefined,
            };
          }
        }
        return prev;
      });

      const summaryParts: string[] = [];
      if (paidWaitlistedCount > 0) {
        summaryParts.push(`${paidWaitlistedCount} paid attendee(s) moved to Paid Waitlisted`);
      }
      if (pendingResetCount > 0) {
        summaryParts.push(`${pendingResetCount} unpaid attendee(s) reset to Pending Review`);
      }
      toast.success(`Synced Bevy attendee status: ${summaryParts.join(", ")}.`);
    } catch (err) {
      console.error("[RegistrantsTab] Error syncing Bevy attendee status:", err);
      toast.error("Failed to sync attendee status from Bevy.");
    } finally {
      setIsSyncingStatus(false);
    }
  }, [eventId, registrationsList, event, firestoreEventDoc, user]);

  useEffect(() => {
    if (eventId) {
      void syncBevyAttendees(false);
    }
  }, [eventId, syncBevyAttendees]);

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleSessionFilterChange = (val: string) => {
    setSessionFilter(val);
    setCurrentPage(1);
  };

  const handleTicketFilterChange = (val: string) => {
    setTicketFilter(val);
    setCurrentPage(1);
  };

  const handleBundleFilterChange = (val: string) => {
    setBundleFilter(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const searchTokens = useMemo(() => parseSearchTokens(search), [search]);

  const handleRemoveSearchToken = (indexToRemove: number) => {
    const updatedTokens = searchTokens.filter((_, idx) => idx !== indexToRemove);
    setSearch(updatedTokens.join("; "));
    setCurrentPage(1);
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

  // Compute email occurrences to detect duplicate registrant attempts
  const emailCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of registrationsList) {
      const email = (r.member_email || "").toLowerCase();
      if (email) {
        counts.set(email, (counts.get(email) || 0) + 1);
      }
    }
    return counts;
  }, [registrationsList]);

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

  const bundleFilterMeta = useMemo(() => {
    const bundleMap = new Map<string, { id: string; name: string; count: number }>();
    let hasBundleCount = 0;
    let noBundleCount = 0;

    if (currentEvent?.bundles) {
      for (const b of currentEvent.bundles) {
        if (b.name) {
          bundleMap.set(b.name, {
            id: b.id || b.name,
            name: b.name,
            count: 0,
          });
        }
      }
    }

    for (const r of registrationsList) {
      if (r.bundle_name || r.bundle_id) {
        hasBundleCount += 1;
        const key = r.bundle_name || r.bundle_id || "";
        const existing = bundleMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          bundleMap.set(key, {
            id: r.bundle_id || key,
            name: r.bundle_name || key,
            count: 1,
          });
        }
      } else {
        noBundleCount += 1;
      }
    }

    const bundles = Array.from(bundleMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      total: registrationsList.length,
      hasBundleCount,
      noBundleCount,
      bundles,
    };
  }, [currentEvent?.bundles, registrationsList]);

  const hasBundles = useMemo(() => {
    return Boolean(currentEvent?.bundles && currentEvent.bundles.length > 0) || bundleFilterMeta.hasBundleCount > 0;
  }, [currentEvent?.bundles, bundleFilterMeta.hasBundleCount]);
  const hasMerchandise = useMemo(() => {
    return (
      Boolean(event?.merchandise && event.merchandise.length > 0) ||
      registrationsList.some((r) => r.selected_merchandise && r.selected_merchandise.length > 0)
    );
  }, [event?.merchandise, registrationsList]);

  const merchandiseFilterOptions = useMemo(() => {
    return collectMerchandiseFilterOptions(registrationsList, event?.merchandise);
  }, [registrationsList, event?.merchandise]);

  const promoReferralFilterMeta = useMemo(() => {
    const voucherMap = new Map<string, number>();
    const referralMap = new Map<string, { count: number; referrerName?: string }>();
    let hasAnyCount = 0;
    let hasVoucherCount = 0;
    let hasReferralCount = 0;
    let noneCount = 0;

    if (currentEvent?.vouchers) {
      for (const v of currentEvent.vouchers) {
        const code = v.code?.trim().toUpperCase();
        if (code && !voucherMap.has(code)) {
          voucherMap.set(code, 0);
        }
      }
    }

    for (const reg of registrationsList) {
      const vCode = reg.voucher_code?.trim().toUpperCase() || "";
      const rCode = reg.referral_code?.trim().toUpperCase() || "";

      if (vCode) {
        hasVoucherCount += 1;
        voucherMap.set(vCode, (voucherMap.get(vCode) ?? 0) + 1);
      }
      if (rCode) {
        hasReferralCount += 1;
        const existing = referralMap.get(rCode);
        const refName = reg.referrer_name?.trim() || existing?.referrerName;
        referralMap.set(rCode, { count: (existing?.count ?? 0) + 1, referrerName: refName });
      }
      if (vCode || rCode) {
        hasAnyCount += 1;
      } else {
        noneCount += 1;
      }
    }

    const vouchers = Array.from(voucherMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    const referrals = Array.from(referralMap.entries())
      .map(([code, data]) => ({ code, count: data.count, referrerName: data.referrerName }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    return {
      total: registrationsList.length,
      hasAnyCount,
      hasVoucherCount,
      hasReferralCount,
      noneCount,
      vouchers,
      referrals,
    };
  }, [registrationsList, currentEvent?.vouchers]);

  const hasPromoOrReferral = useMemo(() => {
    return (
      Boolean(currentEvent?.vouchers && currentEvent.vouchers.length > 0) ||
      promoReferralFilterMeta.hasAnyCount > 0 ||
      hasTickets
    );
  }, [currentEvent?.vouchers, promoReferralFilterMeta.hasAnyCount, hasTickets]);

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
      ticket: hasTickets || hasBundles,
      merchandise: hasMerchandise,
      merchandise_collected: hasMerchandise,
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
    setQuestionFilters((prev) => ({
      ...prev,
      [qKey]: val,
    }));
    setCurrentPage(1);
  };

  const questionFilterOptionsByKey = useMemo(() => {
    const map = new Map<string, { label: string; options: Array<{ value: string; label: string }> }>();
    for (const qKey of selectedQuestionColumns) {
      const fieldInfo = availableQuestionFields.find((f) => f.key === qKey) || {
        key: qKey,
        label: formatQuestionLabel(qKey),
        responseCount: 0,
      };
      map.set(qKey, {
        label: fieldInfo.label,
        options: getQuestionFilterOptions(fieldInfo, registrationsList, questionLabelMap),
      });
    }
    return map;
  }, [selectedQuestionColumns, availableQuestionFields, registrationsList, questionLabelMap, formatQuestionLabel]);

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
    setReviewerFilter(val);
    setCurrentPage(1);
  };

  const handleMerchandiseFilterChange = (val: string) => {
    setMerchandiseFilter(val);
    if (val === "no_merchandise" || val === "all") {
      setMerchandiseVariantFilter("all");
    }
    setCurrentPage(1);
  };

  const handleMerchandiseVariantFilterChange = (val: string) => {
    setMerchandiseVariantFilter(val);
    setCurrentPage(1);
  };

  const handleMerchandiseStatsFilter = useCallback((merchandise: string, variant?: string) => {
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
    setCurrentPage(1);
  }, []);

  const handlePromoReferralFilterChange = useCallback((val: string) => {
    setPromoReferralFilter(val);
    setCurrentPage(1);
  }, []);

  const handleResetAllFilters = () => {
    setStatusFilter("all");
    setSessionFilter("all");
    setTicketFilter("all");
    setBundleFilter("all");
    setPromoReferralFilter("all");
    setMerchandiseFilter("all");
    setMerchandiseVariantFilter("all");
    setReviewerFilter("all");
    setSearch("");
    setQuestionFilters({});
    setCurrentPage(1);
  };

  // Filter logic (all non-status filters first so status counters reflect active filters)
  const preStatusFiltered = useMemo(() => {
    const tokensLower = searchTokens.map((t) => t.toLowerCase());

    return registrationsList.filter((reg) => {
      const emailLower = (reg.member_email || "").toLowerCase().trim();
      const bevyAtt = bevyAttendeesMap.get(emailLower);
      const matchesSearch =
        tokensLower.length === 0 ||
        tokensLower.some((tokenLower) => matchesRegistrationToken(reg, tokenLower, bevyAtt));

      const matchesSession =
        sessionFilter === "all" ||
        reg.session_id === sessionFilter ||
        (reg.answers?.session_id as string) === sessionFilter;

      const matchesTicket =
        ticketFilter === "all" ||
        reg.ticket_id === ticketFilter ||
        reg.ticket_name === ticketFilter ||
        reg.ticket_type === ticketFilter;

      let matchesBundle = true;
      if (bundleFilter !== "all") {
        const hasBundle = Boolean(reg.bundle_id || reg.bundle_name);
        if (bundleFilter === "has_bundle") {
          matchesBundle = hasBundle;
        } else if (bundleFilter === "no_bundle") {
          matchesBundle = !hasBundle;
        } else {
          const targetLower = bundleFilter.toLowerCase().trim();
          matchesBundle =
            (reg.bundle_name || "").toLowerCase().trim() === targetLower ||
            (reg.bundle_id || "").toLowerCase().trim() === targetLower;
        }
      }

      const matchesReviewer =
        reviewerFilter === "all" ||
        (reviewerFilter === "unreviewed" ? !reg.reviewed_by_name : reg.reviewed_by_name === reviewerFilter);

      let matchesPromoReferral = true;
      if (promoReferralFilter !== "all") {
        const vCode = (reg.voucher_code || "").trim().toUpperCase();
        const rCode = (reg.referral_code || "").trim().toUpperCase();
        if (promoReferralFilter === "has_any") {
          matchesPromoReferral = Boolean(vCode || rCode);
        } else if (promoReferralFilter === "has_voucher") {
          matchesPromoReferral = Boolean(vCode);
        } else if (promoReferralFilter === "has_referral") {
          matchesPromoReferral = Boolean(rCode);
        } else if (promoReferralFilter === "none") {
          matchesPromoReferral = !vCode && !rCode;
        } else if (promoReferralFilter.startsWith("voucher:")) {
          const targetCode = promoReferralFilter.slice("voucher:".length).trim().toUpperCase();
          matchesPromoReferral = vCode === targetCode;
        } else if (promoReferralFilter.startsWith("referral:")) {
          const targetCode = promoReferralFilter.slice("referral:".length).trim().toUpperCase();
          matchesPromoReferral = rCode === targetCode;
        }
      }

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
        !matchesSession ||
        !matchesTicket ||
        !matchesBundle ||
        !matchesReviewer ||
        !matchesPromoReferral ||
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
    sessionFilter,
    ticketFilter,
    bundleFilter,
    promoReferralFilter,
    merchandiseFilter,
    merchandiseVariantFilter,
    reviewerFilter,
    selectedQuestionColumns,
    questionFilters,
    questionLabelMap,
    bevyAttendeesMap,
  ]);

  // Status Counters for Filters & Badges (reflects active non-status filters)
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

    for (const reg of preStatusFiltered) {
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

      if (s === "approved" || s === "attended" || s === "confirmed" || s === "registered") {
        approved++;
      }

      const isConfirmed =
        s === "approved" || s === "paid_and_registered" || s === "attended" || s === "confirmed" || s === "registered";
      if (isConfirmed) {
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
      all: preStatusFiltered.length,
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
  }, [preStatusFiltered, currentEvent]);

  const filtered = useMemo(() => {
    const filterStatus = (statusFilter ?? "all").toLowerCase().trim();
    if (filterStatus === "all") return preStatusFiltered;

    return preStatusFiltered.filter((reg) => {
      const effectiveStatus = getEffectiveRegistrationStatus(reg, currentEvent);
      const regStatus = (effectiveStatus ?? "").toLowerCase().trim();

      if (filterStatus === "not_checked_in") {
        const isApproved =
          regStatus === "approved" ||
          regStatus === "paid_and_registered" ||
          regStatus === "attended" ||
          regStatus === "confirmed" ||
          regStatus === "registered";
        const isCheckedIn = Boolean(reg.is_checked_in) || regStatus === "attended";
        return isApproved && !isCheckedIn;
      }
      if (filterStatus === "checked_in") {
        return Boolean(reg.is_checked_in) || regStatus === "attended";
      }
      if (filterStatus === "registered_attendees") {
        return (
          regStatus === "approved" ||
          regStatus === "paid_and_registered" ||
          regStatus === "attended" ||
          regStatus === "confirmed" ||
          regStatus === "registered"
        );
      }
      if (filterStatus === "approved") {
        return (
          regStatus === "approved" ||
          regStatus === "attended" ||
          regStatus === "confirmed" ||
          regStatus === "registered"
        );
      }
      if (filterStatus === "paid_and_registered") {
        return (
          regStatus === "paid_and_registered" ||
          ((regStatus === "approved" || regStatus === "registered" || regStatus === "attended") &&
            (isPaidRegistration(reg) || reg.payment_status === "paid"))
        );
      }
      if (filterStatus === "waiting_for_payment") {
        return regStatus === "waiting_for_payment";
      }
      if (filterStatus === "expired") {
        return regStatus === "expired";
      }
      if (filterStatus === "failed") {
        return regStatus === "failed" || reg.payment_status === "failed";
      }
      if (filterStatus === "canceled") {
        return regStatus === "canceled" || regStatus === "cancelled";
      }
      if (filterStatus === "pending") {
        return regStatus === "pending" || regStatus === "applied" || regStatus === "review";
      }
      return regStatus === filterStatus;
    });
  }, [preStatusFiltered, statusFilter, currentEvent]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageNumbers = useMemo(() => getPageNumbers(safeCurrentPage, pageCount), [safeCurrentPage, pageCount]);
  const paginatedFiltered = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

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
      setRejectConfirmRegistration(targetReg);
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
      const isAlreadyPaid =
        registration.status === "paid_waitlisted" ||
        registration.status === "paid_and_registered" ||
        (registration.payment_status ?? "").toLowerCase().trim() === "paid" ||
        Boolean(registration.paid_at);
      const requiresPayment =
        !isAlreadyPaid &&
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
          const isAttendeeCovering =
            registration.payment_fee_voluntary_covered !== undefined
              ? registration.payment_fee_voluntary_covered
              : registration.payment_fee_bearer !== "organizer" && currentEvent.payment_fee_bearer !== "organizer";
          const effectiveFeeAmount = isAttendeeCovering ? feeResult.feeAmount : 0;

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
              payment_fee_amount: effectiveFeeAmount,
              payment_fee_bearer: isAttendeeCovering ? "attendee" : "organizer",
              payment_fee_voluntary_covered: registration.payment_fee_voluntary_covered ?? isAttendeeCovering,
              payment_environment:
                currentEvent.payment_environment ?? (currentEvent.is_test ? "sandbox" : "production"),
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

      // If event ticket is free (no merchandise to sell) or attendee already paid (Paid Waitlisted):
      // Call Add Bevy Attendee API -> Attendee Status Approved / Paid & Registered
      const payload = buildApprovedAttendeePayload(registration, currentEvent);
      const res = await approveAttendeeWebhookAction(payload);

      if (!res.success) {
        console.error("[RegistrantsTab] Approved attendee webhook error:", res.error, res.details);
        toast.error(res.error ?? "Approval webhook returned status false.", {
          description: typeof res.details === "string" ? res.details : undefined,
        });
        return;
      }

      const finalStatus: RegistrationStatus = isAlreadyPaid ? "paid_and_registered" : "approved";
      const approvalNote = isAlreadyPaid
        ? "Approved from Paid Waitlist by organizer and registered on Bevy."
        : undefined;

      // Success: persist status to Firestore and update local state
      await updateRegistrationStatusAction(registration.id, eventId, finalStatus, reviewerPayload, approvalNote);

      setRegistrationsList((prev) =>
        prev.map((r) =>
          r.id === registration.id
            ? {
                ...r,
                status: finalStatus,
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
              status: finalStatus,
              reviewed_at: now,
              reviewed_by_id: user?.id ?? prev.reviewed_by_id,
              reviewed_by_name: user?.name ?? prev.reviewed_by_name,
              reviewed_by_email: user?.email ?? prev.reviewed_by_email,
            }
          : prev,
      );

      toast.success(
        isAlreadyPaid
          ? `${registration.member_name} approved and moved to Paid & Registered!`
          : `${registration.member_name} approved successfully!`,
      );
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
    if (registration.status === "approved" || registration.status === "paid_and_registered") {
      toast.error("This attendee is already approved. Their status cannot be changed except by removal.");
      return;
    }

    setRejectingRegistrationId(registration.id);
    try {
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const isPaid =
        registration.status === "paid_waitlisted" ||
        (registration.payment_status ?? "").toLowerCase().trim() === "paid" ||
        Boolean(registration.paid_at);
      const paidAmountNum = registration.payment_amount ?? registration.ticket_price ?? registration.bundle_price ?? 0;
      const sessionName =
        registration.session_title ??
        (registration.answers?.session_title as string | undefined) ??
        currentEvent.sessions?.find((s) => s.id === registration.session_id)?.title;

      const res = await rejectAttendeeAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        reviewer: reviewerPayload,
        eventData: currentEvent,
        previousStatus: registration.status,
        isPaid,
        invoiceNumber: registration.payment_invoice_number,
        paidAmount: paidAmountNum > 0 ? formatRupiah(paidAmountNum) : undefined,
        sessionName,
      });

      if (!res.success) {
        console.error("[RegistrantsTab] Reject attendee error:", res.error, res.details);
        toast.error(res.error ?? "Failed to reject applicant.", {
          description: typeof res.details === "string" ? res.details : undefined,
        });
        return;
      }

      let rejectNote: string | undefined;
      if (isPaid) {
        rejectNote = "Rejected from Paid Waitlist by organizer. Attendee remains eligible to submit a refund request.";
      } else if (registration.status === "waitlisted") {
        rejectNote = "Rejected from Waitlist by organizer.";
      }

      // Persist status update in Firestore (client-side)
      await updateRegistrationStatusAction(registration.id, eventId, "rejected", reviewerPayload, rejectNote);

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
      setRejectConfirmRegistration(null);
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
    const effectiveStatus = getEffectiveRegistrationStatus(registration, currentEvent);
    const rawStatus = ((effectiveStatus as string) || "").toLowerCase().trim();
    const regStatus = ((registration.status as string) || "").toLowerCase().trim();
    const canCheckIn =
      ["paid_and_registered", "paid_registered", "approved", "registered"].includes(rawStatus) ||
      ["paid_and_registered", "paid_registered", "approved", "registered"].includes(regStatus);

    if (isCheckedIn && !canCheckIn) {
      toast.error("Check-in is only enabled for attendees with Paid & Registered, Approved, or Registered status.");
      return;
    }

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

  const handleToggleMerchandiseCollected = async (registration: FirestoreRegistration, isCollected: boolean) => {
    const hasAttendeeMerch = Boolean(registration.selected_merchandise && registration.selected_merchandise.length > 0);
    const effectiveStatus = getEffectiveRegistrationStatus(registration, currentEvent);
    const rawStatus = ((effectiveStatus as string) || "").toLowerCase().trim();
    const regStatus = ((registration.status as string) || "").toLowerCase().trim();
    const isPaidAndRegistered =
      rawStatus === "paid_and_registered" ||
      rawStatus === "paid_registered" ||
      regStatus === "paid_and_registered" ||
      regStatus === "paid_registered";

    if (!hasAttendeeMerch || !isPaidAndRegistered) {
      toast.error(
        "Merchandise collection is only enabled when the attendee has merchandise and status is Paid & Registered.",
      );
      return;
    }

    setIsCollectingMerchId(registration.id);
    try {
      const reviewerPayload = user
        ? { id: user.id, name: user.name, email: user.email }
        : { id: "system_organizer", name: "GDG Organizer" };

      const res = await updateRegistrationMerchandiseCollectionAction(
        registration.id,
        eventId,
        isCollected,
        reviewerPayload,
      );

      if (!res.success) {
        toast.error(res.error ?? "Failed to update merchandise collection status.");
        return;
      }

      const now = res.collectedAt ?? new Date().toISOString();
      const newStatusLog: RegistrationStatusLog = res.statusLog ?? {
        id: `merch_${Date.now()}`,
        status: isCollected ? "merchandise_collected" : "merchandise_uncollected",
        previous_status: registration.is_merchandise_collected ? "merchandise_collected" : "merchandise_uncollected",
        changed_at: now,
        changed_by_id: reviewerPayload.id,
        changed_by_name: reviewerPayload.name,
        changed_by_email: reviewerPayload.email,
        notes: isCollected
          ? `Merchandise marked as collected by ${reviewerPayload.name}.`
          : `Merchandise collection reverted to not collected by ${reviewerPayload.name}.`,
      };

      const updateFields = (r: FirestoreRegistration): FirestoreRegistration => ({
        ...r,
        is_merchandise_collected: isCollected,
        merchandise_collected_at: isCollected ? now : null,
        merchandise_collected_by_id: isCollected ? reviewerPayload.id : null,
        merchandise_collected_by_name: isCollected ? reviewerPayload.name : null,
        merchandise_collected_by_email: isCollected ? (reviewerPayload.email ?? null) : null,
        status_logs: [...(r.status_logs ?? []), newStatusLog],
      });

      setRegistrationsList((prev) => prev.map((r) => (r.id === registration.id ? updateFields(r) : r)));
      setInspectRegistration((prev) => (prev?.id === registration.id ? updateFields(prev) : prev));

      toast.success(
        isCollected
          ? `Marked merchandise as collected for ${registration.member_name}`
          : `Merchandise collection undone for ${registration.member_name}`,
      );
    } catch (err) {
      console.error("[handleToggleMerchandiseCollected] error:", err);
      toast.error("Failed to update merchandise collection status.");
    } finally {
      setIsCollectingMerchId(null);
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

  const selectedForRegeneratePayment = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => registrationsList.find((reg) => reg.id === id))
      .filter((r): r is FirestoreRegistration => {
        if (!r) return false;
        const status = getEffectiveRegistrationStatus(r, currentEvent);
        return (status === "waiting_for_payment" || status === "expired") && hasRegistrationPaymentRequirements(r);
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
        const isAlreadyPaid =
          reg.status === "paid_waitlisted" ||
          reg.status === "paid_and_registered" ||
          (reg.payment_status ?? "").toLowerCase().trim() === "paid" ||
          Boolean(reg.paid_at);
        const requiresPayment =
          !isAlreadyPaid &&
          hasRegistrationPaymentRequirements(reg) &&
          calculateRegistrationTotalAmount(reg, currentEvent) > 0;
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
            const isAttendeeCovering =
              reg.payment_fee_voluntary_covered !== undefined
                ? reg.payment_fee_voluntary_covered
                : reg.payment_fee_bearer !== "organizer" && currentEvent.payment_fee_bearer !== "organizer";
            const effectiveFeeAmount = isAttendeeCovering ? feeResult.feeAmount : 0;

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
                payment_fee_amount: effectiveFeeAmount,
                payment_fee_bearer: isAttendeeCovering ? "attendee" : "organizer",
                payment_fee_voluntary_covered: reg.payment_fee_voluntary_covered ?? isAttendeeCovering,
                payment_environment:
                  currentEvent.payment_environment ?? (currentEvent.is_test ? "sandbox" : "production"),
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
            const finalStatus: RegistrationStatus = isAlreadyPaid ? "paid_and_registered" : "approved";
            const approvalNote = isAlreadyPaid
              ? "Batch approved from Paid Waitlist and registered on Bevy."
              : undefined;
            await updateRegistrationStatusAction(reg.id, eventId, finalStatus, reviewerPayload, approvalNote);
            successCount++;
            setRegistrationsList((prev) =>
              prev.map((r) =>
                r.id === reg.id
                  ? {
                      ...r,
                      status: finalStatus,
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
      (r) =>
        selectedIds.has(r.id) &&
        r.status !== "approved" &&
        r.status !== "paid_and_registered" &&
        r.status !== "rejected",
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
        const isPaid =
          reg.status === "paid_waitlisted" ||
          reg.status === "paid_and_registered" ||
          (reg.payment_status ?? "").toLowerCase().trim() === "paid" ||
          Boolean(reg.paid_at);
        const paidAmountNum = reg.payment_amount ?? reg.ticket_price ?? reg.bundle_price ?? 0;
        const sessionName =
          reg.session_title ??
          (reg.answers?.session_title as string | undefined) ??
          currentEvent.sessions?.find((s) => s.id === reg.session_id)?.title;

        const res = await rejectAttendeeAction({
          registrationId: reg.id,
          eventId,
          attendeeName: reg.member_name,
          attendeeEmail: reg.member_email,
          reviewer: reviewerPayload,
          eventData: currentEvent,
          previousStatus: reg.status,
          isPaid,
          invoiceNumber: reg.payment_invoice_number,
          paidAmount: paidAmountNum > 0 ? formatRupiah(paidAmountNum) : undefined,
          sessionName,
        });

        if (res.success) {
          let rejectNote: string | undefined;
          if (isPaid) {
            rejectNote =
              "Batch rejected from Paid Waitlist by organizer. Attendee remains eligible to submit a refund request.";
          } else if (reg.status === "waitlisted") {
            rejectNote = "Batch rejected from Waitlist by organizer.";
          }
          await updateRegistrationStatusAction(reg.id, eventId, "rejected", reviewerPayload, rejectNote);
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
      setIsBatchRejectConfirmOpen(false);
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
      const toReject = registrationsList.filter(
        (r) => selectedIds.has(r.id) && r.status !== "approved" && r.status !== "rejected",
      );
      if (toReject.length === 0) {
        toast.info("All selected attendees are already approved or rejected.");
        return;
      }
      setIsBatchRejectConfirmOpen(true);
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

  const handleDeleteRegistration = async (registration: FirestoreRegistration) => {
    const email = (registration.member_email || "").toLowerCase().trim();
    const matchedBevyAttendeeId =
      registration.bevy_attendee_id ?? (email ? bevyAttendeesMap.get(email)?.id : undefined);

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
      setDeleteConfirmRegistration(null);
    }
  };

  const handleBatchDelete = async () => {
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

    setIsDeleting(true);
    // Optimistic removal
    setRegistrationsList((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    if (inspectRegistration && selectedIds.has(inspectRegistration.id)) {
      setInspectRegistration(null);
    }

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
      setIsBatchDeleteConfirmOpen(false);
    }
  };

  const handleCancelRegistration = async (registration: FirestoreRegistration) => {
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    const email = (registration.member_email || "").toLowerCase().trim();
    const matchedBevyAttendeeId =
      registration.bevy_attendee_id ?? (email ? bevyAttendeesMap.get(email)?.id : undefined);

    setIsCancelling(true);
    try {
      // 1. Dispatch cancellation email to attendee
      const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
      const emailRes = await sendCancelAttendeeEmailAction({
        registrationId: registration.id,
        eventId,
        attendeeName: registration.member_name,
        attendeeEmail: registration.member_email,
        cancellationReason: trimmedReason,
        reviewer: reviewerPayload,
        eventData: currentEvent,
      });

      if (!emailRes.success) {
        toast.error(emailRes.error ?? "Failed to send cancellation email. Registration not removed.", {
          description: typeof emailRes.details === "string" ? emailRes.details : undefined,
        });
        return;
      }

      // 2. Remove registration from Firestore and Bevy
      const deleteRes = await deleteEventRegistrationAction(
        registration.id,
        eventId,
        matchedBevyAttendeeId,
        email,
        registration,
        { cancellationReason: trimmedReason },
      );
      if (!deleteRes.success) {
        toast.error(deleteRes.error ?? "Cancellation email sent, but failed to remove registration from database.");
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

      toast.success(`Registration cancelled for ${registration.member_name}. Notification sent and capacity released.`);
    } catch (err) {
      console.error("[handleCancelRegistration] error:", err);
      toast.error("Failed to cancel attendee registration.");
    } finally {
      setIsCancelling(false);
      setCancelConfirmRegistration(null);
      setCancelReason("");
    }
  };

  const handleBatchCancel = async () => {
    if (selectedIds.size === 0) return;
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    const regsToCancel = registrationsList.filter((r) => selectedIds.has(r.id));

    setIsCancelling(true);
    try {
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
            cancellationReason: trimmedReason,
            reviewer: reviewerPayload,
            eventData: currentEvent,
          });

          if (!emailRes.success) {
            console.warn(`[handleBatchCancel] Failed to email ${reg.member_email}:`, emailRes.error);
            failCount++;
            continue;
          }

          // 2. Delete registration
          const deleteRes = await deleteEventRegistrationAction(reg.id, eventId, matchedBevyAttendeeId, email, reg, {
            cancellationReason: trimmedReason,
          });
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

      if (successCount > 0 && failCount === 0) {
        toast.success(`Cancelled ${successCount} registration${successCount === 1 ? "" : "s"} and sent notifications.`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`Cancelled ${successCount} registration(s); ${failCount} failed to process.`);
      } else {
        toast.error("Failed to cancel selected registrations.");
      }
    } finally {
      setIsCancelling(false);
      setIsBatchCancelConfirmOpen(false);
      setCancelReason("");
    }
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
      ...(hasTickets || hasBundles
        ? ["Ticket Pass", "Ticket Type", "Ticket Price", "Bundle Package", "Bundle Price"]
        : []),
      ...(hasMerchandise
        ? ["Merchandise Orders", "Merchandise Collected", "Merchandise Collected By", "Merchandise Collected At"]
        : []),
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
        ...(hasTickets || hasBundles
          ? [
              `"${(r.ticket_name || "General RSVP").replace(/"/g, '""')}"`,
              `"${(r.ticket_type || "free").replace(/"/g, '""')}"`,
              `"${r.ticket_price || 0}"`,
              `"${(r.bundle_name || "").replace(/"/g, '""')}"`,
              `"${r.bundle_price || 0}"`,
            ]
          : []),
        ...(hasMerchandise
          ? [
              `"${merchText.replace(/"/g, '""')}"`,
              `"${r.is_merchandise_collected ? "Collected" : r.selected_merchandise && r.selected_merchandise.length > 0 ? "Not Collected" : "N/A"}"`,
              `"${(r.merchandise_collected_by_name || "").replace(/"/g, '""')}"`,
              `"${formatFirestoreDate(r.merchandise_collected_at ?? undefined, "yyyy-MM-dd HH:mm:ss", "").replace(/"/g, '""')}"`,
            ]
          : []),
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
    if ((hasTickets || hasBundles) && visibleStandardColumns.ticket !== false) count += 1;
    if (hasMerchandise && visibleStandardColumns.merchandise !== false) count += 1;
    if (hasMerchandise && visibleStandardColumns.merchandise_collected !== false) count += 1;
    if (hasSessions && visibleStandardColumns.session !== false) count += 1;
    if (visibleStandardColumns.checkin !== false) count += 1;
    count += selectedQuestionColumns.length;
    if (visibleStandardColumns.all_responses !== false) count += 1;
    if (visibleStandardColumns.registered_at !== false) count += 1;
    if (visibleStandardColumns.actions !== false) count += 1;
    return count;
  }, [
    visibleStandardColumns,
    hasSessions,
    hasTickets,
    hasBundles,
    hasMerchandise,
    selectedQuestionColumns.length,
    isCurationMode,
  ]);

  const activeQuestionFilterCount = useMemo(() => {
    return Object.values(questionFilters).filter((v) => Boolean(v) && v !== "all").length;
  }, [questionFilters]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter !== "all" ||
      sessionFilter !== "all" ||
      ticketFilter !== "all" ||
      bundleFilter !== "all" ||
      promoReferralFilter !== "all" ||
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
        onSelectPromoReferralFilter={handlePromoReferralFilterChange}
        onSelectBundleFilter={handleBundleFilterChange}
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

                {selectedForRegeneratePayment.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                    onClick={() => setIsBatchResendPaymentOpen(true)}
                    disabled={
                      isPending ||
                      isDeleting ||
                      isCancelling ||
                      isBatchApproving ||
                      isBatchRejecting ||
                      isBatchCheckingPayment
                    }
                    title="Regenerate payment link with new deadline for selected waiting or expired attendees"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Regenerate Payment ({selectedForRegeneratePayment.length})</span>
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
                  placeholder="Search name, email, ticket code, details... (';' to multi-filter)"
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
                  <FilterSelect
                    value={statusFilter}
                    onValueChange={handleStatusFilterChange}
                    prefix="Status:"
                    options={[
                      { value: "all", label: `All Statuses (${isLoading ? "..." : statusCounts.all})` },
                      ...(isCurationMode
                        ? [{ value: "pending", label: `Pending Review (${isLoading ? "..." : statusCounts.pending})` }]
                        : []),
                      {
                        value: "waiting_for_payment",
                        label: `Waiting for Payment (${isLoading ? "..." : statusCounts.waiting_for_payment})`,
                      },
                      {
                        value: "paid_and_registered",
                        label: `Paid & Registered (${isLoading ? "..." : statusCounts.paid_and_registered})`,
                      },
                      {
                        value: "paid_waitlisted",
                        label: `Paid Waitlist (${isLoading ? "..." : statusCounts.paid_waitlisted})`,
                      },
                      { value: "expired", label: `Expired (${isLoading ? "..." : statusCounts.expired})` },
                      { value: "failed", label: `Failed (${isLoading ? "..." : statusCounts.failed})` },
                      { value: "canceled", label: `Canceled (${isLoading ? "..." : statusCounts.canceled})` },
                      ...(isCurationMode
                        ? [{ value: "approved", label: `Approved (${isLoading ? "..." : statusCounts.approved})` }]
                        : []),
                      { value: "checked_in", label: `Checked In (${isLoading ? "..." : statusCounts.checked_in})` },
                      {
                        value: "not_checked_in",
                        label: `Not Checked In (Drop) (${isLoading ? "..." : statusCounts.not_checked_in})`,
                      },
                      ...(isCurationMode
                        ? [
                            {
                              value: "waitlisted",
                              label: `Waitlisted (${isLoading ? "..." : statusCounts.waitlisted})`,
                            },
                            { value: "rejected", label: `Rejected (${isLoading ? "..." : statusCounts.rejected})` },
                          ]
                        : []),
                    ]}
                  />
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
                  <FilterSelect
                    value={sessionFilter}
                    onValueChange={handleSessionFilterChange}
                    prefix="Session:"
                    options={[
                      { value: "all", label: `All Sessions (${registrationsList.length})` },
                      ...sessions.map((s) => ({ value: s.id, label: s.title })),
                    ]}
                  />
                )}

                {hasTickets && (
                  <FilterSelect
                    value={ticketFilter}
                    onValueChange={handleTicketFilterChange}
                    icon={<Ticket className="size-3 shrink-0 text-muted-foreground" />}
                    prefix="Ticket:"
                    options={[
                      { value: "all", label: "All Ticket Passes" },
                      ...availableTickets.map((t) => ({ value: t.name, label: t.name })),
                    ]}
                  />
                )}

                {hasBundles && (
                  <FilterSelect
                    value={bundleFilter}
                    onValueChange={handleBundleFilterChange}
                    icon={<PackageCheck className="size-3 shrink-0 text-muted-foreground" />}
                    prefix="Bundle:"
                    options={[
                      { value: "all", label: `All Bundles (${bundleFilterMeta.total})` },
                      {
                        value: "has_bundle",
                        label: `Has Bundle (${bundleFilterMeta.hasBundleCount})`,
                      },
                      {
                        value: "no_bundle",
                        label: `No Bundle (${bundleFilterMeta.noBundleCount})`,
                      },
                      ...(bundleFilterMeta.bundles.length > 0
                        ? [
                            { value: "__bundles_header__", label: "By Bundle Package", isHeader: true },
                            ...bundleFilterMeta.bundles.map((b) => ({
                              value: b.name,
                              label: `${b.name} (${b.count})`,
                            })),
                          ]
                        : []),
                    ]}
                  />
                )}

                {hasPromoOrReferral && (
                  <FilterSelect
                    value={promoReferralFilter}
                    onValueChange={handlePromoReferralFilterChange}
                    icon={<Tag className="size-3 shrink-0 text-muted-foreground" />}
                    prefix="Promo / Referral:"
                    options={[
                      { value: "all", label: `All Promo / Referral (${promoReferralFilterMeta.total})` },
                      {
                        value: "has_any",
                        label: `Has Voucher or Referral (${promoReferralFilterMeta.hasAnyCount})`,
                      },
                      { value: "has_voucher", label: `Has Voucher (${promoReferralFilterMeta.hasVoucherCount})` },
                      { value: "has_referral", label: `Has Referral (${promoReferralFilterMeta.hasReferralCount})` },
                      { value: "none", label: `No Voucher / Referral (${promoReferralFilterMeta.noneCount})` },
                      ...(promoReferralFilterMeta.vouchers.length > 0
                        ? [
                            { value: "__voucher_header__", label: "By Voucher Code", isHeader: true },
                            ...promoReferralFilterMeta.vouchers.map((v) => ({
                              value: `voucher:${v.code}`,
                              label: `${v.code} (${v.count})`,
                            })),
                          ]
                        : []),
                      ...(promoReferralFilterMeta.referrals.length > 0
                        ? [
                            { value: "__referral_header__", label: "By Referral Code", isHeader: true },
                            ...promoReferralFilterMeta.referrals.map((r) => ({
                              value: `referral:${r.code}`,
                              label: `${r.referrerName ? `${r.code} · ${r.referrerName}` : r.code} (${r.count})`,
                            })),
                          ]
                        : []),
                    ]}
                  />
                )}

                {hasMerchandise && (
                  <>
                    <FilterSelect
                      value={merchandiseFilter}
                      onValueChange={handleMerchandiseFilterChange}
                      icon={<Package className="size-3 shrink-0 text-muted-foreground" />}
                      prefix="Merchandise:"
                      options={[
                        {
                          value: "all",
                          label: `All Merchandise (${merchandiseFilterOptions.totalWithMerch + merchandiseFilterOptions.totalWithoutMerch})`,
                        },
                        {
                          value: "has_merchandise",
                          label: `Has Merchandise (${merchandiseFilterOptions.totalWithMerch})`,
                        },
                        {
                          value: "no_merchandise",
                          label: `No Merchandise (${merchandiseFilterOptions.totalWithoutMerch})`,
                        },
                        ...(merchandiseFilterOptions.items.length > 0
                          ? [
                              { value: "__items_header__", label: "By Product Item", isHeader: true },
                              ...merchandiseFilterOptions.items.map((item) => ({
                                value: item.name,
                                label: `${item.name} (${item.count})`,
                              })),
                            ]
                          : []),
                      ]}
                    />

                    {(merchandiseFilterOptions.sizes.length > 0 || merchandiseFilterOptions.variants.length > 0) && (
                      <FilterSelect
                        value={merchandiseVariantFilter}
                        onValueChange={handleMerchandiseVariantFilterChange}
                        icon={<Layers className="size-3 shrink-0 text-muted-foreground" />}
                        prefix="Variant / Size:"
                        options={[
                          { value: "all", label: "All Variants & Sizes" },
                          ...(merchandiseFilterOptions.sizes.length > 0
                            ? [
                                { value: "__size_header__", label: "Sizes", isHeader: true },
                                ...merchandiseFilterOptions.sizes.map((s) => ({
                                  value: s.value,
                                  label: `${s.label} (${s.count})`,
                                })),
                              ]
                            : []),
                          ...(merchandiseFilterOptions.variants.length > 0
                            ? [
                                { value: "__variant_header__", label: "Other Variations", isHeader: true },
                                ...merchandiseFilterOptions.variants.map((v) => ({
                                  value: v.value,
                                  label: `${v.label} (${v.count})`,
                                })),
                              ]
                            : []),
                        ]}
                      />
                    )}
                  </>
                )}

                {isCurationMode && availableReviewers.length > 0 && (
                  <FilterSelect
                    value={reviewerFilter}
                    onValueChange={handleReviewerFilterChange}
                    icon={<UserCheck className="size-3 shrink-0 text-muted-foreground" />}
                    prefix="Reviewer:"
                    options={[
                      { value: "all", label: `All Reviewers (${availableReviewers.length})` },
                      { value: "unreviewed", label: "Not Reviewed Yet" },
                      ...availableReviewers.map((name) => ({ value: name, label: name })),
                    ]}
                  />
                )}

                {/* Dynamic Question Field Filters */}
                {selectedQuestionColumns.map((qKey) => {
                  const meta = questionFilterOptionsByKey.get(qKey);
                  if (!meta || meta.options.length === 0) return null;
                  const { label: qLabel, options } = meta;

                  const currentVal = questionFilters[qKey] || "all";

                  return (
                    <FilterSelect
                      key={qKey}
                      value={currentVal}
                      onValueChange={(val) => handleQuestionFilterChange(qKey, val)}
                      icon={<Filter className="size-3 shrink-0 text-muted-foreground" />}
                      prefix={`${qLabel}:`}
                      className="max-w-[220px]"
                      options={[{ value: "all", label: `All ${qLabel}` }, ...options]}
                    />
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
                  hasTickets={hasTickets || hasBundles}
                  hasMerchandise={hasMerchandise}
                  isCurationMode={isCurationMode}
                  onResetDefaults={handleResetColumnDefaults}
                />

                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setIsQrScannerOpen(true)}
                  className="h-8 gap-1.5 text-xs"
                  title="Open Multi-Mode Bevy QR Scanner for Event Check-in, Breakout Session Check-in, or Merchandise Collection"
                >
                  <QrCode className="size-3.5" />
                  <span>QR Scanner</span>
                </Button>

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
                        : statusFilter === "registered_attendees"
                          ? "Total Registered Attendee"
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
              {bundleFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <PackageCheck className="size-3 text-primary" />
                  <span>
                    Bundle:{" "}
                    {bundleFilter === "has_bundle"
                      ? "Has Bundle"
                      : bundleFilter === "no_bundle"
                        ? "No Bundle"
                        : bundleFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleBundleFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear bundle filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {promoReferralFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <Tag className="size-3 text-primary" />
                  <span>
                    Promo / Referral:{" "}
                    {promoReferralFilter === "has_any"
                      ? "Has Voucher or Referral"
                      : promoReferralFilter === "has_voucher"
                        ? "Has Voucher"
                        : promoReferralFilter === "has_referral"
                          ? "Has Referral"
                          : promoReferralFilter === "none"
                            ? "No Voucher / Referral"
                            : promoReferralFilter.startsWith("voucher:")
                              ? `Voucher ${promoReferralFilter.slice("voucher:".length)}`
                              : promoReferralFilter.startsWith("referral:")
                                ? `Referral ${promoReferralFilter.slice("referral:".length)}`
                                : promoReferralFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePromoReferralFilterChange("all")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear promo or referral filter"
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
                  {(hasTickets || hasBundles) && visibleStandardColumns.ticket !== false && (
                    <TableHead>Ticket Pass</TableHead>
                  )}
                  {hasMerchandise && visibleStandardColumns.merchandise !== false && <TableHead>Merchandise</TableHead>}
                  {hasMerchandise && visibleStandardColumns.merchandise_collected !== false && (
                    <TableHead>Collected</TableHead>
                  )}
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
                {isLoading && (
                  <RegistrantsTableSkeleton
                    hasSessions={hasSessions}
                    hasTickets={hasTickets || hasBundles}
                    hasMerchandise={hasMerchandise}
                    visibleStandardColumns={visibleStandardColumns}
                    questionColumnCount={selectedQuestionColumns.length}
                    isCurationMode={isCurationMode}
                  />
                )}

                {!isLoading && filtered.length === 0 && (
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
                  paginatedFiltered.map((reg) => {
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

                        {(hasTickets || hasBundles) && visibleStandardColumns.ticket !== false && (
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

                        {hasMerchandise && visibleStandardColumns.merchandise_collected !== false && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const hasAttendeeMerch = Boolean(
                                reg.selected_merchandise && reg.selected_merchandise.length > 0,
                              );
                              const regStatusStr = ((reg.status as string) || "").toLowerCase().trim();
                              const isPaidAndRegistered =
                                rawStatus === "paid_and_registered" ||
                                rawStatus === "paid_registered" ||
                                regStatusStr === "paid_and_registered" ||
                                regStatusStr === "paid_registered";
                              const canCollectMerch = hasAttendeeMerch && isPaidAndRegistered;

                              if (!hasAttendeeMerch) {
                                return <span className="text-muted-foreground text-xs">—</span>;
                              }

                              if (reg.is_merchandise_collected) {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-600 dark:text-emerald-400"
                                      >
                                        <PackageCheck className="size-3" />
                                        <span>Collected</span>
                                      </Badge>
                                      <Button
                                        size="icon-xs"
                                        variant="ghost"
                                        className="size-6 text-muted-foreground hover:text-destructive"
                                        title={
                                          canCollectMerch
                                            ? "Undo merchandise collection"
                                            : "Merchandise collection is only enabled when status is Paid & Registered"
                                        }
                                        onClick={() => handleToggleMerchandiseCollected(reg, false)}
                                        disabled={isCollectingMerchId === reg.id || !canCollectMerch}
                                      >
                                        <RotateCcw className="size-3" />
                                      </Button>
                                    </div>
                                    {reg.merchandise_collected_by_name && (
                                      <span className="truncate text-[10px] text-muted-foreground">
                                        by {reg.merchandise_collected_by_name}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 gap-1 px-2 font-normal text-[11px] text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600"
                                  title={
                                    canCollectMerch
                                      ? "Mark merchandise as collected"
                                      : "Only enabled when attendee has merchandise and status is Paid & Registered"
                                  }
                                  onClick={() => handleToggleMerchandiseCollected(reg, true)}
                                  disabled={isCollectingMerchId === reg.id || !canCollectMerch}
                                >
                                  <PackageCheck className="size-3" />
                                  <span>Not Collected</span>
                                </Button>
                              );
                            })()}
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
                            {(() => {
                              const regStatusStr = ((reg.status as string) || "").toLowerCase().trim();
                              const canCheckIn =
                                ["paid_and_registered", "paid_registered", "approved", "registered"].includes(
                                  rawStatus,
                                ) ||
                                ["paid_and_registered", "paid_registered", "approved", "registered"].includes(
                                  regStatusStr,
                                );

                              if (reg.is_checked_in) {
                                return (
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
                                );
                              }

                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 gap-1 px-2 font-normal text-[11px] text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600"
                                  title={
                                    canCheckIn
                                      ? "Check in attendee"
                                      : "Check-in is only enabled when status is Paid & Registered, Approved, or Registered"
                                  }
                                  onClick={() => handleToggleCheckIn(reg, true)}
                                  disabled={isCheckingInId === reg.id || !canCheckIn}
                                >
                                  <UserCheck className="size-3" />
                                  <span>Check In</span>
                                </Button>
                              );
                            })()}
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
                              {/* Curation / Waitlist Action Buttons: Approve, Pending, Reject */}
                              {(isCurationMode || rawStatus === "paid_waitlisted" || rawStatus === "waitlisted") && (
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
                              <DropdownMenu modal={false}>
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

          {!isLoading && filtered.length > 0 && (
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                <span>
                  Showing{" "}
                  <strong className="font-medium text-foreground">
                    {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filtered.length)}
                  </strong>{" "}
                  of <strong className="font-medium text-foreground">{filtered.length}</strong> registrants
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <FilterSelect
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                    options={[25, 50, 100, 250].map((size) => ({
                      value: String(size),
                      label: String(size),
                    }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  Page <strong className="font-medium text-foreground">{safeCurrentPage}</strong> of{" "}
                  <strong className="font-medium text-foreground">{pageCount}</strong>
                </span>
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
                        }}
                        aria-disabled={safeCurrentPage <= 1}
                        className={safeCurrentPage <= 1 ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>

                    {pageNumbers[0] > 1 && (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage(1);
                            }}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        {pageNumbers[0] > 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                      </>
                    )}

                    {pageNumbers.map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === safeCurrentPage}
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    {pageNumbers[pageNumbers.length - 1] < pageCount && (
                      <>
                        {pageNumbers[pageNumbers.length - 1] < pageCount - 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage(pageCount);
                            }}
                          >
                            {pageCount}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (safeCurrentPage < pageCount) setCurrentPage(safeCurrentPage + 1);
                        }}
                        aria-disabled={safeCurrentPage >= pageCount}
                        className={safeCurrentPage >= pageCount ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redesigned Applicant Details Dossier Dialog */}
      <ApplicantDetailDialog
        registration={inspectRegistration}
        event={currentEvent}
        isCurationMode={isCurationMode}
        allRegistrations={registrationsList}
        onClose={() => setInspectRegistration(null)}
        onStatusChange={handleStatusChange}
        onUpdateRegistration={(updatedReg) => {
          setRegistrationsList((prev) => prev.map((r) => (r.id === updatedReg.id ? { ...r, ...updatedReg } : r)));
          setInspectRegistration(updatedReg);
        }}
        onApprove={handleApproveAttendee}
        onReject={(reg) => {
          setInspectRegistration(null);
          setRejectConfirmRegistration(reg);
        }}
        onResendInterestEmail={handleResendInterestEmail}
        onResendWaitlistEmail={handleResendWaitlistEmail}
        onResendPaidWaitlistEmail={handleResendPaidWaitlistEmail}
        onToggleCheckIn={handleToggleCheckIn}
        onToggleMerchandiseCollected={handleToggleMerchandiseCollected}
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
        isCollectingMerch={isCollectingMerchId === inspectRegistration?.id}
        isApproving={approvingRegistrationId === inspectRegistration?.id}
        isRejecting={rejectingRegistrationId === inspectRegistration?.id}
        isWaitlisting={waitlistingRegistrationId === inspectRegistration?.id}
        isResendingInterest={isResendingInterestId === inspectRegistration?.id}
        isResendingWaitlist={isResendingWaitlistId === inspectRegistration?.id}
        isResendingPaidWaitlist={isResendingPaidWaitlistId === inspectRegistration?.id}
        isCancelling={isCancelling}
      />

      {/* Confirmation Dialog: Single Attendee Rejection */}
      <AlertDialog
        open={Boolean(rejectConfirmRegistration)}
        onOpenChange={(open) => !open && !rejectingRegistrationId && setRejectConfirmRegistration(null)}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Applicant</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2.5 pt-1 text-left text-sm">
              <span className="block text-foreground">
                Are you sure you want to reject the registration for{" "}
                <strong>{rejectConfirmRegistration?.member_name}</strong>
                {rejectConfirmRegistration?.member_email ? ` (${rejectConfirmRegistration.member_email})` : ""}?
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Their application status will be marked as Rejected and a regret email will be sent to their address
                informing them of the decision.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={Boolean(rejectingRegistrationId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={Boolean(rejectingRegistrationId)}
              onClick={(e) => {
                e.preventDefault();
                if (rejectConfirmRegistration) {
                  void handleRejectAttendee(rejectConfirmRegistration);
                }
              }}
            >
              {rejectingRegistrationId ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject & Send Email"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Batch Attendee Rejection */}
      <AlertDialog
        open={isBatchRejectConfirmOpen}
        onOpenChange={(open) => !open && !isBatchRejecting && setIsBatchRejectConfirmOpen(false)}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Selected Applicants</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2.5 pt-1 text-left text-sm">
              <span className="block text-foreground">
                Are you sure you want to reject <strong className="text-foreground">{selectedIds.size}</strong> selected
                applicant
                {selectedIds.size === 1 ? "" : "s"}?
              </span>
              <span className="block text-muted-foreground text-xs leading-relaxed">
                Each eligible applicant will have their status marked as Rejected and will receive a regret email
                notifying them of the decision.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isBatchRejecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isBatchRejecting}
              onClick={(e) => {
                e.preventDefault();
                void handleBatchReject();
              }}
            >
              {isBatchRejecting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Rejecting {selectedIds.size}...
                </>
              ) : (
                `Reject ${selectedIds.size} Applicant${selectedIds.size === 1 ? "" : "s"} & Send Emails`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Single Attendee Cancellation */}
      <AlertDialog
        open={Boolean(cancelConfirmRegistration)}
        onOpenChange={(open) => {
          if (!open && !isCancelling) {
            setCancelConfirmRegistration(null);
            setCancelReason("");
          }
        }}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Registration & Remove Attendee</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-1 text-left text-sm" asChild>
              <div>
                <span className="block text-foreground">
                  Are you sure you want to cancel the registration for{" "}
                  <strong>{cancelConfirmRegistration?.member_name}</strong>
                  {cancelConfirmRegistration?.member_email ? ` (${cancelConfirmRegistration.member_email})` : ""}?
                </span>
                <span className="block text-muted-foreground text-xs leading-relaxed">
                  A cancellation email will be dispatched to their address informing them that their registration has
                  been cancelled by the organizer and they have been removed from the event. If they change their mind,
                  they will need to re-register again.
                </span>
                <div className="space-y-1.5 pt-1">
                  <Label
                    htmlFor="cancel-reason-input"
                    className="text-xs font-medium text-foreground flex items-center justify-between"
                  >
                    <span>
                      Reason for Cancellation <strong className="text-destructive">*</strong>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Appended to cancellation email
                    </span>
                  </Label>
                  <Textarea
                    id="cancel-reason-input"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Duplicate registration, profile incomplete, or requested by attendee..."
                    disabled={isCancelling}
                    rows={3}
                    className="text-xs resize-none"
                    required
                  />
                  {!cancelReason.trim() && (
                    <p className="text-[11px] text-destructive">
                      Cancellation reason is required to notify the attendee.
                    </p>
                  )}
                </div>
                <span className="block text-muted-foreground text-xs leading-relaxed">
                  Their registration and allocated tickets will then be removed from the dashboard and Bevy roster,
                  freeing up capacity for new attendees.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isCancelling}>Keep Registration</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isCancelling || !cancelReason.trim()}
              onClick={(e) => {
                e.preventDefault();
                if (cancelConfirmRegistration && cancelReason.trim()) {
                  void handleCancelRegistration(cancelConfirmRegistration);
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
      <AlertDialog
        open={isBatchCancelConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !isCancelling) {
            setIsBatchCancelConfirmOpen(false);
            setCancelReason("");
          }
        }}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md sm:max-w-lg data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Selected Registrations</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-1 text-left text-sm" asChild>
              <div>
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
                <div className="space-y-1.5 pt-1">
                  <Label
                    htmlFor="batch-cancel-reason-input"
                    className="text-xs font-medium text-foreground flex items-center justify-between"
                  >
                    <span>
                      Reason for Cancellation <strong className="text-destructive">*</strong>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Appended to cancellation emails
                    </span>
                  </Label>
                  <Textarea
                    id="batch-cancel-reason-input"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Quota adjustments or duplicate applications across batch selection..."
                    disabled={isCancelling}
                    rows={3}
                    className="text-xs resize-none"
                    required
                  />
                  {!cancelReason.trim() && (
                    <p className="text-[11px] text-destructive">
                      Cancellation reason is required to notify all attendees.
                    </p>
                  )}
                </div>
                <span className="block text-muted-foreground text-xs leading-relaxed">
                  Their registrations will be permanently removed from the dashboard and Bevy roster, releasing attendee
                  capacity.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={isCancelling}>Keep Registrations</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90"
              disabled={isCancelling || !cancelReason.trim()}
              onClick={(e) => {
                e.preventDefault();
                if (cancelReason.trim()) {
                  void handleBatchCancel();
                }
              }}
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
        onOpenChange={(open) => !open && !isDeleting && setDeleteConfirmRegistration(null)}
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
              onClick={(e) => {
                e.preventDefault();
                if (deleteConfirmRegistration) {
                  void handleDeleteRegistration(deleteConfirmRegistration);
                }
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Attendee"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Batch Attendee Removal */}
      <AlertDialog
        open={isBatchDeleteConfirmOpen}
        onOpenChange={(open) => !open && !isDeleting && setIsBatchDeleteConfirmOpen(false)}
      >
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
              onClick={(e) => {
                e.preventDefault();
                void handleBatchDelete();
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Removing {selectedIds.size}...
                </>
              ) : (
                `Remove ${selectedIds.size} Attendee${selectedIds.size === 1 ? "" : "s"}`
              )}
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
            if (onSwitchTab) {
              onSwitchTab("form");
            } else {
              window.dispatchEvent(new CustomEvent("gdg:switch-tab", { detail: "form" }));
              const formTabTrigger = document.querySelector<HTMLButtonElement>(
                '#tab-trigger-form, [data-value="form"], [data-slot="tabs-trigger"][value="form"], button[value="form"]',
              );
              formTabTrigger?.click();
            }
          }}
        />
      )}

      {/* Resend Payment Link Dialog */}
      <ResendPaymentLinkDialog
        open={Boolean(resendPaymentRegistration) || isBatchResendPaymentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setResendPaymentRegistration(null);
            setIsBatchResendPaymentOpen(false);
          }
        }}
        registration={resendPaymentRegistration}
        registrations={isBatchResendPaymentOpen ? selectedForRegeneratePayment : undefined}
        event={currentEvent}
        onSuccess={(updatedReg) => {
          setRegistrationsList((prev) => prev.map((r) => (r.id === updatedReg.id ? updatedReg : r)));
        }}
        onBatchSuccess={(updatedRegs) => {
          const byId = new Map(updatedRegs.map((r) => [r.id, r]));
          setRegistrationsList((prev) => prev.map((r) => byId.get(r.id) ?? r));
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

      {/* Multi-Mode Bevy QR Scanner Dialog (Event Check-in, Breakout Session Check-in, Merchandise Collection) */}
      <QrCheckInScannerDialog
        open={isQrScannerOpen}
        onOpenChange={setIsQrScannerOpen}
        eventId={eventId}
        eventTitle={currentEvent?.title}
        registrations={registrationsList}
        sessions={sessions}
        questions={customQuestions}
        initialMode="event_checkin"
        onRegistrationUpdated={(updatedReg) => {
          setRegistrationsList((prev) => prev.map((r) => (r.id === updatedReg.id ? updatedReg : r)));
        }}
      />
    </div>
  );
}
