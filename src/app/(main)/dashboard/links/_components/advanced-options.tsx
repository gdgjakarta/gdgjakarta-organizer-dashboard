"use client";

import * as React from "react";

import { Check, ChevronDown, Copy, Eye, EyeOff, Wand2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
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

function generateStrongPassword(length = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

export function AdvancedOptions({ value, onChange, provider = "shortio", disabled, hasPassword }: Props) {
  const idPrefix = React.useId();
  const [showPassword, setShowPassword] = React.useState(false);
  const [copiedPassword, setCopiedPassword] = React.useState(false);
  const set = <K extends keyof AdvancedState>(k: K, v: AdvancedState[K]) => onChange({ ...value, [k]: v });

  const handleGeneratePassword = () => {
    const generated = generateStrongPassword();
    setShowPassword(true);
    setCopiedPassword(false);
    onChange({ ...value, password: generated, clearPassword: false });
  };

  const handleCopyPassword = async () => {
    if (!value.password) return;
    await navigator.clipboard.writeText(value.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 1500);
  };

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
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-cloaking`} className="text-xs">
              Link cloaking
            </Label>
            <div className="flex h-8 items-center justify-between gap-3 rounded-md border border-input bg-background px-3 shadow-2xs">
              <span className="truncate text-muted-foreground text-xs">
                {value.cloaking ? "Masked in iframe" : "Direct redirect"}
              </span>
              <Switch
                id={`${idPrefix}-cloaking`}
                size="sm"
                checked={value.cloaking}
                onCheckedChange={(v) => set("cloaking", v)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${idPrefix}-adv-password`} className="text-xs">
                {hasPassword ? "Password (leave empty to keep current)" : "Password protection"}
              </Label>
              <div className="flex items-center gap-1">
                {value.password && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="h-6 gap-1 px-1.5 text-[11px]"
                    disabled={disabled || value.clearPassword}
                    onClick={handleCopyPassword}
                  >
                    {copiedPassword ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copiedPassword ? "Copied" : "Copy"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={disabled || value.clearPassword}
                  onClick={handleGeneratePassword}
                >
                  <Wand2 className="size-3" />
                  Generate
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                id={`${idPrefix}-adv-password`}
                type={showPassword ? "text" : "password"}
                value={value.password}
                placeholder={hasPassword ? "••••••••" : "Enter or generate password"}
                disabled={disabled || value.clearPassword}
                onChange={(e) => set("password", e.target.value)}
                className="pr-9"
              />
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={disabled || value.clearPassword}
                onClick={() => setShowPassword((prev) => !prev)}
                className="-translate-y-1/2 absolute top-1/2 right-1.5 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
          </div>
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
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-adv-expiresAt`} className="text-xs">
              Expires at
            </Label>
            <DatePicker
              id={`${idPrefix}-adv-expiresAt`}
              value={value.expiresAt}
              onChange={(next) => set("expiresAt", next)}
              withTime
              outputFormat="datetime-local"
              clearable
              disabled={disabled}
              placeholder="Pick expiry date & time"
            />
          </div>
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
