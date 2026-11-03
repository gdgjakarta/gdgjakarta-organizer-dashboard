"use client";

import * as React from "react";

import { Loader2, Trash2 } from "lucide-react";
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
import type { BevyChapterTeamMember } from "@/lib/bevy/types";
import { deleteBevyChapterTeamMemberAction } from "@/server/bevy-actions";

interface DeleteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: BevyChapterTeamMember | null;
  onSuccess?: () => void;
}

export function DeleteTeamMemberDialog({ open, onOpenChange, member, onSuccess }: DeleteTeamMemberDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const memberName =
    member?.user?.full_name?.trim() ||
    `${member?.user?.first_name || ""} ${member?.user?.last_name || ""}`.trim() ||
    member?.user?.email ||
    "this member";

  const handleDelete = async () => {
    if (!member?.id) return;

    setIsDeleting(true);
    try {
      const res = await deleteBevyChapterTeamMemberAction(member.id);
      if (res.success) {
        toast.success(`Removed ${memberName} from the chapter team.`);
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(res.error || "Failed to remove team member.");
      }
    } catch {
      toast.error("An error occurred while removing team member.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
            <Trash2 className="size-4" />
            Remove Team Member
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to remove <span className="font-semibold text-foreground">{memberName}</span> from the
            chapter team? This action will revoke their team permissions on Bevy.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              "Remove Member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
