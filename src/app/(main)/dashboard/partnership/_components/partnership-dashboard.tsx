"use client";

import { useState } from "react";

import Link from "next/link";

import {
  Award,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Gift,
  HelpCircle,
  Laptop,
  Lightbulb,
  Mail,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Rocket,
  Save,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  Zap,
} from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePartnershipContent } from "@/lib/content/hooks";
import type { PartnershipFaq, PartnershipFormat, PartnershipTier } from "@/lib/content/types";
import { cn } from "@/lib/utils";

import { FormatDialog } from "./format-dialog";
import { TierDialog } from "./tier-dialog";

export function PartnershipDashboard() {
  const { content, setContent, loading, saving, saveContent, resetToDefaults } = usePartnershipContent();

  const [activeTab, setActiveTab] = useState("hero");

  // Tier modal state
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
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Partnership & Sponsorship Configuration
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs">
              Live Editor
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure sponsorship tiers, featured event spotlight, collaboration formats, and inquiry contact settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link href="/partnership" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              <span>Preview Live Page</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            size="sm"
            onClick={() => saveContent(content)}
            disabled={saving || loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <Save className="size-3.5" />
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-5">
          <TabsTrigger value="hero" className="text-xs sm:text-sm">
            Hero & Metrics
          </TabsTrigger>
          <TabsTrigger value="tiers" className="text-xs sm:text-sm">
            Sponsorship Tiers ({content.tiers.length})
          </TabsTrigger>
          <TabsTrigger value="formats" className="text-xs sm:text-sm">
            Featured Event & Formats
          </TabsTrigger>
          <TabsTrigger value="whyus" className="text-xs sm:text-sm">
            Brand Benefits & Why Us
          </TabsTrigger>
          <TabsTrigger value="contact" className="text-xs sm:text-sm">
            Sponsor FAQ & Contact
          </TabsTrigger>
        </TabsList>

        {/* ── 1. Hero & Metrics Tab ── */}
        <TabsContent value="hero" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="space-y-1.5">
                  <Label htmlFor="hero-desc" className="text-xs">
                    Lead Paragraph
                  </Label>
                  <Textarea
                    id="hero-desc"
                    rows={4}
                    value={content.hero.description}
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, description: e.target.value } })}
                    placeholder="Connect your brand with over 10,000+ passionate software engineers..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <CardHeader>
                <CardTitle className="text-base">Key Metrics & Social Proof Pills</CardTitle>
                <CardDescription className="text-xs">
                  Stats rendered as highlights underneath the hero section.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.hero.stats.map((stat, idx) => (
                  <div key={stat.id || idx} className="grid grid-cols-2 gap-3 items-center rounded-lg border p-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Stat Value</Label>
                      <Input
                        value={stat.value}
                        onChange={(e) => {
                          const updated = [...content.hero.stats];
                          updated[idx] = { ...stat, value: e.target.value };
                          setContent({ ...content, hero: { ...content.hero, stats: updated } });
                        }}
                        className="text-xs h-8 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Description Label</Label>
                      <Input
                        value={stat.label}
                        onChange={(e) => {
                          const updated = [...content.hero.stats];
                          updated[idx] = { ...stat, label: e.target.value };
                          setContent({ ...content, hero: { ...content.hero, stats: updated } });
                        }}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 2. Sponsorship Tiers Tab ── */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Available Sponsorship Packages</h2>
              <p className="text-xs text-muted-foreground">
                Packages displayed in the interactive grid with deliverables and inquiry links.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingTier(null);
                setTierDialogOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>Add New Tier</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
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
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                              Hidden
                            </Badge>
                          )}
                        </div>
                        {tier.description && (
                          <p className="text-[11px] font-normal text-muted-foreground line-clamp-1">
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
                      <TableCell className="text-xs font-mono">{tier.slots}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Featured Event & Formats Tab ── */}
        <TabsContent value="formats" className="space-y-6">
          {/* Featured Event Spotlight Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Featured Event Spotlight</CardTitle>
              <CardDescription className="text-xs">
                The high-impact section highlighting featured event metrics and technology focus tracks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label htmlFor="df-desc" className="text-xs">
                  Event Narrative
                </Label>
                <Textarea
                  id="df-desc"
                  rows={3}
                  value={content.devfest.description}
                  onChange={(e) =>
                    setContent({ ...content, devfest: { ...content.devfest, description: e.target.value } })
                  }
                  placeholder="Describe the featured event, marquee sessions, hands-on labs, and exhibition floors..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="df-tracks" className="text-xs">
                  Event Technology Focus & Tracks (comma separated)
                </Label>
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
              </div>

              {/* Event Highlight Stats */}
              <div className="border-t pt-3">
                <Label className="text-xs font-semibold">Featured Event Highlight Cards</Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {content.devfest.highlights.map((h, idx) => (
                    <div key={h.id || idx} className="rounded-lg border p-2.5 space-y-1">
                      <Input
                        value={h.value}
                        onChange={(e) => {
                          const updated = [...content.devfest.highlights];
                          updated[idx] = { ...h, value: e.target.value };
                          setContent({ ...content, devfest: { ...content.devfest, highlights: updated } });
                        }}
                        className="text-xs h-7 font-bold"
                        placeholder="1,000+ In-Person"
                      />
                      <Input
                        value={h.label}
                        onChange={(e) => {
                          const updated = [...content.devfest.highlights];
                          updated[idx] = { ...h, label: e.target.value };
                          setContent({ ...content, devfest: { ...content.devfest, highlights: updated } });
                        }}
                        className="text-[11px] h-6 text-muted-foreground"
                        placeholder="Target Attendees"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formats Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Collaboration Formats</h3>
                <p className="text-xs text-muted-foreground">
                  Cards detailing the various collaboration mechanisms (Codelabs, Hackathons, Meetups, Merch).
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingFormat(null);
                  setFormatDialogOpen(true);
                }}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                <span>Add Format</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {content.formats.map((fmt) => (
                <Card
                  key={fmt.id}
                  className={cn(
                    "relative flex flex-col justify-between transition-all",
                    fmt.isActive === false && "opacity-60 border-dashed bg-muted/20",
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {fmt.tag}
                        </Badge>
                        {fmt.isActive === false && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
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
                    <CardTitle className="text-sm font-bold mt-2">{fmt.title}</CardTitle>
                    <CardDescription className="text-xs line-clamp-3 leading-relaxed">
                      {fmt.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="text-[11px] font-semibold text-muted-foreground">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.whyUs.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={cn(
                      "rounded-xl border p-4 space-y-2 bg-muted/20 transition-all",
                      item.isActive === false && "opacity-60 border-dashed",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={item.badge}
                          onChange={(e) => {
                            const updated = [...content.whyUs];
                            updated[idx] = { ...item, badge: e.target.value };
                            setContent({ ...content, whyUs: updated });
                          }}
                          className="text-[10px] h-6 w-28 bg-background"
                          placeholder="Direct Reach"
                        />
                        {item.isActive === false && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor={`whyus-active-${item.id || idx}`}
                          className="text-[11px] text-muted-foreground cursor-pointer"
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
                      className="text-xs font-semibold h-8 bg-background"
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
                      className="text-xs bg-background leading-relaxed"
                      placeholder="Description"
                    />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {content.benefits.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className={cn(
                      "rounded-xl border p-4 space-y-3 bg-muted/20 transition-all",
                      b.isActive === false && "opacity-60 border-dashed",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {b.category}
                        </Badge>
                        {b.isActive === false && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor={`benefit-active-${b.id || idx}`}
                          className="text-[11px] text-muted-foreground cursor-pointer"
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
                      className="text-xs font-bold bg-background h-8"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Deliverable Bullet Points</Label>
                      {b.points.map((pt, pIdx) => (
                        <Input
                          key={pIdx}
                          value={pt}
                          onChange={(e) => {
                            const updated = [...content.benefits];
                            const updatedPts = [...b.points];
                            updatedPts[pIdx] = e.target.value;
                            updated[idx] = { ...b, points: updatedPts };
                            setContent({ ...content, benefits: updated });
                          }}
                          className="text-xs h-7 bg-background"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <CardHeader>
                <CardTitle className="text-base">Sponsor Frequently Asked Questions</CardTitle>
                <CardDescription className="text-xs">
                  Questions displayed inside the accordion on the partnership page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* List of Sponsor FAQs */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {content.faqs.map((f, idx) => (
                    <div key={f.id || idx} className="rounded-lg border p-3 space-y-1.5 bg-muted/20">
                      <div className="flex items-start justify-between gap-2">
                        <Input
                          value={f.question}
                          onChange={(e) => {
                            const updated = [...content.faqs];
                            updated[idx] = { ...f, question: e.target.value };
                            setContent({ ...content, faqs: updated });
                          }}
                          className="text-xs font-semibold h-7 bg-background"
                          placeholder="Question..."
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive shrink-0"
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
                        className="text-xs bg-background leading-relaxed"
                        placeholder="Answer..."
                      />
                    </div>
                  ))}
                </div>

                {/* Add new FAQ item */}
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-xs font-semibold">Add Sponsor Question</Label>
                  <Input
                    placeholder="Question (e.g. Can you provide official invoices?)..."
                    value={newFaqQuestion}
                    onChange={(e) => setNewFaqQuestion(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Textarea
                    placeholder="Clear answer explaining terms, timelines, or procedures..."
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
                    className="gap-1.5 text-xs font-semibold w-full"
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
    </div>
  );
}
