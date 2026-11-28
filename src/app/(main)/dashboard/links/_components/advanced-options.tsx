"use client";

import * as React from "react";

import { ChevronDown } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ShortlinkProviderName } from "@/lib/shortio/types";

import { type AdvancedState, advancedFromLink, advancedToInput, applyUtm, EMPTY_ADVANCED } from "./link-form-helpers";
import { ProTargetingFields } from "./pro-targeting-fields";

export type { AdvancedState };
export { advancedFromLink, advancedToInput, applyUtm, EMPTY_ADVANCED };

interface Props {
  value: AdvancedState;
  onChange: (next: AdvancedState) => void;
  provider?: ShortlinkProviderName;
  disabled?: boolean;
  hasPassword?: boolean;
}

export function AdvancedOptions({ value, onChange, provider = "shortio", disabled, hasPassword }: Props) {
  const idPrefix = React.useId();
  const set = <K extends keyof AdvancedState>(k: K, v: AdvancedState[K]) => onChange({ ...value, [k]: v });

  const field = (k: keyof AdvancedState, label: string, placeholder = "", type = "text", fieldDisabled = false) => {
    const inputId = `${idPrefix}-adv-${k}`;
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={inputId} className="text-xs">
          {label}
        </Label>
        <Input
          id={inputId}
          type={type}
          value={value[k] as string}
          placeholder={placeholder}
          disabled={disabled || fieldDisabled}
          onChange={(e) => set(k, e.target.value as never)}
        />
      </div>
    );
  };

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 font-medium text-sm [&[data-state=open]>svg]:rotate-180">
        Advanced &amp; Pro options
        <ChevronDown className="size-4 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-4 border-t p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-redirect-type`} className="text-xs">
              Redirect type
            </Label>
            <Select
              value={value.redirectType}
              onValueChange={(v) => set("redirectType", v as AdvancedState["redirectType"])}
              disabled={disabled}
            >
              <SelectTrigger id={`${idPrefix}-redirect-type`}>
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
            <Label htmlFor={`${idPrefix}-cloaking`} className="text-xs">
              Link cloaking
            </Label>
            <Switch
              id={`${idPrefix}-cloaking`}
              checked={value.cloaking}
              onCheckedChange={(v) => set("cloaking", v)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid gap-2">
          {field(
            "password",
            hasPassword ? "Password (leave empty to keep current)" : "Password protection",
            "",
            "password",
            value.clearPassword,
          )}
          {hasPassword && provider === "cloudflare" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-clear-password`}
                checked={value.clearPassword}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    clearPassword: Boolean(checked),
                    ...(checked ? { password: "" } : {}),
                  })
                }
              />
              <Label htmlFor={`${idPrefix}-clear-password`} className="font-normal text-muted-foreground text-xs">
                Remove password protection
              </Label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("expiresAt", "Expires at", "", "datetime-local")}
          {field("expiredURL", "Redirect after expiry", "https://...", "url")}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("androidURL", "Android destination", "https://play.google.com/...", "url")}
          {field("iphoneURL", "iOS destination", "https://apps.apple.com/...", "url")}
        </div>

        <div className="grid gap-2">
          <span className="font-medium text-xs">UTM builder</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("utmSource", "Source", "newsletter")}
            {field("utmMedium", "Medium", "email")}
            {field("utmCampaign", "Campaign", "devfest26")}
            {field("utmTerm", "Term")}
            {field("utmContent", "Content")}
          </div>
          <p className="text-muted-foreground text-xs">
            {provider === "cloudflare"
              ? "Stored cleanly on the edge link and merged dynamically across redirects."
              : "Applied to the destination URL when you save."}
          </p>
        </div>

        <ProTargetingFields value={value} onChange={onChange} provider={provider} disabled={disabled} />
      </CollapsibleContent>
    </Collapsible>
  );
}
