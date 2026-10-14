"use client";

import { useEffect, useState, useTransition } from "react";

import {
  Banknote,
  Bookmark,
  CheckCircle2,
  Copy,
  Edit2,
  Eye,
  EyeOff,
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
import { ensureEventTickets } from "@/lib/events/ticket-templates";
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

  const [eventTickets, setEventTickets] = useState<EventTicketTier[]>(() => ensureEventTickets(event.tickets));
  const [eventMerchandise, setEventMerchandise] = useState<EventMerchandiseItem[]>(() => event.merchandise ?? []);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(
    () => !event.tickets?.length && !event.merchandise?.length,
  );

  // Sync state if parent event prop updates
  useEffect(() => {
    if (event.tickets && event.tickets.length > 0) {
      setEventTickets(ensureEventTickets(event.tickets));
    }
    if (event.merchandise && event.merchandise.length > 0) {
      setEventMerchandise(event.merchandise);
    }
  }, [event.tickets, event.merchandise]);

  // Refresh custom templates
  const refreshTemplates = () => {
    setTemplatesData(getAllBundleTemplates());
  };

  // Load latest bundles, tickets, and merchandise from Firestore and subscribe to real-time updates
  useEffect(() => {
    if (!event.id) return;

    let isMounted = true;

    async function loadLatestEventData() {
      setIsLoadingItems(true);
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (!isMounted) return;

        if (docData) {
          if (docData.bundles && Array.isArray(docData.bundles)) {
            setBundles(docData.bundles);
          }
          if (docData.tickets && Array.isArray(docData.tickets)) {
            setEventTickets(ensureEventTickets(docData.tickets));
          } else {
            setEventTickets((prev) => (prev.length > 0 ? prev : ensureEventTickets([])));
          }
          if (docData.merchandise && Array.isArray(docData.merchandise)) {
            setEventMerchandise(docData.merchandise);
          }
        }
      } catch (err) {
        console.warn("[BundlesTab] Failed to fetch latest event data:", err);
      } finally {
        if (isMounted) {
          setIsLoadingItems(false);
        }
      }
    }

    void loadLatestEventData();

    // Subscribe to live Firestore updates
    let unsubscribe: (() => void) | undefined;
    async function setupLiveSubscription() {
      try {
        const { subscribeFirestoreEventDoc } = await import("@/lib/firestore/client");
        unsubscribe = subscribeFirestoreEventDoc(String(event.id), (docData) => {
          if (!isMounted || !docData) return;
          if (docData.bundles && Array.isArray(docData.bundles)) {
            setBundles(docData.bundles);
          }
          if (docData.tickets && Array.isArray(docData.tickets)) {
            setEventTickets(ensureEventTickets(docData.tickets));
          }
          if (docData.merchandise && Array.isArray(docData.merchandise)) {
            setEventMerchandise(docData.merchandise);
          }
          setIsLoadingItems(false);
        });
      } catch (err) {
        console.warn("[BundlesTab] Failed to subscribe to Firestore event doc:", err);
      }
    }

    void setupLiveSubscription();

    // Cross-tab synchronization via custom DOM events
    const handleTicketsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; tickets: EventTicketTier[] }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(event.id)) {
        setEventTickets(ensureEventTickets(customEvent.detail.tickets));
        setIsLoadingItems(false);
      }
    };

    const handleMerchandiseUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: string; merchandise: EventMerchandiseItem[] }>;
      if (customEvent.detail && String(customEvent.detail.eventId) === String(event.id)) {
        setEventMerchandise(customEvent.detail.merchandise);
        setIsLoadingItems(false);
      }
    };

    window.addEventListener("gdg:tickets-updated", handleTicketsUpdated);
    window.addEventListener("gdg:merchandise-updated", handleMerchandiseUpdated);

    return () => {
      isMounted = false;
      unsubscribe?.();
      window.removeEventListener("gdg:tickets-updated", handleTicketsUpdated);
      window.removeEventListener("gdg:merchandise-updated", handleMerchandiseUpdated);
    };
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

  const handleToggleVisibility = (bundleId: string) => {
    const target = bundles.find((b) => b.id === bundleId);
    if (!target) return;
    const willBeHidden = target.status !== "hidden";
    const nextStatus = willBeHidden ? "hidden" : "active";
    setBundles((prev) =>
      prev.map((b) => (b.id === bundleId ? { ...b, status: nextStatus, updated_at: new Date().toISOString() } : b)),
    );
    setIsDirty(true);
    toast.success(
      willBeHidden
        ? `Hidden bundle "${target.name}". Remember to save changes.`
        : `Bundle "${target.name}" is now visible. Remember to save changes.`,
    );
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
    const isMerchOnly = tpl.ticketTypeHint === "none";
    const primaryTicket = isMerchOnly
      ? undefined
      : eventTickets.find((t) => t.type === tpl.ticketTypeHint) || eventTickets[0];
    const ticketId = primaryTicket?.id;
    const ticketQuantity = isMerchOnly ? 0 : (tpl.ticketQuantityHint ?? 1);

    const isTicketOnly = tpl.merchandiseTagsHint && tpl.merchandiseTagsHint.length === 0;
    const includedMerch = isTicketOnly
      ? []
      : eventMerchandise.slice(0, 2).map((m) => ({
          merchandise_id: m.id,
          quantity: 1,
        }));

    const newBundle: EventBundlePackage = {
      id: `bundle-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: tpl.name,
      description: tpl.description,
      badge: tpl.badge,
      ticket_id: ticketId,
      ticket_quantity: ticketQuantity,
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
          window.dispatchEvent(
            new CustomEvent("gdg:bundles-updated", {
              detail: { eventId: String(event.id), bundles },
            }),
          );
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
            <span className="font-medium text-muted-foreground text-xs">Total Packages</span>
          </div>
          <p className="mt-2 font-bold text-2xl text-foreground tracking-tight">{bundles.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium text-muted-foreground text-xs">Active Packages</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-bold text-2xl text-foreground tracking-tight">{activeCount}</span>
            {bundles.some((b) => b.status === "hidden") && (
              <span className="text-muted-foreground text-xs">
                ({bundles.filter((b) => b.status === "hidden").length} hidden)
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-muted-foreground text-xs">Packages Sold</span>
          </div>
          <p className="mt-2 font-bold text-2xl text-foreground tracking-tight">{totalSold}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-muted-foreground text-xs">Bundle Revenue</span>
          </div>
          <p className="mt-2 font-bold text-2xl text-foreground tracking-tight">
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
                    className="flex cursor-pointer flex-col items-start gap-0.5 py-2 text-xs"
                    onClick={() => handleAddTemplate(tpl)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium text-foreground">{tpl.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Rp {tpl.price.toLocaleString("id-ID")}
                      </Badge>
                    </div>
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">{tpl.description}</span>
                  </DropdownMenuItem>
                ))}

                {templatesData.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">My Custom Templates</DropdownMenuLabel>
                    {templatesData.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        className="flex cursor-pointer items-center justify-between py-2 text-xs"
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PackageCheck className="size-7" />
              </div>
              <h3 className="mt-4 font-semibold text-base text-foreground">No Bundling Packages Yet</h3>
              <p className="mt-1.5 max-w-md text-muted-foreground text-xs leading-relaxed">
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
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md",
                      b.status === "hidden" && "border-dashed opacity-60 bg-muted/20",
                    )}
                  >
                    {/* Top Row: Badges & Actions */}
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn("font-semibold text-[10px]", salesStatus.badgeColor)}>
                            {salesStatus.badgeLabel}
                          </Badge>
                          {b.badge && (
                            <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary">
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
                            onClick={() => handleToggleVisibility(b.id)}
                            title={
                              b.status === "hidden"
                                ? "Show bundle (Make visible to attendees)"
                                : "Hide bundle (Hide from attendees)"
                            }
                            aria-label={b.status === "hidden" ? `Show ${b.name}` : `Hide ${b.name}`}
                            className={cn(
                              "size-7 text-muted-foreground hover:text-foreground",
                              b.status === "hidden" && "text-amber-600 hover:text-amber-500 dark:text-amber-400",
                            )}
                          >
                            {b.status === "hidden" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
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
                      <h4 className="line-clamp-1 font-semibold text-foreground text-sm">{b.name}</h4>
                      {b.description && (
                        <p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                          {b.description}
                        </p>
                      )}

                      {/* Pricing block */}
                      <div className="mt-3.5 flex items-baseline gap-2">
                        <span className="font-bold text-foreground text-lg">
                          {b.price === 0 ? "Free (Rp 0)" : `Rp ${b.price.toLocaleString("id-ID")}`}
                        </span>
                        {pricing.standaloneTotal > b.price && (
                          <span className="text-muted-foreground text-xs line-through">
                            Rp {pricing.standaloneTotal.toLocaleString("id-ID")}
                          </span>
                        )}
                        {pricing.savings > 0 && (
                          <span className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
                            Save {pricing.discountPercentage}%
                          </span>
                        )}
                      </div>

                      {/* Included Items Details */}
                      <div className="mt-4 space-y-2.5 rounded-lg bg-muted/40 p-3 text-xs">
                        {/* Included Ticket */}
                        {b.ticket_id ? (
                          <div className="flex items-center gap-2">
                            <Ticket className="size-3.5 shrink-0 text-primary" />
                            <span className="shrink-0 font-medium text-muted-foreground">Ticket:</span>
                            <span className="truncate font-semibold text-foreground">
                              {b.ticket_quantity && b.ticket_quantity > 1 ? (
                                <span className="inline-flex items-center gap-1">
                                  <Badge variant="secondary" className="px-1 py-0 font-bold text-[10px]">
                                    {b.ticket_quantity}x
                                  </Badge>
                                  {linkedTicket?.name || "Regular Admission Ticket"}
                                  {b.generate_vouchers !== false && (
                                    <span className="font-normal text-[10px] text-muted-foreground">
                                      ({b.ticket_quantity - 1} friend vouchers)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                linkedTicket?.name || "Regular Admission Ticket"
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground italic">
                            <Ticket className="size-3.5 shrink-0 opacity-40" />
                            <span>Merchandise-only package (no admission ticket)</span>
                          </div>
                        )}

                        {/* Included Merchandise Items */}
                        <div className="flex items-start gap-2">
                          <Package className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-muted-foreground">Merch: </span>
                            {b.merchandise_items.length === 0 ? (
                              <span className="text-muted-foreground italic">None (Ticket-only package)</span>
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
                                      className="px-1.5 py-0 font-normal text-[10px]"
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
                    <div className="mt-4 border-t pt-3 text-xs">
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
                  <strong>{bundles.length}</strong> bundling packages configured (
                  {bundles.filter((b) => b.status !== "hidden").length} visible,{" "}
                  {bundles.filter((b) => b.status === "hidden").length} hidden). Attendees will see visible package
                  options highlighted during registration.
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateNew}
                className="gap-1.5 self-end text-xs sm:self-auto"
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
        isLoading={isLoadingItems}
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
