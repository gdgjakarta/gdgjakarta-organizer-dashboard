"use client";

import { useEffect, useState, useTransition } from "react";

import { CheckCircle2, Clock, Info, Loader2, ShieldCheck, Truck } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_MERCHANDISE_LEAD_TIME_WEEKS,
  DEFAULT_MERCHANDISE_SHIPPING_TIME_WEEKS,
  formatMerchandiseDeliveryNotice,
} from "@/lib/events/merchandise-delivery-timeline";
import { updateEventMerchandiseDeliveryConfigAction } from "@/lib/firestore/actions";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface MerchandiseDeliveryConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: FirestoreEvent;
  eventId: string;
  currentEnv: "production" | "sandbox";
  currentFee: number;
  onSuccess?: (
    newEnv: "production" | "sandbox",
    newFee: number,
    newLeadTime: number,
    newShippingTime: number,
    newNotes?: string | null,
  ) => void;
}

const PRESET_FEES = [25000, 35000, 50000, 75000, 100000];
const PRESET_LEAD_WEEKS = [1, 2, 3, 4];
const PRESET_SHIPPING_WEEKS = [1, 2, 3];

export function MerchandiseDeliveryConfigDialog({
  isOpen,
  onOpenChange,
  event,
  eventId,
  currentEnv,
  currentFee,
  onSuccess,
}: MerchandiseDeliveryConfigDialogProps) {
  const [fee, setFee] = useState<number>(currentFee);
  const [env, setEnv] = useState<"production" | "sandbox">(currentEnv);
  const [leadTimeWeeks, setLeadTimeWeeks] = useState<number>(
    typeof event.merchandise_delivery_lead_time_weeks === "number"
      ? event.merchandise_delivery_lead_time_weeks
      : DEFAULT_MERCHANDISE_LEAD_TIME_WEEKS,
  );
  const [shippingTimeWeeks, setShippingTimeWeeks] = useState<number>(
    typeof event.merchandise_delivery_shipping_time_weeks === "number"
      ? event.merchandise_delivery_shipping_time_weeks
      : DEFAULT_MERCHANDISE_SHIPPING_TIME_WEEKS,
  );
  const [deliveryNotes, setDeliveryNotes] = useState<string>(event.merchandise_delivery_notes ?? "");
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setFee(currentFee);
      setEnv(currentEnv);
      setLeadTimeWeeks(
        typeof event.merchandise_delivery_lead_time_weeks === "number"
          ? event.merchandise_delivery_lead_time_weeks
          : DEFAULT_MERCHANDISE_LEAD_TIME_WEEKS,
      );
      setShippingTimeWeeks(
        typeof event.merchandise_delivery_shipping_time_weeks === "number"
          ? event.merchandise_delivery_shipping_time_weeks
          : DEFAULT_MERCHANDISE_SHIPPING_TIME_WEEKS,
      );
      setDeliveryNotes(event.merchandise_delivery_notes ?? "");
    }
  }, [
    isOpen,
    currentFee,
    currentEnv,
    event.merchandise_delivery_lead_time_weeks,
    event.merchandise_delivery_shipping_time_weeks,
    event.merchandise_delivery_notes,
  ]);

  const previewNotice = formatMerchandiseDeliveryNotice({
    leadTimeWeeks,
    shippingTimeWeeks,
    customNotes: deliveryNotes.trim() || null,
  });

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await updateEventMerchandiseDeliveryConfigAction(
          eventId,
          {
            environment: env,
            fee: fee,
            leadTimeWeeks,
            shippingTimeWeeks,
            notes: deliveryNotes.trim() || null,
          },
          event,
        );

        if (res.success) {
          toast.success("Merchandise delivery configuration updated successfully!");

          // Optimistically broadcast across tabs in the same window
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("gdg:merchandise-delivery-env-change", {
                detail: { eventId: String(eventId), environment: env },
              }),
            );
            window.dispatchEvent(
              new CustomEvent("gdg:merchandise-delivery-fee-change", {
                detail: { eventId: String(eventId), fee: fee },
              }),
            );
            window.dispatchEvent(
              new CustomEvent("gdg:merchandise-delivery-timeline-change", {
                detail: {
                  eventId: String(eventId),
                  leadTimeWeeks,
                  shippingTimeWeeks,
                  notes: deliveryNotes.trim() || null,
                },
              }),
            );
          }

          onSuccess?.(env, fee, leadTimeWeeks, shippingTimeWeeks, deliveryNotes.trim() || null);
          onOpenChange(false);
        } else {
          toast.error(res.error || "Failed to update configuration.");
        }
      } catch (err) {
        console.error("[MerchandiseDeliveryConfigDialog] save error:", err);
        toast.error("Failed to update merchandise delivery configuration.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Truck className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Merchandise Delivery Configuration</DialogTitle>
              <DialogDescription className="text-xs">
                Configure handling fees and payment environment for no-show merchandise shipping.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Configurable Delivery Price (IDR) */}
          <Field className="space-y-1.5">
            <FieldLabel htmlFor="dialog-merch-delivery-fee" className="font-semibold text-xs">
              Merchandise Delivery Fee (IDR)
            </FieldLabel>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-muted-foreground text-xs">
                Rp
              </span>
              <Input
                id="dialog-merch-delivery-fee"
                type="number"
                min={0}
                step={1000}
                value={fee}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setFee(Number.isNaN(val) ? 0 : Math.max(0, val));
                }}
                className="pl-9 font-semibold text-xs"
                placeholder="50000"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 text-[10px] text-muted-foreground">Quick presets:</span>
              {PRESET_FEES.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFee(preset)}
                  className={cn(
                    "h-6 px-2 text-[10px]",
                    fee === preset && "border-primary bg-primary/10 font-semibold text-primary",
                  )}
                >
                  Rp {preset.toLocaleString("id-ID")}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Current fee: <strong className="text-foreground">Rp {fee.toLocaleString("id-ID")}</strong>. Applied to
              each uncollected perk courier delivery invoice.
            </p>
          </Field>

          {/* Delivery Fee Environment */}
          <Field className="space-y-1.5">
            <FieldLabel htmlFor="dialog-merch-delivery-env" className="font-semibold text-xs">
              Delivery Payment Environment
            </FieldLabel>
            <Select value={env} onValueChange={(val: "production" | "sandbox") => setEnv(val)}>
              <SelectTrigger id="dialog-merch-delivery-env" className="text-xs">
                <SelectValue placeholder="Select Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production" className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Live Production (Real QRIS Rp {fee.toLocaleString("id-ID")})</span>
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

          {/* Timeline & Production Window Configuration */}
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Clock className="size-3.5 text-primary" />
              <span>Attendee Delivery & Production Timeline Window</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field className="space-y-1">
                <FieldLabel htmlFor="dialog-merch-lead-time" className="font-medium text-xs">
                  Creation & QC (Weeks)
                </FieldLabel>
                <Input
                  id="dialog-merch-lead-time"
                  type="number"
                  min={0}
                  max={20}
                  value={leadTimeWeeks}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setLeadTimeWeeks(Number.isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="h-8 text-xs font-semibold"
                />
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {PRESET_LEAD_WEEKS.map((w) => (
                    <Button
                      key={w}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLeadTimeWeeks(w)}
                      className={cn(
                        "h-5 px-1.5 text-[10px]",
                        leadTimeWeeks === w && "border-primary bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      {w}w
                    </Button>
                  ))}
                </div>
              </Field>

              <Field className="space-y-1">
                <FieldLabel htmlFor="dialog-merch-shipping-time" className="font-medium text-xs">
                  Courier Delivery (Weeks)
                </FieldLabel>
                <Input
                  id="dialog-merch-shipping-time"
                  type="number"
                  min={0}
                  max={10}
                  value={shippingTimeWeeks}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    setShippingTimeWeeks(Number.isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="h-8 text-xs font-semibold"
                />
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {PRESET_SHIPPING_WEEKS.map((w) => (
                    <Button
                      key={w}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShippingTimeWeeks(w)}
                      className={cn(
                        "h-5 px-1.5 text-[10px]",
                        shippingTimeWeeks === w && "border-primary bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      {w}w
                    </Button>
                  ))}
                </div>
              </Field>
            </div>

            <Field className="space-y-1">
              <FieldLabel htmlFor="dialog-merch-delivery-notes" className="font-medium text-xs">
                Additional Delivery Notes / Announcement (Optional)
              </FieldLabel>
              <Textarea
                id="dialog-merch-delivery-notes"
                rows={2}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="e.g. Backorders batch begins after registration cutoff. Special holiday couriers may have slight delays."
                className="text-xs"
              />
            </Field>

            {/* Live Attendee Notice Preview */}
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
              <div className="flex items-center gap-1 font-medium text-[11px] text-primary">
                <Info className="size-3" />
                <span>Live Attendee Notice Preview</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{previewNotice}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-1.5 text-xs font-medium"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
