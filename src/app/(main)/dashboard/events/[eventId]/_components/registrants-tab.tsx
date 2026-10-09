"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { format, parseISO } from "date-fns";
import {
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  Filter,
  Layers,
  MoreHorizontal,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BevyAttendee } from "@/lib/bevy/types";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import {
  deleteBatchEventRegistrationsAction,
  deleteEventRegistrationAction,
  updateRegistrationCheckInAction,
  updateRegistrationStatusAction,
} from "@/lib/firestore/actions";
import type {
  CustomQuestion,
  EventSession,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
} from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";
import { checkInBevyAttendeeAction, fetchBevyEventAttendeesAction } from "@/server/bevy-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { ApplicantDetailDialog } from "./applicant-detail-dialog";
import { type AvailableQuestionField, ColumnCustomizer } from "./column-customizer";
import { QuestionColumnValueCell } from "./question-column-value-cell";
import { QuestionResponsesCell } from "./question-responses-cell";
import { RegistrantStatistics } from "./registrant-statistics";

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
  approved: {
    label: "Approved",
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
}: {
  hasSessions: boolean;
  hasTickets?: boolean;
  hasMerchandise?: boolean;
  visibleStandardColumns?: Record<string, boolean>;
  questionColumnCount?: number;
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
          {visibleStandardColumns.reviewed_by !== false && (
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

export function RegistrantsTab({ eventId, registrations, event }: RegistrantsTabProps) {
  const user = useAuthStore((s) => s.user);
  const [registrationsList, setRegistrationsList] = useState<FirestoreRegistration[]>(registrations);
  const [isLoading, setIsLoading] = useState(registrations.length === 0);
  const [isFiltering, setIsFiltering] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [sessions, setSessions] = useState<EventSession[]>(event?.sessions ?? []);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(event?.custom_questions ?? []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectRegistration, setInspectRegistration] = useState<FirestoreRegistration | null>(null);
  const [deleteConfirmRegistration, setDeleteConfirmRegistration] = useState<FirestoreRegistration | null>(null);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const [isCheckingInId, setIsCheckingInId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (registrations.length > 0) {
      setRegistrationsList(registrations);
      setIsLoading(false);
    }
  }, [registrations]);

  useEffect(() => {
    let unsubscribe: () => void = () => {
      // No-op initial cleanup
    };

    async function initRegistrations() {
      try {
        const { getEventRegistrations, subscribeEventRegistrations } = await import("@/lib/firestore/client");

        // 1. Initial direct load
        const directList = await getEventRegistrations(eventId);
        if (directList && directList.length > 0) {
          setRegistrationsList(directList);
          setIsLoading(false);
        }

        // 2. Real-time subscription listener
        unsubscribe = subscribeEventRegistrations(
          eventId,
          (liveList) => {
            setRegistrationsList(liveList);
            setIsLoading(false);
          },
          (err) => {
            console.warn("[RegistrantsTab] Live registrations listener warning:", err);
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
  }, [eventId]);

  const syncBevyAttendees = useCallback(
    async (showNotification = false) => {
      setIsSyncingBevy(true);
      try {
        const res = await fetchBevyEventAttendeesAction(eventId, 500, 1);
        const attendees = res.results ?? [];
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

  useEffect(() => {
    if (event?.sessions && event.sessions.length > 0) {
      setSessions(event.sessions);
    }
    if (event?.custom_questions && event.custom_questions.length > 0) {
      setCustomQuestions(event.custom_questions);
    }

    const needsSessions = !event?.sessions || event.sessions.length === 0;
    const needsQuestions = !event?.custom_questions || event.custom_questions.length === 0;

    if (needsSessions || needsQuestions) {
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
        } catch (err) {
          console.warn("[RegistrantsTab] Failed to load event details:", err);
        }
      }
      void fetchEventDetails();
    }
  }, [eventId, event?.sessions, event?.custom_questions]);

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
          setSelectedQuestionColumns(parsed.questions);
        }
        if (parsed.standard && typeof parsed.standard === "object") {
          setVisibleStandardColumns((prev) => ({ ...prev, ...parsed.standard }));
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [eventId]);

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

  const handleResetAllFilters = () => {
    setIsFiltering(true);
    setStatusFilter("all");
    setSessionFilter("all");
    setTicketFilter("all");
    setReviewerFilter("all");
    setSearch("");
    setQuestionFilters({});
    setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  };

  // Filter logic
  const filtered = useMemo(() => {
    return registrationsList.filter((reg) => {
      const searchLower = search.trim().toLowerCase();
      const matchesSearch =
        !searchLower ||
        reg.member_name.toLowerCase().includes(searchLower) ||
        reg.member_email.toLowerCase().includes(searchLower) ||
        Boolean(reg.reviewed_by_name?.toLowerCase().includes(searchLower)) ||
        Boolean(reg.reviewed_by_email?.toLowerCase().includes(searchLower)) ||
        Boolean(reg.ticket_name?.toLowerCase().includes(searchLower)) ||
        (reg.answers && JSON.stringify(reg.answers).toLowerCase().includes(searchLower));

      const regStatus = (reg.status ?? "").toLowerCase().trim();
      const filterStatus = (statusFilter ?? "all").toLowerCase().trim();

      // "all" matches ANY status without exception
      let matchesStatus = filterStatus === "all";
      if (!matchesStatus) {
        if (filterStatus === "approved") {
          matchesStatus =
            regStatus === "approved" ||
            regStatus === "attended" ||
            regStatus === "confirmed" ||
            regStatus === "registered";
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

      if (!matchesSearch || !matchesStatus || !matchesSession || !matchesTicket || !matchesReviewer) {
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
    search,
    statusFilter,
    sessionFilter,
    ticketFilter,
    reviewerFilter,
    selectedQuestionColumns,
    questionFilters,
    questionLabelMap,
  ]);

  const handleStatusChange = (registrationId: string, newStatus: RegistrationStatus) => {
    startTransition(async () => {
      try {
        const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
        const now = new Date().toISOString();
        await updateRegistrationStatusAction(registrationId, eventId, newStatus, reviewerPayload);
        setRegistrationsList((prev) =>
          prev.map((r) =>
            r.id === registrationId
              ? {
                  ...r,
                  status: newStatus,
                  reviewed_at: now,
                  ...(user
                    ? {
                        reviewed_by_id: user.id,
                        reviewed_by_name: user.name,
                        reviewed_by_email: user.email,
                      }
                    : {}),
                }
              : r,
          ),
        );
        setInspectRegistration((prev) =>
          prev?.id === registrationId
            ? {
                ...prev,
                status: newStatus,
                reviewed_at: now,
                ...(user
                  ? {
                      reviewed_by_id: user.id,
                      reviewed_by_name: user.name,
                      reviewed_by_email: user.email,
                    }
                  : {}),
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

  const handleBatchAction = (newStatus: RegistrationStatus) => {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      try {
        const reviewerPayload = user ? { id: user.id, name: user.name, email: user.email } : undefined;
        const now = new Date().toISOString();
        const promises = Array.from(selectedIds).map((id) =>
          updateRegistrationStatusAction(id, eventId, newStatus, reviewerPayload),
        );
        await Promise.all(promises);
        setRegistrationsList((prev) =>
          prev.map((r) =>
            selectedIds.has(r.id)
              ? {
                  ...r,
                  status: newStatus,
                  reviewed_at: now,
                  ...(user
                    ? {
                        reviewed_by_id: user.id,
                        reviewed_by_name: user.name,
                        reviewed_by_email: user.email,
                      }
                    : {}),
                }
              : r,
          ),
        );
        toast.success(`Updated ${selectedIds.size} registrants to ${STATUS_VARIANTS[newStatus].label}`);
        setSelectedIds(new Set());
      } catch (err) {
        console.error("[RegistrantsTab] Batch update failed:", err);
        const msg = err instanceof Error ? err.message : "Batch update failed.";
        toast.error(msg);
      }
    });
  };

  const handleDeleteRegistration = (registration: FirestoreRegistration) => {
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
        const res = await deleteEventRegistrationAction(registration.id, eventId);
        if (res.success) {
          toast.success(`Removed ${registration.member_name}. They can now re-register.`);
        } else {
          // Revert on failure
          setRegistrationsList((prev) => [registration, ...prev]);
          toast.error(res.error || "Failed to remove attendee registration.");
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
        const res = await deleteBatchEventRegistrationsAction(idsToDelete, eventId);
        if (res.success) {
          toast.success(`Removed ${count} attendee${count === 1 ? "" : "s"}. They can now re-register.`);
        } else {
          // Revert on failure
          setRegistrationsList((prev) => [...regsToDelete, ...prev]);
          toast.error(res.error || "Failed to remove selected attendees.");
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

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
      "Reviewed By",
      "Reviewed At",
      ...(hasTickets ? ["Ticket Pass", "Ticket Type", "Ticket Price"] : []),
      ...(hasMerchandise ? ["Merchandise Orders"] : []),
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

      const merchText = (r.selected_merchandise ?? [])
        .map(
          (m) =>
            `${m.quantity}x ${m.name}${
              m.selected_variations ? ` (${Object.values(m.selected_variations).join(", ")})` : ""
            }`,
        )
        .join("; ");

      return [
        `"${(r.member_name || "").replace(/"/g, '""')}"`,
        `"${(r.member_email || "").replace(/"/g, '""')}"`,
        `"${(r.status || "").replace(/"/g, '""')}"`,
        `"${(r.reviewed_by_name || "").replace(/"/g, '""')}"`,
        `"${(r.reviewed_at || "").replace(/"/g, '""')}"`,
        ...(hasTickets
          ? [
              `"${(r.ticket_name || "General RSVP").replace(/"/g, '""')}"`,
              `"${(r.ticket_type || "free").replace(/"/g, '""')}"`,
              `"${r.ticket_price || 0}"`,
            ]
          : []),
        ...(hasMerchandise ? [`"${merchText.replace(/"/g, '""')}"`] : []),
        `"${r.is_checked_in ? "Checked In" : "Not Checked In"}"`,
        `"${sessionTitle.replace(/"/g, '""')}"`,
        ...questionColsData,
        `"${(r.registered_at || "").replace(/"/g, '""')}"`,
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
    if (visibleStandardColumns.reviewed_by !== false) count += 1;
    if (hasTickets && visibleStandardColumns.ticket !== false) count += 1;
    if (hasMerchandise && visibleStandardColumns.merchandise !== false) count += 1;
    if (hasSessions && visibleStandardColumns.session !== false) count += 1;
    if (visibleStandardColumns.checkin !== false) count += 1;
    count += selectedQuestionColumns.length;
    if (visibleStandardColumns.all_responses !== false) count += 1;
    if (visibleStandardColumns.registered_at !== false) count += 1;
    if (visibleStandardColumns.actions !== false) count += 1;
    return count;
  }, [visibleStandardColumns, hasSessions, hasTickets, hasMerchandise, selectedQuestionColumns.length]);

  const activeQuestionFilterCount = useMemo(() => {
    return Object.values(questionFilters).filter((v) => Boolean(v) && v !== "all").length;
  }, [questionFilters]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter !== "all" ||
      sessionFilter !== "all" ||
      ticketFilter !== "all" ||
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
        onSelectStatusFilter={handleStatusFilterChange}
        onSelectSearchFilter={handleSearchChange}
        onSelectSessionFilter={handleSessionFilterChange}
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              Registrants & Attendance Filtration ({isLoading ? "..." : filtered.length}
              {!isLoading && registrationsList.length > 0 && filtered.length !== registrationsList.length
                ? ` of ${registrationsList.length}`
                : ""}
              )
            </CardTitle>
            <CardDescription>
              Review attendee applications, session tracks, and approve or reject participants.
            </CardDescription>
          </div>

          {/* Batch Actions Toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground text-xs">{selectedIds.size} selected:</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-emerald-600 dark:text-emerald-400"
                onClick={() => handleBatchAction("approved")}
                disabled={isPending}
              >
                <UserCheck className="size-3.5" />
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-amber-600 dark:text-amber-400"
                onClick={() => handleBatchAction("pending")}
                disabled={isPending}
              >
                <Clock className="size-3.5" />
                Set Pending
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive"
                onClick={() => handleBatchAction("rejected")}
                disabled={isPending || isDeleting}
              >
                <UserX className="size-3.5" />
                Reject Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsBatchDeleteConfirmOpen(true)}
                disabled={isPending || isDeleting}
              >
                <Trash2 className="size-3.5" />
                Remove Selected
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {/* Filtration Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <InputGroup className="h-8 w-60">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-8 text-xs"
                  placeholder="Search name, email, details..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </InputGroup>

              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger size="sm" className="h-8 text-xs">
                  <span className="text-muted-foreground">Status:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

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
                    <Ticket className="mr-1 size-3 text-muted-foreground shrink-0" />
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

              {availableReviewers.length > 0 && (
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
                  <Select key={qKey} value={currentVal} onValueChange={(val) => handleQuestionFilterChange(qKey, val)}>
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

            <div className="flex items-center gap-2">
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
                onResetDefaults={handleResetColumnDefaults}
              />

              <Button
                size="sm"
                variant="outline"
                onClick={() => syncBevyAttendees(true)}
                disabled={isSyncingBevy}
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

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="font-medium text-muted-foreground text-xs">Active Filters:</span>
              {search.trim() && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <span>Search: &quot;{search}&quot;</span>
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label="Clear search filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 font-normal text-xs">
                  <span>Status: {STATUS_VARIANTS[statusFilter as RegistrationStatus]?.label || statusFilter}</span>
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
              {reviewerFilter !== "all" && (
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
                  {visibleStandardColumns.reviewed_by !== false && <TableHead>Reviewed By</TableHead>}
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
                              ? `No applicants currently have status "${STATUS_VARIANTS[statusFilter as RegistrationStatus]?.label || statusFilter}".`
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
                    const rawStatus = ((reg.status as string) || "").toLowerCase().trim();
                    const statusMeta =
                      STATUS_VARIANTS[rawStatus as RegistrationStatus] ||
                      (rawStatus === "confirmed" || rawStatus === "registered"
                        ? STATUS_VARIANTS.approved
                        : STATUS_VARIANTS.pending);
                    const sessionTitle =
                      reg.session_title ||
                      (reg.answers?.session_title as string) ||
                      (reg.session_id ? `Track: ${reg.session_id}` : null);

                    let regDate = reg.registered_at;
                    try {
                      regDate = format(parseISO(reg.registered_at), "dd MMM yyyy, h:mm a");
                    } catch {
                      // Keep raw string
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
                            <Badge
                              variant="outline"
                              className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", statusMeta.badgeClass)}
                            >
                              <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                        )}

                        {visibleStandardColumns.reviewed_by !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)} className="max-w-[180px]">
                            {reg.reviewed_by_name ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                                  <UserCheck className="size-3.5 shrink-0 text-primary" />
                                  <span className="truncate">{reg.reviewed_by_name}</span>
                                </div>
                                {reg.reviewed_at && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {(() => {
                                      try {
                                        return format(parseISO(reg.reviewed_at), "dd MMM, HH:mm");
                                      } catch {
                                        return reg.reviewed_at;
                                      }
                                    })()}
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
                                    "w-fit px-1.5 py-0 text-[10px] font-semibold",
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
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">General RSVP</span>
                            )}
                          </TableCell>
                        )}

                        {hasMerchandise && visibleStandardColumns.merchandise !== false && (
                          <TableCell onClick={() => setInspectRegistration(reg)}>
                            {reg.selected_merchandise && reg.selected_merchandise.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {reg.selected_merchandise.map((m) => (
                                  <Badge key={m.id} variant="secondary" className="w-fit gap-1 text-[10px] font-normal">
                                    <Package className="size-2.5 text-primary" />
                                    <span>
                                      {m.quantity}x {m.name}
                                    </span>
                                  </Badge>
                                ))}
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
                              {/* 1. Approve Button */}
                              <Button
                                size="icon-xs"
                                variant={reg.status === "approved" ? "default" : "ghost"}
                                className={cn(
                                  "size-7 transition-colors",
                                  reg.status === "approved"
                                    ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                                    : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700",
                                )}
                                title={reg.status === "approved" ? "Approved" : "Approve application"}
                                onClick={() => handleStatusChange(reg.id, "approved")}
                                disabled={isPending}
                              >
                                <Check className="size-3.5" />
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
                                )}
                                title={reg.status === "pending" ? "Pending Review" : "Mark as Pending"}
                                onClick={() => handleStatusChange(reg.id, "pending")}
                                disabled={isPending}
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
                                    ? "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90"
                                    : "text-destructive hover:bg-destructive/10 hover:text-destructive",
                                )}
                                title={reg.status === "rejected" ? "Rejected" : "Reject application"}
                                onClick={() => handleStatusChange(reg.id, "rejected")}
                                disabled={isPending}
                              >
                                <X className="size-3.5" />
                              </Button>

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
                                  <DropdownMenuItem onClick={() => handleStatusChange(reg.id, "waitlisted")}>
                                    <Layers className="mr-2 size-3.5" />
                                    Move to Waitlist
                                  </DropdownMenuItem>
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
        onClose={() => setInspectRegistration(null)}
        onStatusChange={handleStatusChange}
        onToggleCheckIn={handleToggleCheckIn}
        onDelete={(reg) => {
          setInspectRegistration(null);
          setDeleteConfirmRegistration(reg);
        }}
        customQuestions={customQuestions}
        isPending={isPending || isCheckingInId === inspectRegistration?.id}
      />

      {/* Confirmation Dialog: Single Attendee Removal */}
      <AlertDialog
        open={Boolean(deleteConfirmRegistration)}
        onOpenChange={(open) => !open && setDeleteConfirmRegistration(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Attendee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong className="text-foreground">{deleteConfirmRegistration?.member_name}</strong>
              {deleteConfirmRegistration?.member_email ? ` (${deleteConfirmRegistration.member_email})` : ""}?
              <br className="my-1.5" />
              Their registration record will be permanently deleted, freeing up attendee capacity and allowing them to
              re-register for this event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Selected Attendees</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the <strong className="text-foreground">{selectedIds.size}</strong>{" "}
              selected attendee{selectedIds.size === 1 ? "" : "s"}?
              <br className="my-1.5" />
              Their registration records will be permanently deleted, freeing up attendee capacity and allowing them to
              re-register for this event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleBatchDelete}
            >
              {isDeleting ? "Removing..." : `Remove ${selectedIds.size} Attendee${selectedIds.size === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
