"use client";

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileEdit,
  Images,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  Minus,
  Package,
  PackageCheck,
  Plus,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import googleFavicon from "@/app/Google_Favicon.webp";
import { CapacityFullDialog } from "@/components/capacity-full-dialog";
import { MerchandiseGalleryDialog } from "@/components/events/merchandise-gallery-dialog";
import { QuestionMediaUpload } from "@/components/events/question-media-upload";
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
import { buildApprovedAttendeePayload } from "@/lib/events/approved-attendee-webhook";
import { calculateBundlePricing, getBundleSalesStatus } from "@/lib/events/bundle-templates";
import { checkEventCapacityStatus, validateRegistrationSubmissionCapacity } from "@/lib/events/capacity-validator";
import {
  buildRegistrationPaymentPayload,
  extractCustomerPhone,
  hasRegistrationPaymentRequirements,
} from "@/lib/events/doku-payment";
import { extractEventImageUrl } from "@/lib/events/media-utils";
import { getMerchandiseSalesStatus } from "@/lib/events/merchandise-templates";
import { isEventCurationMode } from "@/lib/events/payment-deadline";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import {
  formatOtherAnswer,
  getCheckboxRequirement,
  isOtherOption,
  parseOtherAnswer,
  validateQuestionAnswer,
} from "@/lib/events/question-validator";
import {
  getRegistrationWindowStatus,
  getSessionRemainingSeats,
  isSessionAvailable,
} from "@/lib/events/registration-defaults";
import { createDefaultRegularTicket, ensureEventTickets, getTicketSalesStatus } from "@/lib/events/ticket-templates";
import { calculateVoucherDiscount, validateVoucherForCart } from "@/lib/events/voucher-utils";
import {
  checkEventRegistrationAction,
  deleteEventRegistrationAction,
  registerForEventAction,
} from "@/lib/firestore/actions";
import type {
  CustomQuestion,
  EventBundlePackage,
  EventMerchandiseItem,
  EventVoucher,
  FirestoreEvent,
  FirestoreRegistration,
  ReferralProgramSettings,
  RegistrationStatus,
  SelectedMerchandiseOrder,
} from "@/lib/firestore/types";
import { cn, sanitizeHtml } from "@/lib/utils";
import { generatePaymentLinkAction } from "@/server/payment-actions";
import {
  approveAttendeeWebhookAction,
  dispatchRegistrationWebhookAction,
  type RegistrationWebhookPayload,
} from "@/server/registration-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface EventRegistrationModalProps {
  event: FirestoreEvent;
  existingRegistration?: FirestoreRegistration | null;
  allowReRegister?: boolean;
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

function getMerchEffectivePrice(item: EventMerchandiseItem, selectedVariations?: Record<string, string>): number {
  if (item.is_free) return 0;
  let unitPrice = item.price || 0;
  if (selectedVariations && item.variations) {
    for (const v of item.variations) {
      const selectedOpt = selectedVariations[v.name];
      if (
        selectedOpt &&
        v.option_details?.[selectedOpt]?.price !== undefined &&
        v.option_details[selectedOpt].price !== null
      ) {
        unitPrice = v.option_details[selectedOpt].price;
      }
    }
  }
  return unitPrice;
}

function getMerchEffectiveImage(item: EventMerchandiseItem, selectedVariations?: Record<string, string>): string {
  if (selectedVariations && item.variations) {
    for (const v of item.variations) {
      const selectedOpt = selectedVariations[v.name];
      if (selectedOpt && v.option_details?.[selectedOpt]?.image_url) {
        return v.option_details[selectedOpt].image_url;
      }
    }
  }
  return item.image_url || (item.images?.[0] ?? "");
}

function getMerchAllImages(item: EventMerchandiseItem, selectedVariations?: Record<string, string>): string[] {
  const list: string[] = [];

  // If a variation option is selected and has an image, put it first
  if (selectedVariations && item.variations) {
    for (const v of item.variations) {
      const selectedOpt = selectedVariations[v.name];
      if (selectedOpt) {
        const varImg = v.option_details?.[selectedOpt]?.image_url;
        if (varImg && !list.includes(varImg)) {
          list.push(varImg);
        }
      }
    }
  }

  // Primary image
  if (item.image_url && !list.includes(item.image_url)) {
    list.push(item.image_url);
  }

  // Additional product gallery images
  if (item.images && item.images.length > 0) {
    for (const img of item.images) {
      if (img && !list.includes(img)) {
        list.push(img);
      }
    }
  }

  // Other variation images
  if (item.variations) {
    for (const v of item.variations) {
      if (v.option_details) {
        for (const optKey of Object.keys(v.option_details)) {
          const optImg = v.option_details[optKey]?.image_url;
          if (optImg && !list.includes(optImg)) {
            list.push(optImg);
          }
        }
      }
    }
  }

  return list;
}

function getMerchPriceDisplay(
  item: EventMerchandiseItem,
  quantity: number,
  selectedVariations?: Record<string, string>,
  isIncludedInTicket?: boolean,
): string {
  if (quantity <= 0) return "";
  if (item.is_free || isIncludedInTicket) return "Free (Included)";
  const unitPrice = getMerchEffectivePrice(item, selectedVariations);
  return `Rp ${(unitPrice * quantity).toLocaleString("id-ID")}`;
}

export function EventRegistrationModal({
  event,
  existingRegistration,
  allowReRegister = false,
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
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [selectedMerch, setSelectedMerch] = useState<
    Record<string, { quantity: number; selectedVariations: Record<string, string> }>
  >({});
  const [localReg, setLocalReg] = useState<FirestoreRegistration | null>(existingRegistration ?? null);
  const [isInternalChecking, setIsInternalChecking] = useState<boolean>(
    existingRegistration === undefined && (Boolean(user) || isAuthLoading),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [viewingGuidelineItem, setViewingGuidelineItem] = useState<EventMerchandiseItem | null>(null);
  const [viewingGalleryItem, setViewingGalleryItem] = useState<EventMerchandiseItem | null>(null);
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [registrationStep, setRegistrationStep] = useState<"tickets" | "form">("tickets");
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const [capacityAlert, setCapacityAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
    reason?: "venue_full" | "session_full";
    sessionTitle?: string;
    currentCount?: number;
    maxCapacity?: number;
  } | null>(null);

  const [serverClockOffset, setServerClockOffset] = useState<number>(0);
  const [isClockDriftDetected, setIsClockDriftDetected] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;
    import("@/server/event-registration-actions")
      .then((m) => m.getServerTimeAction())
      .then((res) => {
        if (isCancelled) return;
        const drift = res.serverTimeMillis - Date.now();
        setServerClockOffset(drift);
        if (Math.abs(drift) > 2 * 60 * 1000) {
          setIsClockDriftDetected(true);
        }
      })
      .catch((err) => {
        console.warn("[Registration Modal] Could not sync server time:", err);
      });
    return () => {
      isCancelled = true;
    };
  }, [open]);

  const effectiveNow = Date.now() + serverClockOffset;

  useEffect(() => {
    if (open) {
      setRegistrationStep("tickets");
    }
  }, [open]);

  useEffect(() => {
    if (registrationStep && modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [registrationStep]);

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
      const currentUser = user;
      async function prefillMemberData() {
        let memberPhone = "";
        try {
          const { getFirestoreMemberById } = await import("@/lib/firestore/client");
          const memberDoc = await getFirestoreMemberById(currentUser.id);
          if (memberDoc?.phone) {
            memberPhone = memberDoc.phone;
          }
        } catch (err) {
          console.warn("[EventRegistrationModal] Failed to load member profile:", err);
        }

        setAnswers((prev) => ({
          ...prev,
          full_name: (prev.full_name as string) || (prev.name as string) || currentUser.name || "",
          name: (prev.name as string) || (prev.full_name as string) || currentUser.name || "",
          email: (prev.email as string) || currentUser.email || "",
          ...(memberPhone && !prev.whatsapp ? { whatsapp: memberPhone } : {}),
          // Keep work_email untouched by personal user.email
        }));
      }
      void prefillMemberData();
    }
  }, [open, user]);

  const [eventConfig, setEventConfig] = useState<FirestoreEvent>(event);

  useEffect(() => {
    setEventConfig(event);
    async function loadLatestFirestoreEvent() {
      try {
        const { getFirestoreEventById, getEventSessionRegistrationCounts } = await import("@/lib/firestore/client");
        const [docData, liveSessionCounts] = await Promise.all([
          getFirestoreEventById(String(event.id)),
          getEventSessionRegistrationCounts(String(event.id)),
        ]);
        if (docData) {
          let mergedSessions = docData.sessions;
          if (Array.isArray(docData.sessions) && Object.keys(liveSessionCounts).length > 0) {
            mergedSessions = docData.sessions.map((sess) => ({
              ...sess,
              total_registered: liveSessionCounts[sess.id] ?? sess.total_registered ?? 0,
            }));
          }
          setEventConfig((prev) => ({
            ...prev,
            ...docData,
            ...(mergedSessions ? { sessions: mergedSessions } : {}),
          }));
        }
      } catch (err) {
        console.warn("[EventRegistrationModal] Failed to load Firestore event doc:", err);
      }
    }
    void loadLatestFirestoreEvent();
  }, [event]);

  // Real-time listener when modal is open to reflect live approved capacity decreases immediately
  useEffect(() => {
    if (!open) return;
    let unsub = () => {
      // noop initial unsubscribe
    };
    void (async () => {
      try {
        const { subscribeFirestoreEventDoc, getEventSessionRegistrationCounts } = await import(
          "@/lib/firestore/client"
        );
        unsub = subscribeFirestoreEventDoc(String(event.id), async (doc) => {
          if (doc) {
            let mergedSessions = doc.sessions;
            try {
              const liveSessionCounts = await getEventSessionRegistrationCounts(String(event.id));
              if (Array.isArray(doc.sessions) && Object.keys(liveSessionCounts).length > 0) {
                mergedSessions = doc.sessions.map((sess) => ({
                  ...sess,
                  total_registered: liveSessionCounts[sess.id] ?? sess.total_registered ?? 0,
                }));
              }
            } catch {
              // ignore
            }
            setEventConfig((prev) => ({
              ...prev,
              ...doc,
              ...(mergedSessions ? { sessions: mergedSessions } : {}),
            }));
          }
        });
      } catch (err) {
        console.warn("[EventRegistrationModal] Failed to subscribe to event updates:", err);
      }
    })();
    return () => unsub();
  }, [open, event.id]);

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

  const preEventSessions = useMemo(() => {
    return (eventConfig.sessions ?? []).filter((s) => s.include_in_registration !== false);
  }, [eventConfig.sessions]);
  const hasSessions = preEventSessions.length > 0;

  const availableTickets = useMemo(() => {
    const raw = ensureEventTickets(eventConfig.tickets);
    const visible = raw.filter((t) => t.status !== "hidden");
    if (visible.length > 0) return visible;
    return [createDefaultRegularTicket()];
  }, [eventConfig.tickets]);
  const hasTickets = availableTickets.length > 0;

  const availableMerchandise = useMemo(() => {
    return (eventConfig.merchandise ?? []).filter((m) => m.status !== "hidden" && m.status !== "draft");
  }, [eventConfig.merchandise]);
  const hasMerchandise = availableMerchandise.length > 0;

  const availableBundles = useMemo(() => {
    return (eventConfig.bundles ?? []).filter((b) => b.status !== "hidden");
  }, [eventConfig.bundles]);
  const hasBundles = availableBundles.length > 0;

  const hasPaidPass = useMemo(() => {
    const hasPaidTicket = availableTickets.some(
      (t) => t.type === "paid" || t.type === "commitment_fee" || (typeof t.price === "number" && t.price > 0),
    );
    const hasPaidBundle = availableBundles.some((b) => typeof b.price === "number" && b.price > 0);
    return hasPaidTicket || hasPaidBundle;
  }, [availableTickets, availableBundles]);

  const selectedBundle = useMemo(() => {
    return availableBundles.find((b) => b.id === selectedBundleId) ?? null;
  }, [availableBundles, selectedBundleId]);

  const hasBundleTicket = Boolean(selectedBundle?.ticket_id);
  const hasBundleMerchandise = Boolean(
    selectedBundle?.merchandise_items && selectedBundle.merchandise_items.length > 0,
  );

  const handleSelectBundle = (bundle: EventBundlePackage) => {
    if (selectedBundleId === bundle.id) {
      setSelectedBundleId("");
      if (bundle.merchandise_items.length > 0) {
        const bundleMerchIds = new Set(bundle.merchandise_items.map((bi) => bi.merchandise_id));
        setSelectedMerch((prev) => {
          const updated: Record<string, { quantity: number; selectedVariations: Record<string, string> }> = {};
          for (const [id, order] of Object.entries(prev)) {
            if (!bundleMerchIds.has(id)) {
              updated[id] = order;
            }
          }
          return updated;
        });
      }
      const openTickets = availableTickets.filter((t) => getTicketSalesStatus(t, effectiveNow).isOpen);
      if (openTickets.length > 0) {
        setSelectedTicketId(openTickets[0].id);
      }
      return;
    }

    setSelectedBundleId(bundle.id);

    if (bundle.ticket_id) {
      setSelectedTicketId(bundle.ticket_id);
    }

    setSelectedMerch((prev) => {
      const updated: Record<string, { quantity: number; selectedVariations: Record<string, string> }> = {};
      const prevBundleMerchIds = new Set(selectedBundle?.merchandise_items.map((bi) => bi.merchandise_id) ?? []);
      for (const [id, order] of Object.entries(prev)) {
        if (!prevBundleMerchIds.has(id)) {
          updated[id] = order;
        }
      }
      if (bundle.merchandise_items.length > 0) {
        for (const bItem of bundle.merchandise_items) {
          const targetMerch = availableMerchandise.find((m) => m.id === bItem.merchandise_id);
          const defaultVars: Record<string, string> = { ...updated[bItem.merchandise_id]?.selectedVariations };
          if (targetMerch?.variations) {
            for (const v of targetMerch.variations) {
              if (!defaultVars[v.name] && v.options?.length) {
                defaultVars[v.name] = bItem.default_variations?.[v.name] || v.options[0];
              }
            }
          }
          updated[bItem.merchandise_id] = {
            quantity: bItem.quantity,
            selectedVariations: defaultVars,
          };
        }
      }
      return updated;
    });
  };

  // Auto-select session if only 1 session track exists
  useEffect(() => {
    if (preEventSessions.length === 1 && !selectedSessionId) {
      setSelectedSessionId(preEventSessions[0].id);
    }
  }, [preEventSessions, selectedSessionId]);

  // Auto-select first open ticket if none selected or if currently selected ticket is closed/unavailable
  useEffect(() => {
    if (selectedBundleId && hasBundleTicket) return;
    const openTickets = availableTickets.filter((t) => getTicketSalesStatus(t, effectiveNow).isOpen);
    const currentTicket = availableTickets.find((t) => t.id === selectedTicketId);
    const isCurrentTicketOpen = currentTicket ? getTicketSalesStatus(currentTicket, effectiveNow).isOpen : false;

    if (!isCurrentTicketOpen) {
      if (openTickets.length > 0) {
        setSelectedTicketId(openTickets[0].id);
      } else if (selectedTicketId) {
        setSelectedTicketId("");
      }
    }
  }, [availableTickets, selectedTicketId, selectedBundleId, hasBundleTicket, effectiveNow]);

  const selectedTicket = useMemo(() => {
    return availableTickets.find((t) => t.id === selectedTicketId) ?? null;
  }, [availableTickets, selectedTicketId]);

  const selectedSession = useMemo(() => {
    return preEventSessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [preEventSessions, selectedSessionId]);

  const ticketPrice = selectedTicket ? selectedTicket.price || 0 : 0;
  const effectiveBasePrice = useMemo(() => {
    if (!selectedBundle) return ticketPrice;
    if (hasBundleTicket) {
      return selectedBundle.price;
    }
    // Merchandise-only bundle: combines standalone ticket admission price with bundle price
    return ticketPrice + selectedBundle.price;
  }, [selectedBundle, hasBundleTicket, ticketPrice]);

  const isPaymentRequired = useMemo(() => {
    const isTicketPaid =
      selectedTicket?.type === "paid" ||
      selectedTicket?.type === "commitment_fee" ||
      Boolean(selectedBundle && (selectedBundle.price ?? 0) > 0) ||
      (selectedTicket?.price ?? 0) > 0;
    const hasMerchToSell = Object.values(selectedMerch).some((m) => m.quantity > 0);
    return isTicketPaid || hasMerchToSell;
  }, [selectedTicket, selectedBundle, selectedMerch]);

  const questions: CustomQuestion[] = useMemo(() => {
    let base = Array.isArray(eventConfig.custom_questions) ? [...eventConfig.custom_questions] : [];

    // For Paid Pass, Paid Event, Commitment Fee Ticket, or Free Event with Merchandise:
    // Add default questions with section "Payment Details" that cannot be changed or removed by organizers.
    // NEVER override existing custom questions (like work_email or custom questions containing "email").
    if (isPaymentRequired) {
      const hasPaymentSection = base.some((q) => q.section === "Payment Details");

      if (!hasPaymentSection) {
        // Find if base had full_name, email, or whatsapp in another section
        const existingName = base.find((q) => q.id === "full_name");
        const existingEmail = base.find((q) => q.id === "email");
        const existingPhone = base.find(
          (q) =>
            q.id === "whatsapp" ||
            q.id === "phone" ||
            q.id === "whatsapp_number" ||
            q.id === "phone_number" ||
            q.label.toLowerCase().includes("whatsapp"),
        );

        const paymentQuestions: CustomQuestion[] = [
          {
            id: "full_name",
            label: existingName?.label || "Full Name",
            type: "text",
            required: true,
            placeholder: existingName?.placeholder || "e.g. John Doe",
            description: "Official attendee name for payment receipt, ticket pass issuance, and badge printing.",
            section: "Payment Details",
            locked: true,
            is_payment_required_field: true,
          },
          {
            id: "email",
            label: existingEmail?.label || "Email Address",
            type: "text",
            required: true,
            placeholder: existingEmail?.placeholder || "e.g. name@example.com",
            description: "Payment confirmation invoice, DOKU payment link, and e-ticket pass will be delivered here.",
            section: "Payment Details",
            validation_type: "isEmail",
            locked: true,
            is_payment_required_field: true,
          },
          {
            id: "whatsapp",
            label: existingPhone?.label || "WhatsApp Phone Number",
            type: "text",
            required: true,
            placeholder: existingPhone?.placeholder || "e.g. 628123444555",
            description: "Required for DOKU payment link dispatch, e-ticket issuance, and check-in QR coordination.",
            section: "Payment Details",
            validation_type: "isWhatsappNumber",
            locked: true,
            is_payment_required_field: true,
          },
        ];

        // Filter out redundant/duplicate full_name, primary email, or phone from other sections
        // while preserving work_email and other custom questions intact!
        const remaining = base.filter((q) => {
          if (q.id === "work_email") return true; // KEEP work_email untouched!
          if (
            q.id === "full_name" ||
            q.id === "email" ||
            q.id === "whatsapp" ||
            q.id === "phone" ||
            q.id === "whatsapp_number" ||
            q.id === "phone_number"
          ) {
            return false;
          }
          const lower = q.label.toLowerCase();
          if (lower === "full name" || lower === "email address" || lower === "email") {
            return false;
          }
          if (lower.includes("whatsapp")) {
            return false;
          }
          return true;
        });

        base = [...paymentQuestions, ...remaining];
      } else {
        // Ensure the Payment Details questions have locked: true and required: true
        base = base.map((q) => {
          if (q.section === "Payment Details") {
            return {
              ...q,
              required: true,
              locked: true,
              is_payment_required_field: true,
            };
          }
          return q;
        });
      }
    }

    return base;
  }, [eventConfig.custom_questions, isPaymentRequired]);

  // Voucher state
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<EventVoucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);

  // Referral state
  const [referralInput, setReferralInput] = useState("");
  const [appliedReferral, setAppliedReferral] = useState<{
    code: string;
    referrerId: string;
    referrerName: string;
    discountType?: "percentage" | "fixed";
    discountPercentage?: number;
    discountAmount?: number;
  } | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const [referralSettings, setReferralSettings] = useState<ReferralProgramSettings | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadReferralSettings() {
      try {
        const { getReferralProgramSettingsAction } = await import("@/lib/firestore/actions");
        const settings = await getReferralProgramSettingsAction();
        if (isMounted && settings) {
          setReferralSettings(settings);
        }
      } catch (err) {
        console.warn("[EventRegistrationModal] Failed to load referral settings:", err);
      }
    }
    void loadReferralSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const isReferralEnabled = useMemo(() => {
    if (event.referral_enabled === false) return false;
    if (!referralSettings) {
      return hasPaidPass;
    }
    if (!referralSettings.is_active) return false;
    if (referralSettings.excluded_event_ids?.includes(String(event.id))) return false;

    const condition = referralSettings.enabled_condition ?? "paid_events_only";
    if (condition === "all") return true;
    if (condition === "paid_events_only") return hasPaidPass;
    if (condition === "paid_tickets_only") {
      return effectiveBasePrice > 0;
    }
    return true;
  }, [event.referral_enabled, event.id, referralSettings, hasPaidPass, effectiveBasePrice]);

  // Remove applied referral if selection changes such that referral conditions are no longer met
  useEffect(() => {
    if (appliedReferral && !isReferralEnabled) {
      setAppliedReferral(null);
      setReferralError("Referral code removed as current selection does not meet referral conditions.");
    }
  }, [appliedReferral, isReferralEnabled]);

  // Auto-detect referral code from URL search parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get("ref");
      if (refParam && !appliedReferral && isReferralEnabled) {
        setReferralInput(refParam.toUpperCase());
      }
    }
  }, [appliedReferral, isReferralEnabled]);

  const totalMerchandiseItems = useMemo(() => {
    return Object.values(selectedMerch).reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [selectedMerch]);

  const maxMerchandiseAllowed = eventConfig.max_merchandise_per_person ?? null;

  const merchandiseTotalPrice = useMemo(() => {
    let total = 0;
    for (const [itemId, order] of Object.entries(selectedMerch)) {
      if (order.quantity > 0) {
        const item = availableMerchandise.find((m) => m.id === itemId);
        const isIncludedInTicket = Boolean(selectedTicket?.perks?.some((p) => p.merchandise_id === item?.id));
        const bundledRecord = selectedBundle?.merchandise_items.find((bi) => bi.merchandise_id === itemId);
        const bundledQty = bundledRecord?.quantity || 0;
        const billableQty = Math.max(0, order.quantity - bundledQty);

        if (item && !item.is_free && !isIncludedInTicket && billableQty > 0) {
          const unitPrice = getMerchEffectivePrice(item, order.selectedVariations);
          total += unitPrice * billableQty;
        }
      }
    }
    return total;
  }, [selectedMerch, availableMerchandise, selectedTicket, selectedBundle]);

  // Auto re-validate applied voucher when ticket or merchandise selection changes
  useEffect(() => {
    if (appliedVoucher) {
      const res = validateVoucherForCart(appliedVoucher, {
        ticketPrice: effectiveBasePrice,
        merchandiseTotal: merchandiseTotalPrice,
      });
      if (!res.isValid) {
        setAppliedVoucher(null);
        setVoucherError(res.error ?? "Voucher is no longer applicable to your selection.");
      }
    }
  }, [appliedVoucher, effectiveBasePrice, merchandiseTotalPrice]);

  const voucherDiscount = useMemo(() => {
    if (!appliedVoucher) {
      return { ticketDiscount: 0, merchandiseDiscount: 0, totalDiscount: 0 };
    }
    return calculateVoucherDiscount(appliedVoucher, {
      ticketPrice: effectiveBasePrice,
      merchandiseTotal: merchandiseTotalPrice,
    });
  }, [appliedVoucher, effectiveBasePrice, merchandiseTotalPrice]);

  // Calculate referral ticket discount
  const referralDiscount = useMemo(() => {
    if (!appliedReferral || effectiveBasePrice <= 0) {
      return 0;
    }
    if (appliedReferral.discountType === "fixed") {
      return Math.min(effectiveBasePrice, appliedReferral.discountAmount ?? 0);
    }
    const pct = appliedReferral.discountPercentage ?? 10;
    return Math.round((effectiveBasePrice * pct) / 100);
  }, [appliedReferral, effectiveBasePrice]);

  const rawSubtotal = effectiveBasePrice + merchandiseTotalPrice;
  const netSubtotal = Math.max(0, rawSubtotal - voucherDiscount.totalDiscount - referralDiscount);
  const gatewayFeeCalc = useMemo(() => {
    return calculatePaymentGatewayFee(netSubtotal, eventConfig);
  }, [netSubtotal, eventConfig]);
  const grandTotal = Math.max(0, netSubtotal + (gatewayFeeCalc.isPassedToAttendee ? gatewayFeeCalc.feeAmount : 0));

  const handleApplyVoucher = async () => {
    const cleanCode = voucherInput.trim().toUpperCase();
    if (!cleanCode) {
      setVoucherError("Please enter a voucher code.");
      return;
    }
    setIsApplyingVoucher(true);
    setVoucherError(null);
    try {
      const { validateVoucherAction } = await import("@/server/voucher-actions");
      const res = await validateVoucherAction({
        eventId: String(eventConfig.id),
        voucherCode: cleanCode,
        ticketPrice: effectiveBasePrice,
        merchandiseTotal: merchandiseTotalPrice,
        userEmail: user?.email,
      });

      if (!res.isValid || !res.voucher) {
        setVoucherError(res.error ?? `Voucher "${cleanCode}" is invalid or does not exist.`);
        return;
      }

      setAppliedVoucher(res.voucher as EventVoucher);
      setVoucherError(null);
      toast.success(
        `Voucher "${res.voucher.code}" applied! Saved Rp ${(res.totalDiscount ?? 0).toLocaleString("id-ID")}.`,
      );
    } catch (err) {
      console.error("[EventRegistrationModal] Error validating voucher:", err);
      setVoucherError("Failed to validate voucher. Please try again.");
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput("");
    setVoucherError(null);
    toast.info("Voucher removed.");
  };

  const handleApplyReferral = async () => {
    const cleanCode = referralInput.trim().toUpperCase();
    if (!cleanCode) {
      setReferralError("Please enter a referral code.");
      return;
    }
    if (!user) {
      setReferralError("Please sign in with Google to apply a referral code.");
      return;
    }
    setIsValidatingReferral(true);
    setReferralError(null);
    try {
      const { validateReferralCodeAction } = await import("@/lib/firestore/actions");
      const res = await validateReferralCodeAction(
        cleanCode,
        user.id,
        user.email,
        String(event.id),
        effectiveBasePrice,
      );
      if (!res.valid) {
        setReferralError(res.error || "Invalid referral code.");
        return;
      }
      setAppliedReferral({
        code: cleanCode,
        referrerId: res.referrer?.id || "",
        referrerName: res.referrer?.name || "Community Member",
        discountType: res.discountType,
        discountPercentage: res.discountPercentage,
        discountAmount: res.discountAmount,
      });
      setReferralError(null);
      if (res.discountType === "fixed") {
        toast.success(
          `Referral code "${cleanCode}" applied! Enjoy Rp ${(res.discountAmount ?? 0).toLocaleString("id-ID")} off your ticket.`,
        );
      } else {
        toast.success(`Referral code "${cleanCode}" applied! Enjoy ${res.discountPercentage ?? 10}% off your ticket.`);
      }
    } catch {
      setReferralError("Failed to validate referral code. Please try again.");
    } finally {
      setIsValidatingReferral(false);
    }
  };

  const handleRemoveReferral = () => {
    setAppliedReferral(null);
    setReferralInput("");
    setReferralError(null);
    toast.info("Referral code removed.");
  };

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
        const salesStatus = getMerchandiseSalesStatus(item, effectiveNow);
        if (!salesStatus.isOpen) {
          toast.error(salesStatus.message ?? `"${item.name}" is not open for purchase.`);
          return prev;
        }

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
        // Stock quota check (variation-specific quota or item-level quota)
        let maxStock = item.stock ?? null;
        if (current.selectedVariations && item.variations) {
          for (const v of item.variations) {
            const selectedOpt = current.selectedVariations[v.name];
            if (
              selectedOpt &&
              v.option_details?.[selectedOpt]?.stock !== undefined &&
              v.option_details[selectedOpt].stock !== null
            ) {
              maxStock = v.option_details[selectedOpt].stock;
            }
          }
        }
        if (maxStock !== null && current.quantity >= maxStock) {
          toast.error(`Only ${maxStock} item(s) available in stock.`);
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

  const handleProceedToForm = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

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
    if (hasSessions) {
      if (!selectedSessionId) {
        toast.error("Please choose a session track to attend.");
        return;
      }
      const matchingSession = eventConfig.sessions?.find((s) => s.id === selectedSessionId);
      if (!matchingSession) {
        toast.error("Selected session track is not valid.");
        return;
      }
    }

    // 2. Validate Ticket Tier Selection
    if (hasTickets) {
      if (!selectedTicket) {
        toast.error("Please choose an available ticket tier to attend.");
        return;
      }
      if (selectedBundle) {
        const bundleSales = getBundleSalesStatus(selectedBundle, effectiveNow);
        if (!bundleSales.isAvailable) {
          toast.error(
            `The bundling package "${selectedBundle.name}" is currently not available (${bundleSales.badgeLabel}).`,
          );
          return;
        }
        if (!hasBundleTicket) {
          const ticketSales = getTicketSalesStatus(selectedTicket, effectiveNow);
          if (!ticketSales.isOpen) {
            toast.error(
              ticketSales.message ??
                `The ticket tier "${selectedTicket.name}" is currently not available for selection (${ticketSales.badgeLabel}).`,
            );
            return;
          }
        }
      } else {
        const ticketSales = getTicketSalesStatus(selectedTicket, effectiveNow);
        if (!ticketSales.isOpen) {
          toast.error(
            ticketSales.message ??
              `The ticket tier "${selectedTicket.name}" is currently not available for selection (${ticketSales.badgeLabel}).`,
          );
          return;
        }
      }
    }

    // 3. Validate Venue & Session Capacity before proceeding
    const capacityValidation = validateRegistrationSubmissionCapacity({
      event: eventConfig,
      selectedSessionId: hasSessions ? selectedSessionId : undefined,
      selectedTicketId: hasTickets ? selectedTicketId : undefined,
      existingRegistrationCount: eventConfig.total_registrations,
    });

    if (!capacityValidation.allowed) {
      setCapacityAlert({
        open: true,
        title: capacityValidation.title,
        message: capacityValidation.message,
        reason: capacityValidation.reason,
        sessionTitle: capacityValidation.session?.title,
        currentCount:
          capacityValidation.reason === "venue_full"
            ? capacityValidation.venue.currentCount
            : (capacityValidation.session?.currentCount ?? capacityValidation.venue.currentCount),
        maxCapacity:
          capacityValidation.reason === "venue_full"
            ? (capacityValidation.venue.capacity ?? undefined)
            : (capacityValidation.session?.capacity ?? capacityValidation.venue.capacity ?? undefined),
      });
      toast.error(capacityValidation.title);
      return;
    }

    setRegistrationStep("form");
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (registrationStep !== "form") {
      return;
    }

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
    if (hasSessions) {
      if (!selectedSessionId) {
        toast.error("Please choose a session track to attend.");
        setRegistrationStep("tickets");
        return;
      }
      if (!selectedSession) {
        toast.error("Selected session track is not valid.");
        setRegistrationStep("tickets");
        return;
      }
    }

    if (hasTickets) {
      if (!selectedTicket) {
        toast.error("Please choose an available ticket tier to attend.");
        setRegistrationStep("tickets");
        return;
      }
      if (selectedBundle) {
        const bundleSales = getBundleSalesStatus(selectedBundle, effectiveNow);
        if (!bundleSales.isAvailable) {
          toast.error(
            `The bundling package "${selectedBundle.name}" is currently not available (${bundleSales.badgeLabel}).`,
          );
          setRegistrationStep("tickets");
          return;
        }
        if (!hasBundleTicket) {
          const ticketSales = getTicketSalesStatus(selectedTicket, effectiveNow);
          if (!ticketSales.isOpen) {
            toast.error(
              ticketSales.message ??
                `The ticket tier "${selectedTicket.name}" is currently not available for selection (${ticketSales.badgeLabel}).`,
            );
            setRegistrationStep("tickets");
            return;
          }
        }
      } else {
        const ticketSales = getTicketSalesStatus(selectedTicket, effectiveNow);
        if (!ticketSales.isOpen) {
          toast.error(
            ticketSales.message ??
              `The ticket tier "${selectedTicket.name}" is currently not available for selection (${ticketSales.badgeLabel}).`,
          );
          setRegistrationStep("tickets");
          return;
        }
      }
    }

    // 2. Validate Venue & Session Capacity before submitting registration form
    const capacityValidation = validateRegistrationSubmissionCapacity({
      event: eventConfig,
      selectedSessionId: hasSessions ? selectedSessionId : undefined,
      selectedTicketId: hasTickets ? selectedTicketId : undefined,
      existingRegistrationCount: eventConfig.total_registrations,
    });

    if (!capacityValidation.allowed) {
      setCapacityAlert({
        open: true,
        title: capacityValidation.title,
        message: capacityValidation.message,
        reason: capacityValidation.reason,
        sessionTitle: capacityValidation.session?.title,
        currentCount:
          capacityValidation.reason === "venue_full"
            ? capacityValidation.venue.currentCount
            : (capacityValidation.session?.currentCount ?? capacityValidation.venue.currentCount),
        maxCapacity:
          capacityValidation.reason === "venue_full"
            ? (capacityValidation.venue.capacity ?? undefined)
            : (capacityValidation.session?.capacity ?? capacityValidation.venue.capacity ?? undefined),
      });
      toast.error(capacityValidation.title);
      return;
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
      let createdRegistrationId: string | null = null;
      let targetAttendeeEmail: string | undefined = user.email;
      try {
        const isWaitlistMode = Boolean(
          capacityValidation.isWaitlist ??
            (eventConfig.allow_waitlist !== false && checkEventCapacityStatus(eventConfig).isFull),
        );
        const isCurated = isEventCurationMode(eventConfig);

        const sessionKey = selectedSession?.title ?? (eventConfig.default_session_name?.trim() || "Full Session");
        const combinedAnswers = {
          ...answers,
          Session: sessionKey,
        };

        const selectedMerchOrders: SelectedMerchandiseOrder[] = [];
        for (const [itemId, order] of Object.entries(selectedMerch)) {
          if (order.quantity > 0) {
            const item = availableMerchandise.find((m) => m.id === itemId);
            if (item) {
              const salesStatus = getMerchandiseSalesStatus(item, effectiveNow);
              const unitPrice = getMerchEffectivePrice(item, order.selectedVariations);
              const isIncludedInTicket = Boolean(selectedTicket?.perks?.some((p) => p.merchandise_id === item.id));
              const bundledRecord = selectedBundle?.merchandise_items.find((bi) => bi.merchandise_id === item.id);
              const isCoveredByBundle = Boolean(bundledRecord && order.quantity <= bundledRecord.quantity);

              if (!isCoveredByBundle && !salesStatus.isOpen) {
                toast.error(salesStatus.message ?? `Merchandise "${item.name}" is not open for purchase.`);
                return;
              }

              selectedMerchOrders.push({
                id: item.id,
                name: item.name,
                quantity: order.quantity,
                price: item.is_free || isIncludedInTicket || isCoveredByBundle ? 0 : unitPrice,
                selected_variations:
                  Object.keys(order.selectedVariations).length > 0 ? order.selectedVariations : undefined,
              });
            }
          }
        }

        const cachedImg =
          extractEventImageUrl(eventConfig as unknown as Record<string, unknown>) ??
          extractEventImageUrl(event as unknown as Record<string, unknown>);

        const attendeeEmail =
          ((combinedAnswers as Record<string, unknown>).email as string) ||
          ((combinedAnswers as Record<string, unknown>).work_email as string) ||
          user.email;
        targetAttendeeEmail = attendeeEmail;
        const attendeeName =
          ((combinedAnswers as Record<string, unknown>).full_name as string) ||
          ((combinedAnswers as Record<string, unknown>).name as string) ||
          user.name;
        const attendeePhone = extractCustomerPhone({}, combinedAnswers);

        const regCandidate: Partial<FirestoreRegistration> = {
          event_id: String(event.id),
          event_title: event.title,
          member_name: attendeeName,
          member_email: attendeeEmail,
          member_phone: attendeePhone,
          answers: combinedAnswers,
          ticket_id: selectedTicket?.id,
          ticket_name: selectedTicket?.name,
          ticket_price: hasBundleTicket ? 0 : selectedTicket?.price,
          ticket_type: selectedTicket?.type,
          bundle_id: selectedBundle?.id,
          bundle_name: selectedBundle?.name,
          bundle_price: selectedBundle ? selectedBundle.price : undefined,
          selected_merchandise: selectedMerchOrders.length > 0 ? selectedMerchOrders : undefined,
          payment_amount: grandTotal,
          payment_subtotal_amount: netSubtotal,
          payment_fee_amount: gatewayFeeCalc.feeAmount,
          payment_fee_bearer: gatewayFeeCalc.feeBearer,
          voucher_id: appliedVoucher?.id,
          voucher_code: appliedVoucher?.code,
          voucher_discount_amount: voucherDiscount.totalDiscount > 0 ? voucherDiscount.totalDiscount : undefined,
          voucher_discount_type: appliedVoucher?.discount_type,
          voucher_discount_value: appliedVoucher?.discount_value,
          voucher_applies_to: appliedVoucher?.applies_to,
          referral_code: appliedReferral?.code,
          referrer_member_id: appliedReferral?.referrerId,
          referrer_name: appliedReferral?.referrerName,
          referral_discount_type: appliedReferral?.discountType,
          referral_discount_percent: appliedReferral?.discountPercentage,
          referral_discount_amount: referralDiscount > 0 ? referralDiscount : undefined,
        };

        const isTicketPaid =
          selectedTicket?.type === "paid" ||
          selectedTicket?.type === "commitment_fee" ||
          Boolean(selectedBundle && (selectedBundle.price ?? 0) > 0) ||
          (selectedTicket?.price ?? 0) > 0;
        const hasMerchandiseToSell = selectedMerchOrders.some((m) => (m.price ?? 0) > 0);
        const requiresPayment =
          grandTotal > 0 && (isTicketPaid || hasMerchandiseToSell || hasRegistrationPaymentRequirements(regCandidate));

        // On Paid Pass ticket or any merchandise purchase, ensure that name, email, and phone are required
        if (requiresPayment) {
          if (!attendeePhone || attendeePhone.trim().length === 0) {
            toast.error("WhatsApp Phone Number is required to generate payment link.");
            return;
          }
          if (!attendeeName || attendeeName.trim().length === 0) {
            toast.error("Full Name is required for pass and payment issuance.");
            return;
          }
          if (!attendeeEmail || attendeeEmail.trim().length === 0) {
            toast.error("Email Address is required to dispatch the payment link.");
            return;
          }
        }

        // Enforce conditions on form submission:
        // - If event ticket is free:
        //   -- If curation active: pending review (send interest email via webhook)
        //   -- If no curation: approved (call Add Bevy Attendee API directly)
        // - If event ticket is paid or free but has merch to sell:
        //   -- If curation active: pending review (send interest email via webhook, defer payment link until approval)
        //   -- If no curation: waiting_for_payment (call API Payment Link immediately)
        let initialStatus: RegistrationStatus = "pending";
        if (isWaitlistMode) {
          initialStatus = "waitlisted";
        } else if (requiresPayment) {
          initialStatus = isCurated ? "pending" : "waiting_for_payment";
        } else {
          initialStatus = isCurated ? "pending" : "approved";
        }

        // If cancelling & re-registering (or a previous registration exists), execute Cancel Registration flow
        // FIRST (call Bevy Remove Attendee API, cancel DOKU order, send cancel email, delete prior registration)
        // BEFORE submitting new registration data.
        const priorReg =
          activeRegistration ?? (await checkEventRegistrationAction(String(event.id), user.id, attendeeEmail));
        let preservedRefundHistory: NonNullable<FirestoreRegistration["refund_history"]> = [];

        if (priorReg) {
          const priorEmail = (priorReg.member_email || attendeeEmail || user.email).toLowerCase().trim();
          const priorName = priorReg.member_name || attendeeName || user.name || "Attendee";
          const eventIdStr = String(event.id);

          const combinedRefunds = [
            ...(priorReg.refund_history ?? []),
            ...(priorReg.refund_request ? [priorReg.refund_request] : []),
          ];
          const seenRefundKeys = new Set<string>();
          preservedRefundHistory = combinedRefunds.filter((r) => {
            const key = `${r.requested_at}_${r.status}_${r.refund_amount}`;
            if (seenRefundKeys.has(key)) return false;
            seenRefundKeys.add(key);
            return true;
          });

          // 1. Call remove attendee Bevy API BEFORE removing it from the dashboard & submitting new data
          const { removeAttendeeFromBevyAction } = await import("@/server/bevy-actions");
          const bevyRes = await removeAttendeeFromBevyAction({
            eventId: eventIdStr,
            attendeeId: priorReg.bevy_attendee_id,
            attendeeEmail: priorEmail,
          });
          if (!bevyRes.success) {
            console.warn("[Registration Modal] Warning while removing previous attendee from Bevy:", bevyRes.error);
          }

          // 2. Cancel active unexpired DOKU payment order if present
          const { shouldCancelPaymentOrder } = await import("@/lib/events/payment-deadline");
          if (shouldCancelPaymentOrder(priorReg, eventConfig)) {
            try {
              const { cancelPaymentLinkAction } = await import("@/server/payment-actions");
              const { buildCancelPaymentPayload } = await import("@/lib/events/doku-payment");
              const cancelRes = await cancelPaymentLinkAction(
                buildCancelPaymentPayload(priorReg, eventConfig, "Attendee cancelled RSVP"),
              );
              if (!cancelRes.success) {
                console.warn("[Registration Modal] DOKU order cancellation warning:", cancelRes.error);
              }
            } catch (payCancelErr) {
              console.warn("[Registration Modal] Failed to cancel previous DOKU order:", payCancelErr);
            }
          }

          // 3. Send attendee cancellation email notification via webhook API
          const { sendAttendeeCancelEmailAction } = await import("@/server/email-template-actions");
          const cancelEmailRes = await sendAttendeeCancelEmailAction({
            registrationId: priorReg.id,
            eventId: eventIdStr,
            attendeeName: priorName,
            attendeeEmail: priorEmail,
            eventData: eventConfig,
          });
          if (!cancelEmailRes.success) {
            toast.error(cancelEmailRes.error ?? "Failed to send cancellation email. Registration was not cancelled.");
            return;
          }

          // 4. Delete previous registration from Firestore & recalculate capacity counters before submitting new data
          const deleteRes = await deleteEventRegistrationAction(
            priorReg.id,
            eventIdStr,
            priorReg.bevy_attendee_id,
            priorEmail,
            priorReg,
            { skipBevyRemoval: true, skipPaymentCancel: true },
          );
          if (!deleteRes.success) {
            toast.error(deleteRes.error ?? "Failed to remove previous event registration.");
            return;
          }
        } else if (allowReRegister) {
          const { removeAttendeeFromBevyAction } = await import("@/server/bevy-actions");
          const bevyRes = await removeAttendeeFromBevyAction({
            eventId: String(event.id),
            attendeeEmail: (attendeeEmail || user.email).toLowerCase().trim(),
          });
          if (!bevyRes.success) {
            console.warn("[Registration Modal] Warning while removing attendee from Bevy:", bevyRes.error);
          }
        }

        // For non-curated events with payable items, generate DOKU payment link immediately upon registration.
        // For curated events and waitlisted applicants, payment link generation is deferred until organizer approval.
        let generatedPaymentUrl: string | undefined;
        let generatedInvoiceNumber: string | undefined;
        let generatedRequestId: string | undefined;
        let generatedPaymentAmount: number | undefined;
        let generatedExpiredDatetime: string | undefined;

        if (!isWaitlistMode && !isCurated && requiresPayment) {
          try {
            const paymentPayload = buildRegistrationPaymentPayload(regCandidate, eventConfig, {
              sendEmail: true,
            });
            const payRes = await generatePaymentLinkAction(paymentPayload);
            if (payRes.success && payRes.paymentUrl) {
              generatedPaymentUrl = payRes.paymentUrl;
              generatedInvoiceNumber = payRes.invoiceNumber;
              generatedRequestId = payRes.requestId;
              generatedPaymentAmount = payRes.amount;
              generatedExpiredDatetime = payRes.expiredDatetime;
            } else {
              const errorMsg = payRes.error ?? "Failed to generate payment link via DOKU.";
              console.warn("[Registration Modal] Failed to generate payment link:", errorMsg);
              toast.error(`Payment gateway error: ${errorMsg}. Registration cancelled.`);
              return;
            }
          } catch (payErr) {
            const errorMsg = payErr instanceof Error ? payErr.message : "Payment link generation error";
            console.warn("[Registration Modal] Payment link generation error:", errorMsg);
            toast.error(`Payment gateway error: ${errorMsg}. Registration cancelled.`);
            return;
          }
        }

        const registrationPayload: Omit<FirestoreRegistration, "id"> = {
          event_id: String(event.id),
          event_title: event.title,
          event_picture_url: cachedImg ?? undefined,
          event_banner_url: eventConfig.banner_url ?? event.banner_url ?? cachedImg ?? undefined,
          member_id: user.id,
          member_name: attendeeName,
          member_email: attendeeEmail,
          member_phone: attendeePhone,
          member_avatar: user.avatar,
          member_role: user.role,
          status: initialStatus,
          answers: combinedAnswers,
          session_id: selectedSession?.id,
          session_title: selectedSession?.title ?? sessionKey,
          ticket_id: selectedTicket?.id,
          ticket_name: selectedTicket?.name,
          ticket_type: selectedTicket?.type,
          ticket_price: hasBundleTicket ? 0 : selectedTicket?.price,
          bundle_id: selectedBundle?.id,
          bundle_name: selectedBundle?.name,
          bundle_price: selectedBundle ? selectedBundle.price : undefined,
          selected_merchandise: selectedMerchOrders.length > 0 ? selectedMerchOrders : undefined,
          voucher_id: appliedVoucher?.id,
          voucher_code: appliedVoucher?.code,
          voucher_discount_amount: voucherDiscount.totalDiscount > 0 ? voucherDiscount.totalDiscount : undefined,
          voucher_discount_type: appliedVoucher?.discount_type,
          voucher_discount_value: appliedVoucher?.discount_value,
          voucher_applies_to: appliedVoucher?.applies_to,
          referral_code: appliedReferral?.code,
          referrer_member_id: appliedReferral?.referrerId,
          referrer_name: appliedReferral?.referrerName,
          referral_discount_type: appliedReferral?.discountType,
          referral_discount_percent: appliedReferral?.discountPercentage,
          referral_discount_amount: referralDiscount > 0 ? referralDiscount : undefined,
          registered_at: new Date(effectiveNow).toISOString(),
          payment_status: !isWaitlistMode && requiresPayment ? "unpaid" : undefined,
          payment_url: isWaitlistMode ? undefined : generatedPaymentUrl,
          payment_invoice_number: isWaitlistMode ? undefined : generatedInvoiceNumber,
          payment_request_id: isWaitlistMode ? undefined : generatedRequestId,
          payment_amount: isWaitlistMode ? undefined : (generatedPaymentAmount ?? (requiresPayment ? grandTotal : 0)),
          payment_expired_datetime: isWaitlistMode ? undefined : generatedExpiredDatetime,
          payment_fee_amount: isWaitlistMode ? undefined : requiresPayment ? gatewayFeeCalc.feeAmount : undefined,
          payment_fee_bearer: isWaitlistMode ? undefined : requiresPayment ? gatewayFeeCalc.feeBearer : undefined,
          payment_subtotal_amount: isWaitlistMode ? undefined : requiresPayment ? netSubtotal : undefined,
          refund_history: preservedRefundHistory.length > 0 ? preservedRefundHistory : undefined,
        };

        const rollbackRegistration = async (regId?: string | null) => {
          if (!regId) return;
          try {
            await deleteEventRegistrationAction(regId, String(event.id), undefined, targetAttendeeEmail);
          } catch (rbErr) {
            console.warn("[Registration Modal] Failed to rollback registration:", rbErr);
          }
        };

        const result = await registerForEventAction(registrationPayload);

        if (!result.success || !result.registrationId) {
          toast.error(result.error || "Failed to register. Please try again.");
          return;
        }

        createdRegistrationId = result.registrationId;

        // If the event ticket is free and no curation: call Add Bevy Attendee API directly!
        if (!isWaitlistMode && !isCurated && !requiresPayment) {
          try {
            const approvePayload = buildApprovedAttendeePayload(
              {
                ...registrationPayload,
                id: createdRegistrationId,
              } as FirestoreRegistration,
              eventConfig,
            );
            const approveRes = await approveAttendeeWebhookAction(approvePayload);
            if (!approveRes.success) {
              console.error("[Registration Modal] Add Bevy Attendee API error:", approveRes.error);
              await rollbackRegistration(createdRegistrationId);
              createdRegistrationId = null;
              setLocalReg(null);
              toast.error(
                `Registration automation failed: ${approveRes.error ?? "Failed to issue ticket and confirmation email"}. Registration cancelled.`,
              );
              return;
            }
          } catch (approveErr) {
            console.error("[Registration Modal] Add Bevy Attendee API error:", approveErr);
            await rollbackRegistration(createdRegistrationId);
            createdRegistrationId = null;
            setLocalReg(null);
            const errMsg =
              approveErr instanceof Error ? approveErr.message : "Failed to complete automated registration workflow";
            toast.error(`Registration automation error: ${errMsg}. Registration cancelled.`);
            return;
          }
        }

        // Dispatch Webhook / Curation Interest Email
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
            default_session_name: eventConfig.default_session_name ?? undefined,
            default_session_time: eventConfig.default_session_time ?? undefined,
            default_session_checkin_deadline: eventConfig.default_session_checkin_deadline ?? undefined,
            default_session_location: eventConfig.default_session_location ?? undefined,
            default_session_location_url: eventConfig.default_session_location_url ?? undefined,
          },
          registration: {
            id: createdRegistrationId,
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
            payment_url: generatedPaymentUrl,
            payment_amount: generatedPaymentAmount ?? (requiresPayment ? grandTotal : 0),
            voucher_code: appliedVoucher?.code,
            voucher_discount_amount: voucherDiscount.totalDiscount > 0 ? voucherDiscount.totalDiscount : undefined,
          },
          member: {
            id: user.id,
            name: user.name,
            email: attendeeEmail,
            role: user.role,
            avatar: user.avatar,
          },
          answers: combinedAnswers,
          timestamp: new Date().toISOString(),
        };

        try {
          const webhookResult = await dispatchRegistrationWebhookAction(webhookPayload);
          if (!webhookResult.success) {
            console.error("[Registration Modal] Webhook / email workflow error:", webhookResult.error);
            await rollbackRegistration(createdRegistrationId);
            createdRegistrationId = null;
            setLocalReg(null);
            const errText = webhookResult.error ?? "Failed to process email automation workflow.";
            toast.error(`Automation error: ${errText}. Registration cancelled.`);
            return;
          }
        } catch (webhookErr) {
          console.error("[Registration Modal] Webhook dispatch error:", webhookErr);
          await rollbackRegistration(createdRegistrationId);
          createdRegistrationId = null;
          setLocalReg(null);
          const errMsg = webhookErr instanceof Error ? webhookErr.message : "Failed to process registration workflow.";
          toast.error(`Automation error: ${errMsg}. Registration cancelled.`);
          return;
        }

        if (isWaitlistMode) {
          toast.success("Added to waitlist! Organizers will review and notify you if a spot opens up.");
        } else if (!isCurated && requiresPayment) {
          if (!generatedPaymentUrl) {
            toast.success("Registration submitted! Status: Waiting for Payment.");
          }
        } else if (isCurated && requiresPayment) {
          toast.success(
            "Registration submitted! Your application is pending organizer review. Payment instructions will be sent upon approval.",
            { duration: 6000 },
          );
        } else if (isCurated) {
          toast.success("Registration submitted! Your application is now pending organizer review.", {
            duration: 5000,
          });
        } else {
          toast.success("Registration confirmed! See you at the event!", {
            duration: 5000,
          });
        }

        const newReg: FirestoreRegistration = {
          id: createdRegistrationId,
          event_id: String(event.id),
          event_title: event.title,
          member_id: user?.id || "",
          member_name: user?.name || "Attendee",
          member_email: attendeeEmail,
          status: initialStatus,
          registered_at: new Date(effectiveNow).toISOString(),
          answers: combinedAnswers,
          session_id: selectedSession?.id,
          session_title: selectedSession?.title,
          ticket_id: selectedTicket?.id,
          ticket_name: selectedTicket?.name,
          ticket_type: selectedTicket?.type,
          ticket_price: hasBundleTicket ? 0 : selectedTicket?.price,
          bundle_id: selectedBundle?.id,
          bundle_name: selectedBundle?.name,
          bundle_price: selectedBundle ? selectedBundle.price : undefined,
          selected_merchandise: selectedMerchOrders.length > 0 ? selectedMerchOrders : undefined,
          payment_status: requiresPayment ? "unpaid" : undefined,
          payment_url: generatedPaymentUrl,
          payment_invoice_number: generatedInvoiceNumber,
          payment_request_id: generatedRequestId,
          payment_amount: generatedPaymentAmount ?? (requiresPayment ? grandTotal : 0),
          payment_expired_datetime: generatedExpiredDatetime,
          payment_fee_amount: requiresPayment ? gatewayFeeCalc.feeAmount : undefined,
          payment_fee_bearer: requiresPayment ? gatewayFeeCalc.feeBearer : undefined,
          payment_subtotal_amount: requiresPayment ? netSubtotal : undefined,
          refund_history: preservedRefundHistory.length > 0 ? preservedRefundHistory : undefined,
        };

        setIsTransitioning(true);
        setLocalReg(newReg);
        onSuccess?.(newReg);
        setTimeout(() => setIsTransitioning(false), 1500);

        if (!isCurated && generatedPaymentUrl) {
          toast.success("Registration submitted! Opening secure DOKU payment checkout in a new tab...", {
            duration: 5000,
          });
          setOpen(false);
          router.refresh();
          window.open(generatedPaymentUrl, "_blank", "noopener,noreferrer");
          return;
        }

        setOpen(false);
        router.refresh();
      } catch (err) {
        if (createdRegistrationId) {
          try {
            await deleteEventRegistrationAction(
              createdRegistrationId,
              String(event.id),
              undefined,
              targetAttendeeEmail,
            );
          } catch (delErr) {
            console.warn("[Registration Modal] Failed to rollback registration on exception:", delErr);
          }
          setLocalReg(null);
        }
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

  const isRegCanceled = Boolean(
    activeRegistration &&
      (activeRegistration.status.toLowerCase() === "canceled" ||
        activeRegistration.status.toLowerCase() === "cancelled" ||
        activeRegistration.refund_request?.status === "refund_completed"),
  );

  if (activeRegistration && !isRegCanceled && !allowReRegister) {
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

    const isUnpaid =
      (activeRegistration.payment_status === "unpaid" || activeRegistration.status === "waiting_for_payment") &&
      Boolean(activeRegistration.payment_url);
    if (isUnpaid) {
      return (
        <a
          href={activeRegistration.payment_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("inline-block", isFullWidth && "w-full")}
        >
          <Button
            type="button"
            variant="default"
            size={buttonSize}
            className={cn(
              "gap-2 bg-amber-600 font-medium text-white shadow-xs hover:bg-amber-700",
              isFullWidth && "w-full",
              className,
            )}
          >
            <CreditCard className={buttonSize === "lg" ? "size-4" : "size-3.5"} />
            <span>Complete Payment</span>
          </Button>
        </a>
      );
    }

    const statusLower = activeRegistration.status.toLowerCase();
    const isPaid = statusLower === "paid_and_registered";
    const isApproved =
      statusLower === "approved" || statusLower === "registered" || statusLower === "attended" || isPaid;
    const isPendingReview = statusLower === "pending";
    const isWaitingPayment = statusLower === "waiting_for_payment";
    const isWaitlisted = statusLower === "waitlisted";
    let statusLabel = "Registered";
    if (isPaid) {
      statusLabel = "Paid & Registered";
    } else if (isApproved) {
      statusLabel = isEventCurationMode(eventConfig) ? "Registered (Approved)" : "Registered";
    } else if (isWaitlisted) {
      statusLabel = "Waitlisted";
    } else if (isWaitingPayment) {
      statusLabel = "Waiting for Payment";
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
          isApproved &&
            "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300",
          isWaitlisted &&
            "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300",
          (isPendingReview || isWaitingPayment) &&
            "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300",
          isTransitioning && "fade-in-50 zoom-in-95 scale-[1.01] animate-in ring-2 ring-emerald-500/40",
          isFullWidth && "w-full",
          className,
        )}
      >
        {(() => {
          if (isWaitlisted) {
            return (
              <Clock
                className={cn(
                  "relative z-10 shrink-0 text-blue-600 transition-transform duration-500 dark:text-blue-400",
                  buttonSize === "lg" ? "size-4" : "size-3.5",
                  isTransitioning && "scale-110",
                )}
              />
            );
          }
          if (isWaitingPayment) {
            return (
              <CreditCard
                className={cn(
                  "relative z-10 shrink-0 text-amber-600 transition-transform duration-500 dark:text-amber-400",
                  buttonSize === "lg" ? "size-4" : "size-3.5",
                  isTransitioning && "scale-110",
                )}
              />
            );
          }
          return (
            <CheckCircle2
              className={cn(
                "relative z-10 shrink-0 transition-transform duration-500",
                buttonSize === "lg" ? "size-4" : "size-3.5",
                isApproved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                isTransitioning && "scale-110",
              )}
            />
          );
        })()}
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

  // Plain computations (not hooks): this code runs after conditional early returns above,
  // so hooks here would violate the Rules of Hooks.
  const selectedSessionForCapacity = selectedSessionId
    ? eventConfig.sessions?.find((s) => s.id === selectedSessionId)
    : undefined;
  const isSelectedSessionFull = Boolean(
    selectedSessionForCapacity &&
      selectedSessionForCapacity.capacity > 0 &&
      (selectedSessionForCapacity.total_registered ?? 0) >= selectedSessionForCapacity.capacity,
  );

  const selectedTicketForCapacity = selectedTicketId
    ? eventConfig.tickets?.find((tick) => tick.id === selectedTicketId)
    : undefined;
  const isSelectedTicketFull = Boolean(
    selectedTicketForCapacity &&
      typeof selectedTicketForCapacity.capacity === "number" &&
      selectedTicketForCapacity.capacity > 0 &&
      (selectedTicketForCapacity.total_registered ?? 0) >= selectedTicketForCapacity.capacity,
  );

  const isWaitlistActive = Boolean(
    windowStatus.isWaitlist ??
      ((isSelectedSessionFull || isSelectedTicketFull) && eventConfig.allow_waitlist !== false),
  );

  let modalDescription = "Complete the registration questionnaire to confirm your RSVP and reserve your spot.";
  if (!user) {
    modalDescription =
      "GDG Jakarta events are open to our chapter members. Please join the community first by signing in with your Google account.";
  } else if (registrationStep === "tickets") {
    modalDescription =
      "Choose your pass, session track, and any optional event merchandise before proceeding to the registration form.";
  } else if (isWaitlistActive) {
    modalDescription =
      "This event has reached capacity. Complete this questionnaire to join the waitlist. You will be notified if a spot opens up.";
  } else if (eventConfig.requires_approval || event.requires_approval) {
    modalDescription =
      "This event is curated. Please complete your registration details for organizer review. After submitting, your attendee status will be Pending Review until approved.";
  }

  let footerSummaryBadge = <span className="text-muted-foreground text-xs">Free Registration</span>;
  if (grandTotal > 0) {
    footerSummaryBadge = (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-muted-foreground text-xs">Total:</span>
        <span className="font-bold font-mono text-foreground text-sm">Rp {grandTotal.toLocaleString("id-ID")}</span>
      </div>
    );
  } else if (selectedTicket) {
    footerSummaryBadge = (
      <Badge
        variant="outline"
        className="h-auto max-w-full whitespace-normal break-words border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs dark:text-emerald-400 py-0.5 px-2 text-left"
      >
        <span className="break-words">{selectedTicket.name} • Free RSVP</span>
      </Badge>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children || (
            <Button size="sm" className="gap-1.5">
              {!user && (
                <>
                  <Image src={googleFavicon} alt="Google" width={16} height={16} className="size-3.5 object-contain" />
                  {windowStatus.isWaitlist ? "Join Community to Join Waitlist" : "Join Community to Register"}
                </>
              )}
              {Boolean(user && windowStatus.isWaitlist) && (
                <>
                  <Clock className="size-3.5" />
                  Join Waitlist
                </>
              )}
              {Boolean(user && !windowStatus.isWaitlist) && (
                <>
                  <Sparkles className="size-3.5" />
                  Register for Event
                </>
              )}
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <div className="shrink-0 border-b bg-muted/20 px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {resolveEventAudience(event.audience_type, event.is_virtual).label}
                </Badge>
                {isWaitlistActive && (
                  <Badge
                    variant="secondary"
                    className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300"
                  >
                    Waitlist Registration
                  </Badge>
                )}
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
              <DialogTitle className="text-xl leading-snug break-words">{event.title}</DialogTitle>
              <DialogDescription className="text-xs break-words">{modalDescription}</DialogDescription>

              {/* 2-Step Flow Indicator when user is logged in */}
              {user && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setRegistrationStep("tickets")}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs transition-all sm:px-3",
                      registrationStep === "tickets"
                        ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                        : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full font-bold text-[10px]",
                        registrationStep === "tickets"
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground",
                      )}
                    >
                      1
                    </span>
                    <span>1. Tickets & Perks</span>
                  </button>

                  <span className="text-muted-foreground/40 text-xs">→</span>

                  <button
                    type="button"
                    onClick={(e) => {
                      if (registrationStep === "tickets") {
                        handleProceedToForm(e);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs transition-all sm:px-3",
                      registrationStep === "form"
                        ? "cursor-default bg-primary font-semibold text-primary-foreground shadow-xs"
                        : "cursor-pointer bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full font-bold text-[10px]",
                        registrationStep === "form"
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground",
                      )}
                    >
                      2
                    </span>
                    <span>2. Registration Form</span>
                  </button>
                </div>
              )}
            </DialogHeader>
          </div>

          {!user ? (
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-6 text-center sm:px-6">
              {/* Header / Avatar / GDG Branding */}
              <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-xs">
                <GdgLogo size={36} className="h-9 w-auto" />
              </div>

              <Badge variant="outline" className="mb-2 border-primary/30 font-medium text-[11px] text-primary">
                Step 1 of 2: Join Chapter Community
              </Badge>

              <h3 className="font-semibold text-foreground text-xl tracking-tight">Join GDG Jakarta to Register</h3>
              <p className="mt-1.5 max-w-md text-muted-foreground text-sm leading-relaxed">
                To attend <span className="font-medium text-foreground">&quot;{event.title}&quot;</span>, you need to be
                a registered member of our Google Developer Groups Jakarta chapter. Sign in with Google to join our
                community before registering.
              </p>

              {/* Benefits box */}
              <div className="mt-6 w-full max-w-md space-y-2.5 rounded-xl border bg-muted/40 p-4 text-left text-xs">
                <p className="font-semibold text-[13px] text-foreground">Why join GDG Jakarta first?</p>
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div ref={modalBodyRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                {registrationStep === "tickets" ? (
                  <>
                    {/* Member Profile Banner */}
                    {user && (
                      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3.5 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-medium text-muted-foreground">Registering Account:</span>
                          <div className="font-semibold text-foreground text-sm">
                            {user.name}{" "}
                            <span className="font-normal text-muted-foreground text-xs">({user.email})</span>
                          </div>
                        </div>
                        <RoleBadge role={user.chapterRole || user.role} />
                      </div>
                    )}

                    {/* Waitlist Notice Banner */}
                    {isWaitlistActive && (
                      <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3.5 text-blue-900 text-xs dark:text-blue-200">
                        <Clock className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="space-y-1">
                          <p className="font-semibold text-blue-800 dark:text-blue-300">
                            Event is at Full Capacity — Waitlist Registration
                          </p>
                          <p className="text-[11px] text-blue-800/90 leading-relaxed dark:text-blue-300/90">
                            Direct admission is closed because capacity has been reached. By submitting this form, you
                            will be placed on the <strong>Waitlist</strong>. Organizers will review and notify you if a
                            spot opens up.
                            {grandTotal > 0 && " Payment is deferred and not required while on the waitlist."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── SESSIONS SELECTION SECTION ───────────────────────────── */}
                    {hasSessions && eventConfig.sessions && (
                      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <Layers className="size-4 text-primary" />
                          <h3 className="font-semibold text-foreground text-sm">Choose Your Session</h3>
                          <span className="text-destructive">*</span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          This event has limited capacity per session. Please select the session you plan to attend.
                        </p>

                        <RadioGroup
                          value={selectedSessionId}
                          onValueChange={setSelectedSessionId}
                          className="grid grid-cols-1 gap-2.5 pt-1"
                        >
                          {preEventSessions.map((sess) => {
                            const available = isSessionAvailable(sess);
                            const remaining = getSessionRemainingSeats(sess);
                            const registered = sess.total_registered || 0;
                            const isSelected = selectedSessionId === sess.id;

                            return (
                              <label
                                key={sess.id}
                                htmlFor={`session-opt-${sess.id}`}
                                className={cn(
                                  "relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors overflow-hidden",
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
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium text-foreground text-sm break-words">
                                      {sess.title}
                                    </span>
                                    {sess.capacity > 0 && (
                                      <Badge
                                        variant={!available || remaining <= 5 ? "destructive" : "secondary"}
                                        className="text-[10px] shrink-0"
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
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(sess.description) }}
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

                    {/* ── BUNDLING PACKAGES SECTION ───────────────────────────── */}
                    {hasBundles && (
                      <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="size-4 text-primary" />
                            <h3 className="font-semibold text-foreground text-sm">
                              Bundling Packages (Combo Tickets & Merchandise)
                            </h3>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 font-semibold text-[10px] text-primary"
                          >
                            Best Value
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Save on official event merchandise and tickets by choosing a bundled combo package.
                        </p>

                        <div className="grid grid-cols-1 gap-3 pt-1">
                          {availableBundles.map((b) => {
                            const salesStatus = getBundleSalesStatus(b, effectiveNow);
                            const isDisabled = !salesStatus.isAvailable;
                            const isSelected = selectedBundleId === b.id;
                            const pricing = calculateBundlePricing(b, availableTickets, availableMerchandise);
                            const linkedTicket = availableTickets.find((t) => t.id === b.ticket_id);

                            return (
                              <div
                                key={b.id}
                                className={cn(
                                  "relative flex flex-col justify-between rounded-xl border p-4 transition-all overflow-hidden",
                                  isSelected
                                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/20",
                                  isDisabled && "cursor-not-allowed opacity-60",
                                )}
                              >
                                <div className="space-y-2 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-semibold text-foreground text-sm break-words">
                                          {b.name}
                                        </span>
                                        {b.badge && (
                                          <Badge className="border-primary/30 bg-primary/20 font-semibold text-[10px] text-primary">
                                            {b.badge}
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className={cn("text-[10px]", salesStatus.badgeColor)}>
                                          {salesStatus.badgeLabel}
                                        </Badge>
                                      </div>
                                      {b.description && (
                                        <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed break-words">
                                          {b.description}
                                        </p>
                                      )}
                                    </div>

                                    {/* Price display */}
                                    <div className="shrink-0 text-right">
                                      <div className="font-bold text-base text-foreground">
                                        {b.price === 0 ? "Free (Rp 0)" : `Rp ${b.price.toLocaleString("id-ID")}`}
                                      </div>
                                      {pricing.standaloneTotal > b.price && (
                                        <div className="text-[11px] text-muted-foreground line-through">
                                          Rp {pricing.standaloneTotal.toLocaleString("id-ID")}
                                        </div>
                                      )}
                                      {pricing.savings > 0 && (
                                        <div className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                                          Save {pricing.discountPercentage}%
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Included breakdown preview */}
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                                    {b.ticket_id && (
                                      <Badge
                                        variant="secondary"
                                        className="h-auto max-w-full whitespace-normal break-words gap-1 px-2 py-0.5 font-medium text-[11px] text-left"
                                      >
                                        <Ticket className="size-3 shrink-0 text-primary" />
                                        <span className="break-words">
                                          {b.ticket_quantity && b.ticket_quantity > 1
                                            ? `${b.ticket_quantity}x ${linkedTicket?.name || "Event Pass"}`
                                            : `${linkedTicket?.name || "Event Pass"} Included`}
                                        </span>
                                      </Badge>
                                    )}
                                    {b.ticket_id &&
                                      b.ticket_quantity &&
                                      b.ticket_quantity > 1 &&
                                      b.generate_vouchers !== false && (
                                        <Badge
                                          variant="outline"
                                          className="h-auto max-w-full whitespace-normal break-words border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400 text-left"
                                        >
                                          <span className="break-words">
                                            +{b.ticket_quantity - 1} Friend Vouchers (100% Free)
                                          </span>
                                        </Badge>
                                      )}
                                    {b.merchandise_items.map((mItem) => {
                                      const m = availableMerchandise.find((item) => item.id === mItem.merchandise_id);
                                      return (
                                        <Badge
                                          key={mItem.merchandise_id}
                                          variant="outline"
                                          className="h-auto max-w-full whitespace-normal break-words gap-1 bg-background px-2 py-0.5 text-[11px] text-left"
                                        >
                                          <Package className="size-3 shrink-0 text-primary" />
                                          <span className="break-words">
                                            {mItem.quantity}x {m?.name || "Merchandise"}
                                          </span>
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-border/40 border-t pt-2.5 text-xs">
                                  <span className="text-[11px] text-muted-foreground">
                                    {isSelected
                                      ? "✓ Selected package — ticket and merchandise auto-included"
                                      : "Click to select this bundling package"}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isSelected ? "default" : "outline"}
                                    className="h-7 px-3 text-xs"
                                    disabled={isDisabled}
                                    onClick={() => handleSelectBundle(b)}
                                  >
                                    {isSelected ? "Selected" : "Select Package"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── TICKET TIER SELECTION SECTION ───────────────────────── */}
                    {hasTickets && (
                      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Ticket className="size-4 text-primary" />
                            <h3 className="font-semibold text-foreground text-sm">
                              {hasBundleTicket
                                ? "Included Ticket Pass (Locked to Bundle)"
                                : hasBundles
                                  ? "Or Select Standard Ticket Pass"
                                  : "Select Your Registration Ticket"}
                            </h3>
                            <span className="text-destructive">*</span>
                          </div>
                          {hasBundleTicket ? (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 font-semibold text-[10px] text-primary"
                            >
                              Bundle Active
                            </Badge>
                          ) : (
                            eventConfig.max_tickets_per_person && (
                              <Badge variant="outline" className="text-[10px]">
                                Max {eventConfig.max_tickets_per_person} / person
                              </Badge>
                            )
                          )}
                        </div>

                        {hasBundleTicket ? (
                          <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary text-xs">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div>
                              <p className="font-semibold">Ticket Pass Included in Bundle</p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-primary/90">
                                Your registration pass is auto-selected by the chosen bundle package (
                                <strong>{selectedBundle?.name}</strong>). Standalone pass selection is disabled.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            Select your preferred pass type. Free RSVP, Commitment Deposit, and Paid tiers are
                            supported.
                          </p>
                        )}

                        {isClockDriftDetected && (
                          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 text-xs dark:text-amber-300">
                            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div>
                              <p className="font-semibold">Device Clock Out of Sync</p>
                              <p className="mt-0.5 text-[11px] text-amber-700/90 leading-relaxed dark:text-amber-400/90">
                                Your device clock differs from real-world time. Ticket sales availability is
                                synchronized with official server time.
                              </p>
                            </div>
                          </div>
                        )}

                        {!hasBundleTicket &&
                          availableTickets.length > 0 &&
                          availableTickets.every((t) => !getTicketSalesStatus(t, effectiveNow).isOpen) && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 text-xs dark:text-amber-300">
                              <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                              <div>
                                <p className="font-semibold">Ticket Sales Currently Closed</p>
                                <p className="mt-0.5 text-[11px] text-amber-700/90 leading-relaxed dark:text-amber-400/90">
                                  None of the ticket tiers are currently open for registration. Please review the sales
                                  window dates below.
                                </p>
                              </div>
                            </div>
                          )}

                        <RadioGroup
                          value={selectedTicketId}
                          disabled={hasBundleTicket}
                          onValueChange={(val) => {
                            if (hasBundleTicket) return;
                            const target = availableTickets.find((t) => t.id === val);
                            if (target && !getTicketSalesStatus(target, effectiveNow).isOpen) {
                              return;
                            }
                            setSelectedTicketId(val);
                          }}
                          className="grid grid-cols-1 gap-2.5 pt-1"
                        >
                          {availableTickets.map((t) => {
                            const salesStatus = getTicketSalesStatus(t, effectiveNow);
                            const isTicketInBundle = Boolean(hasBundleTicket && selectedBundle?.ticket_id === t.id);
                            const isDisabled = hasBundleTicket ? !isTicketInBundle : !salesStatus.isOpen;
                            const isSelected = selectedTicketId === t.id;

                            return (
                              <label
                                key={t.id}
                                htmlFor={`ticket-opt-${t.id}`}
                                onClick={(e) => {
                                  if (hasBundleTicket) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!isTicketInBundle) {
                                      toast.info(
                                        `Ticket pass is locked to bundle "${selectedBundle?.name}". Deselect the bundle above to choose another pass.`,
                                      );
                                    }
                                    return;
                                  }
                                  if (isDisabled) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (salesStatus.message) {
                                      toast.info(salesStatus.message);
                                    }
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    if (hasBundleTicket) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!isTicketInBundle) {
                                        toast.info(
                                          `Ticket pass is locked to bundle "${selectedBundle?.name}". Deselect the bundle above to choose another pass.`,
                                        );
                                      }
                                      return;
                                    }
                                    if (isDisabled) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (salesStatus.message) {
                                        toast.info(salesStatus.message);
                                      }
                                    }
                                  }
                                }}
                                className={cn(
                                  "relative flex items-start gap-3 rounded-lg border p-3.5 transition-colors overflow-hidden",
                                  hasBundleTicket
                                    ? isTicketInBundle
                                      ? "cursor-default border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                                      : "cursor-not-allowed border-border/40 bg-muted/20 opacity-50"
                                    : isDisabled
                                      ? "cursor-not-allowed border-border/60 bg-muted/30 opacity-60 hover:bg-muted/30"
                                      : "cursor-pointer border-border bg-card hover:bg-muted/30",
                                  !hasBundleTicket &&
                                    isSelected &&
                                    !isDisabled &&
                                    "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40",
                                )}
                              >
                                <RadioGroupItem
                                  value={t.id}
                                  id={`ticket-opt-${t.id}`}
                                  disabled={hasBundleTicket || isDisabled}
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                                      <span
                                        className={cn(
                                          "font-medium text-sm break-words",
                                          isDisabled && !isTicketInBundle ? "text-muted-foreground" : "text-foreground",
                                        )}
                                      >
                                        {t.name}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "font-semibold text-[10px]",
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
                                      {isTicketInBundle && (
                                        <Badge
                                          variant="outline"
                                          className="border-primary/40 bg-primary/20 font-semibold text-[10px] text-primary"
                                        >
                                          ✓ Included in Bundle
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {hasBundleTicket && isTicketInBundle ? (
                                        <Badge
                                          variant="secondary"
                                          className="border border-emerald-500/30 bg-emerald-500/10 font-bold text-[11px] text-emerald-700 dark:text-emerald-400"
                                        >
                                          Included (Rp 0)
                                        </Badge>
                                      ) : (
                                        <span
                                          className={cn(
                                            "font-bold text-sm whitespace-nowrap",
                                            isDisabled ? "text-muted-foreground" : "text-foreground",
                                          )}
                                        >
                                          {t.type === "free" ? "Free" : `Rp ${(t.price || 0).toLocaleString("id-ID")}`}
                                        </span>
                                      )}
                                      {!hasBundleTicket && salesStatus.state === "sold_out" && (
                                        <Badge variant="destructive" className="text-[10px]">
                                          Sold Out
                                        </Badge>
                                      )}
                                      {!hasBundleTicket && salesStatus.state === "upcoming" && (
                                        <Badge
                                          variant="outline"
                                          className="border-blue-500/40 bg-blue-500/10 font-medium text-[10px] text-blue-700 dark:text-blue-400"
                                        >
                                          Opens Soon
                                        </Badge>
                                      )}
                                      {!hasBundleTicket && salesStatus.state === "ended" && (
                                        <Badge
                                          variant="secondary"
                                          className="bg-muted text-[10px] text-muted-foreground"
                                        >
                                          Sales Closed
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {t.description && (
                                    <p className="text-muted-foreground text-xs leading-relaxed break-words">
                                      {t.description}
                                    </p>
                                  )}

                                  {/* Sales schedule info */}
                                  {!hasBundleTicket &&
                                    salesStatus.state === "upcoming" &&
                                    salesStatus.formattedStart && (
                                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400">
                                        <Clock className="size-3.5 shrink-0" />
                                        <span className="break-words">Sales starts: {salesStatus.formattedStart}</span>
                                      </div>
                                    )}
                                  {!hasBundleTicket && salesStatus.state === "ended" && salesStatus.formattedEnd && (
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <Clock className="size-3.5 shrink-0" />
                                      <span className="break-words">Sales ended: {salesStatus.formattedEnd}</span>
                                    </div>
                                  )}
                                  {!hasBundleTicket &&
                                    salesStatus.state === "available" &&
                                    salesStatus.formattedEnd && (
                                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Clock className="size-3.5 shrink-0" />
                                        <span className="break-words">Sales closes: {salesStatus.formattedEnd}</span>
                                      </div>
                                    )}

                                  {t.type === "commitment_fee" && (
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                      <ShieldCheck className="size-3.5 shrink-0" />
                                      <span>
                                        Deposit will be returned 100% in cash upon physical check-in at the venue.
                                      </span>
                                    </div>
                                  )}

                                  {t.perks && t.perks.length > 0 && (
                                    <div className="mt-2 rounded-md border border-primary/20 bg-primary/[0.04] p-2 text-xs">
                                      <div className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
                                        <Sparkles className="size-3 shrink-0 text-amber-500" />
                                        <span>Perks Included with this Pass:</span>
                                      </div>
                                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {t.perks.map((p) => (
                                          <Badge
                                            key={p.id}
                                            variant="secondary"
                                            className="h-auto max-w-full whitespace-normal break-words px-2 py-0.5 text-left font-normal text-[10px]"
                                          >
                                            <CheckCircle2 className="size-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            <span className="break-words">{p.name}</span>
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </RadioGroup>
                      </div>
                    )}

                    {/* ── MERCHANDISE ADD-ONS SECTION ──────────────────────────── */}
                    {hasMerchandise && (
                      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="size-4 text-primary" />
                            <h3 className="font-semibold text-foreground text-sm">
                              {hasBundleMerchandise
                                ? "Included Merchandise (Bundled with Package)"
                                : "Official Merchandise & Swag (Optional)"}
                            </h3>
                          </div>
                          {hasBundleMerchandise ? (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 font-semibold text-[10px] text-primary"
                            >
                              Bundle Active
                            </Badge>
                          ) : (
                            maxMerchandiseAllowed && (
                              <Badge variant="outline" className="text-[10px]">
                                {totalMerchandiseItems}/{maxMerchandiseAllowed} items selected
                              </Badge>
                            )
                          )}
                        </div>

                        {hasBundleMerchandise ? (
                          <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary text-xs">
                            <Package className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div>
                              <p className="font-semibold">Official Merchandise Bundled with Package</p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-primary/90">
                                Official merchandise items included in your chosen bundle package (
                                <strong>{selectedBundle?.name}</strong>) are locked and included at no extra charge. You
                                can still select additional merchandise add-ons below.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            Add exclusive community swag, apparel, and event merchandise to your registration.
                          </p>
                        )}

                        <div className="space-y-3 pt-1">
                          {availableMerchandise.map((item) => {
                            const salesStatus = getMerchandiseSalesStatus(item, effectiveNow);
                            const order = selectedMerch[item.id] ?? { quantity: 0, selectedVariations: {} };
                            const isAdded = order.quantity > 0;
                            const bundledItemRecord = hasBundleMerchandise
                              ? selectedBundle?.merchandise_items?.find((bi) => bi.merchandise_id === item.id)
                              : undefined;
                            const isItemInBundle = Boolean(bundledItemRecord && (bundledItemRecord.quantity || 0) > 0);
                            const isIncludedInTicket = Boolean(
                              selectedTicket?.perks?.some((p) => p.merchandise_id === item.id),
                            );
                            const itemMax = item.max_per_person ?? maxMerchandiseAllowed ?? null;
                            const reachedLimit =
                              (itemMax !== null && order.quantity >= itemMax) ||
                              (maxMerchandiseAllowed !== null && totalMerchandiseItems >= maxMerchandiseAllowed);

                            const effectiveImg = getMerchEffectiveImage(item, order.selectedVariations);
                            const effectiveUnitPrice = isIncludedInTicket
                              ? 0
                              : getMerchEffectivePrice(item, order.selectedVariations);

                            const allImages = getMerchAllImages(item, order.selectedVariations);
                            const hasMultipleImages = allImages.length > 1;

                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  "flex flex-col gap-3.5 rounded-xl border p-3.5 transition-all sm:flex-row sm:items-center sm:justify-between overflow-hidden",
                                  isItemInBundle
                                    ? "border-primary/50 bg-background shadow-xs ring-1 ring-primary/20"
                                    : isAdded
                                      ? "border-primary/50 bg-background shadow-xs ring-1 ring-primary/20"
                                      : "border-border/70 bg-card",
                                  !isItemInBundle && !salesStatus.isOpen && !isAdded && "bg-muted/20 opacity-80",
                                )}
                              >
                                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                  {/* Enlarged Interactive Thumbnail */}
                                  <button
                                    type="button"
                                    onClick={() => setViewingGalleryItem(item)}
                                    className="group relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-muted/30 shadow-2xs transition-all hover:border-primary/60 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:size-24"
                                    title="Click to view full photos"
                                  >
                                    {effectiveImg ? (
                                      // biome-ignore lint/performance/noImgElement: merchandise preview
                                      // biome-ignore lint/a11y/useAltText: thumbnail
                                      <img
                                        src={effectiveImg}
                                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                                      />
                                    ) : (
                                      <div className="flex size-full items-center justify-center text-muted-foreground">
                                        <Package className="size-6 opacity-40" />
                                      </div>
                                    )}

                                    {/* Hover overlay hint */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                                      <Maximize2 className="size-4 text-white drop-shadow-xs" />
                                    </div>

                                    {/* Photo count pill when multiple photos available */}
                                    {hasMultipleImages && (
                                      <div className="absolute right-1 bottom-1">
                                        <Badge
                                          variant="secondary"
                                          className="h-4.5 gap-1 border-none bg-background/90 px-1.5 py-0 font-medium text-[9px] text-foreground shadow-xs backdrop-blur-xs"
                                        >
                                          <Images className="size-2.5" />
                                          {allImages.length}
                                        </Badge>
                                      </div>
                                    )}
                                  </button>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setViewingGalleryItem(item)}
                                        className="cursor-pointer text-left font-semibold text-foreground text-xs hover:text-primary hover:underline sm:text-sm"
                                      >
                                        {item.name}
                                      </button>
                                      {isItemInBundle ? (
                                        <>
                                          <Badge
                                            variant="secondary"
                                            className="gap-1 border border-primary/30 bg-primary/10 px-1.5 py-0 font-semibold text-[10px] text-primary"
                                          >
                                            <Package className="size-2.5 text-primary" />
                                            Included in Bundle ({bundledItemRecord?.quantity}x)
                                          </Badge>
                                          <Badge
                                            variant="secondary"
                                            className="border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 font-bold text-[10px] text-emerald-700 dark:text-emerald-400"
                                          >
                                            Included (Rp 0)
                                          </Badge>
                                        </>
                                      ) : isIncludedInTicket ? (
                                        <Badge
                                          variant="secondary"
                                          className="gap-1 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-semibold text-[10px] text-amber-700 dark:text-amber-400"
                                        >
                                          <Sparkles className="size-2.5 text-amber-500" />
                                          Included with Ticket (Free)
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "px-1.5 py-0 text-[10px]",
                                            item.is_free
                                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                          )}
                                        >
                                          {item.is_free
                                            ? "Free Perk"
                                            : `Rp ${effectiveUnitPrice.toLocaleString("id-ID")}`}
                                        </Badge>
                                      )}
                                      {!isItemInBundle && !salesStatus.isOpen && (
                                        <Badge
                                          variant="outline"
                                          className={cn("px-1.5 py-0 text-[10px]", salesStatus.badgeColor)}
                                        >
                                          {salesStatus.badgeLabel}
                                        </Badge>
                                      )}
                                    </div>

                                    {item.description && (
                                      <p className="line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}

                                    {/* Sales window message if closed or upcoming */}
                                    {!isItemInBundle && !salesStatus.isOpen && (
                                      <div className="flex items-center gap-1 pt-0.5 text-[11px] text-muted-foreground">
                                        <Clock className="size-3 shrink-0" />
                                        <span>{salesStatus.message}</span>
                                      </div>
                                    )}

                                    {/* Actions Row: View Photos and Sizing Guideline */}
                                    <div className="flex flex-wrap items-center gap-3 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => setViewingGalleryItem(item)}
                                        className="inline-flex cursor-pointer items-center gap-1 font-medium text-[11px] text-primary hover:underline"
                                      >
                                        <Images className="size-3" />
                                        <span>View {hasMultipleImages ? `${allImages.length} photos` : "photo"}</span>
                                      </button>

                                      {item.guideline &&
                                        (item.guideline.title || item.guideline.text || item.guideline.image_url) && (
                                          <button
                                            type="button"
                                            onClick={() => setViewingGuidelineItem(item)}
                                            className="inline-flex cursor-pointer items-center gap-1 font-medium text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                                          >
                                            <Ruler className="size-3" />
                                            <span>{item.guideline.title || "View Sizing Guideline"}</span>
                                          </button>
                                        )}
                                    </div>

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
                                              <SelectTrigger className="h-6 w-20 px-1.5 py-0 text-[10px]">
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
                                <div className="flex items-center justify-between gap-2 border-t pt-2 sm:justify-end sm:border-t-0 sm:pt-0">
                                  <span className="font-semibold text-xs sm:hidden">
                                    {isItemInBundle
                                      ? "Included"
                                      : getMerchPriceDisplay(
                                          item,
                                          order.quantity,
                                          order.selectedVariations,
                                          isIncludedInTicket,
                                        )}
                                  </span>

                                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-xs"
                                      onClick={() => handleUpdateMerchQuantity(item.id, -1)}
                                      disabled={isItemInBundle || order.quantity === 0}
                                      className="size-7"
                                    >
                                      <Minus className="size-3" />
                                    </Button>
                                    <span className="w-6 text-center font-mono font-semibold text-xs">
                                      {order.quantity}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-xs"
                                      onClick={() => handleUpdateMerchQuantity(item.id, 1)}
                                      disabled={isItemInBundle || reachedLimit || !salesStatus.isOpen}
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

                    {/* ── PROMO VOUCHER SECTION ───────────────────────────────── */}
                    {rawSubtotal > 0 && (
                      <div className="space-y-2 rounded-xl border bg-card p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between font-semibold text-foreground text-xs">
                          <span className="flex items-center gap-1.5">
                            <Tag className="size-3.5 text-primary" />
                            Have a Promo Voucher?
                          </span>
                          {appliedVoucher && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              Applied
                            </Badge>
                          )}
                        </div>

                        {appliedVoucher ? (
                          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300">
                                  {appliedVoucher.code}
                                </span>
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                  (-Rp {voucherDiscount.totalDiscount.toLocaleString("id-ID")})
                                </span>
                              </div>
                              {appliedVoucher.description && (
                                <p className="line-clamp-1 text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                                  {appliedVoucher.description}
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={handleRemoveVoucher}
                              className="size-6 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
                              title="Remove voucher"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <Input
                                value={voucherInput}
                                onChange={(e) => {
                                  setVoucherInput(e.target.value.toUpperCase());
                                  setVoucherError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleApplyVoucher();
                                  }
                                }}
                                placeholder="Enter voucher code (e.g. DEVFEST50)"
                                className="h-8 font-mono text-xs uppercase tracking-wider"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleApplyVoucher}
                                disabled={isApplyingVoucher}
                                className="h-8 shrink-0 px-3 font-medium text-xs"
                              >
                                {isApplyingVoucher ? "Applying..." : "Apply"}
                              </Button>
                            </div>
                            {voucherError && (
                              <p className="text-[11px] text-destructive leading-normal">{voucherError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── REFERRAL CODE SECTION ───────────────────────────────── */}
                    {hasTickets && isReferralEnabled && (
                      <div className="space-y-2 rounded-xl border bg-card p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between font-semibold text-foreground text-xs">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-primary" />
                            Have a Referral Code?
                          </span>
                          {appliedReferral && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 font-semibold text-[10px] text-emerald-600 dark:text-emerald-400"
                            >
                              Applied (
                              {appliedReferral.discountType === "fixed"
                                ? `Rp ${(appliedReferral.discountAmount ?? 0).toLocaleString("id-ID")} OFF`
                                : `${appliedReferral.discountPercentage ?? 10}% OFF`}
                              )
                            </Badge>
                          )}
                        </div>

                        {appliedReferral ? (
                          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300">
                                  {appliedReferral.code}
                                </span>
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                  (-
                                  {appliedReferral.discountType === "fixed"
                                    ? `Rp ${(appliedReferral.discountAmount ?? 0).toLocaleString("id-ID")}`
                                    : `${appliedReferral.discountPercentage ?? 10}%`}{" "}
                                  on ticket)
                                </span>
                              </div>
                              <p className="line-clamp-1 text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                                Referred by {appliedReferral.referrerName}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={handleRemoveReferral}
                              className="size-6 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
                              title="Remove referral code"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <Input
                                value={referralInput}
                                onChange={(e) => {
                                  setReferralInput(e.target.value.toUpperCase());
                                  setReferralError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleApplyReferral();
                                  }
                                }}
                                placeholder="Enter referral code (e.g. GDG8X4K)"
                                className="h-8 font-mono text-xs uppercase tracking-wider"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleApplyReferral}
                                disabled={isValidatingReferral}
                                className="h-8 shrink-0 px-3 font-medium text-xs"
                              >
                                {isValidatingReferral ? <Loader2 className="size-3 animate-spin" /> : "Apply"}
                              </Button>
                            </div>
                            {referralError && (
                              <p className="text-[11px] text-destructive leading-normal">{referralError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── REGISTRATION & ORDER SUMMARY ─────────────────────────── */}
                    {(hasTickets || (hasMerchandise && totalMerchandiseItems > 0)) && (
                      <div className="space-y-2.5 rounded-xl border bg-muted/40 p-4">
                        <div className="flex items-center justify-between font-medium text-muted-foreground text-xs">
                          <span>Registration &amp; Checkout Summary</span>
                          <span>Amount</span>
                        </div>

                        {selectedBundle ? (
                          <>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                Bundle Package: <strong>{selectedBundle.name}</strong>
                              </span>
                              <span className="font-bold font-mono">
                                {selectedBundle.price === 0
                                  ? "Free (Rp 0)"
                                  : `Rp ${selectedBundle.price.toLocaleString("id-ID")}`}
                              </span>
                            </div>
                            {hasBundleTicket && selectedTicket && (
                              <div className="flex items-center justify-between pl-2 text-muted-foreground text-xs">
                                <span>↳ Pass: {selectedTicket.name}</span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">Included</span>
                              </div>
                            )}
                            {!hasBundleTicket && selectedTicket && (
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
                              const bundledRecord = hasBundleMerchandise
                                ? selectedBundle.merchandise_items?.find((bi) => bi.merchandise_id === itemId)
                                : undefined;
                              const bundledQty = bundledRecord?.quantity || 0;
                              const billableQty = Math.max(0, order.quantity - bundledQty);
                              const effectiveUnitPrice = getMerchEffectivePrice(m, order.selectedVariations);
                              const linePrice = effectiveUnitPrice * billableQty;

                              return (
                                <React.Fragment key={itemId}>
                                  {bundledQty > 0 && (
                                    <div className="flex items-center justify-between pl-2 text-muted-foreground text-xs">
                                      <span>
                                        ↳ Swag: {bundledQty}x {m.name} {varText ? `(${varText})` : ""}
                                      </span>
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400">Included</span>
                                    </div>
                                  )}
                                  {billableQty > 0 && (
                                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                                      <span>
                                        {billableQty}x {m.name} {varText ? `(${varText})` : ""}
                                      </span>
                                      <span className="font-mono">
                                        {m.is_free || linePrice === 0
                                          ? "Free"
                                          : `Rp ${linePrice.toLocaleString("id-ID")}`}
                                      </span>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </>
                        ) : (
                          <>
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
                              const isIncludedInTicket = Boolean(
                                selectedTicket?.perks?.some((p) => p.merchandise_id === m.id),
                              );
                              const effectiveUnitPrice = getMerchEffectivePrice(m, order.selectedVariations);
                              const linePrice = effectiveUnitPrice * order.quantity;

                              return (
                                <div
                                  key={itemId}
                                  className="flex items-center justify-between text-muted-foreground text-xs"
                                >
                                  <span>
                                    {order.quantity}x {m.name} {varText ? `(${varText})` : ""}
                                  </span>
                                  <span className="font-mono">
                                    {m.is_free || isIncludedInTicket || linePrice === 0
                                      ? "Free"
                                      : `Rp ${linePrice.toLocaleString("id-ID")}`}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        )}

                        {/* Subtotal & Discounts */}
                        {(appliedVoucher || (appliedReferral && referralDiscount > 0)) && (
                          <div className="flex items-center justify-between border-t pt-2 text-muted-foreground text-xs">
                            <span>Subtotal</span>
                            <span className="font-mono">Rp {rawSubtotal.toLocaleString("id-ID")}</span>
                          </div>
                        )}

                        {appliedVoucher && voucherDiscount.totalDiscount > 0 && (
                          <div className="flex items-center justify-between font-medium text-emerald-600 text-xs dark:text-emerald-400">
                            <span className="flex items-center gap-1">
                              <Tag className="size-3" />
                              Voucher ({appliedVoucher.code})
                            </span>
                            <span className="font-mono">
                              -Rp {voucherDiscount.totalDiscount.toLocaleString("id-ID")}
                            </span>
                          </div>
                        )}

                        {appliedReferral && referralDiscount > 0 && (
                          <div className="flex items-center justify-between font-medium text-emerald-600 text-xs dark:text-emerald-400">
                            <span className="flex items-center gap-1">
                              <Sparkles className="size-3" />
                              Referral Discount (
                              {appliedReferral.discountType === "fixed"
                                ? `Rp ${(appliedReferral.discountAmount ?? 0).toLocaleString("id-ID")}`
                                : `${appliedReferral.discountPercentage ?? 10}%`}
                              )
                            </span>
                            <span className="font-mono">-Rp {referralDiscount.toLocaleString("id-ID")}</span>
                          </div>
                        )}

                        {gatewayFeeCalc.isEnabled && netSubtotal > 0 && gatewayFeeCalc.feeAmount > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground text-xs">
                            <span className="flex items-center gap-1.5">
                              <CreditCard className="size-3 text-muted-foreground" />
                              <span>{gatewayFeeCalc.feeLabel}</span>
                              {gatewayFeeCalc.isAbsorbedByOrganizer ? (
                                <Badge
                                  variant="outline"
                                  className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1 font-normal text-[9px] text-emerald-600 dark:text-emerald-400"
                                >
                                  Absorbed
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  ({gatewayFeeCalc.rateDescription})
                                </span>
                              )}
                            </span>
                            <span className="font-mono">
                              {gatewayFeeCalc.isPassedToAttendee
                                ? `+Rp ${gatewayFeeCalc.feeAmount.toLocaleString("id-ID")}`
                                : "Free for Attendee"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t pt-2 font-bold text-foreground text-sm">
                          <span>Total Amount</span>
                          <span className="font-mono text-primary">
                            {grandTotal === 0 ? "Free (Rp 0)" : `Rp ${grandTotal.toLocaleString("id-ID")}`}
                          </span>
                        </div>

                        {selectedTicket?.type === "commitment_fee" && (
                          <p className="pt-1 text-[11px] text-amber-600 leading-normal dark:text-amber-400">
                            💡 Note: Your commitment deposit will be handed back in full upon physical check-in at the
                            venue.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <form id="event-registration-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* ── STEP 2 PASS & PERKS RECAP ──────────────────────────── */}
                    <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 font-semibold text-[10px] text-primary"
                          >
                            Selected Pass
                          </Badge>
                          <span className="font-semibold text-foreground text-sm">
                            {selectedTicket?.name || "Regular"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold text-[10px]",
                              selectedTicket?.type === "free" &&
                                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                              selectedTicket?.type === "paid" &&
                                "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                              selectedTicket?.type === "commitment_fee" &&
                                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {getTicketTypeBadge(selectedTicket?.type || "free")}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                          {hasSessions && selectedSession ? (
                            <span className="flex items-center gap-1">
                              <Layers className="size-3 text-primary" />
                              <span>
                                Session: <strong className="text-foreground">{selectedSession.title}</strong>
                              </span>
                            </span>
                          ) : !hasSessions ? (
                            <span className="flex items-center gap-1">
                              <Layers className="size-3 text-primary" />
                              <span>
                                Session:{" "}
                                <strong className="text-foreground">
                                  {eventConfig.default_session_name?.trim() || "Full Session"}
                                </strong>
                              </span>
                            </span>
                          ) : null}
                          {totalMerchandiseItems > 0 && (
                            <span className="flex items-center gap-1">
                              <ShoppingBag className="size-3 text-primary" />
                              <span>
                                Merchandise:{" "}
                                <strong className="text-foreground">{totalMerchandiseItems} item(s)</strong>
                              </span>
                            </span>
                          )}
                          {appliedVoucher && (
                            <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                              <Tag className="size-3" />
                              <span>
                                Voucher: {appliedVoucher.code} (-Rp{" "}
                                {voucherDiscount.totalDiscount.toLocaleString("id-ID")})
                              </span>
                            </span>
                          )}
                          {gatewayFeeCalc.isEnabled &&
                            netSubtotal > 0 &&
                            gatewayFeeCalc.feeAmount > 0 &&
                            gatewayFeeCalc.isPassedToAttendee && (
                              <span className="flex items-center gap-1 font-mono text-muted-foreground">
                                <CreditCard className="size-3 text-primary" />
                                <span>Fee: +Rp {gatewayFeeCalc.feeAmount.toLocaleString("id-ID")}</span>
                              </span>
                            )}
                          <span className="font-medium font-mono text-foreground">
                            Total: {grandTotal === 0 ? "Free (Rp 0)" : `Rp ${grandTotal.toLocaleString("id-ID")}`}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRegistrationStep("tickets");
                          if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
                        }}
                        className="self-start text-xs sm:self-center"
                      >
                        Change Pass / Perks
                      </Button>
                    </div>

                    {/* Member Profile Banner */}
                    {user && (
                      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3.5 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-medium text-muted-foreground">Registering Account:</span>
                          <div className="font-semibold text-foreground text-sm">
                            {user.name}{" "}
                            <span className="font-normal text-muted-foreground text-xs">({user.email})</span>
                          </div>
                        </div>
                        <RoleBadge role={user.chapterRole || user.role} />
                      </div>
                    )}

                    {/* Waitlist Notice Banner */}
                    {isWaitlistActive && (
                      <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3.5 text-blue-900 text-xs dark:text-blue-200">
                        <Clock className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="space-y-1">
                          <p className="font-semibold text-blue-800 dark:text-blue-300">
                            Event is at Full Capacity — Waitlist Registration
                          </p>
                          <p className="text-[11px] text-blue-800/90 leading-relaxed dark:text-blue-300/90">
                            Direct admission is closed because capacity has been reached. By submitting this form, you
                            will be placed on the <strong>Waitlist</strong>. Organizers will review and notify you if a
                            spot opens up.
                            {grandTotal > 0 && " Payment is deferred and not required while on the waitlist."}
                          </p>
                        </div>
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
                              const hasLengthLimits =
                                typeof q.min_length === "number" || typeof q.max_length === "number";
                              const isLengthViolated =
                                (typeof q.min_length === "number" && charCount > 0 && charCount < q.min_length) ||
                                (typeof q.max_length === "number" && charCount > q.max_length);

                              return (
                                <Field key={q.id}>
                                  <FieldLabel htmlFor={fieldId} className="font-medium text-xs">
                                    {q.label} {q.required && <span className="text-destructive">*</span>}
                                    {["checkbox", "multiselect"].includes(q.type) && q.required && (
                                      <span className="ml-1.5 font-normal text-[10px] text-muted-foreground">
                                        {(() => {
                                          const req = getCheckboxRequirement(q);
                                          if (req.rule === "all") return "(All checkboxes required)";
                                          if (req.rule === "min_count") return `(Select at least ${req.minSelected})`;
                                          return "(Select at least 1)";
                                        })()}
                                      </span>
                                    )}
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
                                        <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-background/85 px-2 py-0.5 font-medium text-[11px] text-foreground opacity-0 shadow-xs backdrop-blur-xs transition-opacity group-hover:opacity-100">
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
                                      className={cn(
                                        errorMessage && "border-destructive focus-visible:ring-destructive/30",
                                      )}
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
                                      className={cn(
                                        errorMessage && "border-destructive focus-visible:ring-destructive/30",
                                      )}
                                      required={q.required}
                                    />
                                  )}

                                  {/* Helper row with error message and live character counter for text / textarea */}
                                  {(q.type === "text" || q.type === "textarea") &&
                                    (errorMessage || hasLengthLimits) && (
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
                                      eventName={eventConfig.title}
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
                                        hasOther &&
                                        (parsed.isOther || (rawVal !== "" && !regularOptions.includes(rawVal)));
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
                                              className={cn(
                                                errorMessage && "border-destructive focus:ring-destructive/30",
                                              )}
                                            >
                                              <SelectValue placeholder="Select an option" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {regularOptions.map((opt) => (
                                                <SelectItem key={opt} value={opt}>
                                                  {opt}
                                                </SelectItem>
                                              ))}
                                              {hasOther && (
                                                <SelectItem value="__other__">Other (specify below)</SelectItem>
                                              )}
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
                                        hasOther &&
                                        (parsed.isOther || (rawVal !== "" && !regularOptions.includes(rawVal)));
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
                                                    isOtherSelected &&
                                                      "border-primary/50 focus-visible:ring-primary/30",
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
                                      const selectedList = Array.isArray(answers[q.id])
                                        ? (answers[q.id] as string[])
                                        : [];
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
                                                  isChecked
                                                    ? "border-primary/50 bg-primary/5"
                                                    : "bg-card hover:bg-muted/30",
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
                                                      const cur = Array.isArray(answers[q.id])
                                                        ? (answers[q.id] as string[])
                                                        : [];
                                                      const filtered = cur.filter(
                                                        (it) =>
                                                          typeof it === "string" &&
                                                          !isOtherOption(it) &&
                                                          !it.toLowerCase().startsWith("other:"),
                                                      );
                                                      const nextUpdated = [...filtered, formatted];
                                                      setAnswers((prev) => ({ ...prev, [q.id]: nextUpdated }));
                                                      const valRes = validateQuestionAnswer(q, nextUpdated);
                                                      setFieldErrors((prev) => {
                                                        if (valRes.isValid) {
                                                          const next = { ...prev };
                                                          delete next[q.id];
                                                          return next;
                                                        }
                                                        return { ...prev, [q.id]: valRes.error ?? "Invalid input" };
                                                      });
                                                      setTimeout(() => otherInputRefs.current[q.id]?.focus(), 50);
                                                    } else {
                                                      const cur = Array.isArray(answers[q.id])
                                                        ? (answers[q.id] as string[])
                                                        : [];
                                                      const nextUpdated = cur.filter(
                                                        (it) =>
                                                          typeof it === "string" &&
                                                          !isOtherOption(it) &&
                                                          !it.toLowerCase().startsWith("other:"),
                                                      );
                                                      setAnswers((prev) => ({ ...prev, [q.id]: nextUpdated }));
                                                      setOtherInputs((prev) => {
                                                        const next = { ...prev };
                                                        delete next[q.id];
                                                        return next;
                                                      });
                                                      const valRes = validateQuestionAnswer(q, nextUpdated);
                                                      setFieldErrors((prev) => {
                                                        if (valRes.isValid) {
                                                          const next = { ...prev };
                                                          delete next[q.id];
                                                          return next;
                                                        }
                                                        return { ...prev, [q.id]: valRes.error ?? "Invalid input" };
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
                                                        const cur = Array.isArray(prev[q.id])
                                                          ? (prev[q.id] as string[])
                                                          : [];
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
                  </form>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2.5 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-3.5">
                {registrationStep === "tickets" ? (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs sm:justify-start">
                      {footerSummaryBadge}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        key="tickets-cancel-btn"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        key="tickets-continue-to-form-btn"
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleProceedToForm(e);
                        }}
                        disabled={
                          isPending ||
                          (hasTickets &&
                            (!selectedTicket ||
                              (selectedBundle
                                ? hasBundleTicket
                                  ? !getBundleSalesStatus(selectedBundle, effectiveNow).isAvailable
                                  : !getBundleSalesStatus(selectedBundle, effectiveNow).isAvailable ||
                                    !getTicketSalesStatus(selectedTicket, effectiveNow).isOpen
                                : !getTicketSalesStatus(selectedTicket, effectiveNow).isOpen)))
                        }
                        className="flex-1 sm:flex-initial gap-2 shadow-xs"
                      >
                        <span className="truncate">
                          <span className="hidden sm:inline">Continue to Registration Form</span>
                          <span className="sm:hidden">Continue to Form</span>
                        </span>
                        <ArrowRight className="size-3.5 shrink-0" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 sm:justify-start">
                      <Button
                        key="form-back-btn"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRegistrationStep("tickets");
                          if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
                        }}
                        className="h-8 gap-1.5 px-2 text-muted-foreground text-xs hover:text-foreground sm:px-3"
                      >
                        <ArrowLeft className="size-3.5 shrink-0" />
                        <span>
                          <span className="hidden sm:inline">Back to Pass &amp; Perks</span>
                          <span className="sm:hidden">Back</span>
                        </span>
                      </Button>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        key="form-cancel-btn"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        key="form-submit-btn"
                        form="event-registration-form"
                        type="submit"
                        size="sm"
                        disabled={isPending}
                        className="flex-1 sm:flex-initial gap-2 shadow-xs"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin shrink-0" />
                            <span className="truncate">Submitting...</span>
                          </>
                        ) : isWaitlistActive ? (
                          <>
                            <Clock className="size-3.5 shrink-0" />
                            <span className="truncate">Join Waitlist</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3.5 shrink-0" />
                            <span className="truncate">Submit Registration</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {capacityAlert && (
        <CapacityFullDialog
          open={capacityAlert.open}
          onOpenChange={(isOpen) => setCapacityAlert((prev) => (prev ? { ...prev, open: isOpen } : null))}
          mode="attendee"
          title={capacityAlert.title}
          message={capacityAlert.message}
          reason={capacityAlert.reason}
          sessionTitle={capacityAlert.sessionTitle}
          currentCount={capacityAlert.currentCount}
          maxCapacity={capacityAlert.maxCapacity}
          venueName={eventConfig.venue?.name}
          onSelectAlternativeSession={() => {
            setSelectedSessionId("");
            setOpen(true);
          }}
        />
      )}

      {/* Merchandise Image Gallery Carousel Dialog */}
      <MerchandiseGalleryDialog
        item={viewingGalleryItem}
        open={Boolean(viewingGalleryItem)}
        onOpenChange={(isOpen) => !isOpen && setViewingGalleryItem(null)}
        selectedVariations={viewingGalleryItem ? selectedMerch[viewingGalleryItem.id]?.selectedVariations : undefined}
        isIncludedInTicket={Boolean(
          viewingGalleryItem && selectedTicket?.perks?.some((p) => p.merchandise_id === viewingGalleryItem.id),
        )}
        onOpenGuideline={(targetItem) => setViewingGuidelineItem(targetItem)}
      />

      {/* Sizing & Product Guideline Dialog */}
      <Dialog open={Boolean(viewingGuidelineItem)} onOpenChange={(isOpen) => !isOpen && setViewingGuidelineItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="size-5 text-primary" />
              {viewingGuidelineItem?.guideline?.title || "Product Sizing Guideline"}
            </DialogTitle>
            <DialogDescription>Measurements, specs, and details for {viewingGuidelineItem?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {viewingGuidelineItem?.guideline?.image_url && (
              <div className="overflow-hidden rounded-lg border bg-muted p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* biome-ignore lint/performance/noImgElement: size chart preview */}
                <img
                  src={viewingGuidelineItem.guideline.image_url}
                  alt="Size Chart Graphic"
                  className="mx-auto max-h-60 w-auto rounded object-contain"
                />
              </div>
            )}

            {viewingGuidelineItem?.guideline?.text && (
              <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                {viewingGuidelineItem.guideline.text}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setViewingGuidelineItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
