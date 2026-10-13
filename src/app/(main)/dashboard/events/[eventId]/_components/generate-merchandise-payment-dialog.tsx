"use client";

import { useState, useTransition } from "react";

import { Check, Copy, CreditCard, ExternalLink, Loader2, QrCode, Sparkles, Tag } from "lucide-react";
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
import { DEFAULT_PAYMENT_HEADER_EMAIL_URL } from "@/lib/events/doku-payment";
import { calculateVoucherDiscount, formatVoucherDiscountDisplay } from "@/lib/events/voucher-utils";
import type { EventMerchandiseItem, FirestoreEvent } from "@/lib/firestore/types";
import { generatePaymentLinkAction } from "@/server/payment-actions";

interface GenerateMerchandisePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EventMerchandiseItem | null;
  event: FirestoreEvent;
}

export function GenerateMerchandisePaymentDialog({
  open,
  onOpenChange,
  item,
  event,
}: GenerateMerchandisePaymentDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>("none");
  const [sendEmail, setSendEmail] = useState(true);
  const [includeCommitmentFee, setIncludeCommitmentFee] = useState(false);
  const [commitmentFeeAmount, _setCommitmentFeeAmount] = useState(50000);
  const [isPending, startTransition] = useTransition();

  // Generated payment result
  const [paymentResult, setPaymentResult] = useState<{
    paymentUrl: string;
    invoiceNumber: string;
    amount: number;
    expiredDatetime?: string;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const handleVariationChange = (variationName: string, optionValue: string) => {
    setSelectedVariations((prev) => ({
      ...prev,
      [variationName]: optionValue,
    }));
  };

  const resetForm = () => {
    setQuantity(1);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setSelectedVariations({});
    setSelectedVoucherId("none");
    setSendEmail(true);
    setIncludeCommitmentFee(false);
    setPaymentResult(null);
    setHasCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCopyLink = () => {
    if (!paymentResult?.paymentUrl) return;
    void navigator.clipboard.writeText(paymentResult.paymentUrl);
    setHasCopied(true);
    toast.success("Payment link copied to clipboard!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleGenerate = () => {
    if (!item) return;

    if (!customerName.trim()) {
      toast.error("Please enter the customer's full name.");
      return;
    }

    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      toast.error("Please enter a valid customer email address.");
      return;
    }

    if (!customerPhone.trim()) {
      toast.error("Please enter the customer's WhatsApp phone number.");
      return;
    }

    let formattedPhone = customerPhone.trim().replace(/[\s-]/g, "");
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1);
    if (formattedPhone.startsWith("0")) formattedPhone = `62${formattedPhone.slice(1)}`;

    // Compose formatted item label including variations
    const variationSuffix = Object.entries(selectedVariations)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const itemName = variationSuffix ? `${item.name} (${variationSuffix})` : item.name;

    const fees = includeCommitmentFee
      ? [
          {
            label: "Commitment Fee",
            type: "fixed" as const,
            value: commitmentFeeAmount,
            desc: "Refundable upon attendance.",
          },
        ]
      : [];

    let effectivePrice = item.price || 0;
    let effectiveImage = item.image_url;
    if (item.variations) {
      for (const v of item.variations) {
        const selectedOpt = selectedVariations[v.name];
        if (
          selectedOpt &&
          v.option_details?.[selectedOpt]?.price !== undefined &&
          v.option_details[selectedOpt].price !== null
        ) {
          effectivePrice = v.option_details[selectedOpt].price;
        }
        if (selectedOpt && v.option_details?.[selectedOpt]?.image_url) {
          effectiveImage = v.option_details[selectedOpt].image_url;
        }
      }
    }

    const eligibleVouchers = (event.vouchers ?? []).filter(
      (v) => v.status === "active" && (v.applies_to === "merchandise" || v.applies_to === "all"),
    );
    const selectedVoucher = eligibleVouchers.find((v) => v.id === selectedVoucherId);
    const merchSubtotal = effectivePrice * quantity;
    const voucherDiscount = selectedVoucher
      ? calculateVoucherDiscount(selectedVoucher, {
          ticketPrice: 0,
          merchandiseTotal: merchSubtotal,
        }).merchandiseDiscount
      : 0;
    const finalMerchTotal = Math.max(0, merchSubtotal - voucherDiscount);
    const chargedUnitPrice = Math.max(0, Math.round(finalMerchTotal / quantity));
    const finalItemName = selectedVoucher ? `${itemName} (Promo: ${selectedVoucher.code})` : itemName;

    startTransition(async () => {
      try {
        const res = await generatePaymentLinkAction({
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: formattedPhone,
          },
          event: {
            id: event.id,
            title: event.title,
            headerEmailUrl:
              event.headerEmailUrl?.trim() || event.header_email_url?.trim() || DEFAULT_PAYMENT_HEADER_EMAIL_URL,
            paymentDeadlineMinutes:
              event.paymentDeadlinesInMinutes ?? event.paymentDeadlineMinutes ?? event.payment_deadline_minutes ?? 1440,
          },
          items: [
            {
              id: item.id,
              name: finalItemName,
              quantity: quantity,
              price: chargedUnitPrice,
              imageUrl: effectiveImage,
              description: item.description,
              type: "Merchandise",
            },
          ],
          fees,
          payment: {
            paymentMethodTypes: ["QRIS"],
            sendEmail,
          },
          referenceId: `MERCH-${Date.now().toString(36).toUpperCase()}`,
          isProduction:
            event.payment_environment === "production"
              ? true
              : event.payment_environment === "sandbox"
                ? false
                : undefined,
          webhookUrl: event.payment_webhook_url ?? undefined,
        });

        if (res.success && res.paymentUrl) {
          setPaymentResult({
            paymentUrl: res.paymentUrl,
            invoiceNumber: res.invoiceNumber ?? "INV-NEW",
            amount: res.amount ?? finalMerchTotal + (includeCommitmentFee ? commitmentFeeAmount : 0),
            expiredDatetime: res.expiredDatetime,
          });
          toast.success("DOKU payment link generated successfully!");
        } else {
          toast.error(res.error ?? "Failed to generate payment link.");
        }
      } catch (err) {
        console.error("[GenerateMerchandisePaymentDialog] Error:", err);
        toast.error("An unexpected error occurred while communicating with n8n.");
      }
    });
  };

  if (!item) return null;

  let effectivePrice = item.price || 0;
  if (item.variations) {
    for (const v of item.variations) {
      const selectedOpt = selectedVariations[v.name];
      if (
        selectedOpt &&
        v.option_details?.[selectedOpt]?.price !== undefined &&
        v.option_details[selectedOpt].price !== null
      ) {
        effectivePrice = v.option_details[selectedOpt].price;
      }
    }
  }

  const eligibleVouchers = (event.vouchers ?? []).filter(
    (v) => v.status === "active" && (v.applies_to === "merchandise" || v.applies_to === "all"),
  );
  const selectedVoucher = eligibleVouchers.find((v) => v.id === selectedVoucherId);
  const itemTotal = effectivePrice * quantity;
  const voucherDiscount = selectedVoucher
    ? calculateVoucherDiscount(selectedVoucher, {
        ticketPrice: 0,
        merchandiseTotal: itemTotal,
      }).merchandiseDiscount
    : 0;
  const grandTotal = Math.max(0, itemTotal - voucherDiscount) + (includeCommitmentFee ? commitmentFeeAmount : 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-semibold text-base">Generate DOKU Payment Link</DialogTitle>
                {event.payment_environment === "sandbox" ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]"
                  >
                    Sandbox
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px]"
                  >
                    Live Production
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs">
                Create a dynamic QRIS checkout link for this merchandise item.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {paymentResult ? (
          /* SUCCESS STATE: Display Link and Options */
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <QrCode className="size-5" />
              </div>
              <h4 className="mt-2 font-semibold text-emerald-800 text-sm dark:text-emerald-300">Payment Link Ready!</h4>
              <p className="mt-1 text-muted-foreground text-xs">
                Total Amount: <strong>Rp {paymentResult.amount.toLocaleString("id-ID")}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground">Invoice #{paymentResult.invoiceNumber}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">DOKU Checkout URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={paymentResult.paymentUrl}
                  className="h-9 font-mono text-muted-foreground text-xs"
                />
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0 gap-1.5">
                  {hasCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  <span>{hasCopied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="w-full gap-2 text-xs">
                <a href={paymentResult.paymentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open DOKU Checkout in New Tab
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full gap-2 text-xs">
                <a href="https://www.doku.com/testqr/" target="_blank" rel="noopener noreferrer">
                  <QrCode className="size-3.5 text-primary" />
                  Test with DOKU QRIS Simulator
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground text-xs">
                Generate Another Link
              </Button>
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <div className="space-y-4 py-2">
            {/* Item Preview Card */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              {item.image_url ? (
                // biome-ignore lint/performance/noImgElement: thumbnail
                <img src={item.image_url} alt={item.name} className="size-12 shrink-0 rounded-md border object-cover" />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                  <CreditCard className="size-5 opacity-40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h5 className="truncate font-semibold text-foreground text-xs">{item.name}</h5>
                <p className="font-semibold text-primary text-xs">
                  {item.is_free ? "Free Perk" : `Rp ${item.price.toLocaleString("id-ID")}`}
                </p>
                <span className="text-[10px] text-muted-foreground">{event.title}</span>
              </div>
            </div>

            {/* Variations Selector if applicable */}
            {item.variations.length > 0 && (
              <div className="space-y-2.5 rounded-lg border bg-muted/10 p-3">
                <Label className="font-semibold text-xs">Select Variations</Label>
                <div className="space-y-2">
                  {item.variations.map((v) => (
                    <div key={v.name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground text-xs">{v.name}:</span>
                      <div className="flex flex-wrap gap-1">
                        {v.options.map((opt) => {
                          const isSelected = selectedVariations[v.name] === opt;
                          return (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => handleVariationChange(v.name, opt)}
                              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity and Price Calculation */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="order-quantity" className="font-medium text-xs">
                  Quantity
                </Label>
                <Input
                  id="order-quantity"
                  type="number"
                  min={1}
                  max={item.stock ?? 100}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-xs">Estimated Total</Label>
                <div className="flex h-8 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground text-xs">
                  Rp {grandTotal.toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            {/* Optional Voucher Discount Selector */}
            {eligibleVouchers.length > 0 && (
              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="order-voucher" className="flex items-center gap-1.5 font-medium text-xs">
                    <Tag className="size-3 text-primary" />
                    Apply Promo Voucher
                  </Label>
                  {selectedVoucher && (
                    <span className="font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                      -Rp {voucherDiscount.toLocaleString("id-ID")}
                    </span>
                  )}
                </div>
                <Select value={selectedVoucherId} onValueChange={setSelectedVoucherId}>
                  <SelectTrigger id="order-voucher" className="h-8 text-xs">
                    <SelectValue placeholder="Select a voucher (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No voucher</SelectItem>
                    {eligibleVouchers.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.code} — {formatVoucherDiscountDisplay(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Customer Details */}
            <div className="space-y-2.5 pt-1">
              <span className="font-semibold text-foreground text-xs">Customer & Notification Info</span>

              <div className="space-y-1">
                <Label htmlFor="cust-name" className="text-muted-foreground text-xs">
                  Full Name *
                </Label>
                <Input
                  id="cust-name"
                  placeholder="e.g. Budi Santoso"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-email" className="text-muted-foreground text-xs">
                  Email Address *
                </Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="e.g. budi@gmail.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-phone" className="text-muted-foreground text-xs">
                  Phone / WhatsApp (Optional)
                </Label>
                <Input
                  id="cust-phone"
                  placeholder="e.g. 08123456789"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Optional Commitment Fee */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-2.5 text-xs">
              <div className="space-y-0.5">
                <span className="font-medium text-foreground">Attach Commitment Fee</span>
                <p className="text-[11px] text-muted-foreground">+ Rp {commitmentFeeAmount.toLocaleString("id-ID")}</p>
              </div>
              <Switch checked={includeCommitmentFee} onCheckedChange={setIncludeCommitmentFee} />
            </div>

            {/* Send Email via n8n toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-2.5 text-xs">
              <div className="space-y-0.5">
                <span className="font-medium text-foreground">Send Email via n8n</span>
                <p className="text-[11px] text-muted-foreground">Dispatches payment instructions to attendee</p>
              </div>
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-3">
          {!paymentResult && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleGenerate} disabled={isPending} className="gap-1.5 text-xs">
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                <span>{isPending ? "Generating..." : "Generate DOKU Link"}</span>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
