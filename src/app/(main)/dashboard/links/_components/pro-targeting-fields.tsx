"use client";

import * as React from "react";

import { ChevronDown, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BUNDLE_ICON_PRESETS = [
  "🔗",
  "🎟️",
  "📅",
  "📍",
  "🎤",
  "💻",
  "📸",
  "📣",
  "📄",
  "🚀",
  "💬",
  "🎁",
  "🏆",
  "📺",
  "📝",
  "✨",
] as const;

import type { ShortLinkType, ShortlinkProviderName } from "@/lib/shortio/types";

import { type AdvancedState, computeSplitPercentages } from "./link-form-helpers";

interface ProTargetingFieldsProps {
  value: AdvancedState;
  onChange: (next: AdvancedState) => void;
  provider: ShortlinkProviderName;
  disabled?: boolean;
}

export function ProTargetingFields({ value, onChange, provider, disabled }: ProTargetingFieldsProps) {
  const idPrefix = React.useId();

  if (provider !== "cloudflare") {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
        Pro edge features (Click Limit, Country Geo-Targeting, Retargeting Pixels, A/B Split Testing, and Link Bundles)
        are enabled when <code className="font-mono">SHORTLINK_PROVIDER=cloudflare</code>.
      </p>
    );
  }

  const splitPercentages = computeSplitPercentages(value.splitTargets);

  const handleLinkTypeChange = (nextType: ShortLinkType) => {
    const next: AdvancedState = { ...value, linkType: nextType };
    if (nextType === "split" && next.splitTargets.length === 0) {
      next.splitTargets = [
        { label: "Variant A", url: "", weight: 50 },
        { label: "Variant B", url: "", weight: 50 },
      ];
    }
    if (nextType === "bundle" && next.bundleItems.length === 0) {
      next.bundleItems = [{ title: "", url: "", description: "", icon: "" }];
    }
    onChange(next);
  };

  return (
    <div className="grid gap-4 border-t pt-3">
      {/* Link Mode & Click-Limit Expiration */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-link-type`} className="text-xs">
            Link behavior
          </Label>
          <Select
            value={value.linkType}
            onValueChange={(v) => handleLinkTypeChange(v as ShortLinkType)}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-link-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="redirect">Standard Redirect</SelectItem>
              <SelectItem value="split">A/B Split Test</SelectItem>
              <SelectItem value="bundle">Link Bundle Page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-max-clicks`} className="text-xs">
            Click limit (max clicks)
          </Label>
          <Input
            id={`${idPrefix}-max-clicks`}
            type="text"
            inputMode="numeric"
            placeholder="Unlimited"
            value={value.maxClicks}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, maxClicks: e.target.value.replace(/[^\d]/g, "") })}
          />
        </div>
      </div>

      {/* A/B Split Targets */}
      {value.linkType === "split" && (
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-medium text-xs">A/B Split Test Targets</span>
              <p className="text-[11px] text-muted-foreground">
                Weighted sticky traffic routing with per-variant analytics.
              </p>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  splitTargets: [
                    ...value.splitTargets,
                    { label: `Variant ${value.splitTargets.length + 1}`, url: "", weight: 50 },
                  ],
                })
              }
              className="gap-1"
            >
              <Plus className="size-3" />
              Add Target
            </Button>
          </div>

          <div className="grid gap-2">
            {value.splitTargets.map((target, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Controlled split target row edited by index
                key={`split-${index}`}
                className="grid grid-cols-1 gap-2 rounded-md border bg-background p-2 sm:grid-cols-[1fr_1.6fr_96px_auto] sm:items-end"
              >
                <div className="grid gap-1">
                  <Label htmlFor={`${idPrefix}-split-label-${index}`} className="text-[11px]">
                    Label
                  </Label>
                  <Input
                    id={`${idPrefix}-split-label-${index}`}
                    placeholder={`Variant ${index + 1}`}
                    value={target.label}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value.splitTargets];
                      next[index] = { ...target, label: e.target.value };
                      onChange({ ...value, splitTargets: next });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${idPrefix}-split-url-${index}`} className="text-[11px]">
                    Destination URL
                  </Label>
                  <Input
                    id={`${idPrefix}-split-url-${index}`}
                    type="url"
                    placeholder="https://gdgjakarta.com/variant-a"
                    value={target.url}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value.splitTargets];
                      next[index] = { ...target, url: e.target.value };
                      onChange({ ...value, splitTargets: next });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor={`${idPrefix}-split-weight-${index}`} className="text-[11px]">
                      Weight
                    </Label>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {splitPercentages[index] ?? 0}%
                    </Badge>
                  </div>
                  <Input
                    id={`${idPrefix}-split-weight-${index}`}
                    type="number"
                    min={1}
                    step="any"
                    value={String(target.weight)}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value.splitTargets];
                      next[index] = { ...target, weight: Number(e.target.value) || 0 };
                      onChange({ ...value, splitTargets: next });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled || value.splitTargets.length <= 1}
                  aria-label={`Remove split target ${index + 1}`}
                  onClick={() => {
                    const next = value.splitTargets.filter((_, i) => i !== index);
                    onChange({ ...value, splitTargets: next });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link Bundle Items */}
      {value.linkType === "bundle" && (
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-medium text-xs">Link Bundle Items</span>
              <p className="text-[11px] text-muted-foreground">
                Renders a branded GDG Jakarta multi-link page at the edge.
              </p>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  bundleItems: [...value.bundleItems, { title: "", url: "", description: "", icon: "" }],
                })
              }
              className="gap-1"
            >
              <Plus className="size-3" />
              Add Item
            </Button>
          </div>

          <div className="grid gap-2">
            {value.bundleItems.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Controlled bundle item row edited by index
              <div key={`bundle-${index}`} className="grid gap-2 rounded-md border bg-background p-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[72px_1fr_auto] sm:items-end">
                  <div className="grid gap-1">
                    <Label htmlFor={`${idPrefix}-bundle-icon-${index}`} className="text-[11px]">
                      Icon
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id={`${idPrefix}-bundle-icon-${index}`}
                          type="button"
                          variant="outline"
                          disabled={disabled}
                          className="h-8 w-full justify-between px-2 font-normal"
                          aria-label={`Select icon for bundle item ${index + 1}`}
                        >
                          <span className="text-base leading-none">{item.icon || "🔗"}</span>
                          <ChevronDown className="size-3.5 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2.5" align="start">
                        <div className="grid gap-2">
                          <div className="grid grid-cols-8 gap-1">
                            {BUNDLE_ICON_PRESETS.map((emoji) => (
                              <Button
                                key={emoji}
                                type="button"
                                size="icon-xs"
                                variant={item.icon === emoji ? "secondary" : "ghost"}
                                className="h-7 w-7 text-base"
                                onClick={() => {
                                  const next = [...value.bundleItems];
                                  next[index] = { ...item, icon: emoji };
                                  onChange({ ...value, bundleItems: next });
                                }}
                              >
                                {emoji}
                              </Button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 border-t pt-2">
                            <Input
                              placeholder="Custom emoji"
                              value={item.icon ?? ""}
                              maxLength={8}
                              onChange={(e) => {
                                const next = [...value.bundleItems];
                                next[index] = { ...item, icon: e.target.value };
                                onChange({ ...value, bundleItems: next });
                              }}
                              className="h-7 text-xs"
                            />
                            {item.icon && (
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  const next = [...value.bundleItems];
                                  next[index] = { ...item, icon: "" };
                                  onChange({ ...value, bundleItems: next });
                                }}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`${idPrefix}-bundle-title-${index}`} className="text-[11px]">
                      Item Title
                    </Label>
                    <Input
                      id={`${idPrefix}-bundle-title-${index}`}
                      placeholder="Register on Bevy"
                      value={item.title}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = [...value.bundleItems];
                        next[index] = { ...item, title: e.target.value };
                        onChange({ ...value, bundleItems: next });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={disabled || value.bundleItems.length <= 1}
                    aria-label={`Remove bundle item ${index + 1}`}
                    onClick={() => {
                      const next = value.bundleItems.filter((_, i) => i !== index);
                      onChange({ ...value, bundleItems: next });
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label htmlFor={`${idPrefix}-bundle-url-${index}`} className="text-[11px]">
                      URL
                    </Label>
                    <Input
                      id={`${idPrefix}-bundle-url-${index}`}
                      type="url"
                      placeholder="https://gdgjakarta.com/events/..."
                      value={item.url}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = [...value.bundleItems];
                        next[index] = { ...item, url: e.target.value };
                        onChange({ ...value, bundleItems: next });
                      }}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`${idPrefix}-bundle-desc-${index}`} className="text-[11px]">
                      Description (optional)
                    </Label>
                    <Input
                      id={`${idPrefix}-bundle-desc-${index}`}
                      placeholder="Short subtitle"
                      value={item.description ?? ""}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = [...value.bundleItems];
                        next[index] = { ...item, description: e.target.value };
                        onChange({ ...value, bundleItems: next });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Country Geo-Targeting */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-medium text-xs">Country Geo-Targeting</span>
            <p className="text-[11px] text-muted-foreground">Route visitors by 2-letter ISO country code.</p>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...value,
                geoTargets: [...value.geoTargets, { country: "ID", url: "", region: "" }],
              })
            }
            className="gap-1"
          >
            <Plus className="size-3" />
            Add Rule
          </Button>
        </div>

        {value.geoTargets.length > 0 && (
          <div className="grid gap-2">
            {value.geoTargets.map((rule, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Controlled geo rule row edited by index
                key={`geo-${index}`}
                className="grid grid-cols-1 gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-[76px_110px_1fr_auto] sm:items-end"
              >
                <div className="grid gap-1">
                  <Label htmlFor={`${idPrefix}-geo-country-${index}`} className="text-[11px]">
                    Country
                  </Label>
                  <Input
                    id={`${idPrefix}-geo-country-${index}`}
                    maxLength={2}
                    placeholder="ID"
                    value={rule.country}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value.geoTargets];
                      next[index] = { ...rule, country: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") };
                      onChange({ ...value, geoTargets: next });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${idPrefix}-geo-region-${index}`} className="text-[11px]">
                    Region (opt)
                  </Label>
                  <Input
                    id={`${idPrefix}-geo-region-${index}`}
                    placeholder="JK"
                    value={rule.region ?? ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value.geoTargets];
                      next[index] = { ...rule, region: e.target.value };
                      onChange({ ...value, geoTargets: next });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${idPrefix}-geo-url-${index}`} className="text-[11px]">
                    Destination URL
                  </Label>
                  <Input
                    id={`${idPrefix}-geo-url-${index}`}
                    type="url"
                    placeholder="https://gdgjakarta.com/id"
                    value={rule.url}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value.geoTargets];
                      next[index] = { ...rule, url: e.target.value };
                      onChange({ ...value, geoTargets: next });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Remove geo rule ${index + 1}`}
                  onClick={() => {
                    const next = value.geoTargets.filter((_, i) => i !== index);
                    onChange({ ...value, geoTargets: next });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retargeting Pixels */}
      <div className="grid gap-2">
        <span className="font-medium text-xs">Retargeting Pixels</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-meta-pixel`} className="text-xs">
              Meta Pixel ID
            </Label>
            <Input
              id={`${idPrefix}-meta-pixel`}
              placeholder="1234567890"
              value={value.metaPixelId}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, metaPixelId: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-gtm-id`} className="text-xs">
              GTM Container ID
            </Label>
            <Input
              id={`${idPrefix}-gtm-id`}
              placeholder="GTM-XXXXXXX"
              value={value.gtmId}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, gtmId: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-ga4-id`} className="text-xs">
              GA4 Measurement ID
            </Label>
            <Input
              id={`${idPrefix}-ga4-id`}
              placeholder="G-XXXXXXXXXX"
              value={value.ga4Id}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, ga4Id: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
