"use client";

import React, { useEffect, useId, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CheckCircle2, Clock, ExternalLink, FileEdit, Layers, Loader2, MapPin, Sparkles } from "lucide-react";
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
import {
  formatOtherAnswer,
  isOtherOption,
  parseOtherAnswer,
  validateQuestionAnswer,
} from "@/lib/events/question-validator";
import {
  DEFAULT_COMBINED_QUESTIONS,
  getRegistrationWindowStatus,
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
  className?: string;
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

export function EventRegistrationModal({
  event,
  existingRegistration,
  children,
  className,
}: EventRegistrationModalProps) {
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
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  // Pre-fill answers and "Other" custom texts if existing registration is found
  useEffect(() => {
    if (activeRegistration?.answers) {
      const initialOther: Record<string, string> = {};
      for (const [key, val] of Object.entries(activeRegistration.answers)) {
        if (typeof val === "string") {
          const parsed = parseOtherAnswer(val);
          if (parsed.isOther && parsed.customText) {
            initialOther[key] = parsed.customText;
          }
        }
      }
      setOtherInputs((prev) => ({ ...initialOther, ...prev }));
      setAnswers((prev) => ({
        ...activeRegistration.answers,
        ...prev,
      }));
    }
  }, [activeRegistration]);
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

  const handleSelectRadioRegular = (question: CustomQuestion, opt: string) => {
    handleTextChange(question.id, opt);
    handleBlur(question.id);
  };

  const handleSelectRadioOther = (question: CustomQuestion) => {
    const currentText = otherInputs[question.id] || "";
    const formatted = formatOtherAnswer(currentText);
    handleTextChange(question.id, formatted);
    setTimeout(() => {
      otherInputRefs.current[question.id]?.focus();
    }, 50);
  };

  const handleRadioOtherTextChange = (question: CustomQuestion, text: string) => {
    setOtherInputs((prev) => ({ ...prev, [question.id]: text }));
    const formatted = formatOtherAnswer(text);
    handleTextChange(question.id, formatted);
  };

  const handleSelectDropdownChange = (question: CustomQuestion, val: string) => {
    if (val === "__other__") {
      const currentText = otherInputs[question.id] || "";
      const formatted = formatOtherAnswer(currentText);
      handleTextChange(question.id, formatted);
      setTimeout(() => {
        otherInputRefs.current[question.id]?.focus();
      }, 50);
    } else {
      handleTextChange(question.id, val);
      handleBlur(question.id);
    }
  };

  const handleSelectOtherTextChange = (question: CustomQuestion, text: string) => {
    setOtherInputs((prev) => ({ ...prev, [question.id]: text }));
    const formatted = formatOtherAnswer(text);
    handleTextChange(question.id, formatted);
  };

  const handleMultiSelectOtherTextChange = (question: CustomQuestion, text: string) => {
    setOtherInputs((prev) => ({ ...prev, [question.id]: text }));
    const formatted = formatOtherAnswer(text);
    setAnswers((prev) => {
      const current = Array.isArray(prev[question.id]) ? (prev[question.id] as string[]) : [];
      const filtered = current.filter(
        (it) => typeof it === "string" && !isOtherOption(it) && !it.toLowerCase().startsWith("other:"),
      );
      const updated = [...filtered, formatted];
      const result = validateQuestionAnswer(question, updated);
      setFieldErrors((errs) => {
        if (result.isValid) {
          const next = { ...errs };
          delete next[question.id];
          return next;
        }
        return { ...errs, [question.id]: result.error ?? "Invalid input" };
      });
      return { ...prev, [question.id]: updated };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to register for GDG Jakarta events.");
      router.push("/auth/login");
      return;
    }

    const windowStatus = getRegistrationWindowStatus(eventConfig);
    if ((isPast || !windowStatus.isOpen) && !activeRegistration) {
      toast.error(windowStatus.message || "Registration is currently closed.");
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
        const otherEl = document.getElementById(`${firstErrorId}-other-text`);
        const el = otherEl || document.getElementById(firstErrorId);
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
            webhook_url: eventConfig.webhook_url ?? undefined,
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

        setLocalReg({
          id: result.registrationId || `${event.id}_${user?.id || Date.now()}`,
          event_id: String(event.id),
          event_title: event.title,
          member_id: user?.id || "",
          member_name: user?.name || "Attendee",
          member_email: ((combinedAnswers as Record<string, unknown>).work_email as string) || user?.email || "",
          status: eventConfig.requires_approval ? "pending" : "approved",
          registered_at: new Date().toISOString(),
          answers: combinedAnswers,
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
    let isFullWidth = Boolean(className?.includes("w-full"));
    let buttonSize: "default" | "sm" | "lg" | "icon" = "sm";

    if (React.isValidElement(children)) {
      const childProps = children.props as { className?: string; size?: "default" | "sm" | "lg" | "icon" };
      if (childProps.className?.includes("w-full")) {
        isFullWidth = true;
      }
      if (childProps.size) {
        buttonSize = childProps.size;
      }
    }

    const statusLower = activeRegistration.status.toLowerCase();
    const isApproved = statusLower === "approved" || statusLower === "attended";
    const isPendingReview = statusLower === "pending";
    let statusLabel = "Registered";
    if (isApproved) {
      statusLabel = eventConfig.requires_approval ? "Registered (Approved)" : "Registered";
    } else if (isPendingReview) {
      statusLabel = "Pending Approval";
    }

    return (
      <Button
        type="button"
        variant={isApproved ? "outline" : "secondary"}
        size={buttonSize}
        aria-disabled="true"
        className={cn(
          "relative cursor-default gap-2 overflow-hidden font-medium transition-colors",
          isApproved
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300",
          isFullWidth && "w-full",
          className,
        )}
      >
        <CheckCircle2
          className={cn(
            "relative z-10 shrink-0",
            buttonSize === "lg" ? "size-4" : "size-3.5",
            isApproved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          )}
        />
        <span className="relative z-10">{statusLabel}</span>
        <div className="shimmer-wave" aria-hidden="true" />
      </Button>
    );
  }

  const windowStatus = getRegistrationWindowStatus(eventConfig);

  if (isPast || !windowStatus.isOpen) {
    let buttonSize: "default" | "sm" | "lg" | "icon" = "sm";
    if (React.isValidElement(children)) {
      const childProps = children.props as { size?: "default" | "sm" | "lg" | "icon" };
      if (childProps?.size) buttonSize = childProps.size;
    }

    return (
      <Button
        variant="secondary"
        size={buttonSize}
        disabled
        className={cn(
          "cursor-not-allowed opacity-80 font-medium",
          className,
          windowStatus.status === "draft" &&
            "border border-dashed border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
          windowStatus.status === "upcoming" &&
            "border border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300",
        )}
      >
        {windowStatus.status === "draft" && <FileEdit className="size-3.5 mr-1.5" />}
        {windowStatus.status === "upcoming" && <Clock className="size-3.5 mr-1.5" />}
        {windowStatus.message}
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
                        {q.type === "select" &&
                          (() => {
                            const hasOther = Boolean(q.allow_other || q.options?.some(isOtherOption));
                            const regularOptions = (q.options ?? []).filter((opt) => !isOtherOption(opt));
                            const rawVal = typeof answers[q.id] === "string" ? (answers[q.id] as string) : "";
                            const parsed = parseOtherAnswer(rawVal);
                            const isOtherSelected =
                              hasOther && (parsed.isOther || (rawVal !== "" && !regularOptions.includes(rawVal)));
                            const currentOtherText = otherInputs[q.id] ?? parsed.customText;

                            return (
                              <div className="space-y-2">
                                <Select
                                  value={isOtherSelected ? "__other__" : rawVal}
                                  onValueChange={(val) => handleSelectDropdownChange(q, val)}
                                >
                                  <SelectTrigger
                                    id={fieldId}
                                    aria-invalid={Boolean(errorMessage)}
                                    className={cn(errorMessage && "border-destructive focus:ring-destructive/30")}
                                  >
                                    <SelectValue placeholder="Select an option" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {regularOptions.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                    {hasOther && <SelectItem value="__other__">Other (specify below)</SelectItem>}
                                  </SelectContent>
                                </Select>

                                {isOtherSelected && (
                                  <div className="space-y-1 pt-1 animate-in fade-in-50 duration-200">
                                    <label
                                      htmlFor={`${fieldId}-other-text`}
                                      className="block text-[11px] font-medium text-muted-foreground"
                                    >
                                      Please specify your response:
                                    </label>
                                    <Input
                                      ref={(el) => {
                                        otherInputRefs.current[q.id] = el;
                                      }}
                                      id={`${fieldId}-other-text`}
                                      type="text"
                                      placeholder={q.other_placeholder || "Type your custom response..."}
                                      value={currentOtherText}
                                      onChange={(e) => handleSelectOtherTextChange(q, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") e.preventDefault();
                                      }}
                                      onBlur={() => handleBlur(q.id)}
                                      className={cn(
                                        "h-8 text-xs bg-background/80",
                                        errorMessage &&
                                          !currentOtherText.trim() &&
                                          "border-destructive focus-visible:ring-destructive/30",
                                      )}
                                      autoFocus
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                        {/* Single Choice Radio */}
                        {q.type === "radio" &&
                          (() => {
                            const hasOther = Boolean(q.allow_other || q.options?.some(isOtherOption));
                            const regularOptions = (q.options ?? []).filter((opt) => !isOtherOption(opt));
                            const rawVal = typeof answers[q.id] === "string" ? (answers[q.id] as string) : "";
                            const parsed = parseOtherAnswer(rawVal);
                            const isOtherSelected =
                              hasOther && (parsed.isOther || (rawVal !== "" && !regularOptions.includes(rawVal)));
                            const currentOtherText = otherInputs[q.id] ?? parsed.customText;

                            return (
                              <RadioGroup
                                value={isOtherSelected ? "__other__" : rawVal}
                                onValueChange={(val) => {
                                  if (val === "__other__") {
                                    handleSelectRadioOther(q);
                                  } else {
                                    handleSelectRadioRegular(q, val);
                                  }
                                }}
                                className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2"
                              >
                                {regularOptions.map((opt) => {
                                  const isSelected = !isOtherSelected && rawVal === opt;
                                  return (
                                    <label
                                      key={opt}
                                      htmlFor={`${fieldId}-${opt}`}
                                      className={cn(
                                        "flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                        isSelected
                                          ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                                          : "border-border bg-card text-foreground hover:bg-muted/40",
                                        errorMessage && !isSelected && "border-destructive/40",
                                        errorMessage && isSelected && "border-destructive",
                                      )}
                                    >
                                      <RadioGroupItem value={opt} id={`${fieldId}-${opt}`} />
                                      <span className="leading-snug">{opt}</span>
                                    </label>
                                  );
                                })}

                                {hasOther && (
                                  <div
                                    className={cn(
                                      "flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-2.5 text-xs transition-colors sm:col-span-2",
                                      isOtherSelected
                                        ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                        : "border-border bg-card hover:bg-muted/40",
                                      errorMessage && !isOtherSelected && "border-destructive/40",
                                      errorMessage &&
                                        isOtherSelected &&
                                        !currentOtherText.trim() &&
                                        "border-destructive ring-destructive/30",
                                    )}
                                  >
                                    <div className="flex items-center gap-2 shrink-0">
                                      <RadioGroupItem
                                        value="__other__"
                                        id={`${fieldId}-__other__`}
                                        checked={isOtherSelected}
                                      />
                                      <label
                                        htmlFor={`${fieldId}-__other__`}
                                        className="cursor-pointer font-medium text-foreground select-none"
                                      >
                                        Other:
                                      </label>
                                    </div>
                                    <div className="flex-1 min-w-0 w-full">
                                      <Input
                                        ref={(el) => {
                                          otherInputRefs.current[q.id] = el;
                                        }}
                                        id={`${fieldId}-other-text`}
                                        type="text"
                                        placeholder={q.other_placeholder || "Type your custom response..."}
                                        value={currentOtherText}
                                        onFocus={() => {
                                          if (!isOtherSelected) {
                                            handleSelectRadioOther(q);
                                          }
                                        }}
                                        onChange={(e) => handleRadioOtherTextChange(q, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") e.preventDefault();
                                        }}
                                        onBlur={() => handleBlur(q.id)}
                                        className={cn(
                                          "h-8 text-xs bg-background/80 transition-colors",
                                          isOtherSelected && "border-primary/50 focus-visible:ring-primary/30",
                                          errorMessage &&
                                            isOtherSelected &&
                                            !currentOtherText.trim() &&
                                            "border-destructive focus-visible:ring-destructive/30",
                                        )}
                                      />
                                    </div>
                                  </div>
                                )}
                              </RadioGroup>
                            );
                          })()}

                        {/* Multi-Select Checkboxes */}
                        {(q.type === "checkbox" || q.type === "multiselect") &&
                          (() => {
                            const hasOther = Boolean(q.allow_other || q.options?.some(isOtherOption));
                            const regularOptions = (q.options ?? []).filter((opt) => !isOtherOption(opt));
                            const selectedList = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                            const otherItem = selectedList.find(
                              (item) =>
                                typeof item === "string" &&
                                (isOtherOption(item) || item.toLowerCase().startsWith("other:")),
                            );
                            const isOtherChecked = Boolean(otherItem);
                            const parsedOther = parseOtherAnswer(otherItem ?? "");
                            const currentOtherText = otherInputs[q.id] ?? parsedOther.customText;

                            return (
                              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                                {regularOptions.map((opt) => {
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

                                {hasOther && (
                                  <div
                                    className={cn(
                                      "flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-2.5 text-xs transition-colors sm:col-span-2",
                                      isOtherChecked
                                        ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                        : "border-border bg-card hover:bg-muted/40",
                                      errorMessage && "border-destructive/60",
                                    )}
                                  >
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Checkbox
                                        id={`${fieldId}-__other__`}
                                        checked={isOtherChecked}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            const formatted = formatOtherAnswer(currentOtherText);
                                            setAnswers((prev) => {
                                              const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
                                              const filtered = cur.filter(
                                                (it) =>
                                                  typeof it === "string" &&
                                                  !isOtherOption(it) &&
                                                  !it.toLowerCase().startsWith("other:"),
                                              );
                                              return { ...prev, [q.id]: [...filtered, formatted] };
                                            });
                                            setTimeout(() => otherInputRefs.current[q.id]?.focus(), 50);
                                          } else {
                                            setAnswers((prev) => {
                                              const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
                                              return {
                                                ...prev,
                                                [q.id]: cur.filter(
                                                  (it) =>
                                                    typeof it === "string" &&
                                                    !isOtherOption(it) &&
                                                    !it.toLowerCase().startsWith("other:"),
                                                ),
                                              };
                                            });
                                          }
                                        }}
                                        className="shrink-0"
                                      />
                                      <label
                                        htmlFor={`${fieldId}-__other__`}
                                        className="cursor-pointer font-medium text-foreground select-none"
                                      >
                                        Other:
                                      </label>
                                    </div>
                                    <div className="flex-1 min-w-0 w-full">
                                      <Input
                                        ref={(el) => {
                                          otherInputRefs.current[q.id] = el;
                                        }}
                                        id={`${fieldId}-other-text`}
                                        type="text"
                                        placeholder={q.other_placeholder || "Type your custom response..."}
                                        value={currentOtherText}
                                        onFocus={() => {
                                          if (!isOtherChecked) {
                                            const formatted = formatOtherAnswer(currentOtherText);
                                            setAnswers((prev) => {
                                              const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
                                              const filtered = cur.filter(
                                                (it) =>
                                                  typeof it === "string" &&
                                                  !isOtherOption(it) &&
                                                  !it.toLowerCase().startsWith("other:"),
                                              );
                                              return { ...prev, [q.id]: [...filtered, formatted] };
                                            });
                                          }
                                        }}
                                        onChange={(e) => handleMultiSelectOtherTextChange(q, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") e.preventDefault();
                                        }}
                                        onBlur={() => handleBlur(q.id)}
                                        className={cn(
                                          "h-8 text-xs bg-background/80",
                                          isOtherChecked && "border-primary/50 focus-visible:ring-primary/30",
                                          errorMessage &&
                                            isOtherChecked &&
                                            !currentOtherText.trim() &&
                                            "border-destructive focus-visible:ring-destructive/30",
                                        )}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

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
