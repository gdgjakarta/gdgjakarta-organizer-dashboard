"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  Building2,
  Eye,
  FileText,
  Landmark,
  Loader2,
  PenTool,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { SponsorDocumentPreview } from "@/components/sponsor-document-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeStorageName } from "@/lib/r2/utils";
import {
  getDefaultSponsorDocumentTemplatesConfig,
  getSponsorDocumentTemplatesConfigAction,
  saveSponsorDocumentTemplatesConfigAction,
} from "@/server/sponsor-document-actions";
import type { SponsorDocument, SponsorDocumentTemplatesConfig, SponsorDocumentType } from "@/types/sponsor";

const LOA_TOKEN_CHIPS = [
  { token: "{{eventName}}", label: "Event Name" },
  { token: "{{eventDate}}", label: "Event Date" },
  { token: "{{sponsorTier}}", label: "Sponsor Tier" },
  { token: "{{totalAmount}}", label: "Total Amount" },
  { token: "{{paymentTermDays}}", label: "Payment Terms" },
  { token: "{{companyName}}", label: "Company Name" },
];

const NUMBER_TOKEN_CHIPS = [
  { token: "{{year}}", label: "Year (2026)" },
  { token: "{{month}}", label: "Month (11)" },
  { token: "{{romanMonth}}", label: "Roman Month (XI)" },
  { token: "{{seq}}", label: "Sequence (001)" },
];

export function DocumentTemplatesTab() {
  const [config, setConfig] = useState<SponsorDocumentTemplatesConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<SponsorDocumentTemplatesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [previewType, setPreviewType] = useState<SponsorDocumentType>("loa");
  const signatureFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSignatureUpload = async (file: File) => {
    if (!file || !config) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file format. Please upload a PNG, JPG, or WebP signature image.");
      return;
    }

    setIsUploadingSignature(true);
    try {
      const sanitizedName = sanitizeStorageName(`signature-${Date.now()}-${file.name}`, false);
      const formData = new FormData();
      formData.append("prefix", "community-dashboard/partnership");
      formData.append("files", file, sanitizedName);
      formData.append("file", file, sanitizedName);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? `Upload failed with HTTP status ${res.status}`);
      }

      const data = (await res.json()) as {
        success: boolean;
        items?: Array<{ url: string; key: string; name: string }>;
      };

      const uploadedItem = data.items?.[0];
      if (!uploadedItem?.url) {
        throw new Error("No media URL returned by bucket storage.");
      }

      setConfig({
        ...config,
        organizer_signature_url: uploadedItem.url,
      });

      toast.success("Signature uploaded to bucket storage (community-dashboard/partnership)!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload signature image.");
    } finally {
      setIsUploadingSignature(false);
      if (signatureFileInputRef.current) {
        signatureFileInputRef.current.value = "";
      }
    }
  };

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await getSponsorDocumentTemplatesConfigAction();
      if (res.success && res.config) {
        setConfig(res.config);
        setOriginalConfig(res.config);
      } else {
        const defaults = await getDefaultSponsorDocumentTemplatesConfig();
        setConfig(defaults);
        setOriginalConfig(defaults);
      }
    } catch {
      toast.error("Failed to load document templates configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const isDirty = useMemo(() => {
    if (!config || !originalConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  }, [config, originalConfig]);

  const handleSave = () => {
    if (!config) return;
    startSaveTransition(async () => {
      try {
        const res = await saveSponsorDocumentTemplatesConfigAction(config);
        if (res.success && res.config) {
          setConfig(res.config);
          setOriginalConfig(res.config);
          toast.success("Master document templates saved!");
        } else {
          toast.error(res.error || "Failed to save templates.");
        }
      } catch {
        toast.error("An error occurred while saving templates.");
      }
    });
  };

  const handleDiscard = () => {
    if (originalConfig) {
      setConfig({ ...originalConfig });
      toast.info("Changes discarded.");
    }
  };

  const handleResetDefaults = async () => {
    const defaults = await getDefaultSponsorDocumentTemplatesConfig();
    setConfig(defaults);
    toast.info("Restored default template clauses. Click Save to apply.");
  };

  // Sample document for live A4 preview
  const samplePreviewDocument: SponsorDocument | null = useMemo(() => {
    if (!config) return null;
    const defaultSignerName =
      previewType === "invoice"
        ? config.invoice_signer_name
        : previewType === "quotation"
          ? config.quotation_signer_name
          : previewType === "mou"
            ? config.mou_signer_name || config.loa_signer_name
            : config.loa_signer_name;

    const defaultSignerTitle =
      previewType === "invoice"
        ? config.invoice_signer_title
        : previewType === "quotation"
          ? config.quotation_signer_title
          : previewType === "mou"
            ? config.mou_signer_title || config.loa_signer_title
            : config.loa_signer_title;

    const docNumber =
      previewType === "invoice"
        ? config.invoice_number_pattern
            .replace("{{year}}", "2026")
            .replace("{{month}}", "11")
            .replace("{{romanMonth}}", "XI")
            .replace("{{seq}}", "001")
        : previewType === "quotation"
          ? config.quotation_number_pattern
              .replace("{{year}}", "2026")
              .replace("{{month}}", "11")
              .replace("{{romanMonth}}", "XI")
              .replace("{{seq}}", "001")
          : previewType === "mou"
            ? (config.mou_number_pattern || "{{seq}}/MOU/GDGJKT/{{romanMonth}}/{{year}}")
                .replace("{{year}}", "2026")
                .replace("{{month}}", "11")
                .replace("{{romanMonth}}", "XI")
                .replace("{{seq}}", "001")
            : config.loa_number_pattern
                .replace("{{year}}", "2026")
                .replace("{{month}}", "11")
                .replace("{{romanMonth}}", "XI")
                .replace("{{seq}}", "001");

    return {
      id: "spdoc_sample_preview",
      token: "sample_preview_token",
      doc_type: previewType,
      doc_number: docNumber,
      status: "sent",
      event_id: "devfest-2026",
      event_title: "GDG Jakarta",
      event_date: "Sunday, 1 November 2026",
      event_location: "Auditorium Google Indonesia, Jakarta",
      event_website: "https://gdgjakarta.com",
      sponsor_id: "sps_acme_corp",
      company_name: previewType === "mou" ? "Jakarta JS Community" : "Acme Cloud Corp",
      company_legal_name: previewType === "mou" ? "Jakarta JavaScript User Group" : "PT Acme Teknologi Indonesia",
      company_address: "Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan 12190",
      contact_name: "Budi Santoso",
      contact_title: previewType === "mou" ? "Community Lead" : "Head of Developer Relations",
      contact_email: "budi.santoso@acme.id",
      sponsor_tier: previewType === "mou" ? "community" : "platinum",
      currency: "IDR",
      line_items: [
        {
          id: "item-1",
          description: "DevFest Jakarta 2026 — Platinum Sponsorship Package",
          qty: 1,
          unit_price: 50000000,
          total: 50000000,
        },
      ],
      grand_total: previewType === "mou" ? 0 : 50000000,
      deliverables:
        previewType === "mou"
          ? config.default_tier_deliverables?.community || [
              "Share official event poster and registration link across community social media & group channels",
              "Delegate community members/representatives to attend the event",
              "Include GDG Jakarta logo on mutual community announcements",
            ]
          : config.default_tier_deliverables?.platinum || [
              "Dedicated Session Titling",
              "Speaking Opportunities (the title has to meet our criteria)",
              "Sponsor’s Video Looping (max 2 mins)",
              "Brand Booth Space (3m x 2m)",
              "Brand’s Merchandise Placement",
              "Large Brand Visibility",
            ],
      organizer_commitments: config.default_mou_organizer_commitments?.community || [
        "Logo placement on official event website, digital posters, and stage holding slides as Community Partner",
        "Dedicated Community Partner appreciation post/story on GDG Jakarta official social media channels",
        "Complimentary community passes / priority access allocation for partner representatives",
        "Post-event completion & impact report shared after the event concludes",
      ],
      payment_term_days: config.loa_payment_term_days,
      quotation_validity_note: config.quotation_validity_note,
      invoice_tax_note: config.invoice_tax_note,
      bank_name: config.bank_name,
      bank_account_number: config.bank_account_number,
      bank_account_name: config.bank_account_name,
      bank_swift_code: config.bank_swift_code,
      organizer_signer_name: defaultSignerName,
      organizer_signer_title: defaultSignerTitle,
      organizer_signature_url: config.organizer_signature_url,
      document_date: "01 November 2026",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [config, previewType]);

  if (isLoading || !config) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading document templates configuration...
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Official Sponsor Document Templates (Quotation, LOA, MOU, Invoice)
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure organization details, bank account defaults, signatory names, numbering patterns, and legal
            clauses used across all generated sponsor documents.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleResetDefaults} className="text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Restore Default Clauses
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="text-xs gap-1.5 font-semibold"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Templates
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Settings & Clause Editors (5 cols on XL) */}
        <div className="xl:col-span-5 space-y-6">
          {/* 1. Organization & Banking Defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                Organization &amp; Bank Account Defaults
              </CardTitle>
              <CardDescription className="text-xs">
                Header address, contact info, and beneficiary bank details shown on Invoice and LOA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Organization Name</Label>
                <Input
                  value={config.org_name}
                  onChange={(e) => setConfig({ ...config, org_name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Official Address</Label>
                <Textarea
                  rows={2}
                  value={config.org_address}
                  onChange={(e) => setConfig({ ...config, org_address: e.target.value })}
                  className="text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Official Email</Label>
                  <Input
                    value={config.org_email}
                    onChange={(e) => setConfig({ ...config, org_email: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Official Phone</Label>
                  <Input
                    value={config.org_phone}
                    onChange={(e) => setConfig({ ...config, org_phone: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Bank Name</Label>
                  <Input
                    value={config.bank_name}
                    onChange={(e) => setConfig({ ...config, bank_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Swift Code</Label>
                  <Input
                    value={config.bank_swift_code}
                    onChange={(e) => setConfig({ ...config, bank_swift_code: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bank Account Number</Label>
                  <Input
                    value={config.bank_account_number}
                    onChange={(e) => setConfig({ ...config, bank_account_number: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bank Account Holder Name</Label>
                  <Input
                    value={config.bank_account_name}
                    onChange={(e) => setConfig({ ...config, bank_account_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Signatories & Document Numbering Patterns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <PenTool className="h-4 w-4 text-primary" />
                Signatories &amp; Numbering Patterns
              </CardTitle>
              <CardDescription className="text-xs">
                Default organizer signatories and auto-increment document number patterns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Number tokens helper */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                <span className="text-[11px] font-medium text-muted-foreground">Numbering Tokens:</span>
                {NUMBER_TOKEN_CHIPS.map((t) => (
                  <Badge key={t.token} variant="secondary" className="font-mono text-[10px]">
                    {t.token}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Number Pattern</Label>
                  <Input
                    value={config.invoice_number_pattern}
                    onChange={(e) => setConfig({ ...config, invoice_number_pattern: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="{{year}}/INV/{{seq}}"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quotation Number Pattern</Label>
                  <Input
                    value={config.quotation_number_pattern}
                    onChange={(e) => setConfig({ ...config, quotation_number_pattern: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="{{seq}}/QUO/GDGJKT/{{romanMonth}}/{{year}}"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">LOA Number Pattern</Label>
                  <Input
                    value={config.loa_number_pattern}
                    onChange={(e) => setConfig({ ...config, loa_number_pattern: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="{{seq}}/LOA/GDGJKT/{{romanMonth}}/{{year}}"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MOU Number Pattern</Label>
                  <Input
                    value={config.mou_number_pattern || "{{seq}}/MOU/GDGJKT/{{romanMonth}}/{{year}}"}
                    onChange={(e) => setConfig({ ...config, mou_number_pattern: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="{{seq}}/MOU/GDGJKT/{{romanMonth}}/{{year}}"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Signer Name</Label>
                  <Input
                    value={config.invoice_signer_name}
                    onChange={(e) => setConfig({ ...config, invoice_signer_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Signer Title</Label>
                  <Input
                    value={config.invoice_signer_title}
                    onChange={(e) => setConfig({ ...config, invoice_signer_title: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quotation Signer Name</Label>
                  <Input
                    value={config.quotation_signer_name}
                    onChange={(e) => setConfig({ ...config, quotation_signer_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quotation Signer Title</Label>
                  <Input
                    value={config.quotation_signer_title}
                    onChange={(e) => setConfig({ ...config, quotation_signer_title: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">LOA Signer Name</Label>
                  <Input
                    value={config.loa_signer_name}
                    onChange={(e) => setConfig({ ...config, loa_signer_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">LOA Signer Title</Label>
                  <Input
                    value={config.loa_signer_title}
                    onChange={(e) => setConfig({ ...config, loa_signer_title: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">MOU Signer Name</Label>
                  <Input
                    value={config.mou_signer_name || config.loa_signer_name}
                    onChange={(e) => setConfig({ ...config, mou_signer_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MOU Signer Title</Label>
                  <Input
                    value={config.mou_signer_title || config.loa_signer_title}
                    onChange={(e) => setConfig({ ...config, mou_signer_title: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Organizer Signature Image (Optional)</Label>
                  <span className="text-[10px] font-mono text-muted-foreground">community-dashboard/partnership</span>
                </div>

                <input
                  ref={signatureFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleSignatureUpload(f);
                  }}
                />

                {config.organizer_signature_url ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-24 shrink-0 rounded border border-border bg-white p-1.5 flex items-center justify-center">
                        <img
                          src={config.organizer_signature_url}
                          alt="Organizer Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Signature Image Uploaded</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                          {config.organizer_signature_url}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={isUploadingSignature}
                        onClick={() => signatureFileInputRef.current?.click()}
                      >
                        {isUploadingSignature ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <UploadCloud className="mr-1 h-3.5 w-3.5" />
                            Replace
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Remove Signature"
                        onClick={() => setConfig({ ...config, organizer_signature_url: "" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !isUploadingSignature && signatureFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 cursor-pointer transition-colors bg-card"
                  >
                    {isUploadingSignature ? (
                      <>
                        <Loader2 className="h-6 w-6 text-primary animate-spin mb-1.5" />
                        <p className="text-xs font-medium">Uploading to community-dashboard/partnership...</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-6 w-6 text-muted-foreground mb-1.5" />
                        <p className="text-xs font-medium">Click to upload organizer signature image</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          PNG with transparent background recommended (stored in community-dashboard/partnership)
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3. Document Clauses & Notes Editor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Adjustable Template Clauses &amp; Notes
              </CardTitle>
              <CardDescription className="text-xs">
                Customize legal paragraphs, payment terms, and footnotes per document type.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={previewType} onValueChange={(v) => setPreviewType(v as SponsorDocumentType)}>
                <TabsList className="grid w-full grid-cols-4 h-8">
                  <TabsTrigger value="loa" className="text-xs">
                    LOA
                  </TabsTrigger>
                  <TabsTrigger value="mou" className="text-xs">
                    MOU
                  </TabsTrigger>
                  <TabsTrigger value="quotation" className="text-xs">
                    Quotation
                  </TabsTrigger>
                  <TabsTrigger value="invoice" className="text-xs">
                    Invoice
                  </TabsTrigger>
                </TabsList>

                {/* LOA V2 Clauses */}
                <TabsContent value="loa" className="space-y-3 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                    <span className="text-[11px] font-medium text-muted-foreground mr-1">Available Tokens:</span>
                    {LOA_TOKEN_CHIPS.map((chip) => (
                      <button
                        key={chip.token}
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(chip.token);
                          toast.success(`Copied ${chip.token}`);
                        }}
                        className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:border-primary"
                        title={`Click to copy ${chip.token} (${chip.label})`}
                      >
                        {chip.token}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Introductory Paragraph</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_intro_text}
                      onChange={(e) => setConfig({ ...config, loa_intro_text: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Default Payment Term Window</Label>
                    <Input
                      value={config.loa_payment_term_days}
                      onChange={(e) => setConfig({ ...config, loa_payment_term_days: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="45 days of the invoice date"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 1 (Event &amp; Sponsor Tier)</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_clause_1_text}
                      onChange={(e) => setConfig({ ...config, loa_clause_1_text: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 2 (Sponsorship Amount &amp; Payment Term)</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_clause_2_text}
                      onChange={(e) => setConfig({ ...config, loa_clause_2_text: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 5 (Event Completion Report)</Label>
                    <Input
                      value={config.loa_clause_5_text}
                      onChange={(e) => setConfig({ ...config, loa_clause_5_text: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 6a — Payment Method</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_term_payment_method}
                      onChange={(e) => setConfig({ ...config, loa_term_payment_method: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 6b — Workshop Session</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_term_workshop}
                      onChange={(e) => setConfig({ ...config, loa_term_workshop: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 6c — Term / Duration</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_term_duration}
                      onChange={(e) => setConfig({ ...config, loa_term_duration: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 6d — Termination</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_term_termination}
                      onChange={(e) => setConfig({ ...config, loa_term_termination: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Bottom Disclaimer</Label>
                    <Textarea
                      rows={2}
                      value={config.loa_disclaimer}
                      onChange={(e) => setConfig({ ...config, loa_disclaimer: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </TabsContent>

                {/* MOU Clauses */}
                <TabsContent value="mou" className="space-y-3 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                    <span className="text-[11px] font-medium text-muted-foreground mr-1">Available Tokens:</span>
                    {LOA_TOKEN_CHIPS.map((chip) => (
                      <button
                        key={`mou-${chip.token}`}
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(chip.token);
                          toast.success(`Copied ${chip.token}`);
                        }}
                        className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:border-primary"
                        title={`Click to copy ${chip.token} (${chip.label})`}
                      >
                        {chip.token}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">MOU Introductory Paragraph</Label>
                    <Textarea
                      rows={2}
                      value={config.mou_intro_text || ""}
                      onChange={(e) => setConfig({ ...config, mou_intro_text: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 1 (Purpose &amp; Event Collaboration Scope)</Label>
                    <Textarea
                      rows={2}
                      value={config.mou_clause_1_purpose || ""}
                      onChange={(e) => setConfig({ ...config, mou_clause_1_purpose: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 4 (Brand Assets &amp; Intellectual Property)</Label>
                    <Textarea
                      rows={2}
                      value={config.mou_clause_4_logo_ip || ""}
                      onChange={(e) => setConfig({ ...config, mou_clause_4_logo_ip: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 5 (Effective Term &amp; Validity)</Label>
                    <Textarea
                      rows={2}
                      value={config.mou_clause_5_term || ""}
                      onChange={(e) => setConfig({ ...config, mou_clause_5_term: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Clause 6 (Non-Financial &amp; Mutual Understanding)</Label>
                    <Textarea
                      rows={2}
                      value={config.mou_clause_6_non_financial || ""}
                      onChange={(e) => setConfig({ ...config, mou_clause_6_non_financial: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Bottom Good-Faith Disclaimer</Label>
                    <Textarea
                      rows={2}
                      value={config.mou_disclaimer || ""}
                      onChange={(e) => setConfig({ ...config, mou_disclaimer: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </TabsContent>

                {/* Quotation V1 Clauses */}
                <TabsContent value="quotation" className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quotation Validity Footnote</Label>
                    <Input
                      value={config.quotation_validity_note}
                      onChange={(e) => setConfig({ ...config, quotation_validity_note: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </TabsContent>

                {/* Invoice V2 Clauses */}
                <TabsContent value="invoice" className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Invoice Tax Obligation Note</Label>
                    <Textarea
                      rows={3}
                      value={config.invoice_tax_note}
                      onChange={(e) => setConfig({ ...config, invoice_tax_note: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live A4 Preview (7 cols on XL) */}
        <div className="xl:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Live A4 Document Preview</span>
              <Badge variant="outline" className="text-[10px]">
                Sample Data
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={previewType === "quotation" ? "default" : "outline"}
                onClick={() => setPreviewType("quotation")}
                className="h-7 px-2.5 text-xs"
              >
                Quotation
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewType === "loa" ? "default" : "outline"}
                onClick={() => setPreviewType("loa")}
                className="h-7 px-2.5 text-xs"
              >
                LOA
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewType === "mou" ? "default" : "outline"}
                onClick={() => setPreviewType("mou")}
                className="h-7 px-2.5 text-xs"
              >
                MOU
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewType === "invoice" ? "default" : "outline"}
                onClick={() => setPreviewType("invoice")}
                className="h-7 px-2.5 text-xs"
              >
                Invoice
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-zinc-100/80 dark:bg-zinc-900/50 p-4">
            {samplePreviewDocument && (
              <SponsorDocumentPreview document={samplePreviewDocument} templatesConfig={config} />
            )}
          </div>
        </div>
      </div>

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveLabel="Save Document Templates"
        savingLabel="Saving Templates..."
        discardLabel="Discard"
        unsavedBadgeLabel="Unsaved Template Changes"
        helperText="Changes to master templates apply to newly generated Quotations, LOAs, and Invoices."
      />
    </div>
  );
}
