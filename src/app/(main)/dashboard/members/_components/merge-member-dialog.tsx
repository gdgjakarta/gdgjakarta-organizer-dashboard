"use client";

import * as React from "react";

import { AlertTriangle, CheckCircle2, GitMerge, Loader2 } from "lucide-react";
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
import { mergeFirestoreMemberDocuments } from "@/lib/firestore/client";

import type { MemberRow } from "./data";

interface MergeMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryMember: MemberRow | null;
  allMembers: MemberRow[];
  onMerged?: () => void;
}

export function MergeMemberDialog({ open, onOpenChange, primaryMember, allMembers, onMerged }: MergeMemberDialogProps) {
  const [duplicateId, setDuplicateId] = React.useState("");
  const [bevyUserId, setBevyUserId] = React.useState("");
  const [isMerging, setIsMerging] = React.useState(false);

  // Auto-detect potential duplicates (matching email or matching bevyUserId)
  const potentialDuplicates = React.useMemo(() => {
    if (!primaryMember) return [];
    const primaryId = String(primaryMember.id || "");
    const primaryEmail = (primaryMember.email || "").toLowerCase().trim();
    const primaryBevyId = primaryMember.bevyUserId != null ? String(primaryMember.bevyUserId) : "";

    return allMembers.filter((m) => {
      const mId = String(m.id || "");
      if (mId === primaryId) return false;

      const mEmail = (m.email || "").toLowerCase().trim();
      const mBevyId = m.bevyUserId != null ? String(m.bevyUserId) : "";

      const sameEmail = Boolean(primaryEmail && mEmail && primaryEmail === mEmail);
      const sameBevyId = Boolean(primaryBevyId && mBevyId && primaryBevyId === mBevyId);

      return sameEmail || sameBevyId;
    });
  }, [primaryMember, allMembers]);

  React.useEffect(() => {
    if (primaryMember) {
      if (potentialDuplicates.length > 0 && potentialDuplicates[0]?.id) {
        setDuplicateId(String(potentialDuplicates[0].id));
      } else {
        setDuplicateId("");
      }
      setBevyUserId(primaryMember.bevyUserId ? String(primaryMember.bevyUserId) : "");
    }
  }, [primaryMember, potentialDuplicates]);

  if (!primaryMember) return null;

  const targetDocId = String(primaryMember.id || "");

  const handleMerge = async () => {
    if (!targetDocId || !duplicateId) {
      toast.error("Please specify the duplicate document ID to merge and delete.");
      return;
    }

    if (targetDocId === duplicateId) {
      toast.error("Target document ID and duplicate document ID must be different.");
      return;
    }

    setIsMerging(true);
    const toastId = toast.loading("Merging member documents and cleaning duplicate...");

    try {
      const result = await mergeFirestoreMemberDocuments(
        targetDocId,
        duplicateId.trim(),
        bevyUserId.trim() || undefined,
      );

      if (result.success) {
        toast.success(`Successfully merged ${duplicateId} into ${targetDocId}!`, { id: toastId });
        onOpenChange(false);
        onMerged?.();
      } else {
        toast.error(result.error || "Failed to merge documents.", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error merging member documents.", { id: toastId });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <GitMerge className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-semibold text-base">Merge Duplicate Member</DialogTitle>
              <DialogDescription className="text-xs">
                Combine two duplicate records into one authoritative document.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target / Primary Document Info */}
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>Target Primary Document (Kept)</span>
            </div>
            <p className="break-all text-muted-foreground text-xs">
              <strong className="text-foreground">Doc ID:</strong> {targetDocId}
            </p>
            <p className="break-all text-muted-foreground text-xs">
              <strong className="text-foreground">Email:</strong> {primaryMember.email}
            </p>
            <p className="text-muted-foreground text-xs">
              <strong className="text-foreground">Name:</strong> {primaryMember.name}
            </p>
          </div>

          {/* Auto-detected duplicate suggestions */}
          {potentialDuplicates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-amber-700 text-xs dark:text-amber-400">
                <AlertTriangle className="size-3" />
                Detected Duplicate Match:
              </Label>
              <div className="space-y-1">
                {potentialDuplicates.map((dup) => (
                  <button
                    type="button"
                    key={String(dup.id)}
                    onClick={() => setDuplicateId(String(dup.id))}
                    className="flex w-full items-center justify-between rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-left text-xs transition-colors hover:bg-amber-500/15"
                  >
                    <div>
                      <div className="font-medium text-foreground">{dup.name || "Unknown"}</div>
                      <div className="text-muted-foreground">{dup.email}</div>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">ID: {String(dup.id)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate ID Input */}
          <div className="space-y-1.5">
            <Label htmlFor="duplicateId" className="font-medium text-xs">
              Duplicate Document ID to Delete
            </Label>
            <Input
              id="duplicateId"
              placeholder="e.g. 331870 or Firebase UID"
              value={duplicateId}
              onChange={(e) => setDuplicateId(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              This secondary document will be deleted after all relevant fields and registrations are transferred.
            </p>
          </div>

          {/* Verified Bevy User ID */}
          <div className="space-y-1.5">
            <Label htmlFor="bevyUserId" className="font-medium text-xs">
              Verified Bevy User ID
            </Label>
            <Input
              id="bevyUserId"
              placeholder="e.g. 331870"
              value={bevyUserId}
              onChange={(e) => setBevyUserId(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Guarantees the merged primary document is recorded with this exact Bevy User ID.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleMerge()} disabled={isMerging || !duplicateId.trim()}>
            {isMerging ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <GitMerge className="mr-1.5 size-3.5" />
            )}
            Merge & Delete Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
