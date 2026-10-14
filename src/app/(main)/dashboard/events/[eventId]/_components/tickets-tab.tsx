"use client";

import { useEffect, useState, useTransition } from "react";

import {
  AlertCircle,
  Banknote,
  Bookmark,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteCustomTicketTemplate,
  ensureEventTickets,
  getAllTicketTemplates,
  getTicketSalesStatus,
  saveTicketAsTemplate,
  type TicketTemplate,
} from "@/lib/events/ticket-templates";
import { updateEventTicketsAction } from "@/lib/firestore/actions";
import type { EventTicketTier, FirestoreEvent, TicketType } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { TicketTierDialog } from "./ticket-tier-dialog";

interface TicketsTabProps {
  event: FirestoreEvent;
}

const TICKET_TYPE_META: Record<TicketType, { label: string; badge: string; color: string; desc: string }> = {
  free: {
    label: "Free Registration",
    badge: "Free RSVP",
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    desc: "100% free community admission.",
  },
  paid: {
    label: "Paid Registration",
    badge: "Paid Pass",
    color: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    desc: "Fixed admission fee with official receipt.",
  },
  commitment_fee: {
    label: "Free with Commitment Fee",
    badge: "Refundable Fee",
    color: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    desc: "Refunded 100% in cash upon venue check-in.",
  },
};

function formatPriceDisplay(type: TicketType, price: number): string {
  if (type === "free") return "Free (Rp 0)";
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function getStatusLabel(status?: "active" | "sold_out" | "hidden"): string {
  if (status === "active") return "Active";
  if (status === "sold_out") return "Sold Out";
  return "Hidden";
}

export function TicketsTab({ event }: TicketsTabProps) {
  const [tickets, setTickets] = useState<EventTicketTier[]>(() => ensureEventTickets(event.tickets));
  const [maxTicketsPerPerson, setMaxTicketsPerPerson] = useState<number>(event.max_tickets_per_person ?? 1);
  const [editingTicket, setEditingTicket] = useState<EventTicketTier | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [templatesData, setTemplatesData] = useState(() => getAllTicketTemplates());

  // Refresh templates from localStorage
  const refreshTemplates = () => {
    setTemplatesData(getAllTicketTemplates());
  };

  const [currentPaymentEnv, setCurrentPaymentEnv] = useState<"production" | "sandbox">(
    event.payment_environment ?? (event.is_test ? "sandbox" : "production"),
  );

  useEffect(() => {
    setCurrentPaymentEnv(event.payment_environment ?? (event.is_test ? "sandbox" : "production"));
  }, [event.payment_environment, event.is_test]);

  useEffect(() => {
    const handleEnvChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; environment: "production" | "sandbox" }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(event.id)) {
        setCurrentPaymentEnv(customEvent.detail.environment);
      }
    };
    window.addEventListener("gdg:payment-env-change", handleEnvChange);
    return () => {
      window.removeEventListener("gdg:payment-env-change", handleEnvChange);
    };
  }, [event.id]);

  // Load latest tickets and limits from Firestore document
  useEffect(() => {
    if (!event.id) return;

    async function loadLatestTickets() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData?.tickets && Array.isArray(docData.tickets)) {
          setTickets(ensureEventTickets(docData.tickets));
        }
        if (typeof docData?.max_tickets_per_person === "number") {
          setMaxTicketsPerPerson(docData.max_tickets_per_person);
        }
        if (docData?.payment_environment) {
          setCurrentPaymentEnv(docData.payment_environment);
        }
      } catch (err) {
        console.warn("[TicketsTab] Failed to fetch latest event tickets:", err);
      }
    }

    void loadLatestTickets();
  }, [event.id]);

  const handleCreateNew = () => {
    setEditingTicket(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (ticket: EventTicketTier) => {
    setEditingTicket(ticket);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (ticket: EventTicketTier) => {
    const cloned: EventTicketTier = {
      ...ticket,
      id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${ticket.name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTickets((prev) => [...prev, cloned]);
    setIsDirty(true);
    toast.success(`Duplicated "${ticket.name}"`);
  };

  const handleToggleVisibility = (ticketId: string) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;
    const willBeHidden = target.status !== "hidden";
    const nextStatus = willBeHidden ? "hidden" : "active";
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus, updated_at: new Date().toISOString() } : t)),
    );
    setIsDirty(true);
    toast.success(
      willBeHidden
        ? `Hidden "${target.name}". Remember to save changes.`
        : `Ticket "${target.name}" is now visible. Remember to save changes.`,
    );
  };

  const handleDelete = (ticketId: string, ticketName: string) => {
    if (tickets.length <= 1) {
      toast.error("Every event must have at least 1 ticket tier. You cannot remove the only remaining ticket tier.");
      return;
    }
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setIsDirty(true);
    toast.success(`Removed "${ticketName}"`);
  };

  const handleSaveCardAsTemplate = (ticket: EventTicketTier) => {
    saveTicketAsTemplate(ticket);
    refreshTemplates();
    toast.success(`Saved "${ticket.name}" as reusable template!`);
  };

  const handleDeleteCustomTemplate = (e: React.MouseEvent, templateId: string, templateName: string) => {
    e.stopPropagation();
    deleteCustomTicketTemplate(templateId);
    refreshTemplates();
    toast.success(`Deleted template "${templateName}"`);
  };

  const handleApplyTemplate = (tmpl: TicketTemplate) => {
    const newTicket: EventTicketTier = {
      id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: tmpl.name,
      type: tmpl.type,
      price: tmpl.price,
      description: tmpl.description,
      max_per_person: tmpl.maxPerPerson,
      capacity: tmpl.capacity ?? null,
      status: "active",
      perks: tmpl.perks ? JSON.parse(JSON.stringify(tmpl.perks)) : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTickets((prev) => [...prev, newTicket]);
    setIsDirty(true);
    toast.success(`Added ticket tier "${tmpl.name}"`);
  };

  const handleSaveTicket = (saved: EventTicketTier) => {
    setTickets((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [...prev, saved];
    });
    refreshTemplates();
    setIsDirty(true);
  };

  const handleSaveAll = () => {
    if (!event.id) {
      toast.error("Event ID is missing.");
      return;
    }

    const finalTickets = ensureEventTickets(tickets);

    startTransition(async () => {
      try {
        const res = await updateEventTicketsAction(String(event.id), finalTickets, maxTicketsPerPerson, event);
        if (res.success) {
          setTickets(finalTickets);
          setIsDirty(false);
          window.dispatchEvent(
            new CustomEvent("gdg:tickets-updated", {
              detail: { eventId: String(event.id), tickets: finalTickets },
            }),
          );
          toast.success("Event registration tickets saved successfully!");
        } else {
          toast.error(res.error || "Failed to save tickets.");
        }
      } catch {
        toast.error("An error occurred while saving tickets.");
      }
    });
  };

  const handleDiscard = () => {
    setTickets(ensureEventTickets(event.tickets));
    setMaxTicketsPerPerson(event.max_tickets_per_person ?? 1);
    setIsDirty(false);
    toast.info("Unsaved ticket changes discarded.");
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ── Global Purchase Limits Card ──────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">Event Registration Tickets & Quotas</CardTitle>
              {currentPaymentEnv === "sandbox" ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs"
                >
                  Sandbox
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs"
                >
                  Live Production
                </Badge>
              )}
              {isDirty && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                  Unsaved Changes
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Configure multiple admission tiers (Free RSVP, Paid Pass, Refundable Commitment Deposit), quota
              capacities, and purchase limits for each attendee.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <DropdownMenu onOpenChange={(open) => open && refreshTemplates()}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" />
                  Quick Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
                <DropdownMenuLabel className="text-xs">GDG Standard Templates</DropdownMenuLabel>
                {templatesData.defaultTemplates.map((tmpl) => (
                  <DropdownMenuItem
                    key={tmpl.id}
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 w-full justify-between">
                      <span className="font-semibold text-xs">{tmpl.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                        {tmpl.type === "free" ? "Free" : `Rp ${tmpl.price.toLocaleString("id-ID")}`}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">{tmpl.description}</span>
                    {tmpl.perks && tmpl.perks.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <Sparkles className="size-2.5" />
                        <span>{tmpl.perks.length} perks included</span>
                      </div>
                    )}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center justify-between text-xs">
                  <span>My Saved Templates</span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">
                    {templatesData.customTemplates.length}
                  </Badge>
                </DropdownMenuLabel>

                {templatesData.customTemplates.length > 0 ? (
                  templatesData.customTemplates.map((tmpl) => (
                    <DropdownMenuItem
                      key={tmpl.id}
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="group flex flex-col items-start gap-1 py-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 w-full justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <Bookmark className="size-3 text-amber-500 shrink-0" />
                          <span className="font-semibold text-xs truncate">{tmpl.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                            {tmpl.type === "free" ? "Free" : `Rp ${tmpl.price.toLocaleString("id-ID")}`}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => handleDeleteCustomTemplate(e, tmpl.id, tmpl.name)}
                            className="size-5 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete custom template"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">{tmpl.description}</span>
                      {tmpl.perks && tmpl.perks.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                          <Sparkles className="size-2.5" />
                          <span>{tmpl.perks.length} perks included</span>
                        </div>
                      )}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-2.5 text-center text-[11px] text-muted-foreground">
                    No custom templates yet. Click the bookmark button on any ticket card to save it.
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={handleCreateNew} className="gap-1.5">
              <Plus className="size-3.5" />
              Add Ticket Tier
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Purchase Limit Policy Box */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="max-tickets-person" className="text-xs font-semibold">
                  Global Limit: Max Tickets per Person
                </Label>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {maxTicketsPerPerson} / Person
                </Badge>
              </div>
              <Input
                id="max-tickets-person"
                type="number"
                min={1}
                max={10}
                value={maxTicketsPerPerson}
                onChange={(e) => {
                  setMaxTicketsPerPerson(Math.max(1, Number(e.target.value) || 1));
                  setIsDirty(true);
                }}
                className="h-8 text-xs bg-background"
              />
              <p className="text-[11px] text-muted-foreground leading-normal">
                Restricts the maximum number of tickets an individual member can book in a single transaction.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold">Configured Ticket Options</span>
              <div className="flex h-8 items-center gap-2 rounded-md border border-border/70 bg-background px-3 text-xs font-medium text-foreground">
                <Ticket className="size-3.5 text-primary" />
                <span className="truncate">
                  {tickets.length} tier{tickets.length === 1 ? "" : "s"} &bull;{" "}
                  {tickets.filter((t) => t.status !== "hidden").length} Visible,{" "}
                  {tickets.filter((t) => t.status === "hidden").length} Hidden
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Attendees will select from visible options upon clicking Register.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-semibold">Payment & Refund Policy</span>
              <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                <ShieldCheck className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Commitment fees are refunded 100% on check-in to discourage seat reservations without attendance.
                </span>
              </div>
            </div>
          </div>

          {tickets.length > 0 && tickets.every((t) => t.status === "hidden") && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>All ticket tiers are currently hidden.</strong> Attendees clicking &quot;Register&quot; will see
                fallback general admission passes. Unhide at least one tier to present custom passes.
              </span>
            </div>
          )}

          {/* Ticket Tier Cards Grid */}
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <Ticket className="size-8" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground text-base">No Tickets Configured</h3>
              <p className="mt-1.5 max-w-md text-muted-foreground text-xs leading-relaxed">
                By default, this event will accept registrations through general registration. Create dedicated ticket
                tiers to distinguish Free, Paid, or Commitment Fee passes.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {templatesData.defaultTemplates[0] && (
                  <Button
                    size="sm"
                    onClick={() => handleApplyTemplate(templatesData.defaultTemplates[0])}
                    className="gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Add Free General Ticket
                  </Button>
                )}
                {templatesData.defaultTemplates[1] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyTemplate(templatesData.defaultTemplates[1])}
                    className="gap-1.5"
                  >
                    <Banknote className="size-3.5 text-amber-500" />
                    Add Commitment Fee Ticket
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Create Custom Tier
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tickets.map((t) => {
                const meta = TICKET_TYPE_META[t.type];
                const salesStatus = getTicketSalesStatus(t);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex flex-col justify-between rounded-xl border bg-card p-4 text-card-foreground shadow-xs transition-all hover:border-primary/50 hover:shadow-md",
                      t.status === "hidden" && "opacity-60 border-dashed",
                    )}
                  >
                    <div>
                      {/* Header with Type & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.color)}>
                          {meta.badge}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {t.status === "active" && salesStatus.state === "upcoming" && (
                            <Badge
                              variant="outline"
                              className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-medium"
                            >
                              Opens Soon
                            </Badge>
                          )}
                          {t.status === "active" && salesStatus.state === "ended" && (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground text-[10px] font-medium"
                            >
                              Sales Closed
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] font-medium",
                              t.status === "active" &&
                                salesStatus.state === "available" &&
                                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                              t.status === "active" &&
                                salesStatus.state !== "available" &&
                                "bg-muted text-muted-foreground",
                              t.status === "sold_out" && "bg-destructive/10 text-destructive",
                              t.status === "hidden" && "bg-muted text-muted-foreground",
                            )}
                          >
                            {getStatusLabel(t.status)}
                          </Badge>
                        </div>
                      </div>

                      {/* Ticket Title & Price */}
                      <div className="mt-3">
                        <h4 className="font-semibold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">
                          {t.name}
                        </h4>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-bold text-lg text-foreground">
                            {formatPriceDisplay(t.type, t.price)}
                          </span>
                          {t.type === "commitment_fee" && (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              (Refundable)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="mt-2 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                        {t.description || meta.desc}
                      </p>

                      {/* Included Perks Preview */}
                      {t.perks && t.perks.length > 0 && (
                        <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <Sparkles className="size-3 text-amber-500" />
                              <span>{t.perks.length} Perks Included</span>
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.perks.slice(0, 3).map((p) => (
                              <Badge key={p.id} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                                {p.name}
                              </Badge>
                            ))}
                            {t.perks.length > 3 && (
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                              >
                                +{t.perks.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Badges for Capacity and Limits */}
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
                        <div className="flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Users className="size-3" />
                          <span>Quota: {t.capacity ? `${t.capacity} seats` : "Unlimited"}</span>
                        </div>
                        <div className="flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Ticket className="size-3" />
                          <span>Max {t.max_per_person ?? 1} / attendee</span>
                        </div>
                        {(t.sales_start_date || t.sales_end_date) && (
                          <div
                            className={cn(
                              "flex items-center gap-1 rounded px-2 py-0.5 text-[10px]",
                              salesStatus.state === "available" &&
                                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                              salesStatus.state === "upcoming" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                              salesStatus.state === "ended" && "bg-muted/80 text-muted-foreground",
                            )}
                          >
                            <Clock className="size-3 shrink-0" />
                            <span>
                              {salesStatus.state === "upcoming" && salesStatus.formattedStart
                                ? `Sales starts ${salesStatus.formattedStart}`
                                : salesStatus.state === "ended" && salesStatus.formattedEnd
                                  ? `Sales closed ${salesStatus.formattedEnd}`
                                  : salesStatus.formattedEnd
                                    ? `Sales until ${salesStatus.formattedEnd}`
                                    : "Sales Scheduled"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                      <span className="text-[10px] text-muted-foreground">ID: {t.id.slice(-6)}</span>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleSaveCardAsTemplate(t)}
                          title="Save as reusable template"
                          className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                        >
                          <BookmarkPlus className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleDuplicate(t)}
                          title="Duplicate ticket"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleToggleVisibility(t.id)}
                          title={
                            t.status === "hidden"
                              ? "Show ticket (Make visible to attendees)"
                              : "Hide ticket (Hide from attendees)"
                          }
                          aria-label={t.status === "hidden" ? `Show ${t.name}` : `Hide ${t.name}`}
                          className={cn(
                            "text-muted-foreground hover:text-foreground",
                            t.status === "hidden" && "text-amber-600 hover:text-amber-500 dark:text-amber-400",
                          )}
                        >
                          {t.status === "hidden" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleEdit(t)}
                          title="Edit ticket"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleDelete(t.id, t.name)}
                          title="Delete ticket"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Info Summary */}
          {tickets.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <strong>{tickets.length}</strong> ticket tiers configured. All active tiers will be presented to
                  attendees during checkout.
                </span>
              </div>

              <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5 self-end sm:self-auto">
                <Plus className="size-3.5" />
                Add Another Tier
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for editing/creating individual ticket tier */}
      <TicketTierDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        ticket={editingTicket}
        eventMerchandise={event.merchandise ?? []}
        onSave={handleSaveTicket}
      />

      {/* Floating Save Bar */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSaveAll}
        onDiscard={handleDiscard}
        discardLabel="Discard"
        saveLabel="Save Tickets"
        savingLabel="Saving Tickets..."
        savedLabel="All Saved"
        statusInfo={`${tickets.length} Tickets Configured (Limit: ${maxTicketsPerPerson}/person)`}
        helperText="Changes will immediately reflect on the member registration screen."
      />
    </div>
  );
}
