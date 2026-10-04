"use client";

import { useEffect, useState } from "react";

import { Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PartnershipTier } from "@/lib/content/types";

interface TierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier?: PartnershipTier | null;
  onSave: (tier: PartnershipTier) => void;
}

export function TierDialog({ open, onOpenChange, tier, onSave }: TierDialogProps) {
  const isEditing = Boolean(tier);

  const [name, setName] = useState("");
  const [badge, setBadge] = useState("");
  const [popular, setPopular] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [newHighlight, setNewHighlight] = useState("");

  useEffect(() => {
    if (!open) return;
    if (tier) {
      setName(tier.name);
      setBadge(tier.badge ?? "");
      setPopular(Boolean(tier.popular));
      setIsActive(tier.isActive !== false);
      setDescription(tier.description);
      setSlots(tier.slots);
      setHighlights(tier.highlights ? [...tier.highlights] : []);
    } else {
      setName("");
      setBadge("");
      setPopular(false);
      setIsActive(true);
      setDescription("");
      setSlots("Limited Slots");
      setHighlights([
        "Standard Expo Booth with power & Wi-Fi",
        "Logo on official website and screen banners",
        "Social media announcement post",
        "All-Access Conference Passes",
      ]);
    }
    setNewHighlight("");
  }, [tier, open]);

  const handleAddHighlight = () => {
    if (!newHighlight.trim()) return;
    setHighlights([...highlights, newHighlight.trim()]);
    setNewHighlight("");
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTier: PartnershipTier = {
      id: tier?.id ?? `tier-${Date.now()}`,
      name: name.trim(),
      badge: badge.trim() || undefined,
      popular,
      isActive,
      description: description.trim(),
      slots: slots.trim() || "Available",
      highlights: highlights.filter(Boolean),
    };

    onSave(newTier);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Sponsorship Tier" : "Add Sponsorship Tier"}</DialogTitle>
            <DialogDescription>Configure tier naming, exclusivity slots, and deliverables checklist.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tier-name">
                  Tier Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tier-name"
                  placeholder="e.g. Platinum Partner"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tier-slots">Slots Available</Label>
                <Input
                  id="tier-slots"
                  placeholder="e.g. 5 Slots Only, Limited Slots"
                  value={slots}
                  onChange={(e) => setSlots(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="tier-badge">Badge Label (Optional)</Label>
                <Input
                  id="tier-badge"
                  placeholder="e.g. Most Popular"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="tier-status" className="text-xs font-medium cursor-pointer">
                    Visible on Public Page
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Show in package grid</p>
                </div>
                <Switch id="tier-status" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="tier-popular" className="text-xs font-medium cursor-pointer">
                    Featured / Popular
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Accent ring styling</p>
                </div>
                <Switch id="tier-popular" checked={popular} onCheckedChange={setPopular} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tier-desc">Description</Label>
              <Textarea
                id="tier-desc"
                placeholder="Short summary of what brand profile this tier is best suited for..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Highlights List */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold">Included Deliverables & Highlights</Label>
              <div className="space-y-2">
                {highlights.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={h}
                      onChange={(e) => {
                        const updated = [...highlights];
                        updated[idx] = e.target.value;
                        setHighlights(updated);
                      }}
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveHighlight(idx)}
                      className="size-8 text-destructive shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Add new highlight point (e.g. 8x All-Access Passes)..."
                    value={newHighlight}
                    onChange={(e) => setNewHighlight(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddHighlight();
                      }
                    }}
                    className="text-xs h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddHighlight}
                    className="h-8 gap-1 text-xs shrink-0"
                  >
                    <Plus className="size-3.5" />
                    <span>Add</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? "Save Tier" : "Add Tier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
