"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { ExternalLink, Layers, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  MULTI_TRACK_TEMPLATE,
  PAID_REGISTRATION_TEMPLATE,
  QUICK_RSVP_TEMPLATE,
  ROAD_TO_DEVFEST_TEMPLATE,
} from "@/lib/events/registration-defaults";
import type { CustomQuestion, EventSession, FirestoreEvent } from "@/lib/firestore/types";

import { HtmlEditText } from "./html-edit-text";
import { SortableQuestionCard } from "./sortable-question-card";

interface CustomFormTabProps {
  event: FirestoreEvent;
}

export function CustomFormTab({ event }: CustomFormTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. Policy & Capacity
  const [requiresApproval, setRequiresApproval] = useState(Boolean(event.requires_approval));
  const [maxAttendees, setMaxAttendees] = useState(event.max_attendees ? String(event.max_attendees) : "");

  // 2. Event Sessions (Split into Sessions with Limited Capacity)
  const [sessions, setSessions] = useState<EventSession[]>(event.sessions ?? []);
  const [newSession, setNewSession] = useState<Omit<EventSession, "id">>({
    title: "",
    description: "",
    time_slot: "",
    checkin_deadline: "",
    location: "",
    location_url: "",
    capacity: 50,
  });
  const [showAddSession, setShowAddSession] = useState(false);

  // 3. Derived Capacity & Multi-Session Calculation
  const hasMultipleSessions = sessions.length > 0;
  const totalSessionCapacity = sessions.reduce((acc, sess) => acc + (Number(sess.capacity) || 0), 0);

  // 4. Registration Questions
  const [questions, setQuestions] = useState<CustomQuestion[]>(
    event.custom_questions && event.custom_questions.length > 0 ? event.custom_questions : DEFAULT_COMBINED_QUESTIONS,
  );
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<"all" | "curated" | "standard">("all");

  // Load any previously saved Firestore settings on client mount
  useEffect(() => {
    async function loadSavedFirestoreConfig() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          if (docData.requires_approval !== undefined) setRequiresApproval(docData.requires_approval);
          if (docData.max_attendees !== undefined && docData.max_attendees !== null) {
            setMaxAttendees(String(docData.max_attendees));
          } else {
            setMaxAttendees("");
          }
          if (Array.isArray(docData.sessions)) {
            setSessions(docData.sessions);
          }
          if (docData.custom_questions && docData.custom_questions.length > 0) setQuestions(docData.custom_questions);
        }
      } catch (err) {
        console.warn("[CustomFormTab] Failed to load Firestore document:", err);
      }
    }
    void loadSavedFirestoreConfig();
  }, [event.id]);

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
    });
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

  // Save All Settings
  const handleSave = () => {
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

        const updatedEvent: Record<string, unknown> = {
          ...event,
          requires_approval: requiresApproval,
          max_attendees: resolvedMaxAttendees,
          webhook_url: event.webhook_url ? event.webhook_url : deleteField(),
          sessions: sessions.length > 0 ? sessions : deleteField(),
          custom_questions: questions.filter((q) => q.label.trim().length > 0),
          updated_at: new Date().toISOString(),
        };

        await saveFirestoreEvent(updatedEvent as unknown as FirestoreEvent);
        toast.success("Registration form and session settings saved successfully!");
        router.refresh();
      } catch (err) {
        console.error("[CustomFormTab] Failed to save settings:", err);
        toast.error("Failed to save settings. Please try again.");
      }
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

      {/* ── 1. APPROVAL & CAPACITY SETTINGS ─────────────────────────── */}
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

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isPending} className="gap-2" size="default">
              <Save className="size-4" />
              Save All Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
