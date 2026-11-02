"use client";

import { useMemo, useState } from "react";

import { Check, Package } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventMerchandiseItem } from "@/lib/firestore/types";

interface ChangeMerchandiseVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemId?: string;
  currentVariations?: Record<string, string>;
  eventMerchandise?: EventMerchandiseItem[];
  onSave: (newVariations: Record<string, string>) => void | Promise<void>;
  isSaving?: boolean;
}

export function ChangeMerchandiseVariantDialog({
  open,
  onOpenChange,
  itemName,
  itemId,
  currentVariations = {},
  eventMerchandise = [],
  onSave,
  isSaving = false,
}: ChangeMerchandiseVariantDialogProps) {
  // Find matching merchandise item definition from event
  const matchedMerch = useMemo(() => {
    return eventMerchandise.find(
      (m) => (itemId && m.id === itemId) || m.name.toLowerCase().trim() === itemName.toLowerCase().trim(),
    );
  }, [eventMerchandise, itemId, itemName]);

  const variationsConfig = useMemo(() => {
    return matchedMerch?.variations ?? [];
  }, [matchedMerch]);

  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>(() => {
    return { ...currentVariations };
  });

  // Re-sync when modal opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedVariations({ ...currentVariations });
    }
    onOpenChange(nextOpen);
  };

  const handleVariationChange = (variationName: string, optionValue: string) => {
    setSelectedVariations((prev) => ({
      ...prev,
      [variationName]: optionValue,
    }));
  };

  const hasChanges = useMemo(() => {
    const keys = new Set([...Object.keys(currentVariations), ...Object.keys(selectedVariations)]);
    for (const k of keys) {
      if ((currentVariations[k] || "") !== (selectedVariations[k] || "")) {
        return true;
      }
    }
    return false;
  }, [currentVariations, selectedVariations]);

  const handleConfirm = async () => {
    await onSave(selectedVariations);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-semibold text-base">Change Merchandise Variant</DialogTitle>
              <DialogDescription className="text-xs">
                Update the handed over variant for <span className="font-medium text-foreground">{itemName}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Selection summary */}
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
            <span className="mb-1 block font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              Current Variant
            </span>
            {Object.keys(currentVariations).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(currentVariations).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[11px]">
                    {k}: <span className="ml-1 font-semibold text-foreground">{v}</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground italic">No variation recorded (Default)</span>
            )}
          </div>

          {/* If event item has defined variations */}
          {variationsConfig.length > 0 ? (
            <div className="space-y-3">
              <span className="block font-semibold text-foreground text-xs">Select New Variation Options:</span>
              <div className="space-y-2.5">
                {variationsConfig.map((v) => {
                  const currentValue = selectedVariations[v.name] || v.options[0] || "";
                  return (
                    <div key={v.name} className="space-y-1">
                      <Label className="font-medium text-muted-foreground text-xs">{v.name}</Label>
                      <Select
                        value={currentValue}
                        onValueChange={(val) => handleVariationChange(v.name, val)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={`Select ${v.name}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {v.options.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-xs">
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fallback generic Size/Variant selector if no structured variations configured */
            <div className="space-y-3">
              <span className="block font-semibold text-foreground text-xs">Standard Options:</span>
              <div className="space-y-1">
                <Label className="font-medium text-muted-foreground text-xs">Size / Variant</Label>
                <Select
                  value={selectedVariations.Size || selectedVariations.size || selectedVariations.Variant || ""}
                  onValueChange={(val) => handleVariationChange("Size", val)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select size..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "Free Size"].map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSaving || !hasChanges}
            className="gap-1.5 text-xs"
          >
            <Check className="size-3.5" />
            Apply Variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
