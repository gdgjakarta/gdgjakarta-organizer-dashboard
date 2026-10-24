"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import Image from "next/image";

import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Info,
  Loader2,
  Paperclip,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatFirestoreDate } from "@/lib/date-utils";
import {
  DEFAULT_REFUND_POLICY_NOTES,
  expandRefundRecords,
  formatRupiah,
  getEventRefundCutoff,
  getRegistrationRefundAmount,
} from "@/lib/events/refund-utils";
import { fetchEventRefundRequestsAction, updateEventRefundConfigAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, RefundStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";

import { ApplicantDetailDialog } from "./applicant-detail-dialog";
import { RefundApprovalDialog } from "./refund-approval-dialog";
import { RefundRejectDialog } from "./refund-reject-dialog";

interface RefundsTabProps {
  event: FirestoreEvent;
  eventId: string;
  registrations?: FirestoreRegistration[];
}

const REFUND_STATUS_META: Record<
  RefundStatus,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  waiting_for_approval: {
    label: "Waiting for Approval",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  refund_completed: {
    label: "Refund Completed",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
};

export function RefundsTab({ event, eventId, registrations: initialRegistrations }: RefundsTabProps) {
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();

  // Refund policy settings state
  const initialCustomNotes = event.refund_policy_notes?.trim();
  const [refundEnabled, setRefundEnabled] = useState<boolean>(event.refund_enabled !== false);
  const [refundIncludeFee, setRefundIncludeFee] = useState<boolean>(Boolean(event.refund_include_fee));
  const [refundCutoffDays, setRefundCutoffDays] = useState<number>(
    typeof event.refund_cutoff_days_before === "number" ? event.refund_cutoff_days_before : 1,
  );
  const [refundCutoffDate, setRefundCutoffDate] = useState<string>(event.refund_cutoff_date ?? "");
  const [refundPolicyNotes, setRefundPolicyNotes] = useState<string>(
    initialCustomNotes && initialCustomNotes.length > 0 ? initialCustomNotes : DEFAULT_REFUND_POLICY_NOTES,
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSettingsCard, setShowSettingsCard] = useState(false);
  const [isPreviewMemberViewOpen, setIsPreviewMemberViewOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [inspectRegistration, setInspectRegistration] = useState<FirestoreRegistration | null>(null);
  const [approvalModalReg, setApprovalModalReg] = useState<FirestoreRegistration | null>(null);
  const [rejectModalReg, setRejectModalReg] = useState<FirestoreRegistration | null>(null);
  const [viewProofModalReg, setViewProofModalReg] = useState<FirestoreRegistration | null>(null);
  const [viewReasonModalReg, setViewReasonModalReg] = useState<FirestoreRegistration | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync event props
  useEffect(() => {
    setRefundEnabled(event.refund_enabled !== false);
    setRefundIncludeFee(Boolean(event.refund_include_fee));
    if (typeof event.refund_cutoff_days_before === "number") {
      setRefundCutoffDays(event.refund_cutoff_days_before);
    }
    if (event.refund_cutoff_date) {
      setRefundCutoffDate(event.refund_cutoff_date);
    }
    const custom = event.refund_policy_notes?.trim();
    if (custom && custom.length > 0) {
      setRefundPolicyNotes(custom);
    } else {
      setRefundPolicyNotes(DEFAULT_REFUND_POLICY_NOTES);
    }
  }, [event]);

  // Load refund requests
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchEventRefundRequestsAction(eventId);
      setRegistrations(data);
    } catch (err) {
      console.error("[RefundsTab] Failed to load refund requests:", err);
      toast.error("Failed to load refund requests.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (initialRegistrations && initialRegistrations.length > 0) {
      const withRefunds = expandRefundRecords(initialRegistrations);
      setRegistrations(withRefunds);
      setIsLoading(false);
    } else {
      void loadData();
    }
  }, [initialRegistrations, loadData]);

  const handleCopy = (text: string, label: string, key?: string) => {
    void navigator.clipboard.writeText(text);
    if (key) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
    toast.success(`Copied ${label} to clipboard.`);
  };

  const handleSavePolicySettings = async () => {
    try {
      setIsSavingSettings(true);
      const res = await updateEventRefundConfigAction(
        eventId,
        {
          refund_enabled: refundEnabled,
          refund_include_fee: refundIncludeFee,
          refund_cutoff_days_before: Number(refundCutoffDays),
          refund_cutoff_date: refundCutoffDate.trim() || null,
          refund_policy_notes: refundPolicyNotes.trim() || null,
        },
        event,
      );

      if (res.success) {
        toast.success("Refund policy configuration saved successfully.");
      } else {
        toast.error(res.error || "Failed to update refund configuration.");
      }
    } catch (err) {
      console.error("[RefundsTab] Save config error:", err);
      toast.error("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const effectivePolicyNotes = refundPolicyNotes.trim() ? refundPolicyNotes.trim() : DEFAULT_REFUND_POLICY_NOTES;

  const effectiveEvent: FirestoreEvent = useMemo(() => {
    return {
      ...event,
      refund_enabled: refundEnabled,
      refund_include_fee: refundIncludeFee,
      refund_cutoff_days_before: refundCutoffDays,
      refund_cutoff_date: refundCutoffDate.trim() ? refundCutoffDate.trim() : undefined,
      refund_policy_notes: effectivePolicyNotes,
    };
  }, [event, refundEnabled, refundIncludeFee, refundCutoffDays, refundCutoffDate, effectivePolicyNotes]);

  const handleExportCsv = () => {
    if (registrations.length === 0) {
      toast.error("No refund requests to export.");
      return;
    }

    const headers = [
      "Attendee Name",
      "Attendee Email",
      "Refund Status",
      "Refund Amount (IDR)",
      "Bank Provider",
      "Account Number",
      "Account Name",
      "Cancellation Reason",
      "Requested At",
      "Completed At",
      "Rejection Reason",
    ];

    const rows = registrations.map((r) => {
      const req = r.refund_request;
      const refundAmt = getRegistrationRefundAmount(r, effectiveEvent);
      return [
        `"${r.member_name.replace(/"/g, '""')}"`,
        `"${r.member_email.replace(/"/g, '""')}"`,
        `"${req?.status ?? ""}"`,
        refundAmt,
        `"${req?.bank_name ?? ""}"`,
        `'${req?.bank_account_number ?? ""}`,
        `"${req?.bank_account_name ?? ""}"`,
        `"${(req?.cancellation_reason ?? "").replace(/"/g, '""')}"`,
        `"${req?.requested_at ?? ""}"`,
        `"${req?.completed_at ?? ""}"`,
        `"${(req?.rejection_reason ?? "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `refund-requests-${eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported refund requests to CSV.");
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = registrations.length;
    const pending = registrations.filter((r) => r.refund_request?.status === "waiting_for_approval").length;
    const completed = registrations.filter((r) => r.refund_request?.status === "refund_completed");
    const completedCount = completed.length;
    const completedAmount = completed.reduce((acc, curr) => acc + getRegistrationRefundAmount(curr, effectiveEvent), 0);
    const rejected = registrations.filter((r) => r.refund_request?.status === "rejected").length;

    return { total, pending, completedCount, completedAmount, rejected };
  }, [registrations, effectiveEvent]);

  // Filtered List
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      const req = r.refund_request;
      if (!req) return false;

      // Status filter
      if (statusFilter !== "all" && req.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = r.member_name.toLowerCase().includes(q);
        const emailMatch = r.member_email.toLowerCase().includes(q);
        const bankMatch = req.bank_name.toLowerCase().includes(q);
        const accMatch = req.bank_account_number.includes(q);
        const accNameMatch = req.bank_account_name.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !bankMatch && !accMatch && !accNameMatch) {
          return false;
        }
      }

      return true;
    });
  }, [registrations, statusFilter, searchQuery]);

  const cutoffInfo = getEventRefundCutoff(event);

  const previewCutoffInfo = useMemo(() => {
    return getEventRefundCutoff(effectiveEvent);
  }, [effectiveEvent]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-xs">Total Requests</CardTitle>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground">Paid waitlist refund claims</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-semibold text-amber-800 text-xs dark:text-amber-200">
              Waiting for Approval
            </CardTitle>
            <Clock className="size-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-amber-700 dark:text-amber-300">{stats.pending}</div>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">Pending organizer disbursement</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-semibold text-emerald-800 text-xs dark:text-emerald-200">
              Completed Refunds
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-emerald-700 dark:text-emerald-300">{stats.completedCount}</div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
              {formatRupiah(stats.completedAmount)} total refunded
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-semibold text-destructive text-xs">Rejected Requests</CardTitle>
            <XCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-destructive">{stats.rejected}</div>
            <p className="text-[11px] text-muted-foreground">Disapproved submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Policy & Deadline Info Bar / Configuration Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-semibold text-sm">
              <Settings className="size-4 text-primary" />
              Event Refund Settings & Cutoff Policy
            </CardTitle>
            <CardDescription className="text-xs">
              Configure attendee submission eligibility windows and rules
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMemberViewOpen(true)}
              className="h-8 gap-1.5 font-medium text-xs"
            >
              <Eye className="size-3.5 text-primary" />
              Preview Member View
            </Button>
            <Badge
              variant="outline"
              className={cn(
                "font-medium text-xs",
                refundEnabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-muted-foreground/40 text-muted-foreground",
              )}
            >
              {refundEnabled ? "Refunds Enabled" : "Refunds Disabled"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "font-medium text-xs",
                refundIncludeFee
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-border text-muted-foreground",
              )}
            >
              {refundIncludeFee ? "Fee Included in Refund" : "Ticket Deposit Only (No Fee)"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsCard(!showSettingsCard)}
              className="h-8 gap-1 text-xs"
            >
              {showSettingsCard ? "Hide Settings" : "Configure"}
            </Button>
          </div>
        </CardHeader>

        {showSettingsCard ? (
          <CardContent className="space-y-4 border-border/50 border-t pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="toggleRefund" className="font-semibold text-xs">
                    Accept Refund Requests
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Allow paid waitlisted attendees to submit claims</p>
                </div>
                <Switch id="toggleRefund" checked={refundEnabled} onCheckedChange={setRefundEnabled} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="toggleRefundIncludeFee" className="font-semibold text-xs">
                    Include Fee in Deposit Refund
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    When disabled (default), only refund ticket deposit without payment gateway fee
                  </p>
                </div>
                <Switch id="toggleRefundIncludeFee" checked={refundIncludeFee} onCheckedChange={setRefundIncludeFee} />
              </div>

              <div className="space-y-1.5 rounded-lg border border-border p-3">
                <Label htmlFor="cutoffDays" className="font-semibold text-xs">
                  Cutoff Days Before Event Day
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="cutoffDays"
                    type="number"
                    min="0"
                    max="30"
                    value={refundCutoffDays}
                    onChange={(e) => setRefundCutoffDays(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                  <span className="whitespace-nowrap text-muted-foreground text-xs">days before</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  e.g. 1 means refunds close 1 day prior to event start date.
                </p>
              </div>

              <div className="space-y-1.5 rounded-lg border border-border p-3">
                <Label htmlFor="cutoffDate" className="font-semibold text-xs">
                  Fixed Cutoff Date & Time (Optional)
                </Label>
                <Input
                  id="cutoffDate"
                  type="datetime-local"
                  value={refundCutoffDate ? refundCutoffDate.slice(0, 16) : ""}
                  onChange={(e) => setRefundCutoffDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">Overrides days setting if specified.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="policyNotes" className="font-semibold text-xs">
                  Custom Refund Policy Guidelines (Optional)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewMemberViewOpen(true)}
                  className="h-6 gap-1 text-[11px] text-primary"
                >
                  <Eye className="size-3" />
                  Live Preview
                </Button>
              </div>
              <Textarea
                id="policyNotes"
                placeholder={DEFAULT_REFUND_POLICY_NOTES}
                value={refundPolicyNotes}
                onChange={(e) => setRefundPolicyNotes(e.target.value)}
                rows={2}
                className="resize-none text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Default: &ldquo;{DEFAULT_REFUND_POLICY_NOTES}&rdquo;</p>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewMemberViewOpen(true)}
                className="gap-1.5 font-medium text-xs"
              >
                <Eye className="size-3.5 text-primary" />
                Preview Member View
              </Button>
              <Button
                size="sm"
                onClick={handleSavePolicySettings}
                disabled={isSavingSettings}
                className="gap-1.5 text-xs"
              >
                {isSavingSettings && <Loader2 className="size-3.5 animate-spin" />}
                Save Policy Configuration
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent className="border-border/50 border-t pt-3 pb-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
              <span>
                <strong>Active Window: </strong>
                {cutoffInfo.deadlineDescription}
              </span>
              <span className="max-w-md truncate">
                <strong>Policy Guidelines: </strong>
                <span className="text-foreground italic">
                  &ldquo;
                  {event.refund_policy_notes?.trim() ? event.refund_policy_notes.trim() : DEFAULT_REFUND_POLICY_NOTES}
                  &rdquo;
                </span>
              </span>
              <span>
                <strong>Cutoff Rule: </strong>
                {event.refund_cutoff_date
                  ? `Specific deadline (${cutoffInfo.formattedCutoff})`
                  : `${refundCutoffDays} day(s) before event start date`}
              </span>
              <span>
                <strong>Deposit Refund Nominal: </strong>
                <span className="font-medium text-foreground">
                  {event.refund_include_fee ? "Includes Payment Gateway Fee" : "Ticket Deposit Only (No Fee)"}
                </span>
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Search & Actions Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by attendee, bank, or account #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Statuses ({registrations.length})
              </SelectItem>
              <SelectItem value="waiting_for_approval" className="text-xs">
                Waiting for Approval ({stats.pending})
              </SelectItem>
              <SelectItem value="refund_completed" className="text-xs">
                Completed ({stats.completedCount})
              </SelectItem>
              <SelectItem value="rejected" className="text-xs">
                Rejected ({stats.rejected})
              </SelectItem>
            </SelectContent>
          </Select>

          {Boolean(searchQuery || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="h-9 px-2 text-muted-foreground text-xs hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={registrations.length === 0}
            className="h-9 gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => startRefresh(() => loadData())}
            disabled={isRefreshing || isLoading}
            className="h-9 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
          >
            <RefreshCw className={cn("size-3.5", (isRefreshing || isLoading) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Requests Table */}
      <Card className="overflow-hidden border border-border/80 shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[220px] py-3.5 pl-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Attendee
                </TableHead>
                <TableHead className="w-[140px] py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Deposit Amount
                </TableHead>
                <TableHead className="w-[260px] py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Payee Bank Details
                </TableHead>
                <TableHead className="min-w-[220px] max-w-[280px] py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Cancellation Reason & Proof
                </TableHead>
                <TableHead className="w-[130px] py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Requested At
                </TableHead>
                <TableHead className="w-[160px] py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-[120px] py-3.5 pr-4 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <span className="text-xs">Loading refund requests...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredRegistrations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <CreditCard className="size-8 opacity-40" />
                      <p className="font-semibold text-foreground text-sm">No Refund Requests</p>
                      <p className="text-xs">
                        {searchQuery || statusFilter !== "all"
                          ? "No requests matching the selected filters."
                          : "No attendees have submitted a refund request for this event yet."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                filteredRegistrations.map((reg) => {
                  const req = reg.refund_request;
                  if (!req) return null;

                  const meta = REFUND_STATUS_META[req.status] ?? REFUND_STATUS_META.waiting_for_approval;
                  const isPending = req.status === "waiting_for_approval";
                  const isCompleted = req.status === "refund_completed";
                  const isRejected = req.status === "rejected";

                  return (
                    <TableRow
                      key={reg.id}
                      className="border-b border-border/60 text-xs transition-colors hover:bg-muted/30"
                    >
                      {/* Attendee */}
                      <TableCell className="py-3.5 pl-4 align-top">
                        <button
                          type="button"
                          className="group flex w-full cursor-pointer items-center gap-2.5 text-left"
                          onClick={() => setInspectRegistration(reg)}
                          title="View application dossier"
                        >
                          <Avatar className="size-8.5 shrink-0 border border-border/70 shadow-2xs transition-transform group-hover:scale-105">
                            <AvatarImage src={reg.member_avatar} alt={reg.member_name} />
                            <AvatarFallback className="bg-primary/10 font-semibold text-[10px] text-primary">
                              {getInitials(reg.member_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 truncate">
                            <p className="truncate font-semibold text-foreground text-xs transition-colors group-hover:text-primary">
                              {reg.member_name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">{reg.member_email}</p>
                          </div>
                        </button>
                      </TableCell>

                      {/* Deposit Amount */}
                      <TableCell className="py-3.5 align-top font-medium">
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-xs tabular-nums">
                            {formatRupiah(getRegistrationRefundAmount(reg, effectiveEvent))}
                          </p>
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 font-normal text-[10px] text-muted-foreground"
                          >
                            {reg.ticket_name || reg.ticket_tier || "Commitment Fee"}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Bank Details */}
                      <TableCell className="py-3.5 align-top">
                        <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{req.bank_name}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1 rounded border border-border/40 bg-background/80 px-2 py-0.5">
                            <span className="truncate font-mono font-medium text-[11px] tracking-tight text-foreground">
                              {req.bank_account_number}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                              title="Copy account number"
                              onClick={() => handleCopy(req.bank_account_number, "Account Number", `acc-${reg.id}`)}
                            >
                              {copiedKey === `acc-${reg.id}` ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center justify-between gap-1 px-0.5 text-[11px] text-muted-foreground">
                            <span className="truncate">
                              a/n <span className="font-medium text-foreground">{req.bank_account_name}</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                              title="Copy account holder name"
                              onClick={() => handleCopy(req.bank_account_name, "Account Holder Name", `name-${reg.id}`)}
                            >
                              {copiedKey === `name-${reg.id}` ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </TableCell>

                      {/* Cancellation Reason & Proof */}
                      <TableCell className="min-w-[220px] max-w-[280px] whitespace-normal py-3.5 align-top">
                        <div className="space-y-1.5">
                          <p
                            className="wrap-break-word whitespace-normal text-foreground text-xs leading-relaxed"
                            title={req.cancellation_reason}
                          >
                            {req.cancellation_reason || (
                              <span className="text-muted-foreground italic">No cancellation reason provided.</span>
                            )}
                          </p>
                          {req.proof_media_url && (
                            <a
                              href={req.proof_media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-0.5 font-medium text-[11px] text-foreground shadow-2xs transition-colors hover:bg-muted"
                              title="Open attendee's submitted cancellation document"
                            >
                              <Paperclip className="size-3 text-muted-foreground" />
                              <span>Attendee Proof</span>
                              <ExternalLink className="ml-0.5 size-2.5 opacity-60" />
                            </a>
                          )}
                        </div>
                      </TableCell>

                      {/* Requested At */}
                      <TableCell className="py-3.5 align-top text-muted-foreground">
                        <div className="space-y-0.5 text-xs">
                          <p className="font-medium text-foreground">
                            {formatFirestoreDate(req.requested_at, "dd MMM yyyy", "—")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatFirestoreDate(req.requested_at, "HH:mm", "")} WIB
                          </p>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3.5 align-top">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-[11px] shadow-2xs",
                            meta.badgeClass,
                          )}
                        >
                          <meta.icon className="size-3.5 shrink-0" />
                          <span>{meta.label}</span>
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 pr-4 text-right align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="size-7.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            onClick={() => setInspectRegistration(reg)}
                            title="View attendee application dossier"
                            aria-label="View attendee application dossier"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                size="icon-sm"
                                className="size-7.5 bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                                onClick={() => setApprovalModalReg(reg)}
                                title="Approve refund request"
                                aria-label="Approve refund request"
                              >
                                <CheckCircle2 className="size-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="size-7.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setRejectModalReg(reg)}
                                title="Reject refund request"
                                aria-label="Reject refund request"
                              >
                                <XCircle className="size-3.5" />
                              </Button>
                            </>
                          )}

                          {isCompleted && req.completion_proof_url && (
                            <Button
                              variant="outline"
                              size="icon-sm"
                              className="size-7.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                              onClick={() => setViewProofModalReg(reg)}
                              title="View disbursement transfer receipt"
                              aria-label="View disbursement transfer receipt"
                            >
                              <Receipt className="size-3.5" />
                            </Button>
                          )}

                          {isRejected && (
                            <Button
                              variant="outline"
                              size="icon-sm"
                              className="size-7.5 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                              onClick={() => setViewReasonModalReg(reg)}
                              title="View rejection reason"
                              aria-label="View rejection reason"
                            >
                              <AlertCircle className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Approval Dialog */}
      {approvalModalReg && (
        <RefundApprovalDialog
          isOpen={Boolean(approvalModalReg)}
          onOpenChange={(open) => !open && setApprovalModalReg(null)}
          registration={approvalModalReg}
          event={effectiveEvent}
          eventId={eventId}
          eventTitle={event.title}
          onSuccess={(updated) => {
            setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setInspectRegistration((prev) => (prev?.id === updated.id ? updated : prev));
            setApprovalModalReg(null);
          }}
        />
      )}

      {/* Reject Dialog */}
      {rejectModalReg && (
        <RefundRejectDialog
          isOpen={Boolean(rejectModalReg)}
          onOpenChange={(open) => !open && setRejectModalReg(null)}
          registration={rejectModalReg}
          event={effectiveEvent}
          eventId={eventId}
          onSuccess={(updated) => {
            setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setInspectRegistration((prev) => (prev?.id === updated.id ? updated : prev));
            setRejectModalReg(null);
          }}
        />
      )}

      {/* Organizer Proof Preview Modal */}
      {viewProofModalReg?.refund_request && (
        <Dialog open={Boolean(viewProofModalReg)} onOpenChange={(open) => !open && setViewProofModalReg(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Completed Refund Transfer Proof</DialogTitle>
              <DialogDescription className="text-xs">
                Disbursement to {viewProofModalReg.member_name} (
                {formatRupiah(getRegistrationRefundAmount(viewProofModalReg, effectiveEvent))})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1 rounded border bg-muted/20 p-2.5 text-xs">
                <p>
                  <strong>Bank:</strong> {viewProofModalReg.refund_request.bank_name} -{" "}
                  {viewProofModalReg.refund_request.bank_account_number} (
                  {viewProofModalReg.refund_request.bank_account_name})
                </p>
                {viewProofModalReg.refund_request.completed_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Completed at:{" "}
                    {formatFirestoreDate(viewProofModalReg.refund_request.completed_at, "dd MMM yyyy, HH:mm", "—")}
                  </p>
                )}
                {viewProofModalReg.refund_request.completion_notes && (
                  <p className="text-[11px]">
                    <strong>Notes:</strong> {viewProofModalReg.refund_request.completion_notes}
                  </p>
                )}
              </div>

              {viewProofModalReg.refund_request.completion_proof_url && (
                <div className="overflow-hidden rounded border border-border">
                  <Image
                    src={viewProofModalReg.refund_request.completion_proof_url}
                    alt="Disbursement receipt"
                    width={600}
                    height={400}
                    unoptimized
                    className="max-h-72 w-full bg-background object-contain"
                  />
                  <div className="border-t p-2 text-right">
                    <a
                      href={viewProofModalReg.refund_request.completion_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary text-xs hover:underline"
                    >
                      Open receipt in new tab <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setViewProofModalReg(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Organizer Rejection Reason View Modal */}
      {viewReasonModalReg?.refund_request && (
        <Dialog open={Boolean(viewReasonModalReg)} onOpenChange={(open) => !open && setViewReasonModalReg(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Rejection Reason</DialogTitle>
              <DialogDescription className="text-xs">
                Feedback provided to {viewReasonModalReg.member_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
                <p className="font-semibold text-destructive">Explanation:</p>
                <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {viewReasonModalReg.refund_request.rejection_reason || "No explanation recorded."}
                </p>
                {viewReasonModalReg.refund_request.rejected_at && (
                  <p className="pt-1 text-[10px] text-muted-foreground">
                    Rejected on{" "}
                    {formatFirestoreDate(viewReasonModalReg.refund_request.rejected_at, "dd MMM yyyy, HH:mm", "—")}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setViewReasonModalReg(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Live Member View Preview Modal */}
      <Dialog open={isPreviewMemberViewOpen} onOpenChange={setIsPreviewMemberViewOpen}>
        <DialogContent className="max-h-[90vh] w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-6 md:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[11px] text-primary">
                Live Member Preview
              </Badge>
            </div>
            <DialogTitle className="text-base sm:text-lg">Refund Policy & Member Experience Preview</DialogTitle>
            <DialogDescription className="text-xs">
              Preview how attendees see the refund policy, cutoff notices, and cancellation warnings across different
              views in the member portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <Tabs defaultValue="event-details" className="w-full">
              <TabsList className="grid h-auto min-h-9 w-full grid-cols-3 gap-1 p-1 text-xs">
                <TabsTrigger
                  value="event-details"
                  className="whitespace-normal px-2 py-1.5 text-center text-xs leading-tight"
                >
                  1. Event Page
                </TabsTrigger>
                <TabsTrigger
                  value="my-events"
                  className="whitespace-normal px-2 py-1.5 text-center text-xs leading-tight"
                >
                  2. My Events Card
                </TabsTrigger>
                <TabsTrigger value="dialog" className="whitespace-normal px-2 py-1.5 text-center text-xs leading-tight">
                  3. Refund Dialog
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Event Details Page View */}
              <TabsContent value="event-details" className="space-y-3 pt-3">
                <p className="text-[11px] text-muted-foreground">
                  On the member event details page sidebar, attendees see this refund card below their ticket details:
                </p>
                <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b pb-3">
                    <span className="font-semibold text-foreground text-xs">Your Registration Status</span>
                    <Badge className="bg-indigo-600 text-[10px]">Priority Waitlist</Badge>
                  </div>

                  <div className="space-y-2">
                    <Button disabled className="h-9 w-full cursor-default gap-1.5 text-xs opacity-90">
                      Request Commitment Fee Refund 💸
                    </Button>
                    <div className="space-y-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs">
                      <p className="font-semibold text-indigo-900 text-xs dark:text-indigo-200">
                        📋 Refund Policy & Window
                      </p>
                      <p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground leading-relaxed">
                        {effectivePolicyNotes}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 font-medium text-[11px] text-indigo-700 dark:text-indigo-300">
                        <Clock className="size-3 shrink-0" />
                        <span>{previewCutoffInfo.deadlineDescription}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: My Events Card View */}
              <TabsContent value="my-events" className="space-y-3 pt-3">
                <p className="text-[11px] text-muted-foreground">
                  On the &quot;My Events&quot; dashboard tab, attendees see an inline refund eligibility banner:
                </p>
                <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xs">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-xs">{event.title}</span>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-indigo-500/40 text-[10px] text-indigo-600 dark:text-indigo-400"
                    >
                      Refund Eligible
                    </Badge>
                  </div>
                  <div className="space-y-2 rounded-md border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">
                        💸 {previewCutoffInfo.deadlineDescription}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Until {previewCutoffInfo.formattedCutoff}
                      </span>
                    </div>
                    <p className="break-words text-[11px] text-muted-foreground leading-relaxed">
                      📋 {effectivePolicyNotes}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3.5 h-8 w-full cursor-default text-xs">
                    View Details & Request Refund
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 3: Attendee Request Dialog */}
              <TabsContent value="dialog" className="space-y-3 pt-3">
                <p className="text-[11px] text-muted-foreground">
                  When the attendee clicks &quot;Request Refund&quot;, they are shown the full cancellation warning and
                  policy agreement:
                </p>
                <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs">
                  {/* Warning Alert */}
                  <Alert
                    variant="destructive"
                    className="border-destructive/40 bg-destructive/10 text-destructive text-xs"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    <AlertTitle className="font-semibold text-xs">RSVP Cancellation Warning</AlertTitle>
                    <AlertDescription className="text-[11px] leading-relaxed">
                      Submitting this refund request will <strong>cancel your RSVP</strong> and release your
                      registration. You will <strong>no longer be able to attend or join the event</strong>.
                    </AlertDescription>
                  </Alert>

                  {/* Policy Notes */}
                  <div className="space-y-1.5 rounded-lg border border-border/80 bg-muted/40 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Info className="size-3.5 text-primary" />
                      <span>Refund Policy & Disbursement Guidelines</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground leading-relaxed">
                      {effectivePolicyNotes}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-border/50 border-t pt-1.5 text-[10px] text-muted-foreground">
                      <span>Cutoff Deadline: {previewCutoffInfo.formattedCutoff}</span>
                      <span>
                        Refund Nominal:{" "}
                        <strong className="text-foreground">
                          {refundIncludeFee ? "With gateway fee" : "Deposit only (no fee)"}
                        </strong>
                      </span>
                      <span>Policy Status: {refundEnabled ? "Active" : "Disabled"}</span>
                    </div>
                  </div>

                  {/* Checkbox preview */}
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
                    <Checkbox checked disabled className="mt-0.5 shrink-0 cursor-default" />
                    <Label className="block cursor-default font-normal text-foreground text-xs leading-relaxed">
                      I understand and agree that submitting this refund request will{" "}
                      <strong className="font-semibold text-destructive">cancel my RSVP</strong> and I will{" "}
                      <strong className="font-semibold text-foreground">forfeit my spot</strong> to join this event.{" "}
                      <span className="font-bold text-destructive">*</span>
                    </Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 border-border/50 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>💡 Preview updates live as you edit the policy text above.</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsPreviewMemberViewOpen(false)} className="text-xs">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redesigned Applicant Details Dossier Dialog */}
      {inspectRegistration && (
        <ApplicantDetailDialog
          registration={inspectRegistration}
          event={effectiveEvent}
          isCurationMode={event.curation_mode}
          customQuestions={event.custom_questions}
          onClose={() => setInspectRegistration(null)}
          onStatusChange={(regId, newStatus) => {
            setRegistrations((prev) => prev.map((r) => (r.id === regId ? { ...r, status: newStatus } : r)));
            setInspectRegistration((prev) => (prev?.id === regId ? { ...prev, status: newStatus } : prev));
          }}
          onApproveRefund={(reg) => {
            setApprovalModalReg(reg);
          }}
          onRejectRefund={(reg) => {
            setRejectModalReg(reg);
          }}
        />
      )}
    </div>
  );
}
