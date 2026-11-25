"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  Award,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldBan,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildCertificateVerifyUrl,
  buildDefaultOverlayFields,
  CERTIFICATE_PLACEHOLDERS,
  extractGoogleFileId,
  formatCertificateDate,
  isEventWrappedUpForCertificates,
  isRegistrationEligibleForAttendanceCertificate,
} from "@/lib/events/certificate-utils";
import type {
  CertificateEngine,
  CertificateType,
  CertificateVerificationBadgePosition,
  EventCertificateConfig,
  EventCertificateRecord,
  EventCertificateTemplateConfig,
  FirestoreEvent,
  FirestoreRegistration,
} from "@/lib/firestore/types";
import {
  getEventCertificatesAction,
  revokeOrRegenerateCertificateAction,
  saveEventCertificateConfigAction,
  syncDrawingBackgroundAction,
  testGenerateCertificatePreviewAction,
  triggerEventWrapUpCertificateReleaseAction,
} from "@/server/certificate-actions";

import { CertificateOverlayEditor } from "./certificate-overlay-editor";

function createDefaultTemplateConfig(type: CertificateType): EventCertificateTemplateConfig {
  return {
    enabled: false,
    engine: "google_slides",
    template_url: "",
    template_file_id: null,
    temp_folder_id: "",
    overlay_fields: buildDefaultOverlayFields(type),
    background_pdf_url: null,
    background_synced_at: null,
    verification_badge_position: "bottom-right",
  };
}

function normalizeConfigState(event: FirestoreEvent): EventCertificateConfig {
  const existing = event.certificate_config;
  const endMs = event.end_date ? Date.parse(event.end_date) : Number.NaN;
  return {
    attendance: {
      ...createDefaultTemplateConfig("attendance"),
      ...(existing?.attendance ?? {}),
      release_mode: existing?.attendance?.release_mode ?? "auto_on_event_end",
      release_at_millis: existing?.attendance?.release_at_millis ?? (Number.isFinite(endMs) ? Math.floor(endMs) : null),
      released_at: existing?.attendance?.released_at ?? null,
      paused: Boolean(existing?.attendance?.paused),
    },
    speaker: {
      ...createDefaultTemplateConfig("speaker"),
      ...(existing?.speaker ?? {}),
    },
    updated_at: existing?.updated_at,
  };
}

interface CertificatesTabProps {
  event: FirestoreEvent;
  registrations: FirestoreRegistration[];
}

export function CertificatesTab({ event, registrations }: CertificatesTabProps) {
  const [config, setConfig] = useState<EventCertificateConfig>(() => normalizeConfigState(event));
  const [savedConfig, setSavedConfig] = useState<EventCertificateConfig>(() => normalizeConfigState(event));
  const [activeSubTab, setActiveSubTab] = useState<CertificateType>("attendance");
  const [isSaving, startSaving] = useTransition();
  const [isSyncingDrawing, setIsSyncingDrawing] = useState(false);
  const [isTestingPreview, setIsTestingPreview] = useState(false);
  const [sampleName, setSampleName] = useState("Veronica Putri A.");
  const [samplePreviews, setSamplePreviews] = useState<
    Record<CertificateType, { url: string; fileName: string } | null>
  >({
    attendance: null,
    speaker: null,
  });
  const [isUpdatingRelease, setIsUpdatingRelease] = useState(false);

  const [certificates, setCertificates] = useState<EventCertificateRecord[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = useState(true);
  const [certSearch, setCertSearch] = useState("");
  const [certTypeFilter, setCertTypeFilter] = useState<"all" | CertificateType>("all");
  const [mutatingCertId, setMutatingCertId] = useState<string | null>(null);

  const isDirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);

  const checkedInCount = useMemo(
    () => registrations.filter((r) => isRegistrationEligibleForAttendanceCertificate(r)).length,
    [registrations],
  );

  const isUnlocked = useMemo(
    () => isEventWrappedUpForCertificates({ ...event, certificate_config: config }),
    [event, config],
  );

  const loadCertificates = useCallback(async () => {
    setIsLoadingCerts(true);
    try {
      const res = await getEventCertificatesAction(event.id);
      if (res.success && res.certificates) {
        setCertificates(res.certificates);
      }
    } finally {
      setIsLoadingCerts(false);
    }
  }, [event.id]);

  useEffect(() => {
    void loadCertificates();
  }, [loadCertificates]);

  const updateTemplate = (type: CertificateType, patch: Partial<EventCertificateTemplateConfig>) => {
    setConfig((prev) => {
      if (type === "attendance") {
        return {
          ...prev,
          attendance: {
            ...createDefaultTemplateConfig("attendance"),
            ...(prev.attendance ?? {}),
            ...patch,
          },
        };
      }
      return {
        ...prev,
        speaker: {
          ...createDefaultTemplateConfig("speaker"),
          ...(prev.speaker ?? {}),
          ...patch,
        },
      };
    });
  };

  const handleTemplateUrlChange = (type: CertificateType, url: string) => {
    const parsed = extractGoogleFileId(url);
    const patch: Partial<EventCertificateTemplateConfig> = {
      template_url: url,
      template_file_id: parsed?.fileId || null,
    };
    if (parsed?.detectedEngine) {
      patch.engine = parsed.detectedEngine;
    }
    updateTemplate(type, patch);
  };

  const handleSave = () => {
    startSaving(async () => {
      const res = await saveEventCertificateConfigAction(event.id, config);
      if (!res.success || !res.config) {
        toast.error(res.error || "Failed to save certificate settings.");
        return;
      }
      setConfig(res.config);
      setSavedConfig(res.config);
      toast.success("Certificate settings saved!");
    });
  };

  const handleReleaseAction = async (action: "release" | "pause" | "resume") => {
    setIsUpdatingRelease(true);
    try {
      const res = await triggerEventWrapUpCertificateReleaseAction(event.id, action);
      if (!res.success || !res.config) {
        toast.error(res.error || "Failed to update release status.");
        return;
      }
      setConfig(res.config);
      setSavedConfig(res.config);
      toast.success(
        action === "release"
          ? "Attendance certificates released! Checked-in attendees can now claim them."
          : action === "pause"
            ? "Attendance certificate release paused."
            : "Attendance certificate release resumed.",
      );
    } finally {
      setIsUpdatingRelease(false);
    }
  };

  const handleSyncDrawing = async (type: CertificateType) => {
    const tpl = type === "attendance" ? config.attendance : config.speaker;
    if (!tpl?.template_url) {
      toast.error("Paste a Google Drawing URL first.");
      return;
    }
    setIsSyncingDrawing(true);
    try {
      const res = await syncDrawingBackgroundAction(event.id, type, tpl.template_url);
      if (!res.success || !res.backgroundPdfUrl) {
        toast.error(res.error || "Failed to sync Google Drawing background.");
        return;
      }
      updateTemplate(type, {
        background_pdf_url: res.backgroundPdfUrl,
        background_pdf_key: res.backgroundPdfKey || null,
        background_synced_at: new Date().toISOString(),
      });
      toast.success("Google Drawing background synced to R2! Remember to save your changes.");
    } finally {
      setIsSyncingDrawing(false);
    }
  };

  const handleTestPreview = async (type: CertificateType) => {
    const tpl = type === "attendance" ? config.attendance : config.speaker;
    if (!tpl) return;
    setIsTestingPreview(true);
    try {
      const res = await testGenerateCertificatePreviewAction({
        eventId: event.id,
        type,
        templateCfg: tpl,
        sampleName: sampleName.trim() || "Veronica Putri A.",
      });
      if (!res.success || !res.pdfBase64) {
        toast.error(res.error || "Failed to generate preview.");
        return;
      }
      const bytes = Uint8Array.from(atob(res.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      setSamplePreviews((prev) => {
        if (prev[type]?.url) {
          URL.revokeObjectURL(prev[type]!.url);
        }
        return {
          ...prev,
          [type]: {
            url: blobUrl,
            fileName: res.fileName || `sample-${type}-certificate.pdf`,
          },
        };
      });
      toast.success("Sample certificate preview generated!");
    } finally {
      setIsTestingPreview(false);
    }
  };

  const clearSamplePreview = (type: CertificateType) => {
    setSamplePreviews((prev) => {
      if (prev[type]?.url) {
        URL.revokeObjectURL(prev[type]!.url);
      }
      return { ...prev, [type]: null };
    });
  };

  const handleCertMutation = async (certId: string, mode: "revoke" | "regenerate") => {
    setMutatingCertId(certId);
    try {
      const res = await revokeOrRegenerateCertificateAction(event.id, certId, mode);
      if (!res.success || !res.certificate) {
        toast.error(res.error || `Failed to ${mode} certificate.`);
        return;
      }
      setCertificates((prev) => prev.map((c) => (c.id === certId ? res.certificate! : c)));
      toast.success(mode === "revoke" ? "Certificate revoked." : "Certificate regenerated!");
    } finally {
      setMutatingCertId(null);
    }
  };

  const filteredCertificates = useMemo(() => {
    const q = certSearch.trim().toLowerCase();
    return certificates.filter((c) => {
      if (certTypeFilter !== "all" && c.certificate_type !== certTypeFilter) return false;
      if (!q) return true;
      return (
        c.recipient_name.toLowerCase().includes(q) ||
        (c.recipient_email || "").toLowerCase().includes(q) ||
        (c.certificate_code || "").toLowerCase().includes(q)
      );
    });
  }, [certificates, certSearch, certTypeFilter]);

  const renderTemplatePanel = (type: CertificateType) => {
    const tpl = (type === "attendance" ? config.attendance : config.speaker) ?? createDefaultTemplateConfig(type);
    const isSlides = tpl.engine === "google_slides";
    const hasCustomTemplate = Boolean(tpl.template_file_id || tpl.background_pdf_url);
    const showVerificationBadge = Boolean(tpl.show_verification_badge ?? !hasCustomTemplate);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">
              Enable {type === "attendance" ? "Attendance Certificate" : "Speaker Appreciation Certificate"}
            </p>
            <p className="text-xs text-muted-foreground">
              {type === "attendance"
                ? "Checked-in attendees can lazily generate, download, and copy their verified link once wrapped up."
                : "Organizers can generate and email Certificates of Appreciation individually or in bulk from the Speakers tab."}
            </p>
          </div>
          <Switch
            checked={Boolean(tpl.enabled)}
            onCheckedChange={(checked) => updateTemplate(type, { enabled: checked })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Template Engine</Label>
            <Select value={tpl.engine} onValueChange={(v) => updateTemplate(type, { engine: v as CertificateEngine })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_slides">Google Slides (Recommended)</SelectItem>
                <SelectItem value="google_drawing">Google Drawing Background + PDF Overlay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "attendance" && (
            <div className="space-y-1.5">
              <Label>Wrap-Up Release Mode</Label>
              <Select
                value={config.attendance?.release_mode ?? "auto_on_event_end"}
                onValueChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    attendance: {
                      ...createDefaultTemplateConfig("attendance"),
                      ...(prev.attendance ?? {}),
                      release_mode: v as "auto_on_event_end" | "manual_release",
                    },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_on_event_end">Auto-unlock after event ends (with manual override)</SelectItem>
                  <SelectItem value="manual_release">Manual release only (organizer clicks Wrap Up)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              {isSlides ? "Google Slides Template URL (or File ID)" : "Google Drawing Template URL (or File ID)"}
            </Label>
            <Input
              placeholder={
                isSlides
                  ? "https://docs.google.com/presentation/d/.../edit"
                  : "https://docs.google.com/drawings/d/.../edit"
              }
              value={tpl.template_url || ""}
              onChange={(e) => handleTemplateUrlChange(type, e.target.value)}
            />
            {tpl.template_file_id ? (
              <p className="font-mono text-[11px] text-muted-foreground">File ID: {tpl.template_file_id}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Leave blank to use the built-in general GDG Jakarta certificate design (works for all events with zero
                setup).
              </p>
            )}
          </div>

          {isSlides && (
            <div className="space-y-1.5">
              <Label>Optional Drive Temp Folder ID</Label>
              <Input
                placeholder="Leave blank to copy in same folder"
                value={tpl.temp_folder_id || ""}
                onChange={(e) => updateTemplate(type, { temp_folder_id: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Set a writable Drive folder ID if the template is inside a read-only Shared Drive.
              </p>
            </div>
          )}
        </div>

        {isSlides ? (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium">Supported Google Slides Placeholders (click to copy)</p>
            <div className="flex flex-wrap gap-1.5">
              {CERTIFICATE_PLACEHOLDERS.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer font-mono text-[11px]"
                  onClick={() => {
                    void navigator.clipboard.writeText(tag);
                    toast.success(`Copied ${tag}`);
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {tpl.background_synced_at
                  ? `Background synced: ${formatCertificateDate(tpl.background_synced_at)}`
                  : "Not synced yet. Click Sync Drawing Background to export your Drawing PDF to R2."}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSyncDrawing(type)}
                disabled={isSyncingDrawing || !tpl.template_url}
              >
                {isSyncingDrawing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                Sync Drawing Background
              </Button>
            </div>

            <CertificateOverlayEditor
              type={type}
              backgroundPdfUrl={tpl.background_pdf_url}
              fields={tpl.overlay_fields ?? buildDefaultOverlayFields(type)}
              onChange={(fields) => updateTemplate(type, { overlay_fields: fields })}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Stamp Verification Badge &amp; QR Code</p>
            <p className="text-xs text-muted-foreground">
              Adds the X.509 PKCS#7 Digitally Signed badge and per-recipient Scan to Verify QR code onto the generated
              PDF.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {showVerificationBadge && hasCustomTemplate && (
              <Select
                value={tpl.verification_badge_position ?? "bottom-right"}
                onValueChange={(v) =>
                  updateTemplate(type, { verification_badge_position: v as CertificateVerificationBadgePosition })
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Switch
              checked={showVerificationBadge}
              onCheckedChange={(checked) => updateTemplate(type, { show_verification_badge: checked })}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Sample Recipient Name (for Preview)</Label>
              <Input
                className="h-8 max-w-sm text-xs"
                placeholder="Veronica Putri A."
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTestPreview(type)}
              disabled={isTestingPreview}
            >
              {isTestingPreview ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Eye className="mr-1.5 size-4" />
              )}
              {samplePreviews[type] ? "Refresh Sample Preview" : "Generate Sample Preview"}
            </Button>
          </div>

          {samplePreviews[type] && (
            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Generated Sample Preview ({samplePreviews[type]?.fileName})
                </p>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <a href={samplePreviews[type]!.url} download={samplePreviews[type]!.fileName}>
                      <Download className="mr-1.5 size-3.5" />
                      Download
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <a href={samplePreviews[type]!.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 size-3.5" />
                      Open Tab
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => clearSamplePreview(type)}
                  >
                    Hide
                  </Button>
                </div>
              </div>
              <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-md border bg-background">
                <iframe
                  src={`${samplePreviews[type]!.url}#view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
                  title={`Sample ${type} certificate preview`}
                  className="aspect-[4/3] w-full border-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Wrap-Up Status & Override Card */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="size-5 text-primary" />
                Event Certificates &amp; Wrap-Up Release
              </CardTitle>
              <Badge variant={isUnlocked ? "default" : config.attendance?.paused ? "destructive" : "secondary"}>
                {config.attendance?.paused
                  ? "Paused"
                  : isUnlocked
                    ? "Unlocked for Checked-In Attendees"
                    : "Locked Until Wrap-Up"}
              </Badge>
            </div>
            <CardDescription>
              {checkedInCount} checked-in attendees eligible &bull; {certificates.length} certificates issued so far
              (lazy on-demand generation cached in Cloudflare R2).
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isUnlocked && (
              <Button size="sm" onClick={() => void handleReleaseAction("release")} disabled={isUpdatingRelease}>
                {isUpdatingRelease ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 size-4" />
                )}
                Wrap Up &amp; Release Now
              </Button>
            )}
            {config.attendance?.paused ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleReleaseAction("resume")}
                disabled={isUpdatingRelease}
              >
                <Play className="mr-1.5 size-4" />
                Resume Release
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleReleaseAction("pause")}
                disabled={isUpdatingRelease}
              >
                <Pause className="mr-1.5 size-4" />
                Pause Release
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Template Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificate Templates</CardTitle>
          <CardDescription>
            Configure separate templates for Attendance Certificates and Speaker Appreciation Certificates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as CertificateType)}>
            <TabsList className="mb-4">
              <TabsTrigger value="attendance">Attendance Certificate</TabsTrigger>
              <TabsTrigger value="speaker">Speaker Appreciation Certificate</TabsTrigger>
            </TabsList>
            <TabsContent value="attendance">{renderTemplatePanel("attendance")}</TabsContent>
            <TabsContent value="speaker">{renderTemplatePanel("speaker")}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Issued Certificates Audit Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Issued Certificates ({filteredCertificates.length})</CardTitle>
            <CardDescription>
              Audit, download, copy verification links, regenerate, or revoke issued PDFs.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 w-48 pl-8 text-xs"
                placeholder="Search name, email, ID..."
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
              />
            </div>
            <Select value={certTypeFilter} onValueChange={(v) => setCertTypeFilter(v as "all" | CertificateType)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="attendance">Attendance</SelectItem>
                <SelectItem value="speaker">Speaker</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" onClick={() => void loadCertificates()}>
              <RefreshCw className={`size-3.5 ${isLoadingCerts ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCerts ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading certificates...
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No certificates issued yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCertificates.map((cert) => {
                    const verifyUrl = buildCertificateVerifyUrl(cert.token);
                    const isMutating = mutatingCertId === cert.id;
                    return (
                      <TableRow key={cert.id}>
                        <TableCell>
                          <div className="font-medium">{cert.recipient_name}</div>
                          <div className="text-xs text-muted-foreground">{cert.recipient_email}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {cert.certificate_code || cert.token}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {cert.certificate_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={cert.status === "revoked" ? "destructive" : "default"}>
                              {cert.status === "revoked" ? "Revoked" : "Active"}
                            </Badge>
                            {cert.email_status === "sent" && (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="size-3" />
                                Emailed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatCertificateDate(cert.issued_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              asChild
                              title="Open verification page"
                            >
                              <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-3.5" />
                              </a>
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" asChild title="Download PDF">
                              <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer" download>
                                <Download className="size-3.5" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title="Copy verification link"
                              onClick={() => {
                                void navigator.clipboard.writeText(verifyUrl);
                                toast.success("Verification link copied!");
                              }}
                            >
                              <Copy className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title="Regenerate PDF"
                              disabled={isMutating}
                              onClick={() => void handleCertMutation(cert.id, "regenerate")}
                            >
                              <RefreshCw className={`size-3.5 ${isMutating ? "animate-spin" : ""}`} />
                            </Button>
                            {cert.status !== "revoked" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive"
                                title="Revoke certificate"
                                disabled={isMutating}
                                onClick={() => void handleCertMutation(cert.id, "revoke")}
                              >
                                <ShieldBan className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={() => setConfig(savedConfig)}
        saveLabel="Save Certificate Settings"
      />
    </div>
  );
}
