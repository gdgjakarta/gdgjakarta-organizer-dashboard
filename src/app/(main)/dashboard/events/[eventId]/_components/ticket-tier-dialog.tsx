"use client";

import { useEffect, useState } from "react";

import { ShieldCheck, Ticket } from "lucide-react";

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
import type { EventTicketTier, TicketType } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface TicketTierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: EventTicketTier | null;
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

export function TicketTierDialog({ open, onOpenChange, ticket, onSave }: TicketTierDialogProps) {
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
      setSalesStartDate(ticket.sales_start_date ? ticket.sales_start_date.slice(0, 16) : "");
      setSalesEndDate(ticket.sales_end_date ? ticket.sales_end_date.slice(0, 16) : "");
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
    }
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
      created_at: ticket?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[580px]">
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
