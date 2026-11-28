"use client";

import * as React from "react";

import { AlertCircle, Info, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ShortDomain, ShortlinkProviderName } from "@/lib/shortio/types";
import { updateShortDomainConfigAction } from "@/server/shortio-advanced-actions";

import { DEFAULT_AASA_TEMPLATE, DEFAULT_ASSET_LINKS_TEMPLATE, validateWellKnownJson } from "./link-form-helpers";

interface DomainDeepLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: ShortDomain | null;
  provider: ShortlinkProviderName;
  onUpdated: (domain: ShortDomain) => void;
}

export function DomainDeepLinkDialog({ open, onOpenChange, domain, provider, onUpdated }: DomainDeepLinkDialogProps) {
  const [aasa, setAasa] = React.useState("");
  const [assetLinks, setAssetLinks] = React.useState("");
  const [aasaError, setAasaError] = React.useState<string | null>(null);
  const [assetLinksError, setAssetLinksError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const aasaId = React.useId();
  const aasaErrorId = React.useId();
  const assetLinksId = React.useId();
  const assetLinksErrorId = React.useId();

  React.useEffect(() => {
    if (domain) {
      setAasa(domain.appleAppSiteAssociation ?? "");
      setAssetLinks(domain.assetLinks ?? "");
      setAasaError(null);
      setAssetLinksError(null);
      setServerError(null);
    }
  }, [domain]);

  if (!domain) return null;

  const isCloudflare = provider === "cloudflare";

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);

    const aasaCheck = validateWellKnownJson(aasa, "Apple App Site Association");
    const assetCheck = validateWellKnownJson(assetLinks, "Android Asset Links");
    setAasaError(aasaCheck.error ?? null);
    setAssetLinksError(assetCheck.error ?? null);

    if (!aasaCheck.valid || !assetCheck.valid) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateShortDomainConfigAction(domain.id, {
          appleAppSiteAssociation: aasaCheck.value,
          assetLinks: assetCheck.value,
        });

        if (res.success && res.data) {
          toast.success(`Updated mobile deep-link configuration for ${domain.hostname}`);
          onUpdated(res.data);
          onOpenChange(false);
        } else {
          const message = res.error ?? "Failed to update mobile deep-link configuration";
          setServerError(message);
          toast.error(message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update mobile deep-link configuration";
        setServerError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </div>
            <div>
              <DialogTitle>Mobile Deep Linking — {domain.hostname}</DialogTitle>
              <DialogDescription>
                Configure Universal Links and App Links served from <code className="font-mono">/.well-known/</code>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isCloudflare && (
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Cloudflare Edge Required</AlertTitle>
            <AlertDescription>
              Domain deep-link files (<code className="font-mono">apple-app-site-association</code> and{" "}
              <code className="font-mono">assetlinks.json</code>) can only be edited when{" "}
              <code className="font-mono">SHORTLINK_PROVIDER=cloudflare</code>.
            </AlertDescription>
          </Alert>
        )}

        {serverError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSave} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={aasaId} className="text-xs">
                Apple App Site Association (<code className="font-mono">/.well-known/apple-app-site-association</code>)
              </Label>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!isCloudflare || isPending}
                onClick={() => {
                  setAasa(DEFAULT_AASA_TEMPLATE);
                  setAasaError(null);
                }}
              >
                Insert Example Template
              </Button>
            </div>
            <Textarea
              id={aasaId}
              value={aasa}
              onChange={(e) => {
                setAasa(e.target.value);
                if (aasaError) setAasaError(null);
              }}
              onBlur={() => {
                const check = validateWellKnownJson(aasa, "Apple App Site Association");
                setAasaError(check.error ?? null);
              }}
              placeholder='{"applinks": {"apps": [], "details": []}}'
              className="min-h-36 font-mono text-xs"
              aria-invalid={aasaError ? "true" : "false"}
              aria-describedby={aasaError ? aasaErrorId : undefined}
              disabled={!isCloudflare || isPending}
            />
            {aasaError && (
              <p id={aasaErrorId} className="text-destructive text-xs">
                {aasaError}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={assetLinksId} className="text-xs">
                Android Asset Links (<code className="font-mono">/.well-known/assetlinks.json</code>)
              </Label>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!isCloudflare || isPending}
                onClick={() => {
                  setAssetLinks(DEFAULT_ASSET_LINKS_TEMPLATE);
                  setAssetLinksError(null);
                }}
              >
                Insert Example Template
              </Button>
            </div>
            <Textarea
              id={assetLinksId}
              value={assetLinks}
              onChange={(e) => {
                setAssetLinks(e.target.value);
                if (assetLinksError) setAssetLinksError(null);
              }}
              onBlur={() => {
                const check = validateWellKnownJson(assetLinks, "Android Asset Links");
                setAssetLinksError(check.error ?? null);
              }}
              placeholder='[{"relation": ["delegate_permission/common.handle_all_urls"], "target": {...}}]'
              className="min-h-36 font-mono text-xs"
              aria-invalid={assetLinksError ? "true" : "false"}
              aria-describedby={assetLinksError ? assetLinksErrorId : undefined}
              disabled={!isCloudflare || isPending}
            />
            {assetLinksError && (
              <p id={assetLinksErrorId} className="text-destructive text-xs">
                {assetLinksError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isCloudflare || isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Deep Links
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
