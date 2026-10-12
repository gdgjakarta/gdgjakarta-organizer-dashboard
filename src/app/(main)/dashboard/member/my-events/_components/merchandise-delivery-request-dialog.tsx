"use client";

import { useState, useTransition } from "react";

import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Package, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import {
  confirmMerchandiseDeliveryPaymentAction,
  submitMerchandiseDeliveryRequestAction,
} from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, MerchandiseDeliveryRequest } from "@/lib/firestore/types";

interface MerchandiseDeliveryRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
  onSuccess?: (updated: FirestoreRegistration) => void;
}

export function MerchandiseDeliveryRequestDialog({
  isOpen,
  onOpenChange,
  registration,
  event,
  onSuccess,
}: MerchandiseDeliveryRequestDialogProps) {
  const existingDelivery = registration.delivery_request;
  const isPendingPayment = existingDelivery?.status === "pending_payment";

  const rawPhone =
    registration.answers?.whatsapp_number ?? registration.answers?.phone_number ?? registration.answers?.phone;
  const initialPhone = typeof rawPhone === "string" ? rawPhone : "";

  const [recipientName, setRecipientName] = useState(existingDelivery?.recipient_name ?? registration.member_name);
  const [recipientPhone, setRecipientPhone] = useState(existingDelivery?.recipient_phone ?? initialPhone);
  const [shippingAddress, setShippingAddress] = useState(existingDelivery?.shipping_address ?? "");
  const [city, setCity] = useState(existingDelivery?.city ?? "");
  const [postalCode, setPostalCode] = useState(existingDelivery?.postal_code ?? "");
  const [notes, setNotes] = useState(existingDelivery?.notes ?? "");

  const [isSubmitting, startTransition] = useTransition();
  const [isConfirmingPayment, startPaymentTransition] = useTransition();
  const [generatedPaymentUrl, setGeneratedPaymentUrl] = useState<string | null>(existingDelivery?.payment_url ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(existingDelivery?.payment_invoice_number ?? null);
  const [paymentEnvironment, setPaymentEnvironment] = useState<"production" | "sandbox">(
    existingDelivery?.payment_environment ??
      event?.merchandise_delivery_payment_environment ??
      event?.payment_environment ??
      (event?.is_test ? "sandbox" : "production"),
  );
  const [step, setStep] = useState<"form" | "payment">(isPendingPayment ? "payment" : "form");

  const merchandiseItems = registration.selected_merchandise ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientName.trim()) {
      toast.error("Please enter the recipient full name.");
      return;
    }
    if (!recipientPhone.trim()) {
      toast.error("Please enter a valid phone or WhatsApp number.");
      return;
    }
    if (!shippingAddress.trim()) {
      toast.error("Please provide the full delivery address.");
      return;
    }
    if (!city.trim()) {
      toast.error("Please specify your city.");
      return;
    }
    if (!postalCode.trim()) {
      toast.error("Please specify your postal code.");
      return;
    }

    startTransition(async () => {
      const res = await submitMerchandiseDeliveryRequestAction({
        registrationId: registration.id,
        eventId: registration.event_id,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        shippingAddress: shippingAddress.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        notes: notes.trim(),
        customerEmail: registration.member_email,
        eventTitle: registration.event_title,
        eventPictureUrl: registration.event_picture_url ?? event?.picture_url,
      });

      if (res.success && res.deliveryRequest) {
        setGeneratedPaymentUrl(res.paymentUrl ?? null);
        setInvoiceNumber(res.invoiceNumber ?? null);
        setPaymentEnvironment(res.paymentEnvironment);
        setStep("payment");
        toast.success("Delivery request created! Please complete payment to proceed.");

        if (onSuccess) {
          onSuccess({
            ...registration,
            delivery_request: res.deliveryRequest,
          });
        }
      } else {
        toast.error(res.error || "Failed to create delivery request.");
      }
    });
  };

  const handleConfirmPayment = () => {
    startPaymentTransition(async () => {
      const res = await confirmMerchandiseDeliveryPaymentAction(registration.id, registration.event_id);
      if (res.success) {
        toast.success("Payment confirmed! Your delivery request is now under organizer review.");
        if (onSuccess && registration.delivery_request) {
          const updatedRequest: MerchandiseDeliveryRequest = {
            ...registration.delivery_request,
            payment_status: "paid",
            status: "pending_review",
            paid_at: new Date().toISOString(),
          };
          onSuccess({
            ...registration,
            delivery_request: updatedRequest,
          });
        }
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to confirm payment.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Truck className="size-5" />
            <DialogTitle className="text-xl">Request Merchandise Delivery</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Couldn&apos;t attend the event? You can request to receive your purchased merchandise as a delivered
            package.
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Prominent Fee & Non-Commitment Cutting Fee Notice */}
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="font-semibold text-xs sm:text-sm">
                Distribution Fee & Non-Commitment Charge: Rp 50.000
              </AlertTitle>
              <AlertDescription className="mt-1 text-[11px] leading-relaxed sm:text-xs">
                A fixed fee of <strong>Rp 50.000</strong> applies for handling and courier distribution. This includes
                delivery logistics and a cutting fee because you could not commit to attending the event on-site.
              </AlertDescription>
            </Alert>

            {/* Merchandise Package Summary */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                  <ShoppingBag className="size-3.5 text-primary" />
                  Merchandise Included in Package ({merchandiseItems.length} items)
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Order Verified
                </Badge>
              </div>

              <div className="space-y-1.5 divide-y divide-border/40 text-xs">
                {merchandiseItems.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between pt-1.5 first:pt-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      {item.selected_variations && Object.keys(item.selected_variations).length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {Object.entries(item.selected_variations)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {item.price ? `Rp ${(item.price * item.quantity).toLocaleString("id-ID")}` : "Perk"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Address Form Inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="recipientName" className="text-xs">
                    Recipient Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="recipientName"
                    placeholder="e.g. Budi Santoso"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="recipientPhone" className="text-xs">
                    WhatsApp / Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="recipientPhone"
                    placeholder="e.g. 081234567890"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="shippingAddress" className="text-xs">
                  Full Street Address & Building Details <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="shippingAddress"
                  placeholder="Street name, RT/RW, House/Apt unit number, Landmark..."
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  required
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs">
                    City & Province <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    placeholder="e.g. Jakarta Selatan, DKI Jakarta"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="postalCode" className="text-xs">
                    Postal Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="postalCode"
                    placeholder="e.g. 12430"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">
                  Courier / Drop-off Notes (Optional)
                </Label>
                <Input
                  id="notes"
                  placeholder="e.g. Please leave with security if not home"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="h-9 gap-1.5 text-xs">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Generating Payment Link...
                  </>
                ) : (
                  <>
                    <Truck className="size-3.5" />
                    Proceed to Pay Rp 50.000
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Payment Step */
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Delivery Form Submitted!</h3>
              <p className="mt-1 text-muted-foreground text-xs">
                To finalize your delivery request, please complete the distribution payment of{" "}
                <strong className="text-foreground">Rp 50.000</strong>.
              </p>
              {invoiceNumber && (
                <div className="mt-2 font-mono text-[11px] text-muted-foreground">Invoice: {invoiceNumber}</div>
              )}
            </div>

            {paymentEnvironment === "sandbox" && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 text-xs dark:text-amber-200">
                <span className="font-semibold">🧪 Sandbox / Dev Mode:</span>
                <span>Testing environment is active. You can simulate instant payment confirmation below.</span>
              </div>
            )}

            {generatedPaymentUrl ? (
              <div className="space-y-3">
                <Button asChild className="h-10 w-full gap-2 font-medium text-xs" size="sm">
                  <a href={generatedPaymentUrl} target="_blank" rel="noopener noreferrer">
                    Open DOKU Payment Link
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Opens DOKU QRIS checkout. Scan the QR code with any e-wallet or banking app. Once paid, click below to confirm.
                </p>
              </div>
            ) : (
              <Alert className="border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200">
                <Package className="size-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="font-semibold text-xs">Payment Link Queued</AlertTitle>
                <AlertDescription className="text-[11px]">
                  You can complete verification directly or simulate payment confirmation below.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
              <div className="font-medium text-foreground">Delivery Destination:</div>
              <div className="mt-1 text-muted-foreground">
                {recipientName} ({recipientPhone})<br />
                {shippingAddress}, {city} {postalCode}
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("form")}
                className="h-9 text-muted-foreground text-xs"
              >
                ← Edit Address
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-9 text-xs"
                >
                  Pay Later
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isConfirmingPayment}
                  onClick={handleConfirmPayment}
                  className="h-9 gap-1.5 bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                >
                  {isConfirmingPayment ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Confirm Payment Complete
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
