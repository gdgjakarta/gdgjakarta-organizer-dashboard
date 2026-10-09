"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { format, parseISO } from "date-fns";
import {
  Check,
  Clock,
  Download,
  Eye,
  Layers,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BevyAttendee } from "@/lib/bevy/types";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import { updateRegistrationCheckInAction, updateRegistrationStatusAction } from "@/lib/firestore/actions";
import type {
  CustomQuestion,
  EventSession,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
} from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";
import { checkInBevyAttendeeAction, fetchBevyEventAttendeesAction } from "@/server/bevy-actions";

import { ApplicantDetailDialog } from "./applicant-detail-dialog";
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

function RegistrantsTableSkeleton({ hasSessions }: { hasSessions: boolean }) {
  return (
    <>
      {[1, 2, 3, 4, 5].map((idx) => (
        <TableRow key={idx}>
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
          <TableCell>
            <div className="relative h-5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
          </TableCell>
          {hasSessions && (
            <TableCell>
              <div className="relative h-4 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </TableCell>
          )}
          <TableCell>
            <div className="relative h-5 w-20 overflow-hidden rounded-md bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
          </TableCell>
          <TableCell>
            <div className="relative h-4 w-44 overflow-hidden rounded bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
          </TableCell>
          <TableCell>
            <div className="relative h-3.5 w-24 overflow-hidden rounded bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
          </TableCell>
          <TableCell className="text-right">
            <div className="relative ml-auto size-7 overflow-hidden rounded bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function RegistrantsTab({ eventId, registrations, event }: RegistrantsTabProps) {
  const [registrationsList, setRegistrationsList] = useState<FirestoreRegistration[]>(registrations);
  const [isLoading, setIsLoading] = useState(registrations.length === 0);
  const [isFiltering, setIsFiltering] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [sessions, setSessions] = useState<EventSession[]>(event?.sessions ?? []);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(event?.custom_questions ?? []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectRegistration, setInspectRegistration] = useState<FirestoreRegistration | null>(null);
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

  const formatQuestionLabel = (key: string): string => {
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
  };

  // Filter logic
  const filtered = useMemo(() => {
    return registrationsList.filter((reg) => {
      const searchLower = search.trim().toLowerCase();
      const matchesSearch =
        !searchLower ||
        reg.member_name.toLowerCase().includes(searchLower) ||
        reg.member_email.toLowerCase().includes(searchLower) ||
        (reg.answers && JSON.stringify(reg.answers).toLowerCase().includes(searchLower));

      const regStatus = (reg.status || "").toLowerCase().trim();
      const filterStatus = (statusFilter || "all").toLowerCase().trim();

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

      return matchesSearch && matchesStatus && matchesSession;
    });
  }, [registrationsList, search, statusFilter, sessionFilter]);

  const handleStatusChange = (registrationId: string, newStatus: RegistrationStatus) => {
    startTransition(async () => {
      try {
        await updateRegistrationStatusAction(registrationId, eventId, newStatus);
        setRegistrationsList((prev) => prev.map((r) => (r.id === registrationId ? { ...r, status: newStatus } : r)));
        setInspectRegistration((prev) => (prev?.id === registrationId ? { ...prev, status: newStatus } : prev));
        toast.success(`Applicant marked as ${STATUS_VARIANTS[newStatus].label}`);
      } catch {
        toast.error("Failed to update status.");
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
        const promises = Array.from(selectedIds).map((id) => updateRegistrationStatusAction(id, eventId, newStatus));
        await Promise.all(promises);
        setRegistrationsList((prev) => prev.map((r) => (selectedIds.has(r.id) ? { ...r, status: newStatus } : r)));
        toast.success(`Updated ${selectedIds.size} registrants to ${STATUS_VARIANTS[newStatus].label}`);
        setSelectedIds(new Set());
      } catch {
        toast.error("Batch update failed.");
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

    const headers = ["Name", "Email", "Status", "Bevy Check-In", "Session Track", "Registered At", "Responses"];
    const rows = filtered.map((r) => {
      const sessionTitle =
        r.session_title ||
        (r.answers?.session_title as string) ||
        (r.session_id ? `Session ID: ${r.session_id}` : "Standard RSVP");

      const cleanAnswers = r.answers
        ? Object.entries(r.answers)
            .filter(([k]) => k !== "session_id" && k !== "session_title")
            .map(([k, v]) => `${formatQuestionLabel(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
            .join("; ")
        : "";

      return [
        `"${(r.member_name || "").replace(/"/g, '""')}"`,
        `"${(r.member_email || "").replace(/"/g, '""')}"`,
        `"${(r.status || "").replace(/"/g, '""')}"`,
        `"${r.is_checked_in ? "Checked In" : "Not Checked In"}"`,
        `"${sessionTitle.replace(/"/g, '""')}"`,
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
                disabled={isPending}
              >
                <UserX className="size-3.5" />
                Reject Selected
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
            </div>

            <div className="flex items-center gap-2">
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
                  <TableHead>Status</TableHead>
                  {hasSessions && <TableHead>Session Track</TableHead>}
                  <TableHead>Check-In (Bevy)</TableHead>
                  <TableHead>Question Responses & Details</TableHead>
                  <TableHead>Registered At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isLoading || isFiltering) && <RegistrantsTableSkeleton hasSessions={hasSessions} />}

                {!isLoading && !isFiltering && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={hasSessions ? 8 : 7} className="h-40 text-center text-muted-foreground text-sm">
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
                            onClick={() => {
                              setIsFiltering(true);
                              setStatusFilter("all");
                              setSessionFilter("all");
                              setSearch("");
                              setTimeout(() => setIsFiltering(false), 200);
                            }}
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

                        <TableCell onClick={() => setInspectRegistration(reg)}>
                          <Badge
                            variant="outline"
                            className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", statusMeta.badgeClass)}
                          >
                            <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                            {statusMeta.label}
                          </Badge>
                        </TableCell>

                        {hasSessions && (
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

                        <TableCell onClick={() => setInspectRegistration(reg)} className="max-w-[400px]">
                          <QuestionResponsesCell answers={reg.answers} formatQuestionLabel={formatQuestionLabel} />
                        </TableCell>

                        <TableCell
                          onClick={() => setInspectRegistration(reg)}
                          className="text-muted-foreground text-xs"
                        >
                          {regDate}
                        </TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                                    Copy email address
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
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
        customQuestions={customQuestions}
        isPending={isPending || isCheckingInId === inspectRegistration?.id}
      />
    </div>
  );
}
