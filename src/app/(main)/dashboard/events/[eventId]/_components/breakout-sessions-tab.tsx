"use client";

import * as React from "react";

import {
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Layers,
  Link2,
  Link2Off,
  Loader2,
  Mail,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Trash2,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { findMatchingSpeaker, normalizeStr } from "@/lib/events/agenda-unification";
import { isRegistrationInSession } from "@/lib/events/capacity-validator";
import { DEFAULT_COMBINED_QUESTIONS, DEFAULT_GDG_SESSIONS } from "@/lib/events/registration-defaults";
import {
  assignRegistrantsToBreakoutSessionAction,
  removeRegistrantFromBreakoutSessionAction,
  updateBreakoutSessionCheckInAction,
  updateEventBreakoutSessionsAction,
} from "@/lib/firestore/actions";
import type {
  CustomQuestion,
  EventSession,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
} from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";
import { checkInBevyAttendeeAction } from "@/server/bevy-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { HtmlEditText } from "./html-edit-text";
import { QrCheckInScannerDialog } from "./qr-checkin-scanner-dialog";

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

function getStatusMeta(status?: string) {
  if (status && status in STATUS_VARIANTS) {
    return STATUS_VARIANTS[status as RegistrationStatus];
  }
  const fallbackLabel = (status || "pending").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    label: fallbackLabel,
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
  };
}

interface BreakoutSessionsTabProps {
  eventId: string;
  event: FirestoreEvent;
  registrations?: FirestoreRegistration[];
  sessionCounts?: Record<string, number>;
  isSuperAdmin?: boolean;
}

function getAnswerDisplay(
  reg: FirestoreRegistration,
  keys: string[],
  questions?: CustomQuestion[],
  labelKeywords?: string[],
): string {
  if (!reg.answers) return "";
  for (const key of keys) {
    const val = reg.answers[key];
    if (Array.isArray(val) && val.length > 0) return val.join(", ");
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  if (labelKeywords && labelKeywords.length > 0) {
    for (const [qId, val] of Object.entries(reg.answers)) {
      if (qId === "session_id" || qId === "session_title" || qId === "session" || qId === "bevy_user_id") continue;
      const strVal = Array.isArray(val) ? val.join(", ") : typeof val === "string" ? val.trim() : "";
      if (!strVal) continue;
      const customLabel = questions?.find((q) => q.id.toLowerCase() === qId.toLowerCase())?.label ?? "";
      const defaultLabel =
        DEFAULT_COMBINED_QUESTIONS.find((q) => q.id.toLowerCase() === qId.toLowerCase())?.label ?? "";
      const haystack = `${qId} ${customLabel} ${defaultLabel}`.toLowerCase();
      if (labelKeywords.some((kw) => haystack.includes(kw))) {
        return strVal;
      }
    }
  }
  return "";
}

function getRegistrantOrg(reg: FirestoreRegistration, questions?: CustomQuestion[]): string {
  return getAnswerDisplay(
    reg,
    [
      "company_or_institution",
      "institution",
      "company",
      "organization",
      "university",
      "company_name",
      "institution_name",
      "school",
      "instansi",
      "kampus",
      "perusahaan",
    ],
    questions,
    [
      "institution",
      "company",
      "organization",
      "university",
      "school",
      "employer",
      "instansi",
      "kampus",
      "perusahaan",
      "universitas",
    ],
  );
}

function getRegistrantRole(reg: FirestoreRegistration, questions?: CustomQuestion[]): string {
  return getAnswerDisplay(
    reg,
    [
      "role_or_title",
      "job_title",
      "current_role",
      "job_role",
      "role",
      "position",
      "occupation",
      "profession",
      "pekerjaan",
      "jabatan",
      "persona_description",
      "professional_background",
    ],
    questions,
    ["job title", "current role", "role / occupation", "occupation", "position", "profession", "pekerjaan", "jabatan"],
  );
}

function getRegistrantYoe(reg: FirestoreRegistration, questions?: CustomQuestion[]): string {
  return getAnswerDisplay(
    reg,
    [
      "years_of_experience",
      "yoe",
      "experience_years",
      "years_experience",
      "work_experience",
      "pengalaman_kerja",
      "lama_pengalaman",
    ],
    questions,
    ["years of professional experience", "years of experience", "pengalaman kerja", "lama pengalaman"],
  );
}

function formatAnswerLabel(qId: string, questions: CustomQuestion[]): string {
  const trimmed = qId.trim();
  const lower = trimmed.toLowerCase();

  const customMatch = questions.find((q) => q.id.toLowerCase() === lower);
  if (customMatch?.label) return customMatch.label;

  const defaultMatch = DEFAULT_COMBINED_QUESTIONS.find((q) => q.id.toLowerCase() === lower);
  if (defaultMatch?.label) return defaultMatch.label;

  const commonLabels: Record<string, string> = {
    session_title: "Session Title",
    session: "Breakout Session",
    name: "Full Name",
    full_name: "Full Name",
    email: "Email Address",
    whatsapp: "WhatsApp Number",
    phone: "Phone Number",
    phone_number: "Phone Number",
  };
  if (commonLabels[lower]) return commonLabels[lower];

  if (/^q_\d+/i.test(trimmed)) return "Archived Form Question";
  if (/[A-Z]/.test(trimmed) && trimmed.includes(" ") && !trimmed.includes("_")) return trimmed;

  const words = trimmed
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const w = word.toLowerCase();
      if (w === "url") return "URL";
      if (w === "id") return "ID";
      if (w === "github") return "GitHub";
      if (w === "linkedin") return "LinkedIn";
      if (w === "whatsapp") return "WhatsApp";
      if (w === "ai") return "AI";
      if (w === "gdg") return "GDG";
      if (w === "rsvp") return "RSVP";
      if (w === "faq") return "FAQ";
      if (w === "ui") return "UI";
      if (w === "ux") return "UX";
      if (w === "cv") return "CV";
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

  return words.join(" ") || trimmed;
}

interface BreakoutConfigSnapshot {
  sessions: EventSession[];
  defaultSessionName: string;
  defaultSessionTime: string;
  defaultSessionCheckinDeadline: string;
  defaultSessionLocation: string;
  defaultSessionLocationUrl: string;
}

function serializeBreakoutConfig(cfg: BreakoutConfigSnapshot): string {
  return JSON.stringify({
    defaultSessionName: cfg.defaultSessionName.trim() || "Full Session",
    defaultSessionTime: cfg.defaultSessionTime ?? "",
    defaultSessionCheckinDeadline: cfg.defaultSessionCheckinDeadline ?? "",
    defaultSessionLocation: cfg.defaultSessionLocation ?? "",
    defaultSessionLocationUrl: cfg.defaultSessionLocationUrl ?? "",
    sessions: cfg.sessions.map((s) => ({
      id: s.id,
      agenda_activity_id: s.agenda_activity_id ?? "",
      title: s.title ?? "",
      description: s.description ?? "",
      speaker_name: s.speaker_name ?? "",
      time_slot: s.time_slot ?? "",
      checkin_deadline: s.checkin_deadline ?? "",
      location: s.location ?? "",
      location_url: s.location_url ?? "",
      capacity: Number(s.capacity) || 50,
      related_links: (s.related_links ?? []).map((l) => ({
        title: l.title ?? "",
        url: l.url ?? "",
      })),
      include_in_registration: s.include_in_registration !== false,
      separate_check_in: s.separate_check_in !== false,
      sync_check_in_to_bevy: Boolean(s.sync_check_in_to_bevy),
    })),
  });
}

export function BreakoutSessionsTab({
  eventId,
  event,
  registrations: initialRegistrations = [],
  sessionCounts = {},
  isSuperAdmin = true,
}: BreakoutSessionsTabProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading || s.isLoggingOut);

  const [localRegistrations, setLocalRegistrations] = React.useState<FirestoreRegistration[]>(initialRegistrations);

  React.useEffect(() => {
    if (initialRegistrations.length > 0) {
      setLocalRegistrations(initialRegistrations);
    }
  }, [initialRegistrations]);

  const initialNormalizedSessions = React.useMemo<EventSession[]>(() => {
    if (Array.isArray(event.sessions) && event.sessions.length > 0) {
      return event.sessions.map((s) => ({
        ...s,
        capacity: Number(s.capacity) || 50,
        include_in_registration: s.include_in_registration !== false,
        separate_check_in: s.separate_check_in !== false,
        sync_check_in_to_bevy: s.sync_check_in_to_bevy ?? false,
      }));
    }
    return [];
  }, [event.sessions]);

  const [sessions, setSessions] = React.useState<EventSession[]>(initialNormalizedSessions);

  const [defaultSessionName, setDefaultSessionName] = React.useState<string>(
    event.default_session_name?.trim() || "Full Session",
  );
  const [defaultSessionTime, setDefaultSessionTime] = React.useState<string>(event.default_session_time ?? "");
  const [defaultSessionCheckinDeadline, setDefaultSessionCheckinDeadline] = React.useState<string>(
    event.default_session_checkin_deadline ?? "",
  );
  const [defaultSessionLocation, setDefaultSessionLocation] = React.useState<string>(
    event.default_session_location ?? "",
  );
  const [defaultSessionLocationUrl, setDefaultSessionLocationUrl] = React.useState<string>(
    event.default_session_location_url ?? "",
  );

  const [savedConfig, setSavedConfig] = React.useState<BreakoutConfigSnapshot>(() => ({
    sessions: initialNormalizedSessions,
    defaultSessionName: event.default_session_name?.trim() || "Full Session",
    defaultSessionTime: event.default_session_time ?? "",
    defaultSessionCheckinDeadline: event.default_session_checkin_deadline ?? "",
    defaultSessionLocation: event.default_session_location ?? "",
    defaultSessionLocationUrl: event.default_session_location_url ?? "",
  }));

  const isDirty = React.useMemo(() => {
    const currentSnapshot: BreakoutConfigSnapshot = {
      sessions,
      defaultSessionName,
      defaultSessionTime,
      defaultSessionCheckinDeadline,
      defaultSessionLocation,
      defaultSessionLocationUrl,
    };
    return serializeBreakoutConfig(currentSnapshot) !== serializeBreakoutConfig(savedConfig);
  }, [
    sessions,
    defaultSessionName,
    defaultSessionTime,
    defaultSessionCheckinDeadline,
    defaultSessionLocation,
    defaultSessionLocationUrl,
    savedConfig,
  ]);

  const handleDiscardChanges = React.useCallback(() => {
    setSessions(savedConfig.sessions);
    setDefaultSessionName(savedConfig.defaultSessionName);
    setDefaultSessionTime(savedConfig.defaultSessionTime);
    setDefaultSessionCheckinDeadline(savedConfig.defaultSessionCheckinDeadline);
    setDefaultSessionLocation(savedConfig.defaultSessionLocation);
    setDefaultSessionLocationUrl(savedConfig.defaultSessionLocationUrl);
    toast.info("Unsaved breakout session changes discarded.");
  }, [savedConfig]);

  const [selectedAgendaKey, setSelectedAgendaKey] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Roster & Check-in Management state
  const [activeRosterSessionId, setActiveRosterSessionId] = React.useState<string>(() => sessions[0]?.id || "");
  const [rosterSearch, setRosterSearch] = React.useState("");
  const [rosterFilter, setRosterFilter] = React.useState<"all" | "checked_in" | "not_checked_in">("all");
  const [checkingInRegId, setCheckingInRegId] = React.useState<string | null>(null);
  const [removingRegId, setRemovingRegId] = React.useState<string | null>(null);

  // Keep activeRosterSessionId synced to the first available session if not set or removed
  React.useEffect(() => {
    if (sessions.length > 0 && (!activeRosterSessionId || !sessions.some((s) => s.id === activeRosterSessionId))) {
      setActiveRosterSessionId(sessions[0].id);
    }
  }, [sessions, activeRosterSessionId]);

  // Add from Registrants modal state
  const [addRegistrantsOpen, setAddRegistrantsOpen] = React.useState(false);
  const [addRegistrantSearch, setAddRegistrantSearch] = React.useState("");
  const [selectedRegIdsToAdd, setSelectedRegIdsToAdd] = React.useState<string[]>([]);
  const [markCheckedInOnAssign, setMarkCheckedInOnAssign] = React.useState(true);
  const [isAssigningRegistrants, setIsAssigningRegistrants] = React.useState(false);

  // QR Scanner modal state
  const [qrScannerOpen, setQrScannerOpen] = React.useState(false);
  const [qrScannerInitialSessionId, setQrScannerInitialSessionId] = React.useState<string | undefined>(undefined);

  // Registration Form Answers Inspector modal state
  const [inspectReg, setInspectReg] = React.useState<FirestoreRegistration | null>(null);

  const questions: CustomQuestion[] = React.useMemo(() => event.custom_questions ?? [], [event.custom_questions]);

  // Load latest event doc & live counts from client Firestore on mount (mirrors CustomFormTab & RegistrantsTab)
  const eventRef = React.useRef(event);
  eventRef.current = event;

  React.useEffect(() => {
    if (isAuthLoading) return;

    let active = true;
    let unsubscribeRegs: () => void = () => {
      // No-op cleanup
    };

    async function loadLatestConfig() {
      try {
        const {
          getFirestoreEventById,
          getEventSessionRegistrationCounts,
          getEventRegistrations,
          subscribeEventRegistrations,
        } = await import("@/lib/firestore/client");
        const [docData, liveCounts, liveRegs] = await Promise.all([
          getFirestoreEventById(eventId),
          getEventSessionRegistrationCounts(eventId),
          getEventRegistrations(eventId),
        ]);
        if (!active) return;

        if (liveRegs.length > 0) {
          setLocalRegistrations(liveRegs);
        }

        unsubscribeRegs = subscribeEventRegistrations(
          eventId,
          (liveList) => {
            if (active) {
              setLocalRegistrations(liveList);
            }
          },
          () => {
            // Ignore live subscription warning
          },
        );

        const loadedSessions = Array.isArray(docData?.sessions) ? docData.sessions : (eventRef.current.sessions ?? []);
        const normalizedLoadedSessions =
          loadedSessions.length > 0
            ? loadedSessions.map((sess) => ({
                ...sess,
                capacity: Number(sess.capacity) || 50,
                total_registered: liveCounts[sess.id] ?? sess.total_registered ?? 0,
                include_in_registration: sess.include_in_registration !== false,
                separate_check_in: sess.separate_check_in !== false,
                sync_check_in_to_bevy: sess.sync_check_in_to_bevy ?? false,
              }))
            : null;
        if (normalizedLoadedSessions) {
          setSessions(normalizedLoadedSessions);
        }

        const nextDefaultName =
          docData?.default_session_name || eventRef.current.default_session_name || "Full Session";
        const nextDefaultTime =
          docData?.default_session_time !== undefined
            ? (docData.default_session_time ?? "")
            : (eventRef.current.default_session_time ?? "");
        const nextDefaultDeadline =
          docData?.default_session_checkin_deadline !== undefined
            ? (docData.default_session_checkin_deadline ?? "")
            : (eventRef.current.default_session_checkin_deadline ?? "");
        const nextDefaultLocation =
          docData?.default_session_location !== undefined
            ? (docData.default_session_location ?? "")
            : (eventRef.current.default_session_location ?? "");
        const nextDefaultLocationUrl =
          docData?.default_session_location_url !== undefined
            ? (docData.default_session_location_url ?? "")
            : (eventRef.current.default_session_location_url ?? "");

        if (docData?.default_session_name) {
          setDefaultSessionName(docData.default_session_name);
        }
        if (docData?.default_session_time !== undefined) {
          setDefaultSessionTime(docData.default_session_time ?? "");
        }
        if (docData?.default_session_checkin_deadline !== undefined) {
          setDefaultSessionCheckinDeadline(docData.default_session_checkin_deadline ?? "");
        }
        if (docData?.default_session_location !== undefined) {
          setDefaultSessionLocation(docData.default_session_location ?? "");
        }
        if (docData?.default_session_location_url !== undefined) {
          setDefaultSessionLocationUrl(docData.default_session_location_url ?? "");
        }

        setSavedConfig((prev) => ({
          sessions: normalizedLoadedSessions ?? prev.sessions,
          defaultSessionName: nextDefaultName,
          defaultSessionTime: nextDefaultTime,
          defaultSessionCheckinDeadline: nextDefaultDeadline,
          defaultSessionLocation: nextDefaultLocation,
          defaultSessionLocationUrl: nextDefaultLocationUrl,
        }));
      } catch (err) {
        console.warn("[BreakoutSessionsTab] Failed to refresh client data:", err);
      }
    }
    void loadLatestConfig();
    return () => {
      active = false;
      unsubscribeRegs();
    };
  }, [eventId, isAuthLoading]);

  // Ensure registrants are freshly loaded when opening the "Add from Registrants" modal or QR Scanner
  React.useEffect(() => {
    if (!addRegistrantsOpen && !qrScannerOpen) return;
    let active = true;
    void (async () => {
      try {
        const { getEventRegistrations } = await import("@/lib/firestore/client");
        const regs = await getEventRegistrations(eventId);
        if (active && regs.length > 0) {
          setLocalRegistrations(regs);
        }
      } catch {
        // Ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [addRegistrantsOpen, qrScannerOpen, eventId]);

  // Flatten agenda activities from `event.agenda` for binding/importing
  const agendaActivities = React.useMemo(() => {
    const days = event.agenda?.days ?? [];
    const list: Array<{
      id: string;
      dayTitle: string;
      title: string;
      timeSlot: string;
      speakerName: string;
      description: string;
    }> = [];

    days.forEach((day, dIdx) => {
      const dayLabel = day.title?.trim() || `Day ${dIdx + 1}`;
      const items = day.items ?? day.agenda ?? [];
      items.forEach((item, iIdx) => {
        if (!item.activity?.trim()) return;
        const speakerMatch =
          findMatchingSpeaker(item.description || "", event.speakers) ??
          findMatchingSpeaker(item.activity, event.speakers);
        const timeSlot = days.length > 1 && item.time ? `${dayLabel} • ${item.time}` : item.time || "";
        list.push({
          id: `item-${dIdx}-${iIdx}`,
          dayTitle: dayLabel,
          title: item.activity.trim(),
          timeSlot,
          speakerName: speakerMatch?.speakerName ?? "",
          description: item.description?.trim() || "",
        });
      });
    });

    return list;
  }, [event.agenda, event.speakers]);

  // Keep activeRosterSessionId valid when sessions list changes
  React.useEffect(() => {
    if (!sessions.some((s) => s.id === activeRosterSessionId)) {
      setActiveRosterSessionId(sessions[0]?.id || "");
    }
  }, [sessions, activeRosterSessionId]);

  // Compute live registered & checked-in counts per session from `localRegistrations`
  const liveSessionStats = React.useMemo(() => {
    const stats: Record<string, { registered: number; checkedIn: number }> = {
      default: { registered: 0, checkedIn: 0 },
    };
    for (const s of sessions) {
      stats[s.id] = { registered: 0, checkedIn: 0 };
    }

    for (const reg of localRegistrations) {
      const isCancelledOrRejected = reg.status === "cancelled" || reg.status === "rejected";

      if (!isCancelledOrRejected && isRegistrationInSession(reg, "default", sessions)) {
        stats.default.registered += 1;
      }
      if (reg.session_check_ins?.default?.is_checked_in) {
        stats.default.checkedIn += 1;
      }

      for (const s of sessions) {
        if (!isCancelledOrRejected && isRegistrationInSession(reg, s.id, sessions)) {
          stats[s.id].registered += 1;
        }
        if (reg.session_check_ins?.[s.id]?.is_checked_in) {
          stats[s.id].checkedIn += 1;
        }
      }
    }

    return stats;
  }, [localRegistrations, sessions]);

  // Session CRUD handlers
  const handleAddManualSession = () => {
    const newId = `sess_${Date.now()}`;
    setSessions((prev) => [
      ...prev,
      {
        id: newId,
        title: "",
        description: "",
        speaker_name: "",
        time_slot: "",
        checkin_deadline: "",
        location: "",
        location_url: "",
        capacity: 50,
        total_registered: 0,
        total_checked_in: 0,
        include_in_registration: true,
        separate_check_in: true,
        sync_check_in_to_bevy: false,
      },
    ]);
    setActiveRosterSessionId(newId);
  };

  const handleAddSessionFromAgenda = (agendaId: string) => {
    const item = agendaActivities.find((a) => a.id === agendaId);
    if (!item) return;

    const newId = `sess_${Date.now()}`;
    setSessions((prev) => [
      ...prev,
      {
        id: newId,
        agenda_activity_id: item.id,
        title: item.title,
        description: item.description,
        speaker_name: item.speakerName,
        time_slot: item.timeSlot,
        capacity: 50,
        total_registered: 0,
        total_checked_in: 0,
        include_in_registration: true,
        separate_check_in: true,
        sync_check_in_to_bevy: false,
      },
    ]);
    setSelectedAgendaKey("");
    setActiveRosterSessionId(newId);
    toast.success(`Added session from Bevy Agenda: "${item.title}"`);
  };

  const handleImportAllFromAgenda = () => {
    if (agendaActivities.length === 0) return;
    const isAlreadyAdded = (act: { id: string; title: string }) => {
      const norm = normalizeStr(act.title);
      return sessions.some((s) => s.agenda_activity_id === act.id || normalizeStr(s.title) === norm);
    };

    const unadded = agendaActivities.filter((a) => !isAlreadyAdded(a));
    if (unadded.length === 0) {
      toast.info("All agenda activities are already added to sessions.");
      return;
    }

    const newSessions: EventSession[] = unadded.map((a, idx) => ({
      id: `sess_${Date.now()}_${idx}`,
      agenda_activity_id: a.id,
      title: a.title,
      description: a.description,
      speaker_name: a.speakerName,
      time_slot: a.timeSlot,
      capacity: 50,
      total_registered: 0,
      total_checked_in: 0,
      include_in_registration: true,
      separate_check_in: true,
      sync_check_in_to_bevy: false,
    }));

    setSessions((prev) => [...prev, ...newSessions]);
    toast.success(`Imported ${newSessions.length} session(s) from Bevy Agenda.`);
  };

  const handleUpdateSession = (index: number, updated: EventSession) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? updated : s)));
  };

  const handleBindSessionToAgenda = (index: number, agendaId: string) => {
    const session = sessions[index];
    if (!session) return;

    if (agendaId === "__none__") {
      handleUpdateSession(index, {
        ...session,
        agenda_activity_id: undefined,
      });
      toast.info("Unbound session from Bevy Agenda (Manual Session).");
      return;
    }

    const item = agendaActivities.find((a) => a.id === agendaId);
    if (!item) return;

    handleUpdateSession(index, {
      ...session,
      agenda_activity_id: item.id,
      title: item.title || session.title,
      time_slot: item.timeSlot || session.time_slot,
      speaker_name: item.speakerName || session.speaker_name,
      description: item.description || session.description,
    });
    toast.success(`Bound session to Bevy Agenda: "${item.title}"`);
  };

  const handleRemoveSession = (index: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveSessions = async () => {
    for (const s of sessions) {
      if (!s.title.trim()) {
        toast.error("All breakout sessions must have a title.");
        return;
      }
      if ((Number(s.capacity) || 0) < 1) {
        toast.error(`Session "${s.title}" must have a capacity limit of at least 1.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await updateEventBreakoutSessionsAction(
        eventId,
        sessions,
        defaultSessionName.trim() || "Full Session",
        event,
        {
          default_session_time: defaultSessionTime,
          default_session_checkin_deadline: defaultSessionCheckinDeadline,
          default_session_location: defaultSessionLocation,
          default_session_location_url: defaultSessionLocationUrl,
        },
      );

      if (res.success) {
        setSavedConfig({
          sessions: structuredClone(sessions),
          defaultSessionName: defaultSessionName.trim() || "Full Session",
          defaultSessionTime,
          defaultSessionCheckinDeadline,
          defaultSessionLocation,
          defaultSessionLocationUrl,
        });
        toast.success("Breakout sessions saved successfully.");
      } else {
        toast.error(res.error || "Failed to save breakout sessions.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Active Roster Session details
  const activeRosterSession = React.useMemo(
    () => sessions.find((s) => s.id === activeRosterSessionId) ?? null,
    [sessions, activeRosterSessionId],
  );

  // Registrants belonging to the active roster session
  const sessionRosterRegistrations = React.useMemo(() => {
    if (!activeRosterSessionId || activeRosterSessionId === "default") {
      return [];
    }
    return localRegistrations.filter((reg) => {
      if (reg.status === "cancelled" || reg.status === "rejected") {
        if (!reg.session_check_ins?.[activeRosterSessionId]?.is_checked_in) {
          return false;
        }
      }
      return isRegistrationInSession(reg, activeRosterSessionId, sessions);
    });
  }, [localRegistrations, activeRosterSessionId, sessions]);

  const filteredRosterRegistrations = React.useMemo(() => {
    return sessionRosterRegistrations.filter((reg) => {
      const checkInRec = reg.session_check_ins?.[activeRosterSessionId];
      const isCheckedIn = Boolean(checkInRec?.is_checked_in);

      if (rosterFilter === "checked_in" && !isCheckedIn) return false;
      if (rosterFilter === "not_checked_in" && isCheckedIn) return false;

      if (!rosterSearch.trim()) return true;
      const q = rosterSearch.trim().toLowerCase();
      const phone = (
        getAnswerDisplay(
          reg,
          ["whatsapp", "phone", "phone_number", "no_hp", "no_wa", "nomor_whatsapp", "mobile"],
          questions,
          ["whatsapp", "phone", "no hp", "nomor wa"],
        ) ||
        reg.member_phone ||
        ""
      ).toLowerCase();
      const org = getRegistrantOrg(reg, questions).toLowerCase();
      const role = getRegistrantRole(reg, questions).toLowerCase();
      const yoe = getRegistrantYoe(reg, questions).toLowerCase();

      return (
        (reg.member_name || "").toLowerCase().includes(q) ||
        (reg.member_email || "").toLowerCase().includes(q) ||
        phone.includes(q) ||
        org.includes(q) ||
        role.includes(q) ||
        yoe.includes(q) ||
        String(reg.bevy_attendee_id || "").includes(q)
      );
    });
  }, [sessionRosterRegistrations, activeRosterSessionId, rosterFilter, rosterSearch, questions]);

  // Registrants available to add manually to the active session
  const availableRegistrantsToAdd = React.useMemo(() => {
    return localRegistrations.filter((reg) => {
      if (reg.status === "cancelled" || reg.status === "rejected") return false;
      if (isRegistrationInSession(reg, activeRosterSessionId, sessions)) {
        return false;
      }
      if (!addRegistrantSearch.trim()) return true;
      const q = addRegistrantSearch.trim().toLowerCase();
      const org = getRegistrantOrg(reg, questions).toLowerCase();
      const role = getRegistrantRole(reg, questions).toLowerCase();
      const yoe = getRegistrantYoe(reg, questions).toLowerCase();
      return (
        (reg.member_name || "").toLowerCase().includes(q) ||
        (reg.member_email || "").toLowerCase().includes(q) ||
        org.includes(q) ||
        role.includes(q) ||
        yoe.includes(q)
      );
    });
  }, [localRegistrations, activeRosterSessionId, sessions, addRegistrantSearch, questions]);

  // Handle manual check-in / undo check-in from roster table
  const handleToggleSessionCheckIn = async (reg: FirestoreRegistration, targetStatus: boolean) => {
    setCheckingInRegId(reg.id);
    try {
      const shouldSyncBevy = activeRosterSession?.sync_check_in_to_bevy ?? false;
      const bevyId = reg.bevy_attendee_id ? Number(reg.bevy_attendee_id) : null;
      const sessionTitle = activeRosterSession?.title || defaultSessionName || "Full Session";

      let syncedToBevy = false;
      if (shouldSyncBevy && bevyId) {
        const bevyRes = await checkInBevyAttendeeAction(eventId, bevyId, targetStatus);
        if (!bevyRes.success) {
          toast.warning(`Firestore updated, but Bevy check-in returned: ${bevyRes.error}`);
        } else {
          syncedToBevy = true;
        }
      }

      const res = await updateBreakoutSessionCheckInAction(
        reg.id,
        eventId,
        activeRosterSessionId,
        sessionTitle,
        targetStatus,
        {
          id: user?.id || "organizer",
          name: user?.name || user?.email || "Organizer",
          email: user?.email || undefined,
          method: "manual",
          bevyAttendeeId: bevyId,
          syncedToBevy,
        },
      );

      if (!res.success) {
        toast.error(res.error || "Failed to update session check-in.");
        return;
      }

      setLocalRegistrations((prev) =>
        prev.map((item) => {
          if (item.id !== reg.id) return item;
          const nextBreakoutIds = Array.from(new Set([...(item.breakout_session_ids ?? []), activeRosterSessionId]));
          const nextSessionCheckIns = {
            ...(item.session_check_ins ?? {}),
            ...(res.record ? { [activeRosterSessionId]: res.record } : {}),
          };
          return {
            ...item,
            breakout_session_ids: nextBreakoutIds,
            session_check_ins: nextSessionCheckIns,
          };
        }),
      );

      toast.success(
        targetStatus
          ? `Checked in ${reg.member_name || reg.member_email}`
          : `Undid check-in for ${reg.member_name || reg.member_email}`,
      );
    } finally {
      setCheckingInRegId(null);
    }
  };

  // Handle removing registrant from breakout session
  const handleRemoveFromSession = async (reg: FirestoreRegistration) => {
    setRemovingRegId(reg.id);
    try {
      const targetTitle = activeRosterSession?.title ?? "";
      const res = await removeRegistrantFromBreakoutSessionAction(eventId, activeRosterSessionId, reg.id, targetTitle);
      if (!res.success) {
        toast.error(res.error || "Failed to remove registrant from session.");
        return;
      }

      const normTitle = targetTitle.trim().toLowerCase();
      setLocalRegistrations((prev) =>
        prev.map((item) => {
          if (item.id !== reg.id) return item;
          const nextBreakout = (item.breakout_session_ids ?? []).filter((id) => id !== activeRosterSessionId);
          const nextCheckIns = { ...(item.session_check_ins ?? {}) };
          delete nextCheckIns[activeRosterSessionId];

          const matchesPrimary =
            item.session_id === activeRosterSessionId ||
            item.answers?.session_id === activeRosterSessionId ||
            (normTitle.length > 0 &&
              typeof item.session_title === "string" &&
              item.session_title.trim().toLowerCase() === normTitle);

          const nextAnswers = item.answers ? { ...item.answers } : undefined;
          if (nextAnswers) {
            if (matchesPrimary || nextAnswers.session_id === activeRosterSessionId) {
              delete nextAnswers.session_id;
              delete nextAnswers.session_title;
            }
            const matchesText = (val: unknown) => {
              if (typeof val !== "string" || !normTitle) return false;
              const clean = val.toLowerCase().split(",")[0].trim();
              return clean === normTitle || clean.includes(normTitle) || normTitle.includes(clean);
            };
            if (matchesPrimary || matchesText(nextAnswers.session_title)) delete nextAnswers.session_title;
            if (matchesPrimary || matchesText(nextAnswers.session)) delete nextAnswers.session;
            if (matchesPrimary || matchesText(nextAnswers.Session)) delete nextAnswers.Session;
          }

          return {
            ...item,
            breakout_session_ids: nextBreakout,
            session_id: matchesPrimary ? null : item.session_id,
            session_title: matchesPrimary ? null : item.session_title,
            answers: nextAnswers,
            session_check_ins: nextCheckIns,
          };
        }),
      );

      toast.success(`Removed ${reg.member_name || reg.member_email} from session.`);
    } finally {
      setRemovingRegId(null);
    }
  };

  // Handle batch assigning registrants to active session
  const handleConfirmAssignRegistrants = async () => {
    if (selectedRegIdsToAdd.length === 0) return;
    setIsAssigningRegistrants(true);
    try {
      const sessionTitle = activeRosterSession?.title || defaultSessionName || "Full Session";
      const reviewer = user
        ? {
            id: user.id,
            name: user.name || user.email || "Organizer",
            email: user.email || undefined,
          }
        : undefined;

      const res = await assignRegistrantsToBreakoutSessionAction(
        eventId,
        activeRosterSessionId,
        sessionTitle,
        selectedRegIdsToAdd,
        markCheckedInOnAssign,
        reviewer,
      );

      if (!res.success) {
        toast.error(res.error || "Failed to assign registrants.");
        return;
      }

      const nowIso = new Date().toISOString();
      const selectedSet = new Set(selectedRegIdsToAdd);

      setLocalRegistrations((prev) =>
        prev.map((item) => {
          if (!selectedSet.has(item.id)) return item;
          const nextBreakout = Array.from(new Set([...(item.breakout_session_ids ?? []), activeRosterSessionId]));
          const nextCheckIns = { ...(item.session_check_ins ?? {}) };
          if (markCheckedInOnAssign) {
            nextCheckIns[activeRosterSessionId] = {
              session_id: activeRosterSessionId,
              session_title: sessionTitle,
              is_checked_in: true,
              checked_in_at: nowIso,
              checked_in_by_id: reviewer?.id ?? "organizer",
              checked_in_by_name: reviewer?.name ?? "Organizer",
              checked_in_by_email: reviewer?.email,
              check_in_method: "manual",
            };
          }
          return {
            ...item,
            breakout_session_ids: nextBreakout,
            session_check_ins: nextCheckIns,
          };
        }),
      );

      toast.success(`Added ${selectedRegIdsToAdd.length} registrant(s) to "${sessionTitle}".`);
      setSelectedRegIdsToAdd([]);
      setAddRegistrantsOpen(false);
    } finally {
      setIsAssigningRegistrants(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION A: BREAKOUT SESSION CONFIGURATION & BEVY AGENDA BINDING */}
      <Card className="shadow-xs">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                <CardTitle className="text-base">Breakout Sessions & Limited Capacities</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {sessions.length} Session{sessions.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Create sessions manually or bind them with Bevy Agenda activities. Configure whether each session
                appears on the pre-event registration form and whether it tracks separate check-ins.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setQrScannerInitialSessionId(activeRosterSessionId);
                  setQrScannerOpen(true);
                }}
              >
                <QrCode className="size-3.5 text-primary" />
                Open Bevy QR Scanner
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {/* Action Toolbar: Bevy Agenda Import + Manual Session Creation */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {agendaActivities.length > 0 && (
                <>
                  <Select
                    value={selectedAgendaKey}
                    onValueChange={(val) => {
                      setSelectedAgendaKey(val);
                      handleAddSessionFromAgenda(val);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[240px] bg-background text-xs">
                      <Calendar className="mr-1.5 size-3.5 text-primary" />
                      <SelectValue placeholder="Add from Bevy Agenda..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agendaActivities.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-xs">
                          {item.timeSlot ? `[${item.timeSlot}] ` : ""}
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleImportAllFromAgenda}
                    className="h-8 text-xs"
                  >
                    <Sparkles className="mr-1.5 size-3.5" />
                    Add All from Agenda
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSessions(
                    DEFAULT_GDG_SESSIONS.map((s) => ({
                      ...s,
                      include_in_registration: true,
                      separate_check_in: true,
                      sync_check_in_to_bevy: false,
                    })),
                  );
                  toast.success("Loaded default sessions (Morning, Afternoon).");
                }}
                className="h-8 text-xs"
              >
                <Sparkles className="mr-1.5 size-3.5" />
                Load Default Sessions
              </Button>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleAddManualSession}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Add Custom / Manual Session
            </Button>
          </div>

          {/* Default Main Session (Fallback) */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-sm">Default Main Session (Fallback)</h4>
                <Badge variant="secondary" className="text-[10px]">
                  Registered: {liveSessionStats.default?.registered ?? sessionCounts.default ?? 0}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                Registrants who do not select a specific pre-event breakout session are automatically grouped here
                (attendee list & check-in are managed in the main Registrants tab).
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Default Session Title *</Label>
                <Input
                  value={defaultSessionName}
                  onChange={(e) => setDefaultSessionName(e.target.value)}
                  placeholder="Full Session"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default Time Slot (Optional)</Label>
                <Input
                  value={defaultSessionTime}
                  onChange={(e) => setDefaultSessionTime(e.target.value)}
                  placeholder="e.g. 12:15 WIB - 17:00 WIB"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Check-in Deadline (Optional)</Label>
                <Input
                  value={defaultSessionCheckinDeadline}
                  onChange={(e) => setDefaultSessionCheckinDeadline(e.target.value)}
                  placeholder="e.g. 13:15 WIB"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Room / Location (Optional)</Label>
                <Input
                  value={defaultSessionLocation}
                  onChange={(e) => setDefaultSessionLocation(e.target.value)}
                  placeholder={
                    event.venue?.name ? `e.g. ${event.venue.name} (Main Stage)` : "e.g. Main Auditorium / Venue"
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location URL / Maps Link (Optional)</Label>
                <Input
                  value={defaultSessionLocationUrl}
                  onChange={(e) => setDefaultSessionLocationUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Breakout Sessions List */}
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <Layers className="mb-2 size-8 text-muted-foreground/50" />
              <p className="font-medium text-sm">No custom breakout sessions configured</p>
              <p className="mt-1 max-w-md text-muted-foreground text-xs">
                Add a manual session or import from your Bevy Event Agenda to configure pre-event form visibility,
                separate check-in tracking, and on-site QR scanning.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, idx) => {
                const currentRegistered =
                  liveSessionStats[session.id]?.registered ??
                  sessionCounts[session.id] ??
                  session.total_registered ??
                  0;
                const currentCheckedIn = liveSessionStats[session.id]?.checkedIn ?? session.total_checked_in ?? 0;
                const boundAgendaItem = agendaActivities.find((a) => a.id === session.agenda_activity_id);

                return (
                  <div
                    key={session.id}
                    className={`space-y-4 rounded-xl border p-4 transition-colors ${
                      activeRosterSessionId === session.id ? "border-primary/50 bg-primary/[0.02]" : "bg-card/50"
                    }`}
                  >
                    {/* Header Row: Badges & Quick Roster / QR Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Session #{idx + 1}
                        </Badge>
                        {session.agenda_activity_id ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-blue-500/10 text-[11px] text-blue-700 dark:text-blue-300"
                          >
                            <Link2 className="size-3" />
                            Bound to Bevy Agenda
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            Manual Session
                          </Badge>
                        )}
                        <Badge
                          variant={session.include_in_registration !== false ? "default" : "secondary"}
                          className="text-[11px]"
                        >
                          {session.include_in_registration !== false
                            ? "Pre-Event Registration Form"
                            : "Manual / On-Site Only"}
                        </Badge>
                        <Badge
                          variant={currentRegistered >= (session.capacity || 1) ? "destructive" : "secondary"}
                          className="text-[11px]"
                        >
                          Assigned: {currentRegistered} / {session.capacity}
                        </Badge>
                        {session.separate_check_in !== false && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300"
                          >
                            Checked In: {currentCheckedIn}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant={activeRosterSessionId === session.id ? "default" : "outline"}
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setActiveRosterSessionId(session.id)}
                        >
                          <Users className="size-3.5" />
                          Roster & Check-in ({currentRegistered})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            setActiveRosterSessionId(session.id);
                            setQrScannerInitialSessionId(session.id);
                            setQrScannerOpen(true);
                          }}
                        >
                          <QrCode className="size-3.5 text-primary" />
                          Scan QR
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveSession(idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Bevy Agenda Binding Row */}
                    {agendaActivities.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                        <div className="flex items-center gap-2 text-xs">
                          {session.agenda_activity_id ? (
                            <Link2 className="size-3.5 text-primary" />
                          ) : (
                            <Link2Off className="size-3.5 text-muted-foreground" />
                          )}
                          <span className="font-medium">Bevy Agenda Binding:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={session.agenda_activity_id || "__none__"}
                            onValueChange={(val) => handleBindSessionToAgenda(idx, val)}
                          >
                            <SelectTrigger className="h-8 w-[260px] bg-background text-xs">
                              <SelectValue placeholder="None (Manual / Custom Session)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">
                                None — Manual / Custom Session
                              </SelectItem>
                              {agendaActivities.map((item) => (
                                <SelectItem key={item.id} value={item.id} className="text-xs">
                                  {item.timeSlot ? `[${item.timeSlot}] ` : ""}
                                  {item.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {boundAgendaItem && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleBindSessionToAgenda(idx, boundAgendaItem.id)}
                            >
                              <RefreshCw className="size-3" />
                              Sync Fields from Agenda
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Core Session Fields */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Session Title *</Label>
                        <Input
                          value={session.title}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              title: e.target.value,
                            })
                          }
                          placeholder="e.g., Hands-on Workshop: Gemini API"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Time Slot</Label>
                        <Input
                          value={session.time_slot ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              time_slot: e.target.value,
                            })
                          }
                          placeholder="e.g., 08:15 WIB - 12:00 WIB"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Check-in Deadline</Label>
                        <Input
                          value={session.checkin_deadline ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              checkin_deadline: e.target.value,
                            })
                          }
                          placeholder="e.g., 09:05 WIB"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Capacity Limit *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={session.capacity}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              capacity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Room / Location</Label>
                        <Input
                          value={session.location ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              location: e.target.value,
                            })
                          }
                          placeholder="e.g., Auditorium / Main Venue"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Location URL / Google Maps Link (Optional)</Label>
                          {session.location_url && (
                            <a
                              href={session.location_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              Open map <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </div>
                        <Input
                          value={session.location_url ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              location_url: e.target.value,
                            })
                          }
                          placeholder="https://maps.app.goo.gl/... or https://maps.google.com/..."
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-3">
                        <Label className="text-xs">Description / Prerequisites (HTML Format)</Label>
                        <HtmlEditText
                          value={session.description ?? ""}
                          placeholder="Session prerequisites or topics in HTML..."
                          onChange={(val) =>
                            handleUpdateSession(idx, {
                              ...session,
                              description: val,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Speaker Name (Optional)</Label>
                        <Input
                          value={session.speaker_name ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              speaker_name: e.target.value,
                            })
                          }
                          placeholder="e.g., Jane Doe (GDE AI)"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Presentation Slides URL (Optional)</Label>
                        <Input
                          value={session.slides_url ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              slides_url: e.target.value,
                            })
                          }
                          placeholder="https://docs.google.com/presentation/..."
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Slides Button Title (Optional)</Label>
                        <Input
                          value={session.slides_title ?? ""}
                          onChange={(e) =>
                            handleUpdateSession(idx, {
                              ...session,
                              slides_title: e.target.value,
                            })
                          }
                          placeholder="e.g., Keynote Deck"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:col-span-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground text-xs">Related Resources & Code Links</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() => {
                              const current = session.related_links ?? [];
                              handleUpdateSession(idx, {
                                ...session,
                                related_links: [...current, { title: "", url: "" }],
                              });
                            }}
                          >
                            <Plus className="size-3" />
                            Add Link
                          </Button>
                        </div>

                        {session.related_links && session.related_links.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            {session.related_links.map((link, lIdx) => (
                              <div key={`${link.url}-${lIdx}`} className="flex items-center gap-2">
                                <Input
                                  placeholder="Title (e.g. GitHub Repo / Colab)"
                                  value={link.title}
                                  className="h-8 text-xs"
                                  onChange={(e) => {
                                    const updated = [...(session.related_links ?? [])];
                                    updated[lIdx] = {
                                      ...updated[lIdx],
                                      title: e.target.value,
                                    };
                                    handleUpdateSession(idx, {
                                      ...session,
                                      related_links: updated,
                                    });
                                  }}
                                />
                                <Input
                                  placeholder="URL (https://github.com/...)"
                                  value={link.url}
                                  className="h-8 text-xs"
                                  onChange={(e) => {
                                    const updated = [...(session.related_links ?? [])];
                                    updated[lIdx] = {
                                      ...updated[lIdx],
                                      url: e.target.value,
                                    };
                                    handleUpdateSession(idx, {
                                      ...session,
                                      related_links: updated,
                                    });
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    const updated = (session.related_links ?? []).filter((_, idx2) => idx2 !== lIdx);
                                    handleUpdateSession(idx, {
                                      ...session,
                                      related_links: updated,
                                    });
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            No related links added. Click &ldquo;Add Link&rdquo; to link repositories or docs.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Per-Session Configuration Toggles */}
                    <div className="grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-3">
                      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className="space-y-0.5">
                          <Label className="font-medium text-xs">Include in Pre-Event Registration Form</Label>
                          <p className="text-[11px] text-muted-foreground">
                            {session.include_in_registration !== false
                              ? "Selectable by attendees during registration"
                              : "Hidden from form; assign manually or via QR"}
                          </p>
                        </div>
                        <Switch
                          checked={session.include_in_registration !== false}
                          onCheckedChange={(checked) =>
                            handleUpdateSession(idx, {
                              ...session,
                              include_in_registration: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className="space-y-0.5">
                          <Label className="font-medium text-xs">Separate Session Check-in</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Track session check-ins independently in Firestore
                          </p>
                        </div>
                        <Switch
                          checked={session.separate_check_in !== false}
                          onCheckedChange={(checked) =>
                            handleUpdateSession(idx, {
                              ...session,
                              separate_check_in: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className="space-y-0.5">
                          <Label className="font-medium text-xs">Sync Check-in to Bevy API</Label>
                          <p className="text-[11px] text-muted-foreground">
                            {session.sync_check_in_to_bevy
                              ? "Also marks attendee checked-in on Bevy"
                              : "Logs session check-in to Firestore only"}
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(session.sync_check_in_to_bevy)}
                          onCheckedChange={(checked) =>
                            handleUpdateSession(idx, {
                              ...session,
                              sync_check_in_to_bevy: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION B: SESSION ATTENDEE & CHECK-IN ROSTER (ONLY FOR BREAKOUT SESSIONS) */}
      {sessions.length > 0 && (
        <Card className="shadow-xs">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  <CardTitle className="text-base">Session Attendee & Check-in Roster</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  View attendees assigned or checked into each breakout session using their submitted registration form
                  data, assign registrants manually, or scan their Bevy QR (<code>{eventId}:attendeeId</code>).
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setSelectedRegIdsToAdd([]);
                    setAddRegistrantSearch("");
                    setMarkCheckedInOnAssign(activeRosterSession?.separate_check_in !== false);
                    setAddRegistrantsOpen(true);
                  }}
                >
                  <UserPlus className="size-3.5" />
                  Add from Registrants
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setQrScannerInitialSessionId(activeRosterSessionId);
                    setQrScannerOpen(true);
                  }}
                >
                  <QrCode className="size-3.5" />
                  Scan Bevy QR for Session
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* Session Selector & Filter Controls */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <Label className="mb-1 block text-muted-foreground text-xs">Selected Breakout Session</Label>
                <Select value={activeRosterSessionId} onValueChange={setActiveRosterSessionId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select breakout session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.title || "Untitled Session"} ({liveSessionStats[s.id]?.registered ?? 0} assigned •{" "}
                        {liveSessionStats[s.id]?.checkedIn ?? 0} checked in)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-5">
                <Label className="mb-1 block text-muted-foreground text-xs">Search Session Roster</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search name, email, phone, institution, or Bevy ID..."
                    className="h-9 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <Label className="mb-1 block text-muted-foreground text-xs">Check-in Filter</Label>
                <Select
                  value={rosterFilter}
                  onValueChange={(v) => setRosterFilter(v as "all" | "checked_in" | "not_checked_in")}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All in Session ({sessionRosterRegistrations.length})
                    </SelectItem>
                    <SelectItem value="checked_in" className="text-xs">
                      Checked In Only ({liveSessionStats[activeRosterSessionId]?.checkedIn ?? 0})
                    </SelectItem>
                    <SelectItem value="not_checked_in" className="text-xs">
                      Not Checked In
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs">Attendee</TableHead>
                    <TableHead className="text-xs">Institution / Role (Form Data)</TableHead>
                    <TableHead className="text-xs">Ticket & Status</TableHead>
                    <TableHead className="text-xs">Assignment Source</TableHead>
                    <TableHead className="text-xs">Session Check-in</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRosterRegistrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-muted-foreground text-xs">
                        No attendees found in this session matching your filters. Use &ldquo;Add from Registrants&rdquo;
                        or &ldquo;Scan Bevy QR for Session&rdquo; to add participants.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRosterRegistrations.map((reg) => {
                      const checkInRec = reg.session_check_ins?.[activeRosterSessionId];
                      const isSessionCheckedIn = Boolean(checkInRec?.is_checked_in);
                      const isFromPreEventForm =
                        reg.session_id === activeRosterSessionId || reg.answers?.session_id === activeRosterSessionId;
                      const phone =
                        getAnswerDisplay(
                          reg,
                          ["whatsapp", "phone", "phone_number", "no_hp", "no_wa", "nomor_whatsapp", "mobile"],
                          questions,
                          ["whatsapp", "phone", "no hp", "nomor wa"],
                        ) ||
                        reg.member_phone ||
                        "";
                      const org = getRegistrantOrg(reg, questions);
                      const role = getRegistrantRole(reg, questions);
                      const yoe = getRegistrantYoe(reg, questions);

                      return (
                        <TableRow key={reg.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8 border">
                                <AvatarImage src={reg.member_avatar || undefined} alt={reg.member_name} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(reg.member_name || reg.member_email || "U")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-xs">
                                  {reg.member_name || "Unnamed Registrant"}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <Mail className="size-3" />
                                    {reg.member_email}
                                  </span>
                                  {phone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="size-3" />
                                      {phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-xs">
                            {org || role || yoe ? (
                              <div className="space-y-0.5">
                                {org && (
                                  <p className="flex items-center gap-1 font-medium">
                                    <Building2 className="size-3 text-muted-foreground" />
                                    {org}
                                  </p>
                                )}
                                {(role || yoe) && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {[role, yoe].filter(Boolean).join(" • ")}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs">
                            <div className="flex flex-col items-start gap-1">
                              {(() => {
                                const statusMeta = getStatusMeta(reg.status);
                                return (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "gap-1.5 border px-2 py-0.5 font-medium text-[11px]",
                                      statusMeta.badgeClass,
                                    )}
                                  >
                                    <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                                    {statusMeta.label}
                                  </Badge>
                                );
                              })()}
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Ticket className="size-3" />
                                {reg.ticket_name || reg.bundle_name || reg.ticket_tier || "General"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-xs">
                            {checkInRec?.check_in_method === "qr_scan" ? (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                <QrCode className="size-3 text-primary" />
                                Bevy QR Scan
                              </Badge>
                            ) : isFromPreEventForm ? (
                              <Badge variant="secondary" className="text-[10px]">
                                Pre-Event Form
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Manual / On-Site
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs">
                            {isSessionCheckedIn ? (
                              <div className="space-y-0.5">
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                                >
                                  <CheckCircle2 className="size-3" />
                                  Checked In
                                </Badge>
                                {checkInRec?.checked_in_at && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(checkInRec.checked_in_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                                <Clock className="size-3" />
                                Not Checked In
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isSessionCheckedIn ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-xs"
                                  disabled={checkingInRegId === reg.id}
                                  onClick={() => handleToggleSessionCheckIn(reg, false)}
                                >
                                  {checkingInRegId === reg.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Undo2 className="size-3" />
                                  )}
                                  Undo
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 gap-1 px-2.5 text-xs"
                                  disabled={checkingInRegId === reg.id}
                                  onClick={() => handleToggleSessionCheckIn(reg, true)}
                                >
                                  {checkingInRegId === reg.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="size-3" />
                                  )}
                                  Check In
                                </Button>
                              )}

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="View Registration Form Answers"
                                onClick={() => setInspectReg(reg)}
                              >
                                <ClipboardList className="size-3.5" />
                              </Button>

                              {activeRosterSessionId !== "default" && isSuperAdmin && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:text-destructive"
                                  title="Remove from Session"
                                  disabled={removingRegId === reg.id}
                                  onClick={() => handleRemoveFromSession(reg)}
                                >
                                  {removingRegId === reg.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <UserMinus className="size-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DIALOG 1: ADD FROM REGISTRANTS (MANUAL PARTICIPANT ASSIGNMENT) */}
      <Dialog open={addRegistrantsOpen} onOpenChange={setAddRegistrantsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              Add Registrants to &ldquo;
              {activeRosterSession?.title || defaultSessionName}&rdquo;
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select existing event registrants to assign them to this session using their registration form profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={addRegistrantSearch}
                onChange={(e) => setAddRegistrantSearch(e.target.value)}
                placeholder="Search registrants by name, email, or institution..."
                className="h-9 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mark-checked-in-on-assign"
                  checked={markCheckedInOnAssign}
                  onCheckedChange={(v) => setMarkCheckedInOnAssign(Boolean(v))}
                />
                <Label htmlFor="mark-checked-in-on-assign" className="cursor-pointer font-medium text-xs">
                  Also mark selected registrants as Checked-in to this session
                </Label>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {selectedRegIdsToAdd.length} selected
              </Badge>
            </div>

            <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {availableRegistrantsToAdd.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  No additional registrants available to add.
                </div>
              ) : (
                availableRegistrantsToAdd.map((reg) => {
                  const checked = selectedRegIdsToAdd.includes(reg.id);
                  const org = getRegistrantOrg(reg, questions);
                  const role = getRegistrantRole(reg, questions);
                  const yoe = getRegistrantYoe(reg, questions);
                  const roleWithYoe = [role, yoe ? `(${yoe})` : ""].filter(Boolean).join(" ");
                  const orgRoleSummary = [roleWithYoe, org].filter(Boolean).join(" @ ");
                  return (
                    <label
                      key={reg.id}
                      htmlFor={`assign-reg-${reg.id}`}
                      className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          id={`assign-reg-${reg.id}`}
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            setSelectedRegIdsToAdd((prev) =>
                              isChecked ? [...prev, reg.id] : prev.filter((id) => id !== reg.id),
                            );
                          }}
                        />
                        <div>
                          <p className="font-medium text-xs">{reg.member_name || "Unnamed Registrant"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {reg.member_email}
                            {orgRoleSummary ? ` • ${orgRoleSummary}` : ""}
                          </p>
                        </div>
                      </div>
                      {(() => {
                        const statusMeta = getStatusMeta(reg.status);
                        return (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 gap-1.5 border px-2 py-0.5 font-medium text-[11px]",
                              statusMeta.badgeClass,
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                            {statusMeta.label}
                          </Badge>
                        );
                      })()}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddRegistrantsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedRegIdsToAdd.length === 0 || isAssigningRegistrants}
              onClick={handleConfirmAssignRegistrants}
            >
              {isAssigningRegistrants && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Add {selectedRegIdsToAdd.length} Registrant
              {selectedRegIdsToAdd.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: INSPECT REGISTRATION FORM ANSWERS */}
      <Dialog open={Boolean(inspectReg)} onOpenChange={(open) => !open && setInspectReg(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              Registration Form Submission — {inspectReg?.member_name || inspectReg?.member_email}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Full registration form input data submitted by this attendee.
            </DialogDescription>
          </DialogHeader>

          {inspectReg && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{inspectReg.member_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-0.5">
                    {(() => {
                      const statusMeta = getStatusMeta(inspectReg.status);
                      return (
                        <Badge
                          variant="outline"
                          className={cn("gap-1.5 border px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}
                        >
                          <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                          {statusMeta.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Ticket:</span>
                  <p className="font-medium">
                    {inspectReg.ticket_name || inspectReg.bundle_name || inspectReg.ticket_tier || "General Admission"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bevy ID:</span>
                  <p className="font-mono font-medium">
                    {inspectReg.bevy_attendee_id ? `#${inspectReg.bevy_attendee_id}` : "Not linked"}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border p-3">
                <h4 className="font-semibold text-xs">Submitted Form Answers</h4>
                {inspectReg.answers &&
                Object.keys(inspectReg.answers).some((k) => k !== "session_id" && k !== "bevy_user_id") ? (
                  <div className="divide-y">
                    {Object.entries(inspectReg.answers)
                      .filter(([qId]) => qId !== "session_id" && qId !== "bevy_user_id")
                      .map(([qId, val]) => {
                        const label = formatAnswerLabel(qId, questions);
                        const formatted = Array.isArray(val) ? val.join(", ") : String(val || "-");
                        return (
                          <div key={qId} className="grid grid-cols-3 items-baseline gap-2 py-2">
                            <span className="font-medium text-muted-foreground">{label}</span>
                            <span className="col-span-2 break-words font-medium text-foreground">{formatted}</span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No custom form answers submitted.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: MULTI-MODE BEVY QR SCANNER */}
      <QrCheckInScannerDialog
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        eventId={eventId}
        eventTitle={event.title}
        initialMode="session_checkin"
        initialSessionId={qrScannerInitialSessionId || activeRosterSessionId}
        sessions={sessions}
        registrations={localRegistrations}
        questions={questions}
        onRegistrationUpdated={(updated) => {
          setLocalRegistrations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }}
      />

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSaveSessions}
        onDiscard={handleDiscardChanges}
        saveLabel="Save Breakout Sessions"
        savingLabel="Saving Sessions..."
        statusInfo={`${sessions.length} session${sessions.length === 1 ? "" : "s"} configured`}
        helperText="Session capacities & check-in rules will immediately apply."
      />
    </div>
  );
}
