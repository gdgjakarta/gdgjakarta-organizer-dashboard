"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Info,
  Mail,
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
import { DEFAULT_PAYMENT_HEADER_EMAIL_URL } from "@/lib/events/doku-payment";
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
    });
  }, [
    paymentEnvironment,
    merchandiseDeliveryEnv,
    merchandiseDeliveryFee,
    headerEmailUrl,
    paymentDeadlinesInMinutes,
    emailTemplate,
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

        if (!isDirtyRef.current) {
          setPaymentEnvironment(loadedEnv);
          setMerchandiseDeliveryEnv(loadedDeliveryEnv);
          setMerchandiseDeliveryFee(loadedDeliveryFee);
          setHeaderEmailUrl(loadedHeaderEmail);
          setPaymentDeadlinesInMinutes(loadedPaymentDeadlines);
          setEmailTemplate(loadedEmailTemplate);

          initialSnapshotRef.current = JSON.stringify({
            paymentEnvironment: loadedEnv,
            merchandiseDeliveryEnv: loadedDeliveryEnv,
            merchandiseDeliveryFee: loadedDeliveryFee,
            headerEmailUrl: loadedHeaderEmail,
            paymentDeadlinesInMinutes: loadedPaymentDeadlines,
            emailTemplate: loadedEmailTemplate,
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
        if (!isDirtyRef.current) {
          initialSnapshotRef.current ??= JSON.stringify({
            paymentEnvironment: fallbackEnv,
            merchandiseDeliveryEnv: fallbackDeliveryEnv,
            merchandiseDeliveryFee: fallbackDeliveryFee,
            headerEmailUrl: fallbackHeaderEmail,
            paymentDeadlinesInMinutes: fallbackPaymentDeadlines,
            emailTemplate: fallbackEmailTemplate,
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

      {/* ── 1. EMAIL INVOICE & PAYMENT EXPIRATION ─────────────────────── */}
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
        statusInfo={`Env: ${paymentEnvironment === "production" ? "Production" : "Sandbox"} | Template: ${emailTemplate} | Deadline: ${paymentDeadlinesInMinutes}m | Merch Fee: Rp ${merchandiseDeliveryFee.toLocaleString("id-ID")}`}
        helperText="Payment environment, email template, banner, deadline, and delivery fees take effect immediately for new payment links."
      />
    </div>
  );
}
