"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ExternalLink, Eye, EyeOff, GripVertical, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import {
  fetchFeaturedEventBevyListAction,
  type PublishedEventOption,
} from "@/app/(main)/dashboard/featured-event/_actions/fetch-bevy-events";
import { BevyEventSelector } from "@/app/(main)/dashboard/featured-event/_components/bevy-event-selector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { usePartnershipContent } from "@/lib/content/hooks";
import { type EventTokenContext, resolveEventTokens, resolveStatTokens } from "@/lib/content/token-resolver";
import type { PartnershipFaq, PartnershipFormat, PartnershipTier } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { fetchBevyChapterLiveMetricsAction, fetchBevyEventDetailForSpotlightAction } from "@/server/bevy-actions";

import { FormatDialog } from "./format-dialog";
import { TierDialog } from "./tier-dialog";

interface PartnershipDashboardProps {
  initialEvents?: PublishedEventOption[];
}

export function PartnershipDashboard({ initialEvents = [] }: PartnershipDashboardProps = {}) {
  const { content, setContent, hasChanges, discardChanges, saving, saveContent, resetToDefaults } =
    usePartnershipContent();

  const [availableEvents, setAvailableEvents] = useState<PublishedEventOption[]>(initialEvents);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSyncingEvent, setIsSyncingEvent] = useState(false);
  const [spotlightEventContext, setSpotlightEventContext] = useState<EventTokenContext | undefined>(undefined);

  const {
    showPrompt: showUnsavedPrompt,
    setShowPrompt: setShowUnsavedPrompt,
    isSaving: isSavingAndLeaving,
    cancelNavigation,
    confirmDiscardAndLeave,
    confirmSaveAndLeave,
  } = useUnsavedChanges({
    hasChanges,
    onSave: async () => saveContent(content),
    onDiscard: discardChanges,
  });

  const [activeTab, setActiveTab] = useState("hero");
  const heroDescRef = useRef<HTMLTextAreaElement>(null);

  const insertTokenIntoHeroDesc = (tokenStr: string) => {
    const textarea = heroDescRef.current;
    const currentVal = content.hero.description || "";
    if (!textarea) {
      setContent({ ...content, hero: { ...content.hero, description: `${currentVal} ${tokenStr}`.trim() } });
      return;
    }
    const start = textarea.selectionStart ?? currentVal.length;
    const end = textarea.selectionEnd ?? currentVal.length;
    const nextVal = currentVal.substring(0, start) + tokenStr + currentVal.substring(end);
    setContent({ ...content, hero: { ...content.hero, description: nextVal } });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tokenStr.length, start + tokenStr.length);
    }, 0);
  };
  // Fetch / refresh published Bevy events list if not pre-populated
  const handleRefreshBevyEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetchFeaturedEventBevyListAction();
      if (res.success && res.events) {
        setAvailableEvents(res.events);
        toast.success("Bevy events updated", {
          description: `Loaded ${res.events.length} events from Bevy.`,
        });
      }
    } catch {
      toast.error("Failed to load Bevy events");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Auto-populate featured event fields from selected Bevy event
  const handleSelectFeaturedEvent = async (selected: PublishedEventOption | null) => {
    if (!selected) {
      setSpotlightEventContext(undefined);
      setContent({
        ...content,
        devfest: {
          ...content.devfest,
          eventId: undefined,
        },
      });
      toast.info("Cleared linked event", {
        description: "Featured event spotlight is now in custom manual mode.",
      });
      return;
    }

    setIsSyncingEvent(true);
    try {
      const detailRes = await fetchBevyEventDetailForSpotlightAction(selected.id);
      const detailData = detailRes.success ? detailRes.data : null;

      if (detailData) {
        setSpotlightEventContext({
          title: detailData.title,
          formattedDate: detailData.formattedDate,
          formattedHours: detailData.formattedHours,
          venueName: detailData.venueName,
          venueAddress: detailData.venueAddress,
          totalCapacity: detailData.totalCapacity,
          totalAttendees: detailData.totalAttendees,
        });
      } else {
        setSpotlightEventContext({
          title: selected.title,
          formattedDate: selected.formattedDate,
          formattedHours: selected.formattedTime ? `${selected.formattedTime} WIB` : undefined,
          venueName: selected.venueName,
          venueAddress: selected.venueAddress,
        });
      }

      const title = detailData?.title || selected.title || content.devfest.title;
      const narrative = detailData?.description || selected.descriptionShort || content.devfest.description;
      const tracks = detailData?.tags && detailData.tags.length > 0 ? detailData.tags : content.devfest.tracks;

      // Update highlight date card if start date exists
      const updatedHighlights = [...content.devfest.highlights];
      if (selected.formattedDate && updatedHighlights.length > 1) {
        updatedHighlights[1] = {
          ...updatedHighlights[1],
          value: selected.formattedDate,
        };
      }

      setContent({
        ...content,
        devfest: {
          ...content.devfest,
          eventId: selected.id,
          title,
          description: narrative,
          tracks,
          highlights: updatedHighlights,
        },
      });

      toast.success("Linked Bevy Event Data!", {
        description: `Imported title, narrative, ${tracks.length} technology focus tracks from event tags, and dates.`,
      });
    } catch (err) {
      console.error("[PartnershipDashboard] Failed to fetch full event detail:", err);
      setContent({
        ...content,
        devfest: {
          ...content.devfest,
          eventId: selected.id,
          title: selected.title || content.devfest.title,
          description: selected.descriptionShort || content.devfest.description,
        },
      });
      toast.warning("Imported basic event data", {
        description: "Could not fetch full tags, but event title and narrative were linked.",
      });
    } finally {
      setIsSyncingEvent(false);
    }
  };

  // Auto-load event detail context when initial or loaded content has an eventId
  useEffect(() => {
    if (!content.devfest.eventId) return;
    let isCancelled = false;
    fetchBevyEventDetailForSpotlightAction(content.devfest.eventId)
      .then((res) => {
        if (!isCancelled && res.success && res.data) {
          setSpotlightEventContext({
            title: res.data.title,
            formattedDate: res.data.formattedDate,
            formattedHours: res.data.formattedHours,
            venueName: res.data.venueName,
            venueAddress: res.data.venueAddress,
            totalCapacity: res.data.totalCapacity,
            totalAttendees: res.data.totalAttendees,
          });
        }
      })
      .catch((err) => {
        console.warn("[PartnershipDashboard] Failed to fetch spotlight event details:", err);
      });
    return () => {
      isCancelled = true;
    };
  }, [content.devfest.eventId]);

  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PartnershipTier | null>(null);
  const [tierToDelete, setItemTierToDelete] = useState<PartnershipTier | null>(null);

  // Format modal state
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [editingFormat, setEditingFormat] = useState<PartnershipFormat | null>(null);
  const [formatToDelete, setFormatToDelete] = useState<PartnershipFormat | null>(null);

  // Reset confirmation state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // New Sponsor FAQ dialog / inline state
  const [newFaqQuestion, setNewFaqQuestion] = useState("");
  const [newFaqAnswer, setNewFaqAnswer] = useState("");

  // ── Tier Handlers ──────────────────────────────────────────────────────────
  const handleSaveTier = (tier: PartnershipTier) => {
    const existingIndex = content.tiers.findIndex((t) => t.id === tier.id);
    let updated: PartnershipTier[];
    if (existingIndex >= 0) {
      updated = [...content.tiers];
      updated[existingIndex] = tier;
    } else {
      updated = [...content.tiers, tier];
    }
    setContent({ ...content, tiers: updated });
  };

  const handleDeleteTier = (id: string) => {
    setContent({ ...content, tiers: content.tiers.filter((t) => t.id !== id) });
    setItemTierToDelete(null);
  };

  // ── Format Handlers ────────────────────────────────────────────────────────
  const handleSaveFormat = (fmt: PartnershipFormat) => {
    const existingIndex = content.formats.findIndex((f) => f.id === fmt.id);
    let updated: PartnershipFormat[];
    if (existingIndex >= 0) {
      updated = [...content.formats];
      updated[existingIndex] = fmt;
    } else {
      updated = [...content.formats, fmt];
    }
    setContent({ ...content, formats: updated });
  };

  const handleDeleteFormat = (id: string) => {
    setContent({ ...content, formats: content.formats.filter((f) => f.id !== id) });
    setFormatToDelete(null);
  };

  // ── Sponsor FAQ Handlers ───────────────────────────────────────────────────
  const handleAddSponsorFaq = () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
    const newFaq: PartnershipFaq = {
      id: `sp-faq-${Date.now()}`,
      question: newFaqQuestion.trim(),
      answer: newFaqAnswer.trim(),
    };
    setContent({ ...content, faqs: [...content.faqs, newFaq] });
    setNewFaqQuestion("");
    setNewFaqAnswer("");
  };

  const handleDeleteSponsorFaq = (id: string) => {
    setContent({ ...content, faqs: content.faqs.filter((f) => f.id !== id) });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-foreground text-xl tracking-tight sm:text-2xl lg:text-3xl">
              Partnership & Sponsorship Configuration
            </h1>
            <Badge variant="outline" className="hidden text-xs sm:inline-flex">
              Live Editor
            </Badge>
            {hasChanges && (
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium animate-in fade-in duration-200"
              >
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                </span>
                Unsaved Changes
              </Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            Configure sponsorship tiers, featured event spotlight, collaboration formats, and inquiry contact settings.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button variant="outline" size="sm" asChild className="justify-center gap-1.5 text-xs">
            <Link href="/partnership" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              <span>Preview Live</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="justify-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation - Horizontally scrollable on mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="-mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-9 w-max items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
            <TabsTrigger value="hero" className="whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Hero & Metrics
            </TabsTrigger>
            <TabsTrigger value="tiers" className="whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Sponsorship Tiers ({content.tiers.length})
            </TabsTrigger>
            <TabsTrigger value="formats" className="whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Featured Event & Formats
            </TabsTrigger>
            <TabsTrigger value="whyus" className="whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Brand Benefits & Why Us
            </TabsTrigger>
            <TabsTrigger value="contact" className="whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              Sponsor FAQ & Contact
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── 1. Hero & Metrics Tab ── */}
        <TabsContent value="hero" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Partnership Hero Header</CardTitle>
                <CardDescription className="text-xs">
                  Headline, badge, and lead narrative shown at the top of the Partnership page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hero-badge" className="text-xs">
                    Badge Pill Text
                  </Label>
                  <Input
                    id="hero-badge"
                    value={content.hero.badge}
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, badge: e.target.value } })}
                    placeholder="Brand Collaboration & Sponsorship"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hero-title" className="text-xs">
                    Main Headline
                  </Label>
                  <Input
                    id="hero-title"
                    value={content.hero.title}
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, title: e.target.value } })}
                    placeholder="Empower Indonesia's Premier Developer Community"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="hero-desc" className="text-xs">
                      Lead Paragraph
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Drag or click token chips to inject dynamic stat numbers
                    </span>
                  </div>

                  {/* Draggable & Clickable Stat Tokens Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--theme-border)] bg-muted/40 p-2">
                    <span className="mr-1 font-medium text-[11px] text-muted-foreground">Tokens:</span>
                    {content.hero.stats.map((stat, idx) => {
                      const tokenString = `{{stat:${stat.id}}}`;
                      return (
                        <button
                          key={stat.id || idx}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", tokenString);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => insertTokenIntoHeroDesc(tokenString)}
                          title={`Drag into paragraph or click to insert at cursor (${tokenString} -> ${stat.value})`}
                          className="inline-flex cursor-grab items-center gap-1 rounded-md border border-[var(--theme-border)] bg-background px-2 py-0.5 font-mono text-[11px] text-foreground shadow-xs transition-all hover:border-[var(--theme-primary)] hover:bg-muted active:cursor-grabbing active:scale-95"
                        >
                          <GripVertical className="size-3 text-muted-foreground" />
                          <span className="font-semibold text-[var(--theme-primary)]">{stat.value}</span>
                          <span className="text-muted-foreground">({stat.label})</span>
                        </button>
                      );
                    })}
                  </div>

                  <Textarea
                    ref={heroDescRef}
                    id="hero-desc"
                    rows={4}
                    value={content.hero.description}
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, description: e.target.value } })}
                    placeholder="Connect your brand with over {{stat:stat-1}} passionate software engineers..."
                  />

                  {/* Live Resolved Preview */}
                  <div className="rounded-md border border-dashed border-[var(--theme-border)] bg-muted/20 p-2.5">
                    <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                      Live Preview (Resolved):
                    </p>
                    <p className="mt-1 text-foreground/90 text-xs leading-relaxed">
                      {resolveStatTokens(content.hero.description, content.hero.stats) || (
                        <span className="italic text-muted-foreground">No description entered</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hero-email" className="text-xs">
                      Official Contact Email
                    </Label>
                    <Input
                      id="hero-email"
                      value={content.hero.contactEmail}
                      onChange={(e) =>
                        setContent({ ...content, hero: { ...content.hero, contactEmail: e.target.value } })
                      }
                      placeholder="hello@gdgjakarta.org"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hero-deck" className="text-xs">
                      Proposal Deck URL (Optional)
                    </Label>
                    <Input
                      id="hero-deck"
                      value={content.hero.proposalDeckUrl || ""}
                      onChange={(e) =>
                        setContent({ ...content, hero: { ...content.hero, proposalDeckUrl: e.target.value } })
                      }
                      placeholder="https://drive.google.com/..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Pills */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Key Metrics & Social Proof Pills</CardTitle>
                  <CardDescription className="text-xs">
                    Stats rendered as highlights underneath the hero section (Quota: max 6 items).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetchBevyChapterLiveMetricsAction();
                        if (res.success && res.data) {
                          const updated = content.hero.stats.map((s) => {
                            if (
                              s.autoSyncMetric === "members" ||
                              s.id === "stat-1" ||
                              s.label.toLowerCase().includes("member")
                            ) {
                              return { ...s, value: res.data.formattedMembers, autoSyncMetric: "members" as const };
                            }
                            if (
                              s.autoSyncMetric === "events" ||
                              s.id === "stat-3" ||
                              s.label.toLowerCase().includes("activities")
                            ) {
                              return { ...s, value: res.data.formattedEvents, autoSyncMetric: "events" as const };
                            }
                            if (s.autoSyncMetric === "team" || s.label.toLowerCase().includes("organizer")) {
                              return { ...s, value: res.data.formattedTeam, autoSyncMetric: "team" as const };
                            }
                            return s;
                          });
                          setContent({ ...content, hero: { ...content.hero, stats: updated } });
                          toast.success("Updated with live Bevy stats!", {
                            description: `Members: ${res.data.formattedMembers}, Activities: ${res.data.formattedEvents}`,
                          });
                        }
                      } catch {
                        toast.error("Failed to fetch live stats from Bevy");
                      }
                    }}
                    className="h-8 gap-1.5 text-xs"
                    title="Pull latest live numbers from Bevy"
                  >
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span>Sync Live Numbers</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={content.hero.stats.length >= 6}
                    onClick={() => {
                      if (content.hero.stats.length >= 6) {
                        toast.warning("Quota reached: Maximum of 6 key metric pills allowed.");
                        return;
                      }
                      const newStat = {
                        id: `stat-${Date.now()}`,
                        label: "New Metric",
                        value: "100+",
                        autoSyncMetric: "none" as const,
                      };
                      setContent({
                        ...content,
                        hero: { ...content.hero, stats: [...content.hero.stats, newStat] },
                      });
                    }}
                    className="h-8 gap-1 text-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Metric ({content.hero.stats.length}/6)</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.hero.stats.map((stat, idx) => (
                  <div key={stat.id || idx} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="space-y-1 sm:w-1/4">
                        <Label className="text-[11px] text-muted-foreground">Stat Value (Override)</Label>
                        <Input
                          value={stat.value}
                          onChange={(e) => {
                            const updated = [...content.hero.stats];
                            updated[idx] = { ...stat, value: e.target.value };
                            setContent({ ...content, hero: { ...content.hero, stats: updated } });
                          }}
                          className="h-8 font-semibold text-xs"
                        />
                      </div>
                      <div className="space-y-1 sm:flex-1">
                        <Label className="text-[11px] text-muted-foreground">Description Label</Label>
                        <Input
                          value={stat.label}
                          onChange={(e) => {
                            const updated = [...content.hero.stats];
                            updated[idx] = { ...stat, label: e.target.value };
                            setContent({ ...content, hero: { ...content.hero, stats: updated } });
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1 sm:w-44">
                        <Label className="text-[11px] text-muted-foreground">Live Source</Label>
                        <Select
                          value={stat.autoSyncMetric || "none"}
                          onValueChange={(val) => {
                            const updated = [...content.hero.stats];
                            updated[idx] = { ...stat, autoSyncMetric: val as "members" | "events" | "team" | "none" };
                            setContent({ ...content, hero: { ...content.hero, stats: updated } });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Manual / Custom</SelectItem>
                            <SelectItem value="members">Bevy Members</SelectItem>
                            <SelectItem value="events">Bevy Activities</SelectItem>
                            <SelectItem value="team">Bevy Team</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex shrink-0 items-center justify-end sm:pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={content.hero.stats.length <= 1}
                          onClick={() => {
                            if (content.hero.stats.length <= 1) {
                              toast.warning("At least 1 key metric pill must remain.");
                              return;
                            }
                            const updated = content.hero.stats.filter((_, i) => i !== idx);
                            setContent({ ...content, hero: { ...content.hero, stats: updated } });
                          }}
                          className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Remove metric item"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 2. Sponsorship Tiers Tab ── */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-base">Available Sponsorship Packages</h2>
              <p className="text-muted-foreground text-xs">
                Packages displayed in the interactive grid with deliverables and inquiry links.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingTier(null);
                setTierDialogOpen(true);
              }}
              className="w-full justify-center gap-1.5 font-semibold text-xs sm:w-auto"
            >
              <Plus className="size-3.5" />
              <span>Add New Tier</span>
            </Button>
          </div>

          {/* Mobile Card List View (< sm) */}
          <div className="space-y-3 sm:hidden">
            {content.tiers.map((tier) => (
              <Card
                key={tier.id}
                className={cn(
                  "space-y-3 p-4 transition-all",
                  tier.isActive === false && "border-dashed bg-muted/20 opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sm">{tier.name}</span>
                      {tier.badge && (
                        <Badge variant={tier.popular ? "default" : "secondary"} className="text-[10px]">
                          {tier.badge}
                        </Badge>
                      )}
                      {tier.isActive === false && (
                        <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    {tier.description && (
                      <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">{tier.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-primary hover:text-primary"
                      onClick={() => {
                        setEditingTier(tier);
                        setTierDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setItemTierToDelete(tier)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  {tier.slots && (
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                      {tier.slots}
                    </span>
                  )}
                  <span>•</span>
                  <span>{tier.highlights?.length || 0} deliverables</span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t pt-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
                    <Label htmlFor={`m-visible-${tier.id}`} className="cursor-pointer font-medium text-xs">
                      Visible
                    </Label>
                    <Switch
                      id={`m-visible-${tier.id}`}
                      checked={tier.isActive !== false}
                      onCheckedChange={(checked) => {
                        const updated = content.tiers.map((t) => (t.id === tier.id ? { ...t, isActive: checked } : t));
                        setContent({ ...content, tiers: updated });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
                    <Label htmlFor={`m-featured-${tier.id}`} className="cursor-pointer font-medium text-xs">
                      Featured
                    </Label>
                    <Switch
                      id={`m-featured-${tier.id}`}
                      checked={Boolean(tier.popular)}
                      onCheckedChange={(checked) => {
                        const updated = content.tiers.map((t) => (t.id === tier.id ? { ...t, popular: checked } : t));
                        setContent({ ...content, tiers: updated });
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop / Tablet Table View (>= sm) */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tier Name</TableHead>
                      <TableHead className="text-xs">Badge</TableHead>
                      <TableHead className="text-xs">Slots Available</TableHead>
                      <TableHead className="text-xs">Highlights</TableHead>
                      <TableHead className="text-center text-xs">Visible</TableHead>
                      <TableHead className="text-center text-xs">Featured</TableHead>
                      <TableHead className="text-right text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {content.tiers.map((tier) => (
                      <TableRow key={tier.id} className={cn(tier.isActive === false && "opacity-60")}>
                        <TableCell className="font-semibold text-xs sm:text-sm">
                          <div className="flex items-center gap-1.5">
                            <span>{tier.name}</span>
                            {tier.isActive === false && (
                              <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
                                Hidden
                              </Badge>
                            )}
                          </div>
                          {tier.description && (
                            <p className="line-clamp-1 font-normal text-[11px] text-muted-foreground">
                              {tier.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {tier.badge ? (
                            <Badge variant={tier.popular ? "default" : "secondary"} className="text-[10px]">
                              {tier.badge}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{tier.slots}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {tier.highlights?.length || 0} items
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={tier.isActive !== false}
                            onCheckedChange={(checked) => {
                              const updated = content.tiers.map((t) =>
                                t.id === tier.id ? { ...t, isActive: checked } : t,
                              );
                              setContent({ ...content, tiers: updated });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={Boolean(tier.popular)}
                            onCheckedChange={(checked) => {
                              const updated = content.tiers.map((t) =>
                                t.id === tier.id ? { ...t, popular: checked } : t,
                              );
                              setContent({ ...content, tiers: updated });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-primary hover:text-primary"
                              onClick={() => {
                                setEditingTier(tier);
                                setTierDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => setItemTierToDelete(tier)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Featured Event & Formats Tab ── */}
        <TabsContent value="formats" className="space-y-6">
          {/* Featured Event Spotlight Editor */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Featured Event Spotlight</CardTitle>
                  <Badge
                    variant={content.devfest.visible !== false ? "default" : "outline"}
                    className={cn(
                      "text-[10px]",
                      content.devfest.visible === false && "border-dashed text-muted-foreground",
                    )}
                  >
                    {content.devfest.visible !== false ? "Visible" : "Hidden"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Link an actual published Bevy event to auto-populate title, narrative, dates, and technology focus
                  tracks from event tags, or override manually.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <div className="flex items-center gap-2 rounded-md border border-[var(--theme-border)] bg-muted/40 px-2.5 py-1">
                  <span className="text-xs font-medium text-foreground">Visible on Page</span>
                  <Switch
                    checked={content.devfest.visible !== false}
                    onCheckedChange={(checked) =>
                      setContent({ ...content, devfest: { ...content.devfest, visible: checked } })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshBevyEvents}
                  disabled={isLoadingEvents}
                  className="h-8 gap-1.5 text-xs"
                  title="Refresh Bevy events list"
                >
                  <RefreshCw className={cn("size-3.5", isLoadingEvents && "animate-spin")} />
                  <span>Refresh Events</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bevy Event Linker Selector */}
              <div className="space-y-1.5 rounded-lg border border-[var(--theme-border)] bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-xs text-foreground">
                    Link Actual Published Event (Bevy API)
                  </Label>
                  {isSyncingEvent && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--theme-primary)]">
                      <RefreshCw className="size-3 animate-spin" />
                      Syncing tags & narrative...
                    </span>
                  )}
                </div>
                <BevyEventSelector
                  events={availableEvents}
                  selectedEventId={content.devfest.eventId}
                  onSelectEvent={handleSelectFeaturedEvent}
                  isLoading={isLoadingEvents || isSyncingEvent}
                />
                <p className="text-[11px] text-muted-foreground">
                  Selecting an event automatically sets the title, narrative from description, and technology tracks
                  from tags. You can freely edit or override any field below.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="df-name" className="text-xs">
                    Event Title
                  </Label>
                  <Input
                    id="df-name"
                    value={content.devfest.title}
                    onChange={(e) => setContent({ ...content, devfest: { ...content.devfest, title: e.target.value } })}
                    placeholder="e.g. DevFest Jakarta 2026, Google I/O Extended, AI Summit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="df-badge" className="text-xs">
                    Event Badge
                  </Label>
                  <Input
                    id="df-badge"
                    value={content.devfest.badge}
                    onChange={(e) => setContent({ ...content, devfest: { ...content.devfest, badge: e.target.value } })}
                    placeholder="e.g. Flagship Community Event, Annual Tech Summit"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="df-desc" className="text-xs">
                    Event Narrative (from event description, overridable)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Custom editorial override supported</span>
                </div>
                <Textarea
                  id="df-desc"
                  rows={4}
                  value={content.devfest.description}
                  onChange={(e) =>
                    setContent({ ...content, devfest: { ...content.devfest, description: e.target.value } })
                  }
                  placeholder="Describe the featured event, marquee sessions, hands-on labs, and exhibition floors..."
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="df-tracks" className="text-xs">
                    Event Technology Focus & Tracks (comma separated, sourced from event tags)
                  </Label>
                  {content.devfest.tracks.length > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {content.devfest.tracks.length} track(s)
                    </span>
                  )}
                </div>
                <Input
                  id="df-tracks"
                  value={content.devfest.tracks.join(", ")}
                  onChange={(e) => {
                    const tracks = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setContent({ ...content, devfest: { ...content.devfest, tracks } });
                  }}
                  placeholder="Generative AI & ML, Cloud Architecture & DevOps, Modern Web, Android..."
                />
                {content.devfest.tracks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {content.devfest.tracks.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Event Highlight Cards */}
              <div className="space-y-3 border-t pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label className="font-semibold text-xs">Featured Event Highlight Cards</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Quota: 2 to 6 cards. Drag or type tokens like{" "}
                      <code className="rounded bg-muted px-1 font-mono text-[10px]">{"{{event:date}}"}</code> or{" "}
                      <code className="rounded bg-muted px-1 font-mono text-[10px]">{"{{event:hours}}"}</code> to stay
                      up-to-date with event data.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={content.devfest.highlights.length >= 6}
                    onClick={() => {
                      if (content.devfest.highlights.length >= 6) {
                        toast.warning("Maximum 6 highlight cards reached.");
                        return;
                      }
                      const newId = `h-${Date.now()}`;
                      const updated = [
                        ...content.devfest.highlights,
                        { id: newId, label: "New Metric", value: "Custom Value" },
                      ];
                      setContent({ ...content, devfest: { ...content.devfest, highlights: updated } });
                    }}
                    className="h-8 gap-1 text-xs self-start sm:self-auto"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Card</span>
                    <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                      ({content.devfest.highlights.length}/6)
                    </span>
                  </Button>
                </div>

                {/* Draggable Event Data Tokens Panel */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--theme-border)] bg-muted/40 p-2">
                  <span className="mr-1 font-medium text-[11px] text-muted-foreground">Event Tokens:</span>
                  {[
                    {
                      tag: "{{event:date}}",
                      label: "Date",
                      preview: spotlightEventContext?.formattedDate || "Sun, 1 Nov 2026",
                    },
                    {
                      tag: "{{event:hours}}",
                      label: "Hours",
                      preview: spotlightEventContext?.formattedHours || "09:00 - 18:00 WIB",
                    },
                    {
                      tag: "{{event:capacity}}",
                      label: "Capacity",
                      preview: spotlightEventContext?.totalCapacity
                        ? `${spotlightEventContext.totalCapacity}+`
                        : "1,500+",
                    },
                    {
                      tag: "{{event:venue}}",
                      label: "Venue",
                      preview: spotlightEventContext?.venueName || "Jakarta, Indonesia",
                    },
                  ].map((tok, idx) => (
                    <button
                      key={idx}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", tok.tag);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      title={`Drag token ${tok.tag} into any card input. Resolves to: ${tok.preview}`}
                      className="inline-flex cursor-grab items-center gap-1 rounded-md border border-[var(--theme-border)] bg-background px-2 py-0.5 font-mono text-[11px] text-foreground shadow-xs transition-all hover:border-[var(--theme-primary)] hover:bg-muted active:cursor-grabbing active:scale-95"
                    >
                      <GripVertical className="size-3 text-muted-foreground" />
                      <span className="font-semibold text-[var(--theme-primary)]">{tok.tag}</span>
                      <span className="text-muted-foreground">({tok.preview})</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {content.devfest.highlights.map((h, idx) => {
                    const resolvedValue = resolveEventTokens(h.value, spotlightEventContext);
                    const isTokenized = h.value.includes("{{");

                    return (
                      <div key={h.id || idx} className="relative space-y-1 rounded-lg border p-2.5 bg-card/60">
                        <div className="flex items-center justify-between pb-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">Card #{idx + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (content.devfest.highlights.length <= 1) {
                                toast.warning("At least 1 highlight card must remain.");
                                return;
                              }
                              const updated = content.devfest.highlights.filter((_, i) => i !== idx);
                              setContent({ ...content, devfest: { ...content.devfest, highlights: updated } });
                            }}
                            className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Remove highlight card"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>

                        <Input
                          value={h.value}
                          onChange={(e) => {
                            const updated = [...content.devfest.highlights];
                            updated[idx] = { ...h, value: e.target.value };
                            setContent({ ...content, devfest: { ...content.devfest, highlights: updated } });
                          }}
                          className="h-7 font-bold text-xs"
                          placeholder="e.g. {{event:date}} or 1,500+ Hybrid"
                        />
                        <Input
                          value={h.label}
                          onChange={(e) => {
                            const updated = [...content.devfest.highlights];
                            updated[idx] = { ...h, label: e.target.value };
                            setContent({ ...content, devfest: { ...content.devfest, highlights: updated } });
                          }}
                          className="h-6 text-[11px] text-muted-foreground"
                          placeholder="e.g. Conference Date"
                        />

                        {isTokenized && (
                          <div className="pt-1 text-[10px] text-muted-foreground">
                            <span>Preview: </span>
                            <span className="font-semibold text-foreground">{resolvedValue}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formats Section */}
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-base">Collaboration Formats</h3>
                <p className="text-muted-foreground text-xs">
                  Cards detailing the various collaboration mechanisms (Codelabs, Hackathons, Meetups, Merch).
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingFormat(null);
                  setFormatDialogOpen(true);
                }}
                className="w-full justify-center gap-1.5 font-semibold text-xs sm:w-auto"
              >
                <Plus className="size-3.5" />
                <span>Add Format</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {content.formats.map((fmt) => (
                <Card
                  key={fmt.id}
                  className={cn(
                    "relative flex flex-col justify-between transition-all",
                    fmt.isActive === false && "border-dashed bg-muted/20 opacity-60",
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {fmt.tag}
                        </Badge>
                        {fmt.isActive === false && (
                          <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-7",
                            fmt.isActive === false
                              ? "text-muted-foreground hover:text-foreground"
                              : "text-primary hover:text-primary",
                          )}
                          title={
                            fmt.isActive === false
                              ? "Hidden from public page (Click to show)"
                              : "Visible on public page (Click to hide)"
                          }
                          onClick={() => {
                            const updated = content.formats.map((f) =>
                              f.id === fmt.id ? { ...f, isActive: f.isActive === false } : f,
                            );
                            setContent({ ...content, formats: updated });
                          }}
                        >
                          {fmt.isActive === false ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setEditingFormat(fmt);
                            setFormatDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setFormatToDelete(fmt)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="mt-2 font-bold text-sm">{fmt.title}</CardTitle>
                    <CardDescription className="line-clamp-3 text-xs leading-relaxed">
                      {fmt.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="font-semibold text-[11px] text-muted-foreground">
                      {fmt.deliverables.length} Touchpoints Included
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── 4. Brand Benefits & Why Us Tab ── */}
        <TabsContent value="whyus" className="space-y-6">
          {/* Why Us Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why Brands Partner With GDG Jakarta</CardTitle>
              <CardDescription className="text-xs">
                Key value proposition cards explaining community trust, technical credibility, and developer reach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {content.whyUs.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={cn(
                      "space-y-2 rounded-xl border bg-muted/20 p-4 transition-all",
                      item.isActive === false && "border-dashed opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input
                          value={item.badge}
                          onChange={(e) => {
                            const updated = [...content.whyUs];
                            updated[idx] = { ...item, badge: e.target.value };
                            setContent({ ...content, whyUs: updated });
                          }}
                          className="h-6 w-28 bg-background text-[10px]"
                          placeholder="Direct Reach"
                        />
                        {item.isActive === false && (
                          <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor={`whyus-active-${item.id || idx}`}
                          className="cursor-pointer text-[11px] text-muted-foreground"
                        >
                          Visible
                        </Label>
                        <Switch
                          id={`whyus-active-${item.id || idx}`}
                          checked={item.isActive !== false}
                          onCheckedChange={(checked) => {
                            const updated = [...content.whyUs];
                            updated[idx] = { ...item, isActive: checked };
                            setContent({ ...content, whyUs: updated });
                          }}
                        />
                      </div>
                    </div>
                    <Input
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...content.whyUs];
                        updated[idx] = { ...item, title: e.target.value };
                        setContent({ ...content, whyUs: updated });
                      }}
                      className="h-8 bg-background font-semibold text-xs"
                      placeholder="Title"
                    />
                    <Textarea
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...content.whyUs];
                        updated[idx] = { ...item, description: e.target.value };
                        setContent({ ...content, whyUs: updated });
                      }}
                      rows={3}
                      className="bg-background text-xs leading-relaxed"
                      placeholder="Description"
                    />

                    {/* Action Link Config */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Action Text</Label>
                        <Input
                          value={item.actionText || ""}
                          onChange={(e) => {
                            const updated = [...content.whyUs];
                            updated[idx] = { ...item, actionText: e.target.value };
                            setContent({ ...content, whyUs: updated });
                          }}
                          className="h-7 bg-background text-[11px]"
                          placeholder="e.g. See collaboration formats"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Action Target URL / Anchor</Label>
                        <Input
                          value={item.actionUrl || ""}
                          onChange={(e) => {
                            const updated = [...content.whyUs];
                            updated[idx] = { ...item, actionUrl: e.target.value };
                            setContent({ ...content, whyUs: updated });
                          }}
                          className="h-7 bg-background font-mono text-[11px]"
                          placeholder="e.g. #formats, #tiers, or https://..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Brand Deliverables ("What Brands Get") */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tangible Brand Deliverables</CardTitle>
              <CardDescription className="text-xs">
                Deliverable categories (Product Showcase, Stage Authority, Talent Acquisition, Long-Term Trust).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {content.benefits.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className={cn(
                      "space-y-3 rounded-xl border bg-muted/20 p-4 transition-all",
                      b.isActive === false && "border-dashed opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {b.category}
                        </Badge>
                        {b.isActive === false && (
                          <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor={`benefit-active-${b.id || idx}`}
                          className="cursor-pointer text-[11px] text-muted-foreground"
                        >
                          Visible
                        </Label>
                        <Switch
                          id={`benefit-active-${b.id || idx}`}
                          checked={b.isActive !== false}
                          onCheckedChange={(checked) => {
                            const updated = [...content.benefits];
                            updated[idx] = { ...b, isActive: checked };
                            setContent({ ...content, benefits: updated });
                          }}
                        />
                      </div>
                    </div>
                    <Input
                      value={b.title}
                      onChange={(e) => {
                        const updated = [...content.benefits];
                        updated[idx] = { ...b, title: e.target.value };
                        setContent({ ...content, benefits: updated });
                      }}
                      className="h-8 bg-background font-bold text-xs"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Deliverable Bullet Points</Label>
                      {b.points.map((pt, pIdx) => (
                        <Input
                          key={`${b.id || "b"}-${pt.slice(0, 20)}`}
                          value={pt}
                          onChange={(e) => {
                            const updated = [...content.benefits];
                            const updatedPts = [...b.points];
                            updatedPts[pIdx] = e.target.value;
                            updated[idx] = { ...b, points: updatedPts };
                            setContent({ ...content, benefits: updated });
                          }}
                          className="h-7 bg-background text-xs"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 5. Sponsor FAQ & Contact Tab ── */}
        <TabsContent value="contact" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Quick Inquiry Form & Contact Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Partnership CTA & Mail Launcher</CardTitle>
                <CardDescription className="text-xs">
                  Settings for the bottom sponsorship inquiry launcher.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cta-heading" className="text-xs">
                    Banner Title
                  </Label>
                  <Input
                    id="cta-heading"
                    value={content.contact.heading}
                    onChange={(e) =>
                      setContent({ ...content, contact: { ...content.contact, heading: e.target.value } })
                    }
                    placeholder="Let's Build Something Impactful Together!"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cta-subheading" className="text-xs">
                    Banner Subtitle
                  </Label>
                  <Textarea
                    id="cta-subheading"
                    rows={2}
                    value={content.contact.subheading}
                    onChange={(e) =>
                      setContent({ ...content, contact: { ...content.contact, subheading: e.target.value } })
                    }
                    placeholder="Ready to align your brand with Jakarta's premier developer community?"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cta-email" className="text-xs">
                      Target Mailto Address
                    </Label>
                    <Input
                      id="cta-email"
                      value={content.contact.contactEmail}
                      onChange={(e) =>
                        setContent({ ...content, contact: { ...content.contact, contactEmail: e.target.value } })
                      }
                      placeholder="hello@gdgjakarta.org"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cta-ig" className="text-xs">
                      Instagram URL
                    </Label>
                    <Input
                      id="cta-ig"
                      value={content.contact.instagramUrl}
                      onChange={(e) =>
                        setContent({ ...content, contact: { ...content.contact, instagramUrl: e.target.value } })
                      }
                      placeholder="https://instagram.com/gdgjakarta"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cta-person" className="text-xs">
                      Contact Person Lead (Optional)
                    </Label>
                    <Input
                      id="cta-person"
                      value={content.contact.contactPerson || ""}
                      onChange={(e) =>
                        setContent({ ...content, contact: { ...content.contact, contactPerson: e.target.value } })
                      }
                      placeholder="e.g. Partnership Lead"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cta-phone" className="text-xs">
                      Phone / WhatsApp Number (Optional)
                    </Label>
                    <Input
                      id="cta-phone"
                      value={content.contact.phoneOrWhatsapp || ""}
                      onChange={(e) =>
                        setContent({ ...content, contact: { ...content.contact, phoneOrWhatsapp: e.target.value } })
                      }
                      placeholder="e.g. (+62) 812-3456-7890"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cta-options" className="text-xs">
                    Interest Dropdown Options (comma separated)
                  </Label>
                  <Textarea
                    id="cta-options"
                    rows={3}
                    value={content.contact.interestOptions?.join(", ") || ""}
                    onChange={(e) => {
                      const opts = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setContent({ ...content, contact: { ...content.contact, interestOptions: opts } });
                    }}
                    placeholder="e.g. Featured Event - Gold Tier, Technical Workshop..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sponsor FAQs */}
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Sponsor Frequently Asked Questions</CardTitle>
                  <CardDescription className="text-xs">
                    Questions displayed inside the accordion on the partnership page. Tokenized with event data.
                  </CardDescription>
                </div>
                {content.devfest.eventId && (
                  <Badge variant="outline" className="w-fit text-[11px] font-normal text-muted-foreground gap-1">
                    <Sparkles className="size-3 text-amber-500" />
                    Bound to {content.devfest.title || "Featured Event"}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Event Tokens Chips for FAQ Authoring */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--theme-border)] bg-muted/40 p-2">
                  <span className="mr-1 font-medium text-[11px] text-muted-foreground">Available Event Tokens:</span>
                  {[
                    {
                      token: "{{event:title}}",
                      label: "Title",
                      val: spotlightEventContext?.title || content.devfest.title || "DevFest Jakarta 2026",
                    },
                    {
                      token: "{{event:date}}",
                      label: "Date",
                      val: spotlightEventContext?.formattedDate || "Sun, 1 Nov 2026",
                    },
                    {
                      token: "{{event:hours}}",
                      label: "Hours",
                      val: spotlightEventContext?.formattedHours || "09:00 - 18:00 WIB",
                    },
                    {
                      token: "{{event:venue}}",
                      label: "Venue",
                      val: spotlightEventContext?.venueName || "Jakarta, Indonesia",
                    },
                    {
                      token: "{{event:capacity}}",
                      label: "Capacity",
                      val: spotlightEventContext?.totalCapacity ? `${spotlightEventContext.totalCapacity}+` : "1,500+",
                    },
                  ].map((item) => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(item.token);
                        toast.success(`Copied ${item.token}`, {
                          description: `Resolves to: "${item.val}"`,
                        });
                      }}
                      title={`Click to copy token (${item.token} -> ${item.val})`}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--theme-border)] bg-background px-2 py-0.5 font-mono text-[11px] text-foreground shadow-xs transition-all hover:border-[var(--theme-primary)] hover:bg-muted active:scale-95"
                    >
                      <span className="font-semibold text-[var(--theme-primary)]">{item.token}</span>
                      <span className="text-muted-foreground">({item.val})</span>
                    </button>
                  ))}
                </div>

                {/* List of Sponsor FAQs */}
                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                  {content.faqs.map((f, idx) => {
                    const previewQuestion = resolveEventTokens(
                      f.question,
                      spotlightEventContext || {
                        title: content.devfest.title || "DevFest Jakarta 2026",
                        formattedDate: "Sun, 1 Nov 2026",
                        formattedHours: "09:00 - 18:00 WIB",
                        venueName: "Jakarta, Indonesia",
                        totalCapacity: "1,500+",
                      },
                    );
                    const previewAnswer = resolveEventTokens(
                      f.answer,
                      spotlightEventContext || {
                        title: content.devfest.title || "DevFest Jakarta 2026",
                        formattedDate: "Sun, 1 Nov 2026",
                        formattedHours: "09:00 - 18:00 WIB",
                        venueName: "Jakarta, Indonesia",
                        totalCapacity: "1,500+",
                      },
                    );

                    return (
                      <div key={f.id || idx} className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <Input
                            value={f.question}
                            onChange={(e) => {
                              const updated = [...content.faqs];
                              updated[idx] = { ...f, question: e.target.value };
                              setContent({ ...content, faqs: updated });
                            }}
                            className="h-7 bg-background font-semibold text-xs"
                            placeholder="Question with {{event:title}}..."
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-destructive"
                            onClick={() => handleDeleteSponsorFaq(f.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          value={f.answer}
                          onChange={(e) => {
                            const updated = [...content.faqs];
                            updated[idx] = { ...f, answer: e.target.value };
                            setContent({ ...content, faqs: updated });
                          }}
                          rows={2}
                          className="bg-background text-xs leading-relaxed"
                          placeholder="Answer with {{event:date}}, {{event:hours}}, {{event:venue}}..."
                        />
                        {(f.question.includes("{{") || f.answer.includes("{{")) && (
                          <div className="rounded border border-dashed border-[var(--theme-border)] bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-0.5">
                            <p className="font-semibold text-foreground">Preview (Resolved):</p>
                            <p className="font-medium text-foreground">{previewQuestion}</p>
                            <p className="line-clamp-2 leading-relaxed">{previewAnswer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add new FAQ item */}
                <div className="space-y-2 border-t pt-3">
                  <Label className="font-semibold text-xs">Add Sponsor Question</Label>
                  <Input
                    placeholder="Question (e.g. When and where will {{event:title}} take place?)..."
                    value={newFaqQuestion}
                    onChange={(e) => setNewFaqQuestion(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Textarea
                    placeholder="Clear answer explaining terms, timelines, or procedures (supports {{event:date}}, {{event:venue}})..."
                    value={newFaqAnswer}
                    onChange={(e) => setNewFaqAnswer(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSponsorFaq}
                    disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim()}
                    className="w-full gap-1.5 font-semibold text-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Sponsor Question</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tier Dialog */}
      <TierDialog open={tierDialogOpen} onOpenChange={setTierDialogOpen} tier={editingTier} onSave={handleSaveTier} />

      {/* Format Dialog */}
      <FormatDialog
        open={formatDialogOpen}
        onOpenChange={setFormatDialogOpen}
        format={editingFormat}
        onSave={handleSaveFormat}
      />

      {/* Delete Tier Confirmation Dialog */}
      <AlertDialog open={Boolean(tierToDelete)} onOpenChange={(open) => !open && setItemTierToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sponsorship tier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the &quot;{tierToDelete?.name}&quot; package from the public partnership page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tierToDelete && handleDeleteTier(tierToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Tier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Format Confirmation Dialog */}
      <AlertDialog open={Boolean(formatToDelete)} onOpenChange={(open) => !open && setFormatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collaboration format?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{formatToDelete?.title}&quot; from the collaboration formats section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formatToDelete && handleDeleteFormat(formatToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Format
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Partnership packages to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite all customized tiers, formats, and FAQs with the default packages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void resetToDefaults();
                setConfirmResetOpen(false);
              }}
            >
              Confirm Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedPrompt}
        onOpenChange={setShowUnsavedPrompt}
        onCancel={cancelNavigation}
        onDiscard={confirmDiscardAndLeave}
        onSave={confirmSaveAndLeave}
        saving={isSavingAndLeaving}
        title="Unsaved Partnership Changes"
        description="You have unsaved changes in your Partnership & Sponsorship configuration. If you leave without saving, your modifications will be discarded."
      />

      {/* ── Fixed Floating Bottom Save Bar ──────────────────────────── */}
      <FloatingSaveBar
        isDirty={hasChanges}
        isSaving={saving}
        onSave={() => void saveContent(content)}
        onDiscard={() => setConfirmResetOpen(true)}
        discardLabel="Reset Defaults"
        saveLabel="Save Changes"
        savingLabel="Saving Partnership..."
        savedLabel="All Saved"
        statusInfo={`${content.tiers.length} Tiers, ${content.formats.length} Formats`}
        helperText="Updates will immediately reflect on the public Partnership page."
      />
    </div>
  );
}
