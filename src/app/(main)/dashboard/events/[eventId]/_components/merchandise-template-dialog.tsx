"use client";

import { useMemo, useState } from "react";

import { Check, Package, Plus, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GDG_MERCHANDISE_TEMPLATES } from "@/lib/events/merchandise-templates";
import type { EventMerchandiseItem } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface MerchandiseTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (item: EventMerchandiseItem) => void;
  existingNames?: string[];
}

export function MerchandiseTemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  existingNames = [],
}: MerchandiseTemplateDialogProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");

  const existingNameSet = useMemo(() => new Set(existingNames.map((n) => n.toLowerCase().trim())), [existingNames]);

  const filteredTemplates = useMemo(() => {
    return GDG_MERCHANDISE_TEMPLATES.filter((tpl) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.tag.toLowerCase().includes(q);

      const matchesType =
        filterType === "all" || (filterType === "free" && tpl.is_free) || (filterType === "paid" && !tpl.is_free);

      return matchesSearch && matchesType;
    });
  }, [search, filterType]);

  const handleAdd = (template: EventMerchandiseItem) => {
    const cloned: EventMerchandiseItem = {
      ...template,
      id: `merch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onSelectTemplate(cloned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-2xl md:max-w-3xl">
        <div className="flex flex-col">
          {/* Header */}
          <div className="border-b p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="size-5 text-amber-500" />
                Merchandise Templates Catalog
              </DialogTitle>
              <DialogDescription>
                Choose pre-configured GDG merchandise or attendee perks to attach to your event. You can customize
                variations, prices, and stock afterwards.
              </DialogDescription>
            </DialogHeader>

            {/* Filter toolbar */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates (e.g. T-Shirt, Stickers, Tumbler)..."
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-1.5 self-start">
                <Button
                  size="sm"
                  variant={filterType === "all" ? "default" : "outline"}
                  onClick={() => setFilterType("all")}
                  className="h-8 text-xs"
                >
                  All ({GDG_MERCHANDISE_TEMPLATES.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "free" ? "default" : "outline"}
                  onClick={() => setFilterType("free")}
                  className="h-8 text-xs"
                >
                  Free Perks
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "paid" ? "default" : "outline"}
                  onClick={() => setFilterType("paid")}
                  className="h-8 text-xs"
                >
                  Marketplace / Paid
                </Button>
              </div>
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="max-h-[58vh] overflow-y-auto p-6">
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div className="mt-2 font-medium text-sm">No templates found</div>
                <div className="text-muted-foreground text-xs">Try adjusting your search or category filter.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredTemplates.map((template) => {
                  const isAlreadyAdded = existingNameSet.has(template.name.toLowerCase().trim());

                  return (
                    <div
                      key={template.id}
                      className={cn(
                        "flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-all hover:border-primary/40 hover:shadow-sm",
                        isAlreadyAdded && "border-primary/30 bg-primary/[0.02]",
                      )}
                    >
                      {/* Image Preview & Badges */}
                      <div className="relative aspect-video w-full overflow-hidden bg-muted">
                        {template.image_url ? (
                          // biome-ignore lint/a11y/useAltText: decorative product photo
                          // biome-ignore lint/performance/noImgElement: template catalog preview
                          <img
                            src={template.image_url}
                            className="size-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Package className="size-8 opacity-40" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-semibold text-[10px] backdrop-blur-md",
                              template.is_free
                                ? "border-emerald-500/20 bg-emerald-500/90 text-white"
                                : "border-blue-500/20 bg-blue-500/90 text-white",
                            )}
                          >
                            {template.is_free ? "Free Perk" : `IDR ${template.price.toLocaleString("id-ID")}`}
                          </Badge>
                          <Badge variant="outline" className="bg-background/90 text-[10px] backdrop-blur-md">
                            {template.tag}
                          </Badge>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-foreground text-sm leading-snug">{template.name}</h4>
                        </div>
                        <p className="mt-1 line-clamp-2 flex-1 text-muted-foreground text-xs leading-relaxed">
                          {template.description}
                        </p>

                        {/* Variations Pills */}
                        {template.variations && template.variations.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            {template.variations.map((v) => (
                              <Badge
                                key={v.name}
                                variant="outline"
                                className="border-border/60 bg-muted/40 font-normal text-[10px] text-muted-foreground"
                              >
                                {v.name}: {v.options.length} {v.options.length === 1 ? "opt" : "options"}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Add Button */}
                        <div className="mt-4 flex items-center justify-between border-t pt-3">
                          <span className="text-[11px] text-muted-foreground">
                            {template.stock !== null ? `Quota: ${template.stock} pcs` : "Unlimited quota"}
                          </span>

                          <Button
                            size="sm"
                            variant={isAlreadyAdded ? "secondary" : "default"}
                            onClick={() => handleAdd(template)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            {isAlreadyAdded ? (
                              <>
                                <Check className="size-3.5 text-emerald-600" />
                                Add Another
                              </>
                            ) : (
                              <>
                                <Plus className="size-3.5" />
                                Add to Event
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
