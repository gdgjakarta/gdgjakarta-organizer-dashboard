"use client";

import * as React from "react";

import Editor, { type OnMount } from "@monaco-editor/react";
import { BookmarkCheck, Code, Eye, Loader2, MapPin, Printer, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  buildDefaultShippingLabelTemplate,
  buildShippingLabelHtml,
  DEFAULT_SHIPPING_SAMPLE_DATA,
  type ShippingLabelData,
} from "@/lib/printers/shipping-label";

type EditorInstance = Parameters<OnMount>[0];

const SHIPPING_TOKENS = [
  { tag: "[[recipientName]]", label: "Recipient Name" },
  { tag: "[[contactLine]]", label: "WA • Email (1 line)" },
  { tag: "[[whatsappLine]]", label: "WA: Phone" },
  { tag: "[[whatsapp]]", label: "Phone Only" },
  { tag: "[[email]]", label: "Email" },
  { tag: "[[cityLine]]", label: "City (Postal)" },
  { tag: "[[city]]", label: "City" },
  { tag: "[[postalCode]]", label: "Postal Code" },
  { tag: "[[shippingAddress]]", label: "Street Address" },
  { tag: "[[notesLine]]", label: "Note: ..." },
  { tag: "[[itemsSummary]]", label: "Items Pill" },
  { tag: "[[mapsQr]]", label: "Maps QR Block" },
  { tag: "[[courierType]]", label: "Courier" },
  { tag: "[[trackingNumber]]", label: "Tracking #" },
];

interface ShippingLabelEditorTabProps {
  value: string;
  customDefaultHtml?: string;
  onChange: (nextHtml: string) => void;
  onSaveAsDefault: () => Promise<void>;
  isSavingDefault: boolean;
  onTestPrint?: (renderedHtml: string, sampleName: string) => Promise<void>;
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape";
}

export function ShippingLabelEditorTab({
  value,
  customDefaultHtml,
  onChange,
  onSaveAsDefault,
  isSavingDefault,
  onTestPrint,
  widthMm,
  heightMm,
  orientation,
}: ShippingLabelEditorTabProps) {
  const { resolvedTheme } = useTheme();
  const mapsQrToggleId = React.useId();
  const editorRef = React.useRef<EditorInstance | null>(null);
  const [previewWithMapsQr, setPreviewWithMapsQr] = React.useState(true);
  const [isTesting, setIsTesting] = React.useState(false);

  const sampleData = React.useMemo<ShippingLabelData>(
    () => ({
      ...DEFAULT_SHIPPING_SAMPLE_DATA,
      mapsUrl: previewWithMapsQr ? DEFAULT_SHIPPING_SAMPLE_DATA.mapsUrl : "",
    }),
    [previewWithMapsQr],
  );

  const effectiveHtml = value.trim() ? value : buildDefaultShippingLabelTemplate(widthMm, heightMm, orientation);

  const renderedPreviewHtml = React.useMemo(
    () =>
      buildShippingLabelHtml(sampleData, {
        widthMm,
        heightMm,
        orientation,
        templateHtml: effectiveHtml,
      }),
    [sampleData, widthMm, heightMm, orientation, effectiveHtml],
  );

  const handleInsertToken = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) {
      onChange(`${effectiveHtml}\n${tag}`);
      return;
    }
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("insert-shipping-token", [{ range: selection, text: tag, forceMoveMarkers: true }]);
      editor.focus();
    }
  };

  const handleResetToDefault = () => {
    const target = customDefaultHtml?.trim() || buildDefaultShippingLabelTemplate(widthMm, heightMm, orientation);
    onChange(target);
  };

  const handleResetBuiltIn = () => {
    onChange(buildDefaultShippingLabelTemplate(widthMm, heightMm, orientation));
  };

  const handleRunTestPrint = async () => {
    if (!onTestPrint) return;
    setIsTesting(true);
    try {
      await onTestPrint(renderedPreviewHtml, sampleData.recipientName);
    } finally {
      setIsTesting(false);
    }
  };

  // Scale preview frame to fit nicely on screen
  const pxPerMm = 3.7795;
  const rawW = widthMm * pxPerMm;
  const rawH = heightMm * pxPerMm;
  const previewScale = Math.min(2.2, 340 / Math.max(rawW, 1), 240 / Math.max(rawH, 1));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            Shipping Label HTML Template &amp; Live Preview
            {customDefaultHtml?.trim() && (
              <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                Custom Default Saved
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Customize the Merchandise Delivery thermal shipping label layout. Click any token to insert it at the
            cursor, or save your current HTML as the organization default.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={handleResetToDefault}
          >
            <RotateCcw className="size-3.5" />
            {customDefaultHtml?.trim() ? "Reset to Saved Default" : "Reset Default"}
          </Button>

          {customDefaultHtml?.trim() && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground text-xs"
              onClick={handleResetBuiltIn}
            >
              Restore Built-In
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void onSaveAsDefault()}
            disabled={isSavingDefault}
          >
            {isSavingDefault ? <Loader2 className="size-3.5 animate-spin" /> : <BookmarkCheck className="size-3.5" />}
            Save Current as Default
          </Button>

          {onTestPrint && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => void handleRunTestPrint()}
              disabled={isTesting}
            >
              {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
              Test Print Label
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Click-to-Insert Token Bar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 p-2.5">
          <span className="mr-1 font-medium text-[11px] text-muted-foreground">Insert Token:</span>
          {SHIPPING_TOKENS.map((t) => (
            <button
              key={t.tag}
              type="button"
              onClick={() => handleInsertToken(t.tag)}
              className="rounded-md border bg-background px-2 py-0.5 font-mono text-[11px] transition-colors hover:border-primary hover:bg-primary/5"
              title={`Insert ${t.tag} (${t.label})`}
            >
              {t.tag}
            </button>
          ))}
        </div>

        {/* Side-by-Side Editor & Live Preview */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col overflow-hidden rounded-lg border lg:col-span-7">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Code className="size-3.5 text-muted-foreground" />
                Shipping Label HTML / CSS
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {widthMm}×{heightMm}mm ({orientation})
              </span>
            </div>
            <Editor
              height="440px"
              defaultLanguage="html"
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              value={effectiveHtml}
              onChange={(val) => onChange(val ?? "")}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 10, bottom: 10 },
              }}
            />
          </div>

          <div className="flex flex-col overflow-hidden rounded-lg border lg:col-span-5">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Eye className="size-3.5 text-muted-foreground" />
                Live Thermal Preview
              </span>
              <label
                htmlFor={mapsQrToggleId}
                className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <MapPin className="size-3" />
                <span>Maps QR</span>
                <Switch id={mapsQrToggleId} checked={previewWithMapsQr} onCheckedChange={setPreviewWithMapsQr} />
              </label>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 p-6">
              <div
                className="overflow-hidden rounded-md border bg-white shadow-md"
                style={{
                  width: `${Math.round(rawW * previewScale)}px`,
                  height: `${Math.round(rawH * previewScale)}px`,
                }}
              >
                <iframe
                  title="Shipping Label Live Preview"
                  srcDoc={renderedPreviewHtml}
                  style={{
                    width: `${rawW}px`,
                    height: `${rawH}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                    border: "none",
                    pointerEvents: "none",
                  }}
                />
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Toggle <strong>Maps QR</strong> above to preview orders with and without a Google Maps link.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
