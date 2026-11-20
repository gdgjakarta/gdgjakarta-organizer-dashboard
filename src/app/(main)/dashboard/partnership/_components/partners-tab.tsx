"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Pencil,
  PenTool,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { type SponsorDocumentsContext, SponsorDocumentsDialog } from "@/components/sponsor-documents-dialog";
import { SponsorLogoCropperDialog } from "@/components/sponsor-logo-cropper-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteChapterSponsorAction,
  getChapterSponsorsAction,
  getOrInitChapterSponsorConfigAction,
  regenerateChapterSponsorShareTokenAction,
  reorderChapterSponsorsAction,
  saveChapterSponsorAction,
  sendSponsorProposalEmailAction,
  updateChapterSponsorConfigAction,
} from "@/server/sponsor-actions";
import type { ChapterSponsorConfig, FirestoreSponsor, SponsorCategory, SponsorProposalStatus } from "@/types/sponsor";

const TIER_COLORS: Record<SponsorCategory, { badge: string; label: string }> = {
  platinum: { badge: "bg-purple-500/10 text-purple-600 border-purple-500/20", label: "Platinum" },
  gold: { badge: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Gold" },
  silver: { badge: "bg-slate-500/10 text-slate-600 border-slate-500/20", label: "Silver" },
  bronze: { badge: "bg-orange-500/10 text-orange-600 border-orange-500/20", label: "Bronze" },
  community: { badge: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Community" },
  partner: { badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Partner" },
  media_partner: { badge: "bg-pink-500/10 text-pink-600 border-pink-500/20", label: "Media Partner" },
};

function WhatsAppIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3" />
    </svg>
  );
}

interface PartnersTabProps {
  onSignPartnerPdf?: (sponsor: FirestoreSponsor) => void;
}

export function PartnersTab({ onSignPartnerPdf }: PartnersTabProps = {}) {
  const [sponsors, setSponsors] = useState<FirestoreSponsor[]>([]);
  const [originalSponsors, setOriginalSponsors] = useState<FirestoreSponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // View Mode: "table" vs "reorder" (Bevy style 4-column logo grid)
  const [viewMode, setViewMode] = useState<"table" | "reorder">("table");
  const [isSavingReorder, startReorderTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Sections collapse in reorder view
  const [isActiveSectionOpen, setIsActiveSectionOpen] = useState(true);
  const [isInactiveSectionOpen, setIsInactiveSectionOpen] = useState(true);

  // View Details Modal
  const [viewingSponsor, setViewingSponsor] = useState<FirestoreSponsor | null>(null);

  // Sponsor Documents Modal
  const [documentsSponsorContext, setDocumentsSponsorContext] = useState<SponsorDocumentsContext | null>(null);

  // Add / Edit Sponsor Dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Partial<FirestoreSponsor> | null>(null);
  const [isSavingSponsor, startSavingTransition] = useTransition();

  // 16:9 Logo Cropper
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Chapter sponsor confirmation config & share link
  const [chapterConfig, setChapterConfig] = useState<ChapterSponsorConfig | null>(null);
  const [brandGuideUrl, setBrandGuideUrl] = useState("https://gdgjakarta.org/brand-guide");
  const [isSavingBrandGuide, setIsSavingBrandGuide] = useState(false);
  const [emailHeaderUrl, setEmailHeaderUrl] = useState(
    "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png",
  );
  const [isSavingEmailHeader, setIsSavingEmailHeader] = useState(false);

  const loadSponsors = async () => {
    setIsLoading(true);
    try {
      const [res, cfgRes] = await Promise.all([getChapterSponsorsAction(), getOrInitChapterSponsorConfigAction()]);
      if (res.success && res.sponsors) {
        setSponsors(res.sponsors);
        setOriginalSponsors(res.sponsors);
      }
      if (cfgRes.success && cfgRes.config) {
        setChapterConfig(cfgRes.config);
        setBrandGuideUrl(cfgRes.config.brand_guide_url || "https://gdgjakarta.org/brand-guide");
        setEmailHeaderUrl(
          cfgRes.config.email_header_url ||
            "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png",
        );
      }
    } catch {
      toast.error("Failed to load chapter sponsors.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBrandGuideUrl = async () => {
    const trimmed = brandGuideUrl.trim();
    if (!trimmed) {
      toast.error("Brand Guide URL cannot be empty.");
      return;
    }
    setIsSavingBrandGuide(true);
    try {
      const res = await updateChapterSponsorConfigAction({ brand_guide_url: trimmed });
      if (res.success && res.config) {
        setChapterConfig(res.config);
        setBrandGuideUrl(res.config.brand_guide_url || trimmed);
        toast.success("Brand Guide URL updated.");
      } else {
        toast.error(res.error || "Failed to update Brand Guide URL.");
      }
    } catch {
      toast.error("Failed to update Brand Guide URL.");
    } finally {
      setIsSavingBrandGuide(false);
    }
  };

  const handleSaveEmailHeaderUrl = async () => {
    const trimmed = emailHeaderUrl.trim();
    if (!trimmed) {
      toast.error("Email Header URL cannot be empty.");
      return;
    }
    setIsSavingEmailHeader(true);
    try {
      const res = await updateChapterSponsorConfigAction({ email_header_url: trimmed });
      if (res.success && res.config) {
        setChapterConfig(res.config);
        setEmailHeaderUrl(res.config.email_header_url || trimmed);
        toast.success("Email Header URL updated.");
      } else {
        toast.error(res.error || "Failed to update Email Header URL.");
      }
    } catch {
      toast.error("Failed to update Email Header URL.");
    } finally {
      setIsSavingEmailHeader(false);
    }
  };

  const shareLink = useMemo(() => {
    if (!chapterConfig?.share_token) return "";
    const origin =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://gdgjakarta.com";
    return `${origin}/partnership/partner-confirmation?token=${chapterConfig.share_token}`;
  }, [chapterConfig]);

  const [isRotatingToken, setIsRotatingToken] = useState(false);

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast.success("Public Sponsor Confirmation link copied to clipboard!");
  };

  const handleRotateToken = async () => {
    setIsRotatingToken(true);
    try {
      const res = await regenerateChapterSponsorShareTokenAction();
      if (res.success && res.share_token) {
        setChapterConfig((prev) => (prev ? { ...prev, share_token: res.share_token! } : prev));
        toast.success("Confirmation token rotated. Previous link is now invalid.");
      } else {
        toast.error(res.error || "Failed to rotate token.");
      }
    } catch {
      toast.error("Failed to rotate token.");
    } finally {
      setIsRotatingToken(false);
    }
  };

  useEffect(() => {
    loadSponsors();
  }, []);

  const handleOpenAdd = () => {
    setEditingSponsor({
      company: "",
      company_legal_name: "",
      company_address: "",
      url: "",
      description: "",
      logo: "",
      tier: "community",
      status: "confirmed",
      contact_name: "",
      contact_title: "",
      contact_email: "",
      contact_phone: "",
    });
    setIsEditOpen(true);
  };

  const handleOpenEdit = (sponsor: FirestoreSponsor) => {
    setEditingSponsor({ ...sponsor });
    setIsEditOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropped = async (croppedBlob: Blob) => {
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", croppedBlob, "blob.png");
      formData.append("isOrganizer", "true");

      const res = await fetch("/api/events/upload-sponsor-logo", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Failed to upload image to Bevy.");
      }

      setEditingSponsor((prev) => (prev ? { ...prev, logo: json.url } : null));
      setCropModalOpen(false);
      toast.success("16:9 Logo uploaded directly to Bevy!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveSponsor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSponsor?.company?.trim()) {
      toast.error("Company name is required.");
      return;
    }

    startSavingTransition(async () => {
      try {
        const res = await saveChapterSponsorAction({
          ...editingSponsor,
          company: editingSponsor.company!.trim(),
        });

        if (res.success && res.sponsor) {
          const savedSponsor = res.sponsor;
          setSponsors((prev) => {
            const exists = prev.some(
              (s) => s.id === savedSponsor.id || (s.bevy_id && s.bevy_id === savedSponsor.bevy_id),
            );
            if (exists) {
              return prev.map((s) =>
                s.id === savedSponsor.id || (s.bevy_id && s.bevy_id === savedSponsor.bevy_id) ? savedSponsor : s,
              );
            }
            return [...prev, savedSponsor];
          });
          toast.success("Sponsor saved and synced with Bevy!");
          setIsEditOpen(false);
          loadSponsors();
        } else {
          toast.error(res.error || "Failed to save sponsor.");
        }
      } catch {
        toast.error("Error saving sponsor.");
      }
    });
  };

  const handleDeleteSponsor = async (sponsor: FirestoreSponsor) => {
    if (!confirm(`Are you sure you want to remove ${sponsor.company}?`)) return;

    try {
      const res = await deleteChapterSponsorAction(sponsor.id, sponsor.bevy_id ?? undefined);
      if (res.success) {
        toast.success(`Removed ${sponsor.company}.`);
        loadSponsors();
      } else {
        toast.error(res.error || "Failed to delete sponsor.");
      }
    } catch {
      toast.error("Error deleting sponsor.");
    }
  };

  // Check if sponsors order or active state has changed compared to original
  const isDirty = useMemo(() => {
    if (sponsors.length !== originalSponsors.length) return true;
    for (let i = 0; i < sponsors.length; i++) {
      const cur = sponsors[i];
      const orig = originalSponsors[i];
      if (!orig || cur.id !== orig.id || (cur.is_active ?? true) !== (orig.is_active ?? true)) {
        return true;
      }
    }
    return false;
  }, [sponsors, originalSponsors]);

  // Handle reorder discard
  const handleDiscardReorder = () => {
    setSponsors(originalSponsors);
    toast.info("Changes discarded.");
  };

  // Handle reorder save
  const handleSaveReorder = () => {
    startReorderTransition(async () => {
      try {
        const payload = sponsors.map((s, idx) => ({
          id: s.id,
          bevy_id: s.bevy_id,
          is_active: s.is_active ?? true,
          display_order: idx,
        }));
        const res = await reorderChapterSponsorsAction(payload);
        if (res.success) {
          toast.success("Sponsor arrangement and active status synced to Bevy!");
          setOriginalSponsors([...sponsors]);
        } else {
          toast.error(res.error || "Failed to save arrangement.");
        }
      } catch {
        toast.error("Error saving sponsor arrangement.");
      }
    });
  };

  // Toggle active/inactive for a sponsor
  const handleToggleActive = (sponsorId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSponsors((prev) =>
      prev.map((s) => {
        if (s.id === sponsorId) {
          const newActive = !(s.is_active ?? true);
          return { ...s, is_active: newActive };
        }
        return s;
      }),
    );
  };

  // Drag and Drop handlers for grid cards
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragEnd = () => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    setSponsors((prev) => {
      const fromIndex = prev.findIndex((s) => s.id === draggedId);
      const toIndex = prev.findIndex((s) => s.id === dragOverId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);

      // If moving into inactive or active region, match destination target active status
      const targetSponsor = prev[toIndex];
      moved.is_active = targetSponsor.is_active ?? true;

      updated.splice(toIndex, 0, moved);
      return updated;
    });

    setDraggedId(null);
    setDragOverId(null);
  };

  // Separate active & inactive lists for reorder view
  const activeSponsors = useMemo(() => {
    return sponsors.filter((s) => (s.is_active ?? true) === true);
  }, [sponsors]);

  const inactiveSponsors = useMemo(() => {
    return sponsors.filter((s) => (s.is_active ?? true) === false);
  }, [sponsors]);

  const filteredSponsors = useMemo(() => {
    return sponsors.filter((s) => {
      const matchSearch =
        !searchQuery.trim() ||
        s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTier = tierFilter === "all" || s.tier === tierFilter;
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchTier && matchStatus;
    });
  }, [sponsors, searchQuery, tierFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              Partners &amp; Sponsors Directory ({isLoading ? "..." : filteredSponsors.length}
              {!isLoading && sponsors.length > 0 && filteredSponsors.length !== sponsors.length
                ? ` of ${sponsors.length}`
                : ""}
              )
            </CardTitle>
            <CardDescription>
              Chapter sponsors directory, proposal status tracking, and direct sync with Bevy.
            </CardDescription>
          </div>

          {/* Top Action Buttons - Aligned to top right */}
          <div className="flex shrink-0 items-center gap-2">
            {/* View Mode Toggle: Table vs Arrange/Reorder Grid */}
            <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-7 px-2.5 text-xs font-medium"
              >
                <List className="mr-1.5 h-3.5 w-3.5" />
                Table
              </Button>
              <Button
                variant={viewMode === "reorder" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("reorder")}
                className="h-7 px-2.5 text-xs font-medium"
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                Arrange &amp; Order
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Manage in Bevy
                  <ChevronDown className="ml-1.5 h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <a
                    href="https://gdg.community.dev/dashboard/gdg-jakarta/sponsors/sponsors"
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer text-xs flex items-center justify-between"
                  >
                    <span>New Bevy Dashboard</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-2" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://gdg.community.dev/accounts/dashboard/#/chapter-642/sponsormanagement/sponsors"
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer text-xs flex items-center justify-between"
                  >
                    <span>Old Bevy Dashboard</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-2" />
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={handleOpenAdd} className="h-8 text-xs font-semibold">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Sponsor
            </Button>

            <Button variant="outline" size="sm" onClick={loadSponsors} disabled={isLoading} className="h-8 text-xs">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Public Confirmation Share Link Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Public Sponsor Confirmation Link (Directory &amp; Website Showcase)
              </p>
              {isLoading ? (
                <Skeleton className="h-4 w-3/4 mt-1" />
              ) : (
                <p className="text-xs font-mono text-foreground truncate mt-0.5">{shareLink || "Unavailable"}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyLink}
                    disabled={!shareLink}
                    className="text-xs"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy Link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRotateToken}
                    disabled={!shareLink || isRotatingToken}
                    className="text-xs"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRotatingToken ? "animate-spin" : ""}`} />
                    {isRotatingToken ? "Rotating..." : "Rotate Token"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Brand Guide URL Row (Confirmation Email) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                GDG Jakarta Brand Guide URL (Confirmation Email)
              </p>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Input
                  type="url"
                  value={brandGuideUrl}
                  onChange={(e) => setBrandGuideUrl(e.target.value)}
                  placeholder="https://gdgjakarta.org/brand-guide"
                  className="h-8 text-xs font-mono bg-background"
                />
              )}
            </div>
            <div className="flex items-center gap-2 sm:self-end">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={!brandGuideUrl.trim()}
                    className="text-xs h-8"
                  >
                    <a href={brandGuideUrl.trim() || "#"} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveBrandGuideUrl}
                    disabled={
                      isSavingBrandGuide ||
                      !brandGuideUrl.trim() ||
                      brandGuideUrl.trim() === (chapterConfig?.brand_guide_url || "https://gdgjakarta.org/brand-guide")
                    }
                    className="text-xs h-8"
                  >
                    {isSavingBrandGuide ? "Saving..." : "Save URL"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Email Header URL Row (Confirmation Email) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Header Image URL (Confirmation Email)
              </p>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Input
                  type="url"
                  value={emailHeaderUrl}
                  onChange={(e) => setEmailHeaderUrl(e.target.value)}
                  placeholder="https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png"
                  className="h-8 text-xs font-mono bg-background"
                />
              )}
            </div>
            <div className="flex items-center gap-2 sm:self-end">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={!emailHeaderUrl.trim()}
                    className="text-xs h-8"
                  >
                    <a href={emailHeaderUrl.trim() || "#"} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveEmailHeaderUrl}
                    disabled={
                      isSavingEmailHeader ||
                      !emailHeaderUrl.trim() ||
                      emailHeaderUrl.trim() ===
                        (chapterConfig?.email_header_url ||
                          "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png")
                    }
                    className="text-xs h-8"
                  >
                    {isSavingEmailHeader ? "Saving..." : "Save URL"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <Input
              placeholder="Search sponsor by company name, contact person, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md text-sm"
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="media_partner">Media Partner</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                  <SelectItem value="in_discussion">In Discussion</SelectItem>
                  <SelectItem value="confirmed">Confirmed / Tap In</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sponsors Table Container */}
          {viewMode === "table" ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Logo</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Pipeline Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Bevy ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, idx) => (
                      <TableRow key={`skeleton-chapter-sponsor-${idx}`}>
                        <TableCell>
                          <Skeleton className="h-9 w-14 rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3 w-52" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-3 w-36" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Skeleton className="h-8 w-8 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredSponsors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center py-6">
                          <Building2 className="h-8 w-8 stroke-[1.25] text-muted-foreground/60 mb-2" />
                          <p className="text-sm font-medium">No sponsors found</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Add a new sponsor to manage partners and sync with Bevy.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSponsors.map((s) => {
                      const tierMeta = TIER_COLORS[s.tier] || TIER_COLORS.community;
                      return (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => setViewingSponsor(s)}
                        >
                          {/* Logo */}
                          <TableCell>
                            <div className="relative h-9 w-14 overflow-hidden rounded border border-border bg-white flex items-center justify-center p-1">
                              {s.logo ? (
                                <img src={s.logo} alt={s.company} className="max-h-full max-w-full object-contain" />
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>

                          {/* Company */}
                          <TableCell className="max-w-[280px]">
                            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <span className="truncate">{s.company}</span>
                              {s.url && (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            {s.description && (
                              <p className="text-xs text-muted-foreground truncate" title={s.description}>
                                {s.description}
                              </p>
                            )}
                          </TableCell>

                          {/* Tier */}
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${tierMeta.badge}`}>
                              {tierMeta.label}
                            </Badge>
                          </TableCell>

                          {/* Pipeline Status */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                s.status === "confirmed"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : s.status === "declined"
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                    : s.status === "proposal_sent"
                                      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                      : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                              }`}
                            >
                              {s.status.replace("_", " ")}
                            </Badge>
                          </TableCell>

                          {/* Contact */}
                          <TableCell>
                            <div className="space-y-1">
                              {s.contact_name && (
                                <div className="text-xs font-medium text-foreground">{s.contact_name}</div>
                              )}

                              {/* WhatsApp Badge */}
                              {s.contact_phone ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <a
                                    href={`https://wa.me/${s.contact_phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 text-[11px] transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                                    title="Open WhatsApp"
                                  >
                                    <WhatsAppIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>{s.contact_phone}</span>
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-5 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      navigator.clipboard.writeText(s.contact_phone || "");
                                      toast.success("Phone number copied!");
                                    }}
                                    title="Copy WhatsApp number"
                                  >
                                    <Copy className="size-3" />
                                  </Button>
                                </div>
                              ) : null}

                              {/* Email Badge */}
                              {s.contact_email ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <a
                                    href={`mailto:${s.contact_email}`}
                                    className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700 text-[11px] transition-colors hover:bg-sky-500/20 dark:text-sky-400 max-w-[200px]"
                                    title="Send Email"
                                  >
                                    <Mail className="size-3 text-sky-600 dark:text-sky-400 shrink-0" />
                                    <span className="truncate">{s.contact_email}</span>
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-5 text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(s.contact_email || "");
                                      toast.success("Email address copied!");
                                    }}
                                    title="Copy Email"
                                  >
                                    <Copy className="size-3" />
                                  </Button>
                                </div>
                              ) : null}

                              {!s.contact_name && !s.contact_phone && !s.contact_email && (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Bevy ID */}
                          <TableCell>
                            {s.bevy_id ? (
                              <span className="font-mono text-xs text-muted-foreground">#{s.bevy_id}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div
                              className="inline-flex items-center justify-end gap-1 rounded-lg border border-border/60 bg-muted/20 p-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs font-medium text-foreground hover:bg-background hover:shadow-2xs gap-1.5"
                                title="Quotation, LOA & Invoice Documents"
                                onClick={() =>
                                  setDocumentsSponsorContext({
                                    sponsorId: s.id,
                                    companyName: s.company,
                                    companyLegalName: s.company_legal_name,
                                    companyAddress: s.company_address,
                                    contactName: s.contact_name,
                                    contactTitle: s.contact_title,
                                    contactEmail: s.contact_email,
                                    sponsorTier: s.tier || "partner",
                                  })
                                }
                              >
                                <FileText className="h-3.5 w-3.5 text-primary" />
                                <span className="hidden xl:inline">Documents</span>
                              </Button>

                              {onSignPartnerPdf && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs font-medium text-foreground hover:bg-background hover:shadow-2xs gap-1.5"
                                  title="Sign Partner PDF with E-Certificate"
                                  onClick={() => onSignPartnerPdf(s)}
                                >
                                  <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                                  <span className="hidden xl:inline">Sign PDF</span>
                                </Button>
                              )}

                              <div className="h-4 w-px bg-border/70 mx-0.5" />

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xs"
                                title="View Details"
                                onClick={() => setViewingSponsor(s)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xs"
                                title="Edit Sponsor"
                                onClick={() => handleOpenEdit(s)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                title="Delete Sponsor"
                                onClick={() => handleDeleteSponsor(s)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Arrange & Reorder Grid View (1:1 with Bevy 4-column logo cards) */
            <div className="space-y-6">
              {/* Active Section */}
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsActiveSectionOpen(!isActiveSectionOpen)}
                >
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isActiveSectionOpen ? "" : "-rotate-90"
                        }`}
                      />
                      Active ({activeSponsors.length})
                    </h3>
                    <p className="text-xs text-muted-foreground ml-6">
                      Featured on chapter page and all completed event pages.
                    </p>
                  </div>
                </div>

                {isActiveSectionOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {activeSponsors.map((s) => {
                      const isBeingDragged = draggedId === s.id;
                      const isHoverTarget = dragOverId === s.id;
                      return (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={() => handleDragStart(s.id)}
                          onDragOver={(e) => handleDragOver(e, s.id)}
                          onDragEnd={handleDragEnd}
                          className={`group relative flex flex-col justify-between rounded-lg border bg-card transition-all duration-150 overflow-hidden shadow-xs select-none ${
                            isBeingDragged
                              ? "opacity-35 scale-95 border-dashed border-primary"
                              : isHoverTarget
                                ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                                : "border-border hover:border-border/80 hover:shadow-sm"
                          }`}
                        >
                          {/* 16:9 Logo Presentation Box */}
                          <div className="relative h-28 w-full bg-white flex items-center justify-center p-3 border-b border-border">
                            {/* Drag handle icon on top left matching Bevy */}
                            <div
                              className="absolute top-2 left-2 p-1 text-muted-foreground/40 group-hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing transition-colors"
                              title="Drag to reposition"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>

                            {/* Active badge top right */}
                            <div className="absolute top-2 right-2 flex items-center gap-1.5" title="Active on Bevy">
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Active
                              </span>
                            </div>

                            {s.logo ? (
                              <img src={s.logo} alt={s.company} className="max-h-full max-w-full object-contain" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <Building2 className="h-6 w-6 stroke-1 mb-1" />
                                <span className="text-[11px] font-medium truncate max-w-[140px]">{s.company}</span>
                              </div>
                            )}
                          </div>

                          {/* Card bottom actions bar matching Bevy screenshot */}
                          <div className="px-3 py-2 bg-muted/20 flex items-center justify-between gap-1 text-xs">
                            <span className="font-medium text-foreground truncate max-w-[130px]" title={s.company}>
                              {s.company}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocumentsSponsorContext({
                                    sponsorId: s.id,
                                    companyName: s.company,
                                    companyLegalName: s.company_legal_name,
                                    companyAddress: s.company_address,
                                    contactName: s.contact_name,
                                    contactTitle: s.contact_title,
                                    contactEmail: s.contact_email,
                                    sponsorTier: s.tier || "partner",
                                  });
                                }}
                                className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline flex items-center gap-0.5 cursor-pointer"
                                title="Quotation, LOA & Invoice Documents"
                              >
                                <FileText className="h-3 w-3 text-primary" />
                                Docs
                              </button>
                              {onSignPartnerPdf && (
                                <>
                                  <span className="text-muted-foreground/40">•</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSignPartnerPdf(s);
                                    }}
                                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline flex items-center gap-0.5 cursor-pointer"
                                    title="Sign Partner PDF with E-Certificate"
                                  >
                                    <PenTool className="h-3 w-3 text-emerald-600" />
                                    Sign
                                  </button>
                                </>
                              )}
                              <span className="text-muted-foreground/40">•</span>
                              <button
                                type="button"
                                onClick={(e) => handleToggleActive(s.id, e)}
                                className="text-[11px] font-medium text-muted-foreground hover:text-destructive underline-offset-2 hover:underline cursor-pointer"
                                title="Move to Inactive"
                              >
                                Deactivate
                              </button>
                              <span className="text-muted-foreground/40">•</span>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(s)}
                                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {activeSponsors.length === 0 && (
                      <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                        No active partners. Drag inactive partners here or click activate.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inactive Section */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsInactiveSectionOpen(!isInactiveSectionOpen)}
                >
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isInactiveSectionOpen ? "" : "-rotate-90"}`}
                      />
                      Inactive ({inactiveSponsors.length})
                    </h3>
                    <p className="text-xs text-muted-foreground ml-6">
                      Won&apos;t be shown on any pages. If you want to make a partner active, click activate.
                    </p>
                  </div>
                </div>

                {isInactiveSectionOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {inactiveSponsors.map((s) => {
                      const isBeingDragged = draggedId === s.id;
                      const isHoverTarget = dragOverId === s.id;
                      return (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={() => handleDragStart(s.id)}
                          onDragOver={(e) => handleDragOver(e, s.id)}
                          onDragEnd={handleDragEnd}
                          className={`group relative flex flex-col justify-between rounded-lg border bg-card/60 opacity-80 hover:opacity-100 transition-all duration-150 overflow-hidden shadow-xs select-none ${
                            isBeingDragged
                              ? "opacity-35 scale-95 border-dashed border-primary"
                              : isHoverTarget
                                ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                                : "border-border hover:border-border/80"
                          }`}
                        >
                          {/* 16:9 Logo Box */}
                          <div className="relative h-28 w-full bg-white/70 flex items-center justify-center p-3 border-b border-border grayscale hover:grayscale-0 transition-all">
                            <div
                              className="absolute top-2 left-2 p-1 text-muted-foreground/40 group-hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing"
                              title="Drag to reposition"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>

                            <div className="absolute top-2 right-2">
                              <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                Inactive
                              </span>
                            </div>

                            {s.logo ? (
                              <img src={s.logo} alt={s.company} className="max-h-full max-w-full object-contain" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <Building2 className="h-6 w-6 stroke-1 mb-1" />
                                <span className="text-[11px] font-medium truncate max-w-[140px]">{s.company}</span>
                              </div>
                            )}
                          </div>

                          {/* Card bottom actions bar */}
                          <div className="px-3 py-2 bg-muted/20 flex items-center justify-between gap-1 text-xs">
                            <span className="font-medium text-foreground truncate max-w-[130px]" title={s.company}>
                              {s.company}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleToggleActive(s.id, e)}
                                className="text-[11px] font-medium text-emerald-600 hover:underline cursor-pointer"
                                title="Make Active"
                              >
                                Activate
                              </button>
                              <span className="text-muted-foreground/40">•</span>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(s)}
                                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {inactiveSponsors.length === 0 && (
                      <div className="col-span-full rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        No inactive partners.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Sponsor Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingSponsor?.id ? "Edit Chapter Sponsor" : "Add Chapter Sponsor"}
            </DialogTitle>
            <DialogDescription>
              {editingSponsor?.id
                ? "Update sponsor profile, contact details, and sync changes directly to Bevy."
                : "Create sponsor profile and sync directly with Bevy."}
            </DialogDescription>
          </DialogHeader>

          {editingSponsor && (
            <form onSubmit={handleSaveSponsor} className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Company Name (Displayed on Poster) *</Label>
                  <Input
                    placeholder="Acme Inc."
                    value={editingSponsor.company || ""}
                    onChange={(e) => setEditingSponsor({ ...editingSponsor, company: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Company Legal Name (For Invoice / LOA)</Label>
                  <Input
                    placeholder="PT Acme Teknologi Indonesia"
                    value={editingSponsor.company_legal_name || ""}
                    onChange={(e) => setEditingSponsor({ ...editingSponsor, company_legal_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company / Billing Address</Label>
                <Input
                  placeholder="Jl. Jend. Sudirman No. 1, Jakarta..."
                  value={editingSponsor.company_address || ""}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, company_address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tier</Label>
                  <Select
                    value={editingSponsor.tier || "community"}
                    onValueChange={(val) => setEditingSponsor({ ...editingSponsor, tier: val as SponsorCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="media_partner">Media Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pipeline Status</Label>
                  <Select
                    value={editingSponsor.status || "confirmed"}
                    onValueChange={(val) =>
                      setEditingSponsor({ ...editingSponsor, status: val as SponsorProposalStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                      <SelectItem value="in_discussion">In Discussion</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Website URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={editingSponsor.url || ""}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, url: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Description</Label>
                <Textarea
                  placeholder="Brief description about the sponsor or company..."
                  rows={2}
                  className="text-xs resize-none"
                  value={editingSponsor.description || ""}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, description: e.target.value })}
                />
              </div>

              {/* 16:9 Logo Crop & Bevy Direct Upload */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <Label className="text-xs font-medium">Company Logo (16:9 Aspect Ratio)</Label>
                {editingSponsor.logo ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2 bg-muted/30">
                    <div className="relative aspect-video w-24 overflow-hidden rounded border border-border bg-white flex items-center justify-center p-1">
                      <img
                        src={editingSponsor.logo}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs"
                    >
                      Change Logo
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="h-6 w-6 text-muted-foreground mb-1" />
                    <p className="text-xs font-medium">Upload & crop logo (16:9)</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Person</Label>
                  <Input
                    placeholder="Representative Name"
                    value={editingSponsor.contact_name || ""}
                    onChange={(e) => setEditingSponsor({ ...editingSponsor, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Position / Title</Label>
                  <Input
                    placeholder="Director / Marketing Lead"
                    value={editingSponsor.contact_title || ""}
                    onChange={(e) => setEditingSponsor({ ...editingSponsor, contact_title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Email</Label>
                  <Input
                    type="email"
                    placeholder="contact@company.com"
                    value={editingSponsor.contact_email || ""}
                    onChange={(e) => setEditingSponsor({ ...editingSponsor, contact_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Phone / WhatsApp</Label>
                <Input
                  placeholder="0812..."
                  value={editingSponsor.contact_phone || ""}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, contact_phone: e.target.value })}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingSponsor}>
                  {isSavingSponsor ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving to Bevy...
                    </>
                  ) : (
                    "Save Sponsor"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Sponsor Details Modal */}
      {viewingSponsor && (
        <Dialog open={!!viewingSponsor} onOpenChange={(open) => !open && setViewingSponsor(null)}>
          <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {viewingSponsor.company}
              </DialogTitle>
              <DialogDescription>Chapter sponsor overview and recorded contact profile.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Logo Preview */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Company Logo</Label>
                <div className="mt-1.5 aspect-video w-full rounded-md border border-border bg-white flex items-center justify-center p-4">
                  {viewingSponsor.logo ? (
                    <img
                      src={viewingSponsor.logo}
                      alt={viewingSponsor.company}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/60">
                      <Building2 className="h-10 w-10 mb-1" />
                      <span className="text-xs">No logo uploaded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium text-muted-foreground">Tier:</span>
                  <div className="mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-xs ${(TIER_COLORS[viewingSponsor.tier] || TIER_COLORS.community).badge}`}
                    >
                      {(TIER_COLORS[viewingSponsor.tier] || TIER_COLORS.community).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Pipeline Status:</span>
                  <div className="mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${
                        viewingSponsor.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : viewingSponsor.status === "declined"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            : viewingSponsor.status === "proposal_sent"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                      }`}
                    >
                      {viewingSponsor.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Website:</span>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {viewingSponsor.url ? (
                      <a
                        href={viewingSponsor.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground hover:underline flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{viewingSponsor.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Bevy ID:</span>
                  <p className="mt-0.5 font-mono text-foreground">
                    {viewingSponsor.bevy_id ? `#${viewingSponsor.bevy_id}` : "—"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Contact Representative:</span>
                  <p className="mt-0.5 font-semibold text-foreground">{viewingSponsor.contact_name || "—"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Work Email:</span>
                  {viewingSponsor.contact_email ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <a
                        href={`mailto:${viewingSponsor.contact_email}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-700 text-xs transition-colors hover:bg-sky-500/20 dark:text-sky-400"
                        title="Send Email"
                      >
                        <Mail className="size-3 text-sky-600 dark:text-sky-400" />
                        <span>{viewingSponsor.contact_email}</span>
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingSponsor.contact_email || "");
                          toast.success("Email copied to clipboard!");
                        }}
                        title="Copy Email"
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-foreground">—</p>
                  )}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Phone / WhatsApp:</span>
                  {viewingSponsor.contact_phone ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/${viewingSponsor.contact_phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                        title="Chat on WhatsApp"
                      >
                        <WhatsAppIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{viewingSponsor.contact_phone}</span>
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingSponsor.contact_phone || "");
                          toast.success("Phone number copied to clipboard!");
                        }}
                        title="Copy WhatsApp number"
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-foreground">—</p>
                  )}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Last Updated:</span>
                  <p className="mt-0.5 text-foreground">
                    {viewingSponsor.updated_at ? new Date(viewingSponsor.updated_at).toLocaleString() : "—"}
                  </p>
                </div>
              </div>

              {viewingSponsor.description && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Description</Label>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded border border-border whitespace-pre-wrap">
                    {viewingSponsor.description}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const sponsorToEdit = viewingSponsor;
                  setViewingSponsor(null);
                  handleOpenEdit(sponsorToEdit);
                }}
                className="text-xs"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Sponsor
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setViewingSponsor(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Sponsor Documents Modal */}
      <SponsorDocumentsDialog
        open={!!documentsSponsorContext}
        onOpenChange={(v) => !v && setDocumentsSponsorContext(null)}
        sponsorContext={documentsSponsorContext}
      />

      {/* 16:9 Cropper Modal */}
      <SponsorLogoCropperDialog
        open={cropModalOpen}
        onOpenChange={setCropModalOpen}
        imageSrc={rawImageSrc}
        onCropped={handleCropped}
        isUploading={isUploadingLogo}
      />

      {/* Floating Save Bar for unsaved Reorder / Active Status changes */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSavingReorder}
        onSave={handleSaveReorder}
        onDiscard={handleDiscardReorder}
        saveLabel="Save &amp; Sync with Bevy"
        savingLabel="Syncing with Bevy..."
        discardLabel="Discard"
        unsavedBadgeLabel="Unsaved Arrangement"
        helperText="Drag to reorder positions or toggle active/inactive status across chapter and event pages."
      />
    </div>
  );
}
