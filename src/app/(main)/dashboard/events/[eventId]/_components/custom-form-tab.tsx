"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Copy,
  ExternalLink,
  FileEdit,
  Globe,
  Layers,
  Link2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { DatePicker } from "@/components/date-picker";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { findMatchingSpeaker, normalizeStr } from "@/lib/events/agenda-unification";
import { isEventCurationMode } from "@/lib/events/payment-deadline";
import {
  COMMITMENT_FEE_TEMPLATE,
  COMMON_MEETUP_TEMPLATE,
  CURATED_COMMITMENT_FEE_TEMPLATE,
  CURATED_FREE_TEMPLATE,
  CURATED_MULTI_COMMITMENT_TEMPLATE,
  CURATED_MULTI_FREE_TEMPLATE,
  CURATED_MULTI_PAID_TEMPLATE,
  DEFAULT_COMBINED_QUESTIONS,
  DEFAULT_GDG_SESSIONS,
  DEFAULT_PAYMENT_DETAILS_QUESTIONS,
  detectDuplicateRegistrationFields,
  EVENT_FORMAT_TEMPLATES,
  FREE_REGISTRATION_TEMPLATE,
  getRegistrationWindowStatus,
  hasPaidTicketOrMerchandise,
  MULTI_TRACK_TEMPLATE,
  PAID_REGISTRATION_TEMPLATE,
  QUICK_RSVP_TEMPLATE,
  ROAD_TO_DEVFEST_TEMPLATE,
} from "@/lib/events/registration-defaults";
import type { CustomQuestion, EventSession, EventTicketTier, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { type CopiedFormData, CopyEventFormDialog } from "./copy-event-form-dialog";
import { HtmlEditText } from "./html-edit-text";
import { SortableQuestionCard } from "./sortable-question-card";

function toDateTimeLocal(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function fromDateTimeLocal(localString?: string | null): string | null {
  if (!localString || !localString.trim()) return null;
  try {
    const d = new Date(localString);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

interface CustomFormTabProps {
  event: FirestoreEvent;
  onSwitchTab?: (tab: string) => void;
}

export function CustomFormTab({ event, onSwitchTab }: CustomFormTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [requiresApproval, setRequiresApproval] = useState(() => isEventCurationMode(event));
  const [allowWaitlist, setAllowWaitlist] = useState(event.allow_waitlist !== false);
  const [maxAttendees, setMaxAttendees] = useState(event.max_attendees ? String(event.max_attendees) : "");

  // 2. Registration Schedule & Publishing Status
  const [registrationStatus, setRegistrationStatus] = useState<"Draft" | "Published" | "Closed">(
    event.registration_status ?? "Closed",
  );
  const [registrationStartDate, setRegistrationStartDate] = useState<string>(
    toDateTimeLocal(event.registration_start_date),
  );
  const [registrationEndDate, setRegistrationEndDate] = useState<string>(toDateTimeLocal(event.registration_end_date));

  // 3. Event Sessions (Split into Sessions with Limited Capacity or Single Session Defaults)
  const [sessions, setSessions] = useState<EventSession[]>(event.sessions ?? []);
  const [defaultSessionName, setDefaultSessionName] = useState<string>(
    event.default_session_name?.trim() || "Full Session",
  );
  const [defaultSessionTime, setDefaultSessionTime] = useState<string>(event.default_session_time ?? "");
  const [defaultSessionCheckinDeadline, setDefaultSessionCheckinDeadline] = useState<string>(
    event.default_session_checkin_deadline ?? "",
  );
  const [defaultSessionLocation, setDefaultSessionLocation] = useState<string>(event.default_session_location ?? "");
  const [defaultSessionLocationUrl, setDefaultSessionLocationUrl] = useState<string>(
    event.default_session_location_url ?? "",
  );
  const [googleMapsUrlOverride, setGoogleMapsUrlOverride] = useState<string>(
    event.google_maps_url ?? event.venue?.google_maps_url ?? "",
  );
  const [newSession, setNewSession] = useState<Omit<EventSession, "id">>({
    title: "",
    description: "",
    time_slot: "",
    checkin_deadline: "",
    location: "",
    location_url: "",
    capacity: 50,
    speaker_name: "",
    slides_url: "",
    slides_title: "",
    related_links: [],
  });
  const [newSessionLinkTitle, setNewSessionLinkTitle] = useState("");
  const [newSessionLinkUrl, setNewSessionLinkUrl] = useState("");
  const [showAddSession, setShowAddSession] = useState(false);

  // 4. Derived Capacity & Multi-Session Calculation (only pre-event registration sessions count toward form capacity split)
  const preEventRegistrationSessions = sessions.filter((sess) => sess.include_in_registration !== false);
  const hasMultipleSessions = preEventRegistrationSessions.length > 0;
  const totalSessionCapacity = preEventRegistrationSessions.reduce(
    (acc, sess) => acc + (Number(sess.capacity) || 0),
    0,
  );

  // 5. Registration Questions
  const [questions, setQuestions] = useState<CustomQuestion[]>(event.custom_questions ?? []);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<"all" | "curated" | "standard">("all");

  // Question expansion states (can be toggled individually or collapsed/expanded all; collapsed by default)
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(() => new Set());

  const handleToggleExpandQuestion = (id: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const areAllQuestionsCollapsed = questions.length > 0 && expandedQuestionIds.size === 0;

  const handleToggleExpandAllQuestions = () => {
    if (areAllQuestionsCollapsed) {
      setExpandedQuestionIds(new Set(questions.map((q) => q.id)));
    } else {
      setExpandedQuestionIds(new Set());
    }
  };

  // 6. Event Tickets (Configured via Ticket Tiers or Format Template Presets)
  const [tickets, setTickets] = useState<EventTicketTier[]>(() => event.tickets ?? []);

  // Payment detection (paid tickets, commitment fees, or paid merchandise)
  const isPaymentRequired = useMemo(() => {
    return hasPaidTicketOrMerchandise({
      tickets,
      merchandise: event.merchandise,
      bundles: event.bundles,
    });
  }, [tickets, event.merchandise, event.bundles]);

  // Duplicate registration fields report
  const duplicateReport = useMemo(() => {
    return detectDuplicateRegistrationFields(questions);
  }, [questions]);

  // 7. Form Snapshot & Dirty State Tracking
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

  // Auto-inject locked Payment Details questions when payment is detected
  useEffect(() => {
    if (!isInitialLoaded) return;
    if (isPaymentRequired) {
      setQuestions((prev) => {
        const hasPaymentDetails = prev.some((q) => q.section === "Payment Details" || q.is_payment_required_field);
        if (hasPaymentDetails) return prev;

        // Automatically inject locked Payment Details questions at the beginning
        // and remove duplicate non-payment questions for full_name, email, whatsapp to keep it clean
        const otherQuestions = prev.filter(
          (q) =>
            q.id !== "full_name" &&
            q.id !== "email" &&
            q.id !== "whatsapp" &&
            q.label.toLowerCase() !== "full name" &&
            q.label.toLowerCase() !== "email address" &&
            q.label.toLowerCase() !== "whatsapp phone number",
        );
        return [...DEFAULT_PAYMENT_DETAILS_QUESTIONS, ...otherQuestions];
      });
    }
  }, [isPaymentRequired, isInitialLoaded]);

  const handleRemoveDuplicateQuestions = () => {
    setQuestions((prev) => {
      const paymentQuestions = prev.filter((q) => q.section === "Payment Details" || q.is_payment_required_field);
      if (paymentQuestions.length === 0) return prev;

      const hasPaymentName = paymentQuestions.some(
        (q) => q.id === "full_name" || q.label.toLowerCase().includes("full name"),
      );
      const hasPaymentEmail = paymentQuestions.some(
        (q) => q.id === "email" || q.label.toLowerCase() === "email" || q.label.toLowerCase() === "email address",
      );
      const hasPaymentPhone = paymentQuestions.some(
        (q) =>
          q.id === "whatsapp" || q.label.toLowerCase().includes("whatsapp") || q.label.toLowerCase().includes("phone"),
      );

      const filtered = prev.filter((q) => {
        if (q.section === "Payment Details" || q.is_payment_required_field) return true;
        // Keep work_email intact
        if (q.id === "work_email" || q.label.toLowerCase().includes("work email")) return true;

        const lower = q.label.toLowerCase();
        if (
          hasPaymentName &&
          (q.id === "full_name" ||
            (lower.includes("full name") && !lower.includes("billing") && !lower.includes("receipt")))
        ) {
          return false;
        }
        if (hasPaymentEmail && (q.id === "email" || lower === "email" || lower === "email address")) return false;
        if (hasPaymentPhone && (q.id === "whatsapp" || lower.includes("whatsapp"))) return false;

        return true;
      });

      toast.success("Removed duplicate questions from other sections.");
      return filtered;
    });
  };

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      requiresApproval,
      allowWaitlist,
      maxAttendees,
      sessions,
      defaultSessionName,
      defaultSessionTime,
      defaultSessionCheckinDeadline,
      defaultSessionLocation,
      defaultSessionLocationUrl,
      tickets,
      questions,
      registrationStatus,
      registrationStartDate,
      registrationEndDate,
      googleMapsUrlOverride: googleMapsUrlOverride.trim(),
    });
  }, [
    requiresApproval,
    allowWaitlist,
    maxAttendees,
    sessions,
    defaultSessionName,
    defaultSessionTime,
    defaultSessionCheckinDeadline,
    defaultSessionLocation,
    defaultSessionLocationUrl,
    tickets,
    questions,
    registrationStatus,
    registrationStartDate,
    registrationEndDate,
    googleMapsUrlOverride,
  ]);

  const isDirty =
    isInitialLoaded && initialSnapshotRef.current !== null && initialSnapshotRef.current !== currentSnapshot;

  // 8. Copy Form modal & Exit confirmation modal states
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  const eventRef = useRef(event);
  eventRef.current = event;

  // Load any previously saved Firestore settings on client mount
  useEffect(() => {
    const eventId = String(event.id);
    const currentEvent = eventRef.current;
    setIsInitialLoaded(false);

    async function loadSavedFirestoreConfig() {
      try {
        const { getFirestoreEventById, getEventSessionRegistrationCounts } = await import("@/lib/firestore/client");
        const [docData, liveSessionCounts] = await Promise.all([
          getFirestoreEventById(eventId),
          getEventSessionRegistrationCounts(eventId),
        ]);

        const loadedApproval = docData ? isEventCurationMode(docData) : isEventCurationMode(currentEvent);
        const loadedAllowWaitlist =
          docData?.allow_waitlist !== undefined ? docData.allow_waitlist : currentEvent.allow_waitlist !== false;
        let loadedMaxAttendees = "";
        if (docData?.max_attendees !== undefined && docData.max_attendees !== null) {
          loadedMaxAttendees = String(docData.max_attendees);
        } else if (currentEvent.max_attendees) {
          loadedMaxAttendees = String(currentEvent.max_attendees);
        }
        let loadedSessions = Array.isArray(docData?.sessions) ? docData.sessions : (currentEvent.sessions ?? []);
        if (Object.keys(liveSessionCounts).length > 0) {
          loadedSessions = loadedSessions.map((sess) => ({
            ...sess,
            total_registered: liveSessionCounts[sess.id] ?? sess.total_registered ?? 0,
          }));
        }
        const loadedTickets = Array.isArray(docData?.tickets) ? docData.tickets : (currentEvent.tickets ?? []);
        let loadedQuestions: CustomQuestion[] = [];
        if (docData?.custom_questions && Array.isArray(docData.custom_questions)) {
          loadedQuestions = docData.custom_questions;
        } else if (currentEvent.custom_questions && Array.isArray(currentEvent.custom_questions)) {
          loadedQuestions = currentEvent.custom_questions;
        }
        const loadedStatus = (docData?.registration_status || currentEvent.registration_status || "Closed") as
          | "Draft"
          | "Published"
          | "Closed";
        const loadedStartDate = toDateTimeLocal(
          docData?.registration_start_date ?? currentEvent.registration_start_date,
        );
        const loadedEndDate = toDateTimeLocal(docData?.registration_end_date ?? currentEvent.registration_end_date);
        const loadedDefaultSessionName =
          docData?.default_session_name?.trim() || currentEvent.default_session_name?.trim() || "Full Session";
        const loadedDefaultSessionTime = docData?.default_session_time ?? currentEvent.default_session_time ?? "";
        const loadedDefaultSessionCheckinDeadline =
          docData?.default_session_checkin_deadline ?? currentEvent.default_session_checkin_deadline ?? "";
        const loadedDefaultSessionLocation =
          docData?.default_session_location ?? currentEvent.default_session_location ?? "";
        const loadedDefaultSessionLocationUrl =
          docData?.default_session_location_url ?? currentEvent.default_session_location_url ?? "";
        const loadedGoogleMapsUrl = (
          docData?.google_maps_url ??
          docData?.venue?.google_maps_url ??
          currentEvent.google_maps_url ??
          currentEvent.venue?.google_maps_url ??
          ""
        ).trim();

        setRequiresApproval(loadedApproval);
        setAllowWaitlist(loadedAllowWaitlist);
        setMaxAttendees(loadedMaxAttendees);
        setSessions(loadedSessions);
        setDefaultSessionName(loadedDefaultSessionName);
        setDefaultSessionTime(loadedDefaultSessionTime);
        setDefaultSessionCheckinDeadline(loadedDefaultSessionCheckinDeadline);
        setDefaultSessionLocation(loadedDefaultSessionLocation);
        setDefaultSessionLocationUrl(loadedDefaultSessionLocationUrl);
        setGoogleMapsUrlOverride(loadedGoogleMapsUrl);
        setTickets(loadedTickets);
        setQuestions(loadedQuestions);
        setRegistrationStatus(loadedStatus);
        setRegistrationStartDate(loadedStartDate);
        setRegistrationEndDate(loadedEndDate);

        initialSnapshotRef.current = JSON.stringify({
          requiresApproval: loadedApproval,
          allowWaitlist: loadedAllowWaitlist,
          maxAttendees: loadedMaxAttendees,
          sessions: loadedSessions,
          defaultSessionName: loadedDefaultSessionName,
          defaultSessionTime: loadedDefaultSessionTime,
          defaultSessionCheckinDeadline: loadedDefaultSessionCheckinDeadline,
          defaultSessionLocation: loadedDefaultSessionLocation,
          defaultSessionLocationUrl: loadedDefaultSessionLocationUrl,
          tickets: loadedTickets,
          questions: loadedQuestions,
          registrationStatus: loadedStatus,
          registrationStartDate: loadedStartDate,
          registrationEndDate: loadedEndDate,
          googleMapsUrlOverride: loadedGoogleMapsUrl,
        });
      } catch (err) {
        console.warn("[CustomFormTab] Failed to load Firestore document:", err);
        initialSnapshotRef.current ??= JSON.stringify({
          requiresApproval: isEventCurationMode(currentEvent),
          allowWaitlist: currentEvent.allow_waitlist !== false,
          maxAttendees: currentEvent.max_attendees ? String(currentEvent.max_attendees) : "",
          sessions: currentEvent.sessions ?? [],
          defaultSessionName: currentEvent.default_session_name?.trim() || "Full Session",
          defaultSessionTime: currentEvent.default_session_time ?? "",
          defaultSessionCheckinDeadline: currentEvent.default_session_checkin_deadline ?? "",
          defaultSessionLocation: currentEvent.default_session_location ?? "",
          defaultSessionLocationUrl: currentEvent.default_session_location_url ?? "",
          tickets: currentEvent.tickets ?? [],
          questions: currentEvent.custom_questions ?? [],
          registrationStatus: (currentEvent.registration_status ?? "Closed") as "Draft" | "Published" | "Closed",
          registrationStartDate: toDateTimeLocal(currentEvent.registration_start_date),
          registrationEndDate: toDateTimeLocal(currentEvent.registration_end_date),
          googleMapsUrlOverride: (currentEvent.google_maps_url ?? currentEvent.venue?.google_maps_url ?? "").trim(),
        });
      } finally {
        setIsInitialLoaded(true);
      }
    }
    void loadSavedFirestoreConfig();
  }, [event.id]);

  // Intercept navigation & tab leaving when dirty
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      pendingNavigationRef.current = () => {
        window.history.back();
      };
      setShowUnsavedDialog(true);
    };
    window.addEventListener("popstate", handlePopState);

    const handleClickCapture = (e: MouseEvent) => {
      if (showUnsavedDialog) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not intercept clicks inside modals, dropdowns, or selects
      if (
        target.closest("[data-slot='dialog-content']") ||
        target.closest("[role='dialog']") ||
        target.closest("[data-slot='select-content']") ||
        target.closest("[role='listbox']") ||
        target.closest("[data-slot='dropdown-menu-content']") ||
        target.closest("[role='menu']")
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // 1. Check tab triggers in parent tabs list (Registrants or Merchandise)
      const tabTrigger = target.closest<HTMLElement>("[role='tab'], [data-slot='tabs-trigger']");
      if (tabTrigger) {
        const isFormTab =
          tabTrigger.getAttribute("value") === "form" ||
          tabTrigger.getAttribute("data-value") === "form" ||
          tabTrigger.textContent?.toLowerCase().includes("registration form");

        if (!isFormTab) {
          e.preventDefault();
          e.stopPropagation();
          pendingNavigationRef.current = () => {
            tabTrigger.click();
          };
          setShowUnsavedDialog(true);
          return;
        }
      }

      // 2. Check anchor links
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
        if (anchor.target === "_blank") return;

        e.preventDefault();
        e.stopPropagation();
        pendingNavigationRef.current = () => {
          if (href.startsWith("http") && !href.startsWith(window.location.origin)) {
            window.location.href = href;
          } else {
            router.push(href);
          }
        };
        setShowUnsavedDialog(true);
        return;
      }
    };

    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty, showUnsavedDialog, router]);

  // Extract all activity items from existing Bevy agenda
  const agendaActivities = useMemo(() => {
    const list: Array<{
      id: string;
      time: string;
      activity: string;
      speakerName: string;
      description?: string;
    }> = [];

    const days = event.agenda?.days ?? [];
    days.forEach((day, dIdx) => {
      const items = day.items ?? day.agenda ?? [];
      items.forEach((item, iIdx) => {
        if (!item.activity?.trim()) return;
        const speakerMatch =
          findMatchingSpeaker(item.description || "", event.speakers) ??
          findMatchingSpeaker(item.activity, event.speakers);
        list.push({
          id: `item-${dIdx}-${iIdx}`,
          time: item.time,
          activity: item.activity.trim(),
          speakerName: speakerMatch?.speakerName ?? "",
          description: item.description,
        });
      });
    });

    return list;
  }, [event.agenda, event.speakers]);

  const isActivityAdded = (act: { id: string; activity: string }) => {
    const norm = normalizeStr(act.activity);
    return sessions.some((s) => s.agenda_activity_id === act.id || normalizeStr(s.title) === norm);
  };

  const handleAddFromAgenda = (act: {
    id: string;
    time: string;
    activity: string;
    speakerName: string;
    description?: string;
  }) => {
    if (isActivityAdded(act)) {
      toast.info(`"${act.activity}" is already in your sessions list.`);
      return;
    }

    const created: EventSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: act.activity,
      time_slot: act.time,
      capacity: 50,
      total_registered: 0,
      agenda_activity_id: act.id,
      ...(act.speakerName ? { speaker_name: act.speakerName } : {}),
      ...(act.description?.trim() ? { description: act.description.trim() } : {}),
    };
    setSessions((prev) => [...prev, created]);
    toast.success(`Added session "${act.activity}" from agenda.`);
  };

  const handleAddAllFromAgenda = () => {
    const unadded = agendaActivities.filter((act) => !isActivityAdded(act));
    if (unadded.length === 0) {
      toast.info("All agenda activities are already added.");
      return;
    }

    const newSessions: EventSession[] = unadded.map((act, idx) => ({
      id: `sess_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      title: act.activity,
      time_slot: act.time,
      capacity: 50,
      total_registered: 0,
      agenda_activity_id: act.id,
      ...(act.speakerName ? { speaker_name: act.speakerName } : {}),
      ...(act.description?.trim() ? { description: act.description.trim() } : {}),
    }));

    setSessions((prev) => [...prev, ...newSessions]);
    toast.success(`Added ${newSessions.length} session${newSessions.length > 1 ? "s" : ""} from agenda.`);
  };

  // Session Handlers
  const handleLoadStandardSessions = () => {
    setSessions(DEFAULT_GDG_SESSIONS);
    toast.success("Loaded default sessions (Morning, Afternoon).");
  };

  const handleAddSession = () => {
    if (!newSession.title.trim()) {
      toast.error("Please provide a session title.");
      return;
    }
    const created: EventSession = {
      id: `sess_${Date.now()}`,
      title: newSession.title.trim(),
      capacity: Number(newSession.capacity) || 50,
      total_registered: 0,
      ...(newSession.description?.trim() ? { description: newSession.description.trim() } : {}),
      ...(newSession.time_slot?.trim() ? { time_slot: newSession.time_slot.trim() } : {}),
      ...(newSession.checkin_deadline?.trim() ? { checkin_deadline: newSession.checkin_deadline.trim() } : {}),
      ...(newSession.location?.trim() ? { location: newSession.location.trim() } : {}),
      ...(newSession.location_url?.trim() ? { location_url: newSession.location_url.trim() } : {}),
      ...(newSession.speaker_name?.trim() ? { speaker_name: newSession.speaker_name.trim() } : {}),
      ...(newSession.slides_url?.trim() ? { slides_url: newSession.slides_url.trim() } : {}),
      ...(newSession.slides_title?.trim() ? { slides_title: newSession.slides_title.trim() } : {}),
      ...(newSession.related_links && newSession.related_links.length > 0
        ? { related_links: newSession.related_links }
        : {}),
    };
    setSessions([...sessions, created]);
    setNewSession({
      title: "",
      description: "",
      time_slot: "",
      checkin_deadline: "",
      location: "",
      location_url: "",
      capacity: 50,
      speaker_name: "",
      slides_url: "",
      slides_title: "",
      related_links: [],
    });
    setNewSessionLinkTitle("");
    setNewSessionLinkUrl("");
    setShowAddSession(false);
    toast.success(`Session "${created.title}" added.`);
  };

  const handleRemoveSession = (id: string) => {
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const handleUpdateSession = (id: string, updates: Partial<EventSession>) => {
    setSessions(sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Question Handlers
  const handleAddQuestion = () => {
    const newQ: CustomQuestion = {
      id: `q_${Date.now()}`,
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      section: "Additional Information",
      validation_type: "none",
    };
    setQuestions([...questions, newQ]);
    setExpandedQuestionIds((prev) => new Set([...prev, newQ.id]));
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDuplicateQuestion = (id: string) => {
    const targetIndex = questions.findIndex((q) => q.id === id);
    if (targetIndex === -1) return;

    const targetQuestion = questions[targetIndex];
    if (!targetQuestion) return;

    const duplicatedQ: CustomQuestion = {
      ...targetQuestion,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: targetQuestion.label ? `${targetQuestion.label} (Copy)` : "",
      options: targetQuestion.options ? [...targetQuestion.options] : undefined,
    };

    setQuestions((prev) => {
      const next = [...prev];
      next.splice(targetIndex + 1, 0, duplicatedQ);
      return next;
    });
    setExpandedQuestionIds((prev) => new Set([...prev, duplicatedQ.id]));

    toast.success(
      targetQuestion.label ? `Duplicated "${targetQuestion.label}"` : `Duplicated Question #${targetIndex + 1}`,
    );
  };

  const handleUpdateQuestion = (id: string, updates: Partial<CustomQuestion>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const handleMoveQuestionUp = (index: number) => {
    if (index <= 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      const item = next[index];
      const prevItem = next[index - 1];
      if (!item || !prevItem) return prev;
      next[index] = prevItem;
      next[index - 1] = item;
      return next;
    });
  };

  const handleMoveQuestionDown = (index: number) => {
    if (index >= questions.length - 1) return;
    setQuestions((prev) => {
      const next = [...prev];
      const item = next[index];
      const nextItem = next[index + 1];
      if (!item || !nextItem) return prev;
      next[index] = nextItem;
      next[index + 1] = item;
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { source } = event.operation;
    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
      return;
    }
    setQuestions((prev) => {
      const next = [...prev];
      const [movedItem] = next.splice(source.initialIndex, 1);
      if (movedItem) {
        next.splice(source.index, 0, movedItem);
      }
      return next;
    });
  };

  // Apply entire Event Format Template (Policy + Sessions + Questionnaire)
  const handleApplyFormatTemplate = (templateId: string) => {
    const tmpl = EVENT_FORMAT_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    setRequiresApproval(tmpl.requires_approval);
    if (tmpl.sessions && tmpl.sessions.length > 0) {
      setSessions(tmpl.sessions);
    } else {
      setSessions([]);
    }
    if (tmpl.tickets && tmpl.tickets.length > 0) {
      setTickets(tmpl.tickets);
    }
    setQuestions(tmpl.questions);

    toast.success(`Applied "${tmpl.name}" format preset (policy, sessions, tickets & questionnaire).`);
  };

  const handleLoadTemplate = (templateName: string) => {
    switch (templateName) {
      case "free":
        setQuestions(FREE_REGISTRATION_TEMPLATE);
        toast.success("Loaded Free Registration questionnaire.");
        break;
      case "paid":
        setQuestions(PAID_REGISTRATION_TEMPLATE);
        toast.success("Loaded Paid Registration questionnaire.");
        break;
      case "commitment":
      case "commitment_fee":
        setQuestions(COMMITMENT_FEE_TEMPLATE);
        toast.success("Loaded Free Registration with Commitment Fee questionnaire.");
        break;
      case "multi_track":
        setQuestions(MULTI_TRACK_TEMPLATE);
        toast.success("Loaded Multiple Track / Session questionnaire.");
        break;
      case "curated_free":
      case "curated":
        setQuestions(CURATED_FREE_TEMPLATE);
        toast.success("Loaded Curated Registration (Free) questionnaire.");
        break;
      case "curated_commitment":
        setQuestions(CURATED_COMMITMENT_FEE_TEMPLATE);
        toast.success("Loaded Curated Registration (Commitment Fee) questionnaire.");
        break;
      case "curated_multi_free":
      case "curated_combined":
        setQuestions(CURATED_MULTI_FREE_TEMPLATE);
        toast.success("Loaded Curated Registration + Multiple Sessions (Free) questionnaire.");
        break;
      case "curated_multi_commitment":
        setQuestions(CURATED_MULTI_COMMITMENT_TEMPLATE);
        toast.success("Loaded Curated Registration + Multiple Sessions (Commitment Fee) questionnaire.");
        break;
      case "curated_multi_paid":
        setQuestions(CURATED_MULTI_PAID_TEMPLATE);
        toast.success("Loaded Curated Registration + Multiple Sessions (Paid) questionnaire.");
        break;
      case "combined":
        setQuestions(DEFAULT_COMBINED_QUESTIONS);
        toast.success("Loaded Combined Form (Road to DevFest + Common Form) template.");
        break;
      case "devfest":
        setQuestions(ROAD_TO_DEVFEST_TEMPLATE);
        toast.success("Loaded Road to DevFest Builder Sprint template.");
        break;
      case "common":
        setQuestions(COMMON_MEETUP_TEMPLATE);
        toast.success("Loaded Common Meetup template.");
        break;
      case "quick":
        setQuestions(QUICK_RSVP_TEMPLATE);
        toast.success("Loaded Fast RSVP template.");
        break;
      default:
        break;
    }
  };

  const handleApplyCopiedForm = (copied: CopiedFormData) => {
    if (copied.questions.length > 0) {
      if (copied.replaceQuestions) {
        setQuestions(copied.questions);
      } else {
        // Append mode: avoid duplicate question labels/IDs
        setQuestions((prev) => {
          const existingLabels = new Set(prev.map((q) => q.label.trim().toLowerCase()));
          const newToAdd = copied.questions.filter((q) => !existingLabels.has(q.label.trim().toLowerCase()));
          return [...prev, ...newToAdd];
        });
      }
    }

    if (copied.policy) {
      setRequiresApproval(copied.policy.requiresApproval);
      setAllowWaitlist(copied.policy.allowWaitlist);
      if (copied.policy.maxAttendees !== undefined) {
        setMaxAttendees(copied.policy.maxAttendees);
      }
    }

    if (copied.sessions && copied.sessions.length > 0) {
      setSessions(copied.sessions);
    }

    if (copied.default_session_name !== undefined) {
      setDefaultSessionName(copied.default_session_name);
    }
    if (copied.default_session_time !== undefined) {
      setDefaultSessionTime(copied.default_session_time);
    }
    if (copied.default_session_checkin_deadline !== undefined) {
      setDefaultSessionCheckinDeadline(copied.default_session_checkin_deadline);
    }
    if (copied.default_session_location !== undefined) {
      setDefaultSessionLocation(copied.default_session_location);
    }
    if (copied.default_session_location_url !== undefined) {
      setDefaultSessionLocationUrl(copied.default_session_location_url);
    }

    if (copied.tickets && copied.tickets.length > 0) {
      setTickets(copied.tickets);
    }

    toast.success(
      `Copied registration configuration from "${copied.sourceEventTitle}". Review your changes and save.`,
      { duration: 5000 },
    );
  };

  const handleDiscardChanges = () => {
    if (initialSnapshotRef.current) {
      try {
        const snap = JSON.parse(initialSnapshotRef.current) as {
          requiresApproval: boolean;
          allowWaitlist?: boolean;
          maxAttendees: string;
          sessions: EventSession[];
          defaultSessionName?: string;
          defaultSessionTime?: string;
          defaultSessionCheckinDeadline?: string;
          defaultSessionLocation?: string;
          defaultSessionLocationUrl?: string;
          questions: CustomQuestion[];
          registrationStatus: "Draft" | "Published" | "Closed";
          registrationStartDate: string;
          registrationEndDate: string;
          googleMapsUrlOverride?: string;
        };
        setRequiresApproval(snap.requiresApproval);
        if (snap.allowWaitlist !== undefined) setAllowWaitlist(snap.allowWaitlist);
        setMaxAttendees(snap.maxAttendees);
        setSessions(snap.sessions);
        if (snap.defaultSessionName !== undefined) setDefaultSessionName(snap.defaultSessionName);
        if (snap.defaultSessionTime !== undefined) setDefaultSessionTime(snap.defaultSessionTime);
        if (snap.defaultSessionCheckinDeadline !== undefined)
          setDefaultSessionCheckinDeadline(snap.defaultSessionCheckinDeadline);
        if (snap.defaultSessionLocation !== undefined) setDefaultSessionLocation(snap.defaultSessionLocation);
        if (snap.defaultSessionLocationUrl !== undefined) setDefaultSessionLocationUrl(snap.defaultSessionLocationUrl);
        if (snap.googleMapsUrlOverride !== undefined) setGoogleMapsUrlOverride(snap.googleMapsUrlOverride);
        setQuestions(snap.questions);
        setRegistrationStatus(snap.registrationStatus);
        setRegistrationStartDate(snap.registrationStartDate);
        setRegistrationEndDate(snap.registrationEndDate);
        toast.info("Unsaved changes discarded.");
      } catch (err) {
        console.error("[CustomFormTab] Failed to revert snapshot:", err);
      }
    }
  };

  // Save All Settings (with optional status override for draft or publish)
  const handleSave = (statusOverride?: "Draft" | "Published" | "Closed"): Promise<boolean> => {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          if (duplicateReport.hasDuplicates) {
            toast.warning(
              `Duplicate registration fields detected (${duplicateReport.duplicateLabels.join(", ")}). Consider removing duplicates from other sections.`,
              { duration: 6000 },
            );
          }

          const { deleteField, saveFirestoreEvent } = await import("@/lib/firestore/client");

          let resolvedMaxAttendees: number | ReturnType<typeof deleteField>;
          if (hasMultipleSessions) {
            resolvedMaxAttendees = totalSessionCapacity > 0 ? totalSessionCapacity : deleteField();
          } else if (maxAttendees && maxAttendees.trim().length > 0 && !Number.isNaN(Number(maxAttendees))) {
            resolvedMaxAttendees = Number(maxAttendees);
          } else {
            resolvedMaxAttendees = deleteField();
          }

          const finalStatus = statusOverride ?? registrationStatus;
          const startDateIso = fromDateTimeLocal(registrationStartDate);
          const endDateIso = fromDateTimeLocal(registrationEndDate);

          const updatedEvent: Record<string, unknown> = {
            ...event,
            registration_status: finalStatus,
            registration_start_date: startDateIso ? startDateIso : deleteField(),
            registration_end_date: endDateIso ? endDateIso : deleteField(),
            requires_approval: requiresApproval,
            curation_mode: requiresApproval,
            allow_waitlist: allowWaitlist,
            max_attendees: resolvedMaxAttendees,
            webhook_url: event.webhook_url ? event.webhook_url : deleteField(),
            sessions: sessions.length > 0 ? sessions : deleteField(),
            default_session_name: defaultSessionName.trim() ? defaultSessionName.trim() : "Full Session",
            default_session_time: defaultSessionTime.trim() ? defaultSessionTime.trim() : deleteField(),
            default_session_checkin_deadline: defaultSessionCheckinDeadline.trim()
              ? defaultSessionCheckinDeadline.trim()
              : deleteField(),
            default_session_location: defaultSessionLocation.trim() ? defaultSessionLocation.trim() : deleteField(),
            default_session_location_url: defaultSessionLocationUrl.trim()
              ? defaultSessionLocationUrl.trim()
              : deleteField(),
            google_maps_url: googleMapsUrlOverride.trim() ? googleMapsUrlOverride.trim() : deleteField(),
            tickets: tickets.length > 0 ? tickets : deleteField(),
            custom_questions: questions.filter((q) => q.label.trim().length > 0),
            updated_at: new Date().toISOString(),
          };

          await saveFirestoreEvent(updatedEvent as unknown as FirestoreEvent);

          if (statusOverride) {
            setRegistrationStatus(statusOverride);
          }

          // Update initialSnapshotRef so isDirty becomes false
          initialSnapshotRef.current = JSON.stringify({
            requiresApproval,
            allowWaitlist,
            maxAttendees,
            sessions,
            defaultSessionName: defaultSessionName.trim() || "Full Session",
            defaultSessionTime,
            defaultSessionCheckinDeadline,
            defaultSessionLocation,
            defaultSessionLocationUrl,
            tickets,
            questions,
            registrationStatus: finalStatus,
            registrationStartDate,
            registrationEndDate,
            googleMapsUrlOverride: googleMapsUrlOverride.trim(),
          });

          if (finalStatus === "Draft") {
            toast.success("Settings saved as Draft! Registration is not opened yet.");
          } else {
            toast.success("Registration form and session settings saved successfully!");
          }

          router.refresh();
          resolve(true);
        } catch (err) {
          console.error("[CustomFormTab] Failed to save settings:", err);
          toast.error("Failed to save settings. Please try again.");
          resolve(false);
        }
      });
    });
  };

  const displayedTemplates = EVENT_FORMAT_TEMPLATES.filter(
    (tmpl) => templateCategoryFilter === "all" || tmpl.category === templateCategoryFilter,
  );

  return (
    <div className="space-y-6 pb-24">
      {/* ── 0. EVENT FORMAT PRESETS & TEMPLATES ──────────────────────── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle className="text-base">Event Format Templates & Presets</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Quickly draft your registration policy, breakout sessions, and questionnaire based on your event format.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCopyDialog(true)}
              className="h-8 gap-1.5 text-xs bg-background shadow-2xs hover:bg-muted"
            >
              <Copy className="size-3.5 text-primary" />
              <span>Copy from Existing Event</span>
            </Button>

            <Select onValueChange={handleApplyFormatTemplate}>
              <SelectTrigger size="sm" className="h-8 w-full bg-background text-xs shadow-2xs sm:w-[280px]">
                <SelectValue placeholder="Apply Format Template..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectGroup>
                  <SelectLabel className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Curated Formats (Work Email & LinkedIn)
                  </SelectLabel>
                  {EVENT_FORMAT_TEMPLATES.filter((t) => t.category === "curated").map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                      <span className="font-medium">{tmpl.name}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">({tmpl.badge})</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Standard Open Formats
                  </SelectLabel>
                  {EVENT_FORMAT_TEMPLATES.filter((t) => t.category === "standard").map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                      <span className="font-medium">{tmpl.name}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">({tmpl.badge})</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-border/50 border-b pb-2.5">
            <Button
              type="button"
              size="sm"
              variant={templateCategoryFilter === "all" ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setTemplateCategoryFilter("all")}
            >
              All Formats ({EVENT_FORMAT_TEMPLATES.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={templateCategoryFilter === "curated" ? "secondary" : "ghost"}
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setTemplateCategoryFilter("curated")}
            >
              <span>Curated Formats (5)</span>
              <Badge variant="outline" className="h-4 border-primary/30 px-1 font-mono text-[9px] text-primary">
                Work Email + LinkedIn
              </Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={templateCategoryFilter === "standard" ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setTemplateCategoryFilter("standard")}
            >
              Standard Open Formats (4)
            </Button>
          </div>

          {/* Quick-Apply Format Cards Grid (Multi-line title wrap) */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {displayedTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyFormatTemplate(tmpl.id)}
                className="group flex min-h-[115px] flex-col justify-between rounded-lg border border-border/80 bg-card p-3 text-left transition-all hover:border-primary/60 hover:bg-muted/40 hover:shadow-xs active:scale-[0.99]"
              >
                <div className="w-full space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant={tmpl.category === "curated" ? "default" : "secondary"}
                        className="h-4.5 px-1.5 font-medium text-[10px]"
                      >
                        {tmpl.badge}
                      </Badge>
                      {tmpl.tickets && tmpl.tickets.length > 0 && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                          {(() => {
                            if (tmpl.tickets.some((t) => t.type === "commitment_fee")) {
                              return "Rp 50k Fee";
                            }
                            if (tmpl.tickets.some((t) => t.type === "paid")) {
                              return `${tmpl.tickets.length} Paid Tiers`;
                            }
                            return "Free RSVP";
                          })()}
                        </span>
                      )}
                    </div>
                    {tmpl.sessions && <span className="font-mono text-[10px] text-muted-foreground">3 Sessions</span>}
                  </div>
                  <span className="block hyphens-auto break-words font-semibold text-foreground text-xs leading-snug">
                    {tmpl.name}
                  </span>
                </div>
                <p className="line-clamp-2 pt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {tmpl.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 1. REGISTRATION SCHEDULE & PUBLISHING CONTROLS ─────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              <CardTitle className="text-base">Registration Schedule & Publishing Status</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Configure whether registration is open or drafted, and set the opening and closing time window.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {registrationStatus === "Draft" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  setRegistrationStatus("Published");
                  toast.info("Registration status set to Published. Click 'Save All Settings' or publish now.");
                }}
                className="gap-1.5 text-xs shadow-xs"
              >
                <Globe className="size-3.5" />
                Publish Registration
              </Button>
            )}
            {registrationStatus === "Published" && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRegistrationStatus("Draft");
                    toast.info("Registration status set to Draft (registration not opened yet).");
                  }}
                  className="gap-1.5 text-xs"
                >
                  <FileEdit className="size-3.5" />
                  Set as Draft
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRegistrationStatus("Closed");
                    toast.info("Registration marked as Closed.");
                  }}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  Close Registration
                </Button>
              </div>
            )}
            {registrationStatus !== "Draft" && registrationStatus !== "Published" && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRegistrationStatus("Draft");
                    toast.info("Registration status set to Draft (registration not opened yet).");
                  }}
                  className="gap-1.5 text-xs"
                >
                  <FileEdit className="size-3.5" />
                  Set as Draft
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setRegistrationStatus("Published");
                    toast.info("Registration status set to Published.");
                  }}
                  className="gap-1.5 text-xs shadow-xs"
                >
                  <Globe className="size-3.5" />
                  Open Registration
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Status and Attendee Experience Banner */}
          {(() => {
            const previewWindowStatus = getRegistrationWindowStatus({
              ...event,
              allow_waitlist: allowWaitlist,
              registration_status: registrationStatus,
              registration_start_date: fromDateTimeLocal(registrationStartDate),
              registration_end_date: fromDateTimeLocal(registrationEndDate),
            });

            if (registrationStatus === "Draft") {
              return (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <FileEdit className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">Draft Mode — Registration is NOT open yet</span>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                      Attendees will see a disabled badge: <em>&ldquo;Registration Not Open Yet&rdquo;</em>. You can
                      safely build your questions and sessions before publishing.
                    </p>
                  </div>
                </div>
              );
            }

            if (previewWindowStatus.isWaitlist) {
              return (
                <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-200">
                  <Clock className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">Event Capacity Reached — Waitlist Active</span>
                    <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90">
                      Attendee display: <em>&ldquo;Waitlist Open&rdquo;</em>. Direct registration is closed to prevent
                      exceeding limits, but attendees can still submit to join the waitlist.
                    </p>
                  </div>
                </div>
              );
            }

            if (!previewWindowStatus.isOpen) {
              return (
                <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-200">
                  <Clock className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">
                      {previewWindowStatus.status === "upcoming"
                        ? "Published — Scheduled to Open Soon"
                        : "Registration Closed"}
                    </span>
                    <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90">
                      Attendee display: <em>&ldquo;{previewWindowStatus.message}&rdquo;</em>.
                      {previewWindowStatus.opensAt &&
                        ` Opens on ${new Date(previewWindowStatus.opensAt).toLocaleString()}.`}
                      {previewWindowStatus.closesAt &&
                        ` Closed on ${new Date(previewWindowStatus.closesAt).toLocaleString()}.`}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold">Registration is Published & Currently Open</span>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90">
                    Attendees can currently submit RSVPs
                    {registrationEndDate
                      ? ` until ${new Date(registrationEndDate).toLocaleString()}`
                      : " (open until event concludes)"}
                    .
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Date Range Inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Start Date / Opens At */}
            <div className="space-y-1.5">
              <label htmlFor="reg-start-date" className="font-medium text-xs text-foreground">
                Registration Opens At (Optional Schedule)
              </label>
              <DatePicker
                id="reg-start-date"
                withTime
                value={registrationStartDate}
                onChange={setRegistrationStartDate}
                placeholder="Opens immediately once published"
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  Leave blank to open immediately once published.
                </span>
                {registrationStartDate && (
                  <button
                    type="button"
                    onClick={() => setRegistrationStartDate("")}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Clear Start Date
                  </button>
                )}
              </div>
            </div>

            {/* End Date / Closes At */}
            <div className="space-y-1.5">
              <label htmlFor="reg-end-date" className="font-medium text-xs text-foreground">
                Registration Closes At (Optional Schedule)
              </label>
              <DatePicker
                id="reg-end-date"
                withTime
                value={registrationEndDate}
                onChange={setRegistrationEndDate}
                placeholder="Closes when event ends"
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                <span className="text-[11px] text-muted-foreground">Leave blank to close when event ends.</span>
                <div className="flex items-center gap-2">
                  {event.start_date && (
                    <button
                      type="button"
                      onClick={() => setRegistrationEndDate(toDateTimeLocal(event.start_date))}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Until Event Starts
                    </button>
                  )}
                  {event.start_date && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const d = new Date(event.start_date);
                          d.setHours(d.getHours() - 24);
                          setRegistrationEndDate(toDateTimeLocal(d.toISOString()));
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      24h Before
                    </button>
                  )}
                  {registrationEndDate && (
                    <button
                      type="button"
                      onClick={() => setRegistrationEndDate("")}
                      className="text-[11px] text-destructive hover:underline font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. APPROVAL & CAPACITY SETTINGS ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Registration Policy</CardTitle>
          <CardDescription>
            Configure attendee admission policy, curation requirements, and event-wide capacity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
            {!isInitialLoaded ? (
              <div className="flex w-full items-start gap-3" aria-busy="true" aria-live="polite">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-[4px]" />
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-64" />
                    <span className="animate-pulse text-muted-foreground text-xs">Syncing curation state...</span>
                  </div>
                  <Skeleton className="h-3.5 w-full max-w-lg" />
                </div>
              </div>
            ) : (
              <>
                <Checkbox
                  id="requires-approval"
                  checked={requiresApproval}
                  onCheckedChange={(checked) => setRequiresApproval(Boolean(checked))}
                />
                <div className="space-y-1">
                  <label htmlFor="requires-approval" className="cursor-pointer font-medium text-sm leading-none">
                    Require Organizer Approval (Curation Mode)
                  </label>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    When enabled, new registrants are marked as <strong>Pending Review</strong> and must be approved by
                    an organizer in the Registrants tab before their ticket is confirmed.
                  </p>
                  {requiresApproval && (
                    <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/10 p-2.5 text-xs text-blue-800 dark:text-blue-300">
                      <span className="font-semibold">💡 Curation Requirement Note:</span> Registrants must provide a
                      public LinkedIn profile that is <strong>not set to a private account</strong> so the organizing
                      committee can review and verify their experience.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
            <Checkbox
              id="allow-waitlist"
              checked={allowWaitlist}
              onCheckedChange={(checked) => setAllowWaitlist(Boolean(checked))}
            />
            <div className="space-y-1">
              <label htmlFor="allow-waitlist" className="cursor-pointer font-medium text-sm leading-none">
                Allow Waitlist Registration when Capacity is Full
              </label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                When enabled, once event or session capacity is reached, registration automatically closes for direct
                admission but allows attendees to register for the <strong>Waitlist</strong>. If disabled, registration
                is strictly closed with no waitlist option.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="max-attendees">Total Event Capacity (Optional)</FieldLabel>
                {hasMultipleSessions && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Calculated: {totalSessionCapacity} seats across {sessions.length} sessions
                  </Badge>
                )}
              </div>
              <Input
                id="max-attendees"
                type="number"
                placeholder={hasMultipleSessions ? String(totalSessionCapacity) : "Unlimited"}
                value={hasMultipleSessions ? String(totalSessionCapacity) : maxAttendees}
                disabled={hasMultipleSessions}
                onChange={(e) => setMaxAttendees(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {hasMultipleSessions ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    (Disabled to edit for multiple session, edit for each session instead)
                  </span>
                ) : (
                  "Leave empty for unlimited seats across the entire venue."
                )}
              </p>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── 2b. VENUE LOCATION & GOOGLE MAPS LINK ───────────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-lg">Venue Location & Google Maps Link</CardTitle>
            </div>
            <CardDescription className="pt-1">
              Review upstream Bevy venue information and customize or override the Google Maps link shown to attendees.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-lg border bg-muted/20 p-3.5">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Upstream Venue Name
              </span>
              <p className="font-semibold text-foreground text-sm">
                {event.venue?.name ?? (event.is_virtual ? "Virtual Event" : "To Be Announced")}
              </p>
            </div>
            <div className="space-y-1 rounded-lg border bg-muted/20 p-3.5">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Upstream Venue Address
              </span>
              <p className="line-clamp-2 text-muted-foreground text-xs">
                {[event.venue?.address, event.venue?.city].filter(Boolean).join(", ") || "No address provided on Bevy"}
              </p>
            </div>
          </div>

          <Field className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="google-maps-url" className="font-medium text-xs">
                Google Maps Link Override (Optional)
              </FieldLabel>
              {googleMapsUrlOverride.trim() ? (
                <a
                  href={googleMapsUrlOverride.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[11px] text-primary hover:underline"
                >
                  Test override link <ExternalLink className="size-2.5" />
                </a>
              ) : (
                [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(", ") && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(", "),
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Preview default link <ExternalLink className="size-2.5" />
                  </a>
                )
              )}
            </div>
            <Input
              id="google-maps-url"
              placeholder="https://maps.app.goo.gl/... or custom Google Maps place link"
              value={googleMapsUrlOverride}
              onChange={(e) => setGoogleMapsUrlOverride(e.target.value)}
              className="h-9 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              By default, Google Maps directions are automatically searched using the venue name{" "}
              <strong>({event.venue?.name ?? "Venue"})</strong> and address. Enter a custom Google Maps URL here to
              override it across the public event page, attendee ticket cards, and confirmation emails.
            </p>
          </Field>
        </CardContent>
      </Card>

      {/* ── 3. BREAKOUT SESSIONS SUMMARY & LINK TO BREAKOUT SESSION TAB ── */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <CardTitle className="text-lg">Breakout Sessions & Pre-Event Track Selection</CardTitle>
            </div>
            <CardDescription className="pt-1">
              Breakout sessions, Bevy agenda bindings, pre-event form toggles, and independent session check-in rosters
              are managed in the dedicated <strong>Breakout Session</strong> tab.
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 self-start text-xs"
            onClick={() => {
              if (onSwitchTab) {
                onSwitchTab("breakout-sessions");
              } else {
                window.dispatchEvent(new CustomEvent("gdg:switch-tab", { detail: "breakout-sessions" }));
                const breakoutTabTrigger = document.querySelector<HTMLButtonElement>(
                  '#tab-trigger-breakout-sessions, [data-value="breakout-sessions"], [data-slot="tabs-trigger"][value="breakout-sessions"], button[value="breakout-sessions"]',
                );
                breakoutTabTrigger?.click();
              }
            }}
          >
            <Layers className="size-3.5 text-primary" />
            <span>Open Breakout Session Tab</span>
          </Button>
        </CardHeader>

        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                    Single Session
                  </Badge>
                  <span className="font-semibold text-foreground text-xs">
                    Default Session: {defaultSessionName || "Full Session"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  No breakout sessions configured. Registrants sign up for the main session. Switch to the{" "}
                  <strong>Breakout Session</strong> tab to add manual or Bevy agenda sessions.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="text-xs">
                  {sessions.length} Total {sessions.length === 1 ? "Session" : "Sessions"}
                </Badge>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs">
                  {preEventRegistrationSessions.length} Shown on Pre-Event Registration Form
                </Badge>
                {sessions.length - preEventRegistrationSessions.length > 0 && (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    {sessions.length - preEventRegistrationSessions.length} On-Site / Manual Only
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{sess.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sess.time_slot || "No time slot"} · Cap: {sess.capacity}
                      </p>
                    </div>
                    <Badge
                      variant={sess.include_in_registration !== false ? "default" : "outline"}
                      className="shrink-0 text-[10px]"
                    >
                      {sess.include_in_registration !== false ? "In Reg Form" : "On-Site / Manual"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. REGISTRATION QUESTIONNAIRE BUILDER ───────────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Registration Questionnaire ({questions.length} Fields)</CardTitle>
            <CardDescription>
              Questions presented to GDG community members when applying or registering for this event. Drag by handle
              or use arrows to reorder questions.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={handleLoadTemplate}>
              <SelectTrigger size="sm" className="h-8 text-xs">
                <SelectValue placeholder="Load Preset Template..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectGroup>
                  <SelectLabel className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Curated Questionnaires (Work Email & LinkedIn)
                  </SelectLabel>
                  <SelectItem value="curated_free">Curated Registration (Free)</SelectItem>
                  <SelectItem value="curated_commitment">Curated Registration (Commitment Fee)</SelectItem>
                  <SelectItem value="curated_multi_free">Curated + Multiple Sessions (Free)</SelectItem>
                  <SelectItem value="curated_multi_commitment">Curated + Multiple Sessions (Commitment Fee)</SelectItem>
                  <SelectItem value="curated_multi_paid">Curated + Multiple Sessions (Paid)</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Standard Questionnaires
                  </SelectLabel>
                  <SelectItem value="free">Free Registration (Open Meetup)</SelectItem>
                  <SelectItem value="paid">Paid Registration (Ticketing & Invoice)</SelectItem>
                  <SelectItem value="commitment">Free with Commitment Fee (Refundable)</SelectItem>
                  <SelectItem value="multi_track">Multiple Track / Session Form</SelectItem>
                  <SelectItem value="quick">Quick Lightweight RSVP</SelectItem>
                  <SelectItem value="combined">Combined Default Form (Full 23 Fields)</SelectItem>
                  <SelectItem value="devfest">Road to DevFest Builder Sprint</SelectItem>
                  <SelectItem value="common">Common Meetup & Talk</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {questions.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleToggleExpandAllQuestions}
                className="h-8 gap-1.5 text-xs shadow-2xs"
                title={areAllQuestionsCollapsed ? "Expand all questions" : "Collapse all questions"}
              >
                {areAllQuestionsCollapsed ? (
                  <>
                    <ChevronsUpDown className="size-3.5" />
                    <span>Expand All</span>
                  </>
                ) : (
                  <>
                    <ChevronsDownUp className="size-3.5" />
                    <span>Collapse All</span>
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowCopyDialog(true)}
              className="h-8 gap-1.5 text-xs shadow-2xs"
            >
              <Copy className="size-3.5" />
              Copy Existing Form
            </Button>

            <Button size="sm" variant="outline" onClick={handleAddQuestion} className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Question
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {duplicateReport.hasDuplicates && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-medium text-xs">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Duplicate registration fields detected ({duplicateReport.duplicateLabels.join(", ")})</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Payment Details already collects the required Full Name, Email Address, and WhatsApp Phone Number.
                Having duplicate fields in other sections may confuse attendees.
              </p>
              {duplicateReport.duplicateDetails.length > 0 && (
                <ul className="list-disc pl-5 text-[11px] text-muted-foreground space-y-0.5">
                  {duplicateReport.duplicateDetails.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
              <div className="pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
                  onClick={handleRemoveDuplicateQuestions}
                >
                  Remove Duplicates from Other Sections
                </Button>
              </div>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed py-10 text-center text-muted-foreground text-sm">
              <p>No custom questions configured. Registrants will only submit their member profile.</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleAddQuestion} className="h-8 gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  Add First Question
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowCopyDialog(true)}
                  className="h-8 gap-1.5 text-xs shadow-xs"
                >
                  <Copy className="size-3.5" />
                  Copy from Existing Event
                </Button>
              </div>
            </div>
          ) : (
            <DragDropProvider onDragEnd={handleDragEnd}>
              <div className="flex flex-col gap-3">
                {questions.map((q, idx) => (
                  <SortableQuestionCard
                    key={q.id}
                    question={q}
                    index={idx}
                    totalQuestions={questions.length}
                    eventName={event.title}
                    isExpanded={expandedQuestionIds.has(q.id)}
                    onToggleExpand={() => handleToggleExpandQuestion(q.id)}
                    onUpdate={handleUpdateQuestion}
                    onRemove={handleRemoveQuestion}
                    onDuplicate={handleDuplicateQuestion}
                    onMoveUp={handleMoveQuestionUp}
                    onMoveDown={handleMoveQuestionDown}
                  />
                ))}
              </div>
            </DragDropProvider>
          )}
        </CardContent>
      </Card>

      {/* ── Fixed Floating Bottom Save Bar ──────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isPending}
        onSave={() => void handleSave()}
        onDiscard={handleDiscardChanges}
        discardLabel="Discard"
        saveLabel="Save All Settings"
        savingLabel="Saving Settings..."
        savedLabel="Saved (No Changes)"
        statusInfo={
          <span>
            Status: <strong>{registrationStatus}</strong>
            {registrationStatus === "Draft" && " (Registration not open)"}
          </span>
        }
        helperText="Form policies & session capacities will immediately apply."
      />

      {/* ── UNSAVED CHANGES EXIT CONFIRMATION DIALOG ──────────────────── */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="max-w-md gap-4 sm:max-w-lg">
          <DialogHeader className="gap-1.5">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="text-base sm:text-lg">Unsaved Changes</DialogTitle>
            <DialogDescription className="text-xs">
              You have modified registration or session settings. Are you sure you want to discard changes, save all
              settings, or draft it first?
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2.5 py-1">
            {/* Option A: Draft it first */}
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const ok = await handleSave("Draft");
                if (ok) {
                  setShowUnsavedDialog(false);
                  const nav = pendingNavigationRef.current;
                  pendingNavigationRef.current = null;
                  nav?.();
                }
              }}
              className="group flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-left transition-all hover:border-amber-500/40 hover:bg-amber-500/5 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <FileEdit className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-xs">Draft it First</span>
                  <Badge
                    variant="secondary"
                    className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                  >
                    Registration Not Opened Yet
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Saves all your changes with registration set to <strong>Draft</strong>. Registration will not be
                  opened to attendees until you publish it.
                </p>
              </div>
            </button>

            {/* Option B: Save All Settings */}
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const ok = await handleSave();
                if (ok) {
                  setShowUnsavedDialog(false);
                  const nav = pendingNavigationRef.current;
                  pendingNavigationRef.current = null;
                  nav?.();
                }
              }}
              className="group flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-xs">Save All Settings</span>
                  <Badge variant="outline" className="text-[10px]">
                    Status: {registrationStatus}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Saves your modifications immediately and retains the currently selected registration status (
                  {registrationStatus}).
                </p>
              </div>
            </button>

            {/* Option C: Discard Changes */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                handleDiscardChanges();
                setShowUnsavedDialog(false);
                const nav = pendingNavigationRef.current;
                pendingNavigationRef.current = null;
                nav?.();
              }}
              className="group flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left transition-all hover:border-destructive/40 hover:bg-destructive/10 focus:outline-hidden focus:ring-2 focus:ring-destructive/20"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-destructive text-xs">Discard Changes</span>
                <p className="text-[11px] text-destructive/80 leading-normal">
                  Reverts all unsaved edits made during this session and restores your previous saved settings.
                </p>
              </div>
            </button>
          </div>

          <DialogFooter className="sm:justify-between sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowUnsavedDialog(false);
                pendingNavigationRef.current = null;
              }}
              className="w-full text-xs sm:w-auto"
            >
              Cancel & Keep Editing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COPY FORM FROM EXISTING EVENT DIALOG ──────────────────── */}
      <CopyEventFormDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        currentEventId={String(event.id)}
        onApplyCopy={handleApplyCopiedForm}
      />
    </div>
  );
}
