"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { useSearchParams } from "next/navigation";

import {
  AlertCircle,
  Building2,
  Calendar,
  Download,
  KeyRound,
  Lock,
  Percent,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { PublicPartnerVoucherReport } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";
import { getPartnerVoucherReportAction } from "@/server/voucher-partner-actions";

interface PartnerVoucherReportViewProps {
  shareToken: string;
}

export function PartnerVoucherReportView({ shareToken }: PartnerVoucherReportViewProps) {
  const searchParams = useSearchParams();
  const urlCode = searchParams.get("code") || "";

  const [accessCode, setAccessCode] = useState(urlCode);
  const [report, setReport] = useState<PublicPartnerVoucherReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_requiresCode, setRequiresCode] = useState(false);
  const [isLoading, startTransition] = useTransition();

  // Search filter inside table
  const [searchQuery, setSearchQuery] = useState("");

  const loadReport = useCallback(
    (codeToUse: string) => {
      setError(null);
      startTransition(async () => {
        try {
          // 1. Try server action first
          const res = await getPartnerVoucherReportAction(shareToken, codeToUse);
          if (res.success) {
            setReport(res.report);
            setRequiresCode(false);
            return;
          }

          // 2. If server action failed or server had network/DNS issues (e.g. ENOTFOUND in local dev),
          // fallback to client Firebase SDK getDoc (Firestore rules allow direct public GET)
          try {
            const { getPublicPartnerVoucherReport } = await import("@/lib/firestore/client");
            const clientRes = await getPublicPartnerVoucherReport(shareToken, codeToUse);
            if (clientRes.success) {
              setReport(clientRes.report);
              setRequiresCode(false);
              return;
            }
            setError(clientRes.error);
            setRequiresCode(Boolean(clientRes.requiresCode));
            setReport(null);
            return;
          } catch {
            // fallback to original error
          }

          setError(res.error);
          setRequiresCode(Boolean(res.requiresCode));
          setReport(null);
        } catch (err) {
          console.error("Failed to load partner report via server action, attempting client fallback:", err);
          try {
            const { getPublicPartnerVoucherReport } = await import("@/lib/firestore/client");
            const clientRes = await getPublicPartnerVoucherReport(shareToken, codeToUse);
            if (clientRes.success) {
              setReport(clientRes.report);
              setRequiresCode(false);
              return;
            }
            setError(clientRes.error);
            setRequiresCode(Boolean(clientRes.requiresCode));
            setReport(null);
          } catch (clientErr) {
            console.error("Client fallback also failed:", clientErr);
            setError("An unexpected error occurred while fetching report.");
          }
        }
      });
    },
    [shareToken],
  );

  useEffect(() => {
    loadReport(urlCode);
  }, [urlCode, loadReport]);

  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      toast.error("Please enter the partner access code.");
      return;
    }
    loadReport(accessCode.trim());
  };

  // Filter redemptions
  const filteredRedemptions = useMemo(() => {
    if (!report?.redemptions) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return report.redemptions;

    return report.redemptions.filter((r) => {
      const name = r.masked_name.toLowerCase();
      const email = r.masked_email.toLowerCase();
      const ticket = (r.ticket_name || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      return name.includes(q) || email.includes(q) || ticket.includes(q) || status.includes(q);
    });
  }, [report, searchQuery]);

  const handleExportMaskedCsv = () => {
    if (!report || report.redemptions.length === 0) {
      toast.info("No redemption data to export.");
      return;
    }

    const headers = [
      "Sequence ID",
      "Redeemed Date",
      "Attendee (Masked)",
      "Email (Masked)",
      "Ticket / Package",
      "Status",
      "Discount Applied",
    ];

    const rows = report.redemptions.map((r) => [
      `"${r.id}"`,
      `"${new Date(r.registered_at).toLocaleString("id-ID")}"`,
      `"${r.masked_name}"`,
      `"${r.masked_email}"`,
      `"${r.ticket_name || "General Pass"}"`,
      `"${r.status}"`,
      `"${r.discount_amount ? `Rp ${r.discount_amount.toLocaleString("id-ID")}` : "-"}"`,
    ]);

    const csvContent = `data:text/csv;charset=utf-8,${[headers.join(","), ...rows.map((e) => e.join(","))].join("\n")}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `partner-report-${report.voucher_display_code.replace(/[^A-Za-z0-9]/g, "")}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Masked partner report downloaded.");
  };

  // Gate view: Requires access code or invalid link
  if (!report) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16">
        <Card className="w-full border-border/80 shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <CardTitle className="font-bold text-xl">Partner Voucher Report</CardTitle>
            <CardDescription className="text-xs">
              This live report is protected. Please enter the partner access code provided by GDG Jakarta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-xs">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="access-code" className="font-medium text-xs">
                  Access Code
                </Label>
                <div className="relative">
                  <KeyRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="access-code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="e.g. GDG-123456"
                    className="pl-9 font-mono text-sm uppercase tracking-wider"
                    autoFocus
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" /> Unlock Report
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
              <span>Personal data (emails and names) is masked server-side to safeguard attendee privacy.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Event & Partner Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 border-primary/30 bg-primary/10 font-semibold text-primary text-xs"
              >
                <Building2 className="size-3" /> Partner Live Portal
              </Badge>
              {report.partner_name && (
                <Badge variant="secondary" className="font-medium text-xs">
                  {report.partner_name}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] capitalize",
                  report.status === "active"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-muted bg-muted/40 text-muted-foreground",
                )}
              >
                {report.status}
              </Badge>
            </div>

            <h1 className="font-extrabold text-2xl text-foreground tracking-tight sm:text-3xl">{report.event_title}</h1>

            {report.event_start_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Calendar className="size-3.5 text-primary" />
                <span>
                  {new Date(report.event_start_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Voucher promo badge */}
          <div className="flex flex-col items-start gap-1.5 rounded-xl border bg-muted/30 p-3.5 md:items-end">
            <div className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
              {report.is_code_masked ? "Voucher Reference (Masked)" : "Voucher Promo Code"}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-mono text-base text-foreground tracking-wider sm:text-lg">
                {report.voucher_display_code}
              </span>
              <Badge className="bg-primary font-bold text-primary-foreground text-xs">{report.discount_display}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Redemptions */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-medium text-xs">Redemptions Used</span>
              <UserCheck className="size-4 text-primary" />
            </div>
            <div className="font-extrabold text-2xl text-foreground">
              {report.times_used}
              {report.usage_limit ? (
                <span className="font-normal text-muted-foreground text-xs"> / {report.usage_limit}</span>
              ) : (
                <span className="font-normal text-muted-foreground text-xs"> (Unlimited)</span>
              )}
            </div>
            {report.usage_limit ? <Progress value={report.percent_used} className="mt-2 h-1.5" /> : null}
          </CardContent>
        </Card>

        {/* Quota Progress */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-medium text-xs">Quota Utilized</span>
              <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="font-extrabold text-2xl text-foreground">
              {report.usage_limit ? `${report.percent_used}%` : "Active"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {report.usage_limit
                ? `${Math.max(0, report.usage_limit - report.times_used)} redemptions remaining`
                : "No maximum limit set"}
            </p>
          </CardContent>
        </Card>

        {/* Total Discount Value Provided */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-medium text-xs">Total Discount Subsidized</span>
              <Percent className="size-4 text-primary" />
            </div>
            <div className="font-extrabold text-2xl text-foreground">
              {report.total_discount_given > 0
                ? `Rp ${report.total_discount_given.toLocaleString("id-ID")}`
                : report.discount_display}
            </div>
            <p className="text-[11px] text-muted-foreground">Value applied to registrants</p>
          </CardContent>
        </Card>

        {/* Scope Coverage */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-medium text-xs">Discount Scope</span>
              <Ticket className="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="font-bold text-foreground text-lg capitalize">
              {report.applies_to === "all" ? "All Cart Items" : `${report.applies_to} Only`}
            </div>
            <p className="text-[11px] text-muted-foreground">Applies during checkout</p>
          </CardContent>
        </Card>
      </div>

      {/* Redemptions Table Card */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="font-bold text-base sm:text-lg">Attendee Redemptions</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {report.redemptions.length} records
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Real-time audit list of claims. Sensitive PII is masked server-side to comply with data privacy policies.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search masked attendees..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMaskedCsv}
              disabled={report.redemptions.length === 0}
              className="h-8 shrink-0 gap-1.5 text-xs"
            >
              <Download className="size-3.5" /> Export CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRedemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <UserCheck className="mb-2 size-10 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground text-sm">No redemptions found</h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                {searchQuery
                  ? "No records match your search filter."
                  : "No community members have redeemed this voucher yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 text-[11px] text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Attendee Name</th>
                    <th className="px-4 py-3 font-semibold">Email (Masked)</th>
                    <th className="px-4 py-3 font-semibold">Ticket / Pass</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Redeemed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRedemptions.map((reg, idx) => (
                    <tr key={reg.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{reg.masked_name}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{reg.masked_email}</td>
                      <td className="px-4 py-3 text-foreground">
                        <span className="inline-block max-w-[200px] truncate" title={reg.ticket_name}>
                          {reg.ticket_name || "General Pass"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium text-[10px] capitalize",
                            reg.status === "approved" ||
                              reg.status === "paid_and_registered" ||
                              reg.status === "attended"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "border-muted bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {reg.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-[11px] text-muted-foreground">
                        {new Date(reg.registered_at).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy compliance callout */}
      <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-muted-foreground text-xs">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Privacy Protection Notice</p>
          <p>
            To uphold Google Developer Groups Jakarta attendee privacy standards and comply with international privacy
            regulations, individual email addresses, full surnames, and phone numbers are cryptographically masked prior
            to browser transmission. If you require further attendee auditing, please contact the GDG Jakarta organizing
            team.
          </p>
        </div>
      </div>
    </div>
  );
}
