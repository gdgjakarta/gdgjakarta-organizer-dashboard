"use client";

import { useState } from "react";

import { Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveReferralProgramSettingsAction } from "@/lib/firestore/actions";
import type { ReferralProgramSettings } from "@/lib/firestore/types";

interface ReferralSettingsDialogProps {
  initialSettings?: ReferralProgramSettings | null;
  onSettingsUpdated?: (settings: ReferralProgramSettings) => void;
}

export function ReferralSettingsDialog({ initialSettings, onSettingsUpdated }: ReferralSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [discountPercent, setDiscountPercent] = useState<number>(initialSettings?.default_discount_percentage ?? 10);
  const [pointsPerReferral, setPointsPerReferral] = useState<number>(initialSettings?.points_per_referral ?? 10);
  const [isActive, setIsActive] = useState<boolean>(initialSettings?.is_active ?? true);
  const [prizeDesc, setPrizeDesc] = useState<string>(
    initialSettings?.merch_prize_description ?? "Exclusive GDG Jakarta merchandise bundle",
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveReferralProgramSettingsAction({
        default_discount_percentage: Number(discountPercent) || 0,
        points_per_referral: Number(pointsPerReferral) || 0,
        is_active: isActive,
        merch_prize_description: prizeDesc.trim(),
      });

      if (!res.success) {
        toast.error(res.error || "Failed to save referral settings.");
        return;
      }

      toast.success("Referral program settings updated successfully!");
      if (onSettingsUpdated) {
        onSettingsUpdated({
          default_discount_percentage: Number(discountPercent) || 0,
          points_per_referral: Number(pointsPerReferral) || 0,
          is_active: isActive,
          merch_prize_description: prizeDesc.trim(),
          updated_at: new Date().toISOString(),
        });
      }
      setOpen(false);
    } catch {
      toast.error("Failed to update referral settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
          <Settings className="size-3.5" />
          Referral Settings
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Referral Program Configuration</DialogTitle>
              <DialogDescription className="text-xs">
                Configure global discount percentages, points rules, and merchandise rewards.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Master Toggle */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">Program Active Status</p>
              <p className="text-[11px] text-muted-foreground">
                Enable or pause referral redemption and discounts chapter-wide.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Discount Percentage */}
          <Field>
            <FieldLabel className="text-xs font-medium">Default Ticket Discount Percentage (%)</FieldLabel>
            <div className="relative mt-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="h-8 pr-8 font-mono text-xs"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                %
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Discount automatically applied to attendees purchasing a ticket via referral code.
            </p>
          </Field>

          {/* Points Per Referral */}
          <Field>
            <FieldLabel className="text-xs font-medium">Points Awarded Per Referred Booking</FieldLabel>
            <Input
              type="number"
              min={1}
              max={1000}
              value={pointsPerReferral}
              onChange={(e) => setPointsPerReferral(Math.max(1, Number(e.target.value)))}
              className="mt-1 h-8 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Leaderboard points awarded to the referrer when an attendee books a ticket.
            </p>
          </Field>

          {/* Merchandise Prize Description */}
          <Field>
            <FieldLabel className="text-xs font-medium">Merchandise Grand Prize Description</FieldLabel>
            <Textarea
              rows={2}
              value={prizeDesc}
              onChange={(e) => setPrizeDesc(e.target.value)}
              placeholder="e.g. Exclusive GDG Jakarta merchandise bundle"
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Displayed on member dashboards and leaderboard as the reward for #1 top rank.
            </p>
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving} className="h-8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs font-medium">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
