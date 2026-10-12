"use client";

import { useEffect, useState } from "react";

import {
  Award,
  Bookmark,
  Coffee,
  Gift,
  Package,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Ticket,
  Trash2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { saveTicketAsTemplate } from "@/lib/events/ticket-templates";
import type {
  EventMerchandiseItem,
  EventTicketTier,
  TicketPerk,
  TicketPerkIcon,
  TicketType,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface TicketTierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: EventTicketTier | null;
  eventMerchandise?: EventMerchandiseItem[];
  onSave: (ticket: EventTicketTier) => void;
}

const TICKET_TYPE_INFO: Record<TicketType, { label: string; badge: string; defaultDesc: string; color: string }> = {
  free: {
    label: "Free Registration",
    badge: "Free RSVP",
    defaultDesc: "Complimentary community admission with full access to sessions and networking.",
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  paid: {
    label: "Paid Registration",
    badge: "Paid Pass",
    defaultDesc: "Official conference ticket tier with admission confirmation and payment receipt.",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  commitment_fee: {
    label: "Free with Commitment Fee",
    badge: "Refundable Fee",
    defaultDesc: "Refundable commitment deposit returned 100% in cash upon physical check-in; forfeited on no-show.",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
};

const PRESET_PERKS: Array<{ name: string; description: string; icon: TicketPerkIcon }> = [
  { name: "Official Event T-Shirt", description: "High-grade 100% cotton conference attendee shirt", icon: "shirt" },
  {
    name: "Buffet Lunch & Coffee",
    description: "Full catering lunch box and coffee break refreshments",
    icon: "coffee",
  },
  {
    name: "Certificate of Attendance",
    description: "Verified digital certificate signed by GDG Jakarta",
    icon: "award",
  },
  { name: "Swag Kit & Laptop Stickers", description: "Conference lanyard, stickers, and badge kit", icon: "gift" },
  { name: "VIP Lounge & Front Row", description: "Reserved front-row seating and VIP networking lounge", icon: "star" },
];

function renderPerkIcon(icon?: TicketPerkIcon) {
  switch (icon) {
    case "shirt":
      return <Shirt className="size-3.5 text-blue-500" />;
    case "coffee":
      return <Coffee className="size-3.5 text-amber-500" />;
    case "award":
      return <Award className="size-3.5 text-emerald-500" />;
    case "gift":
      return <Gift className="size-3.5 text-purple-500" />;
    case "star":
      return <Star className="size-3.5 text-amber-500" />;
    case "ticket":
      return <Ticket className="size-3.5 text-indigo-500" />;
    default:
      return <Sparkles className="size-3.5 text-amber-500" />;
  }
}

/**
 * Converts a stored ISO timestamp (UTC) into the local `YYYY-MM-DDTHH:mm` format
 * expected by `<input type="datetime-local">`.
 */
function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getTicketSubtitle(t: TicketType): string {
  if (t === "free") return "Free Admission";
  if (t === "paid") return "Paid Pass";
  return "Refundable";
}

function getPriceLabel(t: TicketType): string {
  if (t === "free") return "Ticket Price (Free)";
  if (t === "paid") return "Ticket Price (IDR)";
  return "Commitment Deposit Amount (IDR)";
}

export function TicketTierDialog({ open, onOpenChange, ticket, eventMerchandise = [], onSave }: TicketTierDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TicketType>("free");
  const [price, setPrice] = useState<number>(0);
  const [hasCapacityLimit, setHasCapacityLimit] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [maxPerPerson, setMaxPerPerson] = useState<number>(1);
  const [status, setStatus] = useState<"active" | "sold_out" | "hidden">("active");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");

  // Perks Included state
  const [perks, setPerks] = useState<TicketPerk[]>([]);
  const [newPerkName, setNewPerkName] = useState("");
  const [newPerkDesc, setNewPerkDesc] = useState("");
  const [newPerkIcon, setNewPerkIcon] = useState<TicketPerkIcon>("sparkles");
  const [selectedMerchId, setSelectedMerchId] = useState("");

  // Template saving option
  const [saveAsTemplateChecked, setSaveAsTemplateChecked] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (ticket) {
      setName(ticket.name);
      setDescription(ticket.description ?? "");
      setType(ticket.type);
      setPrice(ticket.price);
      setHasCapacityLimit(ticket.capacity !== null && ticket.capacity !== undefined);
      setCapacity(ticket.capacity ?? null);
      setMaxPerPerson(ticket.max_per_person ?? 1);
      setStatus(ticket.status);
      setSalesStartDate(toDateTimeLocalValue(ticket.sales_start_date));
      setSalesEndDate(toDateTimeLocalValue(ticket.sales_end_date));
      setPerks(ticket.perks ? JSON.parse(JSON.stringify(ticket.perks)) : []);
    } else {
      setName("");
      setDescription(TICKET_TYPE_INFO.free.defaultDesc);
      setType("free");
      setPrice(0);
      setHasCapacityLimit(false);
      setCapacity(null);
      setMaxPerPerson(1);
      setStatus("active");
      setSalesStartDate("");
      setSalesEndDate("");
      setPerks([]);
    }
    setSaveAsTemplateChecked(false);
    setNewPerkName("");
    setNewPerkDesc("");
    setSelectedMerchId("");
  }, [ticket, open]);

  const handleTypeChange = (newType: TicketType) => {
    setType(newType);
    if (newType === "free") {
      setPrice(0);
    } else if (newType === "commitment_fee" && price === 0) {
      setPrice(50000);
    } else if (newType === "paid" && price === 0) {
      setPrice(100000);
    }
    if (!description || description === TICKET_TYPE_INFO[type]?.defaultDesc) {
      setDescription(TICKET_TYPE_INFO[newType].defaultDesc);
    }
  };

  const handleAddPresetPerk = (preset: (typeof PRESET_PERKS)[number]) => {
    // Avoid exact duplicate names
    if (perks.some((p) => p.name.toLowerCase() === preset.name.toLowerCase())) {
      toast.info(`"${preset.name}" is already included.`);
      return;
    }
    const newPerk: TicketPerk = {
      id: `perk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: preset.name,
      description: preset.description,
      icon: preset.icon,
    };
    setPerks((prev) => [...prev, newPerk]);
    toast.success(`Added perk "${preset.name}"`);
  };

  const handleAddMerchPerk = (merchId: string) => {
    const merch = eventMerchandise.find((m) => m.id === merchId);
    if (!merch) return;

    if (perks.some((p) => p.merchandise_id === merch.id)) {
      toast.info(`"${merch.name}" is already linked as a ticket perk.`);
      return;
    }

    const newPerk: TicketPerk = {
      id: `perk-merch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: merch.name,
      description: merch.description || `Complimentary ${merch.name} included with this ticket`,
      merchandise_id: merch.id,
      icon: "gift",
    };
    setPerks((prev) => [...prev, newPerk]);
    setSelectedMerchId("");
    toast.success(`Linked "${merch.name}" from event merchandise!`);
  };

  const handleAddCustomPerk = () => {
    if (!newPerkName.trim()) return;

    const newPerk: TicketPerk = {
      id: `perk-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newPerkName.trim(),
      description: newPerkDesc.trim() || undefined,
      icon: newPerkIcon,
    };
    setPerks((prev) => [...prev, newPerk]);
    setNewPerkName("");
    setNewPerkDesc("");
    toast.success(`Added perk "${newPerk.name}"`);
  };

  const handleRemovePerk = (perkId: string) => {
    setPerks((prev) => prev.filter((p) => p.id !== perkId));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const payload: EventTicketTier = {
      id: ticket?.id ?? `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      price: type === "free" ? 0 : Math.max(0, Number(price) || 0),
      capacity: hasCapacityLimit && capacity && capacity > 0 ? Number(capacity) : null,
      max_per_person: maxPerPerson && maxPerPerson > 0 ? Number(maxPerPerson) : 1,
      status,
      sales_start_date: salesStartDate ? new Date(salesStartDate).toISOString() : null,
      sales_end_date: salesEndDate ? new Date(salesEndDate).toISOString() : null,
      perks: perks.length > 0 ? perks : undefined,
      created_at: ticket?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (saveAsTemplateChecked) {
      saveTicketAsTemplate(payload);
      toast.success(`Saved "${payload.name}" as reusable ticket template!`);
    }

    onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Ticket className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {ticket ? "Edit Ticket Tier" : "Create New Registration Ticket"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure admission type, pricing, capacity quota, and per-person purchase limits.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Ticket Type Selector (Free, Paid, Commitment Fee) */}
          <div className="space-y-2">
            <Label className="font-medium text-xs">Ticket Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["free", "paid", "commitment_fee"] as TicketType[]).map((t) => {
                const info = TICKET_TYPE_INFO[t];
                const isSelected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 font-medium text-foreground shadow-xs ring-1 ring-primary"
                        : "border-border/70 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <span className="font-semibold text-xs">{info.badge}</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                      {getTicketSubtitle(t)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-name" className="font-medium text-xs">
              Ticket Tier Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ticket-name"
              placeholder="e.g. Early Bird Registration, General Admission, VIP Pass"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Pricing & Free Notice */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-price" className="font-medium text-xs">
                {getPriceLabel(type)}
              </Label>
              <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", TICKET_TYPE_INFO[type].color)}>
                {type === "free" ? "Free (Rp 0)" : `Rp ${price.toLocaleString("id-ID")}`}
              </Badge>
            </div>

            {type === "free" ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-800 text-xs dark:text-emerald-300">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Admission is 100% free for community members. Price is locked to Rp 0.</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute top-2 left-3 font-mono text-muted-foreground text-xs">Rp</span>
                  <Input
                    id="ticket-price"
                    type="number"
                    min={0}
                    step={5000}
                    placeholder={type === "commitment_fee" ? "50000" : "100000"}
                    value={price || ""}
                    onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="h-9 pl-9 text-xs"
                  />
                </div>
                {type === "commitment_fee" && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    💡 This commitment deposit will be refunded in cash upon physical check-in at the venue.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-description" className="font-medium text-xs">
              Description / Admission Terms
            </Label>
            <Textarea
              id="ticket-description"
              placeholder="Explain who this ticket is intended for, benefits, and refund rules..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none text-xs"
            />
          </div>

          {/* ── PERKS & MERCHANDISE INCLUDED ────────────────────────── */}
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <span className="font-semibold text-xs text-foreground">Perks Included with Ticket</span>
              </div>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {perks.length} perk{perks.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Attach conference merchandise, catering, swag, or exclusive benefits included with this ticket tier.
            </p>

            {/* Quick Add Preset Perks */}
            <div className="space-y-1.5">
              <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">
                Quick Add Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PERKS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddPresetPerk(preset)}
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] font-normal text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
                  >
                    {renderPerkIcon(preset.icon)}
                    <span>{preset.name}</span>
                    <Plus className="size-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* Link from Event Merchandise */}
            {eventMerchandise.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">
                    Link from Event Merchandise Catalog:
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-600 dark:text-blue-400"
                  >
                    {eventMerchandise.length} Items Available
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedMerchId} onValueChange={(val) => handleAddMerchPerk(val)}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Select merchandise to include..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eventMerchandise.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <Package className="size-3.5 text-muted-foreground" />
                            <span>{item.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              ({item.is_free ? "Free Perk" : `Rp ${item.price.toLocaleString("id-ID")}`})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Custom Perk Input */}
            <div className="space-y-2 pt-1 border-t border-border/40">
              <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">
                Or Add Custom Perk:
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-1 gap-2">
                  <Select value={newPerkIcon} onValueChange={(val: TicketPerkIcon) => setNewPerkIcon(val)}>
                    <SelectTrigger className="h-8 w-28 shrink-0 text-xs" aria-label="Perk icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["sparkles", "shirt", "coffee", "award", "gift", "star", "ticket"] as TicketPerkIcon[]).map(
                        (ic) => (
                          <SelectItem key={ic} value={ic} className="text-xs">
                            <div className="flex items-center gap-1.5">
                              {renderPerkIcon(ic)}
                              <span className="capitalize">{ic}</span>
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Perk name (e.g. Attraction Pass, Networking Dinner)..."
                    value={newPerkName}
                    onChange={(e) => setNewPerkName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomPerk();
                      }
                    }}
                    className="h-8 text-xs flex-1"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustomPerk}
                  disabled={!newPerkName.trim()}
                  className="h-8 gap-1 text-xs shrink-0"
                >
                  <Plus className="size-3.5" />
                  Add Perk
                </Button>
              </div>
            </div>

            {/* Configured Perks List */}
            {perks.length > 0 ? (
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">
                  Included Perks on this Ticket ({perks.length}):
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {perks.map((p) => {
                    const linkedMerch = p.merchandise_id
                      ? eventMerchandise.find((m) => m.id === p.merchandise_id)
                      : null;

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-card p-2 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted">
                            {linkedMerch?.image_url ? (
                              // biome-ignore lint/performance/noImgElement: thumbnail
                              // biome-ignore lint/a11y/useAltText: preview
                              <img src={linkedMerch.image_url} className="size-5 rounded object-cover" />
                            ) : (
                              renderPerkIcon(p.icon)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">{p.name}</span>
                              {p.merchandise_id && (
                                <Badge
                                  variant="secondary"
                                  className="px-1 py-0 text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                >
                                  Merchandise
                                </Badge>
                              )}
                            </div>
                            {p.description && (
                              <p className="text-[10px] text-muted-foreground truncate">{p.description}</p>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemovePerk(p.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove perk"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/70 p-2.5 text-center text-[11px] text-muted-foreground">
                No perks included yet. Add merchandise or benefits that attendees receive with this ticket.
              </div>
            )}
          </div>

          {/* Capacity and Limit Per Person */}
          <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-2">
            {/* Limit Per Person */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ticket-max-person" className="font-medium text-xs">
                  Max Tickets / Person
                </Label>
                <Badge variant="secondary" className="px-1 py-0 font-normal text-[10px]">
                  Limit
                </Badge>
              </div>
              <Input
                id="ticket-max-person"
                type="number"
                min={1}
                max={10}
                value={maxPerPerson}
                onChange={(e) => setMaxPerPerson(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Limit how many of this ticket one attendee can claim.</p>
            </div>

            {/* Total Capacity Limit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="toggle-capacity" className="cursor-pointer font-medium text-xs">
                  Limit Total Seats
                </Label>
                <Switch id="toggle-capacity" checked={hasCapacityLimit} onCheckedChange={setHasCapacityLimit} />
              </div>
              {hasCapacityLimit ? (
                <Input
                  id="ticket-capacity"
                  type="number"
                  min={1}
                  placeholder="e.g. 100"
                  value={capacity ?? ""}
                  onChange={(e) => setCapacity(Number(e.target.value) || null)}
                  className="h-8 text-xs"
                />
              ) : (
                <div className="flex h-8 items-center rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground">
                  Unlimited capacity
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {hasCapacityLimit
                  ? "Maximum quota for this specific tier."
                  : "Seats limited only by overall venue capacity."}
              </p>
            </div>
          </div>

          {/* Sales Window & Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sales-start" className="font-medium text-xs">
                Sales Open (Optional)
              </Label>
              <Input
                id="sales-start"
                type="datetime-local"
                value={salesStartDate}
                onChange={(e) => setSalesStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sales-end" className="font-medium text-xs">
                Sales Close (Optional)
              </Label>
              <Input
                id="sales-end"
                type="datetime-local"
                value={salesEndDate}
                onChange={(e) => setSalesEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Ticket Status */}
          <div className="space-y-1.5">
            <Label className="font-medium text-xs">Ticket Availability Status</Label>
            <Select value={status} onValueChange={(val: "active" | "sold_out" | "hidden") => setStatus(val)}>
              <SelectTrigger size="sm" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Available for registration)</SelectItem>
                <SelectItem value="sold_out">Sold Out (Displayed but disabled)</SelectItem>
                <SelectItem value="hidden">Hidden (Internal / Inactive)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Save as Reusable Template Checkbox */}
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2">
              <Bookmark className="size-4 text-amber-500" />
              <div>
                <Label htmlFor="save-as-template" className="cursor-pointer font-medium text-xs">
                  Save as Reusable Template
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Make this ticket configuration available in &quot;Quick Templates&quot; for future events.
                </p>
              </div>
            </div>
            <Switch id="save-as-template" checked={saveAsTemplateChecked} onCheckedChange={setSaveAsTemplateChecked} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            {ticket ? "Update Ticket Tier" : "Add Ticket Tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
