"use client";

import * as React from "react";

import { AlertTriangle, Globe, Loader2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ShortLinkItem } from "@/lib/shortio/types";
import { bulkDeleteShortLinksAction } from "@/server/shortio-actions";

interface BulkDeleteLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: ShortLinkItem[];
  onLinksDeleted: (deletedIds: string[]) => void;
}

export function BulkDeleteLinksDialog({ open, onOpenChange, links, onLinksDeleted }: BulkDeleteLinksDialogProps) {
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    if (links.length === 0) return;

    startTransition(async () => {
      try {
        const linkIds = links.map((l) => l.id);
        const res = await bulkDeleteShortLinksAction(linkIds);

        if (res.success && res.deletedIds.length > 0) {
          toast.success(`Successfully deleted ${res.deletedCount} short link${res.deletedCount === 1 ? "" : "s"}`);
          if (res.error) {
            toast.warning(res.error);
          }
          onLinksDeleted(res.deletedIds);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to delete selected short links");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error deleting short links");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[460px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <div className="flex size-8 items-center justify-center rounded-md bg-destructive/10">
              <AlertTriangle className="size-4" />
            </div>
            <AlertDialogTitle>Delete Short Links</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Are you sure you want to delete <span className="font-semibold text-foreground">{links.length}</span> short
            link{links.length === 1 ? "" : "s"}? Anyone visiting these links will receive a 404 error. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 py-2">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Links to be deleted ({links.length})
          </span>
          <ScrollArea className="max-h-40 rounded-md border bg-muted/20 p-2.5">
            <div className="divide-y divide-border/40">
              {links.map((link) => (
                <div key={link.id} className="flex min-w-0 flex-col gap-0.5 py-1.5 first:pt-0 last:pb-0">
                  <span className="truncate font-medium font-mono text-foreground text-xs">{link.shortURL}</span>
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Globe className="size-3 shrink-0 opacity-60" />
                    <span className="truncate">{link.originalURL}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending || links.length === 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Delete {links.length} Link{links.length === 1 ? "" : "s"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
