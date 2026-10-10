"use client";

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Layers,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import googleFavicon from "@/app/Google_Favicon.webp";
import { GdgLogo } from "@/components/gdg-logo";
import { RoleBadge } from "@/components/role-badge";
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
import { extractEventImageUrl } from "@/lib/events/media-utils";
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
import type {
  CustomQuestion,
  EventMerchandiseItem,
  EventSession,
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  SelectedMerchandiseOrder,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { dispatchRegistrationWebhookAction, type RegistrationWebhookPayload } from "@/server/registration-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface EventRegistrationModalProps {
  event: FirestoreEvent;
  existingRegistration?: FirestoreRegistration | null;
  children?: React.ReactNode;
  className?: string;
  isChecking?: boolean;
  onSuccess?: (registration: FirestoreRegistration) => void;
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

function getTicketTypeBadge(type: string): string {
  if (type === "free") return "Free RSVP";
  if (type === "paid") return "Paid Pass";
  return "Refundable Deposit";
}

function getMerchPriceDisplay(item: EventMerchandiseItem, quantity: number): string {
  if (quantity <= 0) return "";
  if (item.is_free) return "Free";
  return `Rp ${((item.price || 0) * quantity).toLocaleString("id-ID")}`;
}

export function EventRegistrationModal({
  event,
  existingRegistration,
  children,
  className,
  isChecking,
  onSuccess,
}: EventRegistrationModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const formUid = useId();

  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [selectedMerch, setSelectedMerch] = useState<
    Record<string, { quantity: number; selectedVariations: Record<string, string> }>
  >({});
  const [localReg, setLocalReg] = useState<FirestoreRegistration | null>(existingRegistration ?? null);
  const [isInternalChecking, setIsInternalChecking] = useState<boolean>(
    existingRegistration === undefined && (Boolean(user) || isAuthLoading),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (existingRegistration !== undefined) {
      if (existingRegistration && !localReg) {
        setIsTransitioning(true);
        setTimeout(() => setIsTransitioning(false), 1500);
      }
      setLocalReg(existingRegistration);
      setIsInternalChecking(false);
      return;
    }
    if (isAuthLoading) {
      return;
    }
    if (!user) {
      setIsInternalChecking(false);
      return;
    }
    async function checkStatus() {
      try {
        setIsInternalChecking(true);
        const found = await checkEventRegistrationAction(String(event.id), user?.id, user?.email);
        if (found) {
          setIsTransitioning(true);
          setLocalReg(found);
          onSuccess?.(found);
          setTimeout(() => setIsTransitioning(false), 1500);
        } else {
          setLocalReg(null);
        }
      } catch (err) {
        console.error("[EventRegistrationModal] failed to check registration status:", err);
      } finally {
        setIsInternalChecking(false);
      }
    }
    void checkStatus();
  }, [user, isAuthLoading, event.id, existingRegistration, onSuccess, localReg]);

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

  const availableTickets = useMemo(() => {
    return (eventConfig.tickets ?? []).filter((t) => t.status !== "hidden");
  }, [eventConfig.tickets]);
  const hasTickets = availableTickets.length > 0;

  const availableMerchandise = useMemo(() => {
    return (eventConfig.merchandise ?? []).filter((m) => m.status === "active");
  }, [eventConfig.merchandise]);
  const hasMerchandise = availableMerchandise.length > 0;

  // Auto-select first active ticket if available and none selected
  useEffect(() => {
    const activeTickets = availableTickets.filter((t) => t.status === "active");
    if (activeTickets.length > 0 && !selectedTicketId) {
      setSelectedTicketId(activeTickets[0].id);
    }
  }, [availableTickets, selectedTicketId]);

  const selectedTicket = useMemo(() => {
    return availableTickets.find((t) => t.id === selectedTicketId) ?? null;
  }, [availableTickets, selectedTicketId]);

  const ticketPrice = selectedTicket ? selectedTicket.price || 0 : 0;

  const totalMerchandiseItems = useMemo(() => {
    return Object.values(selectedMerch).reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [selectedMerch]);

  const maxMerchandiseAllowed = eventConfig.max_merchandise_per_person ?? null;

  const merchandiseTotalPrice = useMemo(() => {
    let total = 0;
    for (const [itemId, order] of Object.entries(selectedMerch)) {
      if (order.quantity > 0) {
        const item = availableMerchandise.find((m) => m.id === itemId);
        if (item && !item.is_free) {
          total += (item.price || 0) * order.quantity;
        }
      }
    }
    return total;
  }, [selectedMerch, availableMerchandise]);

  const grandTotal = ticketPrice + merchandiseTotalPrice;

  const handleUpdateMerchQuantity = (itemId: string, delta: number) => {
    const item = availableMerchandise.find((m) => m.id === itemId);
    if (!item) return;

    setSelectedMerch((prev) => {
      const current = prev[itemId] ?? {
        quantity: 0,
        selectedVariations: {},
      };
      const newQty = Math.max(0, current.quantity + delta);

      // Check max limits
      if (delta > 0) {
        // Event-level max check
        if (maxMerchandiseAllowed !== null && totalMerchandiseItems >= maxMerchandiseAllowed) {
          toast.error(`You can select at most ${maxMerchandiseAllowed} merchandise item(s) for this event.`);
          return prev;
        }
        // Item-level max check
        const itemMax = item.max_per_person ?? null;
        if (itemMax !== null && current.quantity >= itemMax) {
          toast.error(`Limit of ${itemMax} unit(s) per person for "${item.name}".`);
          return prev;
        }
        // Stock quota check
        if (item.stock !== null && item.stock !== undefined && current.quantity >= item.stock) {
          toast.error(`Only ${item.stock} item(s) available in stock.`);
          return prev;
        }
      }

      // Initialize default variations if empty and incrementing
      const nextVariations = { ...current.selectedVariations };
      if (newQty > 0 && item.variations && item.variations.length > 0) {
        for (const v of item.variations) {
          if (!nextVariations[v.name] && v.options.length > 0) {
            nextVariations[v.name] = v.options[0];
          }
        }
      }

      return {
        ...prev,
        [itemId]: {
          quantity: newQty,
          selectedVariations: nextVariations,
        },
      };
    });
  };

  const handleUpdateMerchVariation = (itemId: string, varName: string, optionVal: string) => {
    setSelectedMerch((prev) => {
      const current = prev[itemId] ?? { quantity: 1, selectedVariations: {} };
      return {
        ...prev,
        [itemId]: {
          ...current,
          selectedVariations: {
            ...current.selectedVariations,
            [varName]: optionVal,
          },
        },
      };
    });
  };

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

  const handleBlur = (questionId: string, explicitVal?: unknown) => {
    setTouchedFields((prev) => new Set(prev).add(questionId));
    const question = questions.find((q) => q.id === questionId);
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
    setTouchedFields((prev) => new Set(prev).add(questionId));
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const updated = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      const question = questions.find((q) => q.id === questionId);
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

  const handleSelectRadioRegular = (question: CustomQuestion, opt: string) => {
    setTouchedFields((prev) => new Set(prev).add(question.id));
    setAnswers((prev) => ({ ...prev, [question.id]: opt }));
    setOtherInputs((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    const result = validateQuestionAnswer(question, opt);
    setFieldErrors((prev) => {
      if (result.isValid) {
        const next = { ...prev };
        delete next[question.id];
        return next;
      }
      return { ...prev, [question.id]: result.error ?? "Invalid input" };
    });
  };

  const handleUnselectRadioOther = (question: CustomQuestion) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    setOtherInputs((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
  };

  const handleSelectRadioOther = (question: CustomQuestion) => {
    setTouchedFields((prev) => new Set(prev).add(question.id));
    const currentText = otherInputs[question.id] || "";
    const formatted = formatOtherAnswer(currentText);
    setAnswers((prev) => ({ ...prev, [question.id]: formatted }));
    if (currentText.trim()) {
      const result = validateQuestionAnswer(question, formatted);
      setFieldErrors((prev) => {
        if (result.isValid) {
          const next = { ...prev };
          delete next[question.id];
          return next;
        }
        return { ...prev, [question.id]: result.error ?? "Invalid input" };
      });
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
    setTimeout(() => {
      otherInputRefs.current[question.id]?.focus();
    }, 50);
  };

  const handleRadioOtherTextChange = (question: CustomQuestion, text: string) => {
    setOtherInputs((prev) => ({ ...prev, [question.id]: text }));
    const formatted = formatOtherAnswer(text);
    setAnswers((prev) => ({ ...prev, [question.id]: formatted }));
    if (text.trim().length > 0) {
      const result = validateQuestionAnswer(question, formatted);
      setFieldErrors((prev) => {
        if (result.isValid) {
          const next = { ...prev };
          delete next[question.id];
          return next;
        }
        return { ...prev, [question.id]: result.error ?? "Invalid input" };
      });
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
  };

  const handleSelectDropdownChange = (question: CustomQuestion, val: string) => {
    setTouchedFields((prev) => new Set(prev).add(question.id));
    if (val === "__other__") {
      const currentText = otherInputs[question.id] || "";
      const formatted = formatOtherAnswer(currentText);
      setAnswers((prev) => ({ ...prev, [question.id]: formatted }));
      if (currentText.trim()) {
        const result = validateQuestionAnswer(question, formatted);
        setFieldErrors((prev) => {
          if (result.isValid) {
            const next = { ...prev };
            delete next[question.id];
            return next;
          }
          return { ...prev, [question.id]: result.error ?? "Invalid input" };
        });
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[question.id];
          return next;
        });
      }
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
      setFieldErrors((prev) => {
        if (result.isValid) {
          const next = { ...prev };
          delete next[question.id];
          return next;
        }
        return { ...prev, [question.id]: result.error ?? "Invalid input" };
      });
    }
  };

  const handleSelectOtherTextChange = (question: CustomQuestion, text: string) => {
    setOtherInputs((prev) => ({ ...prev, [question.id]: text }));
    const formatted = formatOtherAnswer(text);
    setAnswers((prev) => ({ ...prev, [question.id]: formatted }));
    if (text.trim().length > 0) {
      const result = validateQuestionAnswer(question, formatted);
      setFieldErrors((prev) => {
        if (result.isValid) {
          const next = { ...prev };
          delete next[question.id];
          return next;
        }
        return { ...prev, [question.id]: result.error ?? "Invalid input" };
      });
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
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
      if (text.trim().length > 0) {
        const result = validateQuestionAnswer(question, updated);
        setFieldErrors((errs) => {
          if (result.isValid) {
            const next = { ...errs };
            delete next[question.id];
            return next;
          }
          return { ...errs, [question.id]: result.error ?? "Invalid input" };
        });
      } else {
        setFieldErrors((errs) => {
          const next = { ...errs };
          delete next[question.id];
          return next;
        });
      }
      return { ...prev, [question.id]: updated };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please join the community by signing in with Google before registering.");
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

    if (hasTickets) {
      if (!selectedTicket) {
        toast.error("Please choose a ticket tier to attend.");
        return;
      }
      if (selectedTicket.status === "sold_out") {
        toast.error(`The ticket tier "${selectedTicket.name}" is sold out. Please select another tier.`);
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
        const initialStatus: RegistrationStatus = "pending";

        const sessionKey = selectedSession?.title ?? "Regular Ticket";
        const combinedAnswers = {
          ...answers,
          Session: sessionKey,
        };

        const selectedMerchOrders: SelectedMerchandiseOrder[] = [];
        for (const [itemId, order] of Object.entries(selectedMerch)) {
          if (order.quantity > 0) {
            const item = availableMerchandise.find((m) => m.id === itemId);
            if (item) {
              selectedMerchOrders.push({
                id: item.id,
                name: item.name,
                quantity: order.quantity,
                price: item.is_free ? 0 : item.price || 0,
                selected_variations:
                  Object.keys(order.selectedVariations).length > 0 ? order.selectedVariations : undefined,
              });
            }
          }
        }

        const cachedImg =
          extractEventImageUrl(eventConfig as unknown as Record<string, unknown>) ??
          extractEventImageUrl(event as unknown as Record<string, unknown>);

        const registrationPayload: Omit<FirestoreRegistration, "id"> = {
          event_id: String(event.id),
          event_title: event.title,
          event_picture_url: cachedImg ?? undefined,
          event_banner_url: eventConfig.banner_url ?? event.banner_url ?? cachedImg ?? undefined,
          member_id: user.id,
          member_name: user.name,
          member_email: user.email,
          member_avatar: user.avatar,
          member_role: user.role,
          status: initialStatus,
          answers: combinedAnswers,
          session_id: selectedSession?.id,
          session_title: selectedSession?.title,
          ticket_id: selectedTicket?.id,
          ticket_name: selectedTicket?.name,
          ticket_type: selectedTicket?.type,
          ticket_price: selectedTicket?.price,
          selected_merchandise: selectedMerchOrders.length > 0 ? selectedMerchOrders : undefined,
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
            requires_approval: Boolean(eventConfig.requires_approval),
            curation_mode: Boolean(eventConfig.curation_mode),
            banner_url: eventConfig.banner_url ?? event.banner_url ?? cachedImg ?? undefined,
            picture_url: eventConfig.picture_url ?? event.picture_url ?? cachedImg ?? undefined,
            email_templates: eventConfig.email_templates,
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
            ticket_id: selectedTicket?.id,
            ticket_name: selectedTicket?.name,
            ticket_type: selectedTicket?.type,
            ticket_price: selectedTicket?.price,
            selected_merchandise: selectedMerchOrders.length > 0 ? selectedMerchOrders : undefined,
          },
          member: {
            id: user.id,
            name: user.name,
            email: ((combinedAnswers as Record<string, unknown>).work_email as string) || user.email,
            role: user.role,
            avatar: user.avatar,
          },
          answers: combinedAnswers,
          timestamp: new Date().toISOString(),
        };

        try {
          const webhookResult = await dispatchRegistrationWebhookAction(webhookPayload);
          if (webhookResult.dispatched && webhookResult.error) {
            console.warn("[Registration Modal] Webhook warning:", webhookResult.error);
          }
        } catch (webhookErr) {
          console.warn("[Registration Modal] Webhook dispatch error:", webhookErr);
        }

        const newReg: FirestoreRegistration = {
          id: result.registrationId || `${event.id}_${user?.id || Date.now()}`,
          event_id: String(event.id),
          event_title: event.title,
          member_id: user?.id || "",
          member_name: user?.name || "Attendee",
          member_email: ((combinedAnswers as Record<string, unknown>).work_email as string) || user?.email || "",
          status: "pending",
          registered_at: new Date().toISOString(),
          answers: combinedAnswers,
          session_id: selectedSession?.id,
          session_title: selectedSession?.title,
          ticket_id: selectedTicket?.id,
          ticket_name: selectedTicket?.name,
          ticket_type: selectedTicket?.type,
          ticket_price: selectedTicket?.price,
          selected_merchandise: selectedMerchOrders.length > 0 ? selectedMerchOrders : undefined,
        };

        setIsTransitioning(true);
        setLocalReg(newReg);
        onSuccess?.(newReg);
        setTimeout(() => setIsTransitioning(false), 1500);

        toast.success("Registration submitted! Your application is now pending organizer review.", {
          duration: 5000,
        });

        setOpen(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to register. Please try again.";
        toast.error(msg);
      }
    });
  };

  const isCheckingRegistration =
    isChecking ??
    (!activeRegistration && (isInternalChecking || (isAuthLoading && existingRegistration === undefined)));

  if (isCheckingRegistration) {
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

    return (
      <Button
        disabled
        variant="outline"
        size={buttonSize}
        className={cn(
          "relative cursor-default gap-2 overflow-hidden border-border/60 bg-muted/50 font-medium text-muted-foreground opacity-90 shadow-xs transition-all duration-300",
          isFullWidth && "w-full",
          className,
        )}
      >
        <Sparkles
          className={cn(
            "relative z-10 shrink-0 animate-pulse text-muted-foreground/60",
            buttonSize === "lg" ? "size-4" : "size-3.5",
          )}
        />
        <span className="relative z-10">Checking registration...</span>
        <div className="shimmer-wave" aria-hidden="true" />
      </Button>
    );
  }

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
      statusLabel = "Pending Review";
    }

    return (
      <Button
        type="button"
        variant={isApproved ? "outline" : "secondary"}
        size={buttonSize}
        aria-disabled="true"
        className={cn(
          "relative cursor-default gap-2 overflow-hidden font-medium transition-all duration-500",
          isApproved
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300",
          isTransitioning && "fade-in-50 zoom-in-95 scale-[1.01] animate-in ring-2 ring-emerald-500/40",
          isFullWidth && "w-full",
          className,
        )}
      >
        <CheckCircle2
          className={cn(
            "relative z-10 shrink-0 transition-transform duration-500",
            buttonSize === "lg" ? "size-4" : "size-3.5",
            isApproved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
            isTransitioning && "scale-110",
          )}
        />
        <span className="relative z-10 font-medium">{statusLabel}</span>
        <div className="shimmer-wave" aria-hidden="true" />
      </Button>
    );
  }

  const windowStatus = getRegistrationWindowStatus(eventConfig);

  if (isPast || !windowStatus.isOpen) {
    let buttonSize: "default" | "sm" | "lg" | "icon" = "sm";
    if (React.isValidElement(children)) {
      const childProps = children.props as { size?: "default" | "sm" | "lg" | "icon" };
      if (childProps.size) buttonSize = childProps.size;
    }

    return (
      <Button
        variant="secondary"
        size={buttonSize}
        disabled
        className={cn(
          "cursor-not-allowed font-medium opacity-80",
          className,
          windowStatus.status === "draft" &&
            "border border-amber-500/40 border-dashed bg-amber-500/10 text-amber-800 dark:text-amber-300",
          windowStatus.status === "upcoming" &&
            "border border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300",
        )}
      >
        {windowStatus.status === "draft" && <FileEdit className="mr-1.5 size-3.5" />}
        {windowStatus.status === "upcoming" && <Clock className="mr-1.5 size-3.5" />}
        {windowStatus.message}
      </Button>
    );
  }

  let modalDescription = "Complete the registration questionnaire to confirm your RSVP and reserve your spot.";
  if (!user) {
    modalDescription =
      "GDG Jakarta events are open to our chapter members. Please join the community first by signing in with your Google account.";
  } else if (eventConfig.requires_approval || event.requires_approval) {
    modalDescription =
      "This event is curated. Please complete your registration details for organizer review. After submitting, your attendee status will be Pending Review until approved.";
  }

  let footerSummaryBadge = <span className="text-muted-foreground text-xs">Free Registration</span>;
  if (grandTotal > 0) {
    footerSummaryBadge = (
      <div className="flex items-baseline gap-1.5">
        <span className="text-muted-foreground text-xs">Total:</span>
        <span className="font-bold font-mono text-foreground text-sm">Rp {grandTotal.toLocaleString("id-ID")}</span>
      </div>
    );
  } else if (selectedTicket) {
    footerSummaryBadge = (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs dark:text-emerald-400"
      >
        {selectedTicket.name} • Free RSVP
      </Badge>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-1.5">
            {!user ? (
              <>
                <Image src={googleFavicon} alt="Google" width={16} height={16} className="size-3.5 object-contain" />
                Join Community to Register
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Register for Event
              </>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <div className="shrink-0 border-b bg-muted/20 px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {resolveEventAudience(event.audience_type, event.is_virtual).label}
              </Badge>
              {!user && (
                <Badge
                  variant="secondary"
                  className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                >
                  Community Membership Required
                </Badge>
              )}
              {(eventConfig.requires_approval || event.requires_approval) && (
                <Badge
                  variant="secondary"
                  className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                >
                  Requires Approval (Curation Mode)
                </Badge>
              )}
              {hasSessions && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-[10px] text-primary">
                  Multi-Session Event
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl leading-snug">{event.title}</DialogTitle>
            <DialogDescription className="text-xs">{modalDescription}</DialogDescription>
          </DialogHeader>
        </div>

        {!user ? (
          <div className="flex flex-1 min-h-0 flex-col items-center overflow-y-auto px-6 py-6 text-center">
            {/* Header / Avatar / GDG Branding */}
            <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-xs">
              <GdgLogo size={36} className="h-9 w-auto" />
            </div>

            <Badge variant="outline" className="mb-2 border-primary/30 text-[11px] font-medium text-primary">
              Step 1 of 2: Join Chapter Community
            </Badge>

            <h3 className="font-semibold text-xl tracking-tight text-foreground">Join GDG Jakarta to Register</h3>
            <p className="mt-1.5 max-w-md text-muted-foreground text-sm leading-relaxed">
              To attend <span className="font-medium text-foreground">&quot;{event.title}&quot;</span>, you need to be a
              registered member of our Google Developer Groups Jakarta chapter. Sign in with Google to join our
              community before registering.
            </p>

            {/* Benefits box */}
            <div className="mt-6 w-full max-w-md rounded-xl border bg-muted/40 p-4 text-left text-xs space-y-2.5">
              <p className="font-semibold text-foreground text-[13px]">Why join GDG Jakarta first?</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Free RSVP &amp; guaranteed entry to official chapter events</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Personalized digital ticket with QR check-in pass</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Connect with 3,500+ developers, tech leads, and Google experts</span>
                </li>
              </ul>
            </div>

            {/* Sign in with Google Action */}
            <div className="mt-6 w-full max-w-md space-y-3">
              <GoogleButton
                redirect={false}
                onSuccess={async (result) => {
                  toast.success(`Welcome to GDG Jakarta, ${result.organizer.name}! You have joined the community.`);
                  try {
                    setIsInternalChecking(true);
                    const found = await checkEventRegistrationAction(
                      String(event.id),
                      result.organizer.id,
                      result.organizer.email,
                    );
                    if (found) {
                      setLocalReg(found);
                      onSuccess?.(found);
                      setOpen(false);
                      toast.info("You are already registered for this event!");
                    }
                  } catch (e) {
                    console.warn("[EventRegistrationModal] Failed checking registration after sign in:", e);
                  } finally {
                    setIsInternalChecking(false);
                  }
                }}
                className="h-11 w-full font-medium shadow-xs"
              >
                Sign in with Google to Join Community
              </GoogleButton>
              <p className="text-center text-[11px] text-muted-foreground">
                Quick 1-click Google Sign-In. Automatically registers you with GDG Jakarta on the Bevy platform.
              </p>
            </div>

            <div className="mt-6 flex w-full justify-end border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
              {/* Member Profile Banner */}
              {user && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3.5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-medium text-muted-foreground">Registering Account:</span>
                    <div className="font-semibold text-foreground text-sm">
                      {user.name} <span className="font-normal text-muted-foreground text-xs">({user.email})</span>
                    </div>
                  </div>
                  <RoleBadge role={user.chapterRole || user.role} />
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

              {/* ── TICKET TIER SELECTION SECTION ───────────────────────── */}
              {hasTickets && (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="size-4 text-primary" />
                      <h3 className="font-semibold text-foreground text-sm">Select Your Registration Ticket</h3>
                      <span className="text-destructive">*</span>
                    </div>
                    {eventConfig.max_tickets_per_person && (
                      <Badge variant="outline" className="text-[10px]">
                        Max {eventConfig.max_tickets_per_person} / person
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Select your preferred pass type. Free RSVP, Commitment Deposit, and Paid tiers are supported.
                  </p>

                  <RadioGroup
                    value={selectedTicketId}
                    onValueChange={setSelectedTicketId}
                    className="grid grid-cols-1 gap-2.5 pt-1"
                  >
                    {availableTickets.map((t) => {
                      const isSelected = selectedTicketId === t.id;
                      const isSoldOut = t.status === "sold_out";

                      return (
                        <label
                          key={t.id}
                          htmlFor={`ticket-opt-${t.id}`}
                          className={cn(
                            "relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                              : "border-border bg-card hover:bg-muted/30",
                            isSoldOut && "cursor-not-allowed opacity-60 hover:bg-card",
                          )}
                        >
                          <RadioGroupItem
                            value={t.id}
                            id={`ticket-opt-${t.id}`}
                            disabled={isSoldOut}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground text-sm">{t.name}</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold",
                                    t.type === "free" &&
                                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                                    t.type === "paid" &&
                                      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                                    t.type === "commitment_fee" &&
                                      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                  )}
                                >
                                  {getTicketTypeBadge(t.type)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground text-sm">
                                  {t.type === "free" ? "Free" : `Rp ${(t.price || 0).toLocaleString("id-ID")}`}
                                </span>
                                {isSoldOut && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Sold Out
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {t.description && (
                              <p className="text-muted-foreground text-xs leading-relaxed">{t.description}</p>
                            )}

                            {t.type === "commitment_fee" && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                <ShieldCheck className="size-3.5 shrink-0" />
                                <span>Deposit will be returned 100% in cash upon physical check-in at the venue.</span>
                              </div>
                            )}
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
                                      <div className="fade-in-50 animate-in space-y-1 pt-1 duration-200">
                                        <label
                                          htmlFor={`${fieldId}-other-text`}
                                          className="block font-medium text-[11px] text-muted-foreground"
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
                                const radioGridClass =
                                  regularOptions.length === 3 && !hasOther
                                    ? "grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3"
                                    : "grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2";

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
                                    className={radioGridClass}
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
                                              ? "border-primary bg-primary/10 font-medium text-foreground shadow-xs"
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
                                          "flex flex-col gap-2 rounded-md border p-2.5 text-xs transition-colors sm:col-span-2 sm:flex-row sm:items-center",
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
                                        <div className="flex shrink-0 items-center gap-2">
                                          <RadioGroupItem
                                            value="__other__"
                                            id={`${fieldId}-__other__`}
                                            checked={isOtherSelected}
                                            onClick={() => {
                                              if (isOtherSelected) {
                                                handleUnselectRadioOther(q);
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
                                              "h-8 bg-background/80 text-xs transition-colors",
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
                                const checkboxGridClass =
                                  regularOptions.length === 3 && !hasOther
                                    ? "grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3"
                                    : "grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2";

                                return (
                                  <div className={checkboxGridClass}>
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
                                          "flex flex-col gap-2 rounded-md border p-2.5 text-xs transition-colors sm:col-span-2 sm:flex-row sm:items-center",
                                          isOtherChecked
                                            ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                                            : "border-border bg-card hover:bg-muted/40",
                                          errorMessage && "border-destructive/60",
                                        )}
                                      >
                                        <div className="flex shrink-0 items-center gap-2">
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
                                                setFieldErrors((prev) => {
                                                  const next = { ...prev };
                                                  delete next[q.id];
                                                  return next;
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
                                            className="shrink-0"
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
                                            onBlur={(e) => {
                                              const trimmed = e.target.value.trim();
                                              if (trimmed.length > 0) {
                                                const current = Array.isArray(answers[q.id])
                                                  ? (answers[q.id] as string[])
                                                  : [];
                                                const filtered = current.filter(
                                                  (it) =>
                                                    typeof it === "string" &&
                                                    !isOtherOption(it) &&
                                                    !it.toLowerCase().startsWith("other:"),
                                                );
                                                handleBlur(q.id, [...filtered, formatOtherAnswer(trimmed)]);
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

              {/* ── MERCHANDISE ADD-ONS SECTION ──────────────────────────── */}
              {hasMerchandise && (
                <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="size-4 text-primary" />
                      <h3 className="font-semibold text-foreground text-sm">Official Merchandise & Swag (Optional)</h3>
                    </div>
                    {maxMerchandiseAllowed && (
                      <Badge variant="outline" className="text-[10px]">
                        {totalMerchandiseItems}/{maxMerchandiseAllowed} items selected
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Add exclusive community swag, apparel, and event merchandise to your registration.
                  </p>

                  <div className="space-y-3 pt-1">
                    {availableMerchandise.map((item) => {
                      const order = selectedMerch[item.id] ?? { quantity: 0, selectedVariations: {} };
                      const isAdded = order.quantity > 0;
                      const itemMax = item.max_per_person ?? maxMerchandiseAllowed ?? null;
                      const reachedLimit =
                        (itemMax !== null && order.quantity >= itemMax) ||
                        (maxMerchandiseAllowed !== null && totalMerchandiseItems >= maxMerchandiseAllowed);

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex flex-col gap-3 rounded-lg border p-3.5 transition-all sm:flex-row sm:items-center sm:justify-between",
                            isAdded
                              ? "border-primary/50 bg-background shadow-xs ring-1 ring-primary/20"
                              : "border-border/70 bg-card",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                              {item.image_url ? (
                                // biome-ignore lint/performance/noImgElement: merchandise preview
                                // biome-ignore lint/a11y/useAltText: thumbnail
                                <img src={item.image_url} className="size-full object-cover" />
                              ) : (
                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                  <Package className="size-5 opacity-40" />
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-foreground text-xs sm:text-sm">{item.name}</span>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    item.is_free
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                  )}
                                >
                                  {item.is_free ? "Free Perk" : `Rp ${(item.price || 0).toLocaleString("id-ID")}`}
                                </Badge>
                              </div>

                              {item.description && (
                                <p className="line-clamp-2 text-muted-foreground text-[11px] leading-relaxed">
                                  {item.description}
                                </p>
                              )}

                              {/* Variations Selectors (e.g. Size, Color) */}
                              {isAdded && item.variations && item.variations.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                                  {item.variations.map((v) => (
                                    <div key={v.name} className="flex items-center gap-1 text-[11px]">
                                      <span className="text-muted-foreground">{v.name}:</span>
                                      <Select
                                        value={order.selectedVariations[v.name] || v.options[0]}
                                        onValueChange={(val) => handleUpdateMerchVariation(item.id, v.name, val)}
                                      >
                                        <SelectTrigger className="h-6 w-20 text-[10px] px-1.5 py-0">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {v.options.map((opt) => (
                                            <SelectItem key={opt} value={opt} className="text-xs">
                                              {opt}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Stepper Quantity Buttons */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 border-t pt-2 sm:border-t-0 sm:pt-0">
                            <span className="text-xs font-semibold sm:hidden">
                              {getMerchPriceDisplay(item, order.quantity)}
                            </span>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                onClick={() => handleUpdateMerchQuantity(item.id, -1)}
                                disabled={order.quantity === 0}
                                className="size-7"
                              >
                                <Minus className="size-3" />
                              </Button>
                              <span className="w-6 text-center font-mono text-xs font-semibold">{order.quantity}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                onClick={() => handleUpdateMerchQuantity(item.id, 1)}
                                disabled={reachedLimit}
                                className="size-7"
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── REGISTRATION & ORDER SUMMARY ─────────────────────────── */}
              {(hasTickets || (hasMerchandise && totalMerchandiseItems > 0)) && (
                <div className="rounded-xl border bg-muted/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span>Registration & Checkout Summary</span>
                    <span>Amount</span>
                  </div>

                  {selectedTicket && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">
                        Ticket: <strong>{selectedTicket.name}</strong>
                      </span>
                      <span className="font-mono">
                        {selectedTicket.type === "free"
                          ? "Rp 0"
                          : `Rp ${(selectedTicket.price || 0).toLocaleString("id-ID")}`}
                      </span>
                    </div>
                  )}

                  {Object.entries(selectedMerch).map(([itemId, order]) => {
                    if (order.quantity <= 0) return null;
                    const m = availableMerchandise.find((it) => it.id === itemId);
                    if (!m) return null;
                    const varText = Object.values(order.selectedVariations).join(", ");
                    return (
                      <div key={itemId} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {order.quantity}x {m.name} {varText ? `(${varText})` : ""}
                        </span>
                        <span className="font-mono">
                          {m.is_free ? "Free" : `Rp ${((m.price || 0) * order.quantity).toLocaleString("id-ID")}`}
                        </span>
                      </div>
                    );
                  })}

                  <div className="border-t pt-2 flex items-center justify-between font-bold text-sm text-foreground">
                    <span>Total Amount</span>
                    <span className="font-mono text-primary">
                      {grandTotal === 0 ? "Free (Rp 0)" : `Rp ${grandTotal.toLocaleString("id-ID")}`}
                    </span>
                  </div>

                  {selectedTicket?.type === "commitment_fee" && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1 leading-normal">
                      💡 Note: Your commitment deposit will be handed back in full upon physical check-in at the venue.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-3.5">
              <div className="flex items-center gap-2 text-xs">{footerSummaryBadge}</div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="gap-2 shadow-xs">
                  {isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Submit Registration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
