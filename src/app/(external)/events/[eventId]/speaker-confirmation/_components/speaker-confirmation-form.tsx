"use client";

import { useMemo, useState, useTransition } from "react";

import Image from "next/image";
import Link from "next/link";

import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Mic,
  Pencil,
  Presentation,
  Search,
  Send,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BevyPersonSearchResult } from "@/lib/bevy/client";
import { SPEAKER_ROLES_CONFIG, type SpeakerRoleKey } from "@/lib/bevy/speakers";
import type {
  EventSpeakerConfirmation,
  FirestoreEvent,
  SpeakerEcosystemType,
  SpeakerTalkType,
} from "@/lib/firestore/types";
import { GDE_EXPERTISE_MAPPING, SPEAKER_SLIDE_TEMPLATE_PRESETS } from "@/lib/firestore/types";
import { searchBevyPersonsAction } from "@/server/bevy-actions";
import {
  generateSpeakerTalkWithAiAction,
  lookupSpeakerConfirmationByEmailAction,
  submitSpeakerConfirmationAction,
} from "@/server/speaker-confirmation-actions";

interface SpeakerConfirmationFormProps {
  event: FirestoreEvent;
  token: string;
}

const GOOGLE_ECOSYSTEM_CHOICES = ["GDG", "GDE", "WTM", "Googler", "None above"] as const;
type GoogleEcosystemChoice = (typeof GOOGLE_ECOSYSTEM_CHOICES)[number];

const TALK_TYPES: { id: SpeakerTalkType; label: string; desc: string }[] = [
  { id: "Keynote", label: "Keynote Session", desc: "Main stage opening or signature address (30-45m)" },
  { id: "Lightning Talk (15 mins)", label: "Lightning Talk", desc: "Fast-paced focused talk (15 mins)" },
  { id: "Technical Talk (30 mins)", label: "Technical Talk (30m)", desc: "Standard deep-dive presentation" },
  { id: "Technical Talk (45 mins)", label: "Technical Talk (45m)", desc: "Comprehensive technical talk with Q&A" },
  { id: "Workshop / Hands-on Lab", label: "Hands-on Workshop", desc: "Interactive codelab or developer workshop" },
  { id: "Panel Discussion", label: "Panel Discussion", desc: "Moderated panelist discussion" },
];

const ECOSYSTEMS: SpeakerEcosystemType[] = [
  "Google Cloud Platform (GCP)",
  "Machine Learning / Gemini / Vertex AI",
  "Android & Kotlin",
  "Flutter & Dart",
  "Web & Chrome (Angular, Firebase)",
  "Open Source & DevOps",
  "Career & Community Leadership",
];

const TSHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "Gluten-free", "None"] as const;
const CONTACT_CHANNELS = ["Whatsapp", "Telegram", "Email only"] as const;

export interface ResolvedSpeakerSwagItem {
  id: string; // e.g. "merch_123" or "custom_0"
  label: string;
  description?: string;
  options: string[];
}

export function SpeakerConfirmationForm({ event, token }: SpeakerConfirmationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [wasUpdate, setWasUpdate] = useState(false);
  const [editingConfirmationId, setEditingConfirmationId] = useState<string | undefined>(undefined);
  const [lookupEmailInput, setLookupEmailInput] = useState("");
  const [isLookingUpEmail, setIsLookingUpEmail] = useState(false);

  // Form states matching original Google Form
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [speakerEmail, setSpeakerEmail] = useState("");
  const [contactChannels, setContactChannels] = useState<string[]>(["Whatsapp"]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyInstitution, setCompanyInstitution] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [companyTwitterUsername, setCompanyTwitterUsername] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [speakerProfileUrl, setSpeakerProfileUrl] = useState("");
  const [googleEcosystem, setGoogleEcosystem] = useState<SpeakerEcosystemType>("Google Cloud Platform (GCP)");
  const [isFromGoogleEcosystem, setIsFromGoogleEcosystem] = useState<GoogleEcosystemChoice>("None above");
  const [ecosystemDetails, setEcosystemDetails] = useState("");
  const [gdePillar, setGdePillar] = useState<string>("");
  const [gdeTechArea, setGdeTechArea] = useState<string>("");
  const [gdeSubcategory, setGdeSubcategory] = useState<string>("");
  const [gdeIsOther, setGdeIsOther] = useState(false);
  const [gdeOtherInput, setGdeOtherInput] = useState("");
  const [presenterRole, setPresenterRole] = useState<SpeakerRoleKey>("speakers");
  const [talkType, setTalkType] = useState<SpeakerTalkType>("Technical Talk (45 mins)");
  const [talkTitle, setTalkTitle] = useState("");
  const [talkDescription, setTalkDescription] = useState("");
  const [biography, setBiography] = useState("");
  const [canShareSlides, setCanShareSlides] = useState<"Yes" | "No">("Yes");
  const [sessionSlot, setSessionSlot] = useState("");
  const [presentationSlidesUrl, setPresentationSlidesUrl] = useState("");
  const [tshirtSize, setTshirtSize] = useState("L");
  const [swagSelections, setSwagSelections] = useState<Record<string, string>>({});
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(["Halal"]);
  const [dietaryOther, setDietaryOther] = useState("");
  const [additionalInquiry, setAdditionalInquiry] = useState("");

  // Bevy person profile search / autofill state
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [isSearchingProfile, setIsSearchingProfile] = useState(false);
  const [profileSearchResults, setProfileSearchResults] = useState<BevyPersonSearchResult[]>([]);
  const [selectedBevyProfile, setSelectedBevyProfile] = useState<BevyPersonSearchResult | null>(null);

  const handleSearchProfile = async (query: string) => {
    setProfileSearchQuery(query);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setProfileSearchResults([]);
      return;
    }
    setIsSearchingProfile(true);
    try {
      const res = await searchBevyPersonsAction(trimmed, 6);
      if (res.success && res.hits) {
        setProfileSearchResults(res.hits);
      } else {
        setProfileSearchResults([]);
      }
    } catch {
      setProfileSearchResults([]);
    } finally {
      setIsSearchingProfile(false);
    }
  };

  const handleSelectBevyProfile = (person: BevyPersonSearchResult) => {
    setSelectedBevyProfile(person);
    const fullNameVal = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    if (fullNameVal) {
      setFullName(fullNameVal);
      setDisplayName(fullNameVal);
    }
    if (person.title) {
      setJobTitle(person.title);
    }
    if (person.company) {
      setCompanyInstitution(person.company);
    }
    if (person.picture_url) {
      setSpeakerProfileUrl(person.picture_url);
    }
    setProfileSearchResults([]);
    setProfileSearchQuery("");
    toast.success(`Autofilled profile from ${fullNameVal}`);
  };

  const applyExistingConfirmationToForm = (conf: EventSpeakerConfirmation) => {
    setEditingConfirmationId(conf.id);
    setDisplayName(conf.display_name || conf.full_name || "");
    setFullName(conf.full_name || "");
    setSpeakerEmail(conf.speaker_email || "");
    setContactChannels(conf.contact_channels?.length ? conf.contact_channels : ["Whatsapp"]);
    setWhatsappNumber(conf.whatsapp_number || "");
    setJobTitle(conf.job_title || "");
    setCompanyInstitution(conf.company_institution || "");
    setLinkedinUrl(conf.linkedin_url || conf.linkedin_or_social_url || "");
    setTwitterUrl(conf.twitter_url || "");
    setInstagramUsername(conf.instagram_username || "");
    setCompanyTwitterUsername(conf.company_twitter_username || "");
    setPortfolioUrl(conf.portfolio_url || "");
    setSpeakerProfileUrl(conf.speaker_profile_url || "");
    if (conf.google_ecosystem_or_technology) {
      setGoogleEcosystem(conf.google_ecosystem_or_technology as SpeakerEcosystemType);
    }
    if (conf.is_from_google_ecosystem) {
      setIsFromGoogleEcosystem(conf.is_from_google_ecosystem as GoogleEcosystemChoice);
      setEcosystemDetails(conf.ecosystem_details || "");
      if (conf.is_from_google_ecosystem === "GDE" && conf.ecosystem_details) {
        setGdeIsOther(true);
        setGdeOtherInput(conf.ecosystem_details);
      }
    }
    if (conf.presenter_role) {
      setPresenterRole(conf.presenter_role as SpeakerRoleKey);
    }
    if (conf.talk_type) {
      setTalkType(conf.talk_type);
    }
    setTalkTitle(conf.talk_title || "");
    setTalkDescription(conf.talk_description || "");
    setBiography(conf.biography || "");
    setCanShareSlides(conf.can_share_slides || "Yes");
    setSessionSlot(conf.session_slot || "");
    setPresentationSlidesUrl(conf.presentation_slides_url || "");
    setTshirtSize(conf.tshirt_size || "L");
    setSwagSelections(conf.swag_selections || {});
    if (conf.dietary_restrictions_list?.length) {
      const stdOpts = new Set<string>(DIETARY_OPTIONS);
      const selectedStd = conf.dietary_restrictions_list.filter((d) => stdOpts.has(d));
      const others = conf.dietary_restrictions_list.filter((d) => !stdOpts.has(d));
      setDietaryRestrictions(selectedStd);
      setDietaryOther(others.join(", "));
    }
    setAdditionalInquiry(conf.additional_inquiry || "");
    setErrors({});
  };

  const handleLookupExistingResponse = async () => {
    const emailToSearch = (lookupEmailInput || speakerEmail).trim();
    if (!emailToSearch) {
      toast.error("Please enter the email address you used to submit your confirmation.");
      return;
    }
    setIsLookingUpEmail(true);
    try {
      const res = await lookupSpeakerConfirmationByEmailAction({
        event_id: event.id,
        token,
        speaker_email: emailToSearch,
        confirmation_id: editingConfirmationId,
      });
      if (res.success && res.confirmation) {
        applyExistingConfirmationToForm(res.confirmation);
        toast.success(
          `Loaded existing confirmation for ${res.confirmation.full_name}. You can now edit and update your response!`,
        );
      } else {
        toast.error(res.error || "Could not find an existing confirmation for that email.");
      }
    } catch {
      toast.error("Failed to look up speaker confirmation.");
    } finally {
      setIsLookingUpEmail(false);
    }
  };

  // Resolve Swag items based on event merchandise list and custom swags
  const speakerSwagItems: ResolvedSpeakerSwagItem[] = useMemo(() => {
    const config = event.speaker_config;
    if (config?.show_swag_section === false) return [];

    const items: ResolvedSpeakerSwagItem[] = [];

    // 1. From event merchandise catalog
    const allMerchandise = event.merchandise || [];
    const selectedMerchIds = config?.selected_merchandise_ids;

    let targetMerchandise = allMerchandise;
    if (Array.isArray(selectedMerchIds)) {
      targetMerchandise = allMerchandise.filter((m) => selectedMerchIds.includes(m.id));
    }

    targetMerchandise.forEach((m) => {
      // Find variation that has options (e.g. Size or Variant)
      const sizeVar = m.variations?.find((v) => v.name.toLowerCase().includes("size")) || m.variations?.[0];
      const options = sizeVar?.options?.length ? sizeVar.options : TSHIRT_SIZES;
      items.push({
        id: `merch_${m.id}`,
        label: m.name,
        description: m.description,
        options,
      });
    });

    // 2. Custom Swags not in merchandise catalog (filter out hidden ones)
    const customSwags = config?.custom_swags;
    const hasConfiguredCustomSwags = Boolean(customSwags && Array.isArray(customSwags));
    if (customSwags && Array.isArray(customSwags)) {
      customSwags.forEach((cs) => {
        if (cs.hidden) return;
        items.push({
          id: cs.id === "default_tshirt" ? "default_tshirt" : `custom_${cs.id}`,
          label: cs.label,
          description: cs.description,
          options: cs.options?.length ? cs.options : TSHIRT_SIZES,
        });
      });
    }

    // 3. Fallback: ONLY IF custom_swags was never configured/initialized at all and no merchandise selected,
    // provide standard T-shirt size option. If custom_swags exists (even if default_tshirt is hidden), respect it!
    if (items.length === 0 && !hasConfiguredCustomSwags && (!selectedMerchIds || selectedMerchIds.length === 0)) {
      items.push({
        id: "default_tshirt",
        label: "T-Shirt Size (Unisex Standard)",
        description: "Official GDG community conference commemorative t-shirt",
        options: TSHIRT_SIZES,
      });
    }

    return items;
  }, [event.merchandise, event.speaker_config]);

  // Photo mode: "upload" (direct bucket storage) or "url" (external link)
  const [photoMode, setPhotoMode] = useState<"upload" | "url">("upload");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Validation error state tracking
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AI Generation States
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isRegeneratingDesc, setIsRegeneratingDesc] = useState(false);

  const maxPhotoSizeMb = event.speaker_config?.max_photo_size_mb ?? 5;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPEG, PNG, or WebP).");
      return;
    }

    if (file.size > maxPhotoSizeMb * 1024 * 1024) {
      toast.error(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum limit of ${maxPhotoSizeMb} MB.`,
      );
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", String(event.id));
      formData.append("token", token);
      formData.append("speakerName", fullName || "speaker");

      const res = await fetch("/api/events/upload-speaker-photo", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to upload photo.");
      }

      setSpeakerProfileUrl(data.url);
      setUploadedFileName(file.name);
      toast.success("Photo uploaded to cloud bucket successfully!");
    } catch (err) {
      console.error("[Speaker photo upload error]", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const activePresetKey = event.speaker_config?.active_slide_preset || "gdg_default";
  const slideTemplate =
    event.speaker_config?.custom_slide_template_url ||
    SPEAKER_SLIDE_TEMPLATE_PRESETS[activePresetKey]?.url ||
    "https://gdgjakarta.org/gdg-slide-template";

  // AI Generation Handlers
  const handleAiGenerateTalk = async () => {
    const topicPrompt =
      talkTitle.trim() ||
      prompt("Enter your talk topic or keynote concept (e.g. Building Fullstack Apps with Cloud Run & Gemini 2.5):");
    if (!topicPrompt) return;

    try {
      setIsGeneratingAi(true);
      const toastId = toast.loading(`Generating talk details with Bevy AI for "${topicPrompt}"...`);
      const res = await generateSpeakerTalkWithAiAction({
        eventId: event.id,
        token,
        topicPrompt,
        currentTitle: talkTitle.trim(),
        currentDescription: talkDescription.trim(),
        targetField: "both",
      });

      if (res.success) {
        if (res.title) {
          setTalkTitle(res.title);
          setErrors((prev) => ({ ...prev, talkTitle: "" }));
        }
        if (res.description) {
          setTalkDescription(res.description);
          setErrors((prev) => ({ ...prev, talkDescription: "" }));
        }
        toast.success("AI generated talk title and description successfully!", { id: toastId });
      } else {
        toast.error(res.error || "Failed to generate talk details with AI", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generating AI content");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleRegenerateTitle = async () => {
    if (!talkTitle.trim() && !talkDescription.trim()) {
      toast.error("Please enter a talk title or description first before regenerating.");
      return;
    }

    try {
      setIsRegeneratingTitle(true);
      const toastId = toast.loading("Regenerating talk title with Bevy AI...");
      const res = await generateSpeakerTalkWithAiAction({
        eventId: event.id,
        token,
        topicPrompt: talkTitle.trim() || "Technical Session",
        currentTitle: talkTitle.trim(),
        currentDescription: talkDescription.trim(),
        targetField: "title",
      });

      if (res.success && res.title) {
        setTalkTitle(res.title);
        setErrors((prev) => ({ ...prev, talkTitle: "" }));
        toast.success("Talk title regenerated successfully!", { id: toastId });
      } else {
        toast.error(res.error || "Failed to regenerate title", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error regenerating title");
    } finally {
      setIsRegeneratingTitle(false);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!talkTitle.trim() && !talkDescription.trim()) {
      toast.error("Please enter a talk title or description first before regenerating.");
      return;
    }

    try {
      setIsRegeneratingDesc(true);
      const toastId = toast.loading("Regenerating talk description with Bevy AI...");
      const res = await generateSpeakerTalkWithAiAction({
        eventId: event.id,
        token,
        topicPrompt: talkTitle.trim() || "Technical Session",
        currentTitle: talkTitle.trim(),
        currentDescription: talkDescription.trim(),
        targetField: "description",
      });

      if (res.success && res.description) {
        setTalkDescription(res.description);
        setErrors((prev) => ({ ...prev, talkDescription: "" }));
        toast.success("Talk description regenerated successfully!", { id: toastId });
      } else {
        toast.error(res.error || "Failed to regenerate description", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error regenerating description");
    } finally {
      setIsRegeneratingDesc(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = "Name (displayed on poster) is required.";
    }

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required (used on posters and session banners).";
    }

    if (!speakerEmail.trim()) {
      newErrors.speakerEmail = "Speaker email is required for invitation and calendar invite.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speakerEmail.trim())) {
      newErrors.speakerEmail = "Please enter a valid email address.";
    }

    if (contactChannels.length === 0) {
      newErrors.contactChannels = "Please select at least one contact channel preference.";
    }

    if (!jobTitle.trim()) {
      newErrors.jobTitle = "Job title is required.";
    }

    if (!companyInstitution.trim()) {
      newErrors.companyInstitution = "Company / institution is required.";
    }

    if (!talkTitle.trim()) {
      newErrors.talkTitle = "Talk title is required.";
    }

    if (talkDescription.length > 300) {
      newErrors.talkDescription = "Talk description must be at most 300 characters.";
    }

    if (biography.length > 3000) {
      newErrors.biography = "Biography must be at most 3000 characters.";
    }

    if (!speakerProfileUrl.trim()) {
      newErrors.speakerProfileUrl = "Speaker photo is required for session posters and website roster.";
    }

    if (isFromGoogleEcosystem === "GDE" && gdeIsOther && !gdeOtherInput.trim()) {
      newErrors.gdeOtherInput = "Please specify your GDE expertise area.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please resolve the required fields marked in red.");
      return;
    }

    setErrors({});

    // Resolve final ecosystem details
    let finalEcosystemDetails = "";
    if (isFromGoogleEcosystem === "GDE") {
      if (gdeIsOther) {
        finalEcosystemDetails = gdeOtherInput.trim();
      } else {
        const parts = [gdeTechArea, gdeSubcategory].filter(Boolean);
        finalEcosystemDetails = parts.join(" - ");
      }
    } else if (
      isFromGoogleEcosystem === "GDG" ||
      isFromGoogleEcosystem === "WTM" ||
      isFromGoogleEcosystem === "Googler"
    ) {
      finalEcosystemDetails = ecosystemDetails.trim();
    }

    // Resolve dietary list
    const combinedDietary = [...dietaryRestrictions];
    if (dietaryOther.trim()) {
      combinedDietary.push(dietaryOther.trim());
    }

    startTransition(async () => {
      const res = await submitSpeakerConfirmationAction({
        event_id: event.id,
        token,
        confirmation_id: editingConfirmationId,
        display_name: displayName,
        full_name: fullName,
        speaker_email: speakerEmail,
        contact_channels: contactChannels,
        whatsapp_number: whatsappNumber,
        job_title: jobTitle,
        company_institution: companyInstitution,
        linkedin_url: linkedinUrl,
        twitter_url: twitterUrl,
        instagram_username: instagramUsername,
        company_twitter_username: companyTwitterUsername,
        portfolio_url: portfolioUrl,
        linkedin_or_social_url: linkedinUrl || twitterUrl || portfolioUrl,
        speaker_profile_url: speakerProfileUrl,
        google_ecosystem_or_technology: googleEcosystem,
        is_from_google_ecosystem: isFromGoogleEcosystem,
        ecosystem_details: finalEcosystemDetails,
        presenter_role: presenterRole,
        talk_type: talkType,
        talk_title: talkTitle,
        talk_description: talkDescription,
        biography: biography,
        can_share_slides: canShareSlides,
        session_slot: sessionSlot,
        presentation_slides_url: presentationSlidesUrl,
        tshirt_size: swagSelections.default_tshirt || Object.values(swagSelections)[0] || tshirtSize,
        swag_selections: swagSelections,
        dietary_restrictions: combinedDietary.join(", "),
        dietary_restrictions_list: combinedDietary,
        additional_inquiry: additionalInquiry,
        bevy_person_id: selectedBevyProfile?.id,
      });

      if (res.success) {
        if (res.confirmationId) {
          setEditingConfirmationId(res.confirmationId);
        }
        setWasUpdate(Boolean(res.isUpdate || editingConfirmationId));
        setSubmitted(true);
        toast.success(
          res.isUpdate || editingConfirmationId
            ? "Speaker confirmation updated successfully!"
            : "Speaker confirmation submitted! Check your email for your invitation pass.",
        );
      } else {
        toast.error(res.error || "Failed to submit speaker confirmation.");
      }
    });
  };

  if (submitted) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5 text-center">
        <CardHeader className="pt-8 pb-4">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-8" />
          </div>
          <CardTitle className="font-bold text-xl sm:text-2xl">
            {wasUpdate ? "Speaker Confirmation Updated!" : "Speaker Confirmation Received!"}
          </CardTitle>
          <CardDescription className="mx-auto max-w-md text-sm">
            Thank you, <span className="font-semibold text-foreground">{fullName}</span>. Your speaker session details
            for <span className="font-semibold text-foreground">{event.title}</span> have been{" "}
            {wasUpdate ? "updated" : "confirmed"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="mx-auto max-w-md space-y-4 pb-6 text-left text-muted-foreground text-sm">
          <div className="space-y-2 rounded-lg border bg-background p-4">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" /> What happens next?
            </div>
            <p className="text-xs">
              1. <strong>Invitation Email:</strong> We have sent your official speaker pass and session details to{" "}
              <strong>{speakerEmail}</strong>.
            </p>
            <p className="text-xs">
              2. <strong>Calendar Invite:</strong> A Google Calendar invite for your session has been generated.
            </p>
            <p className="text-xs">
              3. <strong>Speaker Handbook:</strong> Access slide dimensions, guidelines, and venue logistics anytime.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-center gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => setSubmitted(false)} className="gap-1.5">
            <Pencil className="size-4" />
            Edit Response
          </Button>
          <Link
            href={`/events/${event.id}/speaker-handbook?token=${token}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
          >
            Open Speaker Handbook
            <ExternalLink className="ml-1.5 size-4" />
          </Link>
          <Link
            href={`/events/${event.id}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            View Event Page
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const venueDisplayName = event.venue?.name || [event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
  const headerImageUrl =
    event.banner_url ||
    event.picture_url ||
    "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Banner */}
      <Card className="overflow-hidden">
        <div className="relative aspect-[1244/388] max-h-72 w-full overflow-hidden border-b bg-muted">
          <Image
            src={headerImageUrl}
            alt={`${event.title} Header`}
            fill
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
            priority
          />
        </div>
        <CardHeader className="space-y-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs uppercase tracking-wider">
              <Mic className="size-3.5" />
              Official Speaker Confirmation
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-[11px] text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3" />
              Verified Event Access
            </span>
            {event.status === "Draft" && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 font-medium text-[11px] text-amber-600 dark:text-amber-400"
              >
                Draft Event
              </Badge>
            )}
          </div>
          <CardTitle className="font-bold text-xl tracking-tight sm:text-2xl">{event.title}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Please confirm your speaker profile, talk details, slide deck link, and stage requirements. An official
            speaker invitation pass and calendar invite will be emailed to you immediately upon submission.
          </CardDescription>

          {/* Quick Meta Row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-muted-foreground text-xs">
            {event.start_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>
                  {new Date(event.start_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {venueDisplayName && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                <span>{venueDisplayName}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Presentation className="size-3.5 text-primary" />
              <span>16:9 Widescreen Slides</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Official Slide Template Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-foreground">Official Speaker Slide Template</div>
            <div className="text-muted-foreground text-xs">
              Please make a copy of our official 16:9 widescreen presentation slide deck.
            </div>
          </div>
          <a
            href={slideTemplate}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-3 font-semibold text-primary-foreground text-xs hover:bg-primary/90"
          >
            Get Slide Template
            <ExternalLink className="ml-1.5 size-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* Already Submitted / Edit Existing Response Banner */}
      <Card className="border-amber-500/25 bg-amber-500/[0.04]">
        <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
              <Pencil className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                {editingConfirmationId
                  ? "Editing Existing Confirmation Response"
                  : "Already submitted your speaker confirmation?"}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {editingConfirmationId
                ? `You are updating your submitted speaker details for ${speakerEmail}. Submit below to save your changes.`
                : "Enter your submitted email address to load and update your response (e.g. slide deck link, bio, or talk details)."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              type="email"
              placeholder="Enter your submitted email..."
              value={lookupEmailInput ?? ""}
              onChange={(e) => setLookupEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLookupExistingResponse();
                }
              }}
              className="h-8 w-full bg-background text-xs sm:w-56"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={handleLookupExistingResponse}
              disabled={isLookingUpEmail}
            >
              {isLookingUpEmail ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load My Response"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 1. Speaker Profile */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-semibold text-base">1. Speaker &amp; Poster Profile</CardTitle>
              <CardDescription>Used for event banners, schedule flyers, and Bevy speaker directory.</CardDescription>
            </div>
            {selectedBevyProfile && (
              <Badge
                variant="outline"
                className="h-6 gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs dark:text-emerald-400"
              >
                <UserCheck className="size-3" />
                Bevy Profile Connected (#{selectedBevyProfile.id})
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bevy Profile Autocomplete / Search */}
          <div className="relative rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs">
            <div className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
              <Search className="size-3.5 text-primary" />
              <span>Already spoke at GDG or have a Bevy profile?</span>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Search your name to autofill your name, title, company, and profile photo from previous GDG events.
            </p>
            <div className="relative">
              <Input
                placeholder="Type your name (e.g. Haidar, Pratama)..."
                value={profileSearchQuery ?? ""}
                onChange={(e) => handleSearchProfile(e.target.value)}
                className="h-8 bg-background pr-8 text-xs"
              />
              {isSearchingProfile && (
                <Loader2 className="absolute top-2 right-2.5 size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {profileSearchResults.length > 0 && (
              <div className="absolute right-3 left-3 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                <div className="px-2 py-1 font-semibold text-[10px] text-muted-foreground">
                  Matching Bevy Speakers ({profileSearchResults.length})
                </div>
                {profileSearchResults.map((person) => {
                  const pName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectBevyProfile(person)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                    >
                      {person.picture_url ? (
                        <div className="relative size-7 shrink-0 overflow-hidden rounded-full border">
                          <Image src={person.picture_url} alt={pName} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-[10px]">
                          {person.first_name?.[0] || "S"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{pName}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {person.title || "Speaker"} {person.company ? `• ${person.company}` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary" className="h-4 text-[9px]">
                        Autofill
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="presenter_role">
              Participant / Presenter Role <span className="text-destructive">*</span>
            </Label>
            <Select value={presenterRole} onValueChange={(val) => setPresenterRole(val as SpeakerRoleKey)}>
              <SelectTrigger id="presenter_role" className="h-9">
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
            <p className="text-[11px] text-muted-foreground">
              Select your role variant in this event (e.g. Keynote Speaker, Panelist, Workshop Facilitator, Mentor,
              Judge, Moderator, or Host).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">
                Name <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="display_name"
                placeholder="e.g. Alex Pratama"
                value={displayName ?? ""}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: "" }));
                }}
                className={errors.displayName ? "border-destructive focus-visible:ring-destructive" : ""}
                required
              />
              {errors.displayName ? (
                <p className="font-medium text-[11px] text-destructive">{errors.displayName}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Short preferred name on banners.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full Name <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                placeholder="e.g. Muhammad Alex Pratama"
                value={fullName ?? ""}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
                }}
                className={errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}
                required
              />
              {errors.fullName ? (
                <p className="font-medium text-[11px] text-destructive">{errors.fullName}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Full legal/formal name for certificate and roster.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="speaker_email">
                Speaker Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="speaker_email"
                type="email"
                placeholder="e.g. alex.pratama@example.com"
                value={speakerEmail ?? ""}
                onChange={(e) => {
                  setSpeakerEmail(e.target.value);
                  if (errors.speakerEmail) setErrors((prev) => ({ ...prev, speakerEmail: "" }));
                }}
                className={errors.speakerEmail ? "border-destructive focus-visible:ring-destructive" : ""}
                required
              />
              {errors.speakerEmail ? (
                <p className="font-medium text-[11px] text-destructive">{errors.speakerEmail}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Your invitation pass &amp; calendar invite will be delivered here.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Do you have WhatsApp or Telegram to get in touch with us? <span className="text-destructive">*</span>
              </Label>
              <div
                className={`flex flex-wrap gap-2 rounded-md p-1 pt-1 ${
                  errors.contactChannels ? "border border-destructive bg-destructive/5" : ""
                }`}
              >
                {CONTACT_CHANNELS.map((channel) => {
                  const checked = contactChannels.includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => {
                        if (checked) {
                          setContactChannels((prev) => prev.filter((c) => c !== channel));
                        } else {
                          setContactChannels((prev) => [...prev, channel]);
                        }
                        if (errors.contactChannels) {
                          setErrors((prev) => ({ ...prev, contactChannels: "" }));
                        }
                      }}
                      className={`rounded-md border px-3 py-1.5 font-medium text-xs transition-colors ${
                        checked
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {channel}
                    </button>
                  );
                })}
              </div>
              {errors.contactChannels && (
                <p className="font-medium text-[11px] text-destructive">{errors.contactChannels}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp or Telegram phone number</Label>
            <Input
              id="whatsapp_number"
              placeholder="e.g. +62 812 3456 7890"
              value={whatsappNumber ?? ""}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              If the phone number is not valid then we will contact you via email.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job_title">
                Job Title / Role{" "}
                <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="job_title"
                placeholder="e.g. Staff AI/Cloud Engineer"
                value={jobTitle ?? ""}
                onChange={(e) => {
                  setJobTitle(e.target.value);
                  if (errors.jobTitle) setErrors((prev) => ({ ...prev, jobTitle: "" }));
                }}
                className={errors.jobTitle ? "border-destructive focus-visible:ring-destructive" : ""}
                required
              />
              {errors.jobTitle && <p className="font-medium text-[11px] text-destructive">{errors.jobTitle}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_institution">
                Company / Institution{" "}
                <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_institution"
                placeholder="e.g. Google Cloud"
                value={companyInstitution ?? ""}
                onChange={(e) => {
                  setCompanyInstitution(e.target.value);
                  if (errors.companyInstitution) setErrors((prev) => ({ ...prev, companyInstitution: "" }));
                }}
                className={errors.companyInstitution ? "border-destructive focus-visible:ring-destructive" : ""}
                required
              />
              {errors.companyInstitution && (
                <p className="font-medium text-[11px] text-destructive">{errors.companyInstitution}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="speaker_profile_url" className="text-sm">
                Speaker Photo <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPhotoMode("upload");
                    setErrors((prev) => ({ ...prev, speakerProfileUrl: "" }));
                  }}
                  className={`font-medium transition-colors hover:text-foreground ${
                    photoMode === "upload" ? "text-primary underline underline-offset-4" : ""
                  }`}
                >
                  Upload File
                </button>
                <span className="opacity-40">&bull;</span>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoMode("url");
                    setErrors((prev) => ({ ...prev, speakerProfileUrl: "" }));
                  }}
                  className={`font-medium transition-colors hover:text-foreground ${
                    photoMode === "url" ? "text-primary underline underline-offset-4" : ""
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {photoMode === "upload" ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    id="speaker_photo_file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileUpload}
                    disabled={isUploadingPhoto}
                    className={`cursor-pointer file:cursor-pointer file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:font-semibold file:text-primary file:text-xs hover:file:bg-primary/20 ${
                      errors.speakerProfileUrl ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                  {isUploadingPhoto && (
                    <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5 font-medium text-primary text-xs">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  )}
                </div>
                {speakerProfileUrl ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="relative size-7 shrink-0 overflow-hidden rounded border bg-background">
                        <Image src={speakerProfileUrl} alt="Preview" fill className="object-cover" unoptimized />
                      </div>
                      <span className="truncate font-medium text-foreground text-xs">
                        {uploadedFileName || "Photo uploaded successfully"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeakerProfileUrl("");
                        setUploadedFileName("");
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Remove photo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    PNG, JPG, or WebP up to {maxPhotoSizeMb} MB. Displayed on event poster and website.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    id="speaker_profile_url"
                    placeholder="https://drive.google.com/... or direct image URL"
                    value={speakerProfileUrl ?? ""}
                    onChange={(e) => {
                      setSpeakerProfileUrl(e.target.value);
                      if (errors.speakerProfileUrl) {
                        setErrors((prev) => ({ ...prev, speakerProfileUrl: "" }));
                      }
                    }}
                    className={errors.speakerProfileUrl ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                </div>
                {speakerProfileUrl?.startsWith("http") && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <div className="relative size-6 shrink-0 overflow-hidden rounded border bg-background">
                      <Image src={speakerProfileUrl} alt="URL preview" fill className="object-cover" unoptimized />
                    </div>
                    <span className="truncate text-[11px]">Preview loaded from URL</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Direct image link or public Google Drive image link.
                </p>
              </div>
            )}

            {errors.speakerProfileUrl && (
              <p className="font-medium text-[11px] text-destructive">{errors.speakerProfileUrl}</p>
            )}
          </div>

          {/* Social & Portfolio Links (Each in distinct fields) */}
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="linkedin_url" className="font-semibold text-xs">
                LinkedIn (Displayed on Event Page)
              </Label>
              <Input
                id="linkedin_url"
                placeholder="https://linkedin.com/in/{your-linkedin-profile}"
                value={linkedinUrl ?? ""}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter_url" className="font-semibold text-xs">
                Twitter/X Username (Displayed on Event Page)
              </Label>
              <Input
                id="twitter_url"
                placeholder="e.g. alexpratama or @alexpratama"
                value={twitterUrl ?? ""}
                onChange={(e) => setTwitterUrl(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram_username" className="font-semibold text-xs">
                Instagram Username (Tag on Speaker Reveal Post)
              </Label>
              <Input
                id="instagram_username"
                placeholder="e.g. alexpratama"
                value={instagramUsername ?? ""}
                onChange={(e) => setInstagramUsername(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_twitter" className="font-semibold text-xs">
                Company Twitter/X Username (Displayed on Event Page)
              </Label>
              <Input
                id="company_twitter"
                placeholder="e.g. googlecloud or @googlecloud"
                value={companyTwitterUsername ?? ""}
                onChange={(e) => setCompanyTwitterUsername(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Label htmlFor="biography" className="flex items-center justify-between font-semibold text-xs">
              <span>Biography (Displayed on Event Page)</span>
              <span
                className={`text-[11px] ${biography.length > 3000 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
              >
                {biography.length}/3000 characters
              </span>
            </Label>
            <Textarea
              id="biography"
              rows={4}
              placeholder="Tell attendees about your background, career experience, and technical passions..."
              value={biography ?? ""}
              onChange={(e) => {
                setBiography(e.target.value);
                if (errors.biography) setErrors((prev) => ({ ...prev, biography: "" }));
              }}
              className={`resize-y text-xs ${errors.biography ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {errors.biography && <p className="font-medium text-[11px] text-destructive">{errors.biography}</p>}
          </div>
        </CardContent>
      </Card>

      {/* 2. Session & Talk Details */}
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold text-base">2. Talk &amp; Session Details</CardTitle>
          <CardDescription>Specify your talk topic, category, and presentation slide deck URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="talk_title">
                Talk Title <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-1">
                {talkTitle.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateTitle}
                    disabled={isRegeneratingTitle || isGeneratingAi}
                    className="h-6 gap-1 px-2 text-primary text-xs hover:text-primary"
                    title="Regenerate Title only without touching Description"
                  >
                    {isRegeneratingTitle ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3 text-primary" />
                    )}
                    Regenerate Title
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAiGenerateTalk}
                  disabled={isGeneratingAi}
                  className="h-6 gap-1 px-2 text-muted-foreground text-xs hover:text-foreground"
                  title="Generate both Title and Description from a topic prompt"
                >
                  {isGeneratingAi ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  Generate with AI
                </Button>
              </div>
            </div>
            <Input
              id="talk_title"
              placeholder="e.g. Architecting Scalable GenAI Agents with Gemini 2.5 and Cloud Run"
              value={talkTitle ?? ""}
              onChange={(e) => {
                setTalkTitle(e.target.value);
                if (errors.talkTitle) setErrors((prev) => ({ ...prev, talkTitle: "" }));
              }}
              className={errors.talkTitle ? "border-destructive focus-visible:ring-destructive" : ""}
              required
            />
            {errors.talkTitle ? (
              <p className="font-medium text-[11px] text-destructive">{errors.talkTitle}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                This field is required to generate your official speaker invitation email.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="talk_description">
                  Talk Description{" "}
                  <span className="font-normal text-muted-foreground text-xs">(Displayed on Caption)</span>
                </Label>
                <span
                  className={`text-[11px] ${talkDescription.length > 300 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                >
                  {talkDescription.length}/300 characters
                </span>
              </div>
              {talkDescription.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateDescription}
                  disabled={isRegeneratingDesc || isGeneratingAi}
                  className="h-6 gap-1 px-2 text-primary text-xs hover:text-primary"
                  title="Regenerate/shorten description with AI"
                >
                  {isRegeneratingDesc ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 text-primary" />
                  )}
                  Regenerate with AI
                </Button>
              )}
            </div>
            <Textarea
              id="talk_description"
              rows={3}
              placeholder="Brief summary of your session for event social captions and schedules (max 300 characters)..."
              value={talkDescription ?? ""}
              onChange={(e) => {
                setTalkDescription(e.target.value);
                if (errors.talkDescription) setErrors((prev) => ({ ...prev, talkDescription: "" }));
              }}
              className={`resize-y text-xs ${errors.talkDescription ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {errors.talkDescription && (
              <p className="font-medium text-[11px] text-destructive">{errors.talkDescription}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Talk / Session Type <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={talkType}
              onValueChange={(v) => setTalkType(v as SpeakerTalkType)}
              className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2"
            >
              {TALK_TYPES.map((t) => (
                <label
                  key={t.id}
                  htmlFor={`type_${t.id}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    talkType === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={t.id} id={`type_${t.id}`} className="mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">{t.label}</div>
                    <div className="text-muted-foreground">{t.desc}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Google Developers Ecosystem Selection */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-1">
              <Label className="font-semibold text-sm">
                Are you from Google Developers Ecosystem?{" "}
                <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <p className="text-muted-foreground text-xs">Select your recognized community designation or program.</p>
            </div>

            <RadioGroup
              value={isFromGoogleEcosystem}
              onValueChange={(val) => {
                const choice = val as GoogleEcosystemChoice;
                setIsFromGoogleEcosystem(choice);
                if (choice === "None above") {
                  setEcosystemDetails("");
                  setGdePillar("");
                  setGdeTechArea("");
                  setGdeSubcategory("");
                  setGdeIsOther(false);
                  setGdeOtherInput("");
                } else if (choice === "GDE") {
                  if (!gdeTechArea && !gdeIsOther) {
                    setGdeTechArea(GDE_EXPERTISE_MAPPING[0].technologyArea);
                    setGdePillar(GDE_EXPERTISE_MAPPING[0].pillar);
                  }
                }
              }}
              className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-5"
            >
              {GOOGLE_ECOSYSTEM_CHOICES.map((choice) => (
                <label
                  key={choice}
                  htmlFor={`eco_${choice}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors ${
                    isFromGoogleEcosystem === choice
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={choice} id={`eco_${choice}`} />
                  <span>{choice}</span>
                </label>
              ))}
            </RadioGroup>

            {/* Dynamic Ecosystem Details Input */}
            {isFromGoogleEcosystem === "GDE" && (
              <div className="mt-4 space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <Label className="font-semibold text-xs">
                    Google Developers Expert (GDE) Expertise Area{" "}
                    <span className="font-normal text-muted-foreground text-xs">(Displayed on Poster)</span>{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Select your official GDE category from the table mapping, or select &quot;Other&quot; to specify
                    manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Pillar &amp; Technology Area</Label>
                    <Select
                      value={gdeIsOther ? "__other__" : gdeTechArea || GDE_EXPERTISE_MAPPING[0].technologyArea}
                      onValueChange={(val) => {
                        if (val === "__other__") {
                          setGdeIsOther(true);
                          setGdeSubcategory("");
                        } else {
                          setGdeIsOther(false);
                          setGdeTechArea(val);
                          const matched = GDE_EXPERTISE_MAPPING.find((m) => m.technologyArea === val);
                          if (matched) {
                            setGdePillar(matched.pillar);
                            setGdeSubcategory(matched.subcategories[0] || "");
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select GDE area" />
                      </SelectTrigger>
                      <SelectContent>
                        {GDE_EXPERTISE_MAPPING.map((item) => (
                          <SelectItem key={item.technologyArea} value={item.technologyArea} className="text-xs">
                            <span className="font-semibold text-primary">[{item.pillar}]</span> {item.technologyArea}
                          </SelectItem>
                        ))}
                        <SelectItem value="__other__" className="font-medium text-amber-600 text-xs">
                          + Other (Manual input)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {gdeIsOther ? (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Custom GDE Expertise Area</Label>
                      <Input
                        placeholder="e.g. Chrome Extension, WebML"
                        value={gdeOtherInput ?? ""}
                        onChange={(e) => setGdeOtherInput(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>
                  ) : (
                    (() => {
                      const currentItem = GDE_EXPERTISE_MAPPING.find(
                        (m) => m.technologyArea === (gdeTechArea || GDE_EXPERTISE_MAPPING[0].technologyArea),
                      );
                      if (currentItem && currentItem.subcategories.length > 0) {
                        return (
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">Subcategory (Optional)</Label>
                            <Select
                              value={gdeSubcategory}
                              onValueChange={(val) => setGdeSubcategory(val === "__none__" ? "" : val)}
                            >
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Select subcategory (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-muted-foreground text-xs">
                                  None (General {currentItem.technologyArea})
                                </SelectItem>
                                {currentItem.subcategories.map((sub) => (
                                  <SelectItem key={sub} value={sub} className="text-xs">
                                    {sub}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Pillar Info</Label>
                          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-muted-foreground text-xs">
                            Pillar: {gdePillar || currentItem?.pillar || "Technology"}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            )}

            {(isFromGoogleEcosystem === "GDG" || isFromGoogleEcosystem === "WTM") && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <Label htmlFor="chapter_details" className="font-semibold text-xs">
                  From which chapter?{" "}
                  <span className="font-normal text-muted-foreground text-xs">(Optional, Displayed on Poster)</span>
                </Label>
                <Input
                  id="chapter_details"
                  placeholder="e.g. GDG Jakarta, GDG Cloud Jakarta, WTM Jakarta"
                  value={ecosystemDetails ?? ""}
                  onChange={(e) => setEcosystemDetails(e.target.value)}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Optional: If you are an organizer or lead in a GDG or Women Techmakers chapter.
                </p>
              </div>
            )}

            {isFromGoogleEcosystem === "Googler" && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <Label htmlFor="googler_details" className="font-semibold text-xs">
                  Googler Team / Expertise{" "}
                  <span className="font-normal text-muted-foreground text-xs">(Optional, Displayed on Poster)</span>
                </Label>
                <Input
                  id="googler_details"
                  placeholder="e.g. Google Developer Relations, Google Cloud Indonesia"
                  value={ecosystemDetails ?? ""}
                  onChange={(e) => setEcosystemDetails(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Primary Technology / Google Ecosystem</Label>
            <Select value={googleEcosystem} onValueChange={(v) => setGoogleEcosystem(v as SpeakerEcosystemType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select ecosystem" />
              </SelectTrigger>
              <SelectContent>
                {ECOSYSTEMS.map((eco) => (
                  <SelectItem key={eco} value={eco}>
                    {eco}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="presentation_slides_url">
              Presentation Slide Deck Link (Google Slides or Deployed Slides)
            </Label>
            <Input
              id="presentation_slides_url"
              placeholder="https://docs.google.com/presentation/d/... or https://your-slides.web.app"
              value={presentationSlidesUrl ?? ""}
              onChange={(e) => setPresentationSlidesUrl(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Provide your public Google Slides or deployed slides link (e.g. Slidev, Marp, Web Slides). If using Google
              Slides, ensure view access is set to <em>&quot;Anyone with the link can view&quot;</em>.
            </p>
          </div>

          <div className="space-y-2 border-t pt-1">
            <Label className="font-semibold text-xs">
              Can we share your slides material to the participants? <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={canShareSlides}
              onValueChange={(val) => setCanShareSlides(val as "Yes" | "No")}
              className="flex items-center gap-4 pt-1"
            >
              <label
                htmlFor="share_yes"
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 font-medium text-xs transition-colors ${
                  canShareSlides === "Yes"
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="Yes" id="share_yes" />
                <span>Yes</span>
              </label>
              <label
                htmlFor="share_no"
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 font-medium text-xs transition-colors ${
                  canShareSlides === "No"
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="No" id="share_no" />
                <span>No</span>
              </label>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* 3. Speaker Logistics */}
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold text-base">3. Speaker Swag &amp; Logistics</CardTitle>
          <CardDescription>Helps us prepare your speaker merchandise, badge, and dietary meal options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Dynamic Swag selection based on event merchandise and custom swags */}
            {speakerSwagItems.length > 0 && (
              <div className="space-y-4">
                {speakerSwagItems.map((item) => {
                  const currentValue = swagSelections[item.id] || item.options[0] || "";
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <Label className="font-semibold text-xs">{item.label}</Label>
                      {item.description && <p className="text-[11px] text-muted-foreground">{item.description}</p>}
                      <Select
                        value={currentValue}
                        onValueChange={(val) => {
                          setSwagSelections((prev) => ({ ...prev, [item.id]: val }));
                          if (item.id === "default_tshirt" || !tshirtSize) {
                            setTshirtSize(val);
                          }
                        }}
                      >
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Select variant / size" />
                        </SelectTrigger>
                        <SelectContent>
                          {item.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`space-y-2 ${speakerSwagItems.length > 0 ? "border-t pt-2" : ""}`}>
              <Label className="font-semibold text-xs">Dietary Restrictions</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {DIETARY_OPTIONS.map((opt) => {
                  const checked = dietaryRestrictions.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (checked) {
                          setDietaryRestrictions((prev) => prev.filter((d) => d !== opt));
                        } else {
                          setDietaryRestrictions((prev) => [...prev, opt]);
                        }
                      }}
                      className={`rounded-md border px-3 py-1.5 font-medium text-xs transition-colors ${
                        checked
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div className="pt-2">
                <Input
                  placeholder="Other dietary requirements (e.g. Nut allergy, Gluten sensitivity)..."
                  value={dietaryOther ?? ""}
                  onChange={(e) => setDietaryOther(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-2 border-t pt-2">
              <Label htmlFor="additional_inquiry" className="font-semibold text-xs">
                Additional Inquiry
              </Label>
              <Textarea
                id="additional_inquiry"
                rows={2}
                placeholder="Any special requests, arrival time constraints, or equipment questions for our team..."
                value={additionalInquiry ?? ""}
                onChange={(e) => setAdditionalInquiry(e.target.value)}
                className="resize-y text-xs"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-between gap-3 bg-muted/30 pt-4 sm:flex-row">
          <div className="text-center text-muted-foreground text-xs sm:text-left">
            By submitting, you agree to follow the{" "}
            <a
              href="https://developers.google.com/community-guidelines"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google Community Guidelines
            </a>
            .
          </div>
          <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {editingConfirmationId ? "Updating Speaker Details..." : "Submitting & Sending Pass..."}
              </>
            ) : (
              <>
                <Send className="mr-2 size-4" />
                {editingConfirmationId ? "Update Speaker Response" : "Confirm Speaker Session"}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
