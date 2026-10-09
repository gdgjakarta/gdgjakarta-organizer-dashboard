"use client";

import { useEffect, useState } from "react";

import { Image as ImageIcon, Package, Plus, Trash2, X } from "lucide-react";

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
import type { EventMerchandiseItem, MerchandiseVariation } from "@/lib/firestore/types";

interface MerchandiseItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EventMerchandiseItem | null;
  onSave: (item: EventMerchandiseItem) => void;
}

const COMMON_TAGS = [
  "Free Perk",
  "Included with Ticket",
  "Exclusive Perk",
  "Limited Edition",
  "Official Apparel",
  "Eco Friendly",
  "Collectible",
  "Desk Accessory",
];

export function MerchandiseItemDialog({ open, onOpenChange, item, onSave }: MerchandiseItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<number>(0);
  const [tag, setTag] = useState("Free Perk");
  const [imageUrl, setImageUrl] = useState("");
  const [hasStockLimit, setHasStockLimit] = useState(false);
  const [stock, setStock] = useState<number | null>(null);
  const [maxPerPerson, setMaxPerPerson] = useState<number | null>(null);
  const [variations, setVariations] = useState<MerchandiseVariation[]>([]);
  const [status, setStatus] = useState<"active" | "draft" | "out_of_stock">("active");

  // Temporary input states for adding variation options
  const [newVarName, setNewVarName] = useState("");
  const [newOptionInput, setNewOptionInput] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name || "");
      setDescription(item.description || "");
      setIsFree(Boolean(item.is_free));
      setPrice(item.price || 0);
      setTag(item.tag || "Free Perk");
      setImageUrl(item.image_url || "");
      setHasStockLimit(item.stock !== null && item.stock !== undefined);
      setStock(item.stock ?? null);
      setMaxPerPerson(item.max_per_person ?? null);
      setVariations(JSON.parse(JSON.stringify(item.variations)));
      setStatus(item.status);
    } else {
      setName("");
      setDescription("");
      setIsFree(true);
      setPrice(0);
      setTag("Free Perk");
      setImageUrl("");
      setHasStockLimit(false);
      setStock(null);
      setMaxPerPerson(null);
      setVariations([{ name: "Size", options: ["S", "M", "L", "XL", "XXL"] }]);
      setStatus("active");
    }
    setNewVarName("");
    setNewOptionInput({});
  }, [item, open]);

  const handleAddVariationType = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) return;
    setVariations((prev) => [...prev, { name: trimmed, options: [] }]);
    setNewVarName("");
  };

  const handleRemoveVariationType = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddOption = (varIndex: number) => {
    const text = (newOptionInput[varIndex] || "").trim();
    if (!text) return;
    setVariations((prev) => {
      const copy = [...prev];
      const target = copy[varIndex];
      if (target && !target.options.includes(text)) {
        target.options.push(text);
      }
      return copy;
    });
    setNewOptionInput((prev) => ({ ...prev, [varIndex]: "" }));
  };

  const handleRemoveOption = (varIndex: number, optionToRemove: string) => {
    setVariations((prev) => {
      const copy = [...prev];
      const target = copy[varIndex];
      if (target) {
        target.options = target.options.filter((o) => o !== optionToRemove);
      }
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const savedItem: EventMerchandiseItem = {
      id: item?.id ?? `merch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description: description.trim(),
      is_free: isFree,
      price: isFree ? 0 : Number(price) || 0,
      tag: tag.trim() || "Free Perk",
      image_url: imageUrl.trim(),
      stock: hasStockLimit && stock !== null ? Number(stock) : null,
      max_per_person: maxPerPerson && maxPerPerson > 0 ? Number(maxPerPerson) : null,
      variations: variations.filter((v) => v.name.trim().length > 0),
      status,
      created_at: item?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(savedItem);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl md:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {item ? "Edit Merchandise Item" : "Create Merchandise Item"}
            </DialogTitle>
            <DialogDescription>
              Configure attendee perk or merchandise details, variations, and marketplace pricing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Item Name */}
            <div className="space-y-1.5">
              <Label htmlFor="merch-name">Item Name *</Label>
              <Input
                id="merch-name"
                required
                placeholder="e.g. GDG Jakarta Developer T-Shirt 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Pricing & Free Perk Toggle */}
            <div className="grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-free-toggle" className="cursor-pointer font-medium text-sm">
                    Free / Ticket Perk
                  </Label>
                  <Switch
                    id="is-free-toggle"
                    checked={isFree}
                    onCheckedChange={(checked) => {
                      setIsFree(checked);
                      if (checked) {
                        setPrice(0);
                        if (tag === "Official Apparel" || tag === "Paid Merch") {
                          setTag("Free Perk");
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  Free perks are included with attendee tickets and don&apos;t require payment.
                </p>
              </div>

              {!isFree ? (
                <div className="space-y-1.5">
                  <Label htmlFor="merch-price">Price (IDR) *</Label>
                  <Input
                    id="merch-price"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="e.g. 125000"
                    value={price || ""}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Included Free with Registration
                </div>
              )}
            </div>

            {/* Tag / Category Badge & Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="merch-tag">Tag / Badge</Label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger id="merch-tag">
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TAGS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="merch-status">Listing Status</Label>
                <Select value={status} onValueChange={(val: "active" | "draft" | "out_of_stock") => setStatus(val)}>
                  <SelectTrigger id="merch-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Available)</SelectItem>
                    <SelectItem value="draft">Draft (Hidden)</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="merch-desc">Description</Label>
              <Textarea
                id="merch-desc"
                rows={3}
                placeholder="Product specs, materials, sizing guidelines, or pickup instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Image URL & Instant Preview */}
            <div className="space-y-2">
              <Label htmlFor="merch-image">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="merch-image"
                  placeholder="https://example.com/photo.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              {imageUrl ? (
                <div className="relative mt-2 h-40 w-full overflow-hidden rounded-lg border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/* biome-ignore lint/performance/noImgElement: user image preview */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/600x400/202124/ffffff?text=Invalid+Image+URL";
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground text-xs">
                  <ImageIcon className="size-4" />
                  <span>Enter image URL to display thumbnail in marketplace catalog</span>
                </div>
              )}
            </div>

            {/* Inventory / Stock Quota */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="stock-toggle" className="font-medium text-xs">
                    Limited Inventory Quota
                  </Label>
                  <p className="text-muted-foreground text-[11px]">
                    Limit available items or leave unlimited for on-demand perks.
                  </p>
                </div>
                <Switch
                  id="stock-toggle"
                  checked={hasStockLimit}
                  onCheckedChange={(checked) => {
                    setHasStockLimit(checked);
                    if (!checked) setStock(null);
                    else if (stock === null) setStock(100);
                  }}
                />
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hasStockLimit ? (
                  <div className="space-y-1">
                    <Label htmlFor="item-stock-limit" className="text-xs">
                      Total Stock Quota
                    </Label>
                    <Input
                      id="item-stock-limit"
                      type="number"
                      min="1"
                      placeholder="Available quota (e.g. 100)"
                      value={stock ?? ""}
                      onChange={(e) => setStock(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-muted-foreground">Unlimited stock quota</div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="item-max-person" className="text-xs">
                    Max Units / Person (Optional)
                  </Label>
                  <Input
                    id="item-max-person"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="e.g. 1 (blank = no limit)"
                    value={maxPerPerson ?? ""}
                    onChange={(e) => setMaxPerPerson(e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Variations Manager (Sizes, Colors, etc.) */}
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Product Variations</div>
                  <div className="text-muted-foreground text-xs">
                    Configure options attendees can choose (e.g., Size, Color, Edition).
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {variations.map((v, vIdx) => (
                  <div key={v.name || `custom-var-${vIdx}`} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wide">{v.name}</span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="size-6 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveVariationType(vIdx)}
                        title="Remove variation type"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    {/* Option Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {v.options.map((opt) => (
                        <Badge key={opt} variant="secondary" className="gap-1 pr-1 font-medium text-xs shadow-2xs">
                          <span>{opt}</span>
                          <button
                            type="button"
                            className="cursor-pointer rounded-xs p-0.5 hover:bg-muted-foreground/20"
                            onClick={() => handleRemoveOption(vIdx, opt)}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Add Option Input */}
                    <div className="flex gap-2 pt-1">
                      <Input
                        size={undefined}
                        placeholder={`Add ${v.name} option (e.g. XL, Navy)`}
                        className="h-8 text-xs"
                        value={newOptionInput[vIdx] || ""}
                        onChange={(e) => setNewOptionInput((prev) => ({ ...prev, [vIdx]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddOption(vIdx);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => handleAddOption(vIdx)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add New Variation Type */}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="New variation name (e.g. Size, Color, Material)"
                    className="h-8 text-xs"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddVariationType();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    onClick={handleAddVariationType}
                  >
                    <Plus className="size-3" /> Add Variation Type
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{item ? "Save Changes" : "Create Item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
