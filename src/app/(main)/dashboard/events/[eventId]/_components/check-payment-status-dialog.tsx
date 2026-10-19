"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DokuStatusCheckResult } from "@/lib/events/doku-payment";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { checkDokuPaymentStatusAction } from "@/server/payment-actions";

interface CheckPaymentStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration | null;
  event?: FirestoreEvent | null;
  onSuccess?: (updatedReg: FirestoreRegistration) => void;
}

export function CheckPaymentStatusDialog({
  open,
  onOpenChange,
  registration,
  event,
  onSuccess,
}: CheckPaymentStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DokuStatusCheckResult | null>(null);
  const [showRawDetails, setShowRawDetails] = useState(false);
  const [hasCopiedInvoice, setHasCopiedInvoice] = useState(false);
  const [customInvoice, setCustomInvoice] = useState("");
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);

  const registrationInvoice =
    registration?.payment_invoice_number ??
    (registration?.answers?.payment_invoice_number as string | undefined) ??
    (registration?.answers?.invoice_number as string | undefined) ??
    (registration as { invoice_number?: string } | undefined)?.invoice_number ??
    "";

  const effectiveInvoice = (customInvoice.trim() || registrationInvoice).trim();

  const isProduction =
    event?.payment_environment === "production" || (event?.payment_environment === undefined && !event?.is_test);

  const runCheck = useCallback(
    (targetInvoice?: string) => {
      const invoiceToCheck = (targetInvoice ?? effectiveInvoice).trim();
      if (!invoiceToCheck) {
        toast.error("Please provide an invoice number to check.");
        return;
      }

      startTransition(async () => {
        setResult(null);
        try {
          const res = await checkDokuPaymentStatusAction({
            invoiceNumber: invoiceToCheck,
            eventId: event?.id ? String(event.id) : registration?.event_id,
            registrationId: registration?.id,
            isProduction,
          });

          setResult(res);

          if (res.isPaid) {
            toast.success("Payment confirmed! Attendee status updated to Paid & Registered.");
            if (registration && onSuccess) {
              onSuccess({
                ...registration,
                status: "paid_and_registered",
                payment_status: "paid",
                payment_channel: res.paymentChannel ?? registration.payment_channel,
                paid_at: res.paidAt ?? new Date().toISOString(),
              });
            }
          } else if (res.dokuStatus === "PENDING" || res.dokuStatus === "ORDER_GENERATED") {
            toast.info("Payment is still pending completion by the attendee.");
          } else if (res.dokuStatus === "ORDER_EXPIRED" || res.dokuStatus === "EXPIRED") {
            toast.warning("Payment order has expired in DOKU.");
          } else if (!res.success) {
            toast.error(res.message);
          }
        } catch (err) {
          console.error("Check payment status error:", err);
          toast.error("Network error checking payment status.");
        }
      });
    },
    [effectiveInvoice, event?.id, registration, isProduction, onSuccess],
  );

  // Run automatically when dialog opens with a valid registration invoice
  useEffect(() => {
    setIsEditingInvoice(false);
    if (open) {
      if (registrationInvoice) {
        setCustomInvoice(registrationInvoice);
        runCheck(registrationInvoice);
      } else {
        setCustomInvoice("");
        setResult(null);
        setShowRawDetails(false);
      }
    } else {
      setResult(null);
      setShowRawDetails(false);
    }
  }, [open, registrationInvoice, runCheck]);

  const handleCopyInvoice = () => {
    if (!effectiveInvoice) return;
    navigator.clipboard.writeText(effectiveInvoice);
    setHasCopiedInvoice(true);
    toast.success("Invoice number copied to clipboard");
    setTimeout(() => setHasCopiedInvoice(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
        {/* Sticky Header */}
        <div className="shrink-0 border-b bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg">Check DOKU Payment Status</DialogTitle>
                <DialogDescription className="text-xs">
                  Query live DOKU Check Status API & synchronize registration
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 font-medium text-[10px]">
              {isProduction ? "Production" : "Sandbox"}
            </Badge>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Attendee Overview if available */}
          {registration && (
            <div className="space-y-2.5 rounded-lg border bg-muted/40 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Attendee</span>
                <span className="text-right font-semibold text-foreground">
                  {registration.member_name || "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Email</span>
                <span className="text-right font-medium text-foreground">{registration.member_email || "-"}</span>
              </div>
              {effectiveInvoice && (
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Invoice Number</span>
                  <div className="flex min-w-0 items-center gap-1.5 font-mono">
                    <span className="truncate font-medium text-[11px] text-foreground">{effectiveInvoice}</span>
                    <button
                      type="button"
                      onClick={handleCopyInvoice}
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                      title="Copy invoice number"
                    >
                      {hasCopiedInvoice ? (
                        <CheckCircle2 className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingInvoice((prev) => !prev)}
                      className="ml-1 text-[10px] text-primary hover:underline"
                    >
                      {isEditingInvoice ? "Hide" : "Edit"}
                    </button>
                  </div>
                </div>
              )}
              {registration.ticket_name && (
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Ticket Type</span>
                  <span className="text-right font-medium text-foreground">{registration.ticket_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Invoice Input & Trigger (when no registration or user explicitly toggled edit) */}
          {(!registration || isEditingInvoice) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="doku-invoice-input" className="font-medium text-[11px] text-muted-foreground">
                  DOKU Invoice Number
                </label>
                {effectiveInvoice && (
                  <button
                    type="button"
                    onClick={handleCopyInvoice}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3" />
                    <span>{hasCopiedInvoice ? "Copied" : "Copy"}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="doku-invoice-input"
                  placeholder="e.g. INV-1792383386525-132640_..."
                  value={customInvoice}
                  onChange={(e) => setCustomInvoice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runCheck(customInvoice);
                    }
                  }}
                  className="h-8 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 bg-emerald-600 px-3 text-white text-xs hover:bg-emerald-700"
                  onClick={() => runCheck(customInvoice)}
                  disabled={isPending || !effectiveInvoice}
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="mr-1 size-3.5" />
                      Check
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isPending && (
            <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="font-medium text-muted-foreground text-xs">Querying DOKU Check Status API...</p>
              <p className="font-mono text-[11px] text-muted-foreground/80">GET /orders/v1/status/{effectiveInvoice}</p>
            </div>
          )}

          {/* Result State */}
          {!isPending && result && (
            <div className="space-y-3">
              {/* SUCCESS / PAID */}
              {result.isPaid && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 dark:bg-emerald-500/15">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-emerald-800 text-sm dark:text-emerald-300">
                          Payment Confirmed (SUCCESS)
                        </h4>
                        <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">Paid</Badge>
                      </div>
                      <p className="text-emerald-700 text-xs leading-relaxed dark:text-emerald-400">{result.message}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] sm:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>{" "}
                          <span className="font-semibold text-foreground">
                            Rp {(result.amount ?? registration?.payment_amount ?? 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Channel:</span>{" "}
                          <span className="font-semibold text-foreground">{result.paymentChannel || "QRIS"}</span>
                        </div>
                        {result.paidAt && (
                          <div>
                            <span className="text-muted-foreground">Paid Date:</span>{" "}
                            <span className="font-medium text-foreground">
                              {new Date(result.paidAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                        {result.approvalCode && (
                          <div>
                            <span className="text-muted-foreground">Approval Code:</span>{" "}
                            <span className="font-medium font-mono text-foreground">{result.approvalCode}</span>
                          </div>
                        )}
                      </div>

                      {result.n8nDispatched && (
                        <div className="mt-2.5 flex items-center gap-1.5 rounded bg-emerald-500/20 px-2 py-1 font-medium text-[11px] text-emerald-800 dark:text-emerald-200">
                          <ShieldCheck className="size-3.5" />
                          <span>n8n GDG Jakarta Webhook dispatched & Bevy attendee confirmed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PENDING */}
              {!result.isPaid && (result.dokuStatus === "PENDING" || result.dokuStatus === "ORDER_GENERATED") && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 dark:bg-amber-500/15">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-amber-800 text-sm dark:text-amber-300">
                          Payment Pending (Awaiting Payment)
                        </h4>
                        <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-700">
                          Pending
                        </Badge>
                      </div>
                      <p className="text-amber-700 text-xs leading-relaxed dark:text-amber-400">
                        The order was generated in DOKU, but the attendee has not completed the payment transaction yet.
                      </p>
                      {registration?.payment_url && (
                        <div className="pt-1.5">
                          <a
                            href={registration.payment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-amber-800 text-xs hover:underline dark:text-amber-300"
                          >
                            Open Payment Link
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* EXPIRED */}
              {!result.isPaid && (result.dokuStatus === "ORDER_EXPIRED" || result.dokuStatus === "EXPIRED") && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 dark:bg-rose-500/15">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-rose-800 text-sm dark:text-rose-300">Order Expired</h4>
                        <Badge variant="outline" className="border-rose-500/40 text-[10px] text-rose-700">
                          Expired
                        </Badge>
                      </div>
                      <p className="text-rose-700 text-xs leading-relaxed dark:text-rose-400">
                        The checkout deadline has elapsed without payment completion. You can regenerate a new payment
                        link with an extended deadline.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* FAILED / ERROR */}
              {!result.isPaid &&
                result.dokuStatus !== "PENDING" &&
                result.dokuStatus !== "ORDER_GENERATED" &&
                result.dokuStatus !== "ORDER_EXPIRED" &&
                result.dokuStatus !== "EXPIRED" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                      <div className="space-y-1">
                        <h4 className="font-semibold text-destructive text-sm">
                          {result.dokuStatus === "ERROR" ? "Lookup Failed" : `Status: ${result.dokuStatus}`}
                        </h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {result.message || "DOKU reported an unhandled status or transaction failure."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Collapsible Raw API Details */}
              <div className="rounded-lg border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowRawDetails((prev) => !prev)}
                  className="flex w-full items-center justify-between p-2.5 font-medium text-muted-foreground text-xs hover:text-foreground"
                >
                  <span>Raw API Response Payload</span>
                  <ChevronDown className={cn("size-3.5 transition-transform", showRawDetails && "rotate-180")} />
                </button>
                {showRawDetails && (
                  <div className="border-t p-2.5 font-mono text-[10px]">
                    <pre className="max-h-48 overflow-auto rounded bg-background p-2 text-muted-foreground">
                      {JSON.stringify(result.dokuResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => runCheck()}
            disabled={isPending || !effectiveInvoice}
            className="gap-1.5 text-xs"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span>Re-check DOKU</span>
          </Button>

          <Button type="button" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
