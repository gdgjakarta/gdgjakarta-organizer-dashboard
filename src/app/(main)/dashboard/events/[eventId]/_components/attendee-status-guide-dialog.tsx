"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  Info,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AttendeeStatusGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StatusDefinition {
  code: string;
  label: string;
  category: "curation" | "paid" | "attendance";
  badgeClass: string;
  dotClass: string;
  consumesCapacity: boolean;
  summary: string;
  details: string;
}

const STATUS_DEFINITIONS: StatusDefinition[] = [
  // Curation / Review Flow
  {
    code: "pending",
    label: "Pending Review",
    category: "curation",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
    consumesCapacity: false,
    summary: "Applicant has submitted a registration and is awaiting organizer curation.",
    details:
      "Used when curation mode is active. Organizers can review the applicant's answers and decide to approve, waitlist, or decline. Does not consume capacity until approved.",
  },
  {
    code: "approved",
    label: "Approved",
    category: "curation",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    consumesCapacity: true,
    summary: "Application approved by organizers for a free ticket or curated session track.",
    details:
      "The registrant holds a guaranteed seat/ticket for the event. They are counted as confirmed attendees for turnout and drop rate calculations.",
  },
  {
    code: "registered",
    label: "Registered",
    category: "curation",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    consumesCapacity: true,
    summary: "Direct free RSVP when curation mode is disabled.",
    details: "Instant confirmation for open events. Holds a reserved ticket and is counted toward confirmed attendees.",
  },
  {
    code: "waitlisted",
    label: "Waitlisted",
    category: "curation",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dotClass: "bg-blue-500",
    consumesCapacity: false,
    summary: "Application placed on hold because session or event capacity is full.",
    details:
      "Waitlisted attendees can be manually approved by organizers if capacity increases or if registered attendees cancel.",
  },
  {
    code: "rejected",
    label: "Rejected",
    category: "curation",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
    consumesCapacity: false,
    summary: "Application was not accepted during curation.",
    details: "The applicant does not receive an admission QR code and is not eligible to check in.",
  },

  // Paid Registration Flow
  {
    code: "waiting_for_payment",
    label: "Waiting for Payment",
    category: "paid",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
    consumesCapacity: true,
    summary: "Invoice created; waiting for checkout via DOKU payment gateway.",
    details:
      "A seat is held temporarily against event capacity until the payment deadline expires (typically 24 hours). If unpaid before the deadline, it expires automatically.",
  },
  {
    code: "paid_and_registered",
    label: "Paid & Registered",
    category: "paid",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    consumesCapacity: true,
    summary: "Payment completed and verified. Official ticket and QR code issued.",
    details:
      "Full confirmed attendee with paid merchandise/ticket. Consumes seat capacity and is included in the drop rate denominator as an expected attendee.",
  },
  {
    code: "paid_waitlisted",
    label: "Paid Priority Waitlist",
    category: "paid",
    badgeClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    dotClass: "bg-indigo-500",
    consumesCapacity: false,
    summary: "Payment succeeded, but session capacity filled up before transaction finalized.",
    details:
      "Has top priority over unpaid applicants to claim any seat that opens up. Organizers can reallocate or refund their payment.",
  },
  {
    code: "expired",
    label: "Expired",
    category: "paid",
    badgeClass: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    dotClass: "bg-zinc-500",
    consumesCapacity: false,
    summary: "Payment deadline passed without successful payment.",
    details:
      "Held slot is released back to event capacity. Organizers can manually generate and resend a new payment link if desired.",
  },
  {
    code: "failed",
    label: "Failed",
    category: "paid",
    badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dotClass: "bg-rose-500",
    consumesCapacity: false,
    summary: "Payment transaction failed, was rejected, or encountered gateway errors.",
    details: "Does not reserve capacity. Applicants can attempt checkout again or be issued a fresh payment link.",
  },
  {
    code: "canceled",
    label: "Canceled",
    category: "paid",
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-500",
    consumesCapacity: false,
    summary: "Order or ticket canceled by member or organizer.",
    details: "Does not consume capacity. Handled in refund management if a refund was requested or processed.",
  },

  // Attendance & On-Site
  {
    code: "attended",
    label: "Attended",
    category: "attendance",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    dotClass: "bg-purple-500",
    consumesCapacity: true,
    summary: "Registrant checked in on-site at the venue via QR code scanner.",
    details:
      "Marked either through the dashboard check-in button or scanner integration. Counts towards the Turnout metric.",
  },
];

export function AttendeeStatusGuideDialog({ open, onOpenChange }: AttendeeStatusGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Attendee Statuses & Metric Calculations Guide
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Reference guide for registration lifecycle statuses, capacity rules, and drop rate calculations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs Content */}
        <Tabs defaultValue="statuses" className="w-full flex-1">
          <div className="px-5 sm:px-6 pt-3 border-b bg-muted/10">
            <TabsList className="h-9">
              <TabsTrigger value="statuses" className="text-xs gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span>Status Dictionary (12)</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs gap-1.5">
                <TrendingDown className="size-3.5" />
                <span>Metric Calculations</span>
              </TabsTrigger>
              <TabsTrigger value="flows" className="text-xs gap-1.5">
                <ArrowRight className="size-3.5" />
                <span>Lifecycle Flows</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh] max-h-[560px] p-5 sm:p-6">
            {/* ── TAB 1: STATUS DICTIONARY ────────────────────────── */}
            <TabsContent value="statuses" className="m-0 space-y-6">
              {/* Group 1: Curation & Review Flow */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Free RSVP & Curation Review Flow</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {STATUS_DEFINITIONS.filter((s) => s.category === "curation").map((item) => (
                    <div
                      key={item.code}
                      className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-2xs hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", item.badgeClass)}>
                          <span className={cn("size-1.5 rounded-full mr-1.5", item.dotClass)} />
                          {item.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {item.consumesCapacity ? "Consumes Seat" : "No Seat Reserved"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-snug">{item.summary}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2: Paid Registration Flow */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <CreditCard className="size-4 text-primary" />
                  <span>Paid Registration & Checkout Flow (DOKU Gateway)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {STATUS_DEFINITIONS.filter((s) => s.category === "paid").map((item) => (
                    <div
                      key={item.code}
                      className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-2xs hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", item.badgeClass)}>
                          <span className={cn("size-1.5 rounded-full mr-1.5", item.dotClass)} />
                          {item.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {item.consumesCapacity ? "Consumes Seat" : "No Seat Reserved"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-snug">{item.summary}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 3: Attendance & Derived Views */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <UserCheck className="size-4 text-purple-600 dark:text-purple-400" />
                  <span>On-Site Attendance & Filter Views</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold"
                      >
                        <span className="size-1.5 rounded-full mr-1.5 bg-purple-500" />
                        Checked In
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">Dynamic Filter</span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-snug">
                      Any attendee where{" "}
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">is_checked_in = true</code> or status
                      is <code className="text-[10px] bg-muted px-1 py-0.5 rounded">attended</code>.
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Represents successful physical attendance at the event venue. Used as the numerator for Turnout
                      Rate.
                    </p>
                  </div>

                  <div className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-semibold"
                      >
                        <span className="size-1.5 rounded-full mr-1.5 bg-rose-500" />
                        Not Checked In (Drop)
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">Dynamic Filter</span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-snug">
                      Confirmed ticket holders (
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">approved</code> or{" "}
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">paid_and_registered</code>) who haven't
                      checked in.
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      These are the no-shows. Organizers can filter this list to send attendance reminders or evaluate
                      drop rates.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── TAB 2: METRIC CALCULATIONS ──────────────────────── */}
            <TabsContent value="metrics" className="m-0 space-y-5">
              {/* Confirmed Attendees */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>1. Confirmed Expected Attendees (Denominator)</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5 font-mono text-xs">
                  Total Confirmed = (Approved) + (Paid & Registered) + (Attended) + (Registered)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every attendee who holds an admission pass is expected to attend. In GDG Jakarta events, this includes
                  both curated free <code className="text-[10px] bg-muted px-1 rounded">Approved</code> applicants and{" "}
                  <code className="text-[10px] bg-muted px-1 rounded">Paid & Registered</code> ticket buyers.
                </p>
              </div>

              {/* Drop Rate */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <TrendingDown className="size-4 text-rose-500" />
                  <span>2. Drop Rate (No-Show Rate)</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5 font-mono text-xs space-y-1">
                  <div>No-Shows = max(0, Total Confirmed Attendees - Total Checked In)</div>
                  <div>Drop Rate (%) = (No-Shows / Total Confirmed Attendees) × 100%</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Drop Rate shows the percentage of confirmed ticket holders who failed to arrive at the venue.
                </p>

                {/* Color Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <div className="rounded-md border p-2.5 bg-emerald-500/5 border-emerald-500/20">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">≤ 35% Drop</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Healthy attendance. Typical for high-commitment events.
                    </p>
                  </div>
                  <div className="rounded-md border p-2.5 bg-amber-500/5 border-amber-500/20">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 text-xs">36% - 60% Drop</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Moderate drop. Standard for free community events.
                    </p>
                  </div>
                  <div className="rounded-md border p-2.5 bg-rose-500/5 border-rose-500/20">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 text-xs">&gt; 60% Drop</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      High no-show rate. Review reminder strategy or ticketing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Turnout Rate */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <UserCheck className="size-4 text-purple-600 dark:text-purple-400" />
                  <span>3. Turnout Rate</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5 font-mono text-xs">
                  Turnout (%) = (Total Checked In / Total Confirmed Attendees) × 100%
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Turnout is the inverse of Drop Rate:{" "}
                  <code className="text-[10px] bg-muted px-1 rounded">Turnout % + Drop Rate % = 100%</code>.
                </p>
              </div>

              {/* Capacity Utilization */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Calendar className="size-4 text-primary" />
                  <span>4. Event Capacity Utilization</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5 font-mono text-xs">
                  Capacity % = (Total Registrations / Max Capacity) × 100%
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Reflects registration interest against the maximum venue attendee limit configured for the event.
                </p>
              </div>
            </TabsContent>

            {/* ── TAB 3: LIFECYCLE FLOWS ──────────────────────────── */}
            <TabsContent value="flows" className="m-0 space-y-5">
              {/* Free Curated Flow */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Free RSVP / Curation Mode Lifecycle</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600">
                    pending
                  </Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Organizer Reviews</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                    approved
                  </Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Scanned at Venue</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="border-purple-500/20 bg-purple-500/10 text-purple-600">
                    attended (checked in)
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Branch outcomes: If rejected, status becomes{" "}
                  <code className="text-[10px] bg-muted px-1 rounded">rejected</code>. If session capacity is full,
                  status becomes <code className="text-[10px] bg-muted px-1 rounded">waitlisted</code>.
                </p>
              </div>

              {/* Paid Registration Flow */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  <span>Paid Ticket / Merchandise Lifecycle</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600">
                    waiting_for_payment
                  </Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">DOKU Webhook Verified</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                    paid_and_registered
                  </Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Scanned at Venue</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="border-purple-500/20 bg-purple-500/10 text-purple-600">
                    attended (checked in)
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Failure outcomes: If unpaid within deadline $\rightarrow${" "}
                  <code className="text-[10px] bg-muted px-1 rounded">expired</code>. If gateway error $\rightarrow${" "}
                  <code className="text-[10px] bg-muted px-1 rounded">failed</code>. If user cancels $\rightarrow${" "}
                  <code className="text-[10px] bg-muted px-1 rounded">canceled</code>.
                </p>
              </div>

              {/* Summary note */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  Both <strong className="text-emerald-600 dark:text-emerald-400">Approved</strong> free attendees and{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">Paid & Registered</strong> ticket holders
                  hold verified entry tickets. Both streams feed into the same check-in scanner and drop rate
                  calculations.
                </p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
