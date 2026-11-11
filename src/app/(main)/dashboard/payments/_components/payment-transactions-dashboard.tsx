"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Mail,
  MailCheck,
  MailX,
  Phone,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaymentTransactionRecord } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import {
  bulkCheckDokuPaymentStatusAction,
  checkDokuPaymentStatusAction,
  getPaymentTransactionsAction,
} from "@/server/payment-actions";

import { TransactionDetailDialog } from "./transaction-detail-dialog";

interface PaymentTransactionsDashboardProps {
  initialTransactions?: PaymentTransactionRecord[];
}

interface FilterSelectOption {
  value: string;
  label: string;
}

function FilterSelect({
  value,
  onValueChange,
  options,
  icon,
  prefix,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterSelectOption[];
  icon?: ReactNode;
  prefix?: string;
  placeholder?: string;
  className?: string;
}) {
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? placeholder ?? value;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-fit items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-xs whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {icon}
            {prefix && <span className="shrink-0 text-muted-foreground">{prefix}</span>}
            <span className="truncate">{selectedLabel}</span>
          </span>
          <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-auto min-w-(--radix-dropdown-menu-trigger-width)">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onValueChange(opt.value)}
            className="justify-between gap-3 text-xs"
          >
            <span className="truncate">{opt.label}</span>
            {value === opt.value && <Check className="size-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isPaidStatus(status?: string) {
  const s = status?.toLowerCase();
  return s === "paid" || s === "success" || s === "paid_and_registered";
}

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_VARIANTS = {
  all: {
    label: "All",
    activeClass: "border-primary/50 bg-primary/10 text-primary font-medium",
  },
  paid: {
    label: "Paid",
    activeClass: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    activeClass: "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium",
    badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
};

export function PaymentTransactionsDashboard({ initialTransactions = [] }: PaymentTransactionsDashboardProps) {
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>(initialTransactions);
  const [isRefreshing, startRefreshTransition] = useTransition();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [checkingRowId, setCheckingRowId] = useState<string | null>(null);
  const [isBulkChecking, startBulkCheckTransition] = useTransition();

  // Copy state
  const [copiedInvoice, setCopiedInvoice] = useState<string | null>(null);

  // Dialog state
  const [selectedTx, setSelectedTx] = useState<PaymentTransactionRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleRefresh = () => {
    startRefreshTransition(async () => {
      try {
        const res = await getPaymentTransactionsAction();
        if (res.success && res.transactions) {
          setTransactions(res.transactions);
          setSelectedIds(new Set());
          toast.success(`Refreshed ${res.transactions.length} payment transactions`);
        } else {
          toast.error(res.error || "Failed to load transactions");
        }
      } catch {
        toast.error("Error refreshing payment data");
      }
    });
  };

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedInvoice(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  const handleViewDetail = (tx: PaymentTransactionRecord) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
  };

  const handleTransactionUpdated = (updated: PaymentTransactionRecord) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id || t.invoice_number === updated.invoice_number ? updated : t)),
    );
    setSelectedTx(updated);
  };

  // Per-row check status
  const handleRowCheckStatus = async (tx: PaymentTransactionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const rowId = tx.id || tx.invoice_number;
    setCheckingRowId(rowId);
    try {
      const res = await checkDokuPaymentStatusAction({ invoiceNumber: tx.invoice_number });
      if (res.success) {
        const nextStatus = res.isPaid ? "paid" : res.dokuStatus?.toLowerCase() || "pending";
        const updated: PaymentTransactionRecord = {
          ...tx,
          payment_status: nextStatus,
          amount: typeof res.amount === "number" ? res.amount : tx.amount,
          payment_channel: res.paymentChannel || tx.payment_channel,
          approval_code: res.approvalCode || tx.approval_code,
          updated_at: new Date().toISOString(),
          raw_payload: (res.dokuResponse as Record<string, unknown>) ?? tx.raw_payload,
        };
        setTransactions((prev) =>
          prev.map((t) => (t.id === tx.id || t.invoice_number === tx.invoice_number ? updated : t)),
        );
        if (res.isPaid) {
          toast.success(`${tx.invoice_number}: Payment confirmed PAID in DOKU!`);
        } else {
          toast.info(`${tx.invoice_number}: DOKU status — ${res.dokuStatus}`);
        }
      } else {
        toast.error(res.message || "Failed to query DOKU status");
      }
    } catch {
      toast.error("Failed to connect to DOKU API");
    } finally {
      setCheckingRowId(null);
    }
  };

  // Bulk check status
  const handleBulkCheckStatus = () => {
    const invoiceNumbers = Array.from(selectedIds).filter(Boolean);
    if (invoiceNumbers.length === 0) return;

    startBulkCheckTransition(async () => {
      try {
        const res = await bulkCheckDokuPaymentStatusAction({ invoiceNumbers });
        if (res.success && res.results) {
          let updatedCount = 0;
          setTransactions((prev) =>
            prev.map((tx) => {
              const result = res.results.find((r) => r.invoiceNumber === tx.invoice_number);
              if (!result?.success) return tx;
              updatedCount++;
              const nextStatus = result.isPaid ? "paid" : result.dokuStatus?.toLowerCase() || "pending";
              return { ...tx, payment_status: nextStatus, updated_at: new Date().toISOString() };
            }),
          );
          toast.success(`Checked ${updatedCount} of ${invoiceNumbers.length} transactions with DOKU`);
        } else {
          toast.error("Bulk status check failed");
        }
      } catch {
        toast.error("Error during bulk DOKU status check");
      }
    });
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let paidCount = 0;
    let emailSentCount = 0;

    for (const tx of transactions) {
      if (isPaidStatus(tx.payment_status)) {
        totalRevenue += tx.amount || 0;
        paidCount += 1;
      }
      if (tx.email_status === "sent") emailSentCount += 1;
    }

    const emailSentRate = transactions.length > 0 ? Math.round((emailSentCount / transactions.length) * 100) : 100;
    return { totalRevenue, totalCount: transactions.length, paidCount, emailSentCount, emailSentRate };
  }, [transactions]);

  // Status counts for unified status filter (Paid & Failed only)
  const statusCounts = useMemo(() => {
    let paid = 0;
    let failed = 0;

    for (const tx of transactions) {
      if (isPaidStatus(tx.payment_status)) {
        paid++;
      } else {
        failed++;
      }
    }

    return {
      all: transactions.length,
      paid,
      failed,
    };
  }, [transactions]);

  // Filtered list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isPaid = isPaidStatus(tx.payment_status);

      // Status filter (all, paid, failed)
      if (statusFilter === "paid" && !isPaid) return false;
      if (statusFilter === "failed" && isPaid) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          (tx.invoice_number || "").toLowerCase().includes(q) ||
          (tx.customer_name || "").toLowerCase().includes(q) ||
          (tx.customer_email || "").toLowerCase().includes(q) ||
          (tx.customer_phone || "").toLowerCase().includes(q) ||
          (tx.issuer || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Email Status filter
      if (emailStatusFilter !== "all") {
        if (emailStatusFilter === "sent" && tx.email_status !== "sent") return false;
        if (emailStatusFilter === "not_sent" && tx.email_status === "sent") return false;
      }

      return true;
    });
  }, [transactions, searchQuery, statusFilter, emailStatusFilter]);

  // Selection helpers
  const filteredIds = filteredTransactions.map((tx) => tx.id || tx.invoice_number);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) {
          next.delete(id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) {
          next.add(id);
        }
        return next;
      });
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResetAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setEmailStatusFilter("all");
  };

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "all" || emailStatusFilter !== "all";

  const conversionText =
    metrics.totalCount > 0
      ? `${Math.round((metrics.paidCount / metrics.totalCount) * 100)}% conversion rate`
      : "No data";

  const statusTabItems = [
    { key: "all", label: "All", count: statusCounts.all, activeClass: STATUS_VARIANTS.all.activeClass },
    {
      key: "paid",
      label: "Paid",
      count: statusCounts.paid,
      activeClass: STATUS_VARIANTS.paid.activeClass,
    },
    {
      key: "failed",
      label: "Failed",
      count: statusCounts.failed,
      activeClass: STATUS_VARIANTS.failed.activeClass,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
            <ReceiptText className="size-6 text-primary" />
            Transactions & QRIS Payments
          </h1>
          <p className="mt-0.5 text-muted-foreground text-sm">
            Real-time feed of DOKU QRIS payments, webhook notifications, and operational email dispatch status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a href="https://dashboard.doku.com/bo/dashboard" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              DOKU Portal
            </a>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-medium text-xs uppercase tracking-wider">
              Total Revenue Collected
            </CardDescription>
            <CardTitle className="font-bold text-2xl text-foreground">
              Rp {metrics.totalRevenue.toLocaleString("id-ID")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="flex items-center gap-1 text-muted-foreground text-xs">
              <TrendingUp className="size-3.5 text-emerald-500" />
              Across {metrics.paidCount} successful payments
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-medium text-xs uppercase tracking-wider">
              Total Transactions
            </CardDescription>
            <CardTitle className="font-bold text-2xl text-foreground">{metrics.totalCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="flex items-center gap-1 text-muted-foreground text-xs">
              <QrCode className="size-3.5 text-primary" />
              Incoming DOKU QRIS notifications
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-medium text-xs uppercase tracking-wider">
              Successful Payments
            </CardDescription>
            <CardTitle className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
              {metrics.paidCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="flex items-center gap-1 text-muted-foreground text-xs">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              {conversionText}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="font-medium text-xs uppercase tracking-wider">
              Email Alerts Dispatched
            </CardDescription>
            <CardTitle className="flex items-center gap-2 font-bold text-2xl text-foreground">
              {metrics.emailSentCount}
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0 font-semibold text-emerald-600 text-xs dark:text-emerald-400"
              >
                {metrics.emailSentRate}% Sent
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="flex items-center gap-1 truncate text-muted-foreground text-xs">
              <MailCheck className="size-3.5 text-emerald-500" />
              Relayed to payment@gdgjakarta.org
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Container Card (matching registrants-tab) */}
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                Transactions & QRIS Filtration ({filteredTransactions.length}
                {transactions.length > 0 && filteredTransactions.length !== transactions.length
                  ? ` of ${transactions.length}`
                  : ""}
                )
              </CardTitle>
              <CardDescription>
                Track incoming DOKU QRIS payments, inspect payload details, and verify transaction statuses.
              </CardDescription>
            </div>
          </div>

          {/* Batch Actions Toolbar (matching registrants-tab) */}
          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-primary/20 dark:bg-primary/10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/30 bg-background px-2.5 py-1 font-semibold text-foreground text-xs shadow-2xs"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  <span>
                    {selectedIds.size} {selectedIds.size === 1 ? "transaction" : "transactions"} selected
                  </span>
                </Badge>

                {selectedIds.size < filteredTransactions.length && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={toggleSelectAll}
                    className="h-7 text-muted-foreground text-xs hover:text-foreground"
                  >
                    Select all ({filteredTransactions.length})
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 gap-1 text-muted-foreground text-xs hover:text-foreground"
                >
                  <X className="size-3.5" />
                  Clear
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  onClick={handleBulkCheckStatus}
                  disabled={isBulkChecking}
                  title="Check live DOKU payment status and sync for selected transactions"
                >
                  <ShieldCheck className={`size-3.5 ${isBulkChecking ? "animate-pulse" : ""}`} />
                  <span>{isBulkChecking ? "Checking..." : `Check Payment (${selectedIds.size})`}</span>
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {/* Filtration Controls (matching registrants-tab) */}
          <div className="flex flex-col gap-3">
            {/* Search Row */}
            <div className="flex items-center gap-2">
              <InputGroup className="h-8 w-full">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  className="h-8 text-xs"
                  placeholder="Search name, email, invoice number, phone, or bank issuer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery.length > 0 && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search text"
                      className="size-5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <FilterSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  prefix="Status:"
                  options={[
                    { value: "all", label: `All Statuses (${statusCounts.all})` },
                    {
                      value: "paid",
                      label: `Paid (${statusCounts.paid})`,
                    },
                    { value: "failed", label: `Failed (${statusCounts.failed})` },
                  ]}
                />

                {/* Email Status Filter */}
                <FilterSelect
                  value={emailStatusFilter}
                  onValueChange={setEmailStatusFilter}
                  icon={<Mail className="size-3 shrink-0 text-muted-foreground" />}
                  prefix="Email:"
                  options={[
                    { value: "all", label: "All Email Status" },
                    { value: "sent", label: `Email Sent ✓ (${metrics.emailSentCount})` },
                    {
                      value: "not_sent",
                      label: `Email Not Sent (${transactions.length - metrics.emailSentCount})`,
                    },
                  ]}
                />
              </div>
            </div>

            {/* Status Pill Filters (matching registrants-tab pill bar) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {statusTabItems.map((item) => {
                const isActive = statusFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      isActive
                        ? item.activeClass
                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0 font-semibold text-[10px] tabular-nums",
                        isActive ? "bg-background/80" : "bg-muted text-foreground",
                      )}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Filter Indicators */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="font-medium text-muted-foreground text-xs">Active Filters:</span>
                {searchQuery.trim() && (
                  <Badge variant="secondary" className="gap-1 font-normal text-xs">
                    <span>Search: &quot;{searchQuery.trim()}&quot;</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label="Clear search filter"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
                {statusFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 font-normal text-xs">
                    <span>Status: {statusFilter === "paid" ? "Paid" : "Failed"}</span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label="Clear status filter"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
                {emailStatusFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 font-normal text-xs">
                    <Mail className="size-3 text-primary" />
                    <span>Email: {emailStatusFilter === "sent" ? "Email Sent ✓" : "Email Not Sent"}</span>
                    <button
                      type="button"
                      onClick={() => setEmailStatusFilter("all")}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label="Clear email filter"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetAllFilters}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Reset All
                </Button>
              </div>
            )}
          </div>

          {/* Table Container (matching registrants-tab: rounded-md border) */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Customer / Payer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method / Issuer</TableHead>
                  <TableHead>Email Notification</TableHead>
                  <TableHead className="whitespace-nowrap">Transaction Time</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-muted-foreground text-sm">
                      {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                            <ReceiptText className="size-5 text-muted-foreground" />
                          </div>
                          <p className="font-semibold text-foreground text-sm">No transactions received yet</p>
                          <p className="max-w-md text-muted-foreground text-xs leading-relaxed">
                            When payments or webhooks are processed by DOKU, transaction records will appear here
                            automatically in real-time.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                            <Search className="size-5 text-muted-foreground" />
                          </div>
                          <p className="font-semibold text-foreground text-sm">
                            No transactions match the selected filter
                          </p>
                          <p className="max-w-md text-muted-foreground text-xs leading-relaxed">
                            {statusFilter !== "all"
                              ? `No transactions currently match status "${statusFilter}".`
                              : "No transactions match your search criteria."}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 h-7 text-xs"
                            onClick={handleResetAllFilters}
                          >
                            Reset All Filters
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => {
                    const rowId = tx.id || tx.invoice_number;
                    const isSelected = selectedIds.has(rowId);
                    const isRowChecking = checkingRowId === rowId;
                    const isPaid = isPaidStatus(tx.payment_status);
                    const isEmailSent = tx.email_status === "sent";

                    const statusVariant = isPaid ? STATUS_VARIANTS.paid : STATUS_VARIANTS.failed;

                    return (
                      <TableRow
                        key={rowId}
                        className={cn("cursor-pointer hover:bg-muted/40", isSelected && "bg-muted/30")}
                        onClick={() => handleViewDetail(tx)}
                      >
                        {/* Checkbox */}
                        <TableCell onClick={(e) => toggleSelect(rowId, e)}>
                          <Checkbox
                            checked={isSelected}
                            aria-label={`Select ${tx.invoice_number}`}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowId)) next.delete(rowId);
                                else next.add(rowId);
                                return next;
                              });
                            }}
                          />
                        </TableCell>

                        {/* Applicant (matching registrants-tab Avatar + name/email layout) */}
                        <TableCell onClick={() => handleViewDetail(tx)}>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-full border">
                              <AvatarFallback className="font-medium text-xs">
                                {getInitials(tx.customer_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-foreground text-sm hover:underline">
                                {tx.customer_name || "Anonymous Customer"}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">{tx.customer_email || "No email"}</span>
                                {tx.customer_phone && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Phone className="size-2.5" />
                                    {tx.customer_phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status (matching registrants-tab badge with status dot) */}
                        <TableCell onClick={() => handleViewDetail(tx)}>
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              variant="outline"
                              className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", statusVariant.badgeClass)}
                            >
                              <span className={cn("size-1.5 rounded-full", statusVariant.dotClass)} />
                              {statusVariant.label}
                            </Badge>
                          </div>
                        </TableCell>

                        {/* Invoice # */}
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-[140px] truncate font-bold text-foreground">
                              {tx.invoice_number}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 opacity-60 hover:opacity-100"
                              onClick={(e) => handleCopy(tx.invoice_number, e)}
                              title="Copy Invoice Number"
                            >
                              {copiedInvoice === tx.invoice_number ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="whitespace-nowrap font-bold text-foreground text-xs">
                          Rp {tx.amount.toLocaleString("id-ID")}
                        </TableCell>

                        {/* Method / Issuer */}
                        <TableCell className="whitespace-nowrap text-xs">
                          <Badge variant="outline" className="py-0 font-normal text-[11px]">
                            {tx.issuer || tx.payment_channel || "QRIS"}
                          </Badge>
                        </TableCell>

                        {/* Email Notification */}
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={
                              isEmailSent
                                ? "flex w-fit items-center gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-600 dark:text-emerald-400"
                                : "flex w-fit items-center gap-1 border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400"
                            }
                          >
                            {isEmailSent ? (
                              <>
                                <MailCheck className="size-3" />
                                Sent ✓
                              </>
                            ) : (
                              <>
                                <MailX className="size-3" />
                                Not Sent
                              </>
                            )}
                          </Badge>
                        </TableCell>

                        {/* Transaction Time */}
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {new Date(tx.transaction_date).toLocaleString("en-US", {
                            timeZone: "Asia/Jakarta",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </TableCell>

                        {/* Actions (matching registrants-tab icon-xs buttons) */}
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                              onClick={(e) => handleRowCheckStatus(tx, e)}
                              disabled={isRowChecking}
                              title="Check live DOKU payment status"
                            >
                              <RefreshCw className={`size-3.5 ${isRowChecking ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetail(tx);
                              }}
                              title="View transaction details"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        transaction={selectedTx}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </div>
  );
}
