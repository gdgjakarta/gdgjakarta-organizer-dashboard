"use client";

import { useEffect, useState, useTransition } from "react";

import {
  Clock,
  Copy,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  Package,
  PackageOpen,
  Plus,
  Ruler,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getMerchandiseSalesStatus } from "@/lib/events/merchandise-templates";
import { updateEventMerchandiseAction } from "@/lib/firestore/actions";
import type { EventMerchandiseItem, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { GenerateMerchandisePaymentDialog } from "./generate-merchandise-payment-dialog";
import { MerchandiseItemDialog } from "./merchandise-item-dialog";
import { MerchandiseTemplateDialog } from "./merchandise-template-dialog";

interface MerchandiseTabProps {
  event: FirestoreEvent;
}

function getSalesWindowSummary(salesStatus: ReturnType<typeof getMerchandiseSalesStatus>): string {
  if (salesStatus.state === "upcoming" && salesStatus.formattedStart) {
    return `Sales starts ${salesStatus.formattedStart}`;
  }
  if (salesStatus.state === "ended" && salesStatus.formattedEnd) {
    return `Sales closed ${salesStatus.formattedEnd}`;
  }
  if (salesStatus.formattedEnd) {
    return `Sales until ${salesStatus.formattedEnd}`;
  }
  return "Sales Scheduled";
}

function getMerchandiseStatusBadgeLabel(status?: "active" | "draft" | "hidden" | "out_of_stock"): string {
  if (status === "hidden") return "Hidden";
  if (status === "draft") return "Draft";
  if (status === "out_of_stock") return "Out of Stock";
  return "Active";
}

export function MerchandiseTab({ event }: MerchandiseTabProps) {
  // Start with empty array or existing event.merchandise — NO hardcoded default items!
  const [items, setItems] = useState<EventMerchandiseItem[]>(event.merchandise ?? []);
  const [maxMerchandisePerPerson, setMaxMerchandisePerPerson] = useState<number | null>(
    event.max_merchandise_per_person ?? null,
  );
  const [editingItem, setEditingItem] = useState<EventMerchandiseItem | null>(null);
  const [paymentItem, setPaymentItem] = useState<EventMerchandiseItem | null>(null);
  const [viewingGuidelineItem, setViewingGuidelineItem] = useState<EventMerchandiseItem | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);

  // Load latest merchandise from Firestore document if available
  useEffect(() => {
    if (!event.id) return;

    async function loadLatestMerchandise() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData?.merchandise && Array.isArray(docData.merchandise)) {
          setItems(docData.merchandise);
        }
        if (docData?.max_merchandise_per_person !== undefined) {
          setMaxMerchandisePerPerson(docData.max_merchandise_per_person);
        }
      } catch (err) {
        console.warn("[MerchandiseTab] Failed to fetch latest event merchandise:", err);
      }
    }

    void loadLatestMerchandise();
  }, [event.id]);

  const handleCreateNew = () => {
    setEditingItem(null);
    setIsItemDialogOpen(true);
  };

  const handleEdit = (item: EventMerchandiseItem) => {
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleDuplicate = (item: EventMerchandiseItem) => {
    const cloned: EventMerchandiseItem = {
      ...item,
      id: `merch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${item.name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, cloned]);
    setIsDirty(true);
    toast.success(`Duplicated "${item.name}"`);
  };

  const handleToggleVisibility = (itemId: string) => {
    const target = items.find((i) => String(i.id) === String(itemId));
    if (!target) return;
    const willBeHidden = target.status !== "hidden" && target.status !== "draft";
    const nextStatus = willBeHidden ? "hidden" : "active";
    setItems((prev) =>
      prev.map((i) =>
        String(i.id) === String(itemId) ? { ...i, status: nextStatus, updated_at: new Date().toISOString() } : i,
      ),
    );
    setIsDirty(true);
    toast.success(
      willBeHidden
        ? `Hidden "${target.name}". Remember to save changes.`
        : `Merchandise "${target.name}" is now visible. Remember to save changes.`,
    );
  };

  const handleDelete = (itemId: string, itemName: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setIsDirty(true);
    toast.success(`Removed "${itemName}" from merchandise.`);
  };

  const handleSaveItem = (savedItem: EventMerchandiseItem) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => String(i.id) === String(savedItem.id));
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedItem;
        return updated;
      }
      return [...prev, savedItem];
    });
    setIsDirty(true);
  };

  const handleSelectTemplate = (templateItem: EventMerchandiseItem) => {
    setItems((prev) => [...prev, templateItem]);
    setIsDirty(true);
    setIsTemplateDialogOpen(false);
    toast.success(`Added template "${templateItem.name}" to merchandise.`);
  };

  const handleSaveAll = () => {
    if (!event.id) {
      toast.error("Event ID is missing.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateEventMerchandiseAction(String(event.id), items, maxMerchandisePerPerson, event);
        if (res.success) {
          setIsDirty(false);
          window.dispatchEvent(
            new CustomEvent("gdg:merchandise-updated", {
              detail: { eventId: String(event.id), merchandise: items },
            }),
          );
          toast.success("Event merchandise saved successfully!");
        } else {
          toast.error(res.error || "Failed to save merchandise.");
        }
      } catch {
        toast.error("An error occurred while saving merchandise.");
      }
    });
  };

  const handleDiscard = () => {
    setItems(event.merchandise ?? []);
    setMaxMerchandisePerPerson(event.max_merchandise_per_person ?? null);
    setIsDirty(false);
    toast.info("Unsaved merchandise changes discarded.");
  };

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Event Merchandise & Attendee Perks</CardTitle>
              {isDirty && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                  Unsaved Changes
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Configure marketplace perks, apparel, and merchandise available to registered attendees. Add items from
              pre-built GDG templates or create custom items with variations.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button size="sm" variant="outline" onClick={() => setIsTemplateDialogOpen(true)} className="gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              Browse Templates
            </Button>

            <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5">
              <Plus className="size-3.5" />
              Custom Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Purchase Limits Box */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="max-merch-person" className="font-semibold text-xs">
                  Global Limit: Max Merchandise Items per Attendee
                </Label>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {maxMerchandisePerPerson ? `${maxMerchandisePerPerson} Items / Person` : "Unlimited"}
                </Badge>
              </div>
              <Input
                id="max-merch-person"
                type="number"
                min={1}
                max={20}
                placeholder="e.g. 2 (Leave blank for no limit)"
                value={maxMerchandisePerPerson ?? ""}
                onChange={(e) => {
                  setMaxMerchandisePerPerson(e.target.value ? Number(e.target.value) : null);
                  setIsDirty(true);
                }}
                className="h-8 bg-background text-xs"
              />
              <p className="text-[11px] text-muted-foreground leading-normal">
                Restricts the maximum total merchandise items that a single attendee can add during registration.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-xs">Configured Swag & Merchandise</span>
              <div className="flex h-8 items-center gap-2 rounded-md border border-border/70 bg-background px-3 font-medium text-foreground text-xs">
                <Package className="size-3.5 text-primary" />
                <span className="truncate">
                  {items.length} item{items.length === 1 ? "" : "s"} &bull;{" "}
                  {items.filter((i) => i.status !== "hidden" && i.status !== "draft").length} Visible,{" "}
                  {items.filter((i) => i.status === "hidden" || i.status === "draft").length} Hidden
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Active items appear on the registration checkout modal as add-ons.
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            /* Empty State: No items pre-selected or forced */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 border-dashed bg-muted/20 px-6 py-14 text-center">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <PackageOpen className="size-8" />
              </div>
              <h3 className="mt-4 font-semibold text-base text-foreground">No Merchandise Configured Yet</h3>
              <p className="mt-1.5 max-w-md text-muted-foreground text-xs leading-relaxed">
                Provide attendee giveaways, conference swag (stickers, lanyards, shirts), or paid merchandise. Select
                from pre-made GDG templates or add your own custom items.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button size="sm" onClick={() => setIsTemplateDialogOpen(true)} className="gap-1.5">
                  <Sparkles className="size-3.5 text-amber-300" />
                  Add from Templates
                </Button>
                <Button size="sm" variant="outline" onClick={handleCreateNew} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Create from Scratch
                </Button>
              </div>
            </div>
          ) : (
            /* Marketplace Grid of Items */
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const salesStatus = getMerchandiseSalesStatus(item);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-all hover:border-primary/50 hover:shadow-md",
                      (item.status === "draft" || item.status === "hidden") && "border-dashed opacity-60 bg-muted/20",
                    )}
                  >
                    {/* Image & Price Header */}
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      {item.image_url ? (
                        // biome-ignore lint/a11y/useAltText: item thumbnail
                        // biome-ignore lint/performance/noImgElement: item thumbnail
                        <img
                          src={item.image_url}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
                          <Package className="size-10 opacity-30" />
                        </div>
                      )}

                      {/* Overlay status & price pills */}
                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-semibold text-xs shadow-xs backdrop-blur-md",
                            item.is_free
                              ? "border-emerald-500/20 bg-emerald-500/90 text-white"
                              : "border-blue-500/20 bg-blue-600/90 text-white",
                          )}
                        >
                          {item.is_free ? "Free Perk" : `IDR ${(item.price || 0).toLocaleString("id-ID")}`}
                        </Badge>
                        <Badge variant="outline" className="bg-background/90 text-[10px] backdrop-blur-md">
                          {item.tag || "Perk"}
                        </Badge>
                      </div>

                      {/* Photos count pill if multiple */}
                      {item.images && item.images.length > 1 && (
                        <div className="absolute bottom-2.5 right-2.5">
                          <Badge
                            variant="secondary"
                            className="bg-background/90 text-foreground text-[10px] backdrop-blur-md shadow-xs"
                          >
                            📷 {item.images.length} photos
                          </Badge>
                        </div>
                      )}

                      {item.status && item.status !== "active" ? (
                        <div className="absolute top-2.5 right-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "bg-background/95 font-medium text-[10px] backdrop-blur-md",
                              item.status === "draft" && "border-amber-500/30 text-amber-600",
                              item.status === "hidden" && "border-muted-foreground/30 bg-muted text-muted-foreground",
                              item.status === "out_of_stock" && "border-destructive/30 text-destructive",
                            )}
                          >
                            {getMerchandiseStatusBadgeLabel(item.status)}
                          </Badge>
                        </div>
                      ) : (
                        (salesStatus.state === "upcoming" || salesStatus.state === "ended") && (
                          <div className="absolute top-2.5 right-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "bg-background/95 font-medium text-[10px] backdrop-blur-md",
                                salesStatus.badgeColor,
                              )}
                            >
                              {salesStatus.badgeLabel}
                            </Badge>
                          </div>
                        )
                      )}
                    </div>

                    {/* Body Content */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-foreground text-sm leading-snug transition-colors group-hover:text-primary">
                          {item.name}
                        </h4>
                      </div>

                      <p className="mt-1.5 line-clamp-2 flex-1 text-muted-foreground text-xs leading-relaxed">
                        {item.description || "No description provided."}
                      </p>

                      {/* Product Guideline Pill if available */}
                      {item.guideline && (item.guideline.title || item.guideline.text || item.guideline.image_url) && (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() => setViewingGuidelineItem(item)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Ruler className="size-3" />
                            <span>{item.guideline.title || "Size & Product Guideline"}</span>
                          </button>
                        </div>
                      )}

                      {/* Variations Preview */}
                      {item.variations && item.variations.length > 0 && (
                        <div className="mt-3.5 space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                          <div className="flex items-center gap-1 font-medium text-[11px] text-muted-foreground">
                            <Tag className="size-3" />
                            <span>Variations:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.variations.map((v) => {
                              const optionCount = v.options.length;
                              const hasOverrides = v.option_details && Object.keys(v.option_details).length > 0;

                              return (
                                <div key={v.name} className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className="border-border/70 bg-background font-normal text-[10px] text-foreground"
                                  >
                                    {v.name}: {v.options.slice(0, 3).join(", ")}
                                    {optionCount > 3 ? ` +${optionCount - 3}` : ""}
                                    {hasOverrides && " ⚙️"}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Sales Window Scheduled Info */}
                      {(item.sales_start_date || item.sales_end_date) && (
                        <div
                          className={cn(
                            "mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px]",
                            salesStatus.state === "available" &&
                              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                            salesStatus.state === "upcoming" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                            salesStatus.state === "ended" && "bg-muted/80 text-muted-foreground",
                          )}
                        >
                          <Clock className="size-3.5 shrink-0" />
                          <span className="truncate">{getSalesWindowSummary(salesStatus)}</span>
                        </div>
                      )}

                      {/* Footer stock & quick actions */}
                      <div className="mt-4 flex items-center justify-between border-border/60 border-t pt-3">
                        <span className="text-[11px] text-muted-foreground">
                          {item.stock !== null && item.stock !== undefined ? `Quota: ${item.stock} units` : "Unlimited"}
                        </span>

                        <div className="flex items-center gap-1">
                          {!item.is_free && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => {
                                setPaymentItem(item);
                                setIsPaymentDialogOpen(true);
                              }}
                              title="Generate DOKU payment link"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <CreditCard className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleDuplicate(item)}
                            title="Duplicate item"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleToggleVisibility(item.id)}
                            title={
                              item.status === "hidden" || item.status === "draft"
                                ? "Show merchandise (Make visible to attendees)"
                                : "Hide merchandise (Hide from attendees)"
                            }
                            aria-label={
                              item.status === "hidden" || item.status === "draft"
                                ? `Show ${item.name}`
                                : `Hide ${item.name}`
                            }
                            className={cn(
                              "text-muted-foreground hover:text-foreground",
                              (item.status === "hidden" || item.status === "draft") &&
                                "text-amber-600 hover:text-amber-500 dark:text-amber-400",
                            )}
                          >
                            {item.status === "hidden" || item.status === "draft" ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleEdit(item)}
                            title="Edit variations & details"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Delete item"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Summary Bar */}
          {items.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Sparkles className="size-4 text-amber-500" />
                <span>
                  <strong>{items.length}</strong> items configured ({items.filter((i) => i.is_free).length} Free,{" "}
                  {items.filter((i) => !i.is_free).length} Paid).
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  Add More Templates
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for editing/creating individual item */}
      <MerchandiseItemDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        item={editingItem}
        onSave={handleSaveItem}
      />

      {/* Dialog for selecting from catalog templates */}
      <MerchandiseTemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onSelectTemplate={handleSelectTemplate}
        existingNames={items.map((i) => i.name)}
      />

      {/* Dialog for generating DOKU payment link */}
      <GenerateMerchandisePaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        item={paymentItem}
        event={event}
      />

      {/* Dialog for viewing product & sizing guidelines */}
      <Dialog open={Boolean(viewingGuidelineItem)} onOpenChange={(open) => !open && setViewingGuidelineItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="size-5 text-primary" />
              {viewingGuidelineItem?.guideline?.title || "Product Guideline"}
            </DialogTitle>
            <DialogDescription>Sizing measurements and specs for {viewingGuidelineItem?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {viewingGuidelineItem?.guideline?.image_url && (
              <div className="overflow-hidden rounded-lg border bg-muted p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* biome-ignore lint/performance/noImgElement: guideline preview */}
                <img
                  src={viewingGuidelineItem.guideline.image_url}
                  alt="Size chart"
                  className="max-h-60 w-auto rounded object-contain mx-auto"
                />
              </div>
            )}

            {viewingGuidelineItem?.guideline?.text && (
              <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {viewingGuidelineItem.guideline.text}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingGuidelineItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fixed Floating Bottom Save Bar ──────────────────────────── */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSaveAll}
        onDiscard={handleDiscard}
        discardLabel="Discard"
        saveLabel="Save Bundle"
        savingLabel="Saving Bundle..."
        savedLabel="All Saved"
        statusInfo={`${items.length} Items Configured (${items.filter((i) => i.is_free).length} Free, ${items.filter((i) => !i.is_free).length} Paid)`}
        helperText="Perks will immediately reflect on the registration checkout modal."
      />
    </div>
  );
}
