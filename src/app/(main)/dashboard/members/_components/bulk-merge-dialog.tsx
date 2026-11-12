"use client";

import * as React from "react";

import { CheckCircle2, GitMerge, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkMergeDuplicateMembers,
  type DuplicateMemberCluster,
  findFirestoreDuplicateMemberClusters,
} from "@/lib/firestore/client";

interface BulkMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergedSuccess?: () => void;
}

export function BulkMergeDialog({ open, onOpenChange, onMergedSuccess }: BulkMergeDialogProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [isMerging, setIsMerging] = React.useState(false);
  const [clusters, setClusters] = React.useState<DuplicateMemberCluster[]>([]);
  const [hasScanned, setHasScanned] = React.useState(false);

  const scanDuplicates = React.useCallback(async () => {
    setIsScanning(true);
    try {
      const found = await findFirestoreDuplicateMemberClusters();
      setClusters(found);
      setHasScanned(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to scan for duplicate members.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void scanDuplicates();
    } else {
      setHasScanned(false);
      setClusters([]);
    }
  }, [open, scanDuplicates]);

  const totalDuplicatesToDelete = React.useMemo(() => {
    return clusters.reduce((acc, c) => acc + c.duplicateIds.length, 0);
  }, [clusters]);

  const handleBulkMerge = async () => {
    if (clusters.length === 0) return;

    setIsMerging(true);
    const toastId = toast.loading(`Merging ${clusters.length} duplicate group(s)...`);

    try {
      const res = await bulkMergeDuplicateMembers();
      if (res.success || res.totalDuplicatesDeleted > 0) {
        toast.success(
          `Merged ${res.totalClustersMerged} cluster(s) and deleted ${res.totalDuplicatesDeleted} duplicate record(s)!`,
          { id: toastId },
        );
        onOpenChange(false);
        onMergedSuccess?.();
      } else {
        toast.error(res.errors[0] || "No duplicates could be merged.", { id: toastId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error executing bulk merge.", { id: toastId });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <GitMerge className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-semibold text-base">Bulk Merge Duplicate Members</DialogTitle>
              <DialogDescription className="text-xs">
                Scan Firestore members for duplicates by shared email or Bevy User ID and merge them.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2 pr-1">
          {(() => {
            if (isScanning) {
              return (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-muted-foreground text-xs">Scanning members collection for duplicate entries...</p>
                </div>
              );
            }
            if (hasScanned && clusters.length === 0) {
              return (
                <div className="space-y-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto size-5 text-emerald-600" />
                  <p className="font-semibold text-emerald-700 text-xs dark:text-emerald-400">
                    No duplicate members detected!
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    All records have distinct emails and Bevy User IDs. Your members collection is clean.
                  </p>
                </div>
              );
            }
            return (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="font-medium text-foreground text-xs">
                    Detected Duplicate Clusters ({clusters.length})
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {totalDuplicatesToDelete} duplicate record(s) to remove
                  </Badge>
                </div>

                <div className="max-h-[340px] space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-2">
                  <div className="space-y-2">
                    {clusters.map((c) => {
                      const authMember = c.members.find((m) => String(m.id) === c.authoritativeId);
                      return (
                        <div key={c.key} className="space-y-2 rounded-md border bg-card p-3 text-xs shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-foreground">
                              {authMember?.name || authMember?.email || c.key}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                              {c.reason === "email" ? "Email match" : "Bevy ID match"}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center gap-1.5 font-mono text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="size-3 shrink-0" />
                              <span>Keep (Auth ID): {c.authoritativeId}</span>
                              <span className="font-sans text-muted-foreground">({authMember?.email})</span>
                            </div>

                            <div className="flex items-start gap-1.5 font-mono text-destructive">
                              <Trash2 className="mt-0.5 size-3 shrink-0" />
                              <span>Delete duplicate doc(s): {c.duplicateIds.join(", ")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-muted-foreground text-xs">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Bulk merge will retain all real unmasked emails, transfer event registrations to the authoritative
                    document, and cleanly delete the secondary documents.
                  </p>
                </div>
              </>
            );
          })()}
        </div>

        <DialogFooter className="mt-2 shrink-0 gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleBulkMerge()}
            disabled={isMerging || isScanning || clusters.length === 0}
          >
            {isMerging ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <GitMerge className="mr-1.5 size-3.5" />
            )}
            Merge All Duplicates ({totalDuplicatesToDelete})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
