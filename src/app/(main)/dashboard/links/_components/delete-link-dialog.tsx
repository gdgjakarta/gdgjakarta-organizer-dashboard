"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
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
import type { ShortLinkItem } from "@/lib/shortio/types";
import { deleteShortLinkAction } from "@/server/shortio-actions";

interface DeleteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: ShortLinkItem | null;
  onLinkDeleted: (linkId: string) => void;
}

export function DeleteLinkDialog({ open, onOpenChange, link, onLinkDeleted }: DeleteLinkDialogProps) {
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    if (!link) return;

    startTransition(async () => {
      try {
        const res = await deleteShortLinkAction(link.id);
        if (res.success) {
          toast.success("Short link deleted successfully");
          onLinkDeleted(link.id);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to delete short link");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error deleting short link");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Short Link</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <span className="font-semibold text-foreground">{link?.shortURL}</span>?
            Anyone visiting this link will receive a 404 error. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
