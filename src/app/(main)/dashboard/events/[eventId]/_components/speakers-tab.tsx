"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Laptop,
  Loader2,
  Mail,
  MapPin,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shirt,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { HtmlEditorPreview } from "@/app/(main)/dashboard/email-manager/_components/html-editor-preview";
import { DatePicker } from "@/components/date-picker";
import { GoogleMapsPinpointDialog } from "@/components/maps/google-maps-pinpoint-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { BevyPersonSearchResult } from "@/lib/bevy/client";
import { SPEAKER_ROLES_CONFIG, type SpeakerRoleKey } from "@/lib/bevy/speakers";
import {
  getDefaultTemplateByKey,
  getDefaultTemplateDataForType,
  interpolateTemplateHtml,
} from "@/lib/events/email-templates";
import {
  DEFAULT_SPEAKER_CUSTOM_SWAGS,
  DEFAULT_SPEAKER_HANDBOOK_MARKDOWN,
  interpolateHandbookVariables,
  renderSlideTemplatesHtml,
  resolveSpeakerHandbookEventDetails,
  simpleMarkdownToHtml,
} from "@/lib/events/speaker-handbook";
import type { EventSpeakerConfig, EventSpeakerConfirmation, FirestoreEvent } from "@/lib/firestore/types";
import { SPEAKER_SLIDE_TEMPLATE_PRESETS } from "@/lib/firestore/types";
import { searchBevyPersonsAction } from "@/server/bevy-actions";
import {
  addManualSpeakerConfirmationAction,
  deleteSpeakerConfirmationAction,
  getEventSpeakerConfirmationsAction,
  getExistingEventSlideTemplateOptionsAction,
  getOrInitEventSpeakerConfigAction,
  regenerateSpeakerShareTokenAction,
  resendSpeakerInvitationAction,
  syncSpeakerConfirmationToBevyAction,
  updateEventSpeakerConfigAction,
  updateEventSpeakerEmailTemplateAction,
} from "@/server/speaker-confirmation-actions";

function LinkedInIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.22a1.62 1.62 0 0 0-1.62 1.62c0 .9.72 1.62 1.62 1.62a1.62 1.62 0 0 0 1.62-1.62c0-.9-.72-1.62-1.62-1.62Z" />
    </svg>
  );
}

function XTwitterIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function WhatsAppIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3" />
    </svg>
  );
}

function formatLinkedInUrl(raw?: string | null): { url: string; display: string } | null {
  if (!raw?.trim() || raw.trim() === "-") return null;
  const clean = raw.trim();
  let url = clean;
  if (!/^https?:\/\//i.test(url)) {
    if (/^(www\.)?linkedin\.com/i.test(url)) {
      url = `https://${url}`;
    } else {
      url = `https://linkedin.com/in/${url.replace(/^\/+/, "")}`;
    }
  }
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  const display = match ? `in/${match[1]}` : clean.replace(/^https?:\/\/(www\.)?linkedin\.com\/?/i, "");
  return { url, display: display || clean };
}

function formatTwitterHandle(raw?: string | null): { url: string; display: string } | null {
  if (!raw?.trim() || raw.trim() === "-") return null;
  const handle = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
  if (!handle) return null;
  return {
    url: `https://x.com/${handle}`,
    display: `@${handle}`,
  };
}

function formatInstagramHandle(raw?: string | null): { url: string; display: string } | null {
  if (!raw?.trim() || raw.trim() === "-") return null;
  const handle = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
  if (!handle) return null;
  return {
    url: `https://instagram.com/${handle}`,
    display: `@${handle}`,
  };
}

function formatPortfolioUrl(raw?: string | null): { url: string; display: string } | null {
  if (!raw?.trim() || raw.trim() === "-") return null;
  const clean = raw.trim();
  const url = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  const display = clean.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  return { url, display };
}

interface SpeakersTabProps {
  eventId: string | number;
  event: FirestoreEvent;
}

export function SpeakersTab({ eventId, event }: SpeakersTabProps) {
  const [isPending, startTransition] = useTransition();

  const [config, setConfig] = useState<EventSpeakerConfig>(() => ({
    enabled: event.speaker_config?.enabled ?? true,
    share_token: event.speaker_config?.share_token || "",
    auto_send_invitation: event.speaker_config?.auto_send_invitation ?? true,
    handbook_format: event.speaker_config?.handbook_format || "markdown",
    handbook_content: event.speaker_config?.handbook_content || DEFAULT_SPEAKER_HANDBOOK_MARKDOWN,
    active_slide_preset: event.speaker_config?.active_slide_preset || "gdg_default",
    custom_slide_template_url: event.speaker_config?.custom_slide_template_url || "",
    require_presentation_slides: event.speaker_config?.require_presentation_slides ?? true,
    allow_session_co_speakers: event.speaker_config?.allow_session_co_speakers ?? false,
    max_photo_size_mb: event.speaker_config?.max_photo_size_mb ?? 5,
    show_swag_section: event.speaker_config?.show_swag_section ?? true,
    selected_merchandise_ids: event.speaker_config?.selected_merchandise_ids,
    custom_swags:
      event.speaker_config?.custom_swags && event.speaker_config.custom_swags.length > 0
        ? event.speaker_config.custom_swags
        : DEFAULT_SPEAKER_CUSTOM_SWAGS,
  }));

  const [newCustomSwagLabel, setNewCustomSwagLabel] = useState("");
  const [newCustomSwagDesc, setNewCustomSwagDesc] = useState("");
  const [newCustomSwagOptions, setNewCustomSwagOptions] = useState("S, M, L, XL, 2XL, 3XL");

  // Edit custom swag state
  const [editingSwagIndex, setEditingSwagIndex] = useState<number | null>(null);
  const [editSwagLabel, setEditSwagLabel] = useState("");
  const [editSwagDesc, setEditSwagDesc] = useState("");
  const [editSwagOptions, setEditSwagOptions] = useState("");

  // Existing events with slide templates for dropdown selection
  const [existingEventsWithTemplates, setExistingEventsWithTemplates] = useState<
    Array<{ id: string; title: string; url: string; label: string }>
  >([]);
  // Dynamic official presets loaded from Short.io
  const [officialPresets, setOfficialPresets] =
    useState<Record<string, { id: string; label: string; url: string; is_default?: boolean }>>(
      SPEAKER_SLIDE_TEMPLATE_PRESETS,
    );

  // Custom slide template dialog/inline form state
  const [isAddingCustomPreset, setIsAddingCustomPreset] = useState(false);
  const [customPresetUrlInput, setCustomPresetUrlInput] = useState("");

  const [confirmations, setConfirmations] = useState<EventSpeakerConfirmation[]>([]);
  const [loadingConfirmations, setLoadingConfirmations] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"roster" | "handbook" | "invitation_email" | "settings">("roster");

  // Handbook editor state
  const [handbookContent, setHandbookContent] = useState(config.handbook_content);
  const [_previewDevice, _setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isSavingHandbook, setIsSavingHandbook] = useState(false);
  const [isDinnerMapOpen, setIsDinnerMapOpen] = useState(false);

  // Speaker Invitation Email editor state
  const [invitationEmailHtml, setInvitationEmailHtml] = useState<string>(
    () => event.email_templates?.speaker_invitation || getDefaultTemplateByKey("speaker_invitation"),
  );
  const [savedInvitationEmailHtml, setSavedInvitationEmailHtml] = useState<string>(
    () => event.email_templates?.speaker_invitation || getDefaultTemplateByKey("speaker_invitation"),
  );
  const [isSavingInvitationEmail, setIsSavingInvitationEmail] = useState(false);

  // Add Speaker Modal State
  const [isAddSpeakerOpen, setIsAddSpeakerOpen] = useState(false);
  const [viewingConfirmation, setViewingConfirmation] = useState<EventSpeakerConfirmation | null>(null);
  const [addMode, setAddMode] = useState<"search" | "manual">("search");
  const [algoliaSearchQuery, setAlgoliaSearchQuery] = useState("");
  const [isSearchingAlgolia, setIsSearchingAlgolia] = useState(false);
  const [algoliaResults, setAlgoliaResults] = useState<BevyPersonSearchResult[]>([]);
  const [selectedBevyPerson, setSelectedBevyPerson] = useState<BevyPersonSearchResult | null>(null);

  // Form fields for Add Speaker
  const [manualFullName, setManualFullName] = useState("");
  const [manualDisplayName, setManualDisplayName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualJobTitle, setManualJobTitle] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualProfileUrl, setManualProfileUrl] = useState("");
  const [manualTalkTitle, setManualTalkTitle] = useState("");
  const [manualTalkType, setManualTalkType] = useState("Technical Talk (45 mins)");
  const [manualPresenterRole, setManualPresenterRole] = useState<SpeakerRoleKey>("speakers");
  const [manualSessionSlot, setManualSessionSlot] = useState("");
  const [manualBiography, setManualBiography] = useState("");
  const [manualSendEmail, setManualSendEmail] = useState(true);
  const [isSubmittingSpeaker, setIsSubmittingSpeaker] = useState(false);

  const handleSearchAlgoliaSpeakers = async (query: string) => {
    setAlgoliaSearchQuery(query);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setAlgoliaResults([]);
      return;
    }
    setIsSearchingAlgolia(true);
    try {
      const res = await searchBevyPersonsAction(trimmed, 8);
      if (res.success && res.hits) {
        setAlgoliaResults(res.hits);
      } else {
        setAlgoliaResults([]);
      }
    } catch {
      setAlgoliaResults([]);
    } finally {
      setIsSearchingAlgolia(false);
    }
  };

  const handleSelectPersonForAdd = (person: BevyPersonSearchResult) => {
    setSelectedBevyPerson(person);
    const fullNameVal = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    setManualFullName(fullNameVal);
    setManualDisplayName(fullNameVal);
    setManualJobTitle(person.title || "");
    setManualCompany(person.company || "");
    setManualProfileUrl(person.picture_url || "");
    setAddMode("manual"); // Switch to details review
    toast.info(`Selected ${fullNameVal}. Please verify email and talk session.`);
  };

  const resetAddSpeakerForm = () => {
    setSelectedBevyPerson(null);
    setAlgoliaSearchQuery("");
    setAlgoliaResults([]);
    setManualFullName("");
    setManualDisplayName("");
    setManualEmail("");
    setManualJobTitle("");
    setManualCompany("");
    setManualProfileUrl("");
    setManualTalkTitle("");
    setManualTalkType("Technical Talk (45 mins)");
    setManualPresenterRole("speakers");
    setManualSessionSlot(agendaSlots[0]?.value || "");
    setManualBiography("");
    setManualSendEmail(true);
    setAddMode("search");
  };

  const handleCreateSpeakerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (!manualEmail.trim()) {
      toast.error("Speaker email is required.");
      return;
    }
    if (!manualTalkTitle.trim()) {
      toast.error("Talk title is required.");
      return;
    }

    // Check duplicate in local roster
    const cleanEmail = manualEmail.trim().toLowerCase();
    const isDup = confirmations.some(
      (c) =>
        c.speaker_email?.toLowerCase() === cleanEmail ||
        (selectedBevyPerson && c.bevy_person_id === selectedBevyPerson.id),
    );
    if (isDup) {
      toast.error(`Speaker with email ${cleanEmail} is already in the roster.`);
      return;
    }

    setIsSubmittingSpeaker(true);
    try {
      const res = await addManualSpeakerConfirmationAction({
        event_id: eventId,
        full_name: manualFullName.trim(),
        display_name: manualDisplayName.trim() || manualFullName.trim(),
        speaker_email: cleanEmail,
        job_title: manualJobTitle.trim(),
        company_institution: manualCompany.trim(),
        speaker_profile_url: manualProfileUrl.trim(),
        talk_type: manualTalkType,
        presenter_role: manualPresenterRole,
        talk_title: manualTalkTitle.trim(),
        session_slot: manualSessionSlot.trim(),
        biography: manualBiography.trim(),
        bevy_person_id: selectedBevyPerson?.id,
        send_invitation_email: manualSendEmail,
      });

      if (res.success) {
        toast.success(`Speaker ${manualFullName} added successfully!`);
        setIsAddSpeakerOpen(false);
        resetAddSpeakerForm();
        // Refresh confirmations
        const confRes = await getEventSpeakerConfirmationsAction(eventId);
        if (confRes.success && confRes.confirmations) {
          setConfirmations(confRes.confirmations);
        }
      } else {
        toast.error(res.error || "Failed to add speaker.");
      }
    } catch {
      toast.error("An error occurred while adding speaker.");
    } finally {
      setIsSubmittingSpeaker(false);
    }
  };

  // Load confirmations & config on mount
  useEffect(() => {
    startTransition(async () => {
      const cfgRes = await getOrInitEventSpeakerConfigAction(eventId);
      if (cfgRes.success && cfgRes.config) {
        const loadedConfig = {
          ...cfgRes.config,
          max_photo_size_mb: cfgRes.config.max_photo_size_mb ?? 5,
          custom_swags:
            cfgRes.config.custom_swags && cfgRes.config.custom_swags.length > 0
              ? cfgRes.config.custom_swags
              : DEFAULT_SPEAKER_CUSTOM_SWAGS,
        };
        setConfig(loadedConfig);
        setHandbookContent(cfgRes.config.handbook_content);
      }

      const confRes = await getEventSpeakerConfirmationsAction(eventId);
      if (confRes.success && confRes.confirmations) {
        setConfirmations(confRes.confirmations);
      }
      setLoadingConfirmations(false);

      // Load existing events and dynamic Short.io presets to populate slide template options
      try {
        const slideOptionsRes = await getExistingEventSlideTemplateOptionsAction(eventId);
        if (slideOptionsRes.success) {
          if (slideOptionsRes.options) {
            setExistingEventsWithTemplates(slideOptionsRes.options);
          }
          if (slideOptionsRes.presets) {
            setOfficialPresets(slideOptionsRes.presets);
          }
        }
      } catch (err) {
        console.error("Failed to load existing events with templates:", err);
      }
    });
  }, [eventId]);

  const confirmationLink = useMemo(() => {
    if (typeof window === "undefined" || !config.share_token) return "";
    return `${window.location.origin}/events/${eventId}/speaker-confirmation?token=${config.share_token}`;
  }, [eventId, config.share_token]);

  const handbookLink = useMemo(() => {
    if (typeof window === "undefined" || !config.share_token) return "";
    return `${window.location.origin}/events/${eventId}/speaker-handbook?token=${config.share_token}`;
  }, [eventId, config.share_token]);

  const handleCopyLink = (link: string, label: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleRegenerateToken = () => {
    if (!confirm("Regenerating the share token will invalidate any existing speaker confirmation links. Continue?")) {
      return;
    }
    startTransition(async () => {
      const res = await regenerateSpeakerShareTokenAction(eventId);
      if (res.success && res.new_token) {
        const nextToken = res.new_token;
        setConfig((prev) => ({ ...prev, share_token: nextToken }));
        toast.success("New speaker share token generated!");
      } else {
        toast.error(res.error || "Failed to regenerate token.");
      }
    });
  };

  const handleSaveConfig = (partial: Partial<EventSpeakerConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    startTransition(async () => {
      const res = await updateEventSpeakerConfigAction(eventId, updated);
      if (res.success) {
        toast.success("Speaker configuration saved!");
      } else {
        toast.error(res.error || "Failed to save configuration.");
      }
    });
  };

  const handleSaveHandbook = async () => {
    setIsSavingHandbook(true);
    const res = await updateEventSpeakerConfigAction(eventId, {
      ...config,
      handbook_content: handbookContent,
    });
    setIsSavingHandbook(false);
    if (res.success) {
      setConfig((prev) => ({ ...prev, handbook_content: handbookContent }));
      toast.success("Speaker Handbook updated successfully!");
    } else {
      toast.error(res.error || "Failed to save handbook.");
    }
  };

  const handleSaveInvitationEmail = async () => {
    setIsSavingInvitationEmail(true);
    const res = await updateEventSpeakerEmailTemplateAction(eventId, invitationEmailHtml);
    setIsSavingInvitationEmail(false);
    if (res.success) {
      setSavedInvitationEmailHtml(invitationEmailHtml);
      toast.success("Speaker invitation email template saved successfully!");
    } else {
      toast.error(res.error || "Failed to save email template.");
    }
  };

  const handleResetInvitationEmail = () => {
    const defaultHtml = getDefaultTemplateByKey("speaker_invitation");
    setInvitationEmailHtml(defaultHtml);
    toast.info("Template reset to official default (click Save to persist)");
  };

  const handleResendInvitation = (conf: EventSpeakerConfirmation) => {
    startTransition(async () => {
      const res = await resendSpeakerInvitationAction(conf.id, eventId);
      if (res.success) {
        toast.success(`Invitation email resent to ${conf.speaker_email}`);
        setConfirmations((prev) => prev.map((c) => (c.id === conf.id ? { ...c, invitation_email_sent: true } : c)));
      } else {
        toast.error(res.error || "Failed to resend invitation.");
      }
    });
  };

  const handleSyncToBevy = (conf: EventSpeakerConfirmation) => {
    startTransition(async () => {
      const res = await syncSpeakerConfirmationToBevyAction(conf.id, eventId);
      if (res.success) {
        toast.success(`Synced ${conf.full_name} to Bevy people roster (ID: ${res.bevy_person_id})`);
        setConfirmations((prev) =>
          prev.map((c) => (c.id === conf.id ? { ...c, bevy_synced: true, bevy_person_id: res.bevy_person_id } : c)),
        );
      } else {
        toast.error(res.error || "Failed to sync to Bevy.");
      }
    });
  };

  const handleDeleteConfirmation = (conf: EventSpeakerConfirmation) => {
    if (!confirm(`Delete confirmation for speaker ${conf.full_name}?`)) return;
    startTransition(async () => {
      const res = await deleteSpeakerConfirmationAction(conf.id, eventId);
      if (res.success) {
        toast.success("Speaker confirmation deleted.");
        setConfirmations((prev) => prev.filter((c) => c.id !== conf.id));
      } else {
        toast.error(res.error || "Failed to delete confirmation.");
      }
    });
  };

  const resolveSwagItemName = (key: string): string => {
    if (key === "default_tshirt" || key === "tshirt" || key === "tshirt_size") {
      const customDefault = config.custom_swags?.find((cs) => cs.id === "default_tshirt" || cs.is_default);
      return customDefault?.label || "Speaker T-Shirt";
    }
    if (key.startsWith("merch_")) {
      const merchId = key.replace(/^merch_/, "");
      const foundMerch = event.merchandise?.find((m) => m.id === merchId);
      if (foundMerch) return foundMerch.name;
    }
    if (key.startsWith("custom_")) {
      const customId = key.replace(/^custom_/, "");
      const foundCustom = config.custom_swags?.find((cs) => cs.id === customId || `custom_${cs.id}` === key);
      if (foundCustom) return foundCustom.label;
    }
    const directCustom = config.custom_swags?.find((cs) => cs.id === key);
    if (directCustom) return directCustom.label;

    const directMerch = event.merchandise?.find((m) => m.id === key);
    if (directMerch) return directMerch.name;

    return key
      .replace(/^(merch|custom)_/, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Extract agenda slots from Bevy / event agenda
  const agendaSlots = useMemo(() => {
    const slots: Array<{ id: string; label: string; value: string; track?: string; time?: string }> = [];
    const rawAgenda = event?.agenda;
    if (!rawAgenda) return slots;

    if (Array.isArray(rawAgenda)) {
      rawAgenda.forEach((item, idx) => {
        const act = item.activity || (item as unknown as { title?: string }).title;
        if (act?.trim()) {
          const timeLabel = item.time ? ` (${item.time})` : "";
          const val = `${act}${timeLabel}`;
          slots.push({
            id: `agenda_slot_${idx}`,
            label: item.time ? `${item.time} - ${act}` : act,
            value: val,
            track: "Main Stage",
            time: item.time,
          });
        }
      });
    } else if (rawAgenda.days && Array.isArray(rawAgenda.days)) {
      rawAgenda.days.forEach((day, dIdx) => {
        const trackName = day.title?.trim() || `Track ${dIdx + 1}`;
        const items = day.agenda || day.items || [];
        items.forEach((item, iIdx) => {
          const act = item.activity || (item as unknown as { title?: string }).title;
          if (act?.trim()) {
            const timeLabel = item.time ? ` (${item.time})` : "";
            const val = `[${trackName}] ${act}${timeLabel}`;
            slots.push({
              id: `agenda_slot_${dIdx}_${iIdx}`,
              label: item.time ? `[${trackName}] ${item.time} - ${act}` : `[${trackName}] ${act}`,
              value: val,
              track: trackName,
              time: item.time,
            });
          }
        });
      });
    }
    return slots;
  }, [event?.agenda]);

  const filteredConfirmations = useMemo(() => {
    if (!searchQuery.trim()) return confirmations;
    const q = searchQuery.toLowerCase();
    return confirmations.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.speaker_email.toLowerCase().includes(q) ||
        c.talk_title.toLowerCase().includes(q) ||
        c.talk_type.toLowerCase().includes(q),
    );
  }, [confirmations, searchQuery]);

  // Rendered handbook HTML preview
  const handbookHtmlPreview = useMemo(() => {
    // Check if preset key is an existing event template
    const selectedExistingEvent = existingEventsWithTemplates.find((e) => e.id === config.active_slide_preset);
    const activePreset = selectedExistingEvent
      ? {
          id: selectedExistingEvent.id,
          label: selectedExistingEvent.label,
          url: selectedExistingEvent.url,
          is_default: false,
        }
      : officialPresets[config.active_slide_preset || "gdg_default"] ||
        officialPresets.gdg_default ||
        SPEAKER_SLIDE_TEMPLATE_PRESETS.gdg_default;

    const slideTemplates = [
      activePreset,
      ...(config.custom_slide_template_url
        ? [
            {
              id: "custom",
              label: "Custom Event Slide Template",
              url: config.custom_slide_template_url,
            },
          ]
        : []),
    ];

    const resolvedDetails = resolveSpeakerHandbookEventDetails(event, slideTemplates);
    const interpolatedMarkdown = interpolateHandbookVariables(handbookContent || "", resolvedDetails);
    const contentHtml = simpleMarkdownToHtml(interpolatedMarkdown);
    const slidesBlock = renderSlideTemplatesHtml(slideTemplates);

    const headerImageUrl =
      event.banner_url ||
      event.picture_url ||
      "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

    const formattedDate = resolvedDetails.date;
    const venueName = resolvedDetails.location;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 16px;
              line-height: 1.6;
              color: #202124;
              background: #f8f9fa;
            }
            .card-wrapper {
              max-width: 820px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 16px;
              border: 1px solid #e0e0e0;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            }
            .header-banner {
              width: 100%;
              max-height: 240px;
              object-fit: cover;
              display: block;
              border-bottom: 1px solid #e0e0e0;
            }
            .header-meta {
              background: #fcfcfd;
              border-bottom: 1px solid #e8eaed;
              padding: 18px 28px;
            }
            .badge {
              display: inline-block;
              background: #e8f0fe;
              color: #1a73e8;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 4px 10px;
              border-radius: 9999px;
            }
            .verified-badge {
              display: inline-block;
              background: #e6f4ea;
              color: #137333;
              font-size: 11px;
              font-weight: 600;
              padding: 3px 8px;
              border-radius: 9999px;
              margin-left: 6px;
            }
            .event-title {
              margin: 12px 0 6px 0;
              font-size: 24px;
              font-weight: 700;
              color: #202124;
              letter-spacing: -0.5px;
            }
            .event-subtitle {
              margin: 0;
              font-size: 13.5px;
              color: #5f6368;
            }
            .meta-row {
              margin-top: 14px;
              display: flex;
              flex-wrap: wrap;
              gap: 16px;
              font-size: 12px;
              color: #5f6368;
            }
            .meta-item {
              display: inline-flex;
              align-items: center;
              gap: 5px;
            }
            .body-container {
              padding: 24px 28px;
            }
            h1, h2, h3 { color: #202124; font-family: 'Google Sans', sans-serif; font-weight: 700; margin-top: 1.1em; margin-bottom: 0.4em; }
            h1 { font-size: 20px; border-bottom: 1.5px solid #e8eaed; padding-bottom: 6px; }
            h2 { font-size: 16px; border-bottom: 1px solid #f1f3f4; padding-bottom: 4px; }
            h3 { font-size: 14px; }
            p { margin: 8px 0; font-size: 13px; color: #3c4043; line-height: 1.5; }
            pre { background: #1e1e1e; color: #f1f3f4; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 10px 0; }
            code { background: #f1f3f4; color: #202124; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
            ul, ol { padding-left: 18px; margin: 6px 0; }
            li { margin-bottom: 3px; font-size: 13px; color: #3c4043; line-height: 1.45; }
            hr { margin: 14px 0; border: none; border-top: 1px solid #e8eaed; }
            table { border-collapse: collapse; width: 100%; margin: 12px 0; }
            th, td { border: 1px solid #dadce0; padding: 6px 10px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: 600; }
            a { color: #1a73e8; text-decoration: none; font-weight: 600; }
            a:hover { text-decoration: underline; }
            .footer {
              margin-top: 24px;
              padding: 18px 16px;
              border-top: 1px solid #e8eaed;
              background: #fafafa;
              text-align: center;
              font-size: 12px;
              color: #5f6368;
            }
          </style>
        </head>
        <body>
          <div class="card-wrapper">
            <img src="${headerImageUrl}" alt="Header" class="header-banner" />
            <div class="header-meta">
              <span class="badge">🎤 Official Speaker Handbook</span>
              <span class="verified-badge">✨ Verified Event Access</span>
              <div class="event-title">${event.title}</div>
              <div class="event-subtitle">Guidelines, slide dimensions, stage equipment, and logistics for confirmed speakers.</div>
              <div class="meta-row">
                <span class="meta-item">📅 ${formattedDate}</span>
                ${venueName ? `<span class="meta-item">📍 ${venueName}</span>` : ""}
                <span class="meta-item">📊 16:9 Widescreen Slides</span>
              </div>
            </div>
            <div class="body-container">
              ${contentHtml}
              <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e8eaed;">
                <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #5f6368;">Official Slide Decks &amp; Resources</h3>
                ${slidesBlock}
              </div>
            </div>
            <div class="footer">
              <img src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 110px; display: inline-block; margin-bottom: 6px;" alt="GDG Jakarta" />
              <div>Google Developer Group Jakarta &bull; Empowering developers across Indonesia</div>
            </div>
          </div>
        </body>
      </html>
    `;
  }, [
    handbookContent,
    config.active_slide_preset,
    config.custom_slide_template_url,
    event,
    existingEventsWithTemplates,
    officialPresets.gdg_default,
    officialPresets,
  ]);

  // Render HTML preview for Speaker Invitation Email
  const invitationEmailHtmlPreview = useMemo(() => {
    try {
      const simulatedData = getDefaultTemplateDataForType("speaker_invitation", event);
      return interpolateTemplateHtml(invitationEmailHtml, simulatedData);
    } catch (err) {
      console.error("[SpeakersTab] Failed to interpolate invitation email HTML:", err);
      return invitationEmailHtml;
    }
  }, [invitationEmailHtml, event]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Share Link Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Mic className="size-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Speaker Confirmation & Handbook</CardTitle>
              <Badge variant={config.enabled ? "default" : "secondary"}>{config.enabled ? "Active" : "Closed"}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyLink(confirmationLink, "Speaker confirmation form link")}
                disabled={!config.enabled}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copy Confirmation Link
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCopyLink(handbookLink, "Speaker handbook link")}>
                <ExternalLink className="mr-1.5 size-3.5" />
                Copy Handbook Link
              </Button>
            </div>
          </div>
          <CardDescription>
            Speakers receive an instant invitation email and Google Calendar invite upon filling out their confirmation
            form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-col gap-2 rounded-md border bg-background p-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
              <span className="font-semibold text-foreground">Form URL: </span>
              {confirmationLink || "Generating..."}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground text-xs hover:text-foreground"
              onClick={handleRegenerateToken}
              disabled={isPending}
            >
              <RefreshCw className="mr-1 size-3" />
              Regenerate Token
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as typeof activeSubTab)}>
        <div className="scrollbar-none -mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-9 w-max items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground group-data-horizontal/tabs:h-9">
            <TabsTrigger value="roster" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Users className="size-4" />
              Speakers ({confirmations.length})
            </TabsTrigger>
            <TabsTrigger value="handbook" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Laptop className="size-4" />
              Speaker Handbook
            </TabsTrigger>
            <TabsTrigger value="invitation_email" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Mail className="size-4" />
              Invitation Email
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-none gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
              <Calendar className="size-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. SPEAKERS ROSTER */}
        <TabsContent value="roster" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Confirmed Speakers ({confirmations.length})</CardTitle>
                  <CardDescription>
                    Manage confirmed speakers, track session slots, presentation slide links, and Bevy roster
                    synchronization.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Search speaker by name, email, or talk title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      resetAddSpeakerForm();
                      setIsAddSpeakerOpen(true);
                    }}
                  >
                    <UserPlus className="mr-1.5 size-3.5" />
                    Add Speaker
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      startTransition(async () => {
                        const res = await getEventSpeakerConfirmationsAction(eventId);
                        if (res.success && res.confirmations) {
                          setConfirmations(res.confirmations);
                          toast.success("Roster refreshed!");
                        }
                      });
                    }}
                    disabled={isPending}
                  >
                    <RefreshCw className={`mr-1.5 size-3.5 ${isPending ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Speaker</TableHead>
                      <TableHead>Talk Title &amp; Type</TableHead>
                      <TableHead>Session Slot</TableHead>
                      <TableHead>Slides URL</TableHead>
                      <TableHead>Invited &amp; Calendar</TableHead>
                      <TableHead>Bevy Sync</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingConfirmations ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          Loading speaker confirmations...
                        </TableCell>
                      </TableRow>
                    ) : filteredConfirmations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No speaker confirmations yet. Share the confirmation form link to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredConfirmations.map((conf) => {
                        const initials = conf.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();

                        return (
                          <TableRow key={conf.id}>
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <Avatar className="size-10 shrink-0 border bg-muted">
                                  {conf.speaker_profile_url && (
                                    <AvatarImage
                                      src={conf.speaker_profile_url}
                                      alt={conf.full_name}
                                      className="object-cover"
                                    />
                                  )}
                                  <AvatarFallback className="font-semibold text-xs">{initials || "SP"}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="font-medium">{conf.full_name}</div>
                                  <div className="text-muted-foreground text-xs">{conf.speaker_email}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {conf.job_title} {conf.company_institution ? `at ${conf.company_institution}` : ""}
                                  </div>
                                  {conf.is_from_google_ecosystem && conf.is_from_google_ecosystem !== "None above" && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <Badge
                                        variant="secondary"
                                        className="h-4 bg-amber-500/10 px-1 font-semibold text-[9px] text-amber-700 dark:text-amber-400"
                                      >
                                        {conf.is_from_google_ecosystem}
                                      </Badge>
                                      {conf.ecosystem_details && (
                                        <span className="max-w-[140px] truncate text-[10px] text-muted-foreground">
                                          ({conf.ecosystem_details})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {(conf.tshirt_size ||
                                    (conf.swag_selections && Object.keys(conf.swag_selections).length > 0)) && (
                                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <Shirt className="size-3 shrink-0 text-sky-500" />
                                      <span className="max-w-[180px] truncate">
                                        {conf.swag_selections && Object.keys(conf.swag_selections).length > 0
                                          ? Object.entries(conf.swag_selections)
                                              .map(([k, v]) => `${resolveSwagItemName(k)}: ${v}`)
                                              .join(", ")
                                          : conf.tshirt_size}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="line-clamp-1 font-medium">{conf.talk_title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {conf.talk_type}
                                </Badge>
                                {conf.presenter_role && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-blue-500/10 text-[9px] text-blue-700 capitalize dark:text-blue-300"
                                  >
                                    {conf.presenter_role === "speakers"
                                      ? "Speaker"
                                      : conf.presenter_role.replace(/s$/, "")}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {conf.session_slot ? (
                                conf.session_slot
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {conf.presentation_slides_url ? (
                                <a
                                  href={conf.presentation_slides_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                                >
                                  View Slides
                                  <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">Pending</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-[11px]">
                                  {conf.invitation_email_sent ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    >
                                      <CheckCircle2 className="mr-1 size-3" /> Email Sent
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-600">
                                      Email Failed
                                    </Badge>
                                  )}
                                </div>
                                {conf.calendar_invite_sent ? (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <span>✓ Calendar invited</span>
                                    {conf.calendar_event_url && (
                                      <a
                                        href={conf.calendar_event_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                        title="Open Google Calendar Event"
                                      >
                                        <ExternalLink className="size-2.5" />
                                      </a>
                                    )}
                                  </div>
                                ) : conf.calendar_invite_error ? (
                                  <div
                                    className="max-w-[140px] truncate text-[10px] text-destructive"
                                    title={conf.calendar_invite_error}
                                  >
                                    ⚠ Cal: {conf.calendar_invite_error}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              {conf.bevy_synced ? (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  Bevy #{conf.bevy_person_id}
                                </Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleSyncToBevy(conf)}
                                  disabled={isPending}
                                >
                                  Sync to Bevy
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  title="View submitted confirmation details"
                                  onClick={() => setViewingConfirmation(conf)}
                                >
                                  <Eye className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  title="Resend invitation email"
                                  onClick={() => handleResendInvitation(conf)}
                                  disabled={isPending}
                                >
                                  <Send className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive"
                                  title="Delete confirmation"
                                  onClick={() => handleDeleteConfirmation(conf)}
                                  disabled={isPending}
                                >
                                  <Trash2 className="size-4" />
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
        </TabsContent>

        {/* 2. SPEAKER HANDBOOK EDITOR */}
        <TabsContent value="handbook" className="space-y-4 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-base">Speaker Handbook Content & Slide Templates</h3>
              <p className="text-muted-foreground text-xs">
                Edit the markdown handbook visible to speakers at <code>/events/{eventId}/speaker-handbook</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/events/${eventId}/speaker-handbook?token=${config.share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" />
                  View Published Page
                </a>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveHandbook}
                disabled={isSavingHandbook || handbookContent === config.handbook_content}
              >
                {isSavingHandbook ? "Saving..." : "Save Handbook"}
              </Button>
            </div>
          </div>

          <HtmlEditorPreview
            value={handbookContent || ""}
            onChange={setHandbookContent}
            language="markdown"
            editorTitle="Speaker Handbook (Markdown)"
            editorSubTitle="(Drop event data tokens anywhere)"
            customRender={() => handbookHtmlPreview}
            showTokenPanel={true}
            hideAttendeeTokens={true}
            hideSheetTokens={true}
            hideBlocks={true}
            hideSampleDataToggle={true}
          />
        </TabsContent>

        {/* 3. SPEAKER INVITATION EMAIL TEMPLATE */}
        <TabsContent value="invitation_email" className="space-y-4 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-base">Speaker Invitation Email Template</h3>
              <p className="text-muted-foreground text-xs">
                Sent automatically when a speaker is confirmed or manually resent from the roster tab. Includes session
                details, checklist, and handbook links.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetInvitationEmail}
                disabled={isSavingInvitationEmail}
              >
                Reset to Default
              </Button>
              <Button
                size="sm"
                onClick={handleSaveInvitationEmail}
                disabled={isSavingInvitationEmail || invitationEmailHtml === savedInvitationEmailHtml}
              >
                {isSavingInvitationEmail ? "Saving..." : "Save Email Template"}
              </Button>
            </div>
          </div>

          <HtmlEditorPreview
            value={invitationEmailHtml}
            onChange={setInvitationEmailHtml}
            language="html"
            editorTitle="Speaker Invitation HTML"
            editorSubTitle="(Live simulated preview)"
            customRender={() => invitationEmailHtmlPreview}
            showTokenPanel={true}
            hideSheetTokens={true}
            hideSampleDataToggle={true}
          />
        </TabsContent>

        {/* 4. SETTINGS */}
        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Speaker Workflow Configuration</CardTitle>
              <CardDescription>
                Customize speaker submission rules and active presentation slide templates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Speaker Confirmation Form</Label>
                  <p className="text-muted-foreground text-xs">
                    When disabled, the public confirmation form is closed to new submissions.
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => handleSaveConfig({ enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <div className="space-y-0.5">
                  <Label>Presentation Slide Template</Label>
                  <p className="text-muted-foreground text-xs">
                    Choose from standard official presets, existing past events, or add a custom template URL.
                  </p>
                </div>
                <Select
                  value={
                    config.custom_slide_template_url ? "custom_preset" : config.active_slide_preset || "gdg_default"
                  }
                  onValueChange={(val: string) => {
                    if (val === "__add_new_preset__") {
                      setCustomPresetUrlInput(config.custom_slide_template_url || "");
                      setIsAddingCustomPreset(true);
                      return;
                    }
                    if (val === "custom_preset") {
                      // Already on custom preset
                      return;
                    }
                    // Reset custom override when picking a standard preset or existing event
                    handleSaveConfig({
                      active_slide_preset: val,
                      custom_slide_template_url: "",
                    });
                    setIsAddingCustomPreset(false);
                    const matchedEvent = existingEventsWithTemplates.find((e) => e.id === val);
                    if (matchedEvent) {
                      toast.info(`Selected "${matchedEvent.label}". URL: ${matchedEvent.url}`);
                    }
                  }}
                >
                  <SelectTrigger className="!h-auto min-h-[58px] w-full max-w-md gap-3 px-4 py-3 text-left">
                    <SelectValue placeholder="Select template from existing event or preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        Official Presets
                      </SelectLabel>
                      {Object.entries(officialPresets).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col text-left">
                            <span className="font-medium">
                              {preset.label} {preset.is_default ? "(Default)" : ""}
                            </span>
                            <span className="max-w-sm truncate font-mono text-[11px] text-muted-foreground">
                              {preset.url}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>

                    {existingEventsWithTemplates.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                            From Existing Events ({existingEventsWithTemplates.length})
                          </SelectLabel>
                          {existingEventsWithTemplates.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex flex-col text-left">
                                <span className="font-medium">{item.label}</span>
                                <span className="max-w-sm truncate font-mono text-[11px] text-muted-foreground">
                                  {item.url}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}

                    {config.custom_slide_template_url && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                            Custom Template
                          </SelectLabel>
                          <SelectItem value="custom_preset">
                            <div className="flex flex-col text-left">
                              <span className="font-medium">Custom Template URL</span>
                              <span className="max-w-sm truncate font-mono text-[11px] text-muted-foreground">
                                {config.custom_slide_template_url}
                              </span>
                            </div>
                          </SelectItem>
                        </SelectGroup>
                      </>
                    )}

                    <SelectSeparator />
                    <SelectItem
                      value="__add_new_preset__"
                      className="cursor-pointer py-2 font-medium text-primary focus:text-primary"
                    >
                      <div className="flex items-center gap-1.5">
                        <Plus className="size-4 shrink-0 text-primary" />
                        <span>+ Add New Preset / Custom URL</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Inline form when adding or editing a custom preset */}
                {isAddingCustomPreset && (
                  <div className="w-full max-w-md space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center justify-between font-medium text-xs">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Plus className="size-3.5" />
                        Add Custom Slide Template URL
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsAddingCustomPreset(false)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    <Input
                      placeholder="https://docs.google.com/presentation/d/.../copy"
                      value={customPresetUrlInput}
                      onChange={(e) => setCustomPresetUrlInput(e.target.value)}
                      className="h-9 bg-background text-xs"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setIsAddingCustomPreset(false);
                          setCustomPresetUrlInput("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!customPresetUrlInput.trim()}
                        onClick={() => {
                          const trimmed = customPresetUrlInput.trim();
                          if (!trimmed) return;
                          handleSaveConfig({ custom_slide_template_url: trimmed });
                          setIsAddingCustomPreset(false);
                          toast.success("Custom slide template URL saved!");
                        }}
                      >
                        Save Preset
                      </Button>
                    </div>
                  </div>
                )}

                {/* Direct quick link to open/preview currently selected template */}
                {(() => {
                  const selectedOpt =
                    existingEventsWithTemplates.find((e) => e.id === config.active_slide_preset) ||
                    officialPresets[config.active_slide_preset || "gdg_default"] ||
                    officialPresets.gdg_default ||
                    SPEAKER_SLIDE_TEMPLATE_PRESETS.gdg_default;
                  const activeUrl = config.custom_slide_template_url || selectedOpt?.url;
                  if (!activeUrl) return null;
                  return (
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="text-muted-foreground">Active Template Link:</span>
                      <a
                        href={activeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 break-all font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {config.custom_slide_template_url
                            ? "Custom Slide Template"
                            : selectedOpt?.label || "Slide Template"}
                        </span>
                        <span className="font-normal text-muted-foreground">({activeUrl})</span>
                      </a>
                      {config.custom_slide_template_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[11px] text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            handleSaveConfig({ custom_slide_template_url: "" });
                            toast.info("Custom slide template removed.");
                          }}
                        >
                          Clear custom
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label>Maximum Speaker Photo Upload Size (MB)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={25}
                    value={config.max_photo_size_mb ?? 5}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig((prev) => ({
                        ...prev,
                        max_photo_size_mb: val === "" ? 5 : Number(val),
                      }));
                    }}
                    onBlur={() => handleSaveConfig({ max_photo_size_mb: config.max_photo_size_mb ?? 5 })}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-xs">
                    Megabytes (default 5 MB, maximum 25 MB). Applies to direct R2 bucket uploads.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Speaker Swag & Merchandise Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shirt className="size-4 text-primary" />
                Speaker Swag &amp; Merchandise Configuration
              </CardTitle>
              <CardDescription>
                Configure which items appear in the Speaker Swag &amp; Logistics section on the confirmation form. You
                can select from event merchandise or add custom speaker-only swag.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Speaker Swag Section</Label>
                  <p className="text-muted-foreground text-xs">
                    When enabled, speakers are prompted to choose sizes / variants for commemorative merchandise.
                  </p>
                </div>
                <Switch
                  checked={config.show_swag_section ?? true}
                  onCheckedChange={(checked) => handleSaveConfig({ show_swag_section: checked })}
                />
              </div>

              {(config.show_swag_section ?? true) && (
                <div className="space-y-5 border-t pt-2">
                  {/* 1. From Event Merchandise Catalog */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        Event Merchandise Catalog ({event.merchandise?.length || 0})
                      </Label>
                      {event.merchandise && event.merchandise.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => {
                              const allIds = event.merchandise?.map((m) => m.id) || [];
                              handleSaveConfig({ selected_merchandise_ids: allIds });
                            }}
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-muted-foreground"
                            onClick={() => {
                              handleSaveConfig({ selected_merchandise_ids: [] });
                            }}
                          >
                            Clear All
                          </Button>
                        </div>
                      )}
                    </div>

                    {!event.merchandise || event.merchandise.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-xs">
                        No merchandise registered under this event. You can add custom speaker swag below or use default
                        sizing.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {event.merchandise.map((m) => {
                          const isSelected =
                            config.selected_merchandise_ids === undefined ||
                            config.selected_merchandise_ids.includes(m.id);
                          const sizeVar =
                            m.variations?.find((v) => v.name.toLowerCase().includes("size")) || m.variations?.[0];
                          const optionsList = sizeVar?.options?.join(", ") || "S, M, L, XL, 2XL, 3XL";

                          return (
                            <div
                              key={m.id}
                              className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                                isSelected
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border opacity-70 hover:bg-muted/40"
                              }`}
                            >
                              <div className="pt-0.5">
                                <Switch
                                  id={`merch_toggle_${m.id}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const current =
                                      config.selected_merchandise_ids ?? event.merchandise?.map((x) => x.id) ?? [];
                                    const updated = !checked ? current.filter((id) => id !== m.id) : [...current, m.id];
                                    handleSaveConfig({ selected_merchandise_ids: updated });
                                  }}
                                />
                              </div>
                              <Label htmlFor={`merch_toggle_${m.id}`} className="min-w-0 flex-1 cursor-pointer">
                                <div className="truncate font-semibold text-xs">{m.name}</div>
                                <div className="line-clamp-1 text-[11px] text-muted-foreground">
                                  Variants: {optionsList}
                                </div>
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. Custom Swags (Not in Merchandise Catalog) */}
                  <div className="space-y-3 border-t pt-3">
                    <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Custom Speaker Swag (Not in Merchandise Catalog)
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Add exclusive speaker items like jackets, customized hoodies, or unique conference gifts.
                    </p>

                    {/* List of existing custom swags */}
                    {config.custom_swags && config.custom_swags.length > 0 && (
                      <div className="space-y-2">
                        {config.custom_swags.map((cs, idx) => {
                          const isDefault = cs.id === "default_tshirt" || cs.is_default;
                          const isHidden = Boolean(cs.hidden);

                          return (
                            <div
                              key={cs.id || idx}
                              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                                isHidden ? "border-dashed bg-muted/40 opacity-75" : "bg-background"
                              }`}
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-semibold text-xs ${isHidden ? "text-muted-foreground line-through" : ""}`}
                                  >
                                    {cs.label}
                                  </span>
                                  {isDefault && (
                                    <Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
                                      Default Item
                                    </Badge>
                                  )}
                                  {isHidden && (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-500/30 px-1.5 py-0 font-normal text-[10px] text-amber-600 text-muted-foreground dark:text-amber-400"
                                    >
                                      Hidden from form
                                    </Badge>
                                  )}
                                </div>
                                {cs.description && (
                                  <p className="text-[11px] text-muted-foreground">{cs.description}</p>
                                )}
                                <div className="font-mono text-[10px] text-muted-foreground">
                                  Options: {cs.options?.join(", ") || "Standard"}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {/* Edit Button */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Edit Swag Item"
                                  className="size-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setEditingSwagIndex(idx);
                                    setEditSwagLabel(cs.label);
                                    setEditSwagDesc(cs.description || "");
                                    setEditSwagOptions(cs.options?.join(", ") || "");
                                  }}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>

                                {/* Show/Hide Toggle (Eye) */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title={isHidden ? "Show on speaker confirmation" : "Hide from speaker confirmation"}
                                  className={`size-7 ${
                                    isHidden
                                      ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  onClick={() => {
                                    const updated = (config.custom_swags || []).map((item, i) =>
                                      i === idx ? { ...item, hidden: !item.hidden } : item,
                                    );
                                    handleSaveConfig({ custom_swags: updated });
                                    toast.success(
                                      `${cs.label} is now ${!isHidden ? "hidden from" : "visible on"} confirmation form.`,
                                    );
                                  }}
                                >
                                  {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                </Button>

                                {/* Delete Button - Disabled for default T-Shirt */}
                                {!isDefault ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Delete Swag Item"
                                    className="size-7 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      const updated = (config.custom_swags || []).filter((_, i) => i !== idx);
                                      handleSaveConfig({ custom_swags: updated });
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Custom Swag Form */}
                    <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <Plus className="size-3.5 text-primary" />
                        Add New Speaker Swag Item
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Item Name *</span>
                          <Input
                            placeholder="e.g. Speaker Bomber Jacket"
                            value={newCustomSwagLabel}
                            onChange={(e) => setNewCustomSwagLabel(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Description / Notes</span>
                          <Input
                            placeholder="e.g. Unisex Black GDG Windbreaker"
                            value={newCustomSwagDesc}
                            onChange={(e) => setNewCustomSwagDesc(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">Sizes / Variations (Comma separated)</span>
                        <Input
                          placeholder="S, M, L, XL, 2XL, 3XL"
                          value={newCustomSwagOptions}
                          onChange={(e) => setNewCustomSwagOptions(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!newCustomSwagLabel.trim()}
                          onClick={() => {
                            if (!newCustomSwagLabel.trim()) return;
                            const options = newCustomSwagOptions
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean);
                            const newItem = {
                              id: `swag_${Date.now()}`,
                              label: newCustomSwagLabel.trim(),
                              description: newCustomSwagDesc.trim() || undefined,
                              options: options.length ? options : ["S", "M", "L", "XL", "2XL"],
                            };
                            const updated = [...(config.custom_swags || []), newItem];
                            handleSaveConfig({ custom_swags: updated });
                            setNewCustomSwagLabel("");
                            setNewCustomSwagDesc("");
                            setNewCustomSwagOptions("S, M, L, XL, 2XL, 3XL");
                          }}
                        >
                          <Plus className="mr-1 size-3" />
                          Add Swag Item
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Calendar Automation & Multi-Invite Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="size-4 text-primary" />
                Google Calendar Invites & Schedule Details
              </CardTitle>
              <CardDescription>
                Configure automatic Google Calendar invitations sent to confirmed speakers upon submission. Supports
                main event, session time slot, and after-party/dinner invitations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 1. Main Event Invite */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-sm">Main Event Calendar Invite</Label>
                    <p className="text-muted-foreground text-xs">
                      Invites speakers to the entire event schedule (
                      {event.start_date
                        ? new Date(event.start_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Event Date"}
                      ).
                    </p>
                  </div>
                  <Switch
                    checked={config.calendar_invites?.invite_main_event ?? true}
                    onCheckedChange={(checked) =>
                      handleSaveConfig({
                        calendar_invites: {
                          ...config.calendar_invites,
                          invite_main_event: checked,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5 rounded-md border bg-background/60 p-2.5 text-muted-foreground text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-foreground">Location formatting based on event format:</span>
                    {event.audience_type === "VIRTUAL" ? (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-blue-500/25 bg-blue-500/10 px-1.5 font-medium text-[10px] text-blue-600 dark:text-blue-400"
                      >
                        <Laptop className="size-2.5" /> Virtual
                      </Badge>
                    ) : event.audience_type === "HYBRID" ? (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-purple-500/25 bg-purple-500/10 px-1.5 font-medium text-[10px] text-purple-600 dark:text-purple-400"
                      >
                        <Laptop className="size-2.5" /> Hybrid
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-emerald-500/25 bg-emerald-500/10 px-1.5 font-medium text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        <MapPin className="size-2.5" /> In-Person
                      </Badge>
                    )}
                  </div>
                  {event.audience_type === "VIRTUAL" && (
                    <p>• Virtual Event: Shows virtual venue / join link directly in calendar location.</p>
                  )}
                  {event.audience_type === "HYBRID" && (
                    <p>
                      • Hybrid Event: Shows Google Maps venue link in calendar location and adds virtual join URL in
                      description.
                    </p>
                  )}
                  {(!event.audience_type || event.audience_type === "IN_PERSON") && (
                    <p>
                      • In-Person: Shows Google Maps venue link ({event.venue?.name || "Venue"}) in calendar location.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 pt-1">
                  <Label className="font-normal text-xs">Main Event Description Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add custom notes or logistics instructions appended to the calendar invite description..."
                    rows={2}
                    value={config.calendar_invites?.main_event_notes ?? ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        calendar_invites: {
                          ...prev.calendar_invites,
                          main_event_notes: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      handleSaveConfig({
                        calendar_invites: {
                          ...config.calendar_invites,
                          main_event_notes: config.calendar_invites?.main_event_notes,
                        },
                      })
                    }
                    className="text-xs"
                  />
                </div>
              </div>

              {/* 2. Agenda Session Slot Invite */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-sm">Speaker Session Slot Invite (Agenda)</Label>
                    <p className="text-muted-foreground text-xs">
                      Creates a dedicated calendar invitation for the speaker&apos;s specific talk time slot based on
                      their Bevy Agenda binding.
                    </p>
                  </div>
                  <Switch
                    checked={config.calendar_invites?.invite_agenda_session ?? true}
                    onCheckedChange={(checked) =>
                      handleSaveConfig({
                        calendar_invites: {
                          ...config.calendar_invites,
                          invite_agenda_session: checked,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5 pt-1">
                  <Label className="font-normal text-xs">Session Slot Description Notes (Optional)</Label>
                  <Textarea
                    placeholder="e.g. Please arrive 15 minutes prior to your stage slot for microphone and slide check..."
                    rows={2}
                    value={config.calendar_invites?.agenda_session_notes ?? ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        calendar_invites: {
                          ...prev.calendar_invites,
                          agenda_session_notes: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      handleSaveConfig({
                        calendar_invites: {
                          ...config.calendar_invites,
                          agenda_session_notes: config.calendar_invites?.agenda_session_notes,
                        },
                      })
                    }
                    className="text-xs"
                  />
                </div>
              </div>

              {/* 3. Dinner / After Party Invite */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 font-semibold text-sm">
                      <Utensils className="size-3.5 text-amber-500" />
                      Speaker & Organizer Dinner / After Party Invite
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Optionally schedule a post-event dinner or speaker reception with Google Maps pinpoint
                      integration.
                    </p>
                  </div>
                  <Switch
                    checked={config.calendar_invites?.invite_dinner ?? false}
                    onCheckedChange={(checked) =>
                      handleSaveConfig({
                        calendar_invites: {
                          ...config.calendar_invites,
                          invite_dinner: checked,
                        },
                      })
                    }
                  />
                </div>

                {config.calendar_invites?.invite_dinner && (
                  <div className="mt-3 space-y-4 border-t pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dinner / Party Title</Label>
                      <Input
                        placeholder="e.g. GDG Jakarta Speaker & Organizer Appreciation Dinner"
                        value={config.calendar_invites?.dinner_title ?? ""}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            calendar_invites: {
                              ...prev.calendar_invites,
                              dinner_title: e.target.value,
                            },
                          }))
                        }
                        onBlur={() =>
                          handleSaveConfig({
                            calendar_invites: {
                              ...config.calendar_invites,
                              dinner_title: config.calendar_invites?.dinner_title ?? "",
                            },
                          })
                        }
                        className="text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <Clock className="size-3 text-muted-foreground" />
                          Dinner Start Time
                        </Label>
                        <DatePicker
                          withTime
                          value={config.calendar_invites?.dinner_start_time ?? ""}
                          onChange={(val) => {
                            const updated = {
                              ...config.calendar_invites,
                              dinner_start_time: val,
                            };
                            setConfig((prev) => ({ ...prev, calendar_invites: updated }));
                            handleSaveConfig({ calendar_invites: updated });
                          }}
                          placeholder="Pick dinner start time"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <Clock className="size-3 text-muted-foreground" />
                          Dinner End Time
                        </Label>
                        <DatePicker
                          withTime
                          value={config.calendar_invites?.dinner_end_time ?? ""}
                          onChange={(val) => {
                            const updated = {
                              ...config.calendar_invites,
                              dinner_end_time: val,
                            };
                            setConfig((prev) => ({ ...prev, calendar_invites: updated }));
                            handleSaveConfig({ calendar_invites: updated });
                          }}
                          placeholder="Pick dinner end time"
                        />
                      </div>
                    </div>

                    {/* Venue & Google Maps Pinpoint */}
                    <div className="space-y-2 rounded-md border bg-background p-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 font-semibold text-xs">
                          <MapPin className="size-3.5 text-primary" />
                          Dinner Venue & Location
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsDinnerMapOpen(true)}
                          className="h-7 gap-1 px-2.5 text-primary text-xs"
                        >
                          <MapPin className="size-3" />
                          Pick on Google Maps
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Venue Name</span>
                          <Input
                            placeholder="e.g. Plataran Menteng"
                            value={config.calendar_invites?.dinner_venue_name ?? ""}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                calendar_invites: {
                                  ...prev.calendar_invites,
                                  dinner_venue_name: e.target.value,
                                },
                              }))
                            }
                            onBlur={() =>
                              handleSaveConfig({
                                calendar_invites: {
                                  ...config.calendar_invites,
                                  dinner_venue_name: config.calendar_invites?.dinner_venue_name ?? "",
                                },
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Google Maps URL</span>
                          <Input
                            placeholder="https://maps.google.com/..."
                            value={config.calendar_invites?.dinner_maps_url ?? ""}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                calendar_invites: {
                                  ...prev.calendar_invites,
                                  dinner_maps_url: e.target.value,
                                },
                              }))
                            }
                            onBlur={() =>
                              handleSaveConfig({
                                calendar_invites: {
                                  ...config.calendar_invites,
                                  dinner_maps_url: config.calendar_invites?.dinner_maps_url ?? "",
                                },
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">Address</span>
                        <Input
                          placeholder="e.g. Jl. H.O.S. Cokroaminoto No.42, Menteng, Jakarta Pusat"
                          value={config.calendar_invites?.dinner_venue_address ?? ""}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              calendar_invites: {
                                ...prev.calendar_invites,
                                dinner_venue_address: e.target.value,
                              },
                            }))
                          }
                          onBlur={() =>
                            handleSaveConfig({
                              calendar_invites: {
                                ...config.calendar_invites,
                                dinner_venue_address: config.calendar_invites?.dinner_venue_address ?? "",
                              },
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Dinner Notes / Dress Code / Logistics</Label>
                      <Textarea
                        placeholder="e.g. Dress code: Smart Casual. Please let us know if you require dietary accommodations."
                        rows={2}
                        value={config.calendar_invites?.dinner_notes ?? ""}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            calendar_invites: {
                              ...prev.calendar_invites,
                              dinner_notes: e.target.value,
                            },
                          }))
                        }
                        onBlur={() =>
                          handleSaveConfig({
                            calendar_invites: {
                              ...config.calendar_invites,
                              dinner_notes: config.calendar_invites?.dinner_notes ?? "",
                            },
                          })
                        }
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dinner Location Google Maps Pinpoint Dialog */}
      <GoogleMapsPinpointDialog
        isOpen={isDinnerMapOpen}
        onOpenChange={setIsDinnerMapOpen}
        title="Pick Dinner / After Party Location"
        description="Search for the restaurant or pinpoint coordinates on the map."
        initialLat={config.calendar_invites?.dinner_latitude ?? event.venue?.latitude ?? -6.1932775}
        initialLng={config.calendar_invites?.dinner_longitude ?? event.venue?.longitude ?? 106.8396981}
        onSelectLocation={(data) => {
          const updated = {
            ...config.calendar_invites,
            dinner_venue_name: data.venueName || config.calendar_invites?.dinner_venue_name || "",
            dinner_venue_address: data.suggestedAddress || config.calendar_invites?.dinner_venue_address || "",
            dinner_maps_url: data.mapsUrl || "",
            dinner_latitude: data.latitude,
            dinner_longitude: data.longitude,
          };
          setConfig((prev) => ({
            ...prev,
            calendar_invites: updated,
          }));
          handleSaveConfig({ calendar_invites: updated });
          setIsDinnerMapOpen(false);
          toast.success("Dinner location updated from Google Maps!");
        }}
      />

      {/* Add Speaker Dialog */}
      <Dialog open={isAddSpeakerOpen} onOpenChange={setIsAddSpeakerOpen}>
        <DialogContent className="max-h-[90vh] w-full gap-4 overflow-y-auto p-5 sm:max-w-xl sm:p-6 md:max-w-2xl">
          <DialogHeader className="space-y-1 pb-1">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserPlus className="size-5 text-primary" />
              Add Confirmed Speaker
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Find an existing speaker from Bevy's directory or enter details manually.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switcher */}
          <div className="flex gap-2 border-b pb-3 text-xs">
            <Button
              type="button"
              variant={addMode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setAddMode("search")}
              className="h-8 gap-1.5"
            >
              <Search className="size-3.5" />
              Search Bevy Directory
            </Button>
            <Button
              type="button"
              variant={addMode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setAddMode("manual")}
              className="h-8 gap-1.5"
            >
              <Mic className="size-3.5" />
              Speaker Details {selectedBevyPerson ? "(Verified)" : "(Manual)"}
            </Button>
          </div>

          {addMode === "search" ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Search Bevy Speaker Index</Label>
                <div className="relative">
                  <Input
                    placeholder="Search by speaker name, company, or title..."
                    value={algoliaSearchQuery}
                    onChange={(e) => handleSearchAlgoliaSpeakers(e.target.value)}
                    className="h-9 pr-8 text-xs"
                  />
                  {isSearchingAlgolia && (
                    <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Queries Bevy's global Google events speaker directory. Select a profile to autofill and verify speaker
                  credentials.
                </p>
              </div>

              {selectedBevyPerson && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    {selectedBevyPerson.picture_url ? (
                      <img
                        src={selectedBevyPerson.picture_url}
                        alt={selectedBevyPerson.first_name}
                        className="size-9 rounded-full border object-cover"
                      />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">
                        {selectedBevyPerson.first_name?.[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        {selectedBevyPerson.first_name} {selectedBevyPerson.last_name}
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/20 text-[10px] text-emerald-800 dark:text-emerald-300"
                        >
                          ID: #{selectedBevyPerson.id}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedBevyPerson.title} {selectedBevyPerson.company ? `• ${selectedBevyPerson.company}` : ""}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive text-xs hover:text-destructive"
                    onClick={() => {
                      setSelectedBevyPerson(null);
                      setManualProfileUrl("");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <div className="font-medium text-muted-foreground text-xs">
                  {isSearchingAlgolia
                    ? "Searching Bevy directory..."
                    : algoliaResults.length > 0
                      ? `Results (${algoliaResults.length})`
                      : algoliaSearchQuery.length >= 2
                        ? "No speakers found"
                        : "Type at least 2 characters to search"}
                </div>
                <div className="max-h-72 min-h-[140px] space-y-1.5 overflow-y-auto rounded-lg border bg-muted/10 p-2">
                  {isSearchingAlgolia ? (
                    <div className="space-y-2 p-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={`shimmer-${i}`}
                          className="flex animate-pulse items-center justify-between rounded bg-muted/20 p-2 text-xs"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Skeleton className="size-8 shrink-0 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-1.5 pr-4">
                              <Skeleton className="h-3.5 w-36 rounded" />
                              <Skeleton className="h-2.5 w-56 rounded" />
                            </div>
                          </div>
                          <Skeleton className="h-7 w-16 shrink-0 rounded-md" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {algoliaResults.length === 0 && (
                        <div className="flex h-32 flex-col items-center justify-center text-center text-muted-foreground text-xs">
                          {algoliaSearchQuery.length >= 2 ? (
                            <span>No speaker profiles match &ldquo;{algoliaSearchQuery}&rdquo;</span>
                          ) : (
                            <span>Type a speaker's name above to query the directory</span>
                          )}
                        </div>
                      )}
                      {algoliaResults.map((person) => {
                        const pName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
                        const isAlreadyRoster = confirmations.some((c) => c.bevy_person_id === person.id);

                        return (
                          <div
                            key={person.id}
                            className="flex items-center justify-between rounded p-2 text-xs transition-colors hover:bg-muted/70"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              {person.picture_url ? (
                                <img
                                  src={person.picture_url}
                                  alt={pName}
                                  className="size-8 shrink-0 rounded-full border object-cover"
                                />
                              ) : (
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-[10px]">
                                  {person.first_name?.[0] || "S"}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                                  {pName}
                                  <span className="text-[10px] text-muted-foreground">#{person.id}</span>
                                </div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {person.title || "Speaker"} {person.company ? `• ${person.company}` : ""}
                                </div>
                              </div>
                            </div>

                            {isAlreadyRoster ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600"
                              >
                                Already in Roster
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 gap-1 text-xs"
                                onClick={() => handleSelectPersonForAdd(person)}
                              >
                                <CheckCircle2 className="size-3" />
                                Select
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddMode("manual")}
                  className="text-xs"
                >
                  Skip to Manual Entry &rarr;
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSpeakerSubmit} className="space-y-4 py-2">
              {selectedBevyPerson && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-800 text-xs dark:text-emerald-300">
                  <UserCheck className="size-4 shrink-0" />
                  <span>
                    Linked to Bevy Speaker Profile <strong>#{selectedBevyPerson.id}</strong> (
                    {selectedBevyPerson.first_name} {selectedBevyPerson.last_name})
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="manual_full_name">Full Name *</Label>
                  <Input
                    id="manual_full_name"
                    value={manualFullName}
                    onChange={(e) => setManualFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual_email">Speaker Email *</Label>
                  <Input
                    id="manual_email"
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="speaker@company.com"
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual_job_title">Job Title / Role *</Label>
                  <Input
                    id="manual_job_title"
                    value={manualJobTitle}
                    onChange={(e) => setManualJobTitle(e.target.value)}
                    placeholder="e.g. Senior Cloud Architect"
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual_company">Company / Institution *</Label>
                  <Input
                    id="manual_company"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    placeholder="e.g. Google / Tech Startup"
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="manual_profile_url">Photo / Avatar URL</Label>
                  <Input
                    id="manual_profile_url"
                    value={manualProfileUrl}
                    onChange={(e) => setManualProfileUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/... or public image URL"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="manual_talk_title">Talk Session Title *</Label>
                  <Input
                    id="manual_talk_title"
                    value={manualTalkTitle}
                    onChange={(e) => setManualTalkTitle(e.target.value)}
                    placeholder="e.g. Scaling Real-Time Applications with Vertex AI"
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual_presenter_role">Role / Variant</Label>
                  <Select
                    value={manualPresenterRole}
                    onValueChange={(val) => setManualPresenterRole(val as SpeakerRoleKey)}
                  >
                    <SelectTrigger id="manual_presenter_role" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEAKER_ROLES_CONFIG.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.title} {role.key === "speakers" ? "(Standard)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual_talk_type">Talk Format</Label>
                  <Select value={manualTalkType} onValueChange={setManualTalkType}>
                    <SelectTrigger id="manual_talk_type" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Keynote">Keynote Session</SelectItem>
                      <SelectItem value="Technical Talk (45 mins)">Technical Talk (45m)</SelectItem>
                      <SelectItem value="Technical Talk (30 mins)">Technical Talk (30m)</SelectItem>
                      <SelectItem value="Lightning Talk (15 mins)">Lightning Talk (15m)</SelectItem>
                      <SelectItem value="Workshop / Hands-on Lab">Workshop / Codelab</SelectItem>
                      <SelectItem value="Panel Discussion">Panel Discussion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual_session_slot">Stage / Slot</Label>
                  {agendaSlots.length > 0 ? (
                    <Select
                      value={manualSessionSlot || agendaSlots[0]?.value || ""}
                      onValueChange={(val) => setManualSessionSlot(val)}
                    >
                      <SelectTrigger id="manual_session_slot" className="h-8 text-xs">
                        <SelectValue placeholder="Select Bevy agenda slot" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {agendaSlots.map((slot) => (
                          <SelectItem key={slot.id} value={slot.value} className="text-xs">
                            <span className="inline-block max-w-[260px] truncate">{slot.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-1.5">
                      <Select disabled value="empty">
                        <SelectTrigger
                          id="manual_session_slot"
                          className="h-9 bg-muted/20 text-muted-foreground text-xs opacity-80"
                        >
                          <SelectValue placeholder="Agenda still empty, add new agenda to bind with speaker" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="empty">Agenda still empty, add new agenda to bind with speaker</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex flex-col justify-between gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-800 text-xs sm:flex-row sm:items-center dark:text-amber-300">
                        <span className="font-normal text-[11px] leading-relaxed">
                          No agenda items in event schedule.
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-6 shrink-0 gap-1 self-start border bg-background px-2.5 font-medium text-[11px] shadow-xs hover:bg-background/80 sm:self-auto"
                          onClick={() => {
                            setIsAddSpeakerOpen(false);
                            window.dispatchEvent(new CustomEvent("gdg:switch-tab", { detail: "agenda" }));
                            const trigger = document.getElementById("tab-trigger-agenda");
                            if (trigger) trigger.click();
                          }}
                        >
                          <Calendar className="size-3 text-amber-600 dark:text-amber-400" />
                          <span>Go to Agenda &rarr;</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="manual_bio">Short Bio / Overview</Label>
                  <Textarea
                    id="manual_bio"
                    value={manualBiography}
                    onChange={(e) => setManualBiography(e.target.value)}
                    placeholder="Brief background or talk session summary..."
                    className="min-h-[60px] text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="manual_send_email" className="cursor-pointer font-medium text-xs">
                    Send Invitation & Handbook Email
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically dispatches speaker confirmation pass and handbook link to their email.
                  </p>
                </div>
                <Switch id="manual_send_email" checked={manualSendEmail} onCheckedChange={setManualSendEmail} />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddMode("search")}
                  className="text-xs"
                >
                  &larr; Back to Search
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingSpeaker} className="gap-1.5 text-xs">
                  {isSubmittingSpeaker ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  Confirm &amp; Add Speaker
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Custom Swag Dialog */}
      <Dialog
        open={editingSwagIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSwagIndex(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-semibold text-base">Edit Speaker Swag Item</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Modify the item label, description, and available size variations for the speaker confirmation form.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="edit_swag_label" className="text-xs">
                Item Name *
              </Label>
              <Input
                id="edit_swag_label"
                value={editSwagLabel}
                onChange={(e) => setEditSwagLabel(e.target.value)}
                placeholder="e.g. T-Shirt Size (Unisex Standard)"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_swag_desc" className="text-xs">
                Description / Notes
              </Label>
              <Input
                id="edit_swag_desc"
                value={editSwagDesc}
                onChange={(e) => setEditSwagDesc(e.target.value)}
                placeholder="e.g. Official GDG community conference commemorative t-shirt"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_swag_options" className="text-xs">
                Sizes / Variations (Comma separated)
              </Label>
              <Input
                id="edit_swag_options"
                value={editSwagOptions}
                onChange={(e) => setEditSwagOptions(e.target.value)}
                placeholder="S, M, L, XL, 2XL, 3XL, 4XL"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Options displayed in the dropdown menu on the speaker confirmation form.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingSwagIndex(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editSwagLabel.trim()}
              className="text-xs"
              onClick={() => {
                if (editingSwagIndex === null || !editSwagLabel.trim()) return;
                const options = editSwagOptions
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean);
                const updated = (config.custom_swags || []).map((item, i) =>
                  i === editingSwagIndex
                    ? {
                        ...item,
                        label: editSwagLabel.trim(),
                        description: editSwagDesc.trim() || undefined,
                        options: options.length ? options : ["S", "M", "L", "XL", "2XL"],
                      }
                    : item,
                );
                handleSaveConfig({ custom_swags: updated });
                setEditingSwagIndex(null);
                toast.success("Speaker swag item updated!");
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Submitted Speaker Confirmation Details Dialog */}
      <Dialog
        open={viewingConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingConfirmation(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
          {viewingConfirmation && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-12 shrink-0 border bg-muted">
                    {viewingConfirmation.speaker_profile_url && (
                      <AvatarImage
                        src={viewingConfirmation.speaker_profile_url}
                        alt={viewingConfirmation.full_name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="font-semibold text-sm">
                      {viewingConfirmation.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "SP"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="flex items-center gap-2 font-semibold text-base">
                      {viewingConfirmation.full_name}
                      {viewingConfirmation.display_name &&
                        viewingConfirmation.display_name !== viewingConfirmation.full_name && (
                          <span className="font-normal text-muted-foreground text-xs">
                            ({viewingConfirmation.display_name})
                          </span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                      {viewingConfirmation.job_title}{" "}
                      {viewingConfirmation.company_institution ? `at ${viewingConfirmation.company_institution}` : ""}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* 1. Profile & Contact */}
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    1. Profile &amp; Contact Information
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Email</span>
                      <span className="font-medium">{viewingConfirmation.speaker_email}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">WhatsApp / Phone</span>
                      {viewingConfirmation.whatsapp_number ? (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <a
                            href={`https://wa.me/${viewingConfirmation.whatsapp_number.replace(/\D/g, "").replace(/^0/, "62")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                            title="Chat on WhatsApp"
                          >
                            <WhatsAppIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{viewingConfirmation.whatsapp_number}</span>
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(viewingConfirmation.whatsapp_number || "");
                              toast.success("Phone number copied to clipboard!");
                            }}
                            title="Copy phone number"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium">-</span>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Preferred Contact Channels</span>
                      <span className="font-medium">
                        {viewingConfirmation.contact_channels?.length
                          ? viewingConfirmation.contact_channels.join(", ")
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Presenter Role</span>
                      <Badge
                        variant="secondary"
                        className="mt-1 inline-flex items-center gap-1 border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-medium text-[11px] text-blue-700 capitalize dark:text-blue-300"
                      >
                        <Mic className="size-3 text-blue-600 dark:text-blue-400" />
                        <span>
                          {viewingConfirmation.presenter_role === "speakers"
                            ? "Speaker"
                            : viewingConfirmation.presenter_role?.replace(/s$/, "") || "Speaker"}
                        </span>
                      </Badge>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Google Ecosystem Background</span>
                      <span className="font-medium">
                        {viewingConfirmation.is_from_google_ecosystem || "None above"}
                        {viewingConfirmation.ecosystem_details ? ` (${viewingConfirmation.ecosystem_details})` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Primary Technology</span>
                      <span className="font-medium">{viewingConfirmation.google_ecosystem_or_technology || "-"}</span>
                    </div>
                  </div>

                  {/* Social & Public Profiles */}
                  <div className="space-y-1.5 border-t pt-2">
                    <span className="block font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                      Social &amp; Public Profiles
                    </span>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {/* LinkedIn */}
                      <div className="space-y-0.5">
                        <span className="block text-[10px] text-muted-foreground">LinkedIn</span>
                        {(() => {
                          const li = formatLinkedInUrl(
                            viewingConfirmation.linkedin_url || viewingConfirmation.linkedin_or_social_url,
                          );
                          if (!li) return <span className="font-medium text-muted-foreground text-xs">-</span>;
                          return (
                            <a
                              href={li.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted/60"
                            >
                              <LinkedInIcon className="size-3.5 shrink-0 text-[#0A66C2]" />
                              <span className="truncate">{li.display}</span>
                              <ExternalLink className="ml-0.5 size-3 shrink-0 text-muted-foreground opacity-70" />
                            </a>
                          );
                        })()}
                      </div>

                      {/* X / Twitter */}
                      <div className="space-y-0.5">
                        <span className="block text-[10px] text-muted-foreground">X / Twitter</span>
                        {(() => {
                          const tw = formatTwitterHandle(viewingConfirmation.twitter_url);
                          if (!tw) return <span className="font-medium text-muted-foreground text-xs">-</span>;
                          return (
                            <a
                              href={tw.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted/60"
                            >
                              <XTwitterIcon className="size-3 shrink-0 text-foreground" />
                              <span className="truncate">{tw.display}</span>
                              <ExternalLink className="ml-0.5 size-3 shrink-0 text-muted-foreground opacity-70" />
                            </a>
                          );
                        })()}
                      </div>

                      {/* Instagram */}
                      <div className="space-y-0.5">
                        <span className="block text-[10px] text-muted-foreground">Instagram</span>
                        {(() => {
                          const ig = formatInstagramHandle(viewingConfirmation.instagram_username);
                          if (!ig) return <span className="font-medium text-muted-foreground text-xs">-</span>;
                          return (
                            <a
                              href={ig.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted/60"
                            >
                              <InstagramIcon className="size-3.5 shrink-0 text-pink-600 dark:text-pink-400" />
                              <span className="truncate">{ig.display}</span>
                              <ExternalLink className="ml-0.5 size-3 shrink-0 text-muted-foreground opacity-70" />
                            </a>
                          );
                        })()}
                      </div>

                      {/* Company X / Twitter */}
                      <div className="space-y-0.5">
                        <span className="block text-[10px] text-muted-foreground">Company X / Twitter</span>
                        {(() => {
                          const ctw = formatTwitterHandle(viewingConfirmation.company_twitter_username);
                          if (!ctw) return <span className="font-medium text-muted-foreground text-xs">-</span>;
                          return (
                            <a
                              href={ctw.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted/60"
                            >
                              <XTwitterIcon className="size-3 shrink-0 text-foreground" />
                              <span className="truncate">{ctw.display}</span>
                              <ExternalLink className="ml-0.5 size-3 shrink-0 text-muted-foreground opacity-70" />
                            </a>
                          );
                        })()}
                      </div>

                      {/* Portfolio / Website */}
                      {viewingConfirmation.portfolio_url &&
                        (() => {
                          const port = formatPortfolioUrl(viewingConfirmation.portfolio_url);
                          if (!port) return null;
                          return (
                            <div className="space-y-0.5 sm:col-span-2">
                              <span className="block text-[10px] text-muted-foreground">Portfolio / Website</span>
                              <a
                                href={port.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted/60"
                              >
                                <Globe className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span className="truncate">{port.display}</span>
                                <ExternalLink className="ml-0.5 size-3 shrink-0 text-muted-foreground opacity-70" />
                              </a>
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                </div>

                {/* 2. Talk & Session Details */}
                <div className="space-y-2.5 rounded-lg border p-3">
                  <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    2. Session &amp; Talk Details
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <span className="block text-[10px] text-muted-foreground">Talk Title</span>
                      <span className="font-semibold text-sm">{viewingConfirmation.talk_title}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Talk Format</span>
                      <Badge variant="outline" className="mt-0.5 text-[10px]">
                        {viewingConfirmation.talk_type}
                      </Badge>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Session Slot</span>
                      {viewingConfirmation.session_slot ? (
                        <span className="font-medium">{viewingConfirmation.session_slot}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Unassigned (Not bound to agenda)</span>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Presentation Slides</span>
                      {viewingConfirmation.presentation_slides_url ? (
                        <a
                          href={viewingConfirmation.presentation_slides_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          Open Slides <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Share Slides with Attendees?</span>
                      <span className="font-medium">{viewingConfirmation.can_share_slides || "Yes"}</span>
                    </div>
                  </div>
                  {viewingConfirmation.talk_description && (
                    <div className="border-t pt-2">
                      <span className="block text-[10px] text-muted-foreground">Talk Description (Caption)</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                        {viewingConfirmation.talk_description}
                      </p>
                    </div>
                  )}
                  {viewingConfirmation.biography && (
                    <div className="border-t pt-2">
                      <span className="block text-[10px] text-muted-foreground">Speaker Biography</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-foreground">{viewingConfirmation.biography}</p>
                    </div>
                  )}
                </div>

                {/* 3. Swag & Logistics */}
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    3. Swag &amp; Event Logistics
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-[10px] text-muted-foreground">Swag / Merchandise Size</span>
                      {(() => {
                        const entries =
                          viewingConfirmation.swag_selections &&
                          Object.keys(viewingConfirmation.swag_selections).length > 0
                            ? Object.entries(viewingConfirmation.swag_selections)
                            : viewingConfirmation.tshirt_size
                              ? [["default_tshirt", viewingConfirmation.tshirt_size]]
                              : [];

                        if (entries.length === 0) {
                          return <span className="font-medium text-muted-foreground text-xs">-</span>;
                        }

                        return (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {entries.map(([key, val]) => (
                              <div
                                key={key}
                                className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                              >
                                <Shirt className="size-3.5 shrink-0 text-primary" />
                                <span className="font-medium">{resolveSwagItemName(key)}:</span>
                                <Badge
                                  variant="secondary"
                                  className="h-4.5 border-primary/20 bg-primary/10 px-1.5 font-bold text-[10px] text-primary"
                                >
                                  {val}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] text-muted-foreground">Dietary Restrictions</span>
                      {(() => {
                        const items = viewingConfirmation.dietary_restrictions_list?.length
                          ? viewingConfirmation.dietary_restrictions_list
                          : viewingConfirmation.dietary_restrictions
                            ? [viewingConfirmation.dietary_restrictions]
                            : [];

                        if (items.length === 0 || (items.length === 1 && items[0].toLowerCase() === "none")) {
                          return <span className="font-medium text-muted-foreground text-xs">None</span>;
                        }

                        return (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {items.map((diet, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="inline-flex items-center gap-1 bg-background px-2 py-0.5 font-medium text-xs"
                              >
                                <Utensils className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>{diet}</span>
                              </Badge>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {viewingConfirmation.additional_inquiry && (
                    <div className="border-t pt-2">
                      <span className="block text-[10px] text-muted-foreground">Additional Inquiry / Notes</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                        {viewingConfirmation.additional_inquiry}
                      </p>
                    </div>
                  )}
                </div>

                {/* Metadata Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-muted-foreground">
                  <span>Submitted: {new Date(viewingConfirmation.created_at).toLocaleString()}</span>
                  {viewingConfirmation.updated_at !== viewingConfirmation.created_at && (
                    <span>Last Updated: {new Date(viewingConfirmation.updated_at).toLocaleString()}</span>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingConfirmation(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
