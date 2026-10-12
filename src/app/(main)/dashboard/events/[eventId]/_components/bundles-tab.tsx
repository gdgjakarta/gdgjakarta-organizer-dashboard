"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  Banknote,
  Bookmark,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  Layers,
  Package,
  PackageCheck,
  Plus,
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
import {
  calculateBundlePricing,
  deleteCustomBundleTemplate,
  ensureEventBundles,
  GDG_BUNDLE_TEMPLATES,
  getAllBundleTemplates,
  getBundleSalesStatus,
} from "@/lib/events/bundle-templates";
import { updateEventBundlesAction } from "@/lib/firestore/actions";
import type { EventBundlePackage, EventMerchandiseItem, EventTicketTier, FirestoreEvent } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

import { BundleDialog } from "./bundle-dialog";

interface BundlesTabProps {
  event: FirestoreEvent;
}

export function BundlesTab({ event }: BundlesTabProps) {
  const [bundles, setBundles] = useState<EventBundlePackage[]>(() => ensureEventBundles(event.bundles));
  const [editingBundle, setEditingBundle] = useState<EventBundlePackage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [templatesData, setTemplatesData] = useState(() => getAllBundleTemplates());

  const eventTickets: EventTicketTier[] = useMemo(() => {
    return event.tickets ?? [];
  }, [event.tickets]);

  const eventMerchandise: EventMerchandiseItem[] = useMemo(() => {
    return event.merchandise ?? [];
  }, [event.merchandise]);

  // Refresh custom templates
  const refreshTemplates = () => {
    setTemplatesData(getAllBundleTemplates());
  };

  // Load latest bundles from Firestore
  useEffect(() => {
    if (!event.id) return;

    async function loadLatestBundles() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData?.bundles && Array.isArray(docData.bundles)) {
          setBundles(docData.bundles);
        }
      } catch (err) {
        console.warn("[BundlesTab] Failed to fetch latest event bundles:", err);
      }
    }

    void loadLatestBundles();
  }, [event.id]);

  const handleCreateNew = () => {
    setEditingBundle(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (bundle: EventBundlePackage) => {
    setEditingBundle(bundle);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (bundle: EventBundlePackage) => {
    const cloned: EventBundlePackage = {
      ...bundle,
      id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${bundle.name} (Copy)`,
      total_registered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setBundles((prev) => [...prev, cloned]);
    setIsDirty(true);
    toast.success(`Duplicated "${bundle.name}"`);
  };

  const handleDelete = (bundleId: string, bundleName: string) => {
    setBundles((prev) => prev.filter((b) => b.id !== bundleId));
    setIsDirty(true);
    toast.success(`Removed package "${bundleName}".`);
  };

  const handleSaveBundle = (savedBundle: EventBundlePackage) => {
    setBundles((prev) => {
      const idx = prev.findIndex((b) => b.id === savedBundle.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedBundle;
        return next;
      }
      return [...prev, savedBundle];
    });
    setIsDirty(true);
    refreshTemplates();
    toast.success(`Package "${savedBundle.name}" updated.`);
  };

  const handleAddTemplate = (tpl: (typeof GDG_BUNDLE_TEMPLATES)[number]) => {
    // Pick first matching ticket tier and merchandise items if available
    const primaryTicket = eventTickets.find((t) => t.type === tpl.ticketTypeHint) || eventTickets[0];
    const ticketId = primaryTicket?.id || "ticket-regular";

    const includedMerch = eventMerchandise.slice(0, 2).map((m) => ({
      merchandise_id: m.id,
      quantity: 1,
    }));

    const newBundle: EventBundlePackage = {
      id: `bundle-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: tpl.name,
      description: tpl.description,
      badge: tpl.badge,
      ticket_id: ticketId,
      merchandise_items: includedMerch,
      price: tpl.price,
      original_price: tpl.original_price,
      capacity: tpl.capacity,
      total_registered: 0,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setBundles((prev) => [...prev, newBundle]);
    setIsDirty(true);
    toast.success(`Added package template "${tpl.name}". Remember to save changes!`);
  };

  const handleApplySavedTemplate = (tpl: EventBundlePackage) => {
    const newBundle: EventBundlePackage = {
      ...tpl,
      id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      total_registered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setBundles((prev) => [...prev, newBundle]);
    setIsDirty(true);
    toast.success(`Applied template "${tpl.name}".`);
  };

  const handleSaveAll = () => {
    if (!event.id) {
      toast.error("Event ID is missing.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateEventBundlesAction(String(event.id), bundles, event);
        if (res.success) {
          setIsDirty(false);
          toast.success("Bundling packages saved successfully!");
        } else {
          toast.error(res.error || "Failed to save bundling packages.");
        }
      } catch {
        toast.error("An error occurred while saving bundling packages.");
      }
    });
  };

  const handleDiscard = () => {
    setBundles(ensureEventBundles(event.bundles));
    setIsDirty(false);
    toast.info("Discarded unsaved bundle changes.");
  };

  // Top metrics
  const activeCount = bundles.filter((b) => b.status === "active").length;
  const totalSold = bundles.reduce((acc, b) => acc + (b.total_registered || 0), 0);
  const totalRevenue = bundles.reduce((acc, b) => acc + (b.total_registered || 0) * (b.price || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Total Packages</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{bundles.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs text-muted-foreground font-medium">Active Packages</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{activeCount}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-muted-foreground font-medium">Packages Sold</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{totalSold}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-muted-foreground font-medium">Bundle Revenue</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </p>
        </Card>
      </div>

      {/* Main Packages Management Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PackageCheck className="size-5 text-primary" />
              <CardTitle className="text-lg">Ticket & Merchandise Bundling Packages</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Package tickets together with merchandise at bundled promotional rates. Attendees select their preferred
              variations (e.g. shirt sizes) during registration.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Templates Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Bookmark className="size-3.5" />
                  Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs">GDG Package Presets</DropdownMenuLabel>
                {GDG_BUNDLE_TEMPLATES.map((tpl) => (
                  <DropdownMenuItem
                    key={tpl.id}
                    className="flex flex-col items-start gap-0.5 text-xs py-2 cursor-pointer"
                    onClick={() => handleAddTemplate(tpl)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-foreground">{tpl.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Rp {tpl.price.toLocaleString("id-ID")}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">{tpl.description}</span>
                  </DropdownMenuItem>
                ))}

                {templatesData.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">My Custom Templates</DropdownMenuLabel>
                    {templatesData.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        className="flex items-center justify-between text-xs py-2 cursor-pointer"
                        onClick={() => handleApplySavedTemplate(tpl)}
                      >
                        <span className="truncate">{tpl.name}</span>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="size-5 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomBundleTemplate(tpl.id);
                            refreshTemplates();
                            toast.info(`Deleted custom template "${tpl.name}"`);
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Create New Package Button */}
            <Button size="sm" onClick={handleCreateNew} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Create Package
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {bundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PackageCheck className="size-7" />
              </div>
              <h3 className="mt-4 font-semibold text-base text-foreground">No Bundling Packages Yet</h3>
              <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
                Bundling packages allow you to offer discounted combo tickets including event t-shirts, hoodies, and
                swag kits to boost community merchandise sales and attendee excitement.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={handleCreateNew} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Create Package
                </Button>
                {GDG_BUNDLE_TEMPLATES[0] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddTemplate(GDG_BUNDLE_TEMPLATES[0])}
                    className="gap-1.5"
                  >
                    <Sparkles className="size-3.5 text-amber-500" />
                    Add Sample VIP Swag Pass
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bundles.map((b) => {
                const salesStatus = getBundleSalesStatus(b);
                const pricing = calculateBundlePricing(b, eventTickets, eventMerchandise);
                const linkedTicket = eventTickets.find((t) => t.id === b.ticket_id);

                const currentCount = b.total_registered || 0;
                const hasCapacity = typeof b.capacity === "number" && b.capacity > 0;
                const capacityPct = hasCapacity
                  ? Math.min(100, Math.round((currentCount / (b.capacity || 1)) * 100))
                  : 0;

                return (
                  <div
                    key={b.id}
                    className="group relative flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    {/* Top Row: Badges & Actions */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", salesStatus.badgeColor)}>
                            {salesStatus.badgeLabel}
                          </Badge>
                          {b.badge && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              {b.badge}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleDuplicate(b)}
                            title="Duplicate"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEdit(b)}
                            title="Edit"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(b.id, b.name)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Package Name & Description */}
                      <h4 className="font-semibold text-foreground text-sm line-clamp-1">{b.name}</h4>
                      {b.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {b.description}
                        </p>
                      )}

                      {/* Pricing block */}
                      <div className="mt-3.5 flex items-baseline gap-2">
                        <span className="font-bold text-lg text-foreground">
                          {b.price === 0 ? "Free (Rp 0)" : `Rp ${b.price.toLocaleString("id-ID")}`}
                        </span>
                        {pricing.standaloneTotal > b.price && (
                          <span className="text-xs text-muted-foreground line-through">
                            Rp {pricing.standaloneTotal.toLocaleString("id-ID")}
                          </span>
                        )}
                        {pricing.savings > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Save {pricing.discountPercentage}%
                          </span>
                        )}
                      </div>

                      {/* Included Items Details */}
                      <div className="mt-4 space-y-2.5 rounded-lg bg-muted/40 p-3 text-xs">
                        {/* Included Ticket */}
                        <div className="flex items-center gap-2">
                          <Ticket className="size-3.5 shrink-0 text-primary" />
                          <span className="shrink-0 text-muted-foreground font-medium">Ticket:</span>
                          <span className="truncate font-semibold text-foreground">
                            {linkedTicket?.name || "Regular Admission Ticket"}
                          </span>
                        </div>

                        {/* Included Merchandise Items */}
                        <div className="flex items-start gap-2">
                          <Package className="size-3.5 shrink-0 text-primary mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="text-muted-foreground font-medium">Merch: </span>
                            {b.merchandise_items.length === 0 ? (
                              <span className="text-muted-foreground italic">None</span>
                            ) : (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {b.merchandise_items.map((mItem) => {
                                  const matchingMerch = eventMerchandise.find(
                                    (item) => item.id === mItem.merchandise_id,
                                  );
                                  return (
                                    <Badge
                                      key={mItem.merchandise_id}
                                      variant="secondary"
                                      className="text-[10px] py-0 px-1.5 font-normal"
                                    >
                                      {mItem.quantity}x {matchingMerch?.name || "Merchandise Item"}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Quota / Sales Schedule */}
                    <div className="mt-4 pt-3 border-t text-xs">
                      {hasCapacity ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Quota Progress</span>
                            <span className="font-semibold text-foreground">
                              {currentCount} / {b.capacity} claimed ({capacityPct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Total Redemptions</span>
                          <span className="font-medium text-foreground">{currentCount} attendees</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Note */}
          {bundles.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <strong>{bundles.length}</strong> bundling packages configured. Attendees will see these package
                  options highlighted during registration.
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateNew}
                className="gap-1.5 self-end sm:self-auto text-xs"
              >
                <Plus className="size-3.5" />
                Add Another Package
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Package Creation/Edit Dialog */}
      <BundleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        bundle={editingBundle}
        eventTickets={eventTickets}
        eventMerchandise={eventMerchandise}
        onSave={handleSaveBundle}
      />

      {/* Floating Save Bar */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSaveAll}
        onDiscard={handleDiscard}
        discardLabel="Discard"
        saveLabel="Save Packages"
        savingLabel="Saving Packages..."
        savedLabel="All Saved"
      />
    </div>
  );
}
