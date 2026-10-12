"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, Check, CheckCircle2, Copy, Info, QrCode, ShieldCheck, Truck, Workflow } from "lucide-react";
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
import { updateEventPaymentConfigAction } from "@/lib/firestore/actions";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface PaymentGatewayTabProps {
  event: FirestoreEvent;
}

const DEFAULT_WEBHOOK_URL = "https://n8n.gdgjakarta.com/webhook/api/generate-payment-link";

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
  const [paymentWebhookUrl, setPaymentWebhookUrl] = useState<string>(event.payment_webhook_url ?? "");

  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      paymentEnvironment,
      merchandiseDeliveryEnv,
      paymentWebhookUrl: paymentWebhookUrl.trim(),
    });
  }, [paymentEnvironment, merchandiseDeliveryEnv, paymentWebhookUrl]);

  const isDirty =
    isInitialLoaded && initialSnapshotRef.current !== null && initialSnapshotRef.current !== currentSnapshot;

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  // Load latest values from Firestore on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));

        const loadedEnv = (docData?.payment_environment ??
          event.payment_environment ??
          (event.is_test ? "sandbox" : "production")) as "production" | "sandbox";
        const loadedDeliveryEnv = (docData?.merchandise_delivery_payment_environment ??
          event.merchandise_delivery_payment_environment ??
          loadedEnv) as "production" | "sandbox";
        const loadedWebhook = (docData?.payment_webhook_url ?? event.payment_webhook_url ?? "").trim();

        setPaymentEnvironment(loadedEnv);
        setMerchandiseDeliveryEnv(loadedDeliveryEnv);
        setPaymentWebhookUrl(loadedWebhook);

        initialSnapshotRef.current = JSON.stringify({
          paymentEnvironment: loadedEnv,
          merchandiseDeliveryEnv: loadedDeliveryEnv,
          paymentWebhookUrl: loadedWebhook,
        });
      } catch (err) {
        console.warn("[PaymentGatewayTab] Failed to fetch latest Firestore config:", err);
        const fallbackEnv = event.payment_environment ?? (event.is_test ? "sandbox" : "production");
        const fallbackDeliveryEnv = event.merchandise_delivery_payment_environment ?? fallbackEnv;
        const fallbackWebhook = (event.payment_webhook_url ?? "").trim();
        initialSnapshotRef.current ??= JSON.stringify({
          paymentEnvironment: fallbackEnv,
          merchandiseDeliveryEnv: fallbackDeliveryEnv,
          paymentWebhookUrl: fallbackWebhook,
        });
      } finally {
        setIsInitialLoaded(true);
      }
    }
    void loadConfig();
  }, [event]);

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
        const trimmedWebhook = paymentWebhookUrl.trim();
        const res = await updateEventPaymentConfigAction(
          String(event.id),
          {
            payment_environment: paymentEnvironment,
            merchandise_delivery_payment_environment: merchandiseDeliveryEnv,
            payment_webhook_url: trimmedWebhook ? trimmedWebhook : null,
          },
          event,
        );

        if (res.success) {
          initialSnapshotRef.current = JSON.stringify({
            paymentEnvironment,
            merchandiseDeliveryEnv,
            paymentWebhookUrl: trimmedWebhook,
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
        paymentWebhookUrl: string;
      };
      setPaymentEnvironment(parsed.paymentEnvironment);
      setMerchandiseDeliveryEnv(parsed.merchandiseDeliveryEnv ?? parsed.paymentEnvironment);
      setPaymentWebhookUrl(parsed.paymentWebhookUrl);
      toast.info("Unsaved payment settings discarded.");
    } catch {
      setPaymentEnvironment(event.payment_environment ?? (event.is_test ? "sandbox" : "production"));
      setMerchandiseDeliveryEnv(
        event.merchandise_delivery_payment_environment ??
          event.payment_environment ??
          (event.is_test ? "sandbox" : "production"),
      );
      setPaymentWebhookUrl(event.payment_webhook_url ?? "");
    }
  };

  const handleCopyWebhook = () => {
    const url = paymentWebhookUrl.trim() || DEFAULT_WEBHOOK_URL;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied to clipboard.");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6 pb-24">
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
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                  Unsaved Changes
                </Badge>
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
            onValueChange={(val) => setPaymentEnvironment(val as "production" | "sandbox")}
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

          {/* Merchandise Delivery Request Fee Environment */}
          <div className="border-t pt-3">
            <Field>
              <div className="flex items-center gap-2 pb-1.5">
                <Truck className="size-4 text-primary" />
                <FieldLabel htmlFor="merch-delivery-env" className="font-semibold text-xs">
                  Merchandise Delivery Fee Environment (Uncollected Perks Claim)
                </FieldLabel>
              </div>
              <Select
                value={merchandiseDeliveryEnv}
                onValueChange={(val: "production" | "sandbox") => setMerchandiseDeliveryEnv(val)}
              >
                <SelectTrigger id="merch-delivery-env" className="text-xs">
                  <SelectValue placeholder="Select Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production" className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span>Live Production (Real DOKU QRIS Rp 50.000)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sandbox" className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-500" />
                      <span>Development / Sandbox (Test DOKU QRIS Simulator)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Specifies whether attendees who missed on-site check-in and request delivery for uncollected merchandise
                are charged via DOKU Production or Sandbox.
              </p>
            </Field>
          </div>

          {/* Webhook Endpoint Override (Optional) */}
          <div className="space-y-2 pt-2">
            <Field>
              <FieldLabel htmlFor="payment-webhook-url">Custom Payment Link Webhook URL (Optional Override)</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="payment-webhook-url"
                  placeholder={`Leave empty to use system default (${DEFAULT_WEBHOOK_URL})`}
                  value={paymentWebhookUrl}
                  onChange={(e) => setPaymentWebhookUrl(e.target.value)}
                  className="font-mono text-xs"
                />
                {paymentWebhookUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentWebhookUrl("")}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Override the n8n endpoint for this event if you are routing payments through a custom automation
                workflow or staging webhook (e.g.{" "}
                <code className="rounded bg-muted px-1 text-[10px]">/webhook-test/...</code>).
              </p>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. PIPELINE & INTEGRATION OVERVIEW ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Workflow className="size-4 text-primary" />
              <CardTitle className="text-base">DOKU Checkout & n8n Pipeline</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Automated payment link generation and transaction lifecycle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="font-medium text-foreground">Target Webhook Endpoint</p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                  {paymentWebhookUrl.trim() || DEFAULT_WEBHOOK_URL}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleCopyWebhook} className="h-7 shrink-0 px-2">
                {copiedWebhook ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </Button>
            </div>

            <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-2 font-medium text-[11px] text-foreground">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Supported Payment Method
              </div>
              <p className="text-[11px]">
                <strong>QRIS</strong> (GoPay, OVO, Dana, ShopeePay, LinkAja, and all Mobile Banking apps) via DOKU
                Checkout Hosted Page. Attendees scan the generated QR code with any QRIS-compatible e-wallet or banking
                app to complete payment.
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
            </div>

            {paymentEnvironment === "production" ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  Currently in <strong>Live Production</strong>. Real bank charges and transactions will be issued.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  Currently in <strong>Sandbox Mode</strong>. Test transactions only. Attendees cannot pay real money.
                </span>
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
          <DialogFooter className="gap-2 sm:gap-0">
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
        statusInfo={`Environment: ${paymentEnvironment === "production" ? "Live Production" : "Development / Sandbox"}`}
        helperText="Payment environment and webhook overrides will immediately take effect for new payment links."
      />
    </div>
  );
}
