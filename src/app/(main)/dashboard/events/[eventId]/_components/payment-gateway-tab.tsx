"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Info,
  Mail,
  Percent,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PAYMENT_HEADER_EMAIL_URL } from "@/lib/events/doku-payment";
import {
  calculatePaymentGatewayFee,
  DEFAULT_DOKU_TIER_ABOVE_PERCENT,
  DEFAULT_DOKU_TIER_BELOW_FEE,
  DEFAULT_DOKU_TIER_THRESHOLD,
  DEFAULT_FIXED_FEE,
  DEFAULT_PAYMENT_FEE_LABEL,
  DEFAULT_PERCENT_FEE,
  type PaymentFeeBearer,
  type PaymentFeeType,
} from "@/lib/events/payment-fee";
import { updateEventMerchandiseDeliveryConfigAction, updateEventPaymentConfigAction } from "@/lib/firestore/actions";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface PaymentGatewayTabProps {
  event: FirestoreEvent;
}

export function PaymentGatewayTab({ event }: PaymentGatewayTabProps) {
  const router = useRouter();
  const [isSaving, startTransition] = useTransition();

  const [paymentEnvironment, setPaymentEnvironment] = useState<"production" | "sandbox">(
    event.payment_environment ?? (event.is_test ? "sandbox" : "production"),
  );
  const [merchandiseDeliveryEnv, setMerchandiseDeliveryEnv] = useState<"production" | "sandbox">(
    event.merchandise_delivery_payment_environment ??
      event.payment_environment ??
      (event.is_test ? "sandbox" : "production"),
  );
  const [merchandiseDeliveryFee, setMerchandiseDeliveryFee] = useState<number>(event.merchandise_delivery_fee ?? 50000);
  const [headerEmailUrl, setHeaderEmailUrl] = useState<string>(
    event.headerEmailUrl ?? event.header_email_url ?? DEFAULT_PAYMENT_HEADER_EMAIL_URL,
  );
  const [paymentDeadlinesInMinutes, setPaymentDeadlinesInMinutes] = useState<number>(
    event.paymentDeadlinesInMinutes ?? event.paymentDeadlineMinutes ?? event.payment_deadline_minutes ?? 1440,
  );
  const [emailTemplate, setEmailTemplate] = useState<string>(
    event.payment_email_template ??
      event.paymentEmailTemplate ??
      (event.tickets?.some((t) => t.type === "commitment_fee") ? "Commitment Fee" : "Ticketing"),
  );

  // Payment Gateway Fee Configuration States
  const [paymentFeeEnabled, setPaymentFeeEnabled] = useState<boolean>(event.payment_fee_enabled ?? true);
  const [paymentFeeBearer, setPaymentFeeBearer] = useState<PaymentFeeBearer>(event.payment_fee_bearer ?? "attendee");
  const [paymentFeeType, setPaymentFeeType] = useState<PaymentFeeType>(event.payment_fee_type ?? "tiered");
  const [paymentFeeFixedAmount, setPaymentFeeFixedAmount] = useState<number>(
    event.payment_fee_fixed_amount ?? DEFAULT_FIXED_FEE,
  );
  const [paymentFeePercentage, setPaymentFeePercentage] = useState<number>(
    event.payment_fee_percentage ?? DEFAULT_PERCENT_FEE,
  );
  const [paymentFeeThreshold, setPaymentFeeThreshold] = useState<number>(
    event.payment_fee_threshold ?? DEFAULT_DOKU_TIER_THRESHOLD,
  );
  const [paymentFeeTierBelowAmount, setPaymentFeeTierBelowAmount] = useState<number>(
    event.payment_fee_tier_below_amount ?? DEFAULT_DOKU_TIER_BELOW_FEE,
  );
  const [paymentFeeTierAbovePercent, setPaymentFeeTierAbovePercent] = useState<number>(
    event.payment_fee_tier_above_percent ?? DEFAULT_DOKU_TIER_ABOVE_PERCENT,
  );
  const [paymentFeeLabel, setPaymentFeeLabel] = useState<string>(event.payment_fee_label ?? DEFAULT_PAYMENT_FEE_LABEL);

  // Test amount for the interactive fee preview sandbox
  const [previewTestAmount, setPreviewTestAmount] = useState<number>(100000);

  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      paymentEnvironment,
      merchandiseDeliveryEnv,
      merchandiseDeliveryFee,
      headerEmailUrl,
      paymentDeadlinesInMinutes,
      emailTemplate,
      paymentFeeEnabled,
      paymentFeeBearer,
      paymentFeeType,
      paymentFeeFixedAmount,
      paymentFeePercentage,
      paymentFeeThreshold,
      paymentFeeTierBelowAmount,
      paymentFeeTierAbovePercent,
      paymentFeeLabel,
    });
  }, [
    paymentEnvironment,
    merchandiseDeliveryEnv,
    merchandiseDeliveryFee,
    headerEmailUrl,
    paymentDeadlinesInMinutes,
    emailTemplate,
    paymentFeeEnabled,
    paymentFeeBearer,
    paymentFeeType,
    paymentFeeFixedAmount,
    paymentFeePercentage,
    paymentFeeThreshold,
    paymentFeeTierBelowAmount,
    paymentFeeTierAbovePercent,
    paymentFeeLabel,
  ]);

  const simulatedCalculation = useMemo(() => {
    return calculatePaymentGatewayFee(previewTestAmount, {
      payment_fee_enabled: paymentFeeEnabled,
      payment_fee_bearer: paymentFeeBearer,
      payment_fee_type: paymentFeeType,
      payment_fee_fixed_amount: paymentFeeFixedAmount,
      payment_fee_percentage: paymentFeePercentage,
      payment_fee_threshold: paymentFeeThreshold,
      payment_fee_tier_below_amount: paymentFeeTierBelowAmount,
      payment_fee_tier_above_percent: paymentFeeTierAbovePercent,
      payment_fee_label: paymentFeeLabel,
    });
  }, [
    previewTestAmount,
    paymentFeeEnabled,
    paymentFeeBearer,
    paymentFeeType,
    paymentFeeFixedAmount,
    paymentFeePercentage,
    paymentFeeThreshold,
    paymentFeeTierBelowAmount,
    paymentFeeTierAbovePercent,
    paymentFeeLabel,
  ]);

  const isDirty =
    isInitialLoaded && initialSnapshotRef.current !== null && initialSnapshotRef.current !== currentSnapshot;
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  const eventRef = useRef(event);
  eventRef.current = event;

  // Load latest values from Firestore on mount (scoped to event.id, never on every event reference change)
  useEffect(() => {
    async function loadConfig() {
      const currentEvent = eventRef.current;
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));

        const loadedEnv = (docData?.payment_environment ??
          currentEvent.payment_environment ??
          (currentEvent.is_test ? "sandbox" : "production")) as "production" | "sandbox";
        const loadedDeliveryEnv = (docData?.merchandise_delivery_payment_environment ??
          currentEvent.merchandise_delivery_payment_environment ??
          loadedEnv) as "production" | "sandbox";
        let loadedDeliveryFee = 50000;
        if (typeof docData?.merchandise_delivery_fee === "number") {
          loadedDeliveryFee = docData.merchandise_delivery_fee;
        } else if (typeof currentEvent.merchandise_delivery_fee === "number") {
          loadedDeliveryFee = currentEvent.merchandise_delivery_fee;
        }
        const loadedHeaderEmail =
          docData?.headerEmailUrl ??
          docData?.header_email_url ??
          currentEvent.headerEmailUrl ??
          currentEvent.header_email_url ??
          DEFAULT_PAYMENT_HEADER_EMAIL_URL;
        const loadedPaymentDeadlines =
          docData?.paymentDeadlinesInMinutes ??
          docData?.paymentDeadlineMinutes ??
          docData?.payment_deadline_minutes ??
          currentEvent.paymentDeadlinesInMinutes ??
          currentEvent.paymentDeadlineMinutes ??
          currentEvent.payment_deadline_minutes ??
          1440;
        const loadedEmailTemplate =
          docData?.payment_email_template ??
          docData?.paymentEmailTemplate ??
          currentEvent.payment_email_template ??
          currentEvent.paymentEmailTemplate ??
          (currentEvent.tickets?.some((t) => t.type === "commitment_fee") ? "Commitment Fee" : "Ticketing");

        const loadedFeeEnabled = docData?.payment_fee_enabled ?? currentEvent.payment_fee_enabled ?? true;
        const loadedFeeBearer = (docData?.payment_fee_bearer ??
          currentEvent.payment_fee_bearer ??
          "attendee") as PaymentFeeBearer;
        const loadedFeeType = (docData?.payment_fee_type ??
          currentEvent.payment_fee_type ??
          "tiered") as PaymentFeeType;
        const loadedFeeFixed =
          typeof docData?.payment_fee_fixed_amount === "number"
            ? docData.payment_fee_fixed_amount
            : (currentEvent.payment_fee_fixed_amount ?? DEFAULT_FIXED_FEE);
        const loadedFeePercentage =
          typeof docData?.payment_fee_percentage === "number"
            ? docData.payment_fee_percentage
            : (currentEvent.payment_fee_percentage ?? DEFAULT_PERCENT_FEE);
        const loadedFeeThreshold =
          typeof docData?.payment_fee_threshold === "number"
            ? docData.payment_fee_threshold
            : (currentEvent.payment_fee_threshold ?? DEFAULT_DOKU_TIER_THRESHOLD);
        const loadedFeeTierBelow =
          typeof docData?.payment_fee_tier_below_amount === "number"
            ? docData.payment_fee_tier_below_amount
            : (currentEvent.payment_fee_tier_below_amount ?? DEFAULT_DOKU_TIER_BELOW_FEE);
        const loadedFeeTierAbove =
          typeof docData?.payment_fee_tier_above_percent === "number"
            ? docData.payment_fee_tier_above_percent
            : (currentEvent.payment_fee_tier_above_percent ?? DEFAULT_DOKU_TIER_ABOVE_PERCENT);
        const loadedFeeLabel =
          docData?.payment_fee_label ?? currentEvent.payment_fee_label ?? DEFAULT_PAYMENT_FEE_LABEL;

        if (!isDirtyRef.current) {
          setPaymentEnvironment(loadedEnv);
          setMerchandiseDeliveryEnv(loadedDeliveryEnv);
          setMerchandiseDeliveryFee(loadedDeliveryFee);
          setHeaderEmailUrl(loadedHeaderEmail);
          setPaymentDeadlinesInMinutes(loadedPaymentDeadlines);
          setEmailTemplate(loadedEmailTemplate);
          setPaymentFeeEnabled(loadedFeeEnabled);
          setPaymentFeeBearer(loadedFeeBearer);
          setPaymentFeeType(loadedFeeType);
          setPaymentFeeFixedAmount(loadedFeeFixed);
          setPaymentFeePercentage(loadedFeePercentage);
          setPaymentFeeThreshold(loadedFeeThreshold);
          setPaymentFeeTierBelowAmount(loadedFeeTierBelow);
          setPaymentFeeTierAbovePercent(loadedFeeTierAbove);
          setPaymentFeeLabel(loadedFeeLabel);

          initialSnapshotRef.current = JSON.stringify({
            paymentEnvironment: loadedEnv,
            merchandiseDeliveryEnv: loadedDeliveryEnv,
            merchandiseDeliveryFee: loadedDeliveryFee,
            headerEmailUrl: loadedHeaderEmail,
            paymentDeadlinesInMinutes: loadedPaymentDeadlines,
            emailTemplate: loadedEmailTemplate,
            paymentFeeEnabled: loadedFeeEnabled,
            paymentFeeBearer: loadedFeeBearer,
            paymentFeeType: loadedFeeType,
            paymentFeeFixedAmount: loadedFeeFixed,
            paymentFeePercentage: loadedFeePercentage,
            paymentFeeThreshold: loadedFeeThreshold,
            paymentFeeTierBelowAmount: loadedFeeTierBelow,
            paymentFeeTierAbovePercent: loadedFeeTierAbove,
            paymentFeeLabel: loadedFeeLabel,
          });
        }
      } catch (err) {
        console.warn("[PaymentGatewayTab] Failed to fetch latest Firestore config:", err);
        const fallbackEnv = currentEvent.payment_environment ?? (currentEvent.is_test ? "sandbox" : "production");
        const fallbackDeliveryEnv = currentEvent.merchandise_delivery_payment_environment ?? fallbackEnv;
        const fallbackDeliveryFee = currentEvent.merchandise_delivery_fee ?? 50000;
        const fallbackHeaderEmail =
          currentEvent.headerEmailUrl ?? currentEvent.header_email_url ?? DEFAULT_PAYMENT_HEADER_EMAIL_URL;
        const fallbackPaymentDeadlines =
          currentEvent.paymentDeadlinesInMinutes ??
          currentEvent.paymentDeadlineMinutes ??
          currentEvent.payment_deadline_minutes ??
          1440;
        const fallbackEmailTemplate =
          currentEvent.payment_email_template ??
          currentEvent.paymentEmailTemplate ??
          (currentEvent.tickets?.some((t) => t.type === "commitment_fee") ? "Commitment Fee" : "Ticketing");
        const fallbackFeeEnabled = currentEvent.payment_fee_enabled ?? true;
        const fallbackFeeBearer = (currentEvent.payment_fee_bearer ?? "attendee") as PaymentFeeBearer;
        const fallbackFeeType = (currentEvent.payment_fee_type ?? "tiered") as PaymentFeeType;
        const fallbackFeeFixed = currentEvent.payment_fee_fixed_amount ?? DEFAULT_FIXED_FEE;
        const fallbackFeePercentage = currentEvent.payment_fee_percentage ?? DEFAULT_PERCENT_FEE;
        const fallbackFeeThreshold = currentEvent.payment_fee_threshold ?? DEFAULT_DOKU_TIER_THRESHOLD;
        const fallbackFeeTierBelow = currentEvent.payment_fee_tier_below_amount ?? DEFAULT_DOKU_TIER_BELOW_FEE;
        const fallbackFeeTierAbove = currentEvent.payment_fee_tier_above_percent ?? DEFAULT_DOKU_TIER_ABOVE_PERCENT;
        const fallbackFeeLabel = currentEvent.payment_fee_label ?? DEFAULT_PAYMENT_FEE_LABEL;

        if (!isDirtyRef.current) {
          initialSnapshotRef.current ??= JSON.stringify({
            paymentEnvironment: fallbackEnv,
            merchandiseDeliveryEnv: fallbackDeliveryEnv,
            merchandiseDeliveryFee: fallbackDeliveryFee,
            headerEmailUrl: fallbackHeaderEmail,
            paymentDeadlinesInMinutes: fallbackPaymentDeadlines,
            emailTemplate: fallbackEmailTemplate,
            paymentFeeEnabled: fallbackFeeEnabled,
            paymentFeeBearer: fallbackFeeBearer,
            paymentFeeType: fallbackFeeType,
            paymentFeeFixedAmount: fallbackFeeFixed,
            paymentFeePercentage: fallbackFeePercentage,
            paymentFeeThreshold: fallbackFeeThreshold,
            paymentFeeTierBelowAmount: fallbackFeeTierBelow,
            paymentFeeTierAbovePercent: fallbackFeeTierAbove,
            paymentFeeLabel: fallbackFeeLabel,
          });
        }
      } finally {
        setIsInitialLoaded(true);
      }
    }
    void loadConfig();
  }, [event.id]);

  // Real-time synchronization of merchandise delivery environment across tabs in the same window
  useEffect(() => {
    const handleEnvChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; environment: "production" | "sandbox" }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(event.id)) {
        const nextEnv = customEvent.detail.environment;
        setMerchandiseDeliveryEnv(nextEnv);
        if (initialSnapshotRef.current) {
          try {
            const parsed = JSON.parse(initialSnapshotRef.current);
            parsed.merchandiseDeliveryEnv = nextEnv;
            initialSnapshotRef.current = JSON.stringify(parsed);
          } catch {
            // ignore
          }
        }
      }
    };
    window.addEventListener("gdg:merchandise-delivery-env-change", handleEnvChange);
    return () => {
      window.removeEventListener("gdg:merchandise-delivery-env-change", handleEnvChange);
    };
  }, [event.id]);

  // Real-time subscription to Firestore document
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function setupSub() {
      try {
        const { subscribeFirestoreEventDoc } = await import("@/lib/firestore/client");
        unsubscribe = subscribeFirestoreEventDoc(String(event.id), (docData) => {
          // If the user has active unsaved form edits, do NOT overwrite their inputs with remote state
          if (isDirtyRef.current) {
            return;
          }

          if (docData.merchandise_delivery_payment_environment) {
            setMerchandiseDeliveryEnv(docData.merchandise_delivery_payment_environment);
          }
          if (docData.payment_environment) {
            setPaymentEnvironment(docData.payment_environment);
          }
          if (typeof docData.merchandise_delivery_fee === "number") {
            setMerchandiseDeliveryFee(docData.merchandise_delivery_fee);
          }
          const incomingHeaderEmail = docData.headerEmailUrl ?? docData.header_email_url;
          if (incomingHeaderEmail !== undefined && incomingHeaderEmail !== null) {
            setHeaderEmailUrl(incomingHeaderEmail);
          }
          const incomingDeadline =
            docData.paymentDeadlinesInMinutes ?? docData.paymentDeadlineMinutes ?? docData.payment_deadline_minutes;
          if (typeof incomingDeadline === "number") {
            setPaymentDeadlinesInMinutes(incomingDeadline);
          }
          const incomingEmailTemplate = docData.payment_email_template ?? docData.paymentEmailTemplate;
          if (incomingEmailTemplate) {
            setEmailTemplate(incomingEmailTemplate);
          }
          if (docData.payment_fee_enabled !== undefined) {
            setPaymentFeeEnabled(docData.payment_fee_enabled);
          }
          if (docData.payment_fee_bearer) {
            setPaymentFeeBearer(docData.payment_fee_bearer);
          }
          if (docData.payment_fee_type) {
            setPaymentFeeType(docData.payment_fee_type);
          }
          if (typeof docData.payment_fee_fixed_amount === "number") {
            setPaymentFeeFixedAmount(docData.payment_fee_fixed_amount);
          }
          if (typeof docData.payment_fee_percentage === "number") {
            setPaymentFeePercentage(docData.payment_fee_percentage);
          }
          if (typeof docData.payment_fee_threshold === "number") {
            setPaymentFeeThreshold(docData.payment_fee_threshold);
          }
          if (typeof docData.payment_fee_tier_below_amount === "number") {
            setPaymentFeeTierBelowAmount(docData.payment_fee_tier_below_amount);
          }
          if (typeof docData.payment_fee_tier_above_percent === "number") {
            setPaymentFeeTierAbovePercent(docData.payment_fee_tier_above_percent);
          }
          if (docData.payment_fee_label) {
            setPaymentFeeLabel(docData.payment_fee_label);
          }

          if (initialSnapshotRef.current) {
            try {
              const parsed = JSON.parse(initialSnapshotRef.current);
              if (docData.merchandise_delivery_payment_environment) {
                parsed.merchandiseDeliveryEnv = docData.merchandise_delivery_payment_environment;
              }
              if (docData.payment_environment) {
                parsed.paymentEnvironment = docData.payment_environment;
              }
              if (typeof docData.merchandise_delivery_fee === "number") {
                parsed.merchandiseDeliveryFee = docData.merchandise_delivery_fee;
              }
              if (incomingHeaderEmail !== undefined) {
                parsed.headerEmailUrl = incomingHeaderEmail;
              }
              if (typeof incomingDeadline === "number") {
                parsed.paymentDeadlinesInMinutes = incomingDeadline;
              }
              if (incomingEmailTemplate) {
                parsed.emailTemplate = incomingEmailTemplate;
              }
              if (docData.payment_fee_enabled !== undefined) {
                parsed.paymentFeeEnabled = docData.payment_fee_enabled;
              }
              if (docData.payment_fee_bearer) {
                parsed.paymentFeeBearer = docData.payment_fee_bearer;
              }
              if (docData.payment_fee_type) {
                parsed.paymentFeeType = docData.payment_fee_type;
              }
              if (typeof docData.payment_fee_fixed_amount === "number") {
                parsed.paymentFeeFixedAmount = docData.payment_fee_fixed_amount;
              }
              if (typeof docData.payment_fee_percentage === "number") {
                parsed.paymentFeePercentage = docData.payment_fee_percentage;
              }
              if (typeof docData.payment_fee_threshold === "number") {
                parsed.paymentFeeThreshold = docData.payment_fee_threshold;
              }
              if (typeof docData.payment_fee_tier_below_amount === "number") {
                parsed.paymentFeeTierBelowAmount = docData.payment_fee_tier_below_amount;
              }
              if (typeof docData.payment_fee_tier_above_percent === "number") {
                parsed.paymentFeeTierAbovePercent = docData.payment_fee_tier_above_percent;
              }
              if (docData.payment_fee_label) {
                parsed.paymentFeeLabel = docData.payment_fee_label;
              }
              initialSnapshotRef.current = JSON.stringify(parsed);
            } catch {
              // ignore
            }
          }
        });
      } catch (err) {
        console.warn("[PaymentGatewayTab] Failed to subscribe to Firestore event:", err);
      }
    }
    void setupSub();
    return () => {
      unsubscribe?.();
    };
  }, [event.id]);

  const handleMerchandiseDeliveryEnvChange = async (val: "production" | "sandbox") => {
    setMerchandiseDeliveryEnv(val);

    // Optimistically broadcast change to MerchandiseDeliveryTab
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gdg:merchandise-delivery-env-change", {
          detail: { eventId: String(event.id), environment: val },
        }),
      );
    }

    // Keep baseline snapshot in sync so changing environment doesn't trigger dirty prompt
    if (initialSnapshotRef.current) {
      try {
        const parsed = JSON.parse(initialSnapshotRef.current);
        parsed.merchandiseDeliveryEnv = val;
        initialSnapshotRef.current = JSON.stringify(parsed);
      } catch {
        // ignore
      }
    }

    try {
      const res = await updateEventMerchandiseDeliveryConfigAction(String(event.id), val, event);
      if (res.success) {
        toast.success(
          `Delivery payment environment set to ${val === "production" ? "Live Production" : "Development / Sandbox"}.`,
        );
      } else {
        toast.error(res.error || "Failed to update delivery payment environment.");
      }
    } catch {
      toast.error("Failed to update delivery payment environment.");
    }
  };

  // Handle browser unload and navigation intercept when dirty
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      pendingNavigationRef.current = () => {
        window.history.back();
      };
      setShowUnsavedDialog(true);
    };
    window.addEventListener("popstate", handlePopState);

    const handleClickCapture = (e: MouseEvent) => {
      if (showUnsavedDialog) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest("[data-slot='dialog-content']") ||
        target.closest("[role='dialog']") ||
        target.closest("[data-slot='select-content']") ||
        target.closest("[role='listbox']")
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const tabTrigger = target.closest<HTMLElement>("[role='tab'], [data-slot='tabs-trigger']");
      if (tabTrigger) {
        const isCurrentTab =
          tabTrigger.getAttribute("value") === "payment" ||
          tabTrigger.getAttribute("data-value") === "payment" ||
          tabTrigger.textContent?.toLowerCase().includes("payment");

        if (!isCurrentTab) {
          e.preventDefault();
          e.stopPropagation();
          pendingNavigationRef.current = () => {
            tabTrigger.click();
          };
          setShowUnsavedDialog(true);
          return;
        }
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (
          href &&
          !href.startsWith("#") &&
          !href.startsWith("javascript:") &&
          anchor.target !== "_blank" &&
          !anchor.hasAttribute("download")
        ) {
          e.preventDefault();
          e.stopPropagation();
          pendingNavigationRef.current = () => {
            router.push(href);
          };
          setShowUnsavedDialog(true);
        }
      }
    };

    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty, showUnsavedDialog, router]);

  const handleSave = () => {
    if (!event.id) {
      toast.error("Event ID is missing.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateEventPaymentConfigAction(
          String(event.id),
          {
            payment_environment: paymentEnvironment,
            merchandise_delivery_payment_environment: merchandiseDeliveryEnv,
            merchandise_delivery_fee: merchandiseDeliveryFee,
            headerEmailUrl: headerEmailUrl.trim(),
            header_email_url: headerEmailUrl.trim(),
            paymentDeadlinesInMinutes,
            paymentDeadlineMinutes: paymentDeadlinesInMinutes,
            payment_deadline_minutes: paymentDeadlinesInMinutes,
            payment_email_template: emailTemplate,
            paymentEmailTemplate: emailTemplate,
            payment_fee_enabled: paymentFeeEnabled,
            payment_fee_bearer: paymentFeeBearer,
            payment_fee_type: paymentFeeType,
            payment_fee_fixed_amount: paymentFeeFixedAmount,
            payment_fee_percentage: paymentFeePercentage,
            payment_fee_threshold: paymentFeeThreshold,
            payment_fee_tier_below_amount: paymentFeeTierBelowAmount,
            payment_fee_tier_above_percent: paymentFeeTierAbovePercent,
            payment_fee_label: paymentFeeLabel.trim(),
          },
          event,
        );

        if (res.success) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("gdg:payment-env-change", {
                detail: { eventId: String(event.id), environment: paymentEnvironment },
              }),
            );
            window.dispatchEvent(
              new CustomEvent("gdg:merchandise-delivery-env-change", {
                detail: { eventId: String(event.id), environment: merchandiseDeliveryEnv },
              }),
            );
          }
          initialSnapshotRef.current = JSON.stringify({
            paymentEnvironment,
            merchandiseDeliveryEnv,
            merchandiseDeliveryFee,
            headerEmailUrl,
            paymentDeadlinesInMinutes,
            emailTemplate,
            paymentFeeEnabled,
            paymentFeeBearer,
            paymentFeeType,
            paymentFeeFixedAmount,
            paymentFeePercentage,
            paymentFeeThreshold,
            paymentFeeTierBelowAmount,
            paymentFeeTierAbovePercent,
            paymentFeeLabel,
          });
          toast.success("Payment gateway settings saved successfully!");
          router.refresh();
        } else {
          toast.error(res.error || "Failed to save payment settings.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save payment settings.";
        toast.error(msg);
      }
    });
  };

  const handleDiscard = () => {
    const raw = initialSnapshotRef.current;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        paymentEnvironment: "production" | "sandbox";
        merchandiseDeliveryEnv?: "production" | "sandbox";
        merchandiseDeliveryFee?: number;
        headerEmailUrl?: string;
        paymentDeadlinesInMinutes?: number;
        emailTemplate?: string;
        paymentFeeEnabled?: boolean;
        paymentFeeBearer?: PaymentFeeBearer;
        paymentFeeType?: PaymentFeeType;
        paymentFeeFixedAmount?: number;
        paymentFeePercentage?: number;
        paymentFeeThreshold?: number;
        paymentFeeTierBelowAmount?: number;
        paymentFeeTierAbovePercent?: number;
        paymentFeeLabel?: string;
      };
      setPaymentEnvironment(parsed.paymentEnvironment);
      setMerchandiseDeliveryEnv(parsed.merchandiseDeliveryEnv ?? parsed.paymentEnvironment);
      setMerchandiseDeliveryFee(parsed.merchandiseDeliveryFee ?? 50000);
      setHeaderEmailUrl(
        parsed.headerEmailUrl ?? event.headerEmailUrl ?? event.header_email_url ?? DEFAULT_PAYMENT_HEADER_EMAIL_URL,
      );
      setPaymentDeadlinesInMinutes(
        parsed.paymentDeadlinesInMinutes ??
          event.paymentDeadlinesInMinutes ??
          event.paymentDeadlineMinutes ??
          event.payment_deadline_minutes ??
          1440,
      );
      setEmailTemplate(
        parsed.emailTemplate ??
          event.payment_email_template ??
          event.paymentEmailTemplate ??
          (event.tickets?.some((t) => t.type === "commitment_fee") ? "Commitment Fee" : "Ticketing"),
      );
      setPaymentFeeEnabled(parsed.paymentFeeEnabled ?? event.payment_fee_enabled ?? true);
      setPaymentFeeBearer(parsed.paymentFeeBearer ?? event.payment_fee_bearer ?? "attendee");
      setPaymentFeeType(parsed.paymentFeeType ?? event.payment_fee_type ?? "tiered");
      setPaymentFeeFixedAmount(parsed.paymentFeeFixedAmount ?? event.payment_fee_fixed_amount ?? DEFAULT_FIXED_FEE);
      setPaymentFeePercentage(parsed.paymentFeePercentage ?? event.payment_fee_percentage ?? DEFAULT_PERCENT_FEE);
      setPaymentFeeThreshold(parsed.paymentFeeThreshold ?? event.payment_fee_threshold ?? DEFAULT_DOKU_TIER_THRESHOLD);
      setPaymentFeeTierBelowAmount(
        parsed.paymentFeeTierBelowAmount ?? event.payment_fee_tier_below_amount ?? DEFAULT_DOKU_TIER_BELOW_FEE,
      );
      setPaymentFeeTierAbovePercent(
        parsed.paymentFeeTierAbovePercent ?? event.payment_fee_tier_above_percent ?? DEFAULT_DOKU_TIER_ABOVE_PERCENT,
      );
      setPaymentFeeLabel(parsed.paymentFeeLabel ?? event.payment_fee_label ?? DEFAULT_PAYMENT_FEE_LABEL);
      toast.info("Unsaved payment settings discarded.");
    } catch {
      const fallbackPaymentEnv = event.payment_environment ?? (event.is_test ? "sandbox" : "production");
      setPaymentEnvironment(fallbackPaymentEnv);
      setMerchandiseDeliveryEnv(
        event.merchandise_delivery_payment_environment ??
          event.payment_environment ??
          (event.is_test ? "sandbox" : "production"),
      );
      setMerchandiseDeliveryFee(event.merchandise_delivery_fee ?? 50000);
      setHeaderEmailUrl(event.headerEmailUrl ?? event.header_email_url ?? DEFAULT_PAYMENT_HEADER_EMAIL_URL);
      setPaymentDeadlinesInMinutes(
        event.paymentDeadlinesInMinutes ?? event.paymentDeadlineMinutes ?? event.payment_deadline_minutes ?? 1440,
      );
      setEmailTemplate(
        event.payment_email_template ??
          event.paymentEmailTemplate ??
          (event.tickets?.some((t) => t.type === "commitment_fee") ? "Commitment Fee" : "Ticketing"),
      );
      setPaymentFeeEnabled(event.payment_fee_enabled ?? true);
      setPaymentFeeBearer(event.payment_fee_bearer ?? "attendee");
      setPaymentFeeType(event.payment_fee_type ?? "tiered");
      setPaymentFeeFixedAmount(event.payment_fee_fixed_amount ?? DEFAULT_FIXED_FEE);
      setPaymentFeePercentage(event.payment_fee_percentage ?? DEFAULT_PERCENT_FEE);
      setPaymentFeeThreshold(event.payment_fee_threshold ?? DEFAULT_DOKU_TIER_THRESHOLD);
      setPaymentFeeTierBelowAmount(event.payment_fee_tier_below_amount ?? DEFAULT_DOKU_TIER_BELOW_FEE);
      setPaymentFeeTierAbovePercent(event.payment_fee_tier_above_percent ?? DEFAULT_DOKU_TIER_ABOVE_PERCENT);
      setPaymentFeeLabel(event.payment_fee_label ?? DEFAULT_PAYMENT_FEE_LABEL);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ── 0. DOKU DEVELOPER & MERCHANT PORTALS ──────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <CardTitle className="text-base sm:text-lg">DOKU Portals & Simulator</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Quick access to official DOKU merchant back-office dashboards and QRIS payment testing simulator
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 text-xs">
                <a href="https://sandbox.doku.com/qris-simulator/customer" target="_blank" rel="noopener noreferrer">
                  <QrCode className="size-3.5 text-primary" />
                  QRIS Simulator
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 text-xs">
                <a href="https://sandbox.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                  Sandbox Dashboard
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 text-xs">
                <a href="https://dashboard.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                  Production Dashboard
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* DOKU QRIS Simulator */}
            <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/40">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                    <QrCode className="size-4 text-primary" />
                    QRIS Simulator
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    Testing Tool
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Simulate QRIS barcode scanning and trigger mock payment success for Sandbox invoices.
                </p>
              </div>
              <div className="pt-3">
                <Button variant="outline" size="sm" asChild className="w-full gap-1.5 text-xs">
                  <a href="https://sandbox.doku.com/qris-simulator/customer" target="_blank" rel="noopener noreferrer">
                    <QrCode className="size-3.5" />
                    Open QRIS Simulator
                    <ExternalLink className="size-3 opacity-60" />
                  </a>
                </Button>
              </div>
            </div>

            {/* DOKU Sandbox Dashboard */}
            <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3.5 transition-colors hover:border-amber-500/40 hover:bg-muted/40">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                    <CreditCard className="size-4 text-amber-500" />
                    Sandbox Dashboard
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    Development
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Inspect sandbox test transactions, client IDs, secret keys, and webhook callback status.
                </p>
              </div>
              <div className="pt-3">
                <Button variant="outline" size="sm" asChild className="w-full gap-1.5 text-xs">
                  <a href="https://sandbox.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open Sandbox Dashboard
                  </a>
                </Button>
              </div>
            </div>

            {/* DOKU Production Dashboard */}
            <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3.5 transition-colors hover:border-emerald-500/40 hover:bg-muted/40">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Production Dashboard
                  </span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                  >
                    Live
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Live merchant back-office for settlement, disbursements, and real revenue tracking.
                </p>
              </div>
              <div className="pt-3">
                <Button variant="outline" size="sm" asChild className="w-full gap-1.5 text-xs">
                  <a href="https://dashboard.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open Production Dashboard
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 1. PAYMENT GATEWAY & API ENVIRONMENT CARD ────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" />
              <CardTitle className="text-lg">Payment Gateway & API Environment</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {paymentEnvironment === "production" ? (
                <Badge className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  Live Production
                </Badge>
              ) : (
                <Badge className="w-fit border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  Sandbox / Dev Mode
                </Badge>
              )}
              {isDirty && (
                <>
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                    Unsaved Changes
                  </Badge>
                  <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 px-2.5 text-xs">
                    {isSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <CardDescription>
            Configure whether QRIS payment link generation (DOKU Checkout via n8n webhook) for this event points to the
            Live Production API or the Development / Sandbox environment. QRIS is the only supported payment method.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={paymentEnvironment}
            onValueChange={(val) => {
              setPaymentEnvironment(val as "production" | "sandbox");
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {/* Sandbox Option */}
            <Label
              htmlFor="env-sandbox"
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
                paymentEnvironment === "sandbox"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sandbox" id="env-sandbox" />
                  <span className="font-semibold text-sm">Development / Sandbox</span>
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400">
                  Testing
                </Badge>
              </div>
              <p className="font-normal text-muted-foreground text-xs leading-relaxed">
                Generates test DOKU payment links and QRIS simulators (
                <code className="rounded bg-muted px-1 text-[11px]">isProduction: false</code>). Safe for testing event
                registration, tickets, and merchandise flows without real financial charges.
              </p>
            </Label>

            {/* Production Option */}
            <Label
              htmlFor="env-production"
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
                paymentEnvironment === "production"
                  ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-600 dark:border-emerald-400 dark:ring-emerald-400"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="production" id="env-production" />
                  <span className="font-semibold text-sm">Live Production</span>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  Live Payments
                </Badge>
              </div>
              <p className="font-normal text-muted-foreground text-xs leading-relaxed">
                Connects to the live DOKU payment processor (
                <code className="rounded bg-muted px-1 text-[11px]">isProduction: true</code>). Attendees will make real
                payments via QRIS using any supported e-wallet or mobile banking app.
              </p>
            </Label>
          </RadioGroup>

          {/* ── Merchandise Delivery Pricing & Environment ── */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              <div>
                <h4 className="font-semibold text-xs text-foreground">Merchandise Delivery Pricing & Configuration</h4>
                <p className="text-[11px] text-muted-foreground">
                  Configure the handling and courier delivery fee charged to attendees who claim uncollected merchandise
                  after missing event check-in.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Configurable Delivery Price (IDR) */}
              <Field>
                <FieldLabel htmlFor="merch-delivery-fee" className="font-semibold text-xs">
                  Merchandise Delivery Fee (IDR)
                </FieldLabel>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                    Rp
                  </span>
                  <Input
                    id="merch-delivery-fee"
                    type="number"
                    min={0}
                    step={1000}
                    value={merchandiseDeliveryFee}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setMerchandiseDeliveryFee(Number.isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="pl-9 font-semibold text-xs"
                    placeholder="50000"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="mr-1 text-[10px] text-muted-foreground">Quick presets:</span>
                  {[25000, 35000, 50000, 75000, 100000].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMerchandiseDeliveryFee(preset)}
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        merchandiseDeliveryFee === preset && "border-primary bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      Rp {preset.toLocaleString("id-ID")}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Current fee:{" "}
                  <strong className="text-foreground">Rp {merchandiseDeliveryFee.toLocaleString("id-ID")}</strong>.
                  Applied to each uncollected perk courier delivery invoice.
                </p>
              </Field>

              {/* Delivery Fee Environment */}
              <Field>
                <FieldLabel htmlFor="merch-delivery-env" className="font-semibold text-xs">
                  Delivery Payment Environment
                </FieldLabel>
                <Select
                  value={merchandiseDeliveryEnv}
                  onValueChange={(val: "production" | "sandbox") => void handleMerchandiseDeliveryEnvChange(val)}
                >
                  <SelectTrigger id="merch-delivery-env" className="text-xs">
                    <SelectValue placeholder="Select Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production" className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span>Live Production (Real QRIS Rp {merchandiseDeliveryFee.toLocaleString("id-ID")})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="sandbox" className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-amber-500" />
                        <span>Development / Sandbox (Test Simulator)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Specifies whether attendees who missed on-site check-in are charged via DOKU Production or Sandbox
                  invoices.
                </p>
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. PAYMENT GATEWAY FEE CONFIGURATION (DOKU QRIS) ─────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Percent className="size-4 text-primary" />
              <CardTitle className="text-lg">Payment Gateway Fee Configuration (DOKU QRIS)</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-[10px] font-semibold text-primary"
              >
                Nov 1, 2026 Ready
              </Badge>
              {paymentFeeEnabled ? (
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  Fee Active ({paymentFeeBearer === "attendee" ? "Passed to Attendee" : "Absorbed by Organizer"})
                </Badge>
              ) : (
                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                  Fee Disabled (0 Fee)
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Configure transaction fee rules applied to QRIS checkouts via DOKU. Supports fixed price, percentage rates,
            combined structures, and DOKU&apos;s tiered policy. Specify whether attendees or organizers cover the fee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Policy Notice Box */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <span className="font-semibold text-foreground">
                Official DOKU Fee Adjustment (Effective Nov 1, 2026)
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The DOKU Fee for each QRIS transaction of up to <strong>IDR 100,000</strong> is adjusted to{" "}
                <strong>IDR 500</strong> per transaction. For transactions above IDR 100,000, standard QRIS 0.7% MDR or
                previously agreed merchant pricing terms apply.
              </p>
            </div>
          </div>

          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-payment-fee" className="cursor-pointer font-semibold text-xs text-foreground">
                Enable Payment Gateway Fee
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Apply gateway transaction fees to paid tickets, bundles, and merchandise checkouts.
              </p>
            </div>
            <Switch id="toggle-payment-fee" checked={paymentFeeEnabled} onCheckedChange={setPaymentFeeEnabled} />
          </div>

          {paymentFeeEnabled && (
            <>
              {/* Fee Bearer Selection */}
              <div className="space-y-2">
                <Label className="font-semibold text-xs">Fee Bearer (Who pays the fee?)</Label>
                <RadioGroup
                  value={paymentFeeBearer}
                  onValueChange={(val) => setPaymentFeeBearer(val as PaymentFeeBearer)}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <Label
                    htmlFor="bearer-attendee"
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3.5 transition-colors",
                      paymentFeeBearer === "attendee"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="attendee" id="bearer-attendee" />
                        <span className="font-semibold text-xs">Pass Fee to Attendee (Recommended)</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-blue-500/30 text-[10px] text-blue-600 dark:text-blue-400"
                      >
                        Cost Recovery
                      </Badge>
                    </div>
                    <p className="font-normal text-muted-foreground text-xs leading-relaxed">
                      The gateway fee is added as an itemized line item to the attendee invoice at checkout. Organizers
                      receive 100% of nominal ticket and merchandise revenue.
                    </p>
                  </Label>

                  <Label
                    htmlFor="bearer-organizer"
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3.5 transition-colors",
                      paymentFeeBearer === "organizer"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="organizer" id="bearer-organizer" />
                        <span className="font-semibold text-xs">Absorb Fee by Organizer</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        Zero Added Fee
                      </Badge>
                    </div>
                    <p className="font-normal text-muted-foreground text-xs leading-relaxed">
                      Attendees pay only the nominal price. The transaction fee is absorbed by GDG Jakarta and deducted
                      from organizer settlement payouts.
                    </p>
                  </Label>
                </RadioGroup>
              </div>

              {/* Fee Calculation Strategy */}
              <div className="space-y-3 pt-2">
                <Label className="font-semibold text-xs">Fee Calculation Strategy</Label>
                <RadioGroup
                  value={paymentFeeType}
                  onValueChange={(val) => setPaymentFeeType(val as PaymentFeeType)}
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                >
                  {/* Tiered Option */}
                  <Label
                    htmlFor="fee-type-tiered"
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                      paymentFeeType === "tiered"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="tiered" id="fee-type-tiered" />
                        <span className="font-semibold text-xs">Tiered DOKU QRIS (Official)</span>
                      </div>
                      <Badge variant="outline" className="border-primary/30 text-[9px] text-primary">
                        Recommended
                      </Badge>
                    </div>
                    <p className="font-normal text-muted-foreground text-[11px] leading-relaxed">
                      Fixed price (Rp {paymentFeeTierBelowAmount.toLocaleString("id-ID")}) for amounts ≤ Rp{" "}
                      {paymentFeeThreshold.toLocaleString("id-ID")}, and {paymentFeeTierAbovePercent}% MDR above
                      threshold.
                    </p>
                  </Label>

                  {/* Fixed Fee Option */}
                  <Label
                    htmlFor="fee-type-fixed"
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                      paymentFeeType === "fixed"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="fee-type-fixed" id="fee-type-fixed" />
                        <span className="font-semibold text-xs">Fixed Price Only (Flat Fee)</span>
                      </div>
                      <Badge variant="outline" className="text-[9px]">
                        Flat Rate
                      </Badge>
                    </div>
                    <p className="font-normal text-muted-foreground text-[11px] leading-relaxed">
                      Charges a fixed nominal fee (Rp {paymentFeeFixedAmount.toLocaleString("id-ID")}) per transaction
                      regardless of order total.
                    </p>
                  </Label>

                  {/* Percentage Fee Option */}
                  <Label
                    htmlFor="fee-type-percent"
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                      paymentFeeType === "percent"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="fee-type-percent" id="fee-type-percent" />
                        <span className="font-semibold text-xs">Percentage Rate Only (MDR)</span>
                      </div>
                      <Badge variant="outline" className="text-[9px]">
                        Standard MDR
                      </Badge>
                    </div>
                    <p className="font-normal text-muted-foreground text-[11px] leading-relaxed">
                      Charges a flat percentage ({paymentFeePercentage}%) of the total order subtotal.
                    </p>
                  </Label>

                  {/* Combined Option */}
                  <Label
                    htmlFor="fee-type-combined"
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                      paymentFeeType === "combined"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="fee-type-combined" id="fee-type-combined" />
                        <span className="font-semibold text-xs">Combined (Fixed + Percentage)</span>
                      </div>
                      <Badge variant="outline" className="text-[9px]">
                        Hybrid
                      </Badge>
                    </div>
                    <p className="font-normal text-muted-foreground text-[11px] leading-relaxed">
                      Charges base fixed price (Rp {paymentFeeFixedAmount.toLocaleString("id-ID")}) plus a percentage
                      rate ({paymentFeePercentage}%).
                    </p>
                  </Label>
                </RadioGroup>
              </div>

              {/* Strategy Parameters Inputs */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                {paymentFeeType === "tiered" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor="fee-tier-threshold" className="font-semibold text-xs">
                        Tier 1 Threshold Amount (IDR)
                      </FieldLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                          Rp
                        </span>
                        <Input
                          id="fee-tier-threshold"
                          type="number"
                          min={0}
                          step={10000}
                          value={paymentFeeThreshold}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            setPaymentFeeThreshold(Number.isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="pl-9 font-semibold text-xs"
                          placeholder="100000"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground">Presets:</span>
                        {[50000, 100000, 200000].map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentFeeThreshold(preset)}
                            className={cn(
                              "h-5 px-1.5 text-[10px]",
                              paymentFeeThreshold === preset &&
                                "border-primary bg-primary/10 font-semibold text-primary",
                            )}
                          >
                            Rp {preset.toLocaleString("id-ID")}
                          </Button>
                        ))}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="fee-tier-below" className="font-semibold text-xs">
                        Tier 1 Fee (Fixed for ≤ Threshold)
                      </FieldLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                          Rp
                        </span>
                        <Input
                          id="fee-tier-below"
                          type="number"
                          min={0}
                          step={100}
                          value={paymentFeeTierBelowAmount}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            setPaymentFeeTierBelowAmount(Number.isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="pl-9 font-semibold text-xs"
                          placeholder="500"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground">Presets:</span>
                        {[0, 500, 750, 1000].map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentFeeTierBelowAmount(preset)}
                            className={cn(
                              "h-5 px-1.5 text-[10px]",
                              paymentFeeTierBelowAmount === preset &&
                                "border-primary bg-primary/10 font-semibold text-primary",
                            )}
                          >
                            Rp {preset.toLocaleString("id-ID")}
                          </Button>
                        ))}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="fee-tier-above" className="font-semibold text-xs">
                        Tier 2 Rate (% MDR for &gt; Threshold)
                      </FieldLabel>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                          %
                        </span>
                        <Input
                          id="fee-tier-above"
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={paymentFeeTierAbovePercent}
                          onChange={(e) => {
                            const val = Number.parseFloat(e.target.value);
                            setPaymentFeeTierAbovePercent(Number.isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="pl-9 font-semibold text-xs"
                          placeholder="0.7"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground">Presets:</span>
                        {[0.7, 1.0, 1.5].map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentFeeTierAbovePercent(preset)}
                            className={cn(
                              "h-5 px-1.5 text-[10px]",
                              paymentFeeTierAbovePercent === preset &&
                                "border-primary bg-primary/10 font-semibold text-primary",
                            )}
                          >
                            {preset}%
                          </Button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                {(paymentFeeType === "fixed" || paymentFeeType === "combined") && (
                  <Field>
                    <FieldLabel htmlFor="fee-fixed-amount" className="font-semibold text-xs">
                      Fixed Price Amount (IDR)
                    </FieldLabel>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                        Rp
                      </span>
                      <Input
                        id="fee-fixed-amount"
                        type="number"
                        min={0}
                        step={500}
                        value={paymentFeeFixedAmount}
                        onChange={(e) => {
                          const val = Number.parseInt(e.target.value, 10);
                          setPaymentFeeFixedAmount(Number.isNaN(val) ? 0 : Math.max(0, val));
                        }}
                        className="pl-9 font-semibold text-xs"
                        placeholder="500"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Presets:</span>
                      {[500, 1000, 1500, 2000, 2500].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentFeeFixedAmount(preset)}
                          className={cn(
                            "h-5 px-1.5 text-[10px]",
                            paymentFeeFixedAmount === preset &&
                              "border-primary bg-primary/10 font-semibold text-primary",
                          )}
                        >
                          Rp {preset.toLocaleString("id-ID")}
                        </Button>
                      ))}
                    </div>
                  </Field>
                )}

                {(paymentFeeType === "percent" || paymentFeeType === "combined") && (
                  <Field>
                    <FieldLabel htmlFor="fee-percentage" className="font-semibold text-xs">
                      Percentage Rate (% MDR)
                    </FieldLabel>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                        %
                      </span>
                      <Input
                        id="fee-percentage"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={paymentFeePercentage}
                        onChange={(e) => {
                          const val = Number.parseFloat(e.target.value);
                          setPaymentFeePercentage(Number.isNaN(val) ? 0 : Math.max(0, val));
                        }}
                        className="pl-9 font-semibold text-xs"
                        placeholder="0.7"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Presets:</span>
                      {[0.7, 1.0, 1.5, 2.0].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentFeePercentage(preset)}
                          className={cn(
                            "h-5 px-1.5 text-[10px]",
                            paymentFeePercentage === preset &&
                              "border-primary bg-primary/10 font-semibold text-primary",
                          )}
                        >
                          {preset}%
                        </Button>
                      ))}
                    </div>
                  </Field>
                )}

                {/* Custom Fee Label */}
                <Field className="border-t pt-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="fee-display-label" className="font-semibold text-xs">
                      Invoice Line Item Display Label
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPaymentFeeLabel(DEFAULT_PAYMENT_FEE_LABEL)}
                      className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-2.5" />
                      Reset to Default
                    </Button>
                  </div>
                  <Input
                    id="fee-display-label"
                    value={paymentFeeLabel}
                    onChange={(e) => setPaymentFeeLabel(e.target.value)}
                    placeholder={DEFAULT_PAYMENT_FEE_LABEL}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This text is shown on attendee checkout breakdown and DOKU payment link invoices.
                  </p>
                </Field>
              </div>

              {/* Interactive Fee Preview / Simulator Sandbox Widget */}
              <div className="space-y-3 rounded-lg border border-primary/20 bg-muted/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="size-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">Interactive Fee Simulator</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                    Sandbox Tester
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Simulate transaction amounts to preview how fees, attendee invoice totals, and organizer settlements
                  are calculated in real time.
                </p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground">Sample amounts:</span>
                  {[25000, 50000, 100000, 150000, 350000].map((sample) => (
                    <Button
                      key={sample}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewTestAmount(sample)}
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        previewTestAmount === sample && "border-primary bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      Rp {sample.toLocaleString("id-ID")}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-4">
                  <div className="rounded-md border bg-background p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Order Subtotal</span>
                    <span className="font-mono font-semibold text-foreground text-sm">
                      Rp {previewTestAmount.toLocaleString("id-ID")}
                    </span>
                  </div>

                  <div className="rounded-md border bg-background p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Calculated Gateway Fee</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-primary text-sm">
                        Rp {simulatedCalculation.feeAmount.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({simulatedCalculation.effectiveRatePercent}%)
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border bg-background p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Attendee Invoiced Total</span>
                    <span className="font-mono font-bold text-blue-600 text-sm dark:text-blue-400">
                      Rp {simulatedCalculation.totalWithFee.toLocaleString("id-ID")}
                    </span>
                  </div>

                  <div className="rounded-md border bg-background p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Organizer Net Settlement</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm dark:text-emerald-400">
                      Rp{" "}
                      {paymentFeeBearer === "attendee"
                        ? previewTestAmount.toLocaleString("id-ID")
                        : (previewTestAmount - simulatedCalculation.feeAmount).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Applied Rule: <strong className="text-foreground">{simulatedCalculation.feeDescription}</strong>
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 3. EMAIL INVOICE & PAYMENT EXPIRATION ─────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <CardTitle className="text-lg">Email Invoice & Payment Expiration</CardTitle>
            </div>
          </div>
          <CardDescription>
            Configure the email banner and invoice expiration window applied to all generated DOKU payment links
            (registration passes, tickets, merchandise, and delivery fees).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* headerEmailUrl Field */}
            <Field className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="header-email-url" className="font-semibold text-xs">
                  Header Email Image URL (Banner)
                </FieldLabel>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setHeaderEmailUrl(DEFAULT_PAYMENT_HEADER_EMAIL_URL)}
                    className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-2.5" />
                    Reset to Default Banner
                  </Button>
                  {(event.picture_url ?? event.banner_url) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setHeaderEmailUrl(event.picture_url ?? event.banner_url ?? "")}
                      className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-2.5" />
                      Event Banner
                    </Button>
                  )}
                </div>
              </div>
              <Input
                id="header-email-url"
                type="url"
                value={headerEmailUrl}
                onChange={(e) => setHeaderEmailUrl(e.target.value)}
                placeholder={DEFAULT_PAYMENT_HEADER_EMAIL_URL}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Embedded at the top of invoice emails sent by DOKU / n8n. If empty, falls back to the default GDG
                Jakarta banner.
              </p>

              {headerEmailUrl ? (
                <div className="mt-2 overflow-hidden rounded-md border bg-muted/20 p-2">
                  <span className="text-[10px] font-medium text-muted-foreground">Banner Preview:</span>
                  <div className="relative mt-1 h-24 w-full overflow-hidden rounded bg-background">
                    <Image src={headerEmailUrl} alt="Email Header Preview" fill unoptimized className="object-cover" />
                  </div>
                </div>
              ) : null}
            </Field>

            {/* paymentDeadlinesInMinutes Field */}
            <Field className="space-y-2">
              <FieldLabel htmlFor="payment-deadline" className="font-semibold text-xs">
                Payment Deadline / Expiration (Minutes)
              </FieldLabel>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                  <Clock className="size-3.5" />
                </span>
                <Input
                  id="payment-deadline"
                  type="number"
                  min={5}
                  step={15}
                  value={paymentDeadlinesInMinutes}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setPaymentDeadlinesInMinutes(Number.isNaN(val) ? 60 : Math.max(5, val));
                  }}
                  className="pl-9 font-semibold text-xs"
                  placeholder="1440"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="mr-1 text-[10px] text-muted-foreground">Presets:</span>
                {[
                  { label: "1h", value: 60 },
                  { label: "2h", value: 120 },
                  { label: "6h", value: 360 },
                  { label: "12h", value: 720 },
                  { label: "24h (1d)", value: 1440 },
                  { label: "48h (2d)", value: 2880 },
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentDeadlinesInMinutes(preset.value)}
                    className={cn(
                      "h-6 px-2 text-[10px]",
                      paymentDeadlinesInMinutes === preset.value &&
                        "border-primary bg-primary/10 font-semibold text-primary",
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Current deadline:{" "}
                <strong className="text-foreground">
                  {(() => {
                    if (paymentDeadlinesInMinutes >= 1440) {
                      return `${(paymentDeadlinesInMinutes / 1440).toFixed(1).replace(/\.0$/, "")} day(s) (${paymentDeadlinesInMinutes} mins)`;
                    }
                    if (paymentDeadlinesInMinutes >= 60) {
                      return `${(paymentDeadlinesInMinutes / 60).toFixed(1).replace(/\.0$/, "")} hour(s) (${paymentDeadlinesInMinutes} mins)`;
                    }
                    return `${paymentDeadlinesInMinutes} minutes`;
                  })()}
                </strong>
                . Attendees must scan QRIS and pay before this duration elapses.
              </p>
            </Field>
          </div>

          {/* ── Payment Request Email Template Configuration ── */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <div>
                <h4 className="font-semibold text-xs text-foreground">Payment Request Email Template</h4>
                <p className="text-[11px] text-muted-foreground">
                  Configure which automated email template n8n uses when generating a DOKU payment link (passes key{" "}
                  <code className="rounded bg-muted px-1 text-[11px]">payment.emailTemplate</code> to the checkout
                  webhook).
                </p>
              </div>
            </div>

            <RadioGroup
              value={emailTemplate}
              onValueChange={(val) => setEmailTemplate(val)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {/* Ticketing Template Option */}
              <Label
                htmlFor="template-ticketing"
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
                  emailTemplate === "Ticketing"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Ticketing" id="template-ticketing" />
                    <span className="font-semibold text-xs">Ticketing (Standard Order Email)</span>
                  </div>
                  <Badge variant="outline" className="border-blue-500/30 text-[10px] text-blue-600 dark:text-blue-400">
                    Standard Orders
                  </Badge>
                </div>
                <p className="font-normal text-muted-foreground text-xs leading-relaxed">
                  Sends an itemized order summary email with ticket details and merchandise items (
                  <code className="rounded bg-muted px-1 text-[11px]">Payment Required: [Event Name]</code>). Instructs
                  attendees that their official ticket with a unique entry QR code will arrive within 24 hours after
                  payment.
                </p>
                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">n8n Routing:</span>
                  <span>
                    Routes to <strong>Send Payment Ticket Email</strong> node
                  </span>
                </div>
              </Label>

              {/* Commitment Fee Template Option */}
              <Label
                htmlFor="template-commitment-fee"
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
                  emailTemplate === "Commitment Fee"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Commitment Fee" id="template-commitment-fee" />
                    <span className="font-semibold text-xs">Commitment Fee (RSVP Reservation Email)</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    Curated Admission
                  </Badge>
                </div>
                <p className="font-normal text-muted-foreground text-xs leading-relaxed">
                  Sends an acceptance notice with commitment deposit payment instructions (
                  <code className="rounded bg-muted px-1 text-[11px]">
                    Action Required: Pay Commitment Fee for [Event Name]
                  </code>
                  ). Highlights limited seat allocation and non-refundable attendance policy to guarantee high show-up
                  rates.
                </p>
                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">n8n Routing:</span>
                  <span>
                    Routes to <strong>Send Payment Commitment Fee Email</strong> node
                  </span>
                </div>
              </Label>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. PAYMENT METHODS & TESTING OVERVIEW ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle className="text-base">Payment Method & QRIS Standard</CardTitle>
            </div>
            <CardDescription className="text-xs">Supported payment channels and attendee checkout flow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-2 font-medium text-[11px] text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Universal QRIS Standard
              </div>
              <p className="text-[11px]">
                <strong>QRIS</strong> (GoPay, OVO, Dana, ShopeePay, LinkAja, and all Mobile Banking apps) via DOKU
                Checkout Hosted Page. Attendees scan the generated QR code with any QRIS-compatible e-wallet or banking
                app to complete payment.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Active Merchandise Delivery Fee:</span>
                <strong className="text-foreground">Rp {merchandiseDeliveryFee.toLocaleString("id-ID")}</strong>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Billed when an approved attendee requests delivery for uncollected swag perks.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" />
              <CardTitle className="text-base">Sandbox Testing & Simulation</CardTitle>
            </div>
            <CardDescription className="text-xs">
              How to test payments without real Indonesian Rupiah charges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground text-xs leading-relaxed">
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium text-[11px] text-foreground">
                <Info className="size-3.5 text-blue-500" />
                Testing with DOKU QRIS Simulator
              </div>
              <p className="text-[11px]">
                When using <strong>Development / Sandbox</strong> mode, payment links generated for registration,
                tickets, and merchandise will redirect to DOKU Sandbox invoices.
              </p>
              <p className="text-[11px]">
                You can scan the generated QR code or copy the invoice number using the DOKU Sandbox Simulator to
                trigger instant mock payment success events.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <Button size="sm" variant="outline" asChild className="h-7 gap-1.5 text-xs">
                  <a href="https://sandbox.doku.com/qris-simulator/customer" target="_blank" rel="noopener noreferrer">
                    <QrCode className="size-3 text-primary" />
                    Open DOKU QRIS Simulator
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild className="h-7 gap-1.5 text-xs">
                  <a href="https://sandbox.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    DOKU Sandbox Dashboard
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                </Button>
              </div>
            </div>

            {paymentEnvironment === "production" ? (
              <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-700 dark:text-emerald-400 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    Currently in <strong>Live Production</strong>. Real bank charges and transactions will be issued.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-7 shrink-0 gap-1.5 border-emerald-500/30 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <a href="https://dashboard.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    DOKU Production Dashboard
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    Currently in <strong>Sandbox Mode</strong>. Test transactions only. Attendees cannot pay real money.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-7 shrink-0 gap-1.5 border-amber-500/30 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <a href="https://sandbox.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
                    DOKU Sandbox Dashboard
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Unsaved Changes Dialog ────────────────────────────────────── */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <DialogTitle>Unsaved Payment Settings</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs">
              You have unsaved changes to the payment gateway configuration. If you navigate away now, your changes will
              be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowUnsavedDialog(false);
                pendingNavigationRef.current = null;
              }}
            >
              Keep Editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowUnsavedDialog(false);
                handleDiscard();
                if (pendingNavigationRef.current) {
                  const nav = pendingNavigationRef.current;
                  pendingNavigationRef.current = null;
                  setTimeout(() => nav(), 50);
                }
              }}
            >
              Discard & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Floating Save Bar ─────────────────────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        discardLabel="Discard"
        saveLabel="Save Payment Settings"
        savingLabel="Saving Settings..."
        savedLabel="Settings Saved"
        statusInfo={`Env: ${paymentEnvironment === "production" ? "Production" : "Sandbox"} | Fee: ${paymentFeeEnabled ? `${paymentFeeType} (${paymentFeeBearer})` : "Off"} | Template: ${emailTemplate} | Deadline: ${paymentDeadlinesInMinutes}m`}
        helperText="Payment environment, gateway fee rules, email template, banner, deadline, and delivery fees take effect immediately for new payment links."
      />
    </div>
  );
}
