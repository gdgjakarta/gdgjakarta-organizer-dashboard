"use client";

import type React from "react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import Image from "next/image";

import {
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  type LucideIcon,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { CancelRegistrationDialog } from "@/components/cancel-registration-dialog";
import { QuestionMediaUpload } from "@/components/events/question-media-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  "Personal & Contact Information": User,
  "Professional Background & Experience": Briefcase,
  "Technical Focus & Event Preferences": Sparkles,
  "Expectations & Community": Heart,
  "Payment & Ticket Details": FileText,
  "Commitment Fee & Attendance": CheckCircle2,
  "Consent & Code of Conduct": ShieldCheck,
  "Additional Questions": FileText,
};

export interface EditRegistrationModalProps {
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
  children?: React.ReactNode;
  triggerButton?: React.ReactNode;
  onSuccess?: (updatedRegistration: FirestoreRegistration) => void;
  onCancel?: () => void;
}

export function EditRegistrationModal({
  registration,
  event: initialEvent,
  children,
  triggerButton,
  onSuccess,
  onCancel,
}: EditRegistrationModalProps) {
  const formUid = useId();
  const [open, setOpen] = useState(false);
  const [eventData, setEventData] = useState<FirestoreEvent | null>(initialEvent ?? null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const status = registration.status;
  const paymentStatus = (registration.payment_status ?? "").toLowerCase().trim();
  const isPaid = status === "paid_and_registered" || paymentStatus === "paid";
  const isWaitingPayment =
    !isPaid &&
    (status === "waiting_for_payment" ||
      (paymentStatus === "unpaid" && status !== "approved" && status !== "attended"));
  const isPendingReview = status === "pending" || status === "waitlisted";
  const isApproved = !isPaid && (status === "approved" || status === "attended" || status === "registered");
  const isRejected = status === "rejected";
  const isExpiredOrFailed =
    status === "expired" || status === "failed" || paymentStatus === "expired" || paymentStatus === "failed";
  const isCancelled = status === "canceled" || status === "cancelled";

  // Registration form is editable while waiting for payment or pending review. Locked once payment is made or finalized.
  const canEdit =
    !isPaid &&
    !isApproved &&
    !isRejected &&
    !isExpiredOrFailed &&
    !isCancelled &&
    (isPendingReview || isWaitingPayment);

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
        const { getFirestoreEventById, getEventSessionRegistrationCounts } = await import("@/lib/firestore/client");
        const [docSnap, liveSessionCounts] = await Promise.all([
          getFirestoreEventById(String(registration.event_id)),
          getEventSessionRegistrationCounts(String(registration.event_id)),
        ]);
        if (docSnap) {
          let mergedSessions = docSnap.sessions;
          if (Array.isArray(docSnap.sessions) && Object.keys(liveSessionCounts).length > 0) {
            mergedSessions = docSnap.sessions.map((sess) => ({
              ...sess,
              total_registered: liveSessionCounts[sess.id] ?? sess.total_registered ?? 0,
            }));
          }
          setEventData((prev) => ({
            ...(prev ?? ({} as FirestoreEvent)),
            ...docSnap,
            ...(mergedSessions ? { sessions: mergedSessions } : {}),
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

  if (isWaitingPayment && canEdit) {
    statusBanner = (
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 text-xs dark:text-amber-200">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <p className="font-semibold">Awaiting Payment Confirmation</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            You can still update your application answers and session track below while waiting for payment. Ticket and
            merchandise selections are locked. If you wish to change your ticket or merchandise, please cancel your RSVP
            and re-register.
          </p>
        </div>
      </div>
    );
  } else if (isPendingReview && canEdit) {
    statusBanner = (
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 text-xs dark:text-amber-200">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <p className="font-semibold">Application Pending Organizer Review</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            You can freely update your selected track and form answers below before the organizing committee finalizes
            attendee approvals.
          </p>
        </div>
      </div>
    );
  } else if (isPaid) {
    statusBanner = (
      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-900 text-xs dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-0.5">
          <p className="font-semibold">Payment Completed & Registration Locked</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            Your payment has been successfully verified. Submitted registration details, ticket tier, and merchandise
            are permanently locked.
          </p>
        </div>
      </div>
    );
  } else if (isApproved) {
    statusBanner = (
      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-900 text-xs dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-0.5">
          <p className="font-semibold">Application Confirmed & Approved</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            Your spot has been confirmed. Submitted registration details are locked for ticketing and access purposes.
          </p>
        </div>
      </div>
    );
  }

  const renderReadOnlyValue = (q: CustomQuestion, value: unknown) => {
    const keyLower = q.id.toLowerCase();
    const strVal = String(value ?? "");

    // Boolean
    if (value === true || strVal.toLowerCase() === "true" || strVal.toLowerCase() === "yes") {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 text-xs dark:text-emerald-400"
        >
          <Check className="size-3" />
          Yes
        </Badge>
      );
    }
    if (value === false || strVal.toLowerCase() === "false" || strVal.toLowerCase() === "no") {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-border bg-muted/40 font-semibold text-muted-foreground text-xs"
        >
          No
        </Badge>
      );
    }

    // Media / Uploaded file
    if (q.type === "media" || strVal.includes("/api/media/") || strVal.includes("temp/")) {
      const isImg = Boolean(strVal.match(/\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i));
      const fileName = strVal.split("/").pop() || "Uploaded File";
      return (
        <a
          href={strVal}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 font-medium text-xs hover:border-primary/40 hover:bg-muted/50"
        >
          {isImg ? (
            <ImageIcon className="size-4 shrink-0 text-primary" />
          ) : (
            <FileText className="size-4 shrink-0 text-primary" />
          )}
          <span className="truncate text-foreground group-hover:text-primary">{fileName}</span>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-70 group-hover:text-primary" />
        </a>
      );
    }

    // URL / Links
    if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
      return (
        <a
          href={strVal}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex max-w-full items-center gap-1.5 break-all font-medium text-primary text-xs hover:underline"
        >
          <Globe className="size-3.5 shrink-0 opacity-80" />
          <span className="truncate">{strVal}</span>
          <ExternalLink className="size-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </a>
      );
    }

    // Multi-select or array
    if (Array.isArray(value)) {
      return (
        <div className="flex max-w-full flex-wrap gap-1.5 pt-0.5">
          {value.map((item) => {
            const itemKey = String(item);
            if (itemKey.toLowerCase().startsWith("other:")) {
              const customVal = itemKey.slice(itemKey.indexOf(":") + 1).trim();
              return (
                <div
                  key={itemKey}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs break-words"
                >
                  <span className="shrink-0 font-semibold text-primary">Other:</span>
                  <span className="text-foreground break-words">{customVal || "Custom"}</span>
                </div>
              );
            }
            return (
              <Badge
                key={itemKey}
                variant="secondary"
                className="h-auto max-w-full whitespace-normal break-words px-2.5 py-1 text-left font-medium text-xs leading-relaxed"
              >
                {itemKey}
              </Badge>
            );
          })}
        </div>
      );
    }

    // Other write-in response
    if (strVal.toLowerCase().startsWith("other:")) {
      const customVal = strVal.slice(strVal.indexOf(":") + 1).trim();
      return (
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="shrink-0 border-primary/40 bg-primary/10 font-medium text-primary text-xs"
          >
            Other
          </Badge>
          <span className="font-medium text-foreground text-xs break-words sm:text-sm">
            {customVal || "(None specified)"}
          </span>
        </div>
      );
    }

    // Single choice / short tag
    if (
      strVal.length <= 30 &&
      (keyLower.includes("background") ||
        keyLower.includes("experience") ||
        keyLower.includes("gender") ||
        keyLower.includes("level") ||
        strVal === "Tech" ||
        strVal === "Non-Tech")
    ) {
      return (
        <Badge
          variant="outline"
          className="h-auto max-w-full whitespace-normal break-words border-border/80 bg-muted/40 px-2.5 py-0.5 font-medium text-foreground text-xs leading-relaxed"
        >
          {strVal}
        </Badge>
      );
    }

    // Longer paragraphs / open text
    if (strVal.length > 60 || strVal.includes("\n")) {
      return (
        <div className="whitespace-pre-wrap break-words rounded-md border border-border/50 bg-muted/30 p-2.5 text-foreground text-xs leading-relaxed">
          {strVal}
        </div>
      );
    }

    // Standard string
    return <span className="font-medium text-foreground text-xs break-words sm:text-sm">{strVal}</span>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{triggerButton || children || defaultTrigger}</DialogTrigger>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          {/* Sticky Header */}
          <div className="shrink-0 border-b bg-muted/20 px-6 pt-6 pb-4">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <DialogTitle className="font-bold text-lg leading-tight sm:text-xl">
                  {canEdit ? "Edit Registration Responses" : "Registration Application Details"}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 font-medium text-xs",
                    isWaitingPayment && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    !isWaitingPayment &&
                      isPendingReview &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    (isApproved || isPaid) &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    isRejected && "border-destructive/30 bg-destructive/10 text-destructive",
                    isExpiredOrFailed && "border-destructive/30 bg-destructive/10 text-destructive",
                    isCancelled && "border-muted-foreground/30 bg-muted text-muted-foreground",
                  )}
                >
                  {isWaitingPayment && "Waiting for Payment"}
                  {!isWaitingPayment && isPendingReview && "Pending Review"}
                  {isPaid && "Paid & Confirmed"}
                  {!isPaid && isApproved && "Approved / Confirmed"}
                  {isRejected && "Not Selected"}
                  {isExpiredOrFailed && "Expired / Failed"}
                  {isCancelled && "Cancelled"}
                </Badge>
              </div>
              <DialogDescription className="text-xs">
                {registration.event_title} • Submitted by {registration.member_name} ({registration.member_email})
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
            {/* Status Explanation Banner */}
            {statusBanner}

            {isLoadingEvent && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Loading latest event questions...</span>
              </div>
            )}

            {!canEdit ? (
              /* ── READ-ONLY DOSSIER VIEW ───────────────────────────────── */
              <div className="space-y-6">
                {/* Assigned Track */}
                {hasSessions && selectedSessionId && (
                  <div className="flex items-start justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-2xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-primary" />
                        <h4 className="font-semibold text-foreground text-sm">Assigned Session Track</h4>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                          Confirmed
                        </Badge>
                      </div>
                      <p className="pt-0.5 font-semibold text-primary text-sm">
                        {sessions.find((s) => s.id === selectedSessionId)?.title ?? selectedSessionId}
                      </p>
                      {sessions.find((s) => s.id === selectedSessionId)?.description && (
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {sessions.find((s) => s.id === selectedSessionId)?.description}
                        </p>
                      )}
                      {sessions.find((s) => s.id === selectedSessionId)?.location && (
                        <div className="flex items-center gap-1 pt-1 text-muted-foreground text-xs">
                          <MapPin className="size-3 text-emerald-500" />
                          <span>{sessions.find((s) => s.id === selectedSessionId)?.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Locked Ticket & Merchandise (Read-Only) */}
                {(Boolean(registration.ticket_name) ||
                  Boolean(registration.bundle_name) ||
                  Boolean(registration.selected_merchandise && registration.selected_merchandise.length > 0)) && (
                  <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="size-4 text-primary" />
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">Ticket & Merchandise</h4>
                          <p className="text-[11px] text-muted-foreground">Locked selection for this registration.</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1 text-[10px] font-semibold uppercase tracking-wider">
                        <Lock className="size-2.5" />
                        Locked
                      </Badge>
                    </div>

                    <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/20 text-xs">
                      {registration.ticket_name && (
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <Ticket className="size-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Ticket Tier:</span>
                            <span className="font-semibold text-foreground">{registration.ticket_name}</span>
                          </div>
                          {registration.ticket_price !== undefined && (
                            <span className="font-medium text-foreground">
                              {registration.ticket_price === 0 ? "Free" : formatRupiah(registration.ticket_price)}
                            </span>
                          )}
                        </div>
                      )}

                      {registration.bundle_name && (
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <Package className="size-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Bundle Package:</span>
                            <span className="font-semibold text-foreground">{registration.bundle_name}</span>
                          </div>
                          {registration.bundle_price !== undefined && registration.bundle_price !== null && (
                            <span className="font-medium text-foreground">
                              {registration.bundle_price === 0 ? "Free" : formatRupiah(registration.bundle_price)}
                            </span>
                          )}
                        </div>
                      )}

                      {registration.selected_merchandise && registration.selected_merchandise.length > 0 && (
                        <div className="space-y-2 p-3">
                          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                            Selected Merchandise:
                          </span>
                          <div className="space-y-1.5">
                            {registration.selected_merchandise.map((item, idx) => {
                              const variationText =
                                item.selected_variations && Object.keys(item.selected_variations).length > 0
                                  ? Object.values(item.selected_variations).join(", ")
                                  : [item.selected_size, item.selected_variant].filter(Boolean).join(" • ");

                              return (
                                <div
                                  key={
                                    item.merchandise_id || item.id || `${item.merchandise_title || item.name}-${idx}`
                                  }
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-foreground">
                                    {item.merchandise_title || item.name}
                                    {variationText ? ` (${variationText})` : ""}
                                    {" × "}
                                    {item.quantity || 1}
                                  </span>
                                  <span className="font-medium text-muted-foreground">
                                    {formatRupiah((item.price || 0) * (item.quantity || 1))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sections in Read-Only Mode */}
                {Array.from(sectionsMap.entries()).map(([sectionName, sectionQuestions], secIdx) => {
                  const SectionIcon = SECTION_ICONS[sectionName] || FileText;
                  return (
                    <div key={sectionName} className="space-y-3">
                      <div className="flex items-center gap-2 border-b pb-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        <SectionIcon className="size-3.5 text-primary" />
                        <span>
                          {secIdx + 1}. {sectionName}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {sectionQuestions.map((q) => {
                          const val = answers[q.id];
                          const hasVal =
                            val !== undefined &&
                            val !== null &&
                            val !== "" &&
                            !(Array.isArray(val) && val.length === 0);
                          const strVal = String(val ?? "");
                          const isWide =
                            strVal.length > 60 ||
                            strVal.includes("\n") ||
                            Array.isArray(val) ||
                            q.type === "textarea" ||
                            q.id.toLowerCase().includes("portfolio") ||
                            q.id.toLowerCase().includes("github") ||
                            q.id.toLowerCase().includes("linkedin");

                          return (
                            <div
                              key={q.id}
                              className={cn(
                                "flex flex-col justify-between rounded-lg border border-border/60 bg-card p-3 shadow-2xs transition-colors hover:border-border min-w-0 overflow-hidden",
                                isWide && "sm:col-span-2",
                              )}
                            >
                              <div className="mb-1 font-medium text-muted-foreground text-xs">{q.label}</div>
                              <div className="pt-0.5">
                                {!hasVal ? (
                                  <span className="text-muted-foreground/60 text-xs italic">Not provided</span>
                                ) : (
                                  renderReadOnlyValue(q, val)
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── EDITABLE FORM VIEW ───────────────────────────────────── */
              <div className="space-y-6">
                {/* Locked Ticket & Merchandise Notice in Editable Form */}
                {(Boolean(registration.ticket_name) ||
                  Boolean(registration.bundle_name) ||
                  Boolean(registration.selected_merchandise && registration.selected_merchandise.length > 0)) && (
                  <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="size-4 text-primary" />
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">Ticket & Merchandise (Locked)</h4>
                          <p className="text-[11px] text-muted-foreground">
                            Locked selection • If you want to change merchandise or ticket, you need to cancel RSVP and
                            re-register.
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1 text-[10px] font-semibold uppercase tracking-wider">
                        <Lock className="size-2.5" />
                        Locked
                      </Badge>
                    </div>

                    <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/20 text-xs">
                      {registration.ticket_name && (
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <Ticket className="size-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Ticket Tier:</span>
                            <span className="font-semibold text-foreground">{registration.ticket_name}</span>
                          </div>
                          {registration.ticket_price !== undefined && (
                            <span className="font-medium text-foreground">
                              {registration.ticket_price === 0 ? "Free" : formatRupiah(registration.ticket_price)}
                            </span>
                          )}
                        </div>
                      )}

                      {registration.bundle_name && (
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <Package className="size-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Bundle Package:</span>
                            <span className="font-semibold text-foreground">{registration.bundle_name}</span>
                          </div>
                          {registration.bundle_price !== undefined && registration.bundle_price !== null && (
                            <span className="font-medium text-foreground">
                              {registration.bundle_price === 0 ? "Free" : formatRupiah(registration.bundle_price)}
                            </span>
                          )}
                        </div>
                      )}

                      {registration.selected_merchandise && registration.selected_merchandise.length > 0 && (
                        <div className="space-y-2 p-3">
                          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                            Selected Merchandise:
                          </span>
                          <div className="space-y-1.5">
                            {registration.selected_merchandise.map((item, idx) => {
                              const variationText =
                                item.selected_variations && Object.keys(item.selected_variations).length > 0
                                  ? Object.values(item.selected_variations).join(", ")
                                  : [item.selected_size, item.selected_variant].filter(Boolean).join(" • ");

                              return (
                                <div
                                  key={
                                    item.merchandise_id || item.id || `${item.merchandise_title || item.name}-${idx}`
                                  }
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-foreground">
                                    {item.merchandise_title || item.name}
                                    {variationText ? ` (${variationText})` : ""}
                                    {" × "}
                                    {item.quantity || 1}
                                  </span>
                                  <span className="font-medium text-muted-foreground">
                                    {formatRupiah((item.price || 0) * (item.quantity || 1))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                      <span>Want to change your ticket or merchandise?</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCancelConfirmOpen(true)}
                        className="h-7 gap-1 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <UserX className="size-3" />
                        Cancel RSVP to Re-register
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sessions / Tracks Selection */}
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

                    <RadioGroup value={selectedSessionId} onValueChange={setSelectedSessionId} className="space-y-2.5">
                      {sessions.map((sess) => {
                        const isSelected = selectedSessionId === sess.id;
                        const isFull = sess.capacity > 0 && (sess.total_registered ?? 0) >= sess.capacity;
                        const isDisabled = isFull && !isSelected;

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

                {/* Questionnaire Sections */}
                {Array.from(sectionsMap.entries()).map(([sectionName, sectionQuestions], secIdx) => {
                  const SectionIcon = SECTION_ICONS[sectionName] || FileText;
                  return (
                    <div key={sectionName} className="space-y-3.5">
                      <div className="flex items-center gap-2 border-b pb-1.5">
                        <SectionIcon className="size-3.5 text-primary" />
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

                              {q.description && (
                                <p className="pb-1 text-[11px] text-muted-foreground">{q.description}</p>
                              )}

                              {/* Helper / Guideline Image */}
                              {(q.helper_image_url || q.image_url) && (
                                <div className="my-1.5 overflow-hidden rounded-lg border border-border/70 bg-muted/20 p-1">
                                  <a
                                    href={q.helper_image_url || q.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative flex max-h-56 justify-center overflow-hidden rounded-md"
                                    title="Click to view visual guide in full size"
                                  >
                                    <Image
                                      src={(q.helper_image_url || q.image_url) as string}
                                      alt={`${q.label} visual guide`}
                                      width={500}
                                      height={280}
                                      unoptimized
                                      className="h-auto max-h-56 w-auto rounded object-contain transition-transform group-hover:scale-[1.01]"
                                    />
                                    <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-background/85 px-2 py-0.5 font-medium text-[11px] text-foreground shadow-xs backdrop-blur-xs opacity-0 transition-opacity group-hover:opacity-100">
                                      <ExternalLink className="size-3" />
                                      <span>Open Full Size</span>
                                    </div>
                                  </a>
                                </div>
                              )}

                              {/* Helper / Reference Link */}
                              {q.helper_link_url && (
                                <div className="my-1.5 flex items-center">
                                  <a
                                    href={
                                      q.helper_link_url.startsWith("http://") ||
                                      q.helper_link_url.startsWith("https://")
                                        ? q.helper_link_url
                                        : `https://${q.helper_link_url}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary shadow-2xs transition-all hover:border-primary/50 hover:bg-primary/10"
                                    title={`Open ${q.helper_link_label || "Reference Link"} in new tab`}
                                  >
                                    <ExternalLink className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    <span className="truncate max-w-[280px] sm:max-w-md">
                                      {q.helper_link_label?.trim()
                                        ? q.helper_link_label
                                        : "Reference Link / Guidelines"}
                                    </span>
                                    <span className="font-normal text-[10px] text-muted-foreground">
                                      (opens in new tab)
                                    </span>
                                  </a>
                                </div>
                              )}

                              {/* Short Text */}
                              {q.type === "text" && (
                                <Input
                                  id={fieldId}
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

                              {/* Media / File Upload */}
                              {q.type === "media" && (
                                <QuestionMediaUpload
                                  id={fieldId}
                                  value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                                  onChange={(uploadedUrl) => {
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: uploadedUrl,
                                    }));
                                    if (fieldErrors[q.id]) {
                                      setFieldErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[q.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  eventName={eventData?.title ?? registration.event_title ?? "event"}
                                  maxSizeMb={q.max_file_size_mb}
                                  allowedFileTypes={q.allowed_file_types}
                                  required={q.required}
                                  hasError={Boolean(errorMessage)}
                                  errorMessage={errorMessage}
                                />
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
                                        <div className="fade-in-50 animate-in space-y-1 pt-1 duration-200">
                                          <label
                                            htmlFor={`${fieldId}-other-text`}
                                            className="block font-medium text-[11px] text-muted-foreground"
                                          >
                                            Please specify your response:
                                          </label>
                                          <Input
                                            id={`${fieldId}-other-text`}
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
                                        value={isOtherSelected ? "__other__" : rawVal}
                                        onValueChange={(val) => {
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
                                        className={cn(
                                          "grid grid-cols-1 gap-2",
                                          regularOptions.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
                                        )}
                                      >
                                        {regularOptions.map((opt) => {
                                          const optId = `${fieldId}-${opt}`;
                                          const isSelected = !isOtherSelected && rawVal === opt;
                                          return (
                                            <label
                                              key={opt}
                                              htmlFor={optId}
                                              className={cn(
                                                "flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                                isSelected
                                                  ? "border-primary bg-primary/10 font-medium text-foreground shadow-xs"
                                                  : "border-border bg-card text-foreground hover:bg-muted/40",
                                              )}
                                            >
                                              <RadioGroupItem value={opt} id={optId} />
                                              <span className="select-none">{opt}</span>
                                            </label>
                                          );
                                        })}

                                        {hasOther && (
                                          <div
                                            className={cn(
                                              "flex flex-col gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                              regularOptions.length === 3 ? "sm:col-span-3" : "sm:col-span-2",
                                              "sm:flex-row sm:items-center",
                                              isOtherSelected
                                                ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                                : "border-border bg-card hover:bg-muted/40",
                                            )}
                                          >
                                            <div className="flex shrink-0 items-center gap-2">
                                              <RadioGroupItem
                                                value="__other__"
                                                id={`${fieldId}-__other__`}
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
                                                ref={(el) => {
                                                  otherInputRefs.current[q.id] = el;
                                                }}
                                                id={`${fieldId}-__other_input__`}
                                                placeholder="Please specify..."
                                                value={currentOtherText}
                                                onFocus={() => {
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
                                      <div
                                        className={cn(
                                          "grid grid-cols-1 gap-2",
                                          regularOptions.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
                                        )}
                                      >
                                        {regularOptions.map((opt) => {
                                          const optId = `${fieldId}-${opt}`;
                                          const isChecked = rawList.includes(opt);
                                          return (
                                            <label
                                              key={opt}
                                              htmlFor={optId}
                                              className={cn(
                                                "flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                                isChecked
                                                  ? "border-primary bg-primary/10 font-medium text-foreground shadow-xs"
                                                  : "border-border bg-card text-foreground hover:bg-muted/40",
                                              )}
                                            >
                                              <Checkbox
                                                id={optId}
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
                                              "flex flex-col gap-2 rounded-md border p-2.5 text-xs transition-colors",
                                              regularOptions.length === 3 ? "sm:col-span-3" : "sm:col-span-2",
                                              "sm:flex-row sm:items-center",
                                              isOtherChecked
                                                ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                                : "border-border bg-card hover:bg-muted/40",
                                            )}
                                          >
                                            <div className="flex shrink-0 items-center gap-2">
                                              <Checkbox
                                                id={`${fieldId}-__other__`}
                                                checked={isOtherChecked}
                                                onCheckedChange={(checked) => {
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
                                                      const cur = Array.isArray(prev[q.id])
                                                        ? (prev[q.id] as string[])
                                                        : [];
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
                                                ref={(el) => {
                                                  otherInputRefs.current[q.id] = el;
                                                }}
                                                id={`${fieldId}-__other_checkbox_input__`}
                                                placeholder="Please specify..."
                                                value={currentOtherText}
                                                onFocus={() => {
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="shrink-0 flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-3.5">
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCancelConfirmOpen(true)}
                className="gap-1.5 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
              >
                <UserX className="size-3.5" />
                Cancel Registration
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isCancelConfirmOpen && (
        <CancelRegistrationDialog
          open={isCancelConfirmOpen}
          onOpenChange={setIsCancelConfirmOpen}
          registration={registration}
          event={eventData ?? undefined}
          onSuccess={() => {
            setIsCancelConfirmOpen(false);
            setOpen(false);
            onCancel?.();
          }}
        />
      )}
    </>
  );
}
