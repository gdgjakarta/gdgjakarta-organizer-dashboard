"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import Image from "next/image";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatFirestoreDate } from "@/lib/date-utils";
import { formatRupiah, getEventRefundCutoff } from "@/lib/events/refund-utils";
import { fetchEventRefundRequestsAction, updateEventRefundConfigAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration, RefundStatus } from "@/lib/firestore/types";
import { cn, getInitials } from "@/lib/utils";

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
  const [refundEnabled, setRefundEnabled] = useState<boolean>(event.refund_enabled !== false);
  const [refundCutoffDays, setRefundCutoffDays] = useState<number>(
    typeof event.refund_cutoff_days_before === "number" ? event.refund_cutoff_days_before : 1,
  );
  const [refundCutoffDate, setRefundCutoffDate] = useState<string>(event.refund_cutoff_date ?? "");
  const [refundPolicyNotes, setRefundPolicyNotes] = useState<string>(event.refund_policy_notes ?? "");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSettingsCard, setShowSettingsCard] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [approvalModalReg, setApprovalModalReg] = useState<FirestoreRegistration | null>(null);
  const [rejectModalReg, setRejectModalReg] = useState<FirestoreRegistration | null>(null);
  const [viewProofModalReg, setViewProofModalReg] = useState<FirestoreRegistration | null>(null);
  const [viewReasonModalReg, setViewReasonModalReg] = useState<FirestoreRegistration | null>(null);

  // Sync event props
  useEffect(() => {
    setRefundEnabled(event.refund_enabled !== false);
    if (typeof event.refund_cutoff_days_before === "number") {
      setRefundCutoffDays(event.refund_cutoff_days_before);
    }
    if (event.refund_cutoff_date) {
      setRefundCutoffDate(event.refund_cutoff_date);
    }
    if (event.refund_policy_notes) {
      setRefundPolicyNotes(event.refund_policy_notes);
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
      const withRefunds = initialRegistrations.filter((r) => Boolean(r.refund_request));
      setRegistrations(withRefunds);
      setIsLoading(false);
    } else {
      void loadData();
    }
  }, [initialRegistrations, loadData]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard.`);
  };

  const handleSavePolicySettings = async () => {
    try {
      setIsSavingSettings(true);
      const res = await updateEventRefundConfigAction(
        eventId,
        {
          refund_enabled: refundEnabled,
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
      return [
        `"${r.member_name.replace(/"/g, '""')}"`,
        `"${r.member_email.replace(/"/g, '""')}"`,
        `"${req?.status ?? ""}"`,
        req?.refund_amount ?? 0,
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
    const completedAmount = completed.reduce((acc, curr) => acc + (curr.refund_request?.refund_amount ?? 0), 0);
    const rejected = registrations.filter((r) => r.refund_request?.status === "rejected").length;

    return { total, pending, completedCount, completedAmount, rejected };
  }, [registrations]);

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="toggleRefund" className="font-semibold text-xs">
                    Accept Refund Requests
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Allow paid waitlisted attendees to submit claims</p>
                </div>
                <Switch id="toggleRefund" checked={refundEnabled} onCheckedChange={setRefundEnabled} />
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

              <div className="space-y-1.5 rounded-lg border border-border p-3 sm:col-span-2 lg:col-span-1">
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
              <Label htmlFor="policyNotes" className="font-semibold text-xs">
                Custom Refund Policy Guidelines (Optional)
              </Label>
              <Textarea
                id="policyNotes"
                placeholder="e.g. Commitment deposit will be refunded via bank transfer within 3-5 business days."
                value={refundPolicyNotes}
                onChange={(e) => setRefundPolicyNotes(e.target.value)}
                rows={2}
                className="resize-none text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
              <span>
                <strong>Active Window: </strong>
                {cutoffInfo.deadlineDescription}
              </span>
              <span>
                <strong>Cutoff Rule: </strong>
                {event.refund_cutoff_date
                  ? `Specific deadline (${cutoffInfo.formattedCutoff})`
                  : `${refundCutoffDays} day(s) before event start date`}
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
            <SelectTrigger className="h-9 w-[180px] text-xs">
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
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[200px] font-semibold text-xs">Attendee</TableHead>
                <TableHead className="font-semibold text-xs">Deposit Amount</TableHead>
                <TableHead className="font-semibold text-xs">Payee Bank Details</TableHead>
                <TableHead className="font-semibold text-xs">Cancellation Reason & Proof</TableHead>
                <TableHead className="font-semibold text-xs">Requested At</TableHead>
                <TableHead className="font-semibold text-xs">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs">Actions</TableHead>
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
                    <TableRow key={reg.id} className="text-xs transition-colors hover:bg-muted/30">
                      {/* Attendee */}
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 border">
                            <AvatarImage src={reg.member_avatar} alt={reg.member_name} />
                            <AvatarFallback className="text-[10px]">{getInitials(reg.member_name)}</AvatarFallback>
                          </Avatar>
                          <div className="truncate">
                            <p className="truncate font-semibold text-foreground">{reg.member_name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{reg.member_email}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Deposit Amount */}
                      <TableCell className="align-top font-medium">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">{formatRupiah(req.refund_amount)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {reg.ticket_name || reg.ticket_tier || "Commitment Fee"}
                          </p>
                        </div>
                      </TableCell>

                      {/* Bank Details */}
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Building2 className="size-3.5 shrink-0 text-primary" />
                            <span>{req.bank_name}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <span>{req.bank_account_number}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(req.bank_account_number, "Account Number")}
                              className="text-primary hover:opacity-75"
                              title="Copy account number"
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span>a/n {req.bank_account_name}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(req.bank_account_name, "Account Holder Name")}
                              className="text-primary hover:opacity-75"
                              title="Copy account name"
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>
                        </div>
                      </TableCell>

                      {/* Cancellation Reason & Proof */}
                      <TableCell className="max-w-[220px] align-top">
                        <div className="space-y-1">
                          <p
                            className="line-clamp-2 text-foreground text-xs leading-relaxed"
                            title={req.cancellation_reason}
                          >
                            {req.cancellation_reason}
                          </p>
                          {req.proof_media_url && (
                            <a
                              href={req.proof_media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[11px] text-primary hover:underline"
                            >
                              <FileText className="size-3" />
                              <span>View Attendee Proof ↗</span>
                            </a>
                          )}
                        </div>
                      </TableCell>

                      {/* Requested At */}
                      <TableCell className="align-top text-muted-foreground">
                        <div className="space-y-0.5 text-[11px]">
                          <p>{formatFirestoreDate(req.requested_at, "dd MMM yyyy", "—")}</p>
                          <p className="text-[10px] opacity-75">{formatFirestoreDate(req.requested_at, "HH:mm", "")}</p>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="align-top">
                        <Badge variant="outline" className={cn("gap-1 font-semibold text-[10px]", meta.badgeClass)}>
                          <meta.icon className="size-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700"
                                onClick={() => setApprovalModalReg(reg)}
                              >
                                <CheckCircle2 className="size-3" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 border-destructive/40 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setRejectModalReg(reg)}
                              >
                                <XCircle className="size-3" />
                                Reject
                              </Button>
                            </>
                          )}

                          {isCompleted && req.completion_proof_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] text-emerald-700 dark:text-emerald-300"
                              onClick={() => setViewProofModalReg(reg)}
                            >
                              <CheckCircle2 className="size-3" />
                              View Proof
                            </Button>
                          )}

                          {isRejected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                              onClick={() => setViewReasonModalReg(reg)}
                            >
                              <AlertCircle className="size-3" />
                              View Reason
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
          eventId={eventId}
          eventTitle={event.title}
          onSuccess={(updated) => {
            setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
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
          eventId={eventId}
          onSuccess={(updated) => {
            setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setRejectModalReg(null);
          }}
        />
      )}

      {/* Organizer Proof Preview Modal */}
      {viewProofModalReg?.refund_request && (
        <Dialog open={Boolean(viewProofModalReg)} onOpenChange={(open) => !open && setViewProofModalReg(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Completed Refund Transfer Proof</DialogTitle>
              <DialogDescription className="text-xs">
                Disbursement to {viewProofModalReg.member_name} (
                {formatRupiah(viewProofModalReg.refund_request.refund_amount)})
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
          <DialogContent className="max-w-md">
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
    </div>
  );
}
