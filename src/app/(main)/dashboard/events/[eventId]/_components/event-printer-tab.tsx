"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { LabelHtmlEditorPreview } from "@/app/(main)/dashboard/printers/_components/label-html-editor-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateEventPrinterConfigAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import {
  buildDefaultLabelTemplate,
  DEFAULT_LABEL_TEMPLATE,
  ensureFullLabelHtml,
  syncTemplateDimensions,
} from "@/lib/printers/templates";
import { CLABEL_PAPER_PRESETS, type LabelTemplateData, type PrinterConfig } from "@/lib/printers/types";

interface EventPrinterTabProps {
  event: FirestoreEvent;
  registrations?: FirestoreRegistration[];
}

export function EventPrinterTab({ event, registrations = [] }: EventPrinterTabProps) {
  const [isPending, startTransition] = useTransition();

  // Normalize initial printer configuration from event document
  const initialConfig = useMemo<PrinterConfig>(() => {
    const raw = event.printer_config || {};
    const width = raw.paper_width_mm ?? 50;
    const height = raw.paper_height_mm ?? 30;
    const orientation = raw.orientation ?? "landscape";
    return {
      enabled: raw.enabled ?? true,
      paper_width_mm: width,
      paper_height_mm: height,
      orientation,
      template_html: ensureFullLabelHtml(raw.template_html || DEFAULT_LABEL_TEMPLATE, width, height, orientation),
      auto_print_on_checkin: raw.auto_print_on_checkin ?? true,
      sample_data: raw.sample_data,
    };
  }, [event.printer_config]);

  const [config, setConfig] = useState<PrinterConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<PrinterConfig>(initialConfig);

  useEffect(() => {
    setConfig(initialConfig);
    setSavedConfig(initialConfig);
  }, [initialConfig]);

  // Paper preset matching
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const matched = CLABEL_PAPER_PRESETS.find(
      (p) =>
        (p.widthMm === initialConfig.paper_width_mm && p.heightMm === initialConfig.paper_height_mm) ||
        (p.heightMm === initialConfig.paper_width_mm && p.widthMm === initialConfig.paper_height_mm),
    );
    return matched?.id ?? "clabel-50x30";
  });

  // Extract custom questions from registration form
  const customQuestions = useMemo(() => {
    if (!event.custom_questions || event.custom_questions.length === 0) return [];
    return event.custom_questions.map((q) => ({
      id: q.id,
      label: q.label,
      placeholder: q.placeholder,
    }));
  }, [event.custom_questions]);

  // First sample attendee from actual registrations (if available)
  const firstReg = useMemo(() => {
    return registrations.find((r) => r.status === "approved" || r.status === "paid_and_registered") || registrations[0];
  }, [registrations]);

  // Active sample data combining event details, first real registration answers, and custom overrides
  const activeSampleData = useMemo<LabelTemplateData>(() => {
    const custom = config.sample_data ?? {};
    const eventId = String(event.id);
    const attendeeId = custom.attendeeId ?? firstReg?.bevy_attendee_id ?? firstReg?.id ?? "263443955";
    const ticketCode = custom.ticketCode ?? firstReg?.attendee_code ?? `GDG-${attendeeId}`;

    const regAnswers: Record<string, unknown> = {
      ...(firstReg?.answers || {}),
      ...(custom.answers || {}),
    };

    // Populate question sample keys
    for (const q of customQuestions) {
      if (custom[q.id] !== undefined) {
        regAnswers[q.id] = custom[q.id];
      } else if (regAnswers[q.id] === undefined) {
        regAnswers[q.id] = q.placeholder || `Sample ${q.label}`;
      }
    }

    return {
      name:
        custom.name ??
        firstReg?.member_name ??
        (firstReg?.answers?.full_name as string) ??
        (firstReg?.answers?.Name as string) ??
        "Fachridan Tio",
      email: custom.email ?? firstReg?.member_email ?? "deathravenclaw@gmail.com",
      title: custom.title ?? (firstReg?.answers?.role_or_title as string) ?? "Game Engineer",
      company:
        custom.company ??
        (firstReg?.answers?.company_or_institution as string) ??
        (firstReg?.answers?.company as string) ??
        "Harvest Moon",
      sessionTrack: custom.sessionTrack ?? firstReg?.session_title ?? "Full Session",
      techStack: custom.techStack ?? "Kotlin / Android",
      eventTitle: custom.eventTitle ?? event.title ?? "GDG Jakarta Event",
      eventDate: custom.eventDate ?? event.start_date ?? "Sunday, Nov 01, 2026",
      eventTime: custom.eventTime ?? "09:00 AM - 05:00 PM",
      eventVenue: custom.eventVenue ?? event.venue?.name ?? "Jakarta, Indonesia",
      eventId,
      attendeeId,
      ticketCode,
      attendeeCode: custom.attendeeCode ?? ticketCode,
      qrPayload: `${eventId}:${attendeeId}`,
      checkinTime: custom.checkinTime ?? "09:15",
      answers: regAnswers,
      ...regAnswers,
    };
  }, [config.sample_data, event, firstReg, customQuestions]);

  const handleSampleDataChange = (patch: Partial<LabelTemplateData>) => {
    setConfig((prev) => ({
      ...prev,
      sample_data: {
        ...(prev.sample_data || {}),
        ...patch,
      },
    }));
  };

  const handleResetSampleData = () => {
    setConfig((prev) => ({
      ...prev,
      sample_data: undefined,
    }));
    toast.info("Sample attendee data reset to default.");
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = CLABEL_PAPER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const isPortrait = config.orientation === "portrait";
    const nextWidth = isPortrait ? preset.heightMm : preset.widthMm;
    const nextHeight = isPortrait ? preset.widthMm : preset.heightMm;

    setConfig((prev) => ({
      ...prev,
      paper_width_mm: nextWidth,
      paper_height_mm: nextHeight,
      template_html: syncTemplateDimensions(prev.template_html, nextWidth, nextHeight, prev.orientation),
    }));
  };

  const handleOrientationToggle = (newOrientation: "portrait" | "landscape") => {
    if (newOrientation === config.orientation) return;
    const oldW = config.paper_width_mm;
    const oldH = config.paper_height_mm;
    const nextW = oldH;
    const nextH = oldW;

    setConfig((prev) => ({
      ...prev,
      orientation: newOrientation,
      paper_width_mm: nextW,
      paper_height_mm: nextH,
      template_html: syncTemplateDimensions(prev.template_html, nextW, nextH, newOrientation),
    }));
  };

  const handleDimensionChange = (dimension: "width" | "height", val: number) => {
    const clamped = Math.max(10, Math.min(200, val));
    setConfig((prev) => {
      const nextW = dimension === "width" ? clamped : prev.paper_width_mm;
      const nextH = dimension === "height" ? clamped : prev.paper_height_mm;
      return {
        ...prev,
        paper_width_mm: nextW,
        paper_height_mm: nextH,
        template_html: syncTemplateDimensions(prev.template_html, nextW, nextH, prev.orientation),
      };
    });
  };

  const isDirty = useMemo(() => {
    return (
      config.enabled !== savedConfig.enabled ||
      config.paper_width_mm !== savedConfig.paper_width_mm ||
      config.paper_height_mm !== savedConfig.paper_height_mm ||
      config.orientation !== savedConfig.orientation ||
      config.template_html !== savedConfig.template_html ||
      config.auto_print_on_checkin !== savedConfig.auto_print_on_checkin ||
      JSON.stringify(config.sample_data || {}) !== JSON.stringify(savedConfig.sample_data || {})
    );
  }, [config, savedConfig]);

  const handleDiscard = () => {
    setConfig(savedConfig);
    toast.info("Changes discarded.");
  };

  const handleSave = () => {
    startTransition(async () => {
      const payload: Partial<PrinterConfig> = {
        enabled: config.enabled,
        paper_width_mm: config.paper_width_mm,
        paper_height_mm: config.paper_height_mm,
        orientation: config.orientation,
        template_html: config.template_html,
        auto_print_on_checkin: config.auto_print_on_checkin,
        sample_data: config.sample_data,
        updated_at: new Date().toISOString(),
      };

      const res = await updateEventPrinterConfigAction(String(event.id), payload, event);
      if (res.success) {
        setSavedConfig(config);
        toast.success("Event badge printer template saved successfully.");
      } else {
        toast.error(res.error || "Failed to save event printer settings.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              <CardTitle className="text-xl">Event Badge Printer &amp; Label Template</CardTitle>
              <Badge variant={config.enabled ? "default" : "secondary"}>{config.enabled ? "Active" : "Disabled"}</Badge>
            </div>
            <CardDescription>
              Configure custom thermal badge sticker dimensions, drag &amp; drop answered registration form questions,
              and design layout for attendees checking into <strong>{event.title}</strong>.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const fresh = buildDefaultLabelTemplate(
                  config.paper_width_mm,
                  config.paper_height_mm,
                  config.orientation,
                );
                setConfig((prev) => ({ ...prev, template_html: fresh }));
                toast.info("Reset to default badge template for current dimensions.");
              }}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              Reset Default
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Quick controls row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="font-medium text-xs">Enable Event Printing</Label>
                <p className="text-[11px] text-muted-foreground">Print badges during attendee check-in</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, enabled: val }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="font-medium text-xs">Auto-Print on Check-in</Label>
                <p className="text-[11px] text-muted-foreground">Queue badge automatically on scanner check-in</p>
              </div>
              <Switch
                checked={config.auto_print_on_checkin}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, auto_print_on_checkin: val }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="font-medium text-xs">Form Questions Available</Label>
                <p className="text-[11px] text-muted-foreground">
                  {customQuestions.length > 0
                    ? `${customQuestions.length} answered questions ready to drag & drop`
                    : "No registration form questions found"}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {customQuestions.length}
              </Badge>
            </div>
          </div>

          {/* Paper and Dimensions Card */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Paper Preset</Label>
              <Select value={selectedPreset} onValueChange={handlePresetSelect}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select paper preset" />
                </SelectTrigger>
                <SelectContent>
                  {CLABEL_PAPER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Orientation</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={config.orientation === "landscape" ? "default" : "outline"}
                  onClick={() => handleOrientationToggle("landscape")}
                  className="h-8 flex-1 text-xs"
                >
                  Landscape
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={config.orientation === "portrait" ? "default" : "outline"}
                  onClick={() => handleOrientationToggle("portrait")}
                  className="h-8 flex-1 text-xs"
                >
                  Portrait
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Width (mm)</Label>
                <Input
                  type="number"
                  min={10}
                  max={200}
                  value={config.paper_width_mm}
                  onChange={(e) => handleDimensionChange("width", Number(e.target.value) || 50)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height (mm)</Label>
                <Input
                  type="number"
                  min={10}
                  max={200}
                  value={config.paper_height_mm}
                  onChange={(e) => handleDimensionChange("height", Number(e.target.value) || 30)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side Monaco HTML Editor & Live Preview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Badge Template Editor &amp; Live Preview</CardTitle>
              <CardDescription>
                Customize HTML/CSS, drop tokens including answered form questions (e.g.{" "}
                <code>[[company_or_institution]]</code>, <code>[[role_or_title]]</code>,{" "}
                <code>[[years_of_experience]]</code>), and test live.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LabelHtmlEditorPreview
            value={config.template_html}
            onChange={(nextHtml) => setConfig((prev) => ({ ...prev, template_html: nextHtml }))}
            sampleData={activeSampleData}
            onSampleDataChange={handleSampleDataChange}
            onResetSampleData={handleResetSampleData}
            widthMm={config.paper_width_mm}
            heightMm={config.paper_height_mm}
            orientation={config.orientation}
            customQuestions={customQuestions}
            registrations={registrations}
            eventTitle={event.title}
            eventId={event.id}
          />
        </CardContent>
      </Card>

      {/* Floating Save Bar */}
      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isPending}
        helperText="Unsaved changes to event thermal badge template"
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
