"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import {
  Briefcase,
  Building2,
  Check,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Loader2,
  type LucideIcon,
  Mail,
  MoreHorizontal,
  Package,
  PackageCheck,
  Phone,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  User,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatFirestoreDate } from "@/lib/date-utils";
import {
  getEffectiveRegistrationStatus,
  getRegistrationPaymentDeadline,
  isEventCurationMode,
} from "@/lib/events/payment-deadline";
import { formatRupiah, getRegistrationDiscountBreakdown, getRegistrationRefundAmount } from "@/lib/events/refund-utils";
import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import type {
  BundleIssuedVoucher,
  CustomQuestion,
  FirestoreEvent,
  FirestoreRegistration,
  ReferralOwnerInfo,
  RegistrationAuditActionStatus,
  RegistrationStatus,
} from "@/lib/firestore/types";
import { type DriveVenueTicketFile, isEligibleForVenueTicket } from "@/lib/google-drive/venue-tickets";
import { cn, getInitials } from "@/lib/utils";

import { CheckPaymentStatusDialog } from "./check-payment-status-dialog";
import { parseMerchandiseVariations } from "./merchandise-helpers";
import { ResendPaymentLinkDialog } from "./resend-payment-link-dialog";

interface ApplicantDetailDialogProps {
  registration: FirestoreRegistration | null;
  event?: FirestoreEvent;
  isCurationMode?: boolean;
  allRegistrations?: FirestoreRegistration[];
  onClose: () => void;
  onStatusChange: (registrationId: string, newStatus: RegistrationStatus, updatedReg?: FirestoreRegistration) => void;
  onUpdateRegistration?: (updated: FirestoreRegistration) => void;
  onApprove?: (registration: FirestoreRegistration) => void;
  onReject?: (registration: FirestoreRegistration) => void;
  onApproveRefund?: (registration: FirestoreRegistration) => void;
  onRejectRefund?: (registration: FirestoreRegistration) => void;
  onResendInterestEmail?: (registration: FirestoreRegistration) => void;
  onResendWaitlistEmail?: (registration: FirestoreRegistration) => void;
  onResendPaidWaitlistEmail?: (registration: FirestoreRegistration) => void;
  onResendAcceptedEmail?: (registration: FirestoreRegistration) => void;
  onToggleCheckIn?: (registration: FirestoreRegistration, isCheckedIn: boolean) => void;
  onToggleMerchandiseCollected?: (registration: FirestoreRegistration, isCollected: boolean) => void;
  onCancelRegistration?: (registration: FirestoreRegistration) => void;
  onDelete?: (registration: FirestoreRegistration) => void;
  customQuestions?: CustomQuestion[];
  isPending?: boolean;
  isCollectingMerch?: boolean;
  isApproving?: boolean;
  isRejecting?: boolean;
  isWaitlisting?: boolean;
  isResendingInterest?: boolean;
  isResendingWaitlist?: boolean;
  isResendingPaidWaitlist?: boolean;
  isResendingAccepted?: boolean;
  isCancelling?: boolean;
  venueTicketFiles?: DriveVenueTicketFile[];
  onAssignVenueTicket?: (registration: FirestoreRegistration, file: DriveVenueTicketFile | null) => Promise<void>;
  onSendVenueTicketEmail?: (registration: FirestoreRegistration) => Promise<boolean>;
  isSendingVenueTicket?: boolean;
}

const STATUS_VARIANTS: Record<RegistrationAuditActionStatus, { label: string; badgeClass: string; dotClass: string }> =
  {
    pending: {
      label: "Pending Review",
      badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dotClass: "bg-amber-500",
    },
    waiting_for_payment: {
      label: "Waiting for Payment",
      badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dotClass: "bg-amber-500",
    },
    paid_and_registered: {
      label: "Paid & Registered",
      badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    },
    expired: {
      label: "Expired",
      badgeClass: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
      dotClass: "bg-zinc-500",
    },
    failed: {
      label: "Failed",
      badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      dotClass: "bg-rose-500",
    },
    canceled: {
      label: "Canceled",
      badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
      dotClass: "bg-slate-500",
    },
    cancelled: {
      label: "Canceled",
      badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
      dotClass: "bg-slate-500",
    },
    approved: {
      label: "Approved",
      badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    },
    registered: {
      label: "Registered",
      badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    },
    rejected: {
      label: "Rejected",
      badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
      dotClass: "bg-destructive",
    },
    waitlisted: {
      label: "Waitlisted",
      badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      dotClass: "bg-blue-500",
    },
    paid_waitlisted: {
      label: "Paid Waitlist",
      badgeClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      dotClass: "bg-indigo-500",
    },
    attended: {
      label: "Attended",
      badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
      dotClass: "bg-purple-500",
    },
    merchandise_collected: {
      label: "Merchandise Collected",
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    },
    merchandise_uncollected: {
      label: "Merchandise Uncollected",
      badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dotClass: "bg-amber-500",
    },
  };

const SECTION_ORDER = [
  "Personal & Contact Information",
  "Professional Background & Experience",
  "Technical Focus & Event Preferences",
  "Expectations & Community",
  "Payment & Ticket Details",
  "Commitment Fee & Attendance",
  "Consent & Code of Conduct",
  "Additional Questions",
];

const SECTION_ICONS: Record<string, LucideIcon> = {
  "Personal & Contact Information": User,
  "Professional Background & Experience": Briefcase,
  "Technical Focus & Event Preferences": Sparkles,
  "Expectations & Community": Heart,
  "Payment & Ticket Details": FileText,
  "Commitment Fee & Attendance": CheckCircle,
  "Consent & Code of Conduct": ShieldCheck,
  "Additional Questions": FileText,
};

function formatLabel(key: string, labelMap: Map<string, string>): string {
  const trimmed = key.trim();
  const mapped = labelMap.get(trimmed.toLowerCase());
  if (mapped) return mapped;

  if (/[A-Z]/.test(trimmed) && trimmed.includes(" ") && !trimmed.includes("_")) {
    return trimmed;
  }

  // Handle auto-generated IDs e.g. q_123456 or q_123456_abcde
  if (/^q_\d+/i.test(trimmed)) {
    return "Archived Form Question";
  }

  const words = trimmed
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "url") return "URL";
      if (lower === "id") return "ID";
      if (lower === "github") return "GitHub";
      if (lower === "linkedin") return "LinkedIn";
      if (lower === "whatsapp") return "WhatsApp";
      if (lower === "ai") return "AI";
      if (lower === "gdg") return "GDG";
      if (lower === "rsvp") return "RSVP";
      if (lower === "faq") return "FAQ";
      if (lower === "ui") return "UI";
      if (lower === "ux") return "UX";
      if (lower === "cv") return "CV";
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

  return words.join(" ") || trimmed;
}

function getTicketTierLabel(type?: string, price?: number): string {
  if (type === "free") return "Free RSVP";
  if (type === "paid") return `Rp ${(price ?? 0).toLocaleString("id-ID")}`;
  return `Commitment Fee (Rp ${(price ?? 0).toLocaleString("id-ID")})`;
}

function getRefundStatusBadgeLabel(status?: string): string {
  if (status === "waiting_for_approval") return "Waiting for Approval";
  if (status === "refund_completed") return "Refund Completed";
  if (status === "rejected") return "Rejected";
  return "Refund Requested";
}

function getRefundStatusShortLabel(status?: string): string {
  if (status === "waiting_for_approval") return "Refund Pending";
  if (status === "refund_completed") return "Refunded";
  if (status === "rejected") return "Refund Rejected";
  return "Refund Requested";
}

export function ApplicantDetailDialog({
  registration,
  event,
  isCurationMode,
  onClose,
  onStatusChange,
  onUpdateRegistration,
  onApprove,
  onReject,
  onApproveRefund,
  onRejectRefund,
  onResendInterestEmail,
  onResendWaitlistEmail,
  onResendPaidWaitlistEmail,
  onResendAcceptedEmail,
  onToggleCheckIn,
  onToggleMerchandiseCollected,
  onDelete,
  customQuestions = [],
  isPending = false,
  isCollectingMerch = false,
  isApproving = false,
  isRejecting = false,
  isWaitlisting = false,
  isResendingInterest = false,
  isResendingWaitlist = false,
  isResendingPaidWaitlist = false,
  isResendingAccepted = false,
  onCancelRegistration,
  isCancelling = false,
  allRegistrations = [],
  venueTicketFiles = [],
  onAssignVenueTicket,
  onSendVenueTicketEmail,
  isSendingVenueTicket = false,
}: ApplicantDetailDialogProps) {
  const isCuration = isCurationMode ?? isEventCurationMode(event);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedProfile, setCopiedProfile] = useState(false);
  const [isAssigningVenueTicket, setIsAssigningVenueTicket] = useState(false);
  const [loadedQuestions, setLoadedQuestions] = useState<CustomQuestion[]>([]);
  const [paymentLinkInfo, setPaymentLinkInfo] = useState<{ url: string; invoiceNumber: string } | null>(null);
  const [isResendPaymentOpen, setIsResendPaymentOpen] = useState(false);
  const [isCheckPaymentOpen, setIsCheckPaymentOpen] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState<ReferralOwnerInfo | null>(null);
  const [eventVouchersMap, setEventVouchersMap] = useState<Map<string, import("@/lib/firestore/types").EventVoucher>>(
    () => new Map(),
  );

  // Load private event_vouchers if this registration is a bundle purchaser or redeemed a voucher
  useEffect(() => {
    const eventId = registration?.event_id || event?.id;
    const hasBundleVouchers = Array.isArray(registration?.bundle_vouchers) && registration.bundle_vouchers.length > 0;
    const hasVoucherCode = Boolean(registration?.voucher_code?.trim());

    if (!eventId || (!hasBundleVouchers && !hasVoucherCode)) {
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const { getEventVouchers } = await import("@/lib/firestore/client");
        const list = await getEventVouchers(String(eventId));
        if (isMounted && list.length > 0) {
          const vMap = new Map<string, import("@/lib/firestore/types").EventVoucher>();
          for (const v of list) {
            vMap.set(v.code.trim().toUpperCase(), v);
          }
          setEventVouchersMap(vMap);
        }
      } catch (err) {
        console.warn("[ApplicantDetailDialog] Could not fetch event vouchers:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [registration?.event_id, registration?.bundle_vouchers, registration?.voucher_code, event?.id]);

  // Compute live bundle friend vouchers redemption status by cross-referencing event registrations and voucher docs
  const resolvedBundleVouchers = useMemo(() => {
    if (!registration || !Array.isArray(registration.bundle_vouchers)) return [];

    let hasDifferences = false;

    const list = registration.bundle_vouchers.map((bv) => {
      const cleanCode = (bv.code || "").trim().toUpperCase();

      let isRedeemed = bv.status === "redeemed";
      let redeemedByName = bv.redeemed_by_name;
      let redeemedByEmail = bv.redeemed_by_email;
      let redeemedAt = bv.redeemed_at;

      // 1. Cross-reference with allRegistrations in the event
      if (allRegistrations && allRegistrations.length > 0) {
        const claimingReg = allRegistrations.find(
          (r) =>
            r.voucher_code?.trim().toUpperCase() === cleanCode &&
            r.status !== "canceled" &&
            r.status !== "cancelled" &&
            r.refund_request?.status !== "refund_completed",
        );
        if (claimingReg) {
          isRedeemed = true;
          redeemedByName = claimingReg.member_name || redeemedByName;
          redeemedByEmail = claimingReg.member_email || redeemedByEmail;
          redeemedAt = claimingReg.registered_at || redeemedAt;
        }
      }

      // 2. Cross-reference with event_vouchers
      const vDoc = eventVouchersMap.get(cleanCode);
      if (vDoc && ((vDoc.times_used ?? 0) > 0 || vDoc.redeemed_by_name || vDoc.redeemed_by_email)) {
        isRedeemed = true;
        redeemedByName = vDoc.redeemed_by_name || redeemedByName;
        redeemedByEmail = vDoc.redeemed_by_email || redeemedByEmail;
        redeemedAt = vDoc.redeemed_at || redeemedAt;
      }

      if (isRedeemed && bv.status !== "redeemed") {
        hasDifferences = true;
      }

      const voucherItem: BundleIssuedVoucher = {
        ...bv,
        status: (isRedeemed ? "redeemed" : "available") as "available" | "redeemed",
      };
      if (redeemedByName) voucherItem.redeemed_by_name = redeemedByName;
      else delete voucherItem.redeemed_by_name;
      if (redeemedByEmail) voucherItem.redeemed_by_email = redeemedByEmail;
      else delete voucherItem.redeemed_by_email;
      if (redeemedAt) voucherItem.redeemed_at = redeemedAt;
      else delete voucherItem.redeemed_at;

      return voucherItem;
    });

    // Auto-heal purchaser registration document in Firestore if any vouchers were claimed
    if (hasDifferences && registration.id && typeof window !== "undefined") {
      void (async () => {
        try {
          const { updateDoc, doc } = await import("firebase/firestore");
          const { db, sanitizeFirestoreData } = await import("@/lib/firestore/client");
          const purchaserRegRef = doc(db, "event_registrations", registration.id);
          const sanitizedPayload = sanitizeFirestoreData({
            bundle_vouchers: list,
            updated_at: new Date().toISOString(),
          });
          await updateDoc(purchaserRegRef, sanitizedPayload);
          onUpdateRegistration?.({ ...registration, bundle_vouchers: list });
        } catch (healErr) {
          console.warn("[ApplicantDetailDialog] Could not background-heal bundle vouchers:", healErr);
        }
      })();
    }

    return list;
  }, [registration, allRegistrations, eventVouchersMap, onUpdateRegistration]);

  // Applied voucher document (if found in event vouchers or event.vouchers)
  const appliedVoucherDoc = useMemo(() => {
    const code = registration?.voucher_code?.trim().toUpperCase();
    if (!code) return null;
    return eventVouchersMap.get(code) ?? event?.vouchers?.find((v) => v.code.trim().toUpperCase() === code) ?? null;
  }, [registration?.voucher_code, eventVouchersMap, event?.vouchers]);

  // Buyer of the bundle that issued this registration's voucher
  const bundleBuyer = useMemo(() => {
    const code = registration?.voucher_code?.trim().toUpperCase();
    if (!code) return null;

    // 1. Direct cross-reference with allRegistrations in the event
    const regBuyer = allRegistrations.find(
      (r) => r.id !== registration?.id && r.bundle_vouchers?.some((bv) => bv.code?.trim().toUpperCase() === code),
    );
    if (regBuyer) return regBuyer;

    // 2. Cross-reference using source_registration_id / purchaser_member_id from voucher doc
    if (appliedVoucherDoc?.source_registration_id) {
      const byRegId = allRegistrations.find((r) => r.id === appliedVoucherDoc.source_registration_id);
      if (byRegId) return byRegId;
    }
    if (appliedVoucherDoc?.purchaser_member_id) {
      const byMemberId = allRegistrations.find((r) => r.member_id === appliedVoucherDoc.purchaser_member_id);
      if (byMemberId) return byMemberId;
    }

    // 3. Fallback mock object if purchaser name/email exists in voucher document
    if (appliedVoucherDoc?.purchaser_name || appliedVoucherDoc?.purchaser_email) {
      return {
        id: appliedVoucherDoc.source_registration_id || "bundle-purchaser",
        event_id: registration?.event_id || "",
        event_title: registration?.event_title || "",
        member_id: appliedVoucherDoc.purchaser_member_id || "",
        member_name: appliedVoucherDoc.purchaser_name || "Bundle Purchaser",
        member_email: appliedVoucherDoc.purchaser_email || "",
        status: "approved" as RegistrationStatus,
        registered_at: appliedVoucherDoc.created_at || "",
        bundle_name: "Ticket Bundle",
      } as FirestoreRegistration;
    }

    return null;
  }, [
    registration?.id,
    registration?.event_id,
    registration?.event_title,
    registration?.voucher_code,
    allRegistrations,
    appliedVoucherDoc,
  ]);

  // Description of the applied voucher
  const voucherDescription = useMemo(() => {
    if (appliedVoucherDoc?.description) {
      return appliedVoucherDoc.description;
    }
    if (bundleBuyer) {
      const bundleLabel = bundleBuyer.bundle_name || "Ticket Bundle";
      return `100% Ticket Pass sponsored by ${bundleBuyer.member_name || "Bundle Purchaser"} (${bundleLabel})`;
    }
    return null;
  }, [appliedVoucherDoc, bundleBuyer]);

  // Fetch referrer profile ("Who does the referral belong to") if referral code was used
  useEffect(() => {
    if (!registration?.referral_code) {
      setReferrerInfo(null);
      return;
    }

    let active = true;
    async function loadReferrer() {
      if (!registration?.referral_code) return;
      try {
        const { getReferralOwnerAction } = await import("@/lib/firestore/actions");
        const info = await getReferralOwnerAction(registration.referral_code, registration.referrer_member_id);
        if (active && info) {
          setReferrerInfo(info);
        }
      } catch (err) {
        console.warn("[ApplicantDetailDialog] Could not fetch referral owner:", err);
      }
    }

    void loadReferrer();
    return () => {
      active = false;
    };
  }, [registration?.referral_code, registration?.referrer_member_id]);

  // Hydrate custom questions from Firestore if not provided
  useEffect(() => {
    if (customQuestions && customQuestions.length > 0) return;
    if (!registration?.event_id) return;

    let active = true;
    async function fetchQuestions() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const eventDoc = await getFirestoreEventById(String(registration?.event_id));
        if (active && eventDoc?.custom_questions && eventDoc.custom_questions.length > 0) {
          setLoadedQuestions(eventDoc.custom_questions);
        }
      } catch (err) {
        console.warn("[ApplicantDetailDialog] Could not fetch event questions:", err);
      }
    }
    void fetchQuestions();
    return () => {
      active = false;
    };
  }, [customQuestions, registration?.event_id]);

  const effectiveQuestions = customQuestions && customQuestions.length > 0 ? customQuestions : loadedQuestions;

  // Label and Section mapping
  const { labelMap, sectionMap } = useMemo(() => {
    const lMap = new Map<string, string>();
    const sMap = new Map<string, string>();

    for (const q of DEFAULT_COMBINED_QUESTIONS) {
      if (q.id && q.label) {
        const idLower = q.id.toLowerCase().trim();
        lMap.set(idLower, q.label);
        if (q.section) {
          sMap.set(idLower, q.section);
        }
      }
    }

    for (const q of effectiveQuestions) {
      if (q.id && q.label) {
        const idLower = q.id.toLowerCase().trim();
        lMap.set(idLower, q.label);
        if (q.section) {
          sMap.set(idLower, q.section);
        }
      }
    }

    return { labelMap: lMap, sectionMap: sMap };
  }, [effectiveQuestions]);

  // Grouped answers
  const groupedSections = useMemo(() => {
    if (!registration?.answers) return [];

    const sections = new Map<string, Array<{ key: string; label: string; value: unknown }>>();

    for (const [key, value] of Object.entries(registration.answers)) {
      if (key === "session_id" || key === "session_title") continue;
      if (value === undefined || value === null || value === "") continue;

      const keyLower = key.toLowerCase().trim();
      let sectionName = sectionMap.get(keyLower);

      if (!sectionName) {
        if (
          keyLower.includes("whatsapp") ||
          keyLower.includes("phone") ||
          keyLower.includes("gender") ||
          keyLower.includes("contact") ||
          keyLower.includes("email")
        ) {
          sectionName = "Personal & Contact Information";
        } else if (
          keyLower.includes("experience") ||
          keyLower.includes("background") ||
          keyLower.includes("company") ||
          keyLower.includes("institution") ||
          keyLower.includes("role") ||
          keyLower.includes("title") ||
          keyLower.includes("github") ||
          keyLower.includes("linkedin") ||
          keyLower.includes("portfolio")
        ) {
          sectionName = "Professional Background & Experience";
        } else if (
          keyLower.includes("interest") ||
          keyLower.includes("hobby") ||
          keyLower.includes("expectation") ||
          keyLower.includes("referral") ||
          keyLower.includes("know_about")
        ) {
          sectionName = "Expectations & Community";
        } else {
          sectionName = "Additional Questions";
        }
      }

      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }

      sections.get(sectionName)?.push({
        key,
        label: formatLabel(key, labelMap),
        value,
      });
    }

    return Array.from(sections.entries()).sort(([a], [b]) => {
      const indexA = SECTION_ORDER.indexOf(a);
      const indexB = SECTION_ORDER.indexOf(b);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [registration?.answers, labelMap, sectionMap]);

  // Status logs guarantee: ensure paid_and_registered entry exists for paid registrations & deduplicate consecutive identical expired logs
  const effectiveStatusLogs = useMemo(() => {
    if (!registration) return [];
    const rawLogs = Array.isArray(registration.status_logs) ? registration.status_logs : [];
    const logs = rawLogs.filter((log, idx, arr) => {
      if (idx === 0) return true;
      const prev = arr[idx - 1];
      if (
        log.status === "expired" &&
        prev.status === "expired" &&
        log.notes === prev.notes &&
        log.changed_by_name === prev.changed_by_name
      ) {
        return false;
      }
      return true;
    });

    const isPaid =
      registration.status === "paid_and_registered" ||
      String(registration.payment_status).toLowerCase() === "paid" ||
      Boolean(registration.paid_at) ||
      String(registration.answers?.payment_status).toLowerCase() === "paid";

    const hasPaidLog = logs.some((l) => l.status === "paid_and_registered");

    if (isPaid && !hasPaidLog) {
      const invoiceNum =
        registration.payment_invoice_number ??
        (registration.answers?.payment_invoice_number as string | undefined) ??
        (registration.answers?.invoice_number as string | undefined);
      const channel =
        registration.payment_channel ?? (registration.answers?.payment_channel as string | undefined) ?? "QRIS";
      const paidTime =
        registration.paid_at || registration.reviewed_at || registration.updated_at || new Date().toISOString();

      logs.push({
        id: `synthetic_paid_${registration.id}`,
        status: "paid_and_registered",
        previous_status: "waiting_for_payment",
        changed_at: paidTime,
        changed_by_id: registration.reviewed_by_id || "doku_payment_gateway",
        changed_by_name: registration.reviewed_by_name || "DOKU Payment Gateway",
        changed_by_email: registration.reviewed_by_email,
        notes: `Payment confirmed via ${channel}${invoiceNum ? ` (${invoiceNum})` : ""}. Status: Paid & Registered.`,
      });
    }

    return logs;
  }, [registration]);

  // Self-heal missing paid_and_registered status log or duplicate expired logs in Firestore
  useEffect(() => {
    if (!registration?.id) return;
    const isPaid =
      registration.status === "paid_and_registered" ||
      String(registration.payment_status).toLowerCase() === "paid" ||
      Boolean(registration.paid_at) ||
      String(registration.answers?.payment_status).toLowerCase() === "paid";

    const rawLogs = Array.isArray(registration.status_logs) ? registration.status_logs : [];
    const hasPaidLog = rawLogs.some((l) => l.status === "paid_and_registered");
    const hasDuplicateExpired = effectiveStatusLogs.length < rawLogs.length;

    if ((isPaid && !hasPaidLog && effectiveStatusLogs.length > rawLogs.length) || hasDuplicateExpired) {
      if (onUpdateRegistration) {
        onUpdateRegistration({
          ...registration,
          status_logs: effectiveStatusLogs,
        });
      }
      import("@/lib/firestore/client")
        .then(({ updateRegistrationStatusLogsInFirestore }) => {
          if (updateRegistrationStatusLogsInFirestore) {
            void updateRegistrationStatusLogsInFirestore(registration.id, effectiveStatusLogs);
          }
        })
        .catch(() => {
          // ignore background self-heal errors
        });
    }
  }, [registration, effectiveStatusLogs, onUpdateRegistration]);

  if (!registration) return null;

  const deadlineInfo = getRegistrationPaymentDeadline(registration, event);
  const effectiveStatus = getEffectiveRegistrationStatus(registration, event);
  const rawStatus = ((effectiveStatus as string) || "").toLowerCase().trim();
  const statusMeta =
    STATUS_VARIANTS[rawStatus as RegistrationStatus] ||
    (rawStatus === "confirmed" || rawStatus === "registered" ? STATUS_VARIANTS.approved : STATUS_VARIANTS.pending);

  const formattedDate = formatFirestoreDate(registration.registered_at, "dd MMM yyyy, h:mm a");

  const handleCopy = (text: string, labelText: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${labelText} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyFullProfile = () => {
    const lines: string[] = [
      `Name: ${registration.member_name}`,
      `Email: ${registration.member_email}`,
      `Status: ${statusMeta.label}`,
      `Registered At: ${formattedDate}`,
    ];

    const currentInvoice =
      paymentLinkInfo?.invoiceNumber ||
      registration.payment_invoice_number ||
      (registration.answers?.payment_invoice_number as string | undefined) ||
      (registration.answers?.invoice_number as string | undefined) ||
      `INV-${registration.id}`;

    if (currentInvoice) {
      lines.push(`Invoice Number: ${currentInvoice}`);
    }

    if (registration.attendee_code || registration.bevy_attendee_id) {
      lines.push(`Ticket Code: ${registration.attendee_code ?? `#${registration.bevy_attendee_id}`}`);
    }

    if (registration.session_title || (registration.answers?.session_title as string)) {
      lines.push(`Session Track: ${registration.session_title ?? String(registration.answers?.session_title ?? "")}`);
    }

    if (registration.answers) {
      lines.push("\nQuestion Responses:");
      for (const [k, v] of Object.entries(registration.answers)) {
        if (k === "session_id" || k === "session_title") continue;
        lines.push(`• ${formatLabel(k, labelMap)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
      }
    }

    if (registration.refund_request) {
      const refReq = registration.refund_request;
      lines.push("\nRefund Request Application:");
      lines.push(`• Status: ${refReq.status}`);
      lines.push(`• Refund Amount: ${formatRupiah(getRegistrationRefundAmount(registration, event))}`);
      lines.push(`• Bank: ${refReq.bank_name}`);
      lines.push(`• Account: ${refReq.bank_account_number} (a/n ${refReq.bank_account_name})`);
      lines.push(`• Reason: ${refReq.cancellation_reason}`);
      if (refReq.proof_media_url) {
        lines.push(`• Proof Document: ${refReq.proof_media_url}`);
      }
    }

    void navigator.clipboard.writeText(lines.join("\n"));
    setCopiedProfile(true);
    toast.success("Complete applicant profile copied to clipboard");
    setTimeout(() => setCopiedProfile(false), 2000);
  };

  const renderResponseValue = (key: string, value: unknown) => {
    const keyLower = key.toLowerCase();
    const strVal = String(value);

    // Boolean responses
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
          <XCircle className="size-3 opacity-60" />
          No
        </Badge>
      );
    }

    // Media / File Uploads
    if (
      strVal.includes("/api/media/") ||
      strVal.includes("temp/") ||
      /\.(png|jpe?g|webp|gif|svg|avif|pdf|doc|docx|zip)(\?.*)?$/i.test(strVal)
    ) {
      const isImg = /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(strVal);
      const fileName = strVal.split("/").pop() || "Uploaded File";
      return (
        <div className="flex flex-col gap-2">
          {isImg && (
            <div className="relative h-32 w-full max-w-xs overflow-hidden rounded-md border border-border/70 bg-muted/30">
              <Image
                src={strVal}
                alt={fileName}
                fill
                unoptimized
                className="size-full object-cover"
                sizes="(max-width: 768px) 100vw, 320px"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <a
              href={strVal}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 truncate font-medium text-primary text-xs hover:underline"
              title={strVal}
            >
              {isImg ? (
                <ImageIcon className="size-3.5 shrink-0 text-primary" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-primary" />
              )}
              <span className="truncate">{fileName}</span>
              <ExternalLink className="size-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
              title="Copy link"
              onClick={() => handleCopy(strVal, "File link", key)}
            >
              {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </Button>
          </div>
        </div>
      );
    }

    // URL / Links
    if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
      return (
        <div className="flex items-center justify-between gap-2">
          <a
            href={strVal}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 break-all font-medium text-primary text-xs hover:underline"
          >
            <Globe className="size-3.5 shrink-0 opacity-80" />
            <span className="truncate">{strVal}</span>
            <ExternalLink className="size-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            title="Copy link"
            onClick={() => handleCopy(strVal, "Link", key)}
          >
            {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          </Button>
        </div>
      );
    }

    // Phone / WhatsApp
    if (keyLower.includes("whatsapp") || keyLower.includes("phone")) {
      const cleanPhone = strVal.replace(/[^0-9]/g, "");
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground text-xs tracking-wide sm:text-sm">{strVal}</span>
          <div className="flex items-center gap-1">
            {cleanPhone.length >= 8 && (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <Phone className="size-3" />
                Chat WhatsApp
              </a>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-6 text-muted-foreground hover:text-foreground"
              title="Copy phone"
              onClick={() => handleCopy(strVal, "Phone number", key)}
            >
              {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </Button>
          </div>
        </div>
      );
    }

    // Email
    if (keyLower.includes("email")) {
      return (
        <div className="flex items-center justify-between gap-2">
          <a href={`mailto:${strVal}`} className="truncate font-medium text-primary text-xs hover:underline">
            {strVal}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            title="Copy email"
            onClick={() => handleCopy(strVal, "Email", key)}
          >
            {copiedKey === key ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          </Button>
        </div>
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
                  className="inline-flex max-w-full items-center gap-1 break-words rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs"
                >
                  <span className="shrink-0 font-semibold text-primary">Other:</span>
                  <span className="break-words text-foreground">{customVal || "Custom"}</span>
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
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 font-medium text-primary text-xs">
            Other
          </Badge>
          <span className="font-medium text-foreground text-xs sm:text-sm">{customVal || "(None specified)"}</span>
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
        strVal === "Non-Tech" ||
        strVal === "Yes" ||
        strVal === "No")
    ) {
      return (
        <Badge variant="outline" className="border-border/80 bg-muted/40 font-medium text-foreground text-xs">
          {strVal}
        </Badge>
      );
    }

    // Longer paragraphs / open text
    if (strVal.length > 60 || strVal.includes("\n")) {
      return (
        <div className="whitespace-pre-wrap rounded-md border border-border/50 bg-muted/30 p-2.5 text-foreground text-xs leading-relaxed">
          {strVal}
        </div>
      );
    }

    // Standard string
    return <span className="font-medium text-foreground text-xs sm:text-sm">{strVal}</span>;
  };

  const hasPayableItems = Boolean(
    registration?.selected_merchandise?.some((m) => (m.price ?? 0) > 0) ||
      (registration?.ticket_type === "paid" && (registration.ticket_price ?? 0) > 0) ||
      (registration?.ticket_type === "commitment_fee" && (registration.ticket_price ?? 0) > 0),
  );

  const invoiceNumber =
    paymentLinkInfo?.invoiceNumber ||
    registration?.payment_invoice_number ||
    (registration?.answers?.payment_invoice_number as string | undefined) ||
    (registration?.answers?.invoice_number as string | undefined) ||
    (hasPayableItems || registration?.payment_amount ? `INV-${registration?.id}` : undefined);

  const effectivePaymentUrl = paymentLinkInfo?.url || registration?.payment_url;

  return (
    <>
      <Dialog open={Boolean(registration)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">
          {/* Scrollable Dossier Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Header Bar */}
            <div className="border-b bg-muted/20 px-6 pt-5 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
                <div className="flex items-start gap-3.5 pr-8 sm:pr-0">
                  <Avatar className="size-12 shrink-0 rounded-full border border-border shadow-xs">
                    <AvatarImage src={registration.member_avatar} alt={registration.member_name} />
                    <AvatarFallback className="font-semibold text-sm">
                      {getInitials(registration.member_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <DialogTitle className="font-bold text-foreground text-lg tracking-tight">
                      {registration.member_name}
                    </DialogTitle>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3.5" />
                        {registration.member_email}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {Boolean(registration.refund_request) && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 px-2.5 py-1 font-semibold text-xs",
                        registration.refund_request?.status === "waiting_for_approval" &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        registration.refund_request?.status === "refund_completed" &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        registration.refund_request?.status === "rejected" &&
                          "border-destructive/40 bg-destructive/10 text-destructive",
                      )}
                    >
                      <RotateCcw className="size-3" />
                      <span>{getRefundStatusShortLabel(registration.refund_request?.status)}</span>
                    </Badge>
                  )}

                  <Badge
                    variant="outline"
                    className={cn("gap-1.5 border px-2.5 py-1 font-semibold text-xs", statusMeta.badgeClass)}
                  >
                    <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
                    {statusMeta.label}
                  </Badge>

                  {(rawStatus === "approved" ||
                    rawStatus === "paid_and_registered" ||
                    rawStatus === "paid_registered" ||
                    rawStatus === "confirmed" ||
                    rawStatus === "registered" ||
                    rawStatus === "attended") &&
                    registration.status !== "canceled" &&
                    registration.status !== "cancelled" &&
                    registration.refund_request?.status !== "refund_completed" &&
                    registration.payment_status !== "refunded" &&
                    onResendAcceptedEmail && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 border-emerald-500/30 px-2.5 text-emerald-600 text-xs hover:bg-emerald-500/10 dark:text-emerald-400"
                        disabled={isPending || isResendingAccepted}
                        onClick={() => onResendAcceptedEmail(registration)}
                        title="Resend Accepted / Ticket Confirmation email"
                      >
                        {isResendingAccepted ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Mail className="size-3" />
                        )}
                        <span>{isResendingAccepted ? "Resending..." : "Resend Ticket Email"}</span>
                      </Button>
                    )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs"
                    onClick={handleCopyFullProfile}
                    title="Copy attendee dossier"
                  >
                    {copiedProfile ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copiedProfile ? "Copied" : "Copy Profile"}</span>
                  </Button>
                </div>
              </div>

              <DialogDescription className="sr-only">
                Detailed applicant dossier with submitted questions, track selection, and contact details.
              </DialogDescription>

              {/* Compact Metadata Attributes Strip */}
              <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Refund Request Overview Strip if present */}
                {Boolean(registration.refund_request) && (
                  <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <RotateCcw className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span className="shrink-0 text-[11px] text-muted-foreground">Refund Claim:</span>
                      <span className="truncate font-semibold text-rose-600 dark:text-rose-400">
                        {formatRupiah(getRegistrationRefundAmount(registration, event))}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-semibold text-[10px]",
                        registration.refund_request?.status === "waiting_for_approval" &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        registration.refund_request?.status === "refund_completed" &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        registration.refund_request?.status === "rejected" &&
                          "border-destructive/40 bg-destructive/10 text-destructive",
                      )}
                    >
                      {getRefundStatusBadgeLabel(registration.refund_request?.status)}
                    </Badge>
                  </div>
                )}
                {/* Session Track Banner if present */}
                {Boolean(
                  registration.session_title ?? registration.session_id ?? registration.answers?.session_title,
                ) && (
                  <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <Layers className="size-3.5 shrink-0 text-primary" />
                      <span className="shrink-0 text-[11px] text-muted-foreground">Track:</span>
                      <span className="truncate font-semibold text-primary">
                        {registration.session_title ??
                          String(registration.answers?.session_title ?? "") ??
                          `Track ID: ${registration.session_id}`}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-medium text-[10px]">
                      Assigned
                    </Badge>
                  </div>
                )}

                {/* Ticket Pass Details if present */}
                {Boolean(registration.ticket_name ?? registration.ticket_type) && (
                  <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <Ticket className="size-3.5 shrink-0 text-primary" />
                      <span className="shrink-0 text-[11px] text-muted-foreground">Ticket:</span>
                      <span className="truncate font-semibold text-foreground">
                        {registration.ticket_name ?? "General Pass"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 px-1.5 py-0 font-semibold text-[10px]",
                        registration.ticket_type === "free" &&
                          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                        registration.ticket_type === "paid" &&
                          "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                        registration.ticket_type === "commitment_fee" &&
                          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {getTicketTierLabel(registration.ticket_type, registration.ticket_price)}
                    </Badge>
                  </div>
                )}

                {/* Invoice Number Reference */}
                {Boolean(invoiceNumber) && (
                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <FileText className="size-3.5 shrink-0 text-primary" />
                      <span className="shrink-0 text-[11px] text-muted-foreground">Invoice:</span>
                      <span className="truncate font-mono font-semibold text-[11px] text-foreground">
                        {invoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(rawStatus === "waiting_for_payment" || rawStatus === "expired") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-6 gap-1 border-emerald-500/30 px-2 font-medium text-[11px] text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                          title="Check live DOKU payment status"
                          onClick={() => setIsCheckPaymentOpen(true)}
                        >
                          <CreditCard className="size-3" />
                          <span>Check Status</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Copy invoice number"
                        onClick={() => handleCopy(invoiceNumber ?? "", "Invoice number", "invoice_number")}
                      >
                        {copiedKey === "invoice_number" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Bevy Ticket Code & Attendee ID */}
                {Boolean(registration.attendee_code ?? registration.bevy_attendee_id) && (
                  <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <QrCode className="size-3.5 shrink-0 text-primary" />
                      <span className="shrink-0 text-[11px] text-muted-foreground">Ticket Code:</span>
                      <span className="truncate font-mono font-semibold text-[11px] text-primary">
                        {registration.attendee_code ?? `#${registration.bevy_attendee_id}`}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {registration.bevy_attendee_id && (
                        <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[10px]">
                          Bevy #{registration.bevy_attendee_id}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        title="Copy ticket code"
                        onClick={() =>
                          handleCopy(
                            registration.attendee_code ?? String(registration.bevy_attendee_id),
                            "Ticket code",
                            "ticket_code",
                          )
                        }
                      >
                        {copiedKey === "ticket_code" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Bevy On-Site Check-In Status & Action */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 font-medium text-[11px] text-muted-foreground">Check-In:</span>
                    {registration.is_checked_in ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 font-medium text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        <UserCheck className="size-3" /> Checked In
                        {registration.checked_in_at && ` • ${registration.checked_in_at}`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not Checked In
                      </Badge>
                    )}
                  </div>

                  {onToggleCheckIn &&
                    (() => {
                      const isEligibleForCheckIn =
                        rawStatus === "paid_and_registered" ||
                        rawStatus === "paid_registered" ||
                        rawStatus === "approved" ||
                        rawStatus === "registered" ||
                        registration.status === "paid_and_registered" ||
                        registration.status === "approved" ||
                        registration.status === "registered" ||
                        (registration.status as string) === "paid_registered";
                      const canToggleCheckIn = Boolean(registration.is_checked_in) || isEligibleForCheckIn;
                      return (
                        <Button
                          size="sm"
                          variant={registration.is_checked_in ? "ghost" : "outline"}
                          className={cn(
                            "h-6 px-2 text-[11px]",
                            registration.is_checked_in
                              ? "text-muted-foreground hover:text-destructive"
                              : "border-primary/30 text-primary hover:bg-primary/5",
                          )}
                          disabled={isPending || !canToggleCheckIn}
                          title={
                            !canToggleCheckIn
                              ? "Check-in is only enabled when status is Paid & Registered, Approved, or Registered"
                              : undefined
                          }
                          onClick={() => onToggleCheckIn(registration, !registration.is_checked_in)}
                        >
                          {registration.is_checked_in ? (
                            <>
                              <RotateCcw className="mr-1 size-2.5" />
                              Undo
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-1 size-2.5" />
                              Check In
                            </>
                          )}
                        </Button>
                      );
                    })()}
                </div>

                {/* Bundling Package Details if registered via bundle */}
                {Boolean(registration.bundle_name) && (
                  <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <PackageCheck className="size-3.5 shrink-0 text-primary" />
                        <span className="shrink-0 font-medium text-[11px] text-muted-foreground">Package:</span>
                        <span className="truncate font-semibold text-[11px] text-foreground">
                          {registration.bundle_name}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-primary/30 bg-primary/10 font-semibold text-[10px] text-primary"
                      >
                        {(() => {
                          if (registration.bundle_price === undefined || registration.bundle_price === null) {
                            return "Combo Package";
                          }
                          if (registration.bundle_price === 0) {
                            return "Free Bundle";
                          }
                          return `Rp ${registration.bundle_price.toLocaleString("id-ID")}`;
                        })()}
                      </Badge>
                    </div>

                    {/* Generated Friend Vouchers from Bundle */}
                    {resolvedBundleVouchers.length > 0 && (
                      <div className="space-y-1.5 border-primary/20 border-t pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-muted-foreground">
                            Generated Friend Vouchers ({resolvedBundleVouchers.length}):
                          </span>
                          <span className="font-semibold text-[10px] text-primary">
                            {resolvedBundleVouchers.filter((v) => v.status === "redeemed").length} /{" "}
                            {resolvedBundleVouchers.length} claimed
                          </span>
                        </div>
                        <div className="space-y-1">
                          {resolvedBundleVouchers.map((bv, idx) => {
                            const isRedeemed = bv.status === "redeemed";
                            return (
                              <div
                                key={bv.code || idx}
                                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 bg-background/70 px-2 py-1 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold font-mono text-foreground">{bv.code}</span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "px-1 py-0 text-[9px]",
                                      isRedeemed
                                        ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                    )}
                                  >
                                    {isRedeemed ? "Claimed" : "Available"}
                                  </Badge>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {isRedeemed ? (
                                    <span className="font-medium text-foreground">
                                      by {bv.redeemed_by_name || bv.redeemed_by_email || "Attendee"}
                                    </span>
                                  ) : (
                                    <span>Unclaimed</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Merchandise Add-on Details if present */}
                {Boolean(registration.selected_merchandise && registration.selected_merchandise.length > 0) && (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                    <div className="flex items-center justify-between border-b pb-1.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Package className="size-3.5 text-primary" />
                        <span>Merchandise & Swag Orders</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {registration.selected_merchandise?.reduce((sum, it) => sum + (it.quantity || 1), 0)} items
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {registration.selected_merchandise?.map((item, idx) => {
                        const variations = parseMerchandiseVariations(item, registration.answers);
                        return (
                          <div
                            key={item.id || idx}
                            className="flex flex-col justify-between gap-1.5 rounded-md border border-border/40 bg-background/60 p-2 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-col gap-1">
                              <div className="flex items-center gap-1.5 font-medium text-[11px] text-foreground">
                                <span className="font-semibold text-primary">{item.quantity || 1}x</span>
                                <span className="truncate">{item.name}</span>
                              </div>
                              {variations.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  {variations.map((v) => (
                                    <Badge
                                      key={v.key + v.value}
                                      variant="outline"
                                      className={cn(
                                        "h-4.5 px-1.5 py-0 font-medium text-[10px]",
                                        v.isSize
                                          ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                                          : "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
                                      )}
                                    >
                                      {v.label ? `${v.label}: ` : ""}
                                      {v.value}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className="w-fit shrink-0 self-start font-mono text-[10px] text-muted-foreground sm:self-auto"
                            >
                              {item.price
                                ? `Rp ${(item.price * (item.quantity || 1)).toLocaleString("id-ID")}`
                                : "Free Perk"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>

                    {/* Merchandise Collection Status & Action */}
                    {(() => {
                      const hasAttendeeMerch = Boolean(
                        registration.selected_merchandise && registration.selected_merchandise.length > 0,
                      );
                      const isPaidAndRegistered =
                        rawStatus === "paid_and_registered" ||
                        rawStatus === "paid_registered" ||
                        registration.status === "paid_and_registered" ||
                        (registration.status as string) === "paid_registered";
                      const canCollectMerch =
                        Boolean(registration.is_merchandise_collected) || (hasAttendeeMerch && isPaidAndRegistered);

                      return (
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-border/50 border-t pt-2.5">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="shrink-0 font-medium text-[11px] text-muted-foreground">
                                Collection:
                              </span>
                              {registration.is_merchandise_collected ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 font-medium text-[10px] text-emerald-600 dark:text-emerald-400"
                                >
                                  <PackageCheck className="size-3" /> Collected
                                  {registration.merchandise_collected_at &&
                                    ` • ${formatFirestoreDate(registration.merchandise_collected_at, "dd MMM yyyy, HH:mm")}`}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Not Collected
                                </Badge>
                              )}
                            </div>
                            {registration.is_merchandise_collected && registration.merchandise_collected_by_name && (
                              <span className="text-[10px] text-muted-foreground">
                                Marked by{" "}
                                <span className="font-semibold text-foreground">
                                  {registration.merchandise_collected_by_name}
                                </span>
                              </span>
                            )}
                          </div>

                          {onToggleMerchandiseCollected && (
                            <Button
                              size="sm"
                              variant={registration.is_merchandise_collected ? "ghost" : "outline"}
                              className={cn(
                                "h-6 px-2 text-[11px]",
                                registration.is_merchandise_collected
                                  ? "text-muted-foreground hover:text-destructive"
                                  : "border-primary/30 text-primary hover:bg-primary/5",
                              )}
                              disabled={isPending || isCollectingMerch || !canCollectMerch}
                              title={
                                !canCollectMerch
                                  ? "Collection is only enabled when attendee has merchandise and status is Paid & Registered"
                                  : undefined
                              }
                              onClick={() =>
                                onToggleMerchandiseCollected(registration, !registration.is_merchandise_collected)
                              }
                            >
                              {isCollectingMerch && <Loader2 className="mr-1 size-2.5 animate-spin" />}
                              {!isCollectingMerch && registration.is_merchandise_collected && (
                                <>
                                  <RotateCcw className="mr-1 size-2.5" />
                                  Undo
                                </>
                              )}
                              {!isCollectingMerch && !registration.is_merchandise_collected && (
                                <>
                                  <PackageCheck className="mr-1 size-2.5" />
                                  Collected
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Voucher Discount Details & Ownership if applied */}
                {Boolean(registration.voucher_code) && (
                  <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Tag className="size-3.5 shrink-0 text-primary" />
                        <span className="shrink-0 font-medium text-[11px] text-muted-foreground">Voucher:</span>
                        <span className="truncate font-mono font-semibold text-[11px] text-foreground">
                          {registration.voucher_code}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-5 text-muted-foreground hover:text-foreground"
                          title="Copy voucher code"
                          onClick={() => handleCopy(registration.voucher_code ?? "", "Voucher code", "voucher_code")}
                        >
                          {copiedKey === "voucher_code" ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>

                      <Badge
                        variant="outline"
                        className="shrink-0 border-primary/30 bg-primary/10 font-mono font-semibold text-[10px] text-primary"
                      >
                        -Rp {(registration.voucher_discount_amount ?? 0).toLocaleString("id-ID")}
                      </Badge>
                    </div>

                    {/* Voucher Description */}
                    {voucherDescription && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{voucherDescription}</p>
                    )}

                    {/* Bundle Buyer ("Belongs to") */}
                    {bundleBuyer && (
                      <div className="flex items-center justify-between rounded-md border border-primary/20 bg-background/80 px-2.5 py-1.5 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-6 shrink-0 border border-border/60">
                            <AvatarImage
                              src={bundleBuyer.member_avatar ?? undefined}
                              alt={bundleBuyer.member_name || "Bundle Buyer"}
                            />
                            <AvatarFallback className="font-semibold text-[9px]">
                              {getInitials(bundleBuyer.member_name || "Buyer")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 text-[10px] text-muted-foreground">Belongs to:</span>
                              <span className="truncate font-semibold text-[11px] text-foreground">
                                {bundleBuyer.member_name}
                              </span>
                            </div>
                            {Boolean(bundleBuyer.member_email) && (
                              <span className="truncate text-[10px] text-muted-foreground">
                                {bundleBuyer.member_email}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">
                          {bundleBuyer.bundle_name || "Bundle Buyer"}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* Referral Code & Ownership Details if applied */}
                {Boolean(registration.referral_code) && (
                  <div className="flex flex-col gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Sparkles className="size-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                        <span className="shrink-0 font-medium text-[11px] text-muted-foreground">Referral Code:</span>
                        <span className="truncate font-mono font-semibold text-[11px] text-foreground">
                          {registration.referral_code}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-5 text-muted-foreground hover:text-foreground"
                          title="Copy referral code"
                          onClick={() => handleCopy(registration.referral_code ?? "", "Referral code", "referral_code")}
                        >
                          {copiedKey === "referral_code" ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>

                      {(Boolean(registration.referral_discount_amount) ||
                        Boolean(registration.referral_discount_percent)) && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-purple-500/30 bg-purple-500/10 font-mono font-semibold text-[10px] text-purple-700 dark:text-purple-300"
                        >
                          {registration.referral_discount_type === "fixed" || registration.referral_discount_amount
                            ? `-Rp ${(registration.referral_discount_amount ?? 0).toLocaleString("id-ID")}`
                            : `-${registration.referral_discount_percent ?? 10}%`}
                        </Badge>
                      )}
                    </div>

                    {/* Referrer Details ("Who does the referral belong to") */}
                    <div className="flex items-center justify-between rounded-md border border-purple-500/20 bg-background/80 px-2.5 py-1.5 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="size-6 shrink-0 border border-border/60">
                          <AvatarImage
                            src={referrerInfo?.avatar_url ?? undefined}
                            alt={referrerInfo?.name || "Referrer"}
                          />
                          <AvatarFallback className="font-semibold text-[9px]">
                            {getInitials(referrerInfo?.name || registration.referrer_name || "Ref")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="shrink-0 text-[10px] text-muted-foreground">Belongs to:</span>
                            <span className="truncate font-semibold text-[11px] text-foreground">
                              {referrerInfo?.name || registration.referrer_name || "Community Member"}
                            </span>
                          </div>
                          {Boolean(referrerInfo?.email) && (
                            <span className="truncate text-[10px] text-muted-foreground">{referrerInfo?.email}</span>
                          )}
                        </div>
                      </div>
                      {referrerInfo?.role && (
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px] capitalize">
                          {referrerInfo.role.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Reviewed By Decision Maker Banner if reviewed */}
                {Boolean(registration.reviewed_by_name) && (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <UserCheck className="size-3.5 shrink-0 text-primary" />
                      <span className="shrink-0 font-medium text-[11px] text-muted-foreground">Reviewed By:</span>
                      <span className="truncate font-semibold text-[11px] text-foreground">
                        {registration.reviewed_by_name}
                        {registration.reviewed_by_email && (
                          <span className="ml-1 font-normal text-[10px] text-muted-foreground">
                            ({registration.reviewed_by_email})
                          </span>
                        )}
                      </span>
                    </div>
                    {registration.reviewed_at && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatFirestoreDate(registration.reviewed_at, "dd MMM, HH:mm")}
                      </span>
                    )}
                  </div>
                )}

                {/* Google Drive Venue Ticket Assignment & Validation Card */}
                {(Boolean(registration.venue_ticket_file_id) ||
                  (isEligibleForVenueTicket(registration) && venueTicketFiles.length > 0)) && (
                  <div className="sm:col-span-2 flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Ticket className="size-3.5 shrink-0 text-primary" />
                        <span className="shrink-0 font-semibold text-foreground">Venue Ticket:</span>
                        {registration.venue_ticket_sequence && (
                          <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[10px]">
                            #{registration.venue_ticket_sequence}
                          </Badge>
                        )}
                        {registration.venue_ticket_file_name && registration.venue_ticket_url ? (
                          <a
                            href={registration.venue_ticket_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 truncate font-medium text-primary hover:underline"
                          >
                            <span className="truncate">{registration.venue_ticket_file_name}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground italic">No venue ticket assigned yet</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {registration.venue_ticket_shared_at ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400"
                          >
                            <ShieldCheck className="size-3" />
                            Shared (View-Only)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Not Shared
                          </Badge>
                        )}
                        {registration.venue_ticket_sent_at ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                          >
                            <CheckCircle className="size-3" />
                            Sent ({formatFirestoreDate(registration.venue_ticket_sent_at, "dd MMM, HH:mm")})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Not Sent
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-primary/15 border-t pt-2">
                      {onAssignVenueTicket && venueTicketFiles.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">Assign File:</span>
                          <select
                            aria-label="Assign Venue Ticket File"
                            value={registration.venue_ticket_file_id ?? ""}
                            disabled={isAssigningVenueTicket || isSendingVenueTicket}
                            onChange={async (e) => {
                              const selectedId = e.target.value;
                              const chosen = venueTicketFiles.find((f) => f.id === selectedId) ?? null;
                              setIsAssigningVenueTicket(true);
                              try {
                                await onAssignVenueTicket(registration, chosen);
                              } finally {
                                setIsAssigningVenueTicket(false);
                              }
                            }}
                            className="h-7 max-w-[240px] rounded-md border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— Unassigned —</option>
                            {venueTicketFiles.map((file) => {
                              const assignedOwner = allRegistrations.find(
                                (r) => r.id !== registration.id && r.venue_ticket_file_id === file.id,
                              );
                              return (
                                <option key={file.id} value={file.id}>
                                  #{file.sequence} {file.name}
                                  {assignedOwner ? ` (Used by ${assignedOwner.member_name})` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Grants view-only access to {registration.member_email} before sending.
                        </span>
                      )}

                      {onSendVenueTicketEmail && registration.venue_ticket_file_id && registration.venue_ticket_url && (
                        <Button
                          type="button"
                          size="sm"
                          variant={registration.venue_ticket_sent_at ? "outline" : "default"}
                          disabled={isSendingVenueTicket || isAssigningVenueTicket}
                          onClick={() => void onSendVenueTicketEmail(registration)}
                          className="h-7 gap-1.5 px-2.5 text-xs"
                        >
                          {isSendingVenueTicket ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Mail className="size-3" />
                          )}
                          <span>
                            {isSendingVenueTicket
                              ? "Granting & Sending..."
                              : registration.venue_ticket_sent_at
                                ? "Resend Venue Ticket"
                                : "Grant Access & Send Venue Ticket"}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expired Payment Notice Banner */}
              {(rawStatus === "expired" || deadlineInfo.isOverdue) && hasPayableItems && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        Payment Deadline Expired {deadlineInfo.timeStatusText ? `(${deadlineInfo.timeStatusText})` : ""}
                      </span>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
                        The payment link deadline has lapsed. You can regenerate a renewed checkout link.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-amber-500/40 bg-background text-amber-700 text-xs hover:bg-amber-500/20 dark:text-amber-300"
                    onClick={() => setIsResendPaymentOpen(true)}
                  >
                    <RefreshCw className="mr-1.5 size-3" />
                    Regenerate Link
                  </Button>
                </div>
              )}

              {/* Active DOKU Payment Link Banner (Waiting for Payment) */}
              {effectivePaymentUrl && rawStatus === "waiting_for_payment" && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <QrCode className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">Payment Link Ready</span>
                      {invoiceNumber && (
                        <span className="ml-1.5 font-mono text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                          ({invoiceNumber})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                      onClick={() => {
                        void navigator.clipboard.writeText(effectivePaymentUrl);
                        toast.success("Payment URL copied to clipboard!");
                      }}
                    >
                      <Copy className="mr-1 size-3" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 border-emerald-500/40 px-2 text-[11px] text-emerald-700 dark:text-emerald-300"
                      asChild
                    >
                      <a href={effectivePaymentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 size-3" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Paid & Verified Banner */}
              {(rawStatus === "paid_and_registered" || registration.payment_status === "paid") && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Payment Received & Verified
                      </span>
                      {registration.payment_amount !== undefined && (
                        <span className="ml-1.5 font-medium text-[11px] text-emerald-700/90 dark:text-emerald-400/90">
                          • Rp {Number(registration.payment_amount).toLocaleString("id-ID")}
                        </span>
                      )}
                      {Boolean(registration.payment_channel) && (
                        <Badge
                          variant="outline"
                          className="ml-1.5 border-emerald-500/30 bg-background/50 text-[10px] text-emerald-700 dark:text-emerald-300"
                        >
                          {registration.payment_channel}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {invoiceNumber && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 font-mono text-[11px] text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                      onClick={() => handleCopy(invoiceNumber, "Invoice number", "invoice_banner")}
                    >
                      <Copy className="mr-1 size-3" />
                      {invoiceNumber}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Questions and Responses */}
            <div className="px-6 py-5">
              <div className="space-y-6">
                {/* Refund Request Dossier Section */}
                {registration.refund_request && (
                  <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs shadow-xs">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-rose-500/20 border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-rose-500/10 p-1.5 text-rose-600 dark:text-rose-400">
                          <RotateCcw className="size-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">Refund Request Application</h4>
                          <p className="text-[11px] text-muted-foreground">
                            Attendee submitted cancellation and deposit refund details
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5 px-2.5 py-1 font-semibold text-xs",
                            registration.refund_request.status === "waiting_for_approval" &&
                              "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                            registration.refund_request.status === "refund_completed" &&
                              "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            registration.refund_request.status === "rejected" &&
                              "border-destructive/40 bg-destructive/10 text-destructive",
                          )}
                        >
                          {registration.refund_request.status === "waiting_for_approval" && (
                            <Clock className="size-3" />
                          )}
                          {registration.refund_request.status === "refund_completed" && (
                            <CheckCircle className="size-3" />
                          )}
                          {registration.refund_request.status === "rejected" && <XCircle className="size-3" />}
                          <span>{getRefundStatusBadgeLabel(registration.refund_request.status)}</span>
                        </Badge>
                      </div>
                    </div>

                    {/* Financial & Bank Account Grid */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* Deposit Amount */}
                      <div className="rounded-lg border border-border/60 bg-background/90 p-3 shadow-2xs">
                        <span className="font-medium text-[11px] text-muted-foreground">Deposit / Refund Amount</span>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="font-bold text-foreground text-lg sm:text-xl">
                            {formatRupiah(getRegistrationRefundAmount(registration, event))}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {registration.ticket_name ?? registration.ticket_tier ?? "Commitment Fee"}
                          </Badge>
                        </div>
                        {(() => {
                          const discounts = getRegistrationDiscountBreakdown(registration, event);
                          if (!discounts.hasDiscount) return null;
                          return (
                            <div className="mt-1.5 space-y-0.5 rounded bg-muted/40 p-1.5 text-[10px]">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Ticket Nominal:</span>
                                <span>{formatRupiah(discounts.baseTicketPrice)}</span>
                              </div>
                              <div className="flex justify-between font-mono text-emerald-600 dark:text-emerald-400">
                                <span>Cut off Promo:</span>
                                <span>-{formatRupiah(discounts.totalDiscount)}</span>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Requested on{" "}
                          {formatFirestoreDate(registration.refund_request.requested_at, "dd MMMM yyyy, HH:mm", "—")}
                        </p>
                      </div>

                      {/* Payee Bank Account Details */}
                      <div className="rounded-lg border border-border/60 bg-background/90 p-3 shadow-2xs">
                        <span className="font-medium text-[11px] text-muted-foreground">Payee Destination Bank</span>
                        <div className="mt-1.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                            <Building2 className="size-3.5 shrink-0 text-primary" />
                            <span>{registration.refund_request.bank_name}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 font-mono text-muted-foreground">
                              <span>{registration.refund_request.bank_account_number}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-5 text-muted-foreground hover:text-foreground"
                                title="Copy account number"
                                onClick={() =>
                                  handleCopy(
                                    registration.refund_request?.bank_account_number ?? "",
                                    "Account number",
                                    "refund_bank_num",
                                  )
                                }
                              >
                                {copiedKey === "refund_bank_num" ? (
                                  <Check className="size-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-2.5" />
                                )}
                              </Button>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span className="max-w-[130px] truncate">
                                a/n {registration.refund_request.bank_account_name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-5 text-muted-foreground hover:text-foreground"
                                title="Copy account holder name"
                                onClick={() =>
                                  handleCopy(
                                    registration.refund_request?.bank_account_name ?? "",
                                    "Account holder name",
                                    "refund_bank_holder",
                                  )
                                }
                              >
                                {copiedKey === "refund_bank_holder" ? (
                                  <Check className="size-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-2.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cancellation Reason & Proof */}
                    <div className="rounded-lg border border-border/60 bg-background/90 p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[11px] text-muted-foreground">
                          Cancellation Reason & Supporting Proof
                        </span>
                        {registration.refund_request.proof_media_url && (
                          <a
                            href={registration.refund_request.proof_media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[11px] text-primary hover:underline"
                          >
                            <FileText className="size-3" />
                            <span>View Attendee Proof ↗</span>
                          </a>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-foreground text-xs leading-relaxed">
                        {registration.refund_request.cancellation_reason || "No cancellation reason provided."}
                      </p>
                    </div>

                    {/* Completed Outcome Details */}
                    {registration.refund_request.status === "refund_completed" && (
                      <div className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-300">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="size-3.5" />
                            <span>Disbursement Completed</span>
                          </div>
                          {registration.refund_request.completed_at && (
                            <span className="font-normal text-[10px] opacity-80">
                              {formatFirestoreDate(registration.refund_request.completed_at, "dd MMM yyyy, HH:mm")}
                            </span>
                          )}
                        </div>
                        {registration.refund_request.completed_by_name && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Processed by:{" "}
                            <span className="font-semibold">{registration.refund_request.completed_by_name}</span>
                            {registration.refund_request.completed_by_email &&
                              ` (${registration.refund_request.completed_by_email})`}
                          </p>
                        )}
                        {registration.refund_request.completion_notes && (
                          <p className="text-[11px] text-muted-foreground">
                            <strong>Notes:</strong> {registration.refund_request.completion_notes}
                          </p>
                        )}
                        {registration.refund_request.completion_proof_url && (
                          <div className="pt-1">
                            <a
                              href={registration.refund_request.completion_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-700 hover:underline dark:text-emerald-300"
                            >
                              <FileText className="size-3" />
                              <span>View Transfer Receipt Proof ↗</span>
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rejected Outcome Details */}
                    {registration.refund_request.status === "rejected" && (
                      <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold text-destructive">
                          <div className="flex items-center gap-1.5">
                            <XCircle className="size-3.5" />
                            <span>Refund Request Rejected</span>
                          </div>
                          {registration.refund_request.rejected_at && (
                            <span className="font-normal text-[10px] opacity-80">
                              {formatFirestoreDate(registration.refund_request.rejected_at, "dd MMM yyyy, HH:mm")}
                            </span>
                          )}
                        </div>
                        {registration.refund_request.rejected_by_name && (
                          <p className="text-[11px] text-muted-foreground">
                            Reviewed by:{" "}
                            <span className="font-semibold">{registration.refund_request.rejected_by_name}</span>
                            {registration.refund_request.rejected_by_email &&
                              ` (${registration.refund_request.rejected_by_email})`}
                          </p>
                        )}
                        {registration.refund_request.rejection_reason && (
                          <p className="text-[11px] text-destructive">
                            <strong>Reason:</strong> {registration.refund_request.rejection_reason}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Quick Action Buttons inside dossier */}
                    {registration.refund_request.status === "waiting_for_approval" &&
                      (onApproveRefund ?? onRejectRefund) && (
                        <div className="flex items-center justify-end gap-2 border-rose-500/20 border-t pt-2">
                          {onRejectRefund && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
                              onClick={() => onRejectRefund(registration)}
                            >
                              <XCircle className="size-3" />
                              Reject Refund
                            </Button>
                          )}
                          {onApproveRefund && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                              onClick={() => onApproveRefund(registration)}
                            >
                              <CheckCircle className="size-3" />
                              Approve Refund
                            </Button>
                          )}
                        </div>
                      )}
                  </div>
                )}

                {groupedSections.length > 0 ? (
                  groupedSections.map(([sectionTitle, items]) => {
                    const SectionIcon = SECTION_ICONS[sectionTitle] || HelpCircle;

                    return (
                      <div key={sectionTitle} className="space-y-3">
                        <div className="flex items-center gap-2 border-border/40 border-b pb-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          <SectionIcon className="size-3.5 text-primary" />
                          <span>{sectionTitle}</span>
                          <span className="font-normal text-[11px] text-muted-foreground/70">
                            ({items.length} {items.length === 1 ? "response" : "responses"})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {items.map((item) => {
                            const isWide =
                              String(item.value).length > 60 ||
                              String(item.value).includes("\n") ||
                              Array.isArray(item.value) ||
                              item.key.toLowerCase().includes("portfolio") ||
                              item.key.toLowerCase().includes("linkedin") ||
                              item.key.toLowerCase().includes("github");

                            return (
                              <div
                                key={item.key}
                                className={cn(
                                  "flex min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-border/60 bg-card p-3 shadow-2xs transition-colors hover:border-border",
                                  isWide && "sm:col-span-2",
                                )}
                              >
                                <div className="mb-1 font-medium text-muted-foreground text-xs">{item.label}</div>
                                <div className="pt-0.5">{renderResponseValue(item.key, item.value)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <FileText className="mb-2 size-8 opacity-40" />
                    <p className="font-medium text-sm">No custom questionnaire responses recorded.</p>
                    <p className="text-muted-foreground/80 text-xs">
                      This attendee registered via Standard RSVP without additional custom questions.
                    </p>
                  </div>
                )}

                {/* Audit & Review History Timeline */}
                {effectiveStatusLogs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-border/40 border-b pb-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      <ShieldCheck className="size-3.5 text-primary" />
                      <span>Review & Status Audit History</span>
                      <span className="font-normal text-[11px] text-muted-foreground/70">
                        ({effectiveStatusLogs.length} {effectiveStatusLogs.length === 1 ? "entry" : "entries"})
                      </span>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                      {effectiveStatusLogs.map((log, idx) => {
                        const logStatusMeta = STATUS_VARIANTS[log.status] || {
                          label: log.status,
                          badgeClass: "border-muted bg-muted",
                          dotClass: "bg-muted-foreground",
                        };
                        const logTime = formatFirestoreDate(log.changed_at, "dd MMM yyyy, HH:mm");

                        return (
                          <div
                            key={log.id || `log-${idx}`}
                            className="flex flex-col gap-1 border-border/40 border-b pb-2 last:border-b-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "gap-1 border px-2 py-0.5 font-medium text-[11px]",
                                    logStatusMeta.badgeClass,
                                  )}
                                >
                                  <span className={cn("size-1.5 rounded-full", logStatusMeta.dotClass)} />
                                  {logStatusMeta.label}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                  by <span className="font-semibold text-foreground">{log.changed_by_name}</span>
                                  {log.changed_by_email && (
                                    <span className="text-[11px] text-muted-foreground"> ({log.changed_by_email})</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Clock className="size-3" />
                                <span>{logTime}</span>
                              </div>
                            </div>
                            {log.notes && (
                              <p className="pl-1 text-[11px] text-muted-foreground/80 italic">{log.notes}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          {(() => {
            const isActionBlocked = [
              isPending,
              isCollectingMerch,
              isApproving,
              isRejecting,
              isWaitlisting,
              isResendingInterest,
              isResendingWaitlist,
              isResendingPaidWaitlist,
              isResendingAccepted,
              isCancelling,
            ].some(Boolean);
            const isWaitingPayment = rawStatus === "waiting_for_payment";
            const isStatusPending = rawStatus === "pending";
            const isWaitlisted = rawStatus === "waitlisted";
            const isPaidWaitlisted = rawStatus === "paid_waitlisted";
            const isApproved =
              rawStatus === "approved" ||
              rawStatus === "paid_and_registered" ||
              rawStatus === "paid_registered" ||
              rawStatus === "confirmed" ||
              rawStatus === "registered" ||
              rawStatus === "attended";
            const isExpired = rawStatus === "expired";
            const isRejected = rawStatus === "rejected";
            const isDisbursementCompleted =
              registration.refund_request?.status === "refund_completed" || registration.payment_status === "refunded";
            const isCanceled =
              rawStatus === "canceled" ||
              rawStatus === "cancelled" ||
              registration.status === "canceled" ||
              registration.status === "cancelled" ||
              isDisbursementCompleted;

            const hasMoreActions = Boolean(
              (!isCanceled && !isDisbursementCompleted && isCuration && isStatusPending && onResendInterestEmail) ||
                (!isCanceled && !isDisbursementCompleted && isCuration && isWaitlisted && onResendWaitlistEmail) ||
                (!isCanceled && !isDisbursementCompleted && isPaidWaitlisted && onResendPaidWaitlistEmail) ||
                (!isCanceled && !isDisbursementCompleted && onCancelRegistration) ||
                onDelete,
            );

            return (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t bg-muted/20 px-6 py-3">
                {/* Secondary / Lifecycle Management Actions (Left) */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Waitlist button (only when pending review in curation mode) */}
                  {isCuration && isStatusPending && !isCanceled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-500/30 text-blue-600 text-xs hover:bg-blue-500/10 dark:text-blue-400"
                      disabled={isActionBlocked}
                      onClick={() => {
                        onStatusChange(registration.id, "waitlisted");
                        onClose();
                      }}
                    >
                      {isWaitlisting ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <Clock className="mr-1.5 size-3.5" />
                      )}
                      Waitlist
                    </Button>
                  )}

                  {/* Set Pending button (when waitlisted or rejected in curation mode) */}
                  {isCuration && (isWaitlisted || isRejected) && !isCanceled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/30 text-amber-600 text-xs hover:bg-amber-500/10"
                      disabled={isActionBlocked}
                      onClick={() => {
                        onStatusChange(registration.id, "pending");
                        onClose();
                      }}
                    >
                      <Clock className="mr-1.5 size-3.5" />
                      Set Pending
                    </Button>
                  )}

                  {/* Regenerate Payment Link (when payment is required and active or expired) */}
                  {hasPayableItems && (isWaitingPayment || isExpired || deadlineInfo.isOverdue) && !isCanceled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "text-xs",
                        isExpired || deadlineInfo.isOverdue
                          ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                          : "border-primary/40 text-primary hover:bg-primary/5",
                      )}
                      disabled={isActionBlocked}
                      onClick={() => setIsResendPaymentOpen(true)}
                    >
                      <RefreshCw className="mr-1.5 size-3.5" />
                      Regenerate Payment Link
                    </Button>
                  )}

                  {/* More Administrative & Destructive Actions Dropdown */}
                  {hasMoreActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                          disabled={isActionBlocked}
                        >
                          <MoreHorizontal className="size-3.5" />
                          <span>More</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {isCuration && isStatusPending && onResendInterestEmail && (
                          <DropdownMenuItem
                            disabled={isActionBlocked || isResendingInterest}
                            onClick={() => onResendInterestEmail(registration)}
                          >
                            <Mail className="mr-2 size-3.5 text-primary" />
                            Resend Interest Email
                          </DropdownMenuItem>
                        )}

                        {isCuration && isWaitlisted && onResendWaitlistEmail && (
                          <DropdownMenuItem
                            disabled={isActionBlocked || isResendingWaitlist}
                            onClick={() => onResendWaitlistEmail(registration)}
                          >
                            <Mail className="mr-2 size-3.5 text-blue-600" />
                            Resend Waitlist Email
                          </DropdownMenuItem>
                        )}

                        {isPaidWaitlisted && onResendPaidWaitlistEmail && (
                          <DropdownMenuItem
                            disabled={isActionBlocked || isResendingPaidWaitlist}
                            onClick={() => onResendPaidWaitlistEmail(registration)}
                          >
                            <Mail className="mr-2 size-3.5 text-indigo-600" />
                            Resend Paid Waitlist Email
                          </DropdownMenuItem>
                        )}

                        {((isCuration && isStatusPending && onResendInterestEmail) ||
                          (isCuration && isWaitlisted && onResendWaitlistEmail) ||
                          (isPaidWaitlisted && onResendPaidWaitlistEmail)) &&
                          (onCancelRegistration ?? onDelete) && <DropdownMenuSeparator />}

                        {onCancelRegistration && !isCanceled && (
                          <DropdownMenuItem
                            disabled={isActionBlocked || isCancelling}
                            className="text-destructive focus:text-destructive"
                            onClick={() => onCancelRegistration(registration)}
                          >
                            <UserX className="mr-2 size-3.5" />
                            Cancel Registration
                          </DropdownMenuItem>
                        )}

                        {onDelete && (
                          <DropdownMenuItem
                            disabled={isActionBlocked}
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(registration)}
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            Remove Attendee
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Primary Decision & Navigation Actions (Right) */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Reject button */}
                  {/* Reject button - disappears when disbursement completed or canceled */}
                  {(isCuration || isWaitlisted || isPaidWaitlisted) &&
                    !isRejected &&
                    !isApproved &&
                    !isCanceled &&
                    !isDisbursementCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/30 text-destructive text-xs hover:bg-destructive/10"
                        disabled={isActionBlocked}
                        onClick={() => {
                          if (onReject) {
                            onReject(registration);
                          } else {
                            onStatusChange(registration.id, "rejected");
                          }
                          onClose();
                        }}
                      >
                        {isRejecting ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <XCircle className="mr-1.5 size-3.5" />
                        )}
                        Reject
                      </Button>
                    )}

                  {/* Approve / Status Indicator */}
                  {(isCuration || isWaitlisted || isPaidWaitlisted) &&
                    !isWaitingPayment &&
                    (() => {
                      if (isCanceled || isDisbursementCompleted) {
                        return null;
                      }
                      if (isApproved) {
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="cursor-default border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs dark:text-emerald-400"
                          >
                            <CheckCircle className="mr-1.5 size-3.5" />
                            Approved
                          </Button>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white text-xs shadow-xs hover:bg-emerald-700"
                          disabled={isActionBlocked}
                          onClick={() => {
                            if (onApprove) {
                              onApprove(registration);
                            } else {
                              onStatusChange(registration.id, "approved");
                              onClose();
                            }
                          }}
                        >
                          {isApproving ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1.5 size-3.5" />
                          )}
                          {isExpired ? "Re-approve Applicant" : "Approve Applicant"}
                        </Button>
                      );
                    })()}

                  {/* Check Payment (for waiting_for_payment or expired) */}
                  {(isWaitingPayment || (isExpired && (hasPayableItems || Boolean(invoiceNumber)))) &&
                    !isCanceled &&
                    !isDisbursementCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-emerald-500/30 text-emerald-600 text-xs hover:bg-emerald-500/10 dark:text-emerald-400"
                        onClick={() => setIsCheckPaymentOpen(true)}
                      >
                        <CreditCard className="size-3.5" />
                        <span>Check Payment</span>
                      </Button>
                    )}

                  {/* Close Dialog Button */}
                  <Button size="sm" variant="secondary" className="text-xs" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ResendPaymentLinkDialog
        open={isResendPaymentOpen}
        onOpenChange={setIsResendPaymentOpen}
        registration={registration}
        event={event}
        onSuccess={(updatedReg) => {
          onStatusChange(updatedReg.id, "waiting_for_payment");
          if (updatedReg.payment_url && updatedReg.payment_invoice_number) {
            setPaymentLinkInfo({
              url: updatedReg.payment_url,
              invoiceNumber: updatedReg.payment_invoice_number,
            });
          }
        }}
      />

      <CheckPaymentStatusDialog
        open={isCheckPaymentOpen}
        onOpenChange={setIsCheckPaymentOpen}
        registration={registration}
        event={event}
        onSuccess={(updatedReg) => {
          if (onUpdateRegistration) {
            onUpdateRegistration(updatedReg);
          } else {
            onStatusChange(updatedReg.id, "paid_and_registered", updatedReg);
          }
        }}
      />
    </>
  );
}
