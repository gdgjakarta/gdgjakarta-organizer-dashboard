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
import { Switch } from "@/components/ui/switch";
import { buildRegistrationPaymentPayload } from "@/lib/events/doku-payment";
import { getRegistrationPaymentDeadline } from "@/lib/events/payment-deadline";
import { updateRegistrationStatusAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { generatePaymentLinkAction } from "@/server/payment-actions";

interface ResendPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration | null;
  event?: FirestoreEvent;
  onSuccess?: (updatedReg: FirestoreRegistration) => void;
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
  event,
  onSuccess,
}: ResendPaymentLinkDialogProps) {
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

  // Total payable amount
  const payableAmount = useMemo(() => {
    if (!registration) return 0;
    if (registration.payment_amount && registration.payment_amount > 0) {
      return registration.payment_amount;
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

  const handleClose = () => {
    setGeneratedResult(null);
    setHasCopied(false);
    setIsCustom(false);
    setSelectedMinutes(1440);
    onOpenChange(false);
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

    setIsSubmitting(true);
    try {
      const paymentPayload = buildRegistrationPaymentPayload(registration, event, {
        sendEmail,
        paymentDeadlineMinutes: activeMinutes,
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
        payment_amount: res.amount ?? payableAmount,
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
        payment_amount: res.amount ?? payableAmount,
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

  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">Resend Payment Link</DialogTitle>
              <DialogDescription className="text-xs">
                Regenerate checkout payment link with a renewed expiration deadline.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {generatedResult ? (
          /* Success Result View */
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 text-sm dark:text-emerald-300">
                <Check className="size-4" />
                <span>Payment Link Created & Status Updated to "Waiting for Payment"</span>
              </div>
              <p className="mt-1 text-emerald-700 text-xs dark:text-emerald-400">
                {sendEmail
                  ? `An email with invoice #${generatedResult.invoiceNumber} has been dispatched to ${registration.member_email}.`
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
                {existingDeadlineInfo?.formattedDeadline && (
                  <span className="text-[11px] text-muted-foreground">
                    Previous Deadline:{" "}
                    <strong className="text-foreground">{existingDeadlineInfo.formattedDeadline}</strong>
                    {existingDeadlineInfo.isOverdue && (
                      <span className="ml-1 text-rose-500 font-medium">({existingDeadlineInfo.timeStatusText})</span>
                    )}
                  </span>
                )}
              </div>
            </div>

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
            <div className="flex items-center justify-between rounded-lg border p-3">
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
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {generatedResult ? (
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
                onClick={handleGenerateAndResend}
                disabled={isSubmitting || activeMinutes <= 0}
              >
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                {isSubmitting ? "Generating Link..." : "Generate & Resend Link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
