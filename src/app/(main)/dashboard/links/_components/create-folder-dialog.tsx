"use client";

import * as React from "react";

import { FolderPlus, Loader2 } from "lucide-react";
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
import type { ShortFolder } from "@/lib/shortio/types";
import { createShortFolderAction } from "@/server/shortio-actions";

import { COLOR_PALETTE } from "./data";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderCreated: (folder: ShortFolder) => void;
}

export function CreateFolderDialog({ open, onOpenChange, onFolderCreated }: CreateFolderDialogProps) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#0693E3");
  const [isPending, startTransition] = React.useTransition();

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a folder name");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createShortFolderAction({
          name: trimmedName,
          color,
        });

        if (res.success && res.data) {
          toast.success(`Folder "${trimmedName}" created successfully!`);
          onFolderCreated(res.data);
          setName("");
          setColor("#0693E3");
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to create folder");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error creating folder");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <DialogTitle>New Category Folder</DialogTitle>
              <DialogDescription>Group and organize your shortened links.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="e.g. Workshops, Cloud Community"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Folder Color Accent</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-7 rounded-full border transition-all ${
                    color === c ? "scale-110 ring-2 ring-primary ring-offset-2" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs">Custom Hex:</span>
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-28 font-mono text-xs"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
