"use client";

import * as React from "react";

import { Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaItem } from "@/lib/r2/types";
import { sanitizeStorageName } from "@/lib/r2/utils";
import { renameMediaObjectAction } from "@/server/media-actions";

interface RenameMediaDialogProps {
  item: MediaItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RenameMediaDialog({ item, isOpen, onOpenChange, onSuccess }: RenameMediaDialogProps) {
  const [newName, setNewName] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    if (item) {
      setNewName(item.name);
    }
  }, [item]);

  const sanitized = React.useMemo(() => {
    return sanitizeStorageName(newName, false);
  }, [newName]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitized) {
      toast.error("File name cannot be empty");
      return;
    }

    if (sanitized === item.name) {
      onOpenChange(false);
      return;
    }

    setIsPending(true);
    try {
      const res = await renameMediaObjectAction(item.key, sanitized);
      if (res.success) {
        toast.success(`File renamed to '${sanitized}'`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Failed to rename file");
      }
    } catch {
      toast.error("Error renaming file");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Rename File
            </DialogTitle>
            <DialogDescription>
              Rename file. The new name will be automatically converted to lowercase and hyphen-separated (-).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">New Name</Label>
              <Input
                id="rename-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                disabled={isPending}
              />
            </div>

            {sanitized && sanitized !== item.name && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <span className="text-muted-foreground">Preview new name: </span>
                <span className="font-medium font-mono text-foreground">{sanitized}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !sanitized || sanitized === item.name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
