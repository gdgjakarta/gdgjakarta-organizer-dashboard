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
import { sanitizeStorageName } from "@/lib/r2/utils";
import { createMediaFolderAction } from "@/server/media-actions";

interface CreateFolderDialogProps {
  currentPrefix: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateFolderDialog({ currentPrefix, isOpen, onOpenChange, onSuccess }: CreateFolderDialogProps) {
  const [folderName, setFolderName] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  const formattedName = React.useMemo(() => {
    return sanitizeStorageName(folderName, true);
  }, [folderName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formattedName) {
      toast.error("Folder name cannot be empty");
      return;
    }

    setIsPending(true);
    try {
      const res = await createMediaFolderAction(currentPrefix, formattedName);
      if (res.success) {
        toast.success(`Folder '${formattedName}' created successfully`);
        setFolderName("");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Failed to create folder");
      }
    } catch {
      toast.error("Error creating folder");
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
              <FolderPlus className="h-5 w-5 text-primary" />
              Create New Folder
            </DialogTitle>
            <DialogDescription>
              Create a new directory inside{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {currentPrefix ? `/${currentPrefix}` : "/ (Root)"}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. devfest-2024 or sponsors"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                autoFocus
                disabled={isPending}
              />
              <p className="text-muted-foreground text-xs">
                Folder name is automatically converted to lowercase and hyphen-separated (-).
              </p>
            </div>

            {folderName.trim() && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <span className="text-muted-foreground">Target path: </span>
                <span className="font-medium font-mono text-foreground">
                  {currentPrefix}
                  {formattedName}/
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !formattedName}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
