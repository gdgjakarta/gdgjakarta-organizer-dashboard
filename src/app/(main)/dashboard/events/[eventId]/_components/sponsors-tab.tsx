"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import Image from "next/image";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { SponsorDocumentsDialog, type SponsorDocumentsContext } from "@/components/sponsor-documents-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SponsorLogoCropperDialog } from "@/components/sponsor-logo-cropper-dialog";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { getChapterSponsorsAction, sendSponsorProposalEmailAction } from "@/server/sponsor-actions";
import {
  addSponsorToEventAction,
  getEventSponsorConfirmationsAction,
  getOrInitEventSponsorConfigAction,
  regenerateSponsorShareTokenAction,
  removeSponsorFromEventAction,
  syncSponsorConfirmationToBevyAction,
  updateEventSponsorConfigAction,
  updateSponsorConfirmationDetailsAction,
  updateSponsorConfirmationStatusAction,
} from "@/server/sponsor-confirmation-actions";
import type { EventSponsorConfig, EventSponsorConfirmation, FirestoreSponsor, SponsorCategory } from "@/types/sponsor";

interface SponsorsTabProps {
  event: FirestoreEvent;
}

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

export function SponsorsTab({ event }: SponsorsTabProps) {
  const [config, setConfig] = useState<EventSponsorConfig | null>(event.sponsor_config || null);
  const [confirmations, setConfirmations] = useState<EventSponsorConfirmation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Sync / Action transitions
  const [isSyncing, startSyncTransition] = useTransition();
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);

  // Detail Modal
  const [selectedConfirmation, setSelectedConfirmation] = useState<EventSponsorConfirmation | null>(null);

  // Sponsor Documents Modal
  const [documentsSponsorContext, setDocumentsSponsorContext] = useState<SponsorDocumentsContext | null>(null);

  // Edit Modal
  const [editingConfirmation, setEditingConfirmation] = useState<EventSponsorConfirmation | null>(null);
  const [isUpdatingConfirmation, startUpdatingTransition] = useTransition();

  // 16:9 Logo Cropper for Edit & Add Sponsor
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [cropperTarget, setCropperTarget] = useState<"edit" | "add">("edit");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Send Proposal Dialog
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [proposalCompany, setProposalCompany] = useState("");
  const [proposalEmail, setProposalEmail] = useState("");
  const [proposalTier, setProposalTier] = useState<SponsorCategory>("community");
  const [proposalDeckUrl, setProposalDeckUrl] = useState("");
  const [selectedProposalSponsorId, setSelectedProposalSponsorId] = useState<string>("custom");
  const [isProposalSponsorPickerOpen, setIsProposalSponsorPickerOpen] = useState(false);
  const [isSendingProposal, startProposalTransition] = useTransition();

  // Add Sponsor to Event Modal
  const [isAddSponsorOpen, setIsAddSponsorOpen] = useState(false);
  const [isChapterPickerOpen, setIsChapterPickerOpen] = useState(false);
  const [chapterSponsors, setChapterSponsors] = useState<FirestoreSponsor[]>([]);
  const [selectedChapterSponsorId, setSelectedChapterSponsorId] = useState<string>("custom");
  const [newSponsorCompany, setNewSponsorCompany] = useState("");
  const [newSponsorLegalName, setNewSponsorLegalName] = useState("");
  const [newSponsorAddress, setNewSponsorAddress] = useState("");
  const [newSponsorUrl, setNewSponsorUrl] = useState("");
  const [newSponsorDescription, setNewSponsorDescription] = useState("");
  const [newSponsorLogo, setNewSponsorLogo] = useState("");
  const [newSponsorContactName, setNewSponsorContactName] = useState("");
  const [newSponsorContactTitle, setNewSponsorContactTitle] = useState("");
  const [newSponsorContactEmail, setNewSponsorContactEmail] = useState("");
  const [newSponsorContactPhone, setNewSponsorContactPhone] = useState("");
  const [newSponsorTier, setNewSponsorTier] = useState<SponsorCategory>("partner");
  const [isAddingSponsor, startAddingTransition] = useTransition();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cfgRes, confRes, chapRes] = await Promise.all([
        getOrInitEventSponsorConfigAction(event.id),
        getEventSponsorConfirmationsAction(event.id),
        getChapterSponsorsAction(),
      ]);

      if (cfgRes.success && cfgRes.config) {
        setConfig(cfgRes.config);
      }
      if (confRes.success && confRes.confirmations) {
        setConfirmations(confRes.confirmations);
      }
      if (chapRes.success && chapRes.sponsors) {
        setChapterSponsors(chapRes.sponsors);
      }
    } catch {
      toast.error("Failed to load sponsors data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [event.id]);

  // Confirmation share link
  const shareLink = useMemo(() => {
    if (!config?.share_token) return "";
    const origin =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://gdgjakarta.com";
    return `${origin}/events/${event.id}/partner-confirmation?token=${config.share_token}`;
  }, [config, event.id]);

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast.success("Public Sponsor Confirmation link copied to clipboard!");
  };

  // Bevy 1-Click Sync
  const handleSyncToBevy = (confirmation: EventSponsorConfirmation) => {
    setActiveSyncId(confirmation.id);
    startSyncTransition(async () => {
      try {
        const res = await syncSponsorConfirmationToBevyAction(confirmation.id, event.id);
        if (res.success) {
          toast.success(`Successfully mapped ${confirmation.company_name} to Bevy!`);
          loadData();
        } else {
          toast.error(res.error || "Failed to sync sponsor to Bevy.");
        }
      } catch {
        toast.error("Error syncing sponsor to Bevy.");
      } finally {
        setActiveSyncId(null);
      }
    });
  };

  // Send Proposal Email
  const handleSendProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalCompany.trim() || !proposalEmail.trim()) {
      toast.error("Company name and email are required.");
      return;
    }

    startProposalTransition(async () => {
      try {
        const res = await sendSponsorProposalEmailAction({
          eventId: event.id,
          companyName: proposalCompany.trim(),
          recipientEmail: proposalEmail.trim(),
          sponsorTier: proposalTier,
          proposalDeckUrl: proposalDeckUrl.trim(),
        });

        if (res.success) {
          toast.success(`Proposal email dispatched to ${proposalEmail.trim()}!`);
          setIsProposalDialogOpen(false);
          setProposalCompany("");
          setProposalEmail("");
          setProposalDeckUrl("");
          setSelectedProposalSponsorId("custom");
        } else {
          toast.error(res.error || "Failed to send proposal email.");
        }
      } catch {
        toast.error("Error sending proposal email.");
      }
    });
  };

  // Handle select sponsor for proposal dialog
  const handleSelectProposalSponsor = (val: string) => {
    setSelectedProposalSponsorId(val);
    if (val === "custom") {
      setProposalCompany("");
      setProposalEmail("");
      return;
    }
    const found = chapterSponsors.find((s) => s.id === val || String(s.bevy_id) === val);
    if (found) {
      setProposalCompany(found.company || "");
      if (found.contact_email?.trim()) {
        setProposalEmail(found.contact_email.trim());
      }
      if (found.tier) {
        setProposalTier(found.tier);
      }
    }
  };

  // Handle select chapter sponsor preset
  const handleSelectChapterSponsor = (val: string) => {
    setSelectedChapterSponsorId(val);
    if (val === "custom") {
      setNewSponsorCompany("");
      setNewSponsorLegalName("");
      setNewSponsorAddress("");
      setNewSponsorUrl("");
      setNewSponsorDescription("");
      setNewSponsorLogo("");
      setNewSponsorContactName("");
      setNewSponsorContactTitle("");
      setNewSponsorContactEmail("");
      setNewSponsorContactPhone("");
      return;
    }
    const found = chapterSponsors.find((s) => s.id === val || String(s.bevy_id) === val);
    if (found) {
      setNewSponsorCompany(found.company || "");
      setNewSponsorLegalName(found.company_legal_name || "");
      setNewSponsorAddress(found.company_address || "");
      setNewSponsorUrl(found.url || "");
      setNewSponsorDescription(found.description || "");
      setNewSponsorLogo(found.logo || "");
      setNewSponsorContactName(found.contact_name || "");
      setNewSponsorContactTitle(found.contact_title || "");
      setNewSponsorContactEmail(found.contact_email || "");
      setNewSponsorContactPhone(found.contact_phone || "");
      setNewSponsorTier(found.tier || "partner");
    }
  };

  // Add Sponsor to Event Submit
  const handleAddSponsorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSponsorCompany.trim()) {
      toast.error("Company name is required.");
      return;
    }

    startAddingTransition(async () => {
      try {
        const found =
          selectedChapterSponsorId !== "custom"
            ? chapterSponsors.find(
                (s) => s.id === selectedChapterSponsorId || String(s.bevy_id) === selectedChapterSponsorId,
              )
            : null;

        const res = await addSponsorToEventAction(event.id, {
          company_name: newSponsorCompany.trim(),
          company_legal_name: newSponsorLegalName.trim(),
          company_address: newSponsorAddress.trim(),
          company_url: newSponsorUrl.trim(),
          company_description: newSponsorDescription.trim(),
          company_logo_url: newSponsorLogo.trim(),
          contact_name: newSponsorContactName.trim(),
          contact_title: newSponsorContactTitle.trim(),
          contact_email: newSponsorContactEmail.trim(),
          contact_phone: newSponsorContactPhone.trim(),
          selected_tier: newSponsorTier,
          bevy_sponsor_id: found?.bevy_id ?? null,
        });

        if (res.success && res.confirmation) {
          toast.success(`Added ${newSponsorCompany.trim()} to ${event.title} and synced with Bevy!`);
          setIsAddSponsorOpen(false);
          loadData();
        } else {
          toast.error(res.error || "Failed to add sponsor to event.");
        }
      } catch {
        toast.error("Error adding sponsor to event.");
      }
    });
  };

  // 16:9 Logo Crop and direct Bevy upload
  const handleOpenCropper = (target: "edit" | "add") => {
    setCropperTarget(target);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPEG, WebP).");
      return;
    }

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
      formData.append("eventId", String(event.id));
      formData.append("isOrganizer", "true");

      const res = await fetch("/api/events/upload-sponsor-logo", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Failed to upload image to Bevy.");
      }

      if (cropperTarget === "edit") {
        setEditingConfirmation((prev) => (prev ? { ...prev, company_logo_url: json.url || "" } : null));
      } else {
        setNewSponsorLogo(json.url || "");
      }
      setCropModalOpen(false);
      toast.success("16:9 Logo uploaded directly to Bevy!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Remove sponsor from event
  const handleRemoveSponsorFromEvent = (conf: EventSponsorConfirmation) => {
    if (!confirm(`Are you sure you want to remove ${conf.company_name} from this event?`)) return;

    startSyncTransition(async () => {
      try {
        const res = await removeSponsorFromEventAction(conf.id, event.id, conf.bevy_sponsor_id, conf.selected_tier);
        if (res.success) {
          toast.success(`Removed ${conf.company_name} from event.`);
          loadData();
        } else {
          toast.error(res.error || "Failed to remove sponsor.");
        }
      } catch {
        toast.error("Error removing sponsor from event.");
      }
    });
  };

  // Filtered confirmations
  const filteredConfirmations = useMemo(() => {
    return confirmations.filter((c) => {
      const matchSearch =
        !searchQuery.trim() ||
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTier = tierFilter === "all" || c.selected_tier === tierFilter;
      return matchSearch && matchTier;
    });
  }, [confirmations, searchQuery, tierFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Bevy Dashboard Links */}
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Event Sponsors & Partners
              </CardTitle>
              <CardDescription>
                Manage confirmed sponsors, send tokenized proposals, and sync brand tiers to Bevy.
              </CardDescription>
            </div>

            {/* Direct Bevy Dashboard Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs font-medium">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Manage in Bevy
                    <ChevronDown className="ml-1.5 h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <a
                      href={`https://gdg.community.dev/dashboard/gdg-jakarta/events/${event.id}/sponsors`}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer text-xs flex items-center justify-between"
                    >
                      <span>Bevy Event Sponsors</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground ml-2" />
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href="https://gdg.community.dev/dashboard/gdg-jakarta/sponsors/sponsors"
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer text-xs flex items-center justify-between"
                    >
                      <span>New Chapter Dashboard</span>
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
                      <span>Old Chapter Dashboard</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground ml-2" />
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Share Link Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Public Sponsor Confirmation Link
              </p>
              <p className="text-xs font-mono text-foreground truncate mt-0.5">{shareLink || "Loading link..."}</p>
            </div>
            <div className="flex items-center gap-2">
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
                onClick={() => setIsProposalDialogOpen(true)}
                className="text-xs"
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Send Proposal Email
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmed Sponsors Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Confirmed Sponsors ({confirmations.length})</CardTitle>
            <CardDescription>
              Sponsors mapped to this event on Bevy and self-service confirmation submissions.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => setIsAddSponsorOpen(true)} className="h-8 text-xs font-semibold">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Sponsor to Event
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="h-8 text-xs">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>

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
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Logo</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Contact Representative</TableHead>
                  <TableHead>Bevy Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, idx) => (
                    <TableRow key={`skeleton-event-sponsor-${idx}`}>
                      <TableCell>
                        <Skeleton className="h-9 w-14 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-24 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredConfirmations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center py-6">
                        <Building2 className="h-8 w-8 stroke-[1.25] text-muted-foreground/60 mb-2" />
                        <p className="text-sm font-medium">No sponsor confirmations recorded yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                          Share the public confirmation link with your confirmed partners or send a proposal email.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfirmations.map((conf) => {
                    const tierMeta = TIER_COLORS[conf.selected_tier] || TIER_COLORS.community;
                    return (
                      <TableRow
                        key={conf.id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => setSelectedConfirmation(conf)}
                      >
                        {/* Logo */}
                        <TableCell>
                          <div className="relative h-9 w-14 overflow-hidden rounded border border-border bg-white flex items-center justify-center p-1">
                            {conf.company_logo_url ? (
                              <img
                                src={conf.company_logo_url}
                                alt={conf.company_name}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>

                        {/* Company */}
                        <TableCell className="max-w-[280px]">
                          <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <span className="truncate">{conf.company_name}</span>
                            {conf.company_url && (
                              <a
                                href={conf.company_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {conf.company_description && (
                            <p className="text-xs text-muted-foreground truncate" title={conf.company_description}>
                              {conf.company_description}
                            </p>
                          )}
                        </TableCell>

                        {/* Tier */}
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${tierMeta.badge}`}>
                            {tierMeta.label}
                          </Badge>
                        </TableCell>

                        {/* Contact */}
                        <TableCell>
                          <div className="space-y-1">
                            {conf.contact_name ? (
                              <div className="text-xs font-medium text-foreground">{conf.contact_name}</div>
                            ) : null}

                            {/* WhatsApp Badge */}
                            {conf.contact_phone?.trim() ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`https://wa.me/${conf.contact_phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 text-[11px] transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                                  title="Open WhatsApp"
                                >
                                  <WhatsAppIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>{conf.contact_phone}</span>
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-5 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    navigator.clipboard.writeText(conf.contact_phone || "");
                                    toast.success("Phone number copied!");
                                  }}
                                  title="Copy WhatsApp number"
                                >
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                            ) : null}

                            {/* Email Badge */}
                            {conf.contact_email?.trim() ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`mailto:${conf.contact_email}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700 text-[11px] transition-colors hover:bg-sky-500/20 dark:text-sky-400 max-w-[200px]"
                                  title="Send Email"
                                >
                                  <Mail className="size-3 text-sky-600 dark:text-sky-400 shrink-0" />
                                  <span className="truncate">{conf.contact_email}</span>
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-5 text-muted-foreground hover:text-foreground shrink-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(conf.contact_email || "");
                                    toast.success("Email address copied!");
                                  }}
                                  title="Copy Email"
                                >
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                            ) : null}

                            {!conf.contact_name && !conf.contact_phone?.trim() && !conf.contact_email?.trim() && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Bevy Sync Status */}
                        <TableCell>
                          {conf.bevy_synced ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Synced (#{conf.bevy_sponsor_id})
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20"
                            >
                              Not Synced
                            </Badge>
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
                                  sponsorId: conf.id,
                                  companyName: conf.company_name,
                                  companyLegalName: conf.company_legal_name,
                                  companyAddress: conf.company_address,
                                  contactName: conf.contact_name,
                                  contactTitle: conf.contact_title,
                                  contactEmail: conf.contact_email,
                                  sponsorTier: conf.selected_tier || "partner",
                                  eventId: String(event.id),
                                  eventTitle: event.title,
                                  eventDate: event.start_date
                                    ? new Date(event.start_date).toLocaleDateString("en-GB", {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                        timeZone: "Asia/Jakarta",
                                      })
                                    : undefined,
                                  eventLocation: event.venue?.name || "Jakarta, Indonesia",
                                  eventWebsite: `https://gdgjakarta.com/events/${event.id}`,
                                })
                              }
                            >
                              <FileText className="h-3.5 w-3.5 text-primary" />
                              <span className="hidden xl:inline">Documents</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xs gap-1.5"
                              disabled={isSyncing && activeSyncId === conf.id}
                              onClick={() => handleSyncToBevy(conf)}
                              title={conf.bevy_synced ? "Re-sync with Bevy" : "Sync to Bevy"}
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${isSyncing && activeSyncId === conf.id ? "animate-spin text-primary" : ""}`}
                              />
                              <span className="hidden 2xl:inline">{conf.bevy_synced ? "Sync" : "Sync to Bevy"}</span>
                            </Button>

                            <div className="h-4 w-px bg-border/70 mx-0.5" />

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xs"
                              onClick={() => setSelectedConfirmation(conf)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-2xs"
                              onClick={() => setEditingConfirmation({ ...conf })}
                              title="Edit Sponsor"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveSponsorFromEvent(conf)}
                              title="Remove from Event"
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
        </CardContent>
      </Card>

      {/* Details Modal */}
      {selectedConfirmation && (
        <Dialog open={!!selectedConfirmation} onOpenChange={(open) => !open && setSelectedConfirmation(null)}>
          <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {selectedConfirmation.company_name}
              </DialogTitle>
              <DialogDescription>Full details and assets submitted via Sponsor Confirmation form.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Logo Preview */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">16:9 Logo Asset</Label>
                <div className="mt-1.5 aspect-video w-full rounded-md border border-border bg-white flex items-center justify-center p-4">
                  <img
                    src={selectedConfirmation.company_logo_url}
                    alt={selectedConfirmation.company_name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium text-muted-foreground">Tier:</span>
                  <p className="font-semibold text-foreground capitalize">{selectedConfirmation.selected_tier}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Website:</span>
                  <p className="text-foreground truncate">{selectedConfirmation.company_url || "—"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Contact Representative:</span>
                  <p className="font-semibold text-foreground">{selectedConfirmation.contact_name || "—"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Work Email:</span>
                  {selectedConfirmation.contact_email?.trim() ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <a
                        href={`mailto:${selectedConfirmation.contact_email}`}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700 text-xs transition-colors hover:bg-sky-500/20 dark:text-sky-400"
                      >
                        <Mail className="size-3 text-sky-600 dark:text-sky-400" />
                        <span>{selectedConfirmation.contact_email}</span>
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedConfirmation.contact_email || "");
                          toast.success("Email copied!");
                        }}
                        title="Copy Email"
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-foreground mt-0.5">—</p>
                  )}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Phone / WhatsApp:</span>
                  {selectedConfirmation.contact_phone ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <a
                        href={`https://wa.me/${selectedConfirmation.contact_phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 text-xs transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        <WhatsAppIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{selectedConfirmation.contact_phone}</span>
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedConfirmation.contact_phone || "");
                          toast.success("Phone number copied!");
                        }}
                        title="Copy Phone"
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-foreground">—</p>
                  )}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Submitted At:</span>
                  <p className="text-foreground">{new Date(selectedConfirmation.submitted_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedConfirmation.company_description && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Description</Label>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded border border-border">
                    {selectedConfirmation.company_description}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const toEdit = selectedConfirmation;
                  setSelectedConfirmation(null);
                  setEditingConfirmation({ ...toEdit });
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Sponsor
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedConfirmation(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSyncToBevy(selectedConfirmation)}
                  disabled={isSyncing && activeSyncId === selectedConfirmation.id}
                >
                  {isSyncing && activeSyncId === selectedConfirmation.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Sync to Bevy Now"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send Proposal Dialog */}
      <Dialog open={isProposalDialogOpen} onOpenChange={setIsProposalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Event Proposal Email
            </DialogTitle>
            <DialogDescription>
              Dispatches an invitation with tokenized decision links using the event&apos;s saved Proposal template.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendProposal} className="space-y-4 py-2">
            {/* Choose from Chapter Sponsor Directory */}
            <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Choose from Sponsor Directory
              </Label>
              <Popover open={isProposalSponsorPickerOpen} onOpenChange={setIsProposalSponsorPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isProposalSponsorPickerOpen}
                    className="w-full h-auto min-h-10 justify-between px-3 py-1.5 text-left font-normal bg-background hover:bg-muted/50 border-input"
                  >
                    {selectedProposalSponsorId === "custom" || !selectedProposalSponsorId ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <Plus className="size-3.5" />
                        <span>-- Custom Sponsor / Type Manually --</span>
                      </div>
                    ) : (
                      (() => {
                        const current = chapterSponsors.find(
                          (s) => s.id === selectedProposalSponsorId || String(s.bevy_id) === selectedProposalSponsorId,
                        );
                        if (!current) {
                          return (
                            <span className="text-xs text-muted-foreground">Choose from sponsor directory...</span>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-6 w-11 shrink-0 rounded border border-border bg-white flex items-center justify-center p-0.5 overflow-hidden">
                              {current.logo ? (
                                <img
                                  src={current.logo}
                                  alt={current.company}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <Building2 className="size-3 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-semibold text-xs text-foreground truncate">{current.company}</span>
                            {current.contact_email && (
                              <span className="text-[11px] text-muted-foreground truncate">
                                ({current.contact_email})
                              </span>
                            )}
                          </div>
                        );
                      })()
                    )}
                    <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command className="w-full">
                    <CommandInput placeholder="Search partners by name or email..." className="h-9 text-xs" />
                    <CommandList className="max-h-64 overflow-y-auto">
                      <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                        No partners found in directory.
                      </CommandEmpty>
                      <CommandGroup heading="Options">
                        <CommandItem
                          value="custom custom sponsor create type manual"
                          onSelect={() => {
                            handleSelectProposalSponsor("custom");
                            setIsProposalSponsorPickerOpen(false);
                          }}
                          className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="size-3.5 text-primary" />
                            <span className="font-medium">-- Custom Sponsor / Type Manually --</span>
                          </div>
                          {selectedProposalSponsorId === "custom" && <Check className="size-3.5 text-primary" />}
                        </CommandItem>
                      </CommandGroup>
                      <CommandGroup heading={`Sponsor Directory (${chapterSponsors.length})`}>
                        {chapterSponsors.map((s) => {
                          const isSelected =
                            selectedProposalSponsorId === s.id || selectedProposalSponsorId === String(s.bevy_id);
                          return (
                            <CommandItem
                              key={s.id}
                              value={`${s.company} ${s.contact_email || ""} ${s.bevy_id || ""} ${s.tier || ""}`}
                              onSelect={() => {
                                handleSelectProposalSponsor(s.id);
                                setIsProposalSponsorPickerOpen(false);
                              }}
                              className="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-7 w-12 shrink-0 rounded border border-border bg-white flex items-center justify-center p-0.5 overflow-hidden">
                                  {s.logo ? (
                                    <img
                                      src={s.logo}
                                      alt={s.company}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  ) : (
                                    <Building2 className="size-3 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex flex-col">
                                  <span className="font-medium text-foreground truncate">{s.company}</span>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    {s.contact_email ? <span className="truncate">{s.contact_email}</span> : null}
                                    {s.tier ? <span className="capitalize">• {s.tier.replace("_", " ")}</span> : null}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company Name *</Label>
              <Input
                placeholder="Target Company Name"
                value={proposalCompany}
                onChange={(e) => setProposalCompany(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Recipient Work Email *</Label>
              <Input
                type="email"
                placeholder="partner@company.com"
                value={proposalEmail}
                onChange={(e) => setProposalEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Sponsorship Tier</Label>
              <Select value={proposalTier} onValueChange={(val) => setProposalTier(val as SponsorCategory)}>
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
              <Label className="text-xs font-medium">Proposal Deck / Prospectus Link (Optional)</Label>
              <Input
                type="url"
                placeholder="https://drive.google.com/..."
                value={proposalDeckUrl}
                onChange={(e) => setProposalDeckUrl(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsProposalDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSendingProposal}>
                {isSendingProposal ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending via n8n...
                  </>
                ) : (
                  "Send Proposal"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Confirmed Sponsor Dialog */}
      {editingConfirmation && (
        <Dialog open={!!editingConfirmation} onOpenChange={(open) => !open && setEditingConfirmation(null)}>
          <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Edit Confirmed Sponsor
              </DialogTitle>
              <DialogDescription>Update sponsor registration details and tier for this event.</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingConfirmation.company_name?.trim()) {
                  toast.error("Company name is required.");
                  return;
                }

                startUpdatingTransition(async () => {
                  try {
                    const res = await updateSponsorConfirmationDetailsAction(editingConfirmation.id, event.id, {
                      company_name: editingConfirmation.company_name.trim(),
                      company_legal_name: editingConfirmation.company_legal_name?.trim() || "",
                      company_address: editingConfirmation.company_address?.trim() || "",
                      company_url: editingConfirmation.company_url || "",
                      company_description: editingConfirmation.company_description || "",
                      selected_tier: editingConfirmation.selected_tier,
                      contact_name: editingConfirmation.contact_name || "",
                      contact_title: editingConfirmation.contact_title?.trim() || "",
                      contact_email: editingConfirmation.contact_email || "",
                      contact_phone: editingConfirmation.contact_phone || "",
                      company_logo_url: editingConfirmation.company_logo_url || "",
                    });

                    if (res.success && res.confirmation) {
                      toast.success("Sponsor details updated!");
                      setEditingConfirmation(null);
                      setConfirmations((prev) =>
                        prev.map((c) => (c.id === res.confirmation!.id ? res.confirmation! : c)),
                      );
                    } else {
                      toast.error(res.error || "Failed to update sponsor.");
                    }
                  } catch {
                    toast.error("Error updating sponsor.");
                  }
                });
              }}
              className="space-y-4 py-2"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Company Name (Displayed on Poster) *</Label>
                  <Input
                    value={editingConfirmation.company_name || ""}
                    onChange={(e) => setEditingConfirmation({ ...editingConfirmation, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Company Legal Name (For Invoice / LOA)</Label>
                  <Input
                    placeholder="PT Acme Teknologi Indonesia"
                    value={editingConfirmation.company_legal_name || ""}
                    onChange={(e) =>
                      setEditingConfirmation({ ...editingConfirmation, company_legal_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company / Billing Address</Label>
                <Input
                  placeholder="Jl. Jend. Sudirman No. 1, Jakarta..."
                  value={editingConfirmation.company_address || ""}
                  onChange={(e) => setEditingConfirmation({ ...editingConfirmation, company_address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sponsorship Tier</Label>
                  <Select
                    value={editingConfirmation.selected_tier || "community"}
                    onValueChange={(val) =>
                      setEditingConfirmation({
                        ...editingConfirmation,
                        selected_tier: val as SponsorCategory,
                      })
                    }
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
                  <Label className="text-xs font-medium">Website URL</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={editingConfirmation.company_url || ""}
                    onChange={(e) => setEditingConfirmation({ ...editingConfirmation, company_url: e.target.value })}
                  />
                </div>
              </div>

              {/* 16:9 Logo Crop & Bevy Direct Upload for Edit */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Company Logo (16:9 Aspect Ratio)</Label>
                  <span className="text-[10px] text-muted-foreground">Uploads directly to Bevy</span>
                </div>
                {editingConfirmation.company_logo_url ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2 bg-muted/30">
                    <div className="relative aspect-video w-24 overflow-hidden rounded border border-border bg-white flex items-center justify-center p-1">
                      <img
                        src={editingConfirmation.company_logo_url}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        type="url"
                        placeholder="https://res.cloudinary.com/..."
                        value={editingConfirmation.company_logo_url || ""}
                        onChange={(e) =>
                          setEditingConfirmation({ ...editingConfirmation, company_logo_url: e.target.value })
                        }
                        className="h-7 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCropper("edit")}
                        className="h-7 text-xs"
                      >
                        <UploadCloud className="mr-1.5 h-3 w-3" />
                        Crop &amp; Upload New Logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleOpenCropper("edit")}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="h-6 w-6 text-muted-foreground mb-1" />
                    <p className="text-xs font-medium">Upload &amp; crop logo (16:9)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Directly uploads to Bevy image storage</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Description</Label>
                <Textarea
                  placeholder="Brief description of the sponsor..."
                  rows={2}
                  className="text-xs resize-none"
                  value={editingConfirmation.company_description || ""}
                  onChange={(e) =>
                    setEditingConfirmation({
                      ...editingConfirmation,
                      company_description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Person</Label>
                  <Input
                    value={editingConfirmation.contact_name || ""}
                    onChange={(e) => setEditingConfirmation({ ...editingConfirmation, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Position / Title</Label>
                  <Input
                    placeholder="Director / Marketing Lead"
                    value={editingConfirmation.contact_title || ""}
                    onChange={(e) => setEditingConfirmation({ ...editingConfirmation, contact_title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Contact Email</Label>
                  <Input
                    type="email"
                    value={editingConfirmation.contact_email || ""}
                    onChange={(e) => setEditingConfirmation({ ...editingConfirmation, contact_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Phone / WhatsApp</Label>
                <Input
                  value={editingConfirmation.contact_phone || ""}
                  onChange={(e) => setEditingConfirmation({ ...editingConfirmation, contact_phone: e.target.value })}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditingConfirmation(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingConfirmation}>
                  {isUpdatingConfirmation ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Sponsor to Event Dialog */}
      <Dialog open={isAddSponsorOpen} onOpenChange={setIsAddSponsorOpen}>
        <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add Sponsor to Event
            </DialogTitle>
            <DialogDescription>
              Assign a partner from chapter directory or create a custom sponsor for this event.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSponsorSubmit} className="space-y-4 py-2">
            {/* Quick Pick from Chapter Sponsors Directory */}
            {chapterSponsors.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Existing Chapter Partner
                </Label>
                <Popover open={isChapterPickerOpen} onOpenChange={setIsChapterPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isChapterPickerOpen}
                      className="w-full h-auto min-h-10 justify-between px-3 py-1.5 text-left font-normal bg-background hover:bg-muted/50 border-input"
                    >
                      {selectedChapterSponsorId === "custom" || !selectedChapterSponsorId ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Plus className="size-3.5" />
                          <span>-- Create / Type Custom Sponsor --</span>
                        </div>
                      ) : (
                        (() => {
                          const current = chapterSponsors.find(
                            (s) => s.id === selectedChapterSponsorId || String(s.bevy_id) === selectedChapterSponsorId,
                          );
                          if (!current) {
                            return <span className="text-xs text-muted-foreground">Choose a chapter partner...</span>;
                          }
                          return (
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-6 w-11 shrink-0 rounded border border-border bg-white flex items-center justify-center p-0.5 overflow-hidden">
                                {current.logo ? (
                                  <img
                                    src={current.logo}
                                    alt={current.company}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <Building2 className="size-3 text-muted-foreground" />
                                )}
                              </div>
                              <span className="font-semibold text-xs text-foreground truncate">{current.company}</span>
                              {current.bevy_id && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4 shrink-0 text-muted-foreground"
                                >
                                  #{current.bevy_id}
                                </Badge>
                              )}
                            </div>
                          );
                        })()
                      )}
                      <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search partners by name..." className="h-9 text-xs" />
                      <CommandList className="max-h-72 overflow-y-auto">
                        <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                          No partners found.
                        </CommandEmpty>
                        <CommandGroup heading="Options">
                          <CommandItem
                            value="custom custom sponsor create type manual"
                            onSelect={() => {
                              handleSelectChapterSponsor("custom");
                              setIsChapterPickerOpen(false);
                            }}
                            className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Plus className="size-3.5 text-primary" />
                              <span className="font-medium">-- Create / Type Custom Sponsor --</span>
                            </div>
                            {selectedChapterSponsorId === "custom" && <Check className="size-3.5 text-primary" />}
                          </CommandItem>
                        </CommandGroup>
                        <CommandGroup heading={`Chapter Partners (${chapterSponsors.length})`}>
                          {chapterSponsors.map((s) => {
                            const isSelected =
                              selectedChapterSponsorId === s.id || selectedChapterSponsorId === String(s.bevy_id);
                            return (
                              <CommandItem
                                key={s.id}
                                value={`${s.company} ${s.bevy_id || ""} ${s.tier || ""}`}
                                onSelect={() => {
                                  handleSelectChapterSponsor(s.id);
                                  setIsChapterPickerOpen(false);
                                }}
                                className="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-7 w-12 shrink-0 rounded border border-border bg-white flex items-center justify-center p-0.5 overflow-hidden">
                                    {s.logo ? (
                                      <img
                                        src={s.logo}
                                        alt={s.company}
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    ) : (
                                      <Building2 className="size-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex flex-col">
                                    <span className="font-medium text-foreground truncate">{s.company}</span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      {s.bevy_id ? <span>#{s.bevy_id}</span> : null}
                                      {s.tier ? <span className="capitalize">• {s.tier.replace("_", " ")}</span> : null}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Selecting a chapter partner will automatically prefill their details and Bevy ID.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Name *</Label>
                <Input
                  placeholder="Logitech, Google, etc."
                  value={newSponsorCompany}
                  onChange={(e) => setNewSponsorCompany(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Legal Name (For Invoice / LOA)</Label>
                <Input
                  placeholder="PT Acme Teknologi Indonesia"
                  value={newSponsorLegalName}
                  onChange={(e) => setNewSponsorLegalName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company / Billing Address</Label>
              <Input
                placeholder="Jl. Jend. Sudirman No. 1, Jakarta..."
                value={newSponsorAddress}
                onChange={(e) => setNewSponsorAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Event Tier</Label>
                <Select value={newSponsorTier} onValueChange={(val) => setNewSponsorTier(val as SponsorCategory)}>
                  <SelectTrigger className="h-9 text-xs">
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
                <Label className="text-xs font-medium">Website URL</Label>
                <Input
                  type="url"
                  placeholder="https://company.com"
                  value={newSponsorUrl}
                  onChange={(e) => setNewSponsorUrl(e.target.value)}
                />
              </div>
            </div>

            {/* 16:9 Logo Crop & Bevy Direct Upload for Add */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Company Logo (16:9 Aspect Ratio)</Label>
                <span className="text-[10px] text-muted-foreground">Uploads directly to Bevy</span>
              </div>
              {newSponsorLogo ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-2 bg-muted/30">
                  <div className="relative aspect-video w-24 overflow-hidden rounded border border-border bg-white flex items-center justify-center p-1">
                    <img src={newSponsorLogo} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      type="url"
                      placeholder="https://res.cloudinary.com/..."
                      value={newSponsorLogo}
                      onChange={(e) => setNewSponsorLogo(e.target.value)}
                      className="h-7 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCropper("add")}
                      className="h-7 text-xs"
                    >
                      <UploadCloud className="mr-1.5 h-3 w-3" />
                      Crop &amp; Upload New Logo
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => handleOpenCropper("add")}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 cursor-pointer transition-colors"
                >
                  <UploadCloud className="h-6 w-6 text-muted-foreground mb-1" />
                  <p className="text-xs font-medium">Upload &amp; crop logo (16:9)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Directly uploads to Bevy image storage</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Person</Label>
                <Input
                  placeholder="Representative name"
                  value={newSponsorContactName}
                  onChange={(e) => setNewSponsorContactName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Position / Title</Label>
                <Input
                  placeholder="Director / Lead"
                  value={newSponsorContactTitle}
                  onChange={(e) => setNewSponsorContactTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Email</Label>
                <Input
                  type="email"
                  placeholder="partner@company.com"
                  value={newSponsorContactEmail}
                  onChange={(e) => setNewSponsorContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contact Phone / WhatsApp</Label>
              <Input
                placeholder="0812..."
                value={newSponsorContactPhone}
                onChange={(e) => setNewSponsorContactPhone(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddSponsorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAddingSponsor}>
                {isAddingSponsor ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding &amp; Syncing with Bevy...
                  </>
                ) : (
                  "Add Sponsor"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sponsor Documents Modal */}
      <SponsorDocumentsDialog
        open={!!documentsSponsorContext}
        onOpenChange={(v) => !v && setDocumentsSponsorContext(null)}
        sponsorContext={documentsSponsorContext}
      />

      {/* 16:9 Logo Cropper Dialog */}
      <SponsorLogoCropperDialog
        open={cropModalOpen}
        onOpenChange={setCropModalOpen}
        imageSrc={rawImageSrc}
        onCropped={handleCropped}
        isUploading={isUploadingLogo}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
