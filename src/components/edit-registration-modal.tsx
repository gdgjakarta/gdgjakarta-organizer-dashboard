"use client";

import type React from "react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Check, CheckCircle2, Clock, Edit3, FileText, Layers, Loader2, Lock, MapPin } from "lucide-react";
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
import {
  formatOtherAnswer,
  isOtherOption,
  parseOtherAnswer,
  validateQuestionAnswer,
} from "@/lib/events/question-validator";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import { updateRegistrationAnswersAction } from "@/lib/firestore/actions";
import type { CustomQuestion, EventSession, FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface EditRegistrationModalProps {
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
  children?: React.ReactNode;
  triggerButton?: React.ReactNode;
  onSuccess?: (updatedRegistration: FirestoreRegistration) => void;
}

export function EditRegistrationModal({
  registration,
  event: initialEvent,
  children,
  triggerButton,
  onSuccess,
}: EditRegistrationModalProps) {
  const formUid = useId();
  const [open, setOpen] = useState(false);
  const [eventData, setEventData] = useState<FirestoreEvent | null>(initialEvent ?? null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const status = registration.status;
  const isPendingReview = status === "pending" || status === "waitlisted";
  const isApproved = status === "approved" || status === "attended";
  const isRejected = status === "rejected";
  const canEdit = isPendingReview;

  // Initialize/sync answers from registration when dialog opens
  useEffect(() => {
    if (!open) return;

    // Pre-populate answers from registration record
    const regAnswers = registration.answers ?? {};
    setAnswers({ ...regAnswers });

    const initialSession =
      registration.session_id ?? (typeof regAnswers.session_id === "string" ? regAnswers.session_id : "");
    setSelectedSessionId(initialSession);

    // Parse existing "Other: xxx" values into separate otherInputs state
    const parsedOthers: Record<string, string> = {};
    for (const [key, val] of Object.entries(regAnswers)) {
      if (typeof val === "string") {
        const parsed = parseOtherAnswer(val);
        if (parsed.isOther) {
          parsedOthers[key] = parsed.customText;
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string") {
            const parsed = parseOtherAnswer(item);
            if (parsed.isOther) {
              parsedOthers[key] = parsed.customText;
            }
          }
        }
      }
    }
    setOtherInputs(parsedOthers);
    setFieldErrors({});
    setTouchedFields(new Set());

    // Load full event data if not already passed or missing questions/sessions
    async function fetchFullEvent() {
      try {
        setIsLoadingEvent(true);
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docSnap = await getFirestoreEventById(String(registration.event_id));
        if (docSnap) {
          setEventData((prev) => ({
            ...(prev ?? ({} as FirestoreEvent)),
            ...docSnap,
          }));
        }
      } catch (err) {
        console.warn("[EditRegistrationModal] Failed to load full event doc:", err);
      } finally {
        setIsLoadingEvent(false);
      }
    }

    void fetchFullEvent();
  }, [open, registration]);

  const activeQuestions: CustomQuestion[] =
    eventData?.custom_questions && eventData.custom_questions.length > 0
      ? eventData.custom_questions
      : DEFAULT_COMBINED_QUESTIONS;

  const sessions: EventSession[] = eventData?.sessions ?? [];
  const hasSessions = sessions.length > 0;

  // Group questions by section
  const sectionsMap = new Map<string, CustomQuestion[]>();
  for (const q of activeQuestions) {
    const sec = q.section ?? "Additional Information";
    if (!sectionsMap.has(sec)) {
      sectionsMap.set(sec, []);
    }
    sectionsMap.get(sec)?.push(q);
  }

  const handleTextChange = (questionId: string, val: string) => {
    if (!canEdit) return;
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    const question = activeQuestions.find((q) => q.id === questionId);
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

  const handleBlur = (questionId: string, explicitVal?: unknown) => {
    if (!canEdit) return;
    setTouchedFields((prev) => new Set(prev).add(questionId));
    const question = activeQuestions.find((q) => q.id === questionId);
    if (question) {
      const val = explicitVal !== undefined ? explicitVal : answers[questionId];
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
    if (!canEdit) return;
    setTouchedFields((prev) => new Set(prev).add(questionId));
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const updated = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      const question = activeQuestions.find((q) => q.id === questionId);
      if (question) {
        if (updated.length > 0) {
          const result = validateQuestionAnswer(question, updated);
          setFieldErrors((errs) => {
            if (result.isValid) {
              const next = { ...errs };
              delete next[questionId];
              return next;
            }
            return { ...errs, [questionId]: result.error ?? "Invalid input" };
          });
        } else {
          setFieldErrors((errs) => {
            const next = { ...errs };
            delete next[questionId];
            return next;
          });
        }
      }
      return { ...prev, [questionId]: updated };
    });
  };

  const handleUnselectRadioOther = (questionId: string) => {
    if (!canEdit) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setOtherInputs((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const handleSelectDropdownChange = (question: CustomQuestion, val: string) => {
    if (!canEdit) return;
    setTouchedFields((prev) => new Set(prev).add(question.id));
    if (val === "__other__") {
      const customVal = otherInputs[question.id] || "";
      const formatted = formatOtherAnswer(customVal);
      setAnswers((prev) => ({ ...prev, [question.id]: formatted }));
      setFieldErrors((errs) => {
        const next = { ...errs };
        delete next[question.id];
        return next;
      });
      setTimeout(() => {
        otherInputRefs.current[question.id]?.focus();
      }, 50);
    } else {
      setAnswers((prev) => ({ ...prev, [question.id]: val }));
      setOtherInputs((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
      const result = validateQuestionAnswer(question, val);
      setFieldErrors((errs) => {
        if (result.isValid) {
          const next = { ...errs };
          delete next[question.id];
          return next;
        }
        return { ...errs, [question.id]: result.error ?? "Invalid input" };
      });
    }
  };

  const handleOtherInputChange = (question: CustomQuestion, text: string, isMultiSelect = false) => {
    if (!canEdit) return;
    setOtherInputs((prev) => ({ ...prev, [question.id]: text }));
    const formatted = formatOtherAnswer(text);

    if (isMultiSelect) {
      setAnswers((prev) => {
        const current = Array.isArray(prev[question.id]) ? (prev[question.id] as string[]) : [];
        const filtered = current.filter((item) => !isOtherOption(item));
        const updated = text.trim() ? [...filtered, formatted] : filtered;
        return { ...prev, [question.id]: updated };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [question.id]: formatted }));
    }
  };

  const handleSave = () => {
    if (!canEdit) {
      setOpen(false);
      return;
    }

    // Validate all questions
    const nextErrors: Record<string, string> = {};
    for (const q of activeQuestions) {
      const val = answers[q.id];
      const result = validateQuestionAnswer(q, val);
      if (!result.isValid) {
        nextErrors[q.id] = result.error ?? "This field is required";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setTouchedFields(new Set(activeQuestions.map((q) => q.id)));
      toast.error("Please resolve the highlighted fields before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const selectedSessionObj = sessions.find((s) => s.id === selectedSessionId);
        const combinedAnswers = {
          ...answers,
          ...(selectedSessionId ? { session_id: selectedSessionId } : {}),
          ...(selectedSessionObj?.title ? { session_title: selectedSessionObj.title } : {}),
        };

        const result = await updateRegistrationAnswersAction(registration.id, registration.event_id, {
          answers: combinedAnswers,
          session_id: selectedSessionId || undefined,
          session_title: selectedSessionObj?.title || undefined,
        });

        if (!result.success) {
          toast.error(result.error || "Failed to update registration answers.");
          return;
        }

        const updatedRegistration: FirestoreRegistration = {
          ...registration,
          answers: combinedAnswers,
          session_id: selectedSessionId || undefined,
          session_title: selectedSessionObj?.title || undefined,
          updated_at: new Date().toISOString(),
        };

        toast.success("Registration responses updated successfully!");
        onSuccess?.(updatedRegistration);
        setOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update registration.";
        toast.error(msg);
      }
    });
  };

  const defaultTrigger = canEdit ? (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
      <Edit3 className="size-3.5 text-amber-500" />
      Edit Responses
    </Button>
  ) : (
    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs hover:text-foreground">
      <FileText className="size-3.5" />
      View Responses
    </Button>
  );

  let statusBanner = (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-xs">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">Application Not Selected</p>
        <p className="text-[11px] leading-relaxed opacity-90">
          This registration decision has been finalized. Responses cannot be modified.
        </p>
      </div>
    </div>
  );

  if (canEdit) {
    statusBanner = (
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 text-xs dark:text-amber-200">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-semibold">Application Pending Organizer Review</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            You can freely update your selected track and form answers below before the organizing committee finalizes
            attendee approvals.
          </p>
        </div>
      </div>
    );
  } else if (isApproved) {
    statusBanner = (
      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-900 text-xs dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-semibold">Application Confirmed & Approved</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            Your spot has been confirmed. Submitted registration details are locked for ticketing and access purposes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton || children || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <DialogTitle className="font-bold text-lg leading-tight sm:text-xl">
              {canEdit ? "Edit Registration Responses" : "Registration Application Details"}
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0.5 font-medium text-xs",
                isPendingReview && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                isApproved && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                isRejected && "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {isPendingReview && "Pending Review"}
              {isApproved && "Approved / Confirmed"}
              {isRejected && "Not Selected"}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            {registration.event_title} • Submitted by {registration.member_name} ({registration.member_email})
          </DialogDescription>
        </DialogHeader>

        {/* ── Status Explanation Banner ─────────────────────────────────── */}
        {statusBanner}

        {isLoadingEvent && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-xs">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading latest event questions...</span>
          </div>
        )}

        {/* ── Sessions / Tracks Selection ──────────────────────────────── */}
        {hasSessions && (
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Select Session / Track</h4>
                <p className="text-[11px] text-muted-foreground">
                  Choose your preferred participation track for this event.
                </p>
              </div>
            </div>

            <RadioGroup
              value={selectedSessionId}
              onValueChange={canEdit ? setSelectedSessionId : undefined}
              className="space-y-2.5"
            >
              {sessions.map((sess) => {
                const isSelected = selectedSessionId === sess.id;
                const isFull = sess.capacity > 0 && (sess.total_registered ?? 0) >= sess.capacity;
                const isDisabled = !canEdit || (isFull && !isSelected);

                return (
                  <label
                    key={sess.id}
                    htmlFor={`session-opt-${sess.id}`}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/30"
                        : "border-border/60 hover:bg-muted/30",
                      isDisabled ? "cursor-default opacity-70" : "cursor-pointer",
                    )}
                  >
                    <RadioGroupItem
                      value={sess.id}
                      id={`session-opt-${sess.id}`}
                      disabled={isDisabled}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-medium text-foreground text-xs">{sess.title}</span>
                        {sess.capacity > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {sess.total_registered ?? 0}/{sess.capacity} seats booked
                          </Badge>
                        )}
                      </div>
                      {sess.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{sess.description}</p>
                      )}
                      {sess.location && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3 text-emerald-500" />
                          <span>{sess.location}</span>
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>
        )}

        {/* ── Questionnaire Sections ────────────────────────────────────── */}
        <div className="space-y-6 pt-2">
          {Array.from(sectionsMap.entries()).map(([sectionName, sectionQuestions], secIdx) => (
            <div key={sectionName} className="space-y-3.5">
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
                          disabled={!canEdit}
                          placeholder={q.placeholder || "Your answer"}
                          value={strVal}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          onBlur={(e) => handleBlur(q.id, e.target.value)}
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
                          disabled={!canEdit}
                          placeholder={q.placeholder || "Type your response here..."}
                          value={strVal}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          onBlur={(e) => handleBlur(q.id, e.target.value)}
                          rows={3}
                          maxLength={q.max_length}
                          aria-invalid={Boolean(errorMessage)}
                          className={cn(errorMessage && "border-destructive focus-visible:ring-destructive/30")}
                          required={q.required}
                        />
                      )}

                      {/* Helper row with error message and live character counter */}
                      {(q.type === "text" || q.type === "textarea") && (errorMessage || hasLengthLimits) && (
                        <div className="flex items-start justify-between gap-2 pt-1 text-[11px]">
                          {errorMessage ? (
                            <p className="font-medium text-destructive leading-tight">{errorMessage}</p>
                          ) : (
                            <span />
                          )}
                          {hasLengthLimits && (
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
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
                                disabled={!canEdit}
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
                                <div className="fade-in-50 animate-in space-y-1 pt-1 duration-200">
                                  <label
                                    htmlFor={`${fieldId}-other-text`}
                                    className="block font-medium text-[11px] text-muted-foreground"
                                  >
                                    Please specify your response:
                                  </label>
                                  <Input
                                    id={`${fieldId}-other-text`}
                                    disabled={!canEdit}
                                    ref={(el) => {
                                      otherInputRefs.current[q.id] = el;
                                    }}
                                    placeholder="Enter your specific details..."
                                    value={currentOtherText}
                                    onChange={(e) => handleOtherInputChange(q, e.target.value)}
                                    onBlur={(e) => {
                                      const trimmed = e.target.value.trim();
                                      if (trimmed.length > 0) {
                                        handleBlur(q.id, formatOtherAnswer(trimmed));
                                      } else {
                                        setFieldErrors((prev) => {
                                          const next = { ...prev };
                                          delete next[q.id];
                                          return next;
                                        });
                                      }
                                    }}
                                    className={cn(
                                      "h-8 bg-background/80 text-xs",
                                      errorMessage &&
                                        !currentOtherText.trim() &&
                                        "border-destructive focus-visible:ring-destructive/30",
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      {/* Radio Group */}
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
                            <div className="space-y-2">
                              <RadioGroup
                                disabled={!canEdit}
                                value={isOtherSelected ? "__other__" : rawVal}
                                onValueChange={(val) => {
                                  if (!canEdit) return;
                                  setTouchedFields((prev) => new Set(prev).add(q.id));
                                  if (val === "__other__") {
                                    const customVal = otherInputs[q.id] || "";
                                    const formatted = formatOtherAnswer(customVal);
                                    setAnswers((prev) => ({ ...prev, [q.id]: formatted }));
                                    setFieldErrors((errs) => {
                                      const next = { ...errs };
                                      delete next[q.id];
                                      return next;
                                    });
                                    setTimeout(() => {
                                      otherInputRefs.current[q.id]?.focus();
                                    }, 50);
                                  } else {
                                    setAnswers((prev) => ({ ...prev, [q.id]: val }));
                                    setOtherInputs((prev) => {
                                      const next = { ...prev };
                                      delete next[q.id];
                                      return next;
                                    });
                                    const result = validateQuestionAnswer(q, val);
                                    setFieldErrors((errs) => {
                                      if (result.isValid) {
                                        const next = { ...errs };
                                        delete next[q.id];
                                        return next;
                                      }
                                      return { ...errs, [q.id]: result.error ?? "Invalid input" };
                                    });
                                  }
                                }}
                                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                              >
                                {regularOptions.map((opt) => {
                                  const optId = `${fieldId}-${opt}`;
                                  const isSelected = !isOtherSelected && rawVal === opt;
                                  return (
                                    <label
                                      key={opt}
                                      htmlFor={optId}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                        isSelected
                                          ? "border-primary bg-primary/10 font-medium text-foreground shadow-xs"
                                          : "border-border bg-card text-foreground hover:bg-muted/40",
                                        canEdit ? "cursor-pointer" : "cursor-default opacity-80",
                                      )}
                                    >
                                      <RadioGroupItem value={opt} id={optId} disabled={!canEdit} />
                                      <span className="select-none">{opt}</span>
                                    </label>
                                  );
                                })}

                                {hasOther && (
                                  <div
                                    className={cn(
                                      "flex flex-col gap-2 rounded-md border p-2.5 text-xs transition-colors sm:col-span-2 sm:flex-row sm:items-center",
                                      isOtherSelected
                                        ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                        : "border-border bg-card hover:bg-muted/40",
                                      !canEdit && "opacity-80",
                                    )}
                                  >
                                    <div className="flex shrink-0 items-center gap-2">
                                      <RadioGroupItem
                                        value="__other__"
                                        id={`${fieldId}-__other__`}
                                        disabled={!canEdit}
                                        onClick={() => {
                                          if (isOtherSelected) {
                                            handleUnselectRadioOther(q.id);
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`${fieldId}-__other__`}
                                        className="cursor-pointer select-none font-medium text-foreground"
                                      >
                                        Other:
                                      </label>
                                    </div>
                                    <div className="w-full min-w-0 flex-1">
                                      <Input
                                        disabled={!canEdit}
                                        ref={(el) => {
                                          otherInputRefs.current[q.id] = el;
                                        }}
                                        id={`${fieldId}-__other_input__`}
                                        placeholder="Please specify..."
                                        value={currentOtherText}
                                        onFocus={() => {
                                          if (!canEdit) return;
                                          if (!isOtherSelected) {
                                            const formatted = formatOtherAnswer(currentOtherText);
                                            setAnswers((prev) => ({ ...prev, [q.id]: formatted }));
                                          }
                                        }}
                                        onChange={(e) => handleOtherInputChange(q, e.target.value)}
                                        onBlur={(e) => {
                                          const trimmed = e.target.value.trim();
                                          if (trimmed.length > 0) {
                                            handleBlur(q.id, formatOtherAnswer(trimmed));
                                          } else {
                                            setFieldErrors((prev) => {
                                              const next = { ...prev };
                                              delete next[q.id];
                                              return next;
                                            });
                                          }
                                        }}
                                        className={cn("h-8 bg-background/80 text-xs transition-colors")}
                                      />
                                    </div>
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          );
                        })()}

                      {/* Checkbox Multi-select */}
                      {q.type === "checkbox" &&
                        (() => {
                          const hasOther = Boolean(q.allow_other || q.options?.some(isOtherOption));
                          const regularOptions = (q.options ?? []).filter((opt) => !isOtherOption(opt));
                          const rawList = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                          const otherEntry = rawList.find(isOtherOption);
                          const isOtherChecked = hasOther && Boolean(otherEntry);
                          const parsed = parseOtherAnswer(otherEntry ?? "");
                          const currentOtherText = otherInputs[q.id] ?? parsed.customText;

                          return (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {regularOptions.map((opt) => {
                                  const optId = `${fieldId}-${opt}`;
                                  const isChecked = rawList.includes(opt);
                                  return (
                                    <label
                                      key={opt}
                                      htmlFor={optId}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                        isChecked
                                          ? "border-primary bg-primary/10 font-medium text-foreground shadow-xs"
                                          : "border-border bg-card text-foreground hover:bg-muted/40",
                                        canEdit ? "cursor-pointer" : "cursor-default opacity-80",
                                      )}
                                    >
                                      <Checkbox
                                        id={optId}
                                        disabled={!canEdit}
                                        checked={isChecked}
                                        onCheckedChange={() => handleMultiSelectToggle(q.id, opt)}
                                      />
                                      <span className="select-none">{opt}</span>
                                    </label>
                                  );
                                })}

                                {hasOther && (
                                  <div
                                    className={cn(
                                      "flex flex-col gap-2 rounded-md border p-2.5 text-xs transition-colors sm:col-span-2 sm:flex-row sm:items-center",
                                      isOtherChecked
                                        ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                        : "border-border bg-card hover:bg-muted/40",
                                      !canEdit && "opacity-80",
                                    )}
                                  >
                                    <div className="flex shrink-0 items-center gap-2">
                                      <Checkbox
                                        id={`${fieldId}-__other__`}
                                        disabled={!canEdit}
                                        checked={isOtherChecked}
                                        onCheckedChange={(checked) => {
                                          if (!canEdit) return;
                                          if (checked) {
                                            const formatted = formatOtherAnswer(currentOtherText);
                                            handleMultiSelectToggle(q.id, formatted);
                                            setFieldErrors((prev) => {
                                              const next = { ...prev };
                                              delete next[q.id];
                                              return next;
                                            });
                                            setTimeout(() => {
                                              otherInputRefs.current[q.id]?.focus();
                                            }, 50);
                                          } else {
                                            setAnswers((prev) => {
                                              const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
                                              const filtered = cur.filter((item) => !isOtherOption(item));
                                              return { ...prev, [q.id]: filtered };
                                            });
                                            setOtherInputs((prev) => {
                                              const next = { ...prev };
                                              delete next[q.id];
                                              return next;
                                            });
                                            setFieldErrors((prev) => {
                                              const next = { ...prev };
                                              delete next[q.id];
                                              return next;
                                            });
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`${fieldId}-__other__`}
                                        className="cursor-pointer select-none font-medium text-foreground"
                                      >
                                        Other:
                                      </label>
                                    </div>
                                    <div className="w-full min-w-0 flex-1">
                                      <Input
                                        disabled={!canEdit}
                                        ref={(el) => {
                                          otherInputRefs.current[q.id] = el;
                                        }}
                                        id={`${fieldId}-__other_checkbox_input__`}
                                        placeholder="Please specify..."
                                        value={currentOtherText}
                                        onFocus={() => {
                                          if (!canEdit) return;
                                          if (!isOtherChecked) {
                                            const formatted = formatOtherAnswer(currentOtherText);
                                            handleMultiSelectToggle(q.id, formatted);
                                          }
                                        }}
                                        onChange={(e) => handleOtherInputChange(q, e.target.value, true)}
                                        onBlur={(e) => {
                                          const trimmed = e.target.value.trim();
                                          if (trimmed.length > 0) {
                                            const current = Array.isArray(answers[q.id])
                                              ? (answers[q.id] as string[])
                                              : [];
                                            const filtered = current.filter((item) => !isOtherOption(item));
                                            handleBlur(q.id, [...filtered, formatOtherAnswer(trimmed)]);
                                          } else {
                                            setFieldErrors((prev) => {
                                              const next = { ...prev };
                                              delete next[q.id];
                                              return next;
                                            });
                                          }
                                        }}
                                        className={cn("h-8 bg-background/80 text-xs")}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5 shadow-xs">
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
