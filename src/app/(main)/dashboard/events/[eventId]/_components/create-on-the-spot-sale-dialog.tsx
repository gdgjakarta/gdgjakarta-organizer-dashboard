"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Package,
  PackageCheck,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractCustomerPhone } from "@/lib/events/doku-payment";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import {
  calculateCustomerRemainingBundleLimit,
  calculateCustomerRemainingMerchLimit,
  subscribeEventMerchandiseOrders,
} from "@/lib/firestore/merchandise-orders";
import type {
  CustomQuestion,
  EventBundlePackage,
  EventMerchandiseItem,
  EventMerchandiseOrder,
  FirestoreEvent,
  FirestoreRegistration,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import {
  checkOnTheSpotPaymentStatusAction,
  createOnTheSpotMerchandiseOrderAction,
} from "@/server/merchandise-order-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

/**
 * Extracts and normalizes customer name, email, and phone from a registration,
 * checking member fields, custom answers (e.g. WhatsApp, phone, HP), and merging
 * against the full event registrations list and custom questions when needed.
 */
function extractCustomerDetails(
  reg?: FirestoreRegistration | null,
  allRegistrations?: FirestoreRegistration[],
  customQuestions?: CustomQuestion[],
): { name: string; email: string; phone: string } {
  if (!reg) return { name: "", email: "", phone: "" };

  let matchedReg: FirestoreRegistration = reg;
  if (allRegistrations && allRegistrations.length > 0) {
    const regEmail = (reg.member_email || (reg.answers?.email as string) || "").trim().toLowerCase();
    const regBevyId = reg.bevy_attendee_id ? Number(reg.bevy_attendee_id) : null;
    const found = allRegistrations.find((r) => {
      if (regBevyId && Number(r.bevy_attendee_id) === regBevyId) return true;
      if (reg.attendee_code && r.attendee_code === reg.attendee_code) return true;
      if (reg.id && r.id === reg.id) return true;
      if (regEmail && (r.member_email || (r.answers?.email as string) || "").trim().toLowerCase() === regEmail) {
        return true;
      }
      return false;
    });

    if (found) {
      matchedReg = {
        ...found,
        ...reg,
        member_name: found.member_name || reg.member_name,
        member_email: found.member_email || reg.member_email,
        member_phone: found.member_phone || reg.member_phone,
        bevy_attendee_id: found.bevy_attendee_id ?? reg.bevy_attendee_id,
        attendee_code: found.attendee_code || reg.attendee_code,
        answers: { ...(found.answers ?? {}), ...(reg.answers ?? {}) },
      };
    }
  }

  // Name
  let name = matchedReg.member_name || "";
  if (!name && matchedReg.answers) {
    name =
      (matchedReg.answers.name as string) ||
      (matchedReg.answers.full_name as string) ||
      (matchedReg.answers.nama as string) ||
      (matchedReg.answers["Full Name"] as string) ||
      (matchedReg.answers["Nama Lengkap"] as string) ||
      (matchedReg.answers.nama_lengkap as string) ||
      "";
  }
  if (!name && customQuestions && customQuestions.length > 0 && matchedReg.answers) {
    for (const q of customQuestions) {
      const qLabel = (q.label || "").toLowerCase();
      if (qLabel.includes("name") || qLabel.includes("nama")) {
        const val = matchedReg.answers[q.id];
        if (typeof val === "string" && val.trim()) {
          name = val.trim();
          break;
        }
      }
    }
  }

  // Email
  let email = matchedReg.member_email || "";
  if (!email && matchedReg.answers) {
    email =
      (matchedReg.answers.email as string) ||
      (matchedReg.answers["Email Address"] as string) ||
      (matchedReg.answers["Email"] as string) ||
      (matchedReg.answers.email_address as string) ||
      "";
  }
  if (!email && customQuestions && customQuestions.length > 0 && matchedReg.answers) {
    for (const q of customQuestions) {
      const qLabel = (q.label || "").toLowerCase();
      if (qLabel.includes("email")) {
        const val = matchedReg.answers[q.id];
        if (typeof val === "string" && val.trim()) {
          email = val.trim();
          break;
        }
      }
    }
  }

  // Phone
  let phone = extractCustomerPhone(matchedReg, undefined, customQuestions);
  if (!phone && matchedReg.member_phone) {
    phone = matchedReg.member_phone;
  }
  const regAny = matchedReg as unknown as Record<string, unknown>;
  if (!phone && regAny.phone) {
    phone = String(regAny.phone);
  }
  if (!phone && regAny.mobile_phone) {
    phone = String(regAny.mobile_phone);
  }
  if (!phone && regAny.mobile) {
    phone = String(regAny.mobile);
  }
  if (!phone && regAny.phone_number) {
    phone = String(regAny.phone_number);
  }
  if (!phone && regAny.whatsapp) {
    phone = String(regAny.whatsapp);
  }

  if (phone) {
    phone = phone.replace(/[\s\-().]/g, "");
    if (phone.startsWith("+")) phone = phone.slice(1);
    if (phone.startsWith("08")) phone = `628${phone.slice(2)}`;
    else if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
    else if (phone.startsWith("8") && phone.length >= 9 && phone.length <= 14) phone = `62${phone}`;
  }

  return { name, email, phone };
}

interface CreateOnTheSpotSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: FirestoreEvent;
  registrations: FirestoreRegistration[];
  initialAttendee?: FirestoreRegistration | null;
  initialItem?: EventMerchandiseItem | null;
  initialBundle?: EventBundlePackage | null;
  initialOrders?: EventMerchandiseOrder[];
}

export function CreateOnTheSpotSaleDialog({
  open,
  onOpenChange,
  event,
  registrations,
  initialAttendee,
  initialItem,
  initialBundle,
  initialOrders,
}: CreateOnTheSpotSaleDialogProps) {
  const user = useAuthStore((s) => s.user);
  // Existing orders for real-time quota calculations
  const [orders, setOrders] = useState<EventMerchandiseOrder[]>(initialOrders ?? []);

  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders(initialOrders);
    }
  }, [initialOrders]);

  useEffect(() => {
    if (!open || !event.id) return;
    const unsubscribe = subscribeEventMerchandiseOrders(String(event.id), setOrders);
    return () => unsubscribe();
  }, [open, event.id]);

  // Mode: single item or bundle
  const [saleType, setSaleType] = useState<"item" | "bundle">(initialBundle ? "bundle" : "item");

  // Customer state
  const [selectedAttendee, setSelectedAttendee] = useState<FirestoreRegistration | null>(initialAttendee ?? null);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState("");
  const [isWalkIn, setIsWalkIn] = useState(!initialAttendee);
  const [isEditingAttendeeDetails, setIsEditingAttendeeDetails] = useState(false);

  const initialDetails = useMemo(() => {
    return extractCustomerDetails(initialAttendee, registrations, event.custom_questions);
  }, [initialAttendee, registrations, event.custom_questions]);

  const [customerName, setCustomerName] = useState(initialDetails.name);
  const [customerEmail, setCustomerEmail] = useState(initialDetails.email);
  const [customerPhone, setCustomerPhone] = useState(initialDetails.phone);

  // Single Item selection state
  const availableItems = useMemo(() => {
    return (event.merchandise ?? []).filter((m) => m.status !== "hidden" && m.status !== "draft");
  }, [event.merchandise]);

  const [selectedItemId, setSelectedItemId] = useState<string>(initialItem?.id || availableItems[0]?.id || "");
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [itemQuantity, setItemQuantity] = useState(1);

  // Bundle selection state
  const availableBundles = useMemo(() => {
    return (event.bundles ?? []).filter((b) => b.status !== "hidden");
  }, [event.bundles]);

  const [selectedBundleId, setSelectedBundleId] = useState<string>(initialBundle?.id || availableBundles[0]?.id || "");
  const [bundleVariations, setBundleVariations] = useState<Record<string, Record<string, string>>>({});

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "cash_manual">("qris");
  const [markCollectedNow, setMarkCollectedNow] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [notes, setNotes] = useState("");

  // Result state
  const [createdResult, setCreatedResult] = useState<{
    orderId: string;
    orderNumber: string;
    paymentUrl?: string;
    invoiceNumber?: string;
    amount?: number;
    isPaid?: boolean;
  } | null>(null);

  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSubmitting, startTransition] = useTransition();

  const handleReset = useCallback(() => {
    setCreatedResult(null);
    setSelectedAttendee(null);
    setIsWalkIn(true);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setIsEditingAttendeeDetails(false);
    setAttendeeSearchQuery("");
    setItemQuantity(1);
    setSelectedVariations({});
    setBundleVariations({});
    setNotes("");
    setPaymentMethod("qris");
    setMarkCollectedNow(false);
    setHasCopied(false);
    setSaleType("item");
    if (availableItems[0]?.id) setSelectedItemId(availableItems[0].id);
    if (availableBundles[0]?.id) setSelectedBundleId(availableBundles[0].id);
  }, [availableItems, availableBundles]);

  const prevOpenRef = useRef(open);
  const prevAttendeeRef = useRef(initialAttendee);

  // Sync state when dialog opens or initialAttendee prop changes, and reset when dialog closes/cancels
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    const prevAttendee = prevAttendeeRef.current;
    prevAttendeeRef.current = initialAttendee;

    const resolveAttendee = (raw: FirestoreRegistration | null | undefined): FirestoreRegistration | null => {
      if (!raw) return null;
      const regEmail = (raw.member_email || (raw.answers?.email as string) || "").trim().toLowerCase();
      const regBevyId = raw.bevy_attendee_id ? Number(raw.bevy_attendee_id) : null;
      const code = (raw.attendee_code || "").trim().toLowerCase();
      const found = registrations.find((r) => {
        if (code && r.attendee_code && r.attendee_code.trim().toLowerCase() === code) return true;
        if (regBevyId && Number(r.bevy_attendee_id) === regBevyId) return true;
        if (raw.id && r.id === raw.id) return true;
        if (regEmail && (r.member_email || (r.answers?.email as string) || "").trim().toLowerCase() === regEmail)
          return true;
        return false;
      });
      if (found) {
        return {
          ...found,
          ...raw,
          member_name: found.member_name || raw.member_name,
          member_email: found.member_email || raw.member_email,
          member_phone: found.member_phone || raw.member_phone,
          bevy_attendee_id: found.bevy_attendee_id ?? raw.bevy_attendee_id,
          attendee_code: found.attendee_code || raw.attendee_code,
          answers: { ...(found.answers ?? {}), ...(raw.answers ?? {}) },
        };
      }
      return raw;
    };

    if (!wasOpen && open) {
      // Dialog just opened
      if (initialAttendee) {
        const resolved = resolveAttendee(initialAttendee) || initialAttendee;
        const details = extractCustomerDetails(resolved, registrations, event.custom_questions);
        setSelectedAttendee(resolved);
        setIsWalkIn(false);
        setCustomerName(details.name);
        setCustomerEmail(details.email);
        setCustomerPhone(details.phone);
        setIsEditingAttendeeDetails(!details.name || !details.email || !details.phone);
      } else {
        handleReset();
      }

      if (initialBundle) {
        setSaleType("bundle");
        setSelectedBundleId(initialBundle.id);
      } else if (initialItem) {
        setSaleType("item");
        setSelectedItemId(initialItem.id);
      } else {
        setSaleType("item");
        if (availableItems[0]?.id) setSelectedItemId(availableItems[0].id);
      }
    } else if (open && initialAttendee && initialAttendee !== prevAttendee) {
      // initialAttendee prop changed while dialog is open
      const resolved = resolveAttendee(initialAttendee) || initialAttendee;
      const details = extractCustomerDetails(resolved, registrations, event.custom_questions);
      setSelectedAttendee(resolved);
      setIsWalkIn(false);
      setCustomerName(details.name);
      setCustomerEmail(details.email);
      setCustomerPhone(details.phone);
      setIsEditingAttendeeDetails(!details.name || !details.email || !details.phone);
    } else if (wasOpen && !open) {
      // Dialog closed / cancelled
      handleReset();
    }
  }, [
    open,
    initialAttendee,
    initialBundle,
    initialItem,
    registrations,
    event.custom_questions,
    availableItems,
    handleReset,
  ]);

  // Filtered attendees for autocomplete
  const filteredAttendees = useMemo(() => {
    if (!attendeeSearchQuery.trim()) return [];
    const q = attendeeSearchQuery.toLowerCase().trim();
    return registrations
      .filter((r) => {
        const name = (r.member_name || (r.answers?.name as string) || "").toLowerCase();
        const email = (r.member_email || (r.answers?.email as string) || "").toLowerCase();
        const code = (r.attendee_code || r.id || "").toLowerCase();
        return name.includes(q) || email.includes(q) || code.includes(q);
      })
      .slice(0, 6);
  }, [registrations, attendeeSearchQuery]);

  const handleSelectAttendee = (r: FirestoreRegistration) => {
    setSelectedAttendee(r);
    setIsWalkIn(false);
    const details = extractCustomerDetails(r, registrations, event.custom_questions);
    setCustomerName(details.name);
    setCustomerEmail(details.email);
    setCustomerPhone(details.phone);
    setIsEditingAttendeeDetails(!details.name || !details.email || !details.phone);
    setAttendeeSearchQuery("");
  };

  const handleClearAttendee = () => {
    setSelectedAttendee(null);
    setIsWalkIn(true);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setIsEditingAttendeeDetails(false);
  };

  // Resolve current active item
  const currentItem = useMemo(() => {
    return availableItems.find((m) => m.id === selectedItemId) ?? availableItems[0];
  }, [availableItems, selectedItemId]);

  // Resolve current active bundle
  const currentBundle = useMemo(() => {
    return availableBundles.find((b) => b.id === selectedBundleId) ?? availableBundles[0];
  }, [availableBundles, selectedBundleId]);

  // Quota checks
  const targetEmail = customerEmail.trim().toLowerCase();

  const itemQuota = useMemo(() => {
    if (!currentItem) return { currentCount: 0, maxAllowed: null, remaining: 999 };
    return calculateCustomerRemainingMerchLimit({
      email: targetEmail,
      item: currentItem,
      event,
      registrations,
      orders,
    });
  }, [currentItem, targetEmail, event, registrations, orders]);

  const bundleQuota = useMemo(() => {
    if (!currentBundle) return { currentCount: 0, maxAllowed: null, remaining: 999 };
    return calculateCustomerRemainingBundleLimit({
      email: targetEmail,
      bundle: currentBundle,
      orders,
    });
  }, [currentBundle, targetEmail, orders]);

  // Remaining total item stock (event-wide across registrations and paid OTS orders)
  const itemTotalSold = useMemo(() => {
    if (!currentItem) return 0;
    let sold = 0;
    for (const o of orders) {
      if (o.payment_status === "paid") {
        for (const it of o.items) {
          if (it.merchandise_id === currentItem.id) sold += it.quantity || 1;
        }
      }
    }
    for (const r of registrations) {
      if (r.status !== "cancelled" && r.status !== "canceled" && r.status !== "rejected") {
        for (const m of r.selected_merchandise ?? []) {
          if (m.id === currentItem.id || m.merchandise_id === currentItem.id) sold += m.quantity || 1;
        }
      }
    }
    return sold;
  }, [currentItem, orders, registrations]);

  const remainingItemStock =
    currentItem?.stock !== null && currentItem?.stock !== undefined
      ? Math.max(0, currentItem.stock - itemTotalSold)
      : null;

  // Remaining bundle capacity (event-wide)
  const bundleTotalSold = useMemo(() => {
    if (!currentBundle) return 0;
    let sold = 0;
    for (const o of orders) {
      if (o.bundle_id === currentBundle.id && o.payment_status === "paid") sold += 1;
    }
    for (const r of registrations) {
      if (
        r.bundle_id === currentBundle.id &&
        r.status !== "cancelled" &&
        r.status !== "canceled" &&
        r.status !== "rejected"
      ) {
        sold += 1;
      }
    }
    return sold;
  }, [currentBundle, orders, registrations]);

  const remainingBundleCapacity =
    currentBundle?.capacity !== null && currentBundle?.capacity !== undefined
      ? Math.max(0, currentBundle.capacity - bundleTotalSold)
      : null;

  // Calculate pricing
  const effectiveUnitPrice = useMemo(() => {
    if (!currentItem) return 0;
    let price = currentItem.price || 0;
    if (currentItem.variations) {
      for (const v of currentItem.variations) {
        const selectedOpt = selectedVariations[v.name];
        if (
          selectedOpt &&
          v.option_details?.[selectedOpt]?.price !== undefined &&
          v.option_details[selectedOpt].price !== null
        ) {
          price = v.option_details[selectedOpt].price;
        }
      }
    }
    return price;
  }, [currentItem, selectedVariations]);

  const subtotal = useMemo(() => {
    if (saleType === "bundle") {
      return currentBundle?.price || 0;
    }
    return effectiveUnitPrice * itemQuantity;
  }, [saleType, currentBundle, effectiveUnitPrice, itemQuantity]);

  const feeResult = useMemo(() => {
    if (paymentMethod === "cash_manual") {
      return { isEnabled: false, feeAmount: 0, feeLabel: "", isPassedToAttendee: false };
    }
    return calculatePaymentGatewayFee(subtotal, event);
  }, [subtotal, paymentMethod, event]);

  const finalTotal = subtotal + (feeResult.isEnabled && feeResult.isPassedToAttendee ? feeResult.feeAmount : 0);

  // Auto-listen to the created order document if waiting for payment
  useEffect(() => {
    if (!createdResult?.orderId) return;
    const matching = orders.find((o) => o.id === createdResult.orderId);
    if (matching?.payment_status === "paid" && !createdResult.isPaid) {
      setCreatedResult((prev) => (prev ? { ...prev, isPaid: true } : prev));
      toast.success("Payment confirmed! Merchandise marked as paid.");
    }
  }, [orders, createdResult]);

  const handleCopyLink = () => {
    if (!createdResult?.paymentUrl) return;
    void navigator.clipboard.writeText(createdResult.paymentUrl);
    setHasCopied(true);
    toast.success("Payment link copied to clipboard!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleManualCheckPayment = async () => {
    if (!createdResult?.orderId) return;
    setIsCheckingPayment(true);
    try {
      const res = await checkOnTheSpotPaymentStatusAction(createdResult.orderId, createdResult.invoiceNumber);
      if (res.success && res.isPaid) {
        setCreatedResult((prev) => (prev ? { ...prev, isPaid: true } : prev));
        toast.success("Payment confirmed via DOKU QRIS!");
      } else {
        toast.info(res.message || "Payment is still pending on QRIS.");
      }
    } catch {
      toast.error("Failed to check payment status.");
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast.error("Please enter the customer's full name.");
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      toast.error("Please enter a valid customer email.");
      return;
    }
    const cleanPhoneDigits = customerPhone.replace(/[^0-9]/g, "");
    if (!customerPhone.trim() || cleanPhoneDigits.length < 8) {
      toast.error("Please enter a valid customer phone number (minimum 8 digits).");
      return;
    }
    const effectivePhone = customerPhone.trim();

    if (saleType === "item") {
      if (!currentItem) {
        toast.error("Please select a merchandise item.");
        return;
      }
      if (remainingItemStock !== null && remainingItemStock <= 0) {
        toast.error("This merchandise item is currently out of stock.");
        return;
      }
      if (remainingItemStock !== null && itemQuantity > remainingItemStock) {
        toast.error(`Not enough stock available. Remaining stock: ${remainingItemStock} unit(s).`);
        return;
      }
      if (itemQuota.maxAllowed !== null && itemQuota.remaining <= 0) {
        toast.error(
          `Purchase limit reached: this person has already purchased the maximum allowed (${itemQuota.maxAllowed}) for this item.`,
        );
        return;
      }
      if (itemQuota.maxAllowed !== null && itemQuantity > itemQuota.remaining) {
        toast.error(`Quantity exceeds allowed quota. Remaining allowed: ${itemQuota.remaining} unit(s).`);
        return;
      }
    } else {
      if (!currentBundle) {
        toast.error("Please select a bundle package.");
        return;
      }
      if (remainingBundleCapacity !== null && remainingBundleCapacity <= 0) {
        toast.error("This bundle package is sold out.");
        return;
      }
      if (bundleQuota.maxAllowed !== null && bundleQuota.remaining <= 0) {
        toast.error("This customer has reached the purchase limit for this bundle.");
        return;
      }
    }

    // Build order items list
    let orderItemsPayload: Array<{
      merchandise_id: string;
      name: string;
      price: number;
      quantity: number;
      selected_variations?: Record<string, string>;
      image_url?: string;
      bundle_id?: string;
      bundle_name?: string;
    }> = [];

    if (saleType === "item" && currentItem) {
      orderItemsPayload = [
        {
          merchandise_id: currentItem.id,
          name: currentItem.name,
          price: effectiveUnitPrice,
          quantity: itemQuantity,
          selected_variations: Object.keys(selectedVariations).length > 0 ? selectedVariations : undefined,
          image_url: currentItem.image_url,
        },
      ];
    } else if (saleType === "bundle" && currentBundle) {
      const merchItems = currentBundle.merchandise_items ?? [];
      if (merchItems.length > 0) {
        const totalBundlePrice = currentBundle.price || 0;
        const weights = merchItems.map((bi) => {
          const matchingMerch = (event.merchandise ?? []).find((m) => m.id === bi.merchandise_id);
          const basePrice = matchingMerch?.price && matchingMerch.price > 0 ? matchingMerch.price : 1;
          const qty = bi.quantity || 1;
          return { bi, matchingMerch, qty, weight: basePrice * qty };
        });

        const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0);
        let allocatedSum = 0;

        orderItemsPayload = weights.map((w, index) => {
          let lineTotal: number;
          if (index === weights.length - 1) {
            lineTotal = Math.max(0, totalBundlePrice - allocatedSum);
          } else {
            lineTotal = totalWeight > 0 ? Math.round((totalBundlePrice * w.weight) / totalWeight) : 0;
            allocatedSum += lineTotal;
          }
          const unitPrice = w.qty > 0 ? Math.round(lineTotal / w.qty) : lineTotal;

          return {
            merchandise_id: w.bi.merchandise_id,
            name: w.matchingMerch?.name || "Merchandise Item",
            price: unitPrice,
            quantity: w.qty,
            selected_variations: bundleVariations[w.bi.merchandise_id] || w.bi.default_variations,
            image_url: w.matchingMerch?.image_url,
            bundle_id: currentBundle.id,
            bundle_name: currentBundle.name,
          };
        });
      } else {
        const linkedTicket = currentBundle.ticket_id
          ? (event.tickets ?? []).find((t) => t.id === currentBundle.ticket_id)
          : null;
        const ticketInfo = linkedTicket ? ` (${currentBundle.ticket_quantity || 1}x ${linkedTicket.name})` : "";

        orderItemsPayload = [
          {
            merchandise_id: currentBundle.id,
            name: `${currentBundle.name}${ticketInfo}`,
            price: currentBundle.price || 0,
            quantity: 1,
            bundle_id: currentBundle.id,
            bundle_name: currentBundle.name,
          },
        ];
      }
    }

    if (orderItemsPayload.length === 0) {
      toast.error("Please configure at least one item or bundle package.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createOnTheSpotMerchandiseOrderAction({
          eventId: String(event.id),
          eventTitle: event.title,
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: effectivePhone,
            registration_id: selectedAttendee?.id || null,
            attendee_code: selectedAttendee?.attendee_code || null,
            bevy_attendee_id: selectedAttendee?.bevy_attendee_id ? Number(selectedAttendee.bevy_attendee_id) : null,
            is_imported_attendee: Boolean(selectedAttendee),
          },
          saleType,
          bundleId: saleType === "bundle" ? currentBundle?.id : null,
          bundleName: saleType === "bundle" ? currentBundle?.name : null,
          items: orderItemsPayload,
          subtotal,
          feeAmount: feeResult.isEnabled && feeResult.isPassedToAttendee ? feeResult.feeAmount : 0,
          feeLabel: feeResult.feeLabel,
          totalAmount: finalTotal,
          paymentMethod,
          markCollectedNow,
          notes: notes.trim() || undefined,
          sendEmail,
          actorName: user?.name,
          actorId: user?.id,
        });

        if (!res.success) {
          toast.error(res.error || "Failed to create merchandise order.");
          return;
        }

        if (paymentMethod === "cash_manual") {
          toast.success("Order recorded and marked as paid via Cash/Manual!");
          handleClose();
        } else {
          setCreatedResult({
            orderId: res.orderId!,
            orderNumber: res.orderNumber!,
            paymentUrl: res.paymentUrl,
            invoiceNumber: res.invoiceNumber,
            amount: res.amount,
            isPaid: false,
          });
          toast.success("DOKU QRIS Payment Link generated successfully!");
        }
      } catch (err) {
        console.error("[CreateOnTheSpotSaleDialog] Error:", err);
        toast.error("An unexpected error occurred while placing the order.");
      }
    });
  };

  const qrImageUrl = createdResult?.paymentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
        createdResult.paymentUrl,
      )}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="inset-0 m-auto h-fit max-h-[92vh] translate-x-0 translate-y-0 overflow-y-auto sm:max-w-xl md:max-w-2xl [transform:none]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">On-the-Spot Merchandise Sale</DialogTitle>
              <DialogDescription className="text-xs">
                Process an on-site merchandise purchase for {event.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdResult ? (
          /* =======================================================
             STAGE 2: QRIS Checkout & Live Status Presentation
             ======================================================= */
          <div className="space-y-4 py-2">
            {createdResult.isPaid ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-2">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-7" />
                </div>
                <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">Payment Confirmed!</h3>
                <p className="text-xs text-muted-foreground">
                  Order <strong>#{createdResult.orderNumber}</strong> has been marked as <strong>PAID</strong>.
                </p>
                <div className="pt-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-0.5"
                  >
                    {markCollectedNow ? "Handed Over & Collected" : "Ready for Pickup"}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-5 text-center">
                  <Badge variant="outline" className="mb-2 border-primary/30 bg-primary/10 text-primary text-[10px]">
                    Scan QRIS to Pay
                  </Badge>
                  {qrImageUrl ? (
                    <div className="overflow-hidden rounded-xl border bg-white p-2 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrImageUrl} alt="QRIS Payment Code" className="size-48 object-contain" />
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Invoice #{createdResult.invoiceNumber}</p>
                    <p className="text-xl font-bold tracking-tight text-foreground">
                      Rp {(createdResult.amount ?? finalTotal).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">DOKU Checkout URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={createdResult.paymentUrl}
                      className="h-9 font-mono text-xs text-muted-foreground"
                    />
                    <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0 gap-1.5">
                      {hasCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      <span>{hasCopied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    onClick={handleManualCheckPayment}
                    disabled={isCheckingPayment}
                    className="w-full gap-2 text-xs"
                  >
                    {isCheckingPayment ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Check Payment Status
                  </Button>
                  {createdResult.paymentUrl && (
                    <Button variant="outline" asChild size="sm" className="w-full gap-1.5 text-xs">
                      <a href={createdResult.paymentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" />
                        Open Checkout in New Tab
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={handleClose} className="w-full text-xs">
                {createdResult.isPaid ? "Done" : "Close (Order Saved as Pending)"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* =======================================================
             STAGE 1: Order Configuration & Quota Validation
             ======================================================= */
          <div className="space-y-4 py-1">
            {/* 1. Attendee Lookup & Import */}
            <div className="rounded-xl border p-3.5 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <User className="size-3.5 text-primary" />
                  <span>Customer & Attendee Import</span>
                </div>
                {!isWalkIn && selectedAttendee ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearAttendee}
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Switch to Walk-in
                  </Button>
                ) : null}
              </div>

              {selectedAttendee ? (
                <div className="space-y-2.5 rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <UserCheck className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs">
                            {customerName ||
                              selectedAttendee.member_name ||
                              (selectedAttendee.answers?.name as string) ||
                              (selectedAttendee.bevy_attendee_id
                                ? `Attendee #${selectedAttendee.bevy_attendee_id}`
                                : selectedAttendee.attendee_code
                                  ? `Attendee (${selectedAttendee.attendee_code})`
                                  : "Registered Attendee")}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          >
                            {selectedAttendee.attendee_code
                              ? `Ticket: ${selectedAttendee.attendee_code}`
                              : selectedAttendee.bevy_attendee_id
                                ? `Bevy Ticket #${selectedAttendee.bevy_attendee_id}`
                                : "Registered Attendee"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {customerEmail ||
                            selectedAttendee.member_email ||
                            (selectedAttendee.answers?.email as string) ||
                            "No email provided"}
                          {customerPhone ? ` • ${customerPhone}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingAttendeeDetails((prev) => !prev)}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {isEditingAttendeeDetails ? "Done" : "Edit"}
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={handleClearAttendee}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isEditingAttendeeDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label htmlFor="cust-name-extra" className="text-[11px]">
                          Customer Name <span className="text-destructive font-semibold ml-0.5">*</span>
                        </Label>
                        <Input
                          id="cust-name-extra"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Attendee Name"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cust-email-extra" className="text-[11px]">
                          Customer Email <span className="text-destructive font-semibold ml-0.5">*</span>
                        </Label>
                        <Input
                          id="cust-email-extra"
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="attendee@example.com"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cust-phone-extra" className="text-[11px]">
                          Customer Phone <span className="text-destructive font-semibold ml-0.5">*</span>
                        </Label>
                        <Input
                          id="cust-phone-extra"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="08123456789"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search registered attendee by name, email, or ticket code..."
                      value={attendeeSearchQuery}
                      onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  {filteredAttendees.length > 0 && (
                    <div className="rounded-lg border bg-background shadow-xs overflow-hidden divide-y divide-border/60 max-h-40 overflow-y-auto">
                      {filteredAttendees.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelectAttendee(r)}
                          className="w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-medium text-xs text-foreground block">
                              {r.member_name || (r.answers?.name as string) || "Attendee"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {r.member_email || (r.answers?.email as string)}
                              {r.attendee_code ? ` • ${r.attendee_code}` : ""}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {r.ticket_tier || r.ticket_name || "Ticket"}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="cust-name" className="text-[11px]">
                        Full Name <span className="text-destructive font-semibold ml-0.5">*</span>
                      </Label>
                      <Input
                        id="cust-name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="John Doe"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cust-email" className="text-[11px]">
                        Email Address <span className="text-destructive font-semibold ml-0.5">*</span>
                      </Label>
                      <Input
                        id="cust-email"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cust-phone" className="text-[11px]">
                        WhatsApp / Phone <span className="text-destructive font-semibold ml-0.5">*</span>
                      </Label>
                      <Input
                        id="cust-phone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="08123456789"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Sale Type Toggle (Single Item vs Bundle) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sale Type</Label>
              <Tabs value={saleType} onValueChange={(v) => setSaleType(v as "item" | "bundle")} className="w-full">
                <TabsList className="grid h-8 w-full grid-cols-2">
                  <TabsTrigger value="item" className="text-xs gap-1.5">
                    <Package className="size-3.5" />
                    Individual Merchandise
                  </TabsTrigger>
                  <TabsTrigger value="bundle" disabled={availableBundles.length === 0} className="text-xs gap-1.5">
                    <PackageCheck className="size-3.5" />
                    Merchandise Bundle
                    {availableBundles.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {availableBundles.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 3. Item or Bundle Configuration */}
            {saleType === "item" ? (
              <div className="rounded-xl border p-3.5 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="select-item" className="text-xs font-medium">
                    Select Merchandise
                  </Label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                    <SelectTrigger id="select-item" className="h-9 text-xs">
                      <SelectValue placeholder="Choose merchandise item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-xs">
                          {item.name} — Rp {(item.price || 0).toLocaleString("id-ID")}
                          {item.is_ots_only ? " (OTS Only)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {currentItem && currentItem.variations && currentItem.variations.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {currentItem.variations.map((v) => (
                      <div key={v.name} className="space-y-1">
                        <Label className="text-[11px] font-medium">{v.name}</Label>
                        <Select
                          value={selectedVariations[v.name] || v.options[0] || ""}
                          onValueChange={(val) => setSelectedVariations((prev) => ({ ...prev, [v.name]: val }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={`Select ${v.name}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {v.options.map((opt) => {
                              const optPrice = v.option_details?.[opt]?.price;
                              return (
                                <SelectItem key={opt} value={opt} className="text-xs">
                                  {opt}
                                  {optPrice !== undefined && optPrice !== null
                                    ? ` (Rp ${optPrice.toLocaleString("id-ID")})`
                                    : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quota & Quantity Indicator */}
                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium block">
                      Price: <strong>Rp {effectiveUnitPrice.toLocaleString("id-ID")}</strong> / unit
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {itemQuota.maxAllowed !== null && !isSubmitting && !createdResult && (
                        <span
                          className={cn(
                            "text-[11px] font-medium block",
                            itemQuota.remaining <= 0 ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {itemQuota.remaining <= 0
                            ? `⚠️ Purchase limit reached (${itemQuota.currentCount} of ${itemQuota.maxAllowed} units already bought)`
                            : `Person limit: ${itemQuota.maxAllowed} per person (${itemQuota.remaining} remaining)`}
                        </span>
                      )}
                      {remainingItemStock !== null && (
                        <span
                          className={cn(
                            "text-[11px] font-medium block",
                            remainingItemStock <= 0 ? "text-destructive font-semibold" : "text-muted-foreground",
                          )}
                        >
                          {remainingItemStock <= 0
                            ? "⚠️ Out of Stock (0 units left)"
                            : `Stock Quota: ${remainingItemStock} units left (Sold: ${itemTotalSold} of ${currentItem?.stock})`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="item-qty" className="text-xs">
                      Qty:
                    </Label>
                    <Input
                      id="item-qty"
                      type="number"
                      min="1"
                      max={
                        remainingItemStock !== null
                          ? Math.min(itemQuota.remaining > 0 ? itemQuota.remaining : 1, Math.max(1, remainingItemStock))
                          : itemQuota.remaining > 0
                            ? itemQuota.remaining
                            : 1
                      }
                      disabled={
                        (itemQuota.maxAllowed !== null && itemQuota.remaining <= 0) ||
                        (remainingItemStock !== null && remainingItemStock <= 0)
                      }
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="h-8 w-16 text-center text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-3.5 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="select-bundle" className="text-xs font-medium">
                    Select Bundle Package
                  </Label>
                  <Select value={selectedBundleId} onValueChange={setSelectedBundleId}>
                    <SelectTrigger id="select-bundle" className="h-9 text-xs">
                      <SelectValue placeholder="Choose bundle package..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBundles.map((bundle) => (
                        <SelectItem key={bundle.id} value={bundle.id} className="text-xs">
                          {bundle.name} — Rp {(bundle.price || 0).toLocaleString("id-ID")}
                          {bundle.is_ots_only ? " (OTS Only)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {currentBundle && (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Included Package Items:
                    </div>

                    {/* Linked Ticket if present */}
                    {(() => {
                      const linkedTicket = currentBundle.ticket_id
                        ? (event.tickets ?? []).find((t) => t.id === currentBundle.ticket_id)
                        : null;
                      if (!linkedTicket) return null;
                      return (
                        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0 text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Ticket className="size-3.5 text-primary shrink-0" />
                            <span>
                              {currentBundle.ticket_quantity || 1}x {linkedTicket.name}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            Admission Pass
                          </Badge>
                        </div>
                      );
                    })()}

                    {/* Merchandise Items */}
                    {(currentBundle.merchandise_items ?? []).map((bi) => {
                      const matchingMerch = (event.merchandise ?? []).find((m) => m.id === bi.merchandise_id);
                      const variationsList = matchingMerch?.variations ?? [];

                      return (
                        <div
                          key={bi.merchandise_id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                        >
                          <span className="text-xs font-medium text-foreground">
                            {bi.quantity || 1}x {matchingMerch?.name || "Merchandise Item"}
                          </span>
                          {variationsList.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {variationsList.map((v) => (
                                <Select
                                  key={v.name}
                                  value={bundleVariations[bi.merchandise_id]?.[v.name] || v.options[0] || ""}
                                  onValueChange={(val) => {
                                    setBundleVariations((prev) => ({
                                      ...prev,
                                      [bi.merchandise_id]: {
                                        ...(prev[bi.merchandise_id] || {}),
                                        [v.name]: val,
                                      },
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-[11px] w-28">
                                    <SelectValue placeholder={v.name} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {v.options.map((opt) => (
                                      <SelectItem key={opt} value={opt} className="text-xs">
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {(!currentBundle.merchandise_items || currentBundle.merchandise_items.length === 0) &&
                      !currentBundle.ticket_id && (
                        <p className="text-xs text-muted-foreground italic">
                          {currentBundle.description || "Package bundle items included."}
                        </p>
                      )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                  <span className="font-medium text-muted-foreground">Bundle Total:</span>
                  <div className="text-right">
                    <span className="font-bold text-foreground">
                      Rp {(currentBundle?.price || 0).toLocaleString("id-ID")}
                    </span>
                    {remainingBundleCapacity !== null && !isSubmitting && !createdResult && (
                      <span
                        className={cn(
                          "text-[11px] font-medium block",
                          remainingBundleCapacity <= 0 ? "text-destructive font-semibold" : "text-muted-foreground",
                        )}
                      >
                        {remainingBundleCapacity <= 0
                          ? "⚠️ Bundle Sold Out"
                          : `Capacity: ${remainingBundleCapacity} left (${bundleTotalSold} sold)`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Payment Method & Options */}
            <div className="rounded-xl border p-3.5 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Payment Method
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === "qris" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("qris")}
                    className="h-7 text-xs gap-1.5"
                  >
                    <QrCode className="size-3.5" />
                    DOKU QRIS
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === "cash_manual" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("cash_manual")}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Banknote className="size-3.5" />
                    Cash / Direct
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <div className="space-y-0.5">
                  <Label htmlFor="mark-collected" className="text-xs font-medium cursor-pointer">
                    Hand over merchandise now (Mark as Collected)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Record that physical merchandise was handed to the customer on the spot.
                  </p>
                </div>
                <Switch id="mark-collected" checked={markCollectedNow} onCheckedChange={setMarkCollectedNow} />
              </div>
            </div>

            {/* 5. Summary Row */}
            <div className="rounded-xl bg-card border p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Subtotal:</span>
                <span>Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>
              {feeResult.isEnabled && feeResult.isPassedToAttendee && feeResult.feeAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{feeResult.feeLabel}:</span>
                  <span>Rp {feeResult.feeAmount.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-bold text-foreground border-t border-border/60 pt-2">
                <span>Total Amount:</span>
                <span className="text-base text-primary">Rp {finalTotal.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>
        )}

        {!createdResult && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (!isSubmitting && saleType === "item" && itemQuota.maxAllowed !== null && itemQuota.remaining <= 0) ||
                (!isSubmitting &&
                  saleType === "bundle" &&
                  remainingBundleCapacity !== null &&
                  remainingBundleCapacity <= 0)
              }
              className="gap-1.5 text-xs font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : paymentMethod === "qris" ? (
                <QrCode className="size-3.5" />
              ) : (
                <Check className="size-3.5" />
              )}
              {paymentMethod === "qris" ? "Generate Payment Link" : "Record Cash Payment"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
