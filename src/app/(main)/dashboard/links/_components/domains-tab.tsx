"use client";

import * as React from "react";

import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SHORTIO_CONFIG } from "@/config/shortio-config";
import type { ShortDomain } from "@/lib/shortio/types";
import {
  createShortDomainAction,
  deleteShortDomainAction,
  listShortDomainsAction,
} from "@/server/shortio-advanced-actions";

export function DomainsTab() {
  const [domains, setDomains] = React.useState<ShortDomain[] | null>(null);
  const [hostname, setHostname] = React.useState("");
  const [deleting, setDeleting] = React.useState<ShortDomain | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    const res = await listShortDomainsAction();
    if (res.success && res.data) setDomains(res.data);
    else {
      setDomains([]);
      toast.error(res.error ?? "Failed to load domains");
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = () =>
    startTransition(async () => {
      const res = await createShortDomainAction(hostname);
      if (!res.success) return void toast.error(res.error ?? "Failed to add domain");
      toast.success("Domain added. Point its DNS to Short.io, then verify it in the Short.io dashboard.");
      setHostname("");
      await refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!deleting) return;
      const res = await deleteShortDomainAction(deleting.id);
      if (!res.success) return void toast.error(res.error ?? "Failed to remove domain");
      toast.success(`Removed ${deleting.hostname}`);
      setDeleting(null);
      setConfirmText("");
      await refresh();
    });

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Input
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="links.example.com"
          aria-label="New domain hostname"
          className="max-w-sm"
          disabled={isPending}
        />
        <Button onClick={add} disabled={isPending || !hostname.trim()} className="gap-1.5">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add domain
        </Button>
      </div>

      {domains === null && <Skeleton className="h-24 w-full" />}
      {domains?.length === 0 && <p className="text-muted-foreground text-sm">No domains found.</p>}
      <div className="grid gap-2">
        {domains?.map((d) => (
          <Card key={d.id} className="flex-row items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <span className="font-mono text-sm">{d.hostname}</span>
              <Badge variant={d.state === "configured" ? "secondary" : "outline"} className="text-[10px]">
                {d.state.replace(/_/g, " ")}
              </Badge>
              {d.id === SHORTIO_CONFIG.domainId && <Badge className="text-[10px]">Primary</Badge>}
            </div>
            {d.id !== SHORTIO_CONFIG.domainId && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${d.hostname}`}
                onClick={() => setDeleting(d)}
                className="text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </Card>
        ))}
      </div>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && (setDeleting(null), setConfirmText(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.hostname}?</AlertDialogTitle>
            <AlertDialogDescription>
              All links on this domain will stop working. Type the hostname to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Confirm hostname" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={isPending || confirmText !== deleting?.hostname}
            >
              Remove domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
