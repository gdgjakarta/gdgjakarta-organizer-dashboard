"use client";

import { useMemo, useState } from "react";

import { format } from "date-fns";
import {
  CalendarClock,
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
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
import { buildCancelPaymentPayload, buildRegistrationPaymentPayload } from "@/lib/events/doku-payment";
import { getRegistrationPaymentDeadline, shouldCancelPaymentOrder } from "@/lib/events/payment-deadline";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import { updateRegistrationStatusAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cancelPaymentLinkAction, generatePaymentLinkAction } from "@/server/payment-actions";

interface ResendPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration | null;
  /** When non-empty, the dialog runs in bulk mode and `registration` is ignored. */
  registrations?: FirestoreRegistration[];
  event?: FirestoreEvent;
  onSuccess?: (updatedReg: FirestoreRegistration) => void;
  onBatchSuccess?: (updatedRegs: FirestoreRegistration[]) => void;
}

interface BatchResultRow {
  id: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
  paymentUrl?: string;
  invoiceNumber?: string;
}

/** Computes subtotal, gateway fee and total payable amount for a registration. */
function computeRegistrationPaymentBreakdown(reg: FirestoreRegistration, event?: FirestoreEvent) {
  let netSubtotal: number;
  if (reg.payment_subtotal_amount !== undefined && reg.payment_subtotal_amount > 0) {
    netSubtotal = reg.payment_subtotal_amount;
  } else {
    const merchTotal = (reg.selected_merchandise ?? []).reduce((acc, m) => acc + (m.price ?? 0) * (m.quantity ?? 1), 0);
    const discount = (reg.voucher_discount_amount ?? 0) + (reg.referral_discount_amount ?? 0);
    netSubtotal = Math.max(0, (reg.ticket_price ?? 0) + merchTotal + (reg.bundle_price ?? 0) - discount);
  }
  const gatewayFeeCalc = event ? calculatePaymentGatewayFee(netSubtotal, event) : null;
  const computedTotal = netSubtotal + (gatewayFeeCalc?.isPassedToAttendee ? gatewayFeeCalc.feeAmount : 0);
  const payableAmount = computedTotal > 0 ? computedTotal : (reg.payment_amount ?? 0);
  return { netSubtotal, gatewayFeeCalc, payableAmount };
}

const PRESET_DEADLINES = [
  { label: "1 Hour", minutes: 60 },
  { label: "3 Hours", minutes: 180 },
  { label: "12 Hours", minutes: 720 },
  { label: "24 Hours (1 Day)", minutes: 1440 },
  { label: "2 Days", minutes: 2880 },
  { label: "3 Days", minutes: 4320 },
];

export function ResendPaymentLinkDialog({
  open,
  onOpenChange,
  registration,
  registrations,
  event,
  onSuccess,
  onBatchSuccess,
}: ResendPaymentLinkDialogProps) {
  const isBulk = Boolean(registrations && registrations.length > 0);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResultRow[] | null>(null);
  const bulkTotalAmount = useMemo(
    () =>
      (registrations ?? []).reduce((acc, r) => acc + computeRegistrationPaymentBreakdown(r, event).payableAmount, 0),
    [registrations, event],
  );

  const [selectedMinutes, setSelectedMinutes] = useState<number>(1440);
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Success result state
  const [generatedResult, setGeneratedResult] = useState<{
    paymentUrl: string;
    invoiceNumber: string;
    amount?: number;
    expiredDatetime?: string;
  } | null>(null);

  // Resolved deadline minutes
  const activeMinutes = useMemo(() => {
    if (isCustom) {
      const parsed = Number.parseInt(customMinutes, 10);
      return Number.isNaN(parsed) || parsed <= 0 ? 1440 : parsed;
    }
    return selectedMinutes;
  }, [isCustom, customMinutes, selectedMinutes]);

  // Projected new expiration date
  const newExpirationDate = useMemo(() => {
    return new Date(Date.now() + activeMinutes * 60 * 1000);
  }, [activeMinutes]);

  // Existing deadline info
  const existingDeadlineInfo = useMemo(() => {
    if (!registration) return null;
    return getRegistrationPaymentDeadline(registration, event);
  }, [registration, event]);

  // Net subtotal before payment gateway fee
  const netSubtotal = useMemo(() => {
    if (!registration) return 0;
    if (registration.payment_subtotal_amount !== undefined && registration.payment_subtotal_amount > 0) {
      return registration.payment_subtotal_amount;
    }
    const ticketPrice = registration.ticket_price ?? 0;
    const merchTotal = (registration.selected_merchandise ?? []).reduce(
      (acc, m) => acc + (m.price ?? 0) * (m.quantity ?? 1),
      0,
    );
    const bundlePrice = registration.bundle_price ?? 0;
    const discount = (registration.voucher_discount_amount ?? 0) + (registration.referral_discount_amount ?? 0);
    return Math.max(0, ticketPrice + merchTotal + bundlePrice - discount);
  }, [registration]);

  // Payment gateway fee calculation
  const gatewayFeeCalc = useMemo(() => {
    if (!event) return null;
    return calculatePaymentGatewayFee(netSubtotal, event);
  }, [netSubtotal, event]);

  // Total payable amount
  const payableAmount = useMemo(() => {
    if (!registration) return 0;
    const feeAddon = gatewayFeeCalc?.isPassedToAttendee ? gatewayFeeCalc.feeAmount : 0;
    const computedTotal = netSubtotal + feeAddon;
    if (computedTotal > 0) return computedTotal;
    return registration.payment_amount ?? 0;
  }, [registration, netSubtotal, gatewayFeeCalc]);

  const defaultTemplate = useMemo(() => {
    return (
      event?.payment_email_template ??
      event?.paymentEmailTemplate ??
      (registration?.ticket_type === "commitment_fee" ? "Commitment Fee" : "Ticketing")
    );
  }, [event, registration]);

  const [emailTemplate, setEmailTemplate] = useState<string>(defaultTemplate);

  const handleClose = () => {
    if (batchProgress) return;
    setGeneratedResult(null);
    setBatchResults(null);
    setHasCopied(false);
    setIsCustom(false);
    setSelectedMinutes(1440);
    setEmailTemplate(defaultTemplate);
    onOpenChange(false);
  };

  const handleBatchGenerate = async () => {
    if (!registrations || registrations.length === 0 || !event) return;

    const rows: BatchResultRow[] = [];
    const updatedRegs: FirestoreRegistration[] = [];
    setIsSubmitting(true);
    setBatchProgress({ current: 0, total: registrations.length });

    for (const [index, reg] of registrations.entries()) {
      setBatchProgress({ current: index + 1, total: registrations.length });
      const base = { id: reg.id, name: reg.member_name, email: reg.member_email };
      try {
        const { netSubtotal, gatewayFeeCalc, payableAmount: amount } = computeRegistrationPaymentBreakdown(reg, event);
        if (amount <= 0) {
          rows.push({ ...base, success: false, error: "Total payable amount is Rp 0 or free." });
          continue;
        }

        if (shouldCancelPaymentOrder(reg, event)) {
          try {
            const cancelRes = await cancelPaymentLinkAction(
              buildCancelPaymentPayload(reg, event, "Regenerating payment link with new deadline"),
            );
            if (!cancelRes.success) {
              console.warn("[ResendPaymentLinkDialog] DOKU order cancellation warning:", cancelRes.error);
            }
          } catch (cancelErr) {
            console.warn("[ResendPaymentLinkDialog] Failed to cancel previous active order:", cancelErr);
          }
        }

        const res = await generatePaymentLinkAction(
          buildRegistrationPaymentPayload(reg, event, {
            sendEmail,
            paymentDeadlineMinutes: activeMinutes,
            emailTemplate,
          }),
        );
        if (!res.success || !res.paymentUrl) {
          rows.push({ ...base, success: false, error: res.error ?? "Failed to generate payment link." });
          continue;
        }

        const invoiceNum = res.invoiceNumber ?? `INV-${Date.now()}`;
        const newExpiredDatetime =
          res.expiredDatetime ?? new Date(Date.now() + activeMinutes * 60 * 1000).toISOString();
        const paymentFields: Partial<FirestoreRegistration> = {
          payment_status: "unpaid",
          payment_url: res.paymentUrl,
          payment_invoice_number: invoiceNum,
          payment_request_id: res.requestId,
          payment_amount: res.amount ?? amount,
          payment_subtotal_amount: netSubtotal,
          payment_fee_amount: gatewayFeeCalc?.feeAmount ?? 0,
          payment_fee_bearer: gatewayFeeCalc?.feeBearer ?? "attendee",
          payment_expired_datetime: newExpiredDatetime,
        };

        await updateRegistrationStatusAction(
          reg.id,
          event.id,
          "waiting_for_payment",
          undefined,
          `Payment link regenerated in bulk with new deadline (${activeMinutes}m). Expiration: ${format(
            new Date(newExpiredDatetime),
            "dd MMM yyyy, HH:mm",
          )}`,
          paymentFields,
        );

        updatedRegs.push({
          ...reg,
          ...paymentFields,
          status: "waiting_for_payment",
          reviewed_at: new Date().toISOString(),
        });
        rows.push({ ...base, success: true, paymentUrl: res.paymentUrl, invoiceNumber: invoiceNum });
      } catch (err) {
        console.error("[ResendPaymentLinkDialog] Bulk item error:", err);
        rows.push({ ...base, success: false, error: "Unexpected error." });
      }
    }

    setBatchProgress(null);
    setIsSubmitting(false);
    setBatchResults(rows);
    if (updatedRegs.length > 0) onBatchSuccess?.(updatedRegs);
    const failed = rows.length - updatedRegs.length;
    if (failed === 0) {
      toast.success(`Regenerated ${updatedRegs.length} payment link(s).`);
    } else {
      toast.warning(`Regenerated ${updatedRegs.length} payment link(s); ${failed} failed.`);
    }
  };

  const handleCopyLink = () => {
    if (!generatedResult?.paymentUrl) return;
    void navigator.clipboard.writeText(generatedResult.paymentUrl);
    setHasCopied(true);
    toast.success("Payment link copied to clipboard!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleGenerateAndResend = async () => {
    if (!registration || !event) return;

    if (payableAmount <= 0) {
      toast.error("Cannot generate payment link: Total payable amount is Rp 0 or free.");
      return;
    }

    setIsSubmitting(true);
    try {
      // If previous payment order exists and is not expired yet, cancel it via DOKU
      if (shouldCancelPaymentOrder(registration, event)) {
        try {
          const cancelPayload = buildCancelPaymentPayload(
            registration,
            event,
            "Regenerating payment link with new deadline",
          );
          const cancelRes = await cancelPaymentLinkAction(cancelPayload);
          if (cancelRes.success) {
            console.log(
              `[ResendPaymentLinkDialog] Successfully cancelled previous active order: ${cancelRes.invoiceNumber}`,
            );
          } else {
            console.warn("[ResendPaymentLinkDialog] DOKU order cancellation warning:", cancelRes.error);
          }
        } catch (cancelErr) {
          console.warn("[ResendPaymentLinkDialog] Failed to cancel previous active order:", cancelErr);
        }
      }

      const paymentPayload = buildRegistrationPaymentPayload(registration, event, {
        sendEmail,
        paymentDeadlineMinutes: activeMinutes,
        emailTemplate,
      });

      const res = await generatePaymentLinkAction(paymentPayload);

      if (!res.success || !res.paymentUrl) {
        toast.error(res.error ?? "Failed to generate payment link via DOKU / Mayar.");
        setIsSubmitting(false);
        return;
      }

      const invoiceNum = res.invoiceNumber ?? `INV-${Date.now()}`;
      const newExpiredDatetime = res.expiredDatetime ?? newExpirationDate.toISOString();
      const now = new Date().toISOString();

      const paymentFields: Partial<FirestoreRegistration> = {
        payment_status: "unpaid",
        payment_url: res.paymentUrl,
        payment_invoice_number: invoiceNum,
        payment_request_id: res.requestId,
        payment_amount: res.amount ?? payableAmount,
        payment_subtotal_amount: netSubtotal,
        payment_fee_amount: gatewayFeeCalc?.feeAmount ?? 0,
        payment_fee_bearer: gatewayFeeCalc?.feeBearer ?? "attendee",
        payment_expired_datetime: newExpiredDatetime,
      };

      const notes = `Payment link regenerated with new deadline (${activeMinutes}m). Expiration: ${format(
        new Date(newExpiredDatetime),
        "dd MMM yyyy, HH:mm",
      )}`;

      await updateRegistrationStatusAction(
        registration.id,
        event.id,
        "waiting_for_payment",
        undefined,
        notes,
        paymentFields,
      );

      const updatedReg: FirestoreRegistration = {
        ...registration,
        status: "waiting_for_payment",
        payment_status: "unpaid",
        payment_url: res.paymentUrl,
        payment_invoice_number: invoiceNum,
        payment_request_id: res.requestId,
        payment_amount: res.amount ?? payableAmount,
        payment_subtotal_amount: netSubtotal,
        payment_fee_amount: gatewayFeeCalc?.feeAmount ?? 0,
        payment_fee_bearer: gatewayFeeCalc?.feeBearer ?? "attendee",
        payment_expired_datetime: newExpiredDatetime,
        reviewed_at: now,
      };

      setGeneratedResult({
        paymentUrl: res.paymentUrl,
        invoiceNumber: invoiceNum,
        amount: res.amount ?? payableAmount,
        expiredDatetime: newExpiredDatetime,
      });

      onSuccess?.(updatedReg);
      toast.success(
        sendEmail
          ? `Payment link regenerated and emailed to ${registration.member_email}!`
          : "Payment link regenerated successfully!",
      );
    } catch (err) {
      console.error("[ResendPaymentLinkDialog] Error:", err);
      toast.error("An unexpected error occurred while regenerating the payment link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!registration && !isBulk) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">
                {isBulk ? `Regenerate Payment Links (${registrations?.length})` : "Regenerate Payment Link"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Regenerate checkout payment link with a renewed expiration deadline.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {batchResults ? (
          <div className="space-y-3 py-2">
            <div className="rounded-xl border bg-muted/30 p-3 text-xs">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {batchResults.filter((r) => r.success).length} succeeded
              </span>
              {" · "}
              <span className="font-semibold text-rose-600">
                {batchResults.filter((r) => !r.success).length} failed
              </span>
            </div>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {batchResults.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className={r.success ? "truncate text-muted-foreground" : "truncate text-rose-600"}>
                      {r.success ? r.invoiceNumber : r.error}
                    </p>
                  </div>
                  {r.success && r.paymentUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(r.paymentUrl ?? "");
                        toast.success("Payment link copied to clipboard!");
                      }}
                    >
                      <Copy className="size-3" />
                      Copy
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : generatedResult ? (
          /* Success Result View */
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 text-sm dark:text-emerald-300">
                <Check className="size-4" />
                <span>Payment Link Created & Status Updated to "Waiting for Payment"</span>
              </div>
              <p className="mt-1 text-emerald-700 text-xs dark:text-emerald-400">
                {sendEmail
                  ? `An email with invoice #${generatedResult.invoiceNumber} has been dispatched to ${registration?.member_email}.`
                  : "The checkout link is active and ready to be shared with the attendee."}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Checkout URL</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={generatedResult.paymentUrl} className="h-9 font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 text-xs"
                  onClick={handleCopyLink}
                >
                  {hasCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {hasCopied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" size="sm" className="h-9 shrink-0 gap-1.5 text-xs" asChild>
                  <a href={generatedResult.paymentUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    Open
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>New Expiration Deadline:</span>
                <span className="font-semibold text-foreground">
                  {generatedResult.expiredDatetime
                    ? format(new Date(generatedResult.expiredDatetime), "dd MMM yyyy, HH:mm")
                    : format(newExpirationDate, "dd MMM yyyy, HH:mm")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Form Configuration View */
          <div className="space-y-4 py-1">
            {/* Attendee & Order Summary Card */}
            {isBulk ? (
              <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <h4 className="font-semibold text-sm text-foreground">
                      {registrations?.length} attendees selected
                    </h4>
                    {registrations?.filter((r) => r.status === "expired").length ?? 0} expired ·{" "}
                    {registrations?.filter((r) => r.status !== "expired").length ?? 0} waiting for payment
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 text-[11px] dark:text-amber-400"
                  >
                    Rp {bulkTotalAmount.toLocaleString("id-ID")}
                  </Badge>
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto border-t pt-2">
                  {registrations?.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        {r.member_name} <span className="text-muted-foreground">({r.member_email})</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        Rp {computeRegistrationPaymentBreakdown(r, event).payableAmount.toLocaleString("id-ID")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              registration && (
                <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{registration.member_name}</h4>
                      <p className="text-xs text-muted-foreground">{registration.member_email}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 text-[11px] dark:text-amber-400"
                    >
                      Rp {payableAmount.toLocaleString("id-ID")}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                    {registration.ticket_name && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Ticket: {registration.ticket_name}
                      </Badge>
                    )}
                    {registration.selected_merchandise && registration.selected_merchandise.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {registration.selected_merchandise.length} Merch Item(s)
                      </Badge>
                    )}
                    {gatewayFeeCalc && gatewayFeeCalc.isEnabled && gatewayFeeCalc.feeAmount > 0 && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {gatewayFeeCalc.feeLabel}:{" "}
                        {gatewayFeeCalc.isPassedToAttendee
                          ? `+Rp ${gatewayFeeCalc.feeAmount.toLocaleString("id-ID")}`
                          : "Absorbed"}
                      </Badge>
                    )}
                    {existingDeadlineInfo?.formattedDeadline && (
                      <span className="text-[11px] text-muted-foreground">
                        Previous Deadline:{" "}
                        <strong className="text-foreground">{existingDeadlineInfo.formattedDeadline}</strong>
                        {existingDeadlineInfo.isOverdue && (
                          <span className="ml-1 text-rose-500 font-medium">
                            ({existingDeadlineInfo.timeStatusText})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )
            )}

            {!isBulk && payableAmount <= 0 && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                This registration has a net total of Rp 0 (free) and does not require a payment link.
              </div>
            )}

            {/* Expiration Deadline Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-primary" />
                  Select New Payment Deadline
                </Label>
                <span className="text-[11px] text-muted-foreground">Duration from now</span>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DEADLINES.map((preset) => {
                  const isSelected = !isCustom && selectedMinutes === preset.minutes;
                  return (
                    <Button
                      key={preset.minutes}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-normal"
                      onClick={() => {
                        setIsCustom(false);
                        setSelectedMinutes(preset.minutes);
                      }}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>

              {/* Custom Minutes Input */}
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={isCustom ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => {
                      setIsCustom(true);
                      if (!customMinutes) setCustomMinutes("1440");
                    }}
                  >
                    Custom Minutes:
                  </Button>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    placeholder="e.g. 1440"
                    value={customMinutes}
                    onChange={(e) => {
                      setIsCustom(true);
                      setCustomMinutes(e.target.value);
                    }}
                    className="h-8 text-xs"
                    disabled={!isCustom}
                  />
                </div>
              </div>

              {/* Live Preview Banner */}
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <Clock className="size-3.5" />
                  <span>New Expiration:</span>
                </div>
                <span className="font-semibold text-foreground">
                  {format(newExpirationDate, "dd MMM yyyy, HH:mm")}
                  <span className="ml-1 text-[11px] text-muted-foreground font-normal">
                    ({activeMinutes >= 60 ? `${Math.round(activeMinutes / 60)}h` : `${activeMinutes}m`} from now)
                  </span>
                </span>
              </div>
            </div>

            {/* Email Dispatch Switch */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="send-email-switch"
                    className="text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="size-3.5 text-muted-foreground" />
                    Send Payment Link Email
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Dispatches checkout instructions and invoice directly to attendee's email.
                  </p>
                </div>
                <Switch id="send-email-switch" checked={sendEmail} onCheckedChange={setSendEmail} />
              </div>

              {sendEmail && (
                <div className="border-t pt-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">Email Template:</Label>
                    <Select value={emailTemplate} onValueChange={setEmailTemplate}>
                      <SelectTrigger className="h-7 w-48 text-xs">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ticketing" className="text-xs">
                          Ticketing
                        </SelectItem>
                        <SelectItem value="Commitment Fee" className="text-xs">
                          Commitment Fee
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {emailTemplate === "Commitment Fee"
                      ? "Routes to n8n 'Send Payment Commitment Fee Email' node."
                      : "Routes to n8n 'Send Payment Ticket Email' node."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {generatedResult || batchResults ? (
            <Button type="button" size="sm" onClick={handleClose}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground shadow-xs"
                onClick={isBulk ? handleBatchGenerate : handleGenerateAndResend}
                disabled={isSubmitting || activeMinutes <= 0 || (!isBulk && payableAmount <= 0)}
              >
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                {batchProgress
                  ? `Generating (${batchProgress.current}/${batchProgress.total})...`
                  : isSubmitting
                    ? "Generating Link..."
                    : isBulk
                      ? `Regenerate ${registrations?.length} Links`
                      : "Regenerate Payment Link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const RegeneratePaymentLinkDialog = ResendPaymentLinkDialog;
