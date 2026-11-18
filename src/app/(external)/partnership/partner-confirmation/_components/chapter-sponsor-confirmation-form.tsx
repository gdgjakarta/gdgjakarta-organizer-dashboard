"use client";

import type React from "react";
import { useRef, useState, useTransition } from "react";

import Image from "next/image";

import {
  Building2,
  CheckCircle2,
  Crop,
  Globe,
  ImageIcon,
  Info,
  Loader2,
  Mail,
  Phone,
  Search,
  Sparkles,
  UploadCloud,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { SponsorLogoCropperDialog } from "@/components/sponsor-logo-cropper-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { lookupChapterSponsorByEmailAction, submitChapterSponsorConfirmationAction } from "@/server/sponsor-actions";
import type { ChapterSponsorConfig, SponsorCategory } from "@/types/sponsor";

interface ChapterSponsorConfirmationFormProps {
  token: string;
  config?: ChapterSponsorConfig;
}

export function ChapterSponsorConfirmationForm({ token, config }: ChapterSponsorConfirmationFormProps) {
  // Section 1: Company Details & Poster Logo
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLegalName, setCompanyLegalName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedTier, setSelectedTier] = useState<SponsorCategory>(config?.default_tier || "partner");

  // Section 2: Contact Internal
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Logo Cropper states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Status & lookup
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, startTransition] = useTransition();

  // Load existing response
  const handleLookupByEmail = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email first to load existing response.");
      return;
    }
    setIsLookingUp(true);
    try {
      const res = await lookupChapterSponsorByEmailAction(email.trim(), token);
      if (res.success && res.sponsor) {
        const s = res.sponsor;
        setCompanyName(s.company || "");
        setCompanyLegalName(s.company_legal_name || "");
        setCompanyAddress(s.company_address || "");
        setCompanyUrl(s.url || "");
        setCompanyDescription(s.description || "");
        setLogoUrl(s.logo || "");
        setSelectedTier(s.tier || "partner");
        setContactName(s.contact_name || "");
        setContactTitle(s.contact_title || "");
        setContactEmail(s.contact_email || "");
        setContactPhone(s.contact_phone || "");
        toast.success("Loaded your previous sponsor confirmation details!");
      } else {
        toast.info("No prior confirmation found for this email. You can fill out a fresh response!");
      }
    } catch {
      toast.error("Failed to load previous response.");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Raw file select -> open cropper
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

  // Cropped blob received -> upload directly to Bevy /api/image/
  const handleCropped = async (croppedBlob: Blob) => {
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", croppedBlob, "blob.png");
      formData.append("token", token);

      const res = await fetch("/api/events/upload-sponsor-logo", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Failed to upload image to Bevy.");
      }

      setLogoUrl(json.url);
      setCropModalOpen(false);
      toast.success("Company logo cropped & uploaded to Bevy successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!companyName.trim()) {
      toast.error("Please enter the company name.");
      return;
    }
    if (!logoUrl.trim()) {
      toast.error("Please upload and crop your company logo (16:9 aspect ratio).");
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitChapterSponsorConfirmationAction(token, {
          email: email.trim(),
          company_name: companyName.trim(),
          company_legal_name: companyLegalName.trim(),
          company_address: companyAddress.trim(),
          company_url: companyUrl.trim(),
          company_description: companyDescription.trim(),
          company_logo_url: logoUrl.trim(),
          contact_name: contactName.trim(),
          contact_title: contactTitle.trim(),
          contact_email: contactEmail.trim() || email.trim(),
          contact_phone: contactPhone.trim(),
          selected_tier: selectedTier,
        });

        if (res.success) {
          setIsSubmitted(true);
          toast.success("Sponsor confirmation submitted successfully!");
        } else {
          toast.error(res.error || "Failed to submit sponsor confirmation.");
        }
      } catch {
        toast.error("An error occurred while submitting confirmation.");
      }
    });
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-xl text-center py-16 px-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Sponsor Confirmation Received!</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Thank you for partnering with <strong>GDG Jakarta</strong>. Your brand assets and company profile have been
          received and added to our partners directory.
        </p>

        <div className="mt-8 p-4 rounded-xl border border-border bg-card text-left space-y-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative h-12 w-20 rounded border border-border bg-white flex items-center justify-center p-1 overflow-hidden">
                <img src={logoUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
            <div>
              <p className="text-sm font-bold text-foreground">{companyName}</p>
              <p className="text-xs text-muted-foreground capitalize">Tier: {selectedTier.replace("_", " ")}</p>
            </div>
          </div>
          {companyUrl && (
            <p className="text-xs text-muted-foreground truncate">
              Website:{" "}
              <a href={companyUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {companyUrl}
              </a>
            </p>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Need to make changes later? Simply reopen this link and use your work email to load and update your
          submission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-muted/40 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-medium text-xs text-muted-foreground w-fit">
            <Sparkles className="size-3 text-primary" />
            GDG Jakarta Partnership
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">GDG Jakarta - Chapter Partner &amp; Sponsor</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            We are excited to partner with your organization at <strong>GDG Jakarta</strong>! This form is to confirm
            your participation as an official chapter partner and gather your brand assets for our website directory and
            showcases.
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-3">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-foreground/70" />
              <span>Chapter Partner Directory</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Company Details & Poster Logo */}
        <Card className="shadow-xs border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Section 1 of 2
                </span>
                <CardTitle className="text-lg font-bold mt-1">Company Details &amp; Poster Logo</CardTitle>
                <CardDescription>
                  Your company brand assets displayed on the GDG Jakarta live pages and partnership showcases.
                </CardDescription>
              </div>

              {/* Load Previous Response */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLookupByEmail}
                disabled={isLookingUp}
                className="text-xs"
              >
                {isLookingUp ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                )}
                Load My Response
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Email + Lookup button */}
            <div className="space-y-1.5">
              <Label htmlFor="workEmail" className="text-sm font-medium">
                Work Email *
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="workEmail"
                    type="email"
                    required
                    className="pl-9"
                    placeholder="partner@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLookupByEmail}
                  disabled={isLookingUp || !email.trim()}
                  className="sm:w-auto text-xs shrink-0"
                >
                  {isLookingUp ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Search className="mr-1.5 h-3.5 w-3.5" />
                      Load My Response
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                If you already submitted previously, click &ldquo;Load My Response&rdquo; to prefill and update your
                details.
              </p>
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-sm font-medium">
                Company Name *
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  required
                  className="pl-9"
                  placeholder="Acme Corp, Google, etc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            {/* Company Legal Name & Billing Address */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="companyLegalName" className="text-sm font-medium">
                  Company Legal Name (For Invoice / LOA)
                </Label>
                <Input
                  id="companyLegalName"
                  placeholder="PT Acme Teknologi Indonesia"
                  value={companyLegalName}
                  onChange={(e) => setCompanyLegalName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="companyAddress" className="text-sm font-medium">
                  Company / Billing Address
                </Label>
                <Input
                  id="companyAddress"
                  placeholder="Jl. Jend. Sudirman No. 1, Jakarta..."
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Website URL */}
            <div className="space-y-1.5">
              <Label htmlFor="companyUrl" className="text-sm font-medium">
                Website URL
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyUrl"
                  type="url"
                  className="pl-9"
                  placeholder="https://company.com"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Company Description */}
            <div className="space-y-1.5">
              <Label htmlFor="companyDescription" className="text-sm font-medium">
                Company Bio / Tagline
              </Label>
              <Textarea
                id="companyDescription"
                rows={3}
                placeholder="Brief description of your company, mission, or developer tools..."
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
              />
            </div>

            {/* Company Logo Upload & Poster Cropper */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-sm font-medium">
                Company Logo URL (Displayed on Poster & Website) <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload your high-resolution logo. You will be prompted to adjust and crop it in poster format directly
                for Bevy.
              </p>

              {logoUrl ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-border p-3 bg-muted/30">
                  <div className="relative aspect-video w-48 overflow-hidden rounded-md border border-border bg-white flex items-center justify-center p-2">
                    <img src={logoUrl} alt="Company Logo Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-foreground">Poster Logo Prepared</p>
                    <p className="text-xs text-muted-foreground truncate max-w-sm">{logoUrl}</p>
                    <div className="pt-2 flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Crop className="mr-1.5 h-3.5 w-3.5" />
                        Replace Logo
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50 cursor-pointer transition-colors bg-card"
                >
                  <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select and crop company poster logo</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG or WebP (max 10MB)</p>
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
          </CardContent>
        </Card>

        {/* Section 2: Contact Internal */}
        <Card className="shadow-xs border-border">
          <CardHeader>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Section 2 (Internal Liaison &amp; Coordination)
            </span>
            <CardTitle className="text-lg">Contact Representative</CardTitle>
            <CardDescription>
              Details for GDG Jakarta organizers to coordinate booth logistics, passes, and partnership deliverables.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Contact Person Name & Position/Title */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contactName" className="text-sm font-medium">
                  Contact Person Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contactName"
                    className="pl-9"
                    placeholder="Representative name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactTitle" className="text-sm font-medium">
                  Contact Position / Title
                </Label>
                <Input
                  id="contactTitle"
                  placeholder="e.g. Developer Relations Lead, Marketing Manager"
                  value={contactTitle}
                  onChange={(e) => setContactTitle(e.target.value)}
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail" className="text-sm font-medium">
                Direct Contact Email (Displayed on Website)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="contactEmail"
                  type="email"
                  className="pl-9"
                  placeholder="contact@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone" className="text-sm font-medium">
                Phone Number / WhatsApp (Displayed on Website)
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="contactPhone"
                  type="tel"
                  className="pl-9"
                  placeholder="+62 812..."
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-40 font-semibold">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Confirmation"
            )}
          </Button>
        </div>
      </form>

      {/* 16:9 Cropper Modal */}
      <SponsorLogoCropperDialog
        open={cropModalOpen}
        onOpenChange={setCropModalOpen}
        imageSrc={rawImageSrc}
        onCropped={handleCropped}
        isUploading={isUploadingLogo}
      />
    </div>
  );
}
