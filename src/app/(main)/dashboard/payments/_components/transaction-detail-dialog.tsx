"use client";

import { useEffect, useState, useTransition } from "react";

import { Check, Copy, CreditCard, MailCheck, MailX, Phone, QrCode, RefreshCw, User } from "lucide-react";
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
import type { PaymentTransactionRecord } from "@/lib/firestore/types";
import { checkDokuPaymentStatusAction } from "@/server/payment-actions";

interface TransactionDetailDialogProps {
  transaction: PaymentTransactionRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionUpdated?: (updated: PaymentTransactionRecord) => void;
}

function getStatusBadgeConfig(status: string) {
  const s = status.toLowerCase();
  if (s === "paid" || s === "success" || s === "paid_and_registered") {
    return {
      label: "Paid",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
    };
  }
  return {
    label: "Failed",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium",
  };
}

export function TransactionDetailDialog({
  transaction: initialTransaction,
  open,
  onOpenChange,
  onTransactionUpdated,
}: TransactionDetailDialogProps) {
  const [transaction, setTransaction] = useState<PaymentTransactionRecord | null>(initialTransaction);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [isCheckingStatus, startCheckStatusTransition] = useTransition();

  useEffect(() => {
    setTransaction(initialTransaction);
  }, [initialTransaction]);

  if (!transaction) return null;

  const handleCopyInvoice = () => {
    navigator.clipboard.writeText(transaction.invoice_number);
    setCopiedInvoice(true);
    toast.success("Invoice number copied to clipboard");
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(transaction.raw_payload ?? transaction, null, 2));
    setCopiedJson(true);
    toast.success("Transaction payload JSON copied");
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCheckStatus = () => {
    startCheckStatusTransition(async () => {
      try {
        const res = await checkDokuPaymentStatusAction({
          invoiceNumber: transaction.invoice_number,
        });

        if (res.success) {
          const nextStatus = res.isPaid ? "paid" : res.dokuStatus?.toLowerCase() || "pending";
          const updated: PaymentTransactionRecord = {
            ...transaction,
            payment_status: nextStatus,
            amount: typeof res.amount === "number" ? res.amount : transaction.amount,
            payment_channel: res.paymentChannel || transaction.payment_channel,
            approval_code: res.approvalCode || transaction.approval_code,
            updated_at: new Date().toISOString(),
            raw_payload: (res.dokuResponse as Record<string, unknown>) ?? transaction.raw_payload,
          };

          setTransaction(updated);
          onTransactionUpdated?.(updated);

          if (res.isPaid) {
            toast.success("Payment confirmed SUCCESS in DOKU!");
          } else {
            toast.info(`DOKU Status: ${res.dokuStatus}. ${res.message || ""}`);
          }
        } else {
          toast.error(res.message || "Failed to query DOKU status API");
        }
      } catch {
        toast.error("Failed to connect to DOKU Check Status API");
      }
    });
  };

  const isEmailSent = transaction.email_status === "sent";
  const statusMeta = getStatusBadgeConfig(transaction.payment_status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl md:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 font-bold text-lg">
              <CreditCard className="size-5 text-primary" />
              Transaction Details
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusMeta.className}>
                {statusMeta.label}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs">
            DOKU QRIS Payment notification and operational record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Invoice & Amount Hero (2 Columns, responsive) */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/40 p-4 sm:grid-cols-2">
            {/* Invoice Info */}
            <div className="flex flex-col justify-center min-w-0">
              <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Invoice Number</p>
              <div className="mt-1.5 flex items-start gap-2">
                <span className="font-bold font-mono text-sm text-foreground break-all select-all leading-snug">
                  {transaction.invoice_number}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={handleCopyInvoice}
                  title="Copy Invoice"
                >
                  {copiedInvoice ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] py-0 font-normal">
                  Source: {transaction.source_type?.replace(/_/g, " ") || "QRIS Webhook"}
                </Badge>
              </div>
            </div>

            {/* Amount Info */}
            <div className="flex flex-col justify-center rounded-lg border bg-background/80 p-3 sm:items-end sm:text-right">
              <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Total Amount</p>
              <p className="mt-1 font-extrabold text-foreground text-2xl">
                Rp {(transaction.amount ?? 0).toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Channel: {transaction.payment_channel || "QRIS"} ({transaction.issuer || "DOKU"})
              </p>
            </div>
          </div>

          {/* Operational Email Notification Status Card */}
          <div className="space-y-3 rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEmailSent ? (
                  <MailCheck className="size-5 text-emerald-500" />
                ) : (
                  <MailX className="size-5 text-amber-500" />
                )}
                <h4 className="font-semibold text-sm">Operational Email Notification</h4>
              </div>
              <Badge
                variant="outline"
                className={
                  isEmailSent
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }
              >
                {isEmailSent ? "Sent Successfully" : "Not Sent / Pending"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-2">
              <div className="min-w-0">
                <span className="text-muted-foreground">Recipient Mailbox:</span>
                <p className="mt-0.5 font-medium font-mono text-foreground break-all">
                  {transaction.email_recipient || "payment@gdgjakarta.org"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Dispatched At:</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {transaction.email_sent_at
                    ? new Date(transaction.email_sent_at).toLocaleString("en-US", {
                        timeZone: "Asia/Jakarta",
                        dateStyle: "medium",
                        timeStyle: "medium",
                      })
                    : "Not recorded"}
                </p>
              </div>
            </div>
            <p className="border-t pt-2 text-[11px] text-muted-foreground">
              Automated operational update sent to the GDG Jakarta financial operations team upon webhook confirmation.
            </p>
          </div>

          {/* Customer Profile */}
          <div className="space-y-2 rounded-xl border bg-background p-4">
            <h4 className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              <User className="size-3.5" />
              Customer Information
            </h4>
            <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-3">
              <div className="min-w-0">
                <span className="text-muted-foreground">Full Name</span>
                <p className="mt-0.5 font-medium text-foreground break-words">{transaction.customer_name || "N/A"}</p>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground">Email Address</span>
                <p className="mt-0.5 font-medium text-foreground break-all">
                  {transaction.customer_email ? (
                    <a href={`mailto:${transaction.customer_email}`} className="text-primary hover:underline">
                      {transaction.customer_email}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground">Phone Number</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {transaction.customer_phone ? (
                    <a
                      href={`https://wa.me/${transaction.customer_phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="size-3" />
                      {transaction.customer_phone}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Gateway Specs */}
          <div className="space-y-2 rounded-xl border bg-background p-4">
            <h4 className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              <QrCode className="size-3.5" />
              Payment Gateway Details
            </h4>
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Payment Channel</span>
                <p className="mt-0.5 font-medium text-foreground">{transaction.payment_channel || "QRIS"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Issuer / Bank</span>
                <p className="mt-0.5 font-medium text-foreground">{transaction.issuer || "DOKU QRIS"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Transaction Time</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {new Date(transaction.transaction_date).toLocaleString("en-US", {
                    timeZone: "Asia/Jakarta",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Approval Code</span>
                <p className="mt-0.5 font-mono text-foreground">{transaction.approval_code || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Raw Payload Accordion */}
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 font-medium text-xs"
                onClick={() => setShowRawPayload((prev) => !prev)}
              >
                {showRawPayload ? "Hide Raw Payload JSON" : "View Raw Payload JSON"}
              </Button>
              {showRawPayload && (
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopyJson}>
                  {copiedJson ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  Copy JSON
                </Button>
              )}
            </div>
            {showRawPayload && (
              <pre className="mt-2 max-h-48 overflow-x-auto rounded-lg border bg-black/90 p-3 font-mono text-[11px] text-white">
                {JSON.stringify(transaction.raw_payload ?? transaction, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={isCheckingStatus}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isCheckingStatus ? "animate-spin" : ""}`} />
              {isCheckingStatus ? "Checking DOKU..." : "Check Status with DOKU"}
            </Button>
            <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
