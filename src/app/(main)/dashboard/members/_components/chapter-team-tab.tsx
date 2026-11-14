"use client";

import * as React from "react";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Plus, RefreshCw, Search, Shield } from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BevyChapterTeamMember } from "@/lib/bevy/types";
import { fetchBevyChapterTeamsAction, reorderBevyChapterTeamAction } from "@/server/bevy-actions";

import { AddTeamMemberDialog } from "./add-team-member-dialog";
import { DeleteTeamMemberDialog } from "./delete-team-member-dialog";
import { EditTeamMemberDialog } from "./edit-team-member-dialog";
import { SortableTeamMemberCard } from "./sortable-team-member-card";

interface ChapterTeamTabProps {
  initialTeamMembers: BevyChapterTeamMember[];
}

function maskEmailDisplay(email?: string | null): string {
  if (!email) return "—";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "***";
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  if (local.length <= 1) return `*${domain}`;
  const first = local[0];
  const asterisks = "*".repeat(Math.max(4, Math.min(local.length - 1, 10)));
  return `${first}${asterisks}${domain}`;
}

function resolveRoleTitle(tm: BevyChapterTeamMember): string {
  if (typeof tm.role === "object" && tm.role !== null && "name" in tm.role && tm.role.name) {
    return tm.role.name;
  }
  if (typeof tm.role === "string" && tm.role) {
    return tm.role;
  }
  if (tm.title) {
    return tm.title;
  }
  if (tm.is_chapter_leader) {
    return "Lead Organizer";
  }
  return "Organizer";
}

function getRoleBadgeVariant(roleName: string) {
  const lower = roleName.toLowerCase();
  if (lower.includes("regional")) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  }
  if (lower.includes("lead") || lower.includes("organizer")) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
  }
  if (lower.includes("check-in") || lower.includes("staff")) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  }
  return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
}

export function ChapterTeamTab({ initialTeamMembers }: ChapterTeamTabProps) {
  const [team, setTeam] = React.useState<BevyChapterTeamMember[]>(initialTeamMembers);
  const [initialOrder, setInitialOrder] = React.useState<Array<number | string>>(() =>
    initialTeamMembers.map((m) => m.id).filter(Boolean),
  );
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isSavingOrder, setIsSavingOrder] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [memberToEdit, setMemberToEdit] = React.useState<BevyChapterTeamMember | null>(null);
  const [memberToDelete, setMemberToDelete] = React.useState<BevyChapterTeamMember | null>(null);

  // Sync state if initial prop changes
  React.useEffect(() => {
    setTeam(initialTeamMembers);
    setInitialOrder(initialTeamMembers.map((m) => m.id).filter(Boolean));
  }, [initialTeamMembers]);

  const currentOrder = React.useMemo(() => team.map((m) => m.id).filter(Boolean), [team]);
  const isOrderDirty = React.useMemo(() => {
    if (initialOrder.length !== currentOrder.length) return false;
    return initialOrder.some((id, idx) => String(id) !== String(currentOrder[idx]));
  }, [initialOrder, currentOrder]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const freshTeam = await fetchBevyChapterTeamsAction();
      const roster = freshTeam.length > 0 ? freshTeam : team;
      if (freshTeam.length > 0) {
        setTeam(freshTeam);
        setInitialOrder(freshTeam.map((m) => m.id).filter(Boolean));
      }
      const { syncChapterTeamRolesToFirestore } = await import("@/lib/firestore/sync-service");
      const res = await syncChapterTeamRolesToFirestore(roster);
      if (res.success) {
        toast.success(`Refreshed and synced ${res.totalSynced} team roles to Firestore!`);
      } else {
        toast.info("Team roster refreshed (role sync to Firestore had warnings).");
      }
    } catch {
      toast.error("Failed to sync team roles.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!isOrderDirty || isSavingOrder) return;
    setIsSavingOrder(true);
    try {
      const res = await reorderBevyChapterTeamAction(currentOrder);
      if (res.success) {
        setInitialOrder(currentOrder);
        toast.success("Team member order saved successfully to Bevy!");
      } else {
        toast.error(res.error || "Failed to save team member order.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save team member order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDiscardOrder = () => {
    // Revert back to initialOrder
    const orderMap = new Map(team.map((m) => [m.id, m]));
    const reverted = initialOrder.map((id) => orderMap.get(id)).filter(Boolean) as BevyChapterTeamMember[];
    setTeam(reverted);
    toast.info("Discarded order changes.");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { source } = event.operation;
    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
      return;
    }

    setTeam((prev) => {
      const next = [...prev];
      const [movedItem] = next.splice(source.initialIndex, 1);
      if (movedItem) {
        next.splice(source.index, 0, movedItem);
      }
      return next;
    });
  };

  const isFiltering = Boolean(searchQuery.trim());

  const filteredTeam = React.useMemo(() => {
    if (!isFiltering) return team;
    const q = searchQuery.toLowerCase().trim();
    return team.filter((tm) => {
      const fullName = (tm.user?.full_name || `${tm.user?.first_name || ""} ${tm.user?.last_name || ""}`).toLowerCase();
      const email = (tm.user?.email || "").toLowerCase();
      const roleTitle = resolveRoleTitle(tm).toLowerCase();
      const customTitle = (tm.title || "").toLowerCase();
      return fullName.includes(q) || email.includes(q) || roleTitle.includes(q) || customTitle.includes(q);
    });
  }, [team, searchQuery, isFiltering]);

  return (
    <div className="space-y-6 pb-20">
      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members by name, email, or role..."
              className="h-9 rounded-lg bg-background pl-8.5 text-xs sm:text-sm"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing || isSavingOrder}
            className="size-9 shrink-0 rounded-lg"
            title="Sync Bevy roles to Firestore"
            aria-label="Sync Bevy roles to Firestore"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            disabled={isSavingOrder}
            className="h-9 gap-1.5 rounded-lg font-medium text-xs sm:text-sm shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Team Member</span>
          </Button>
        </div>
      </div>

      {/* Roster Cards List */}
      {filteredTeam.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
              <Shield className="size-6" />
            </div>
            <h3 className="mt-4 font-semibold text-sm">No team members found</h3>
            <p className="mt-1 max-w-sm text-muted-foreground text-xs">
              {searchQuery
                ? "No team members matched your search criteria."
                : "There are currently no active team members in this chapter."}
            </p>
            {searchQuery ? (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-4 rounded-lg">
                Clear Search
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsAddOpen(true)} className="mt-4 gap-1.5 rounded-lg">
                <Plus className="size-3.5" />
                <span>Add Team Member</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeam.map((member, index) => {
              const roleName = resolveRoleTitle(member);
              const roleVariant = getRoleBadgeVariant(roleName);
              const maskedEmail = maskEmailDisplay(member.user?.email);
              const itemKey =
                member.id != null && String(member.id).trim() !== ""
                  ? String(member.id)
                  : member.user?.id != null
                    ? `user-${member.user.id}`
                    : `team-${index}-${member.user?.email || member.user?.full_name || index}`;

              return (
                <SortableTeamMemberCard
                  key={itemKey}
                  member={member}
                  index={index}
                  roleName={roleName}
                  roleBadgeVariant={roleVariant}
                  maskedEmail={maskedEmail}
                  onEdit={setMemberToEdit}
                  onDelete={setMemberToDelete}
                  isDragDisabled={isFiltering || isSavingOrder}
                />
              );
            })}
          </div>
        </DragDropProvider>
      )}

      {/* Fixed Floating Bottom Save Bar for Order Changes */}
      <FloatingSaveBar
        isDirty={isOrderDirty}
        isSaving={isSavingOrder}
        onSave={handleSaveOrder}
        onDiscard={handleDiscardOrder}
        saveLabel="Save Team Order"
        savingLabel="Saving Order..."
        discardLabel="Discard"
        unsavedBadgeLabel="Team Order Modified"
      />

      {/* Add Team Member Dialog */}
      <AddTeamMemberDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={() => {
          void handleSync();
        }}
      />

      {/* Edit Team Member Dialog */}
      <EditTeamMemberDialog
        open={Boolean(memberToEdit)}
        onOpenChange={(open) => {
          if (!open) setMemberToEdit(null);
        }}
        member={memberToEdit}
        onSuccess={() => {
          setMemberToEdit(null);
          void handleSync();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTeamMemberDialog
        open={Boolean(memberToDelete)}
        onOpenChange={(open) => {
          if (!open) setMemberToDelete(null);
        }}
        member={memberToDelete}
        onSuccess={() => {
          setMemberToDelete(null);
          void handleSync();
        }}
      />
    </div>
  );
}
