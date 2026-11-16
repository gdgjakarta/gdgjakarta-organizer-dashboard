"use client";

import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ShortLinkItem } from "@/lib/shortio/types";

export interface AdvancedState {
  password: string;
  cloaking: boolean;
  redirectType: "301" | "302" | "307" | "308";
  expiresAt: string; // yyyy-MM-ddTHH:mm (local) or ""
  expiredURL: string;
  androidURL: string;
  iphoneURL: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}

export const EMPTY_ADVANCED: AdvancedState = {
  password: "",
  cloaking: false,
  redirectType: "301",
  expiresAt: "",
  expiredURL: "",
  androidURL: "",
  iphoneURL: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmTerm: "",
  utmContent: "",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function advancedFromLink(link: ShortLinkItem): AdvancedState {
  let expiresAt = "";
  if (link.expiresAt) {
    const d = new Date(link.expiresAt);
    if (!Number.isNaN(d.getTime())) {
      expiresAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  return {
    ...EMPTY_ADVANCED,
    cloaking: Boolean(link.cloaking),
    redirectType: (["301", "302", "307", "308"].includes(String(link.redirectType))
      ? link.redirectType
      : "301") as AdvancedState["redirectType"],
    expiresAt,
    expiredURL: link.expiredURL ?? "",
    androidURL: link.androidURL ?? "",
    iphoneURL: link.iphoneURL ?? "",
  };
}

const UTM_KEYS = [
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmTerm", "utm_term"],
  ["utmContent", "utm_content"],
] as const;

/** Appends the filled UTM fields to the destination URL (existing params with the same key are replaced). */
export function applyUtm(rawUrl: string, s: AdvancedState): string {
  try {
    const url = new URL(rawUrl);
    for (const [field, param] of UTM_KEYS) {
      const v = s[field].trim();
      if (v) url.searchParams.set(param, v);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/** Create sends only set values; edit also sends `null` to clear expiry/device URLs, but never an empty password. */
export function advancedToInput(s: AdvancedState, isEdit: boolean) {
  const blank = isEdit ? null : undefined;
  return {
    cloaking: s.cloaking,
    redirectType: Number(s.redirectType) as 301 | 302 | 307 | 308,
    password: s.password || undefined,
    expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : blank,
    expiredURL: s.expiredURL.trim() || blank,
    androidURL: s.androidURL.trim() || blank,
    iphoneURL: s.iphoneURL.trim() || blank,
  };
}

interface Props {
  value: AdvancedState;
  onChange: (next: AdvancedState) => void;
  disabled?: boolean;
  hasPassword?: boolean;
}

export function AdvancedOptions({ value, onChange, disabled, hasPassword }: Props) {
  const set = <K extends keyof AdvancedState>(k: K, v: AdvancedState[K]) => onChange({ ...value, [k]: v });
  const field = (k: keyof AdvancedState, label: string, placeholder = "", type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`adv-${k}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`adv-${k}`}
        type={type}
        value={value[k] as string}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </div>
  );

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 font-medium text-sm [&[data-state=open]>svg]:rotate-180">
        Advanced options
        <ChevronDown className="size-4 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-4 border-t p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Redirect type</Label>
            <Select
              value={value.redirectType}
              onValueChange={(v) => set("redirectType", v as AdvancedState["redirectType"])}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="301">301 Permanent</SelectItem>
                <SelectItem value="302">302 Temporary</SelectItem>
                <SelectItem value="307">307 Temporary (keep method)</SelectItem>
                <SelectItem value="308">308 Permanent (keep method)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-2 rounded-md border px-3 py-2">
            <Label htmlFor="adv-cloaking" className="text-xs">
              Link cloaking
            </Label>
            <Switch
              id="adv-cloaking"
              checked={value.cloaking}
              onCheckedChange={(v) => set("cloaking", v)}
              disabled={disabled}
            />
          </div>
        </div>

        {field(
          "password",
          hasPassword ? "Password (leave empty to keep current)" : "Password protection",
          "",
          "password",
        )}

        <div className="grid grid-cols-2 gap-3">
          {field("expiresAt", "Expires at", "", "datetime-local")}
          {field("expiredURL", "Redirect after expiry", "https://...", "url")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field("androidURL", "Android destination", "https://play.google.com/...", "url")}
          {field("iphoneURL", "iOS destination", "https://apps.apple.com/...", "url")}
        </div>

        <div className="grid gap-2">
          <span className="font-medium text-xs">UTM builder</span>
          <div className="grid grid-cols-2 gap-3">
            {field("utmSource", "Source", "newsletter")}
            {field("utmMedium", "Medium", "email")}
            {field("utmCampaign", "Campaign", "devfest26")}
            {field("utmTerm", "Term")}
            {field("utmContent", "Content")}
          </div>
          <p className="text-muted-foreground text-xs">Applied to the destination URL when you save.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
