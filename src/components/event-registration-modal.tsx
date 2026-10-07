"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CheckCircle2, Clock, ExternalLink, Layers, Loader2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { validateQuestionAnswer } from "@/lib/events/question-validator";
import {
  DEFAULT_COMBINED_QUESTIONS,
  getSessionRemainingSeats,
  isSessionAvailable,
} from "@/lib/events/registration-defaults";
import { checkEventRegistrationAction, registerForEventAction } from "@/lib/firestore/actions";
import type { CustomQuestion, EventSession, FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { dispatchRegistrationWebhookAction, type RegistrationWebhookPayload } from "@/server/registration-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface EventRegistrationModalProps {
  event: FirestoreEvent;
  existingRegistration?: FirestoreRegistration | null;
  children?: React.ReactNode;
}

function isEventPast(event: FirestoreEvent): boolean {
  if (event.status === "Completed") return true;
  const targetDate = event.end_date || event.start_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function EventRegistrationModal({ event, existingRegistration, children }: EventRegistrationModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const formUid = useId();

  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [localReg, setLocalReg] = useState<FirestoreRegistration | null>(existingRegistration ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (existingRegistration) {
      setLocalReg(existingRegistration);
      return;
    }
    if (!user) return;
    async function checkStatus() {
      try {
        const found = await checkEventRegistrationAction(String(event.id), user?.id, user?.email);
        if (found) {
          setLocalReg(found);
        }
      } catch (err) {
        console.error("[EventRegistrationModal] failed to check registration status:", err);
      }
    }
    void checkStatus();
  }, [user, event.id, existingRegistration]);

  // Pre-fill user profile fields when modal opens
  useEffect(() => {
    if (open && user) {
      setAnswers((prev) => ({
        ...prev,
        work_email: (prev.work_email as string) || user.email || "",
      }));
    }
  }, [open, user]);

  const [eventConfig, setEventConfig] = useState<FirestoreEvent>(event);

  useEffect(() => {
    setEventConfig(event);
    async function loadLatestFirestoreEvent() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          setEventConfig((prev) => ({
            ...prev,
            ...docData,
          }));
        }
      } catch (err) {
        console.warn("[EventRegistrationModal] Failed to load Firestore event doc:", err);
      }
    }
    void loadLatestFirestoreEvent();
  }, [event]);

  const activeRegistration = existingRegistration ?? localReg;
  const isPast = isEventPast(eventConfig);

  const questions: CustomQuestion[] =
    eventConfig.custom_questions && eventConfig.custom_questions.length > 0
      ? eventConfig.custom_questions
      : DEFAULT_COMBINED_QUESTIONS;

  const hasSessions = Array.isArray(eventConfig.sessions) && eventConfig.sessions.length > 0;

  // Group questions by section for structured rendering
  const sectionsMap = new Map<string, CustomQuestion[]>();
  for (const q of questions) {
    const sec = q.section ?? "Additional Information";
    if (!sectionsMap.has(sec)) {
      sectionsMap.set(sec, []);
    }
    sectionsMap.get(sec)?.push(q);
  }

  const handleTextChange = (questionId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    const question = questions.find((q) => q.id === questionId);
    if (question && (touchedFields.has(questionId) || val.length > 0)) {
      const result = validateQuestionAnswer(question, val);
      setFieldErrors((prev) => {
        if (result.isValid) {
          const next = { ...prev };
          delete next[questionId];
          return next;
        }
        return { ...prev, [questionId]: result.error ?? "Invalid input" };
      });
    }
  };

  const handleBlur = (questionId: string) => {
    setTouchedFields((prev) => new Set(prev).add(questionId));
    const question = questions.find((q) => q.id === questionId);
    if (question) {
      const val = answers[questionId];
      const result = validateQuestionAnswer(question, val);
      setFieldErrors((prev) => {
        if (result.isValid) {
          const next = { ...prev };
          delete next[questionId];
          return next;
        }
        return { ...prev, [questionId]: result.error ?? "Invalid input" };
      });
    }
  };

  const handleMultiSelectToggle = (questionId: string, option: string) => {
    setTouchedFields((prev) => new Set(prev).add(questionId));
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const updated = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      const question = questions.find((q) => q.id === questionId);
      if (question) {
        const result = validateQuestionAnswer(question, updated);
        setFieldErrors((errs) => {
          if (result.isValid) {
            const next = { ...errs };
            delete next[questionId];
            return next;
          }
          return { ...errs, [questionId]: result.error ?? "Invalid input" };
        });
      }
      return { ...prev, [questionId]: updated };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to register for GDG Jakarta events.");
      router.push("/auth/login");
      return;
    }

    if (isPast) {
      toast.error("This event has already ended. Registration is closed.");
      setOpen(false);
      return;
    }

    // 1. Validate Session Selection if event is split into sessions
    let selectedSession: EventSession | undefined;
    if (hasSessions) {
      if (!selectedSessionId) {
        toast.error("Please choose a session track to attend.");
        return;
      }
      selectedSession = eventConfig.sessions?.find((s) => s.id === selectedSessionId);
      if (!selectedSession) {
        toast.error("Selected session is not valid.");
        return;
      }
      if (!isSessionAvailable(selectedSession)) {
        toast.error(`The session "${selectedSession.title}" is full. Please choose another session.`);
        return;
      }
    }

    // 2. Validate All Questions (Required, Min/Max Length, Format, Custom Regex)
    const newErrors: Record<string, string> = {};
    let firstErrorMsg: string | null = null;
    let firstErrorId: string | null = null;

    for (const q of questions) {
      const val = answers[q.id];
      const result = validateQuestionAnswer(q, val);
      if (!result.isValid) {
        newErrors[q.id] = result.error ?? `Please check: "${q.label}"`;
        if (!firstErrorMsg) {
          firstErrorMsg = result.error ?? `Please check: "${q.label}"`;
          firstErrorId = `${formUid}-${q.id}`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setTouchedFields(new Set(questions.map((q) => q.id)));
      toast.error(firstErrorMsg ?? "Please review the form for errors.");
      if (firstErrorId && typeof document !== "undefined") {
        const el = document.getElementById(firstErrorId);
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    startTransition(async () => {
      try {
        const initialStatus = eventConfig.requires_approval ? "pending" : "approved";

        const sessionKey = selectedSession?.title ?? "Regular Ticket";
        const combinedAnswers = {
          ...answers,
          Session: sessionKey,
        };

        const registrationPayload: Omit<FirestoreRegistration, "id"> = {
          event_id: String(event.id),
          event_title: event.title,
          member_id: user.id,
          member_name: user.name,
          member_email: user.email,
          member_avatar: user.avatar,
          member_role: user.role,
          status: initialStatus,
          answers: combinedAnswers,
          session_id: selectedSession?.id,
          session_title: selectedSession?.title,
          registered_at: new Date().toISOString(),
        };

        const result = await registerForEventAction(registrationPayload);

        if (!result.success) {
          toast.error(result.error || "Failed to register. Please try again.");
          return;
        }

        // Dispatch Webhook in background
        const webhookPayload: RegistrationWebhookPayload = {
          Session: sessionKey,
          event: {
            id: String(event.id),
            title: event.title,
            status: event.status,
            start_date: event.start_date,
            end_date: event.end_date,
            venue_name: event.venue?.name,
            audience_type: event.audience_type,
            is_virtual: event.is_virtual,
            webhook_url: eventConfig.webhook_url,
          },
          registration: {
            id: result.registrationId || `${event.id}_${user.id}`,
            status: initialStatus,
            registered_at: registrationPayload.registered_at,
            session_id: selectedSession?.id,
            session_title: selectedSession?.title ?? sessionKey,
            session_location: selectedSession?.location,
            session_location_url: selectedSession?.location_url,
            Session: sessionKey,
          },
          member: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          },
          answers: combinedAnswers,
          timestamp: new Date().toISOString(),
        };

        void dispatchRegistrationWebhookAction(webhookPayload).then((webhookResult) => {
          if (webhookResult.dispatched && webhookResult.error) {
            console.warn("[Registration Modal] Webhook warning:", webhookResult.error);
          }
        });

        if (event.requires_approval) {
          toast.success("Registration submitted! Your application is now pending organizer review.", {
            duration: 5000,
          });
        } else {
          toast.success("Successfully registered! We look forward to seeing you at the event.", {
            duration: 5000,
          });
        }

        setOpen(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to register. Please try again.";
        toast.error(msg);
      }
    });
  };

  if (activeRegistration) {
    const isApproved = activeRegistration.status === "approved" || activeRegistration.status === "attended";
    const isPendingReview = activeRegistration.status === "pending";
    let statusLabel = "Registered";
    if (isApproved) {
      statusLabel = "Registered (Approved)";
    } else if (isPendingReview) {
      statusLabel = "Pending Approval";
    }

    return (
      <Button
        variant={isApproved ? "outline" : "secondary"}
        size="sm"
        disabled
        className="cursor-default gap-1.5 opacity-90"
      >
        <CheckCircle2 className={cn("size-3.5", isApproved ? "text-emerald-500" : "text-amber-500")} />
        {statusLabel}
      </Button>
    );
  }

  if (isPast) {
    return (
      <Button variant="secondary" size="sm" disabled className="cursor-default opacity-75">
        Registration Closed
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Register for Event
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {resolveEventAudience(event.audience_type, event.is_virtual).label}
            </Badge>
            {event.requires_approval && (
              <Badge variant="secondary" className="text-[10px]">
                Requires Approval
              </Badge>
            )}
            {hasSessions && (
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-[10px] text-primary">
                Multi-Session Event
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl leading-snug">{event.title}</DialogTitle>
          <DialogDescription>
            {event.requires_approval
              ? "This event is curated. Please complete your registration details and preferences for organizer review."
              : "Complete the registration questionnaire to confirm your RSVP and reserve your spot."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Member Profile Banner */}
          {user && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3.5 text-xs">
              <div className="space-y-0.5">
                <span className="font-medium text-muted-foreground">Registering Account:</span>
                <div className="font-semibold text-foreground text-sm">
                  {user.name} <span className="font-normal text-muted-foreground text-xs">({user.email})</span>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {user.role}
              </Badge>
            </div>
          )}

          {/* ── SESSIONS SELECTION SECTION ───────────────────────────── */}
          {hasSessions && eventConfig.sessions && (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Choose Your Session Track</h3>
                <span className="text-destructive">*</span>
              </div>
              <p className="text-muted-foreground text-xs">
                This event has limited capacity per session track. Please select the track you plan to attend.
              </p>

              <RadioGroup
                value={selectedSessionId}
                onValueChange={setSelectedSessionId}
                className="grid grid-cols-1 gap-2.5 pt-1"
              >
                {eventConfig.sessions.map((sess) => {
                  const available = isSessionAvailable(sess);
                  const remaining = getSessionRemainingSeats(sess);
                  const registered = sess.total_registered || 0;
                  const isSelected = selectedSessionId === sess.id;

                  return (
                    <label
                      key={sess.id}
                      htmlFor={`session-opt-${sess.id}`}
                      className={cn(
                        "relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border bg-card hover:bg-muted/30",
                        !available && "cursor-not-allowed opacity-60 hover:bg-card",
                      )}
                    >
                      <RadioGroupItem
                        value={sess.id}
                        id={`session-opt-${sess.id}`}
                        disabled={!available}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground text-sm">{sess.title}</span>
                          {sess.capacity > 0 && (
                            <Badge
                              variant={!available || remaining <= 5 ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {available
                                ? `${registered}/${sess.capacity} filled (${remaining} left)`
                                : `Full (${sess.capacity} max)`}
                            </Badge>
                          )}
                        </div>

                        {sess.description && (
                          <div
                            className="prose prose-xs dark:prose-invert max-w-none text-muted-foreground text-xs leading-relaxed [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: Event organizer session description
                            dangerouslySetInnerHTML={{ __html: sess.description }}
                          />
                        )}

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                          {sess.time_slot && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {sess.time_slot}
                            </span>
                          )}
                          {sess.checkin_deadline && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Clock className="size-3" />
                              Check-in by: {sess.checkin_deadline}
                            </span>
                          )}
                          {(sess.location || sess.location_url) &&
                            (sess.location_url ? (
                              <a
                                href={sess.location_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80 hover:underline"
                                title="Open Google Maps / Venue Location"
                              >
                                <MapPin className="size-3" />
                                <span>{sess.location || "Google Maps"}</span>
                                <ExternalLink className="size-2.5" />
                              </a>
                            ) : (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                {sess.location}
                              </span>
                            ))}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {/* ── QUESTIONNAIRE SECTIONS ───────────────────────────────── */}
          <div className="space-y-6">
            {Array.from(sectionsMap.entries()).map(([sectionName, sectionQuestions], secIdx) => (
              <div key={sectionName} className="space-y-4">
                <div className="border-b pb-1.5">
                  <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    {secIdx + 1}. {sectionName}
                  </h4>
                </div>

                <div className="space-y-4">
                  {sectionQuestions.map((q) => {
                    const fieldId = `${formUid}-${q.id}`;
                    const isTouched = touchedFields.has(q.id);
                    const errorMessage = isTouched ? fieldErrors[q.id] : undefined;
                    const strVal = typeof answers[q.id] === "string" ? (answers[q.id] as string) : "";
                    const charCount = strVal.length;
                    const hasLengthLimits = typeof q.min_length === "number" || typeof q.max_length === "number";
                    const isLengthViolated =
                      (typeof q.min_length === "number" && charCount > 0 && charCount < q.min_length) ||
                      (typeof q.max_length === "number" && charCount > q.max_length);

                    return (
                      <Field key={q.id}>
                        <FieldLabel htmlFor={fieldId} className="font-medium text-xs">
                          {q.label} {q.required && <span className="text-destructive">*</span>}
                        </FieldLabel>

                        {q.description && <p className="pb-1 text-[11px] text-muted-foreground">{q.description}</p>}

                        {/* Short Text */}
                        {q.type === "text" && (
                          <Input
                            id={fieldId}
                            placeholder={q.placeholder || "Your answer"}
                            value={strVal}
                            onChange={(e) => handleTextChange(q.id, e.target.value)}
                            onBlur={() => handleBlur(q.id)}
                            maxLength={q.max_length}
                            aria-invalid={Boolean(errorMessage)}
                            className={cn(errorMessage && "border-destructive focus-visible:ring-destructive/30")}
                            required={q.required}
                          />
                        )}

                        {/* Paragraph Textarea */}
                        {q.type === "textarea" && (
                          <Textarea
                            id={fieldId}
                            placeholder={q.placeholder || "Type your response here..."}
                            value={strVal}
                            onChange={(e) => handleTextChange(q.id, e.target.value)}
                            onBlur={() => handleBlur(q.id)}
                            rows={3}
                            maxLength={q.max_length}
                            aria-invalid={Boolean(errorMessage)}
                            className={cn(errorMessage && "border-destructive focus-visible:ring-destructive/30")}
                            required={q.required}
                          />
                        )}

                        {/* Helper row with error message and live character counter for text / textarea */}
                        {(q.type === "text" || q.type === "textarea") && (errorMessage || hasLengthLimits) && (
                          <div className="flex items-start justify-between gap-2 pt-1 text-[11px]">
                            {errorMessage ? (
                              <p className="font-medium text-destructive leading-tight">{errorMessage}</p>
                            ) : (
                              <span />
                            )}
                            {hasLengthLimits && (
                              <span
                                className={cn(
                                  "ml-auto shrink-0 text-[11px] tabular-nums",
                                  isLengthViolated && isTouched
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                {typeof q.max_length === "number"
                                  ? `${charCount} / ${q.max_length}${typeof q.min_length === "number" ? ` (min ${q.min_length})` : ""}`
                                  : `${charCount} chars (min ${q.min_length})`}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Dropdown Select */}
                        {q.type === "select" && (
                          <Select
                            value={(answers[q.id] as string) || ""}
                            onValueChange={(val) => {
                              handleTextChange(q.id, val);
                              handleBlur(q.id);
                            }}
                          >
                            <SelectTrigger
                              id={fieldId}
                              aria-invalid={Boolean(errorMessage)}
                              className={cn(errorMessage && "border-destructive focus:ring-destructive/30")}
                            >
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {q.options?.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Single Choice Radio */}
                        {q.type === "radio" && (
                          <RadioGroup
                            value={(answers[q.id] as string) || ""}
                            onValueChange={(val) => {
                              handleTextChange(q.id, val);
                              handleBlur(q.id);
                            }}
                            className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2"
                          >
                            {q.options?.map((opt) => (
                              <label
                                key={opt}
                                htmlFor={`${fieldId}-${opt}`}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-md border bg-card p-2.5 text-xs hover:bg-muted/40",
                                  errorMessage && "border-destructive/60",
                                )}
                              >
                                <RadioGroupItem value={opt} id={`${fieldId}-${opt}`} />
                                <span className="text-foreground">{opt}</span>
                              </label>
                            ))}
                          </RadioGroup>
                        )}

                        {/* Multi-Select Checkboxes */}
                        {(q.type === "checkbox" || q.type === "multiselect") && (
                          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                            {q.options?.map((opt) => {
                              const selectedList = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                              const isChecked = selectedList.includes(opt);

                              return (
                                <label
                                  key={opt}
                                  htmlFor={`${fieldId}-${opt}`}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-xs transition-colors",
                                    isChecked ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/30",
                                    errorMessage && !isChecked && "border-destructive/60",
                                  )}
                                >
                                  <Checkbox
                                    id={`${fieldId}-${opt}`}
                                    checked={isChecked}
                                    onCheckedChange={() => handleMultiSelectToggle(q.id, opt)}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <span className="text-foreground leading-snug">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Error message for select, radio, checkbox, multiselect */}
                        {errorMessage &&
                          (q.type === "select" ||
                            q.type === "radio" ||
                            q.type === "checkbox" ||
                            q.type === "multiselect") && (
                            <p className="pt-1 font-medium text-[11px] text-destructive leading-tight">
                              {errorMessage}
                            </p>
                          )}
                      </Field>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting Registration...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Submit Registration
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
