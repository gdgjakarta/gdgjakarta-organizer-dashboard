"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ExternalLink, Layers, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VALIDATION_TYPE_OPTIONS } from "@/lib/events/question-validator";
import {
  COMMON_MEETUP_TEMPLATE,
  DEFAULT_COMBINED_QUESTIONS,
  DEFAULT_GDG_SESSIONS,
  QUICK_RSVP_TEMPLATE,
  REGISTRATION_SECTIONS,
  ROAD_TO_DEVFEST_TEMPLATE,
} from "@/lib/events/registration-defaults";
import type { CustomQuestion, EventSession, FirestoreEvent, QuestionValidationType } from "@/lib/firestore/types";

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

  // 4. Registration Questions
  const [questions, setQuestions] = useState<CustomQuestion[]>(
    event.custom_questions && event.custom_questions.length > 0 ? event.custom_questions : DEFAULT_COMBINED_QUESTIONS,
  );

  // Load any previously saved Firestore settings on client mount
  useEffect(() => {
    async function loadSavedFirestoreConfig() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          if (docData.requires_approval !== undefined) setRequiresApproval(docData.requires_approval);
          if (docData.max_attendees !== undefined)
            setMaxAttendees(docData.max_attendees ? String(docData.max_attendees) : "");
          if (docData.sessions && docData.sessions.length > 0) setSessions(docData.sessions);
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
    toast.success("Loaded standard GDG Jakarta sessions (Morning, Afternoon, Regular Ticket).");
  };

  const handleAddSession = () => {
    if (!newSession.title.trim()) {
      toast.error("Please provide a session title.");
      return;
    }
    const created: EventSession = {
      id: `sess_${Date.now()}`,
      title: newSession.title.trim(),
      description: newSession.description?.trim() || undefined,
      time_slot: newSession.time_slot?.trim() || undefined,
      checkin_deadline: newSession.checkin_deadline?.trim() || undefined,
      location: newSession.location?.trim() || undefined,
      location_url: newSession.location_url?.trim() || undefined,
      capacity: Number(newSession.capacity) || 50,
      total_registered: 0,
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

  const handleLoadTemplate = (templateName: string) => {
    if (templateName === "combined") {
      setQuestions(DEFAULT_COMBINED_QUESTIONS);
      toast.success("Loaded Combined Form (Road to DevFest + Common Form) template.");
    } else if (templateName === "devfest") {
      setQuestions(ROAD_TO_DEVFEST_TEMPLATE);
      toast.success("Loaded Road to DevFest Builder Sprint template.");
    } else if (templateName === "common") {
      setQuestions(COMMON_MEETUP_TEMPLATE);
      toast.success("Loaded Common Meetup template.");
    } else if (templateName === "quick") {
      setQuestions(QUICK_RSVP_TEMPLATE);
      toast.success("Loaded Fast RSVP template.");
    }
  };

  // Save All Settings
  const handleSave = () => {
    startTransition(async () => {
      try {
        const updatedEvent: FirestoreEvent = {
          ...event,
          requires_approval: requiresApproval,
          max_attendees: maxAttendees ? Number(maxAttendees) : undefined,
          webhook_url: event.webhook_url,
          sessions: sessions.length > 0 ? sessions : undefined,
          custom_questions: questions.filter((q) => q.label.trim().length > 0),
          updated_at: new Date().toISOString(),
        };

        const { saveFirestoreEvent } = await import("@/lib/firestore/client");
        await saveFirestoreEvent(updatedEvent);
        toast.success("Registration form and session settings saved successfully!");
        router.refresh();
      } catch (err) {
        console.error("[CustomFormTab] Failed to save settings:", err);
        toast.error("Failed to save settings. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-6">
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
              <FieldLabel htmlFor="max-attendees">Total Event Capacity (Optional)</FieldLabel>
              <Input
                id="max-attendees"
                type="number"
                placeholder="Unlimited"
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty for unlimited seats across the entire venue.
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
              Load GDG Sessions
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
                  <FieldLabel>Description / Prerequisites</FieldLabel>
                  <Input
                    placeholder="e.g. Morning keynote and technical sessions."
                    value={newSession.description ?? ""}
                    onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
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
                      <FieldLabel className="text-xs">Description / Prerequisites</FieldLabel>
                      <Input
                        value={sess.description ?? ""}
                        placeholder="Session prerequisites or topics"
                        onChange={(e) => handleUpdateSession(sess.id, { description: e.target.value })}
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
              Questions presented to GDG community members when applying or registering for this event.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={handleLoadTemplate}>
              <SelectTrigger size="sm" className="h-8 text-xs">
                <SelectValue placeholder="Load Preset Template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="combined">Combined Default Form (Full)</SelectItem>
                <SelectItem value="devfest">Road to DevFest Builder Sprint</SelectItem>
                <SelectItem value="common">Common Meetup & Talk</SelectItem>
                <SelectItem value="quick">Quick Lightweight RSVP</SelectItem>
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
            questions.map((q, idx) => (
              <div key={q.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-muted-foreground text-xs uppercase">Question #{idx + 1}</span>
                    {q.section && (
                      <Badge variant="outline" className="text-[10px]">
                        {q.section}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveQuestion(q.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Field>
                      <FieldLabel className="text-xs">Question Label *</FieldLabel>
                      <Input
                        placeholder="e.g. Primary Tech Stack or Project Idea"
                        value={q.label}
                        onChange={(e) => handleUpdateQuestion(q.id, { label: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="md:col-span-3">
                    <Field>
                      <FieldLabel className="text-xs">Section Group</FieldLabel>
                      <Select
                        value={q.section || "Additional Information"}
                        onValueChange={(val) => handleUpdateQuestion(q.id, { section: val })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGISTRATION_SECTIONS.map((sec) => (
                            <SelectItem key={sec} value={sec}>
                              {sec}
                            </SelectItem>
                          ))}
                          <SelectItem value="Additional Information">Additional Information</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="md:col-span-2">
                    <Field>
                      <FieldLabel className="text-xs">Input Type</FieldLabel>
                      <Select
                        value={q.type}
                        onValueChange={(val: CustomQuestion["type"]) => handleUpdateQuestion(q.id, { type: val })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Short Text</SelectItem>
                          <SelectItem value="textarea">Paragraph</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                          <SelectItem value="radio">Single Choice</SelectItem>
                          <SelectItem value="multiselect">Multi-select</SelectItem>
                          <SelectItem value="checkbox">Agreement Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex items-end pb-2 md:col-span-2">
                    <label
                      htmlFor={`required-${q.id}`}
                      className="flex cursor-pointer items-center gap-2 font-medium text-xs"
                    >
                      <Checkbox
                        id={`required-${q.id}`}
                        checked={q.required}
                        onCheckedChange={(checked) => handleUpdateQuestion(q.id, { required: Boolean(checked) })}
                      />
                      Required
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel className="text-xs">Help Text / Description (Optional)</FieldLabel>
                    <Input
                      placeholder="Guidance shown beneath the question"
                      value={q.description || ""}
                      onChange={(e) => handleUpdateQuestion(q.id, { description: e.target.value })}
                    />
                  </Field>

                  {["select", "radio", "multiselect", "checkbox"].includes(q.type) && (
                    <Field>
                      <FieldLabel className="text-xs">Options (Comma separated)</FieldLabel>
                      <Input
                        placeholder="Option 1, Option 2, Option 3"
                        value={q.options?.join(", ") ?? ""}
                        onChange={(e) =>
                          handleUpdateQuestion(q.id, {
                            options: e.target.value
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Field>
                  )}
                </div>

                {/* Validation & Constraints for Text & Paragraph inputs */}
                {["text", "textarea"].includes(q.type) && (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <span className="font-medium text-foreground text-xs">Validation & Constraints</span>
                      <span className="text-[10px] text-muted-foreground">
                        Enforce format, character limits, and error message
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {/* Validation Rule Dropdown */}
                      <Field className={q.validation_type === "customRegex" ? "" : "sm:col-span-2 md:col-span-1"}>
                        <FieldLabel className="text-xs">Validation Rule</FieldLabel>
                        <Select
                          value={q.validation_type ?? "none"}
                          onValueChange={(val: QuestionValidationType) =>
                            handleUpdateQuestion(q.id, { validation_type: val })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VALIDATION_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Custom Regex Pattern input */}
                      {q.validation_type === "customRegex" && (
                        <Field className="sm:col-span-2 md:col-span-2">
                          <FieldLabel className="text-xs">Custom Regex Pattern</FieldLabel>
                          <Input
                            placeholder="e.g. ^[A-Za-z0-9_-]{3,20}$"
                            value={q.regex_pattern ?? ""}
                            onChange={(e) => handleUpdateQuestion(q.id, { regex_pattern: e.target.value })}
                            className="font-mono text-xs"
                          />
                        </Field>
                      )}

                      {/* Minimum Characters */}
                      <Field>
                        <FieldLabel className="text-xs">Min Characters</FieldLabel>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 5"
                          value={q.min_length !== undefined ? String(q.min_length) : ""}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, {
                              min_length: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </Field>

                      {/* Maximum Characters */}
                      <Field>
                        <FieldLabel className="text-xs">Max Characters</FieldLabel>
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g. 100"
                          value={q.max_length !== undefined ? String(q.max_length) : ""}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, {
                              max_length: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </Field>
                    </div>

                    {/* Custom Error Message */}
                    <Field>
                      <FieldLabel className="text-xs">Custom Error Message (Optional)</FieldLabel>
                      <Input
                        placeholder="Leave blank to generate friendly message automatically"
                        value={q.custom_error_message ?? ""}
                        onChange={(e) => handleUpdateQuestion(q.id, { custom_error_message: e.target.value })}
                      />
                      <p className="pt-0.5 text-[10px] text-muted-foreground">
                        Leave blank if you want the app to generate intelligent, context-aware error messages by
                        default.
                      </p>
                    </Field>
                  </div>
                )}
              </div>
            ))
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
