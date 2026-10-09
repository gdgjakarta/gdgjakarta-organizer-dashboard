"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Globe,
  Layers,
  Link2,
  Plus,
  Presentation,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parsePhotoAlbum, parseVideoUrl } from "@/lib/events/media-utils";
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
  EVENT_FORMAT_TEMPLATES,
  FREE_REGISTRATION_TEMPLATE,
  getRegistrationWindowStatus,
  MULTI_TRACK_TEMPLATE,
  PAID_REGISTRATION_TEMPLATE,
  QUICK_RSVP_TEMPLATE,
  ROAD_TO_DEVFEST_TEMPLATE,
} from "@/lib/events/registration-defaults";
import type { CustomQuestion, EventSession, FirestoreEvent, SessionRelatedLink } from "@/lib/firestore/types";

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
}

export function CustomFormTab({ event }: CustomFormTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. Policy & Capacity
  const [requiresApproval, setRequiresApproval] = useState(Boolean(event.requires_approval));
  const [maxAttendees, setMaxAttendees] = useState(event.max_attendees ? String(event.max_attendees) : "");

  // 2. Registration Schedule & Publishing Status
  const [registrationStatus, setRegistrationStatus] = useState<"Draft" | "Published" | "Closed">(
    event.registration_status ?? (event.status === "Draft" ? "Draft" : "Published"),
  );
  const [registrationStartDate, setRegistrationStartDate] = useState<string>(
    toDateTimeLocal(event.registration_start_date),
  );
  const [registrationEndDate, setRegistrationEndDate] = useState<string>(toDateTimeLocal(event.registration_end_date));

  // 3. Event Sessions (Split into Sessions with Limited Capacity)
  const [sessions, setSessions] = useState<EventSession[]>(event.sessions ?? []);
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

  // 4. Derived Capacity & Multi-Session Calculation
  const hasMultipleSessions = sessions.length > 0;
  const totalSessionCapacity = sessions.reduce((acc, sess) => acc + (Number(sess.capacity) || 0), 0);

  // 5. Registration Questions
  const [questions, setQuestions] = useState<CustomQuestion[]>(
    event.custom_questions && event.custom_questions.length > 0 ? event.custom_questions : DEFAULT_COMBINED_QUESTIONS,
  );
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<"all" | "curated" | "standard">("all");

  // 6. Post-Event Media & Recap
  const [highlightVideoUrl, setHighlightVideoUrl] = useState(event.highlight_video_url ?? "");
  const [highlightVideoTitle, setHighlightVideoTitle] = useState(event.highlight_video_title ?? "");
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState(event.photo_album_url ?? "");
  const [photoAlbumTitle, setPhotoAlbumTitle] = useState(event.photo_album_title ?? "");
  const [recapDescription, setRecapDescription] = useState(event.recap_description ?? "");

  // 7. Form Snapshot & Dirty State Tracking
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      requiresApproval,
      maxAttendees,
      sessions,
      questions,
      highlightVideoUrl,
      highlightVideoTitle,
      photoAlbumUrl,
      photoAlbumTitle,
      recapDescription,
      registrationStatus,
      registrationStartDate,
      registrationEndDate,
    });
  }, [
    requiresApproval,
    maxAttendees,
    sessions,
    questions,
    highlightVideoUrl,
    highlightVideoTitle,
    photoAlbumUrl,
    photoAlbumTitle,
    recapDescription,
    registrationStatus,
    registrationStartDate,
    registrationEndDate,
  ]);

  const isDirty =
    isInitialLoaded && initialSnapshotRef.current !== null && initialSnapshotRef.current !== currentSnapshot;

  // 8. Exit confirmation modal state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  // Load any previously saved Firestore settings on client mount
  useEffect(() => {
    async function loadSavedFirestoreConfig() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));

        const loadedApproval =
          docData?.requires_approval !== undefined ? docData.requires_approval : Boolean(event.requires_approval);
        const loadedMaxAttendees =
          docData?.max_attendees !== undefined && docData.max_attendees !== null
            ? String(docData.max_attendees)
            : event.max_attendees
              ? String(event.max_attendees)
              : "";
        const loadedSessions = Array.isArray(docData?.sessions) ? docData.sessions : (event.sessions ?? []);
        const loadedQuestions =
          docData?.custom_questions && docData.custom_questions.length > 0
            ? docData.custom_questions
            : event.custom_questions && event.custom_questions.length > 0
              ? event.custom_questions
              : DEFAULT_COMBINED_QUESTIONS;
        const loadedVideoUrl = docData?.highlight_video_url ?? event.highlight_video_url ?? "";
        const loadedVideoTitle = docData?.highlight_video_title ?? event.highlight_video_title ?? "";
        const loadedAlbumUrl = docData?.photo_album_url ?? event.photo_album_url ?? "";
        const loadedAlbumTitle = docData?.photo_album_title ?? event.photo_album_title ?? "";
        const loadedRecap = docData?.recap_description ?? event.recap_description ?? "";
        const loadedStatus = (docData?.registration_status ||
          event.registration_status ||
          (event.status === "Draft" ? "Draft" : "Published")) as "Draft" | "Published" | "Closed";
        const loadedStartDate = toDateTimeLocal(docData?.registration_start_date ?? event.registration_start_date);
        const loadedEndDate = toDateTimeLocal(docData?.registration_end_date ?? event.registration_end_date);

        setRequiresApproval(loadedApproval);
        setMaxAttendees(loadedMaxAttendees);
        setSessions(loadedSessions);
        setQuestions(loadedQuestions);
        setHighlightVideoUrl(loadedVideoUrl);
        setHighlightVideoTitle(loadedVideoTitle);
        setPhotoAlbumUrl(loadedAlbumUrl);
        setPhotoAlbumTitle(loadedAlbumTitle);
        setRecapDescription(loadedRecap);
        setRegistrationStatus(loadedStatus);
        setRegistrationStartDate(loadedStartDate);
        setRegistrationEndDate(loadedEndDate);

        initialSnapshotRef.current = JSON.stringify({
          requiresApproval: loadedApproval,
          maxAttendees: loadedMaxAttendees,
          sessions: loadedSessions,
          questions: loadedQuestions,
          highlightVideoUrl: loadedVideoUrl,
          highlightVideoTitle: loadedVideoTitle,
          photoAlbumUrl: loadedAlbumUrl,
          photoAlbumTitle: loadedAlbumTitle,
          recapDescription: loadedRecap,
          registrationStatus: loadedStatus,
          registrationStartDate: loadedStartDate,
          registrationEndDate: loadedEndDate,
        });
      } catch (err) {
        console.warn("[CustomFormTab] Failed to load Firestore document:", err);
        initialSnapshotRef.current ??= JSON.stringify({
          requiresApproval: Boolean(event.requires_approval),
          maxAttendees: event.max_attendees ? String(event.max_attendees) : "",
          sessions: event.sessions ?? [],
          questions:
            event.custom_questions && event.custom_questions.length > 0
              ? event.custom_questions
              : DEFAULT_COMBINED_QUESTIONS,
          highlightVideoUrl: event.highlight_video_url ?? "",
          highlightVideoTitle: event.highlight_video_title ?? "",
          photoAlbumUrl: event.photo_album_url ?? "",
          photoAlbumTitle: event.photo_album_title ?? "",
          recapDescription: event.recap_description ?? "",
          registrationStatus: (event.registration_status ?? (event.status === "Draft" ? "Draft" : "Published")) as
            | "Draft"
            | "Published"
            | "Closed",
          registrationStartDate: toDateTimeLocal(event.registration_start_date),
          registrationEndDate: toDateTimeLocal(event.registration_end_date),
        });
      } finally {
        setIsInitialLoaded(true);
      }
    }
    void loadSavedFirestoreConfig();
  }, [event]);

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
        target.closest("[role='listbox']")
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

  // Session Handlers
  const handleLoadStandardSessions = () => {
    setSessions(DEFAULT_GDG_SESSIONS);
    toast.success("Loaded default sessions (Morning, Afternoon, Regular Ticket).");
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
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
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
    setQuestions(tmpl.questions);

    toast.success(`Applied "${tmpl.name}" format preset. Review policy, sessions, and questionnaire below.`);
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

  const handleDiscardChanges = () => {
    if (initialSnapshotRef.current) {
      try {
        const snap = JSON.parse(initialSnapshotRef.current) as {
          requiresApproval: boolean;
          maxAttendees: string;
          sessions: EventSession[];
          questions: CustomQuestion[];
          highlightVideoUrl: string;
          highlightVideoTitle: string;
          photoAlbumUrl: string;
          photoAlbumTitle: string;
          recapDescription: string;
          registrationStatus: "Draft" | "Published" | "Closed";
          registrationStartDate: string;
          registrationEndDate: string;
        };
        setRequiresApproval(snap.requiresApproval);
        setMaxAttendees(snap.maxAttendees);
        setSessions(snap.sessions);
        setQuestions(snap.questions);
        setHighlightVideoUrl(snap.highlightVideoUrl);
        setHighlightVideoTitle(snap.highlightVideoTitle);
        setPhotoAlbumUrl(snap.photoAlbumUrl);
        setPhotoAlbumTitle(snap.photoAlbumTitle);
        setRecapDescription(snap.recapDescription);
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
            max_attendees: resolvedMaxAttendees,
            webhook_url: event.webhook_url ? event.webhook_url : deleteField(),
            sessions: sessions.length > 0 ? sessions : deleteField(),
            custom_questions: questions.filter((q) => q.label.trim().length > 0),
            highlight_video_url: highlightVideoUrl.trim() ? highlightVideoUrl.trim() : deleteField(),
            highlight_video_title: highlightVideoTitle.trim() ? highlightVideoTitle.trim() : deleteField(),
            photo_album_url: photoAlbumUrl.trim() ? photoAlbumUrl.trim() : deleteField(),
            photo_album_title: photoAlbumTitle.trim() ? photoAlbumTitle.trim() : deleteField(),
            recap_description: recapDescription.trim() ? recapDescription.trim() : deleteField(),
            updated_at: new Date().toISOString(),
          };

          await saveFirestoreEvent(updatedEvent as unknown as FirestoreEvent);

          if (statusOverride) {
            setRegistrationStatus(statusOverride);
          }

          // Update initialSnapshotRef so isDirty becomes false
          initialSnapshotRef.current = JSON.stringify({
            requiresApproval,
            maxAttendees,
            sessions,
            questions,
            highlightVideoUrl,
            highlightVideoTitle,
            photoAlbumUrl,
            photoAlbumTitle,
            recapDescription,
            registrationStatus: finalStatus,
            registrationStartDate,
            registrationEndDate,
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
    <div className="space-y-6">
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

          <div className="flex items-center gap-2">
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
                    <Badge
                      variant={tmpl.category === "curated" ? "default" : "secondary"}
                      className="h-4.5 px-1.5 font-medium text-[10px]"
                    >
                      {tmpl.badge}
                    </Badge>
                    {tmpl.sessions && <span className="font-mono text-[10px] text-muted-foreground">3 Tracks</span>}
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
            {registrationStatus === "Draft" ? (
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
            ) : registrationStatus === "Published" ? (
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
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRegistrationStatus("Published");
                  toast.info("Registration status set to Published.");
                }}
                className="gap-1.5 text-xs text-emerald-600"
              >
                <Globe className="size-3.5" />
                Re-open Registration
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Status and Attendee Experience Banner */}
          {(() => {
            const previewWindowStatus = getRegistrationWindowStatus({
              ...event,
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
              <Input
                id="reg-start-date"
                type="datetime-local"
                value={registrationStartDate}
                onChange={(e) => setRegistrationStartDate(e.target.value)}
                className="h-9 text-xs"
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
              <Input
                id="reg-end-date"
                type="datetime-local"
                value={registrationEndDate}
                onChange={(e) => setRegistrationEndDate(e.target.value)}
                className="h-9 text-xs"
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
                When enabled, new registrants are marked as <strong>Pending Review</strong> and must be approved by an
                organizer in the Registrants tab before their ticket is confirmed.
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

      {/* ── 2. EVENT SESSIONS & CAPACITY SPLIT ───────────────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <CardTitle className="text-lg">Event Sessions & Limited Capacities</CardTitle>
            </div>
            <CardDescription className="pt-1">
              Split this event into concurrent or sequential sessions/tracks with independent attendee limits.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadStandardSessions}
              className="gap-1.5 self-start text-xs"
            >
              <Layers className="size-3.5" />
              Load Default Sessions
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddSession(!showAddSession)}
              className="gap-1.5 self-start text-xs"
            >
              <Plus className="size-3.5" />
              {showAddSession ? "Cancel" : "Add Session Track"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Add Session Form Drawer/Box */}
          {showAddSession && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h4 className="font-semibold text-foreground text-sm">Create New Session Track</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field className="sm:col-span-2">
                  <FieldLabel>Session Title *</FieldLabel>
                  <Input
                    placeholder="e.g. Morning Session / Afternoon Session"
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Time Slot</FieldLabel>
                  <Input
                    placeholder="e.g. 08:15 WIB - 12:00 WIB (Morning Session)"
                    value={newSession.time_slot ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, time_slot: e.target.value })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Check-in Deadline</FieldLabel>
                  <Input
                    placeholder="e.g. 09:05 WIB"
                    value={newSession.checkin_deadline ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, checkin_deadline: e.target.value })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Location / Room</FieldLabel>
                  <Input
                    placeholder="e.g. Auditorium / Main Venue"
                    value={newSession.location ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Max Capacity Limit *</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder="105"
                    value={newSession.capacity}
                    onChange={(e) => setNewSession({ ...newSession, capacity: Number(e.target.value) || 0 })}
                  />
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>Location URL / Google Maps Link (Optional)</FieldLabel>
                  <Input
                    placeholder="https://maps.app.goo.gl/... or https://maps.google.com/..."
                    value={newSession.location_url ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, location_url: e.target.value })}
                  />
                  <p className="pt-0.5 text-[10px] text-muted-foreground">
                    Direct Google Maps or venue directions link for attendees joining this specific session track.
                  </p>
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>Description / Prerequisites (HTML Format)</FieldLabel>
                  <HtmlEditText
                    value={newSession.description ?? ""}
                    onChange={(val) => setNewSession({ ...newSession, description: val })}
                    placeholder="e.g. <b>Keynote:</b> Overview and announcements.<br/><ul><li>Bring laptop</li></ul>"
                  />
                </Field>

                <Field>
                  <FieldLabel>Speaker Name (Optional)</FieldLabel>
                  <Input
                    placeholder="e.g. Jane Doe"
                    value={newSession.speaker_name ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, speaker_name: e.target.value })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Presentation Slides URL (Optional)</FieldLabel>
                  <Input
                    placeholder="https://docs.google.com/presentation/... or https://speakerdeck.com/..."
                    value={newSession.slides_url ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, slides_url: e.target.value })}
                  />
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>Slides Button Title (Optional)</FieldLabel>
                  <Input
                    placeholder="e.g. Presentation Deck / Slide Notes"
                    value={newSession.slides_title ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, slides_title: e.target.value })}
                  />
                </Field>

                <div className="space-y-2 rounded-lg border border-border/50 bg-background/50 p-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-xs">Related Resources & Code Links</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={() => {
                        if (!newSessionLinkUrl.trim()) {
                          toast.error("Please enter a link URL first.");
                          return;
                        }
                        const current = newSession.related_links ?? [];
                        setNewSession({
                          ...newSession,
                          related_links: [
                            ...current,
                            {
                              title: newSessionLinkTitle.trim() || newSessionLinkUrl.trim(),
                              url: newSessionLinkUrl.trim(),
                            },
                          ],
                        });
                        setNewSessionLinkTitle("");
                        setNewSessionLinkUrl("");
                      }}
                    >
                      <Plus className="size-3" />
                      Add Link
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Title (e.g. GitHub Repository)"
                      value={newSessionLinkTitle}
                      className="h-8 text-xs"
                      onChange={(e) => setNewSessionLinkTitle(e.target.value)}
                    />
                    <Input
                      placeholder="URL (https://github.com/...)"
                      value={newSessionLinkUrl}
                      className="h-8 text-xs"
                      onChange={(e) => setNewSessionLinkUrl(e.target.value)}
                    />
                  </div>

                  {newSession.related_links && newSession.related_links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {newSession.related_links.map((link, lIdx) => (
                        <Badge
                          key={`${link.url}-${lIdx}`}
                          variant="secondary"
                          className="gap-1.5 py-1 font-normal text-xs"
                        >
                          <Link2 className="size-3 text-primary" />
                          <span>{link.title}</span>
                          <button
                            type="button"
                            className="ml-1 hover:text-destructive"
                            onClick={() => {
                              const updated = (newSession.related_links ?? []).filter((_, idx2) => idx2 !== lIdx);
                              setNewSession({ ...newSession, related_links: updated });
                            }}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowAddSession(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAddSession} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Save Session
                </Button>
              </div>
            </div>
          )}

          {/* Configured Sessions List */}
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-muted-foreground text-xs">
              No breakout sessions configured. Registrants will sign up for the single main event.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((sess, idx) => (
                <div key={sess.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Session #{idx + 1}
                      </Badge>
                      <span className="font-semibold text-foreground text-sm">{sess.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {sess.total_registered || 0} / {sess.capacity} booked
                      </Badge>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveSession(sess.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field>
                      <FieldLabel className="text-xs">Session Title</FieldLabel>
                      <Input
                        value={sess.title}
                        onChange={(e) => handleUpdateSession(sess.id, { title: e.target.value })}
                      />
                    </Field>

                    <Field>
                      <FieldLabel className="text-xs">Time Slot</FieldLabel>
                      <Input
                        value={sess.time_slot ?? ""}
                        placeholder="e.g. 08:15 WIB - 12:00 WIB"
                        onChange={(e) => handleUpdateSession(sess.id, { time_slot: e.target.value })}
                      />
                    </Field>

                    <Field>
                      <FieldLabel className="text-xs">Check-in Deadline</FieldLabel>
                      <Input
                        value={sess.checkin_deadline ?? ""}
                        placeholder="e.g. 09:05 WIB"
                        onChange={(e) => handleUpdateSession(sess.id, { checkin_deadline: e.target.value })}
                      />
                    </Field>

                    <Field>
                      <FieldLabel className="text-xs">Capacity Limit</FieldLabel>
                      <Input
                        type="number"
                        min="1"
                        value={sess.capacity}
                        onChange={(e) => handleUpdateSession(sess.id, { capacity: Number(e.target.value) || 0 })}
                      />
                    </Field>

                    <Field className="sm:col-span-2">
                      <FieldLabel className="text-xs">Room / Location</FieldLabel>
                      <Input
                        value={sess.location ?? ""}
                        placeholder="e.g. Auditorium / Main Venue"
                        onChange={(e) => handleUpdateSession(sess.id, { location: e.target.value })}
                      />
                    </Field>

                    <Field className="sm:col-span-3">
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-xs">Location URL / Google Maps Link (Optional)</FieldLabel>
                        {sess.location_url && (
                          <a
                            href={sess.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            title="Open Google Maps link"
                          >
                            Open map <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </div>
                      <Input
                        value={sess.location_url ?? ""}
                        placeholder="https://maps.app.goo.gl/... or https://maps.google.com/..."
                        onChange={(e) => handleUpdateSession(sess.id, { location_url: e.target.value })}
                      />
                    </Field>

                    <Field className="sm:col-span-3">
                      <FieldLabel className="text-xs">Description / Prerequisites (HTML Format)</FieldLabel>
                      <HtmlEditText
                        value={sess.description ?? ""}
                        placeholder="Session prerequisites or topics in HTML..."
                        onChange={(val) => handleUpdateSession(sess.id, { description: val })}
                      />
                    </Field>

                    <Field className="sm:col-span-1">
                      <FieldLabel className="text-xs">Speaker Name (Optional)</FieldLabel>
                      <Input
                        value={sess.speaker_name ?? ""}
                        placeholder="e.g. Jane Doe"
                        onChange={(e) => handleUpdateSession(sess.id, { speaker_name: e.target.value })}
                      />
                    </Field>

                    <Field className="sm:col-span-1">
                      <FieldLabel className="text-xs">Presentation Slides URL (Optional)</FieldLabel>
                      <Input
                        value={sess.slides_url ?? ""}
                        placeholder="https://docs.google.com/presentation/... or https://speakerdeck.com/..."
                        onChange={(e) => handleUpdateSession(sess.id, { slides_url: e.target.value })}
                      />
                    </Field>

                    <Field className="sm:col-span-1">
                      <FieldLabel className="text-xs">Slides Button Title (Optional)</FieldLabel>
                      <Input
                        value={sess.slides_title ?? ""}
                        placeholder="e.g. Keynote Deck"
                        onChange={(e) => handleUpdateSession(sess.id, { slides_title: e.target.value })}
                      />
                    </Field>

                    <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:col-span-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground text-xs">Related Resources & Code Links</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 gap-1 px-2 text-[11px]"
                          onClick={() => {
                            const current = sess.related_links ?? [];
                            handleUpdateSession(sess.id, {
                              related_links: [...current, { title: "", url: "" }],
                            });
                          }}
                        >
                          <Plus className="size-3" />
                          Add Link
                        </Button>
                      </div>

                      {sess.related_links && sess.related_links.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {sess.related_links.map((link, lIdx) => (
                            <div key={lIdx} className="flex items-center gap-2">
                              <Input
                                placeholder="Title (e.g. GitHub Repo / Colab)"
                                value={link.title}
                                className="h-8 text-xs"
                                onChange={(e) => {
                                  const updated = [...(sess.related_links ?? [])];
                                  updated[lIdx] = { ...updated[lIdx], title: e.target.value };
                                  handleUpdateSession(sess.id, { related_links: updated });
                                }}
                              />
                              <Input
                                placeholder="URL (https://github.com/...)"
                                value={link.url}
                                className="h-8 text-xs"
                                onChange={(e) => {
                                  const updated = [...(sess.related_links ?? [])];
                                  updated[lIdx] = { ...updated[lIdx], url: e.target.value };
                                  handleUpdateSession(sess.id, { related_links: updated });
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const updated = (sess.related_links ?? []).filter((_, idx2) => idx2 !== lIdx);
                                  handleUpdateSession(sess.id, { related_links: updated });
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          No related links added. Click &quot;Add Link&quot; to link repositories or docs.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. REGISTRATION QUESTIONNAIRE BUILDER ───────────────────── */}
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

            <Button size="sm" variant="outline" onClick={handleAddQuestion} className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Question
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
              No custom questions configured. Registrants will only submit their member profile.
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
                    onUpdate={handleUpdateQuestion}
                    onRemove={handleRemoveQuestion}
                    onMoveUp={handleMoveQuestionUp}
                    onMoveDown={handleMoveQuestionDown}
                  />
                ))}
              </div>
            </DragDropProvider>
          )}
        </CardContent>
      </Card>

      {/* ── 4. POST-EVENT HIGHLIGHTS & MEDIA RECAP ──────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="size-4 text-primary" />
            <CardTitle className="text-lg">Post-Event Highlights & Media</CardTitle>
          </div>
          <CardDescription>
            Embed highlight videos, link official photo albums (Google Drive or Google Photos), and provide recap notes
            for attendees and public visitors after the event concludes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Highlight Video URL */}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="highlight-video-url">Event Highlight Video URL (YouTube, Vimeo, MP4)</FieldLabel>
              <Input
                id="highlight-video-url"
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/... or https://vimeo.com/..."
                value={highlightVideoUrl}
                onChange={(e) => setHighlightVideoUrl(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Paste YouTube (standard, shorts, embed) or Vimeo link. Automatically embeds as a responsive 16:9
                  player on the public page.
                </p>
                {highlightVideoUrl &&
                  (() => {
                    const parsed = parseVideoUrl(highlightVideoUrl);
                    return parsed?.embedUrl ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        ✓ Valid {parsed.type.toUpperCase()} embed detected
                      </Badge>
                    ) : null;
                  })()}
              </div>
            </Field>

            {/* Highlight Video Title */}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="highlight-video-title">Video Display Title (Optional)</FieldLabel>
              <Input
                id="highlight-video-title"
                placeholder="e.g. GDG Jakarta DevFest 2025 Highlight Reel"
                value={highlightVideoTitle}
                onChange={(e) => setHighlightVideoTitle(e.target.value)}
              />
            </Field>

            {/* Photo Album URL */}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="photo-album-url">Photo Album Link (Google Photos / Google Drive)</FieldLabel>
              <Input
                id="photo-album-url"
                placeholder="https://photos.app.goo.gl/... or https://drive.google.com/drive/folders/..."
                value={photoAlbumUrl}
                onChange={(e) => setPhotoAlbumUrl(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Official photo album link from Google Photos shared album or Google Drive folder.
                </p>
                {photoAlbumUrl &&
                  (() => {
                    const parsed = parsePhotoAlbum(photoAlbumUrl);
                    return (
                      <Badge
                        variant="outline"
                        className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                      >
                        ✓ Detected {parsed?.label} link
                      </Badge>
                    );
                  })()}
              </div>
            </Field>

            {/* Photo Album Title */}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="photo-album-title">Photo Album Title (Optional)</FieldLabel>
              <Input
                id="photo-album-title"
                placeholder="e.g. Official GDG Jakarta Event Photos"
                value={photoAlbumTitle}
                onChange={(e) => setPhotoAlbumTitle(e.target.value)}
              />
            </Field>

            {/* Recap Description */}
            <Field className="sm:col-span-2">
              <FieldLabel>Event Recap & Takeaways (HTML Format)</FieldLabel>
              <HtmlEditText
                value={recapDescription}
                onChange={(val) => setRecapDescription(val)}
                placeholder="Summary of sessions, key takeaways, thank you notes, or community announcements..."
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Save All Settings Floating / Bottom Action Row */}
      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-border/80 bg-background/95 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span>You have unsaved changes</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="size-3.5 text-emerald-500" />
              <span>All settings are up to date</span>
            </div>
          )}
          <span className="hidden text-muted-foreground/40 sm:inline">•</span>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            Status: <strong>{registrationStatus}</strong>
            {registrationStatus === "Draft" && " (Registration not open)"}
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleDiscardChanges}
              disabled={isPending}
              className="text-xs"
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Discard
            </Button>
          )}
          <Button
            onClick={() => void handleSave()}
            disabled={!isDirty || isPending}
            className="shrink-0 gap-2 shadow-xs"
            size="default"
          >
            <Save className="size-4" />
            {isPending ? "Saving..." : isDirty ? "Save All Settings" : "Saved (No Changes)"}
          </Button>
        </div>
      </div>

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
    </div>
  );
}
