"use client";

import * as React from "react";

import { EyeOff, Pencil, Plus, RefreshCw, Search, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BevyChapterTeamMember } from "@/lib/bevy/types";
import { getInitials } from "@/lib/utils";
import { fetchBevyChapterTeamsAction } from "@/server/bevy-actions";

import { AddTeamMemberDialog } from "./add-team-member-dialog";
import { DeleteTeamMemberDialog } from "./delete-team-member-dialog";
import { EditTeamMemberDialog } from "./edit-team-member-dialog";

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
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [memberToEdit, setMemberToEdit] = React.useState<BevyChapterTeamMember | null>(null);
  const [memberToDelete, setMemberToDelete] = React.useState<BevyChapterTeamMember | null>(null);

  // Sync state if initial prop changes
  React.useEffect(() => {
    setTeam(initialTeamMembers);
  }, [initialTeamMembers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const freshTeam = await fetchBevyChapterTeamsAction();
      setTeam(freshTeam);
      toast.success("Team roster refreshed.");
    } catch {
      toast.error("Failed to refresh team roster.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredTeam = React.useMemo(() => {
    if (!searchQuery.trim()) return team;
    const q = searchQuery.toLowerCase().trim();
    return team.filter((tm) => {
      const fullName = (tm.user?.full_name || `${tm.user?.first_name || ""} ${tm.user?.last_name || ""}`).toLowerCase();
      const email = (tm.user?.email || "").toLowerCase();
      const roleTitle = resolveRoleTitle(tm).toLowerCase();
      const customTitle = (tm.title || "").toLowerCase();
      return fullName.includes(q) || email.includes(q) || roleTitle.includes(q) || customTitle.includes(q);
    });
  }, [team, searchQuery]);

  return (
    <div className="space-y-6">
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
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="size-9 shrink-0 rounded-lg"
            title="Refresh team roster"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeam.map((member) => {
            const fullName =
              member.user?.full_name?.trim() ||
              `${member.user?.first_name || ""} ${member.user?.last_name || ""}`.trim() ||
              "Community Member";
            const roleName = resolveRoleTitle(member);
            const subtitle = member.title?.trim() || roleName;
            const isVisible = member.visible ?? false;
            const maskedEmail = maskEmailDisplay(member.user?.email);

            return (
              <div
                key={member.id}
                className="group relative flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setMemberToEdit(member)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                >
                  <Avatar className="size-10 rounded-full border border-border">
                    <AvatarImage
                      src={member.user?.avatar?.thumbnail_url || member.user?.avatar?.url || undefined}
                      alt={fullName}
                    />
                    <AvatarFallback className="rounded-full bg-muted text-xs font-semibold text-foreground">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    {/* Role & Visibility Badge */}
                    <div className="flex items-center gap-1.5">
                      {!isVisible && (
                        <span title="Hidden on chapter public page" className="text-muted-foreground">
                          <EyeOff className="size-3.5" />
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getRoleBadgeVariant(roleName)}`}
                      >
                        {roleName}
                      </Badge>
                    </div>

                    {/* Member Name */}
                    <div className="truncate font-semibold text-sm text-foreground leading-tight">{fullName}</div>

                    {/* Subtitle / Custom Title */}
                    <div className="truncate text-xs text-muted-foreground leading-none">{subtitle}</div>

                    {/* Email */}
                    <div className="truncate font-mono text-[10px] text-muted-foreground/80 leading-tight">
                      {member.user?.email || maskedEmail}
                    </div>
                  </div>
                </button>

                {/* Actions: Edit & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMemberToEdit(member)}
                    className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Edit team member"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMemberToDelete(member)}
                    className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remove from chapter team"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Team Member Dialog */}
      <AddTeamMemberDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={() => {
          void handleRefresh();
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
          void handleRefresh();
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
          void handleRefresh();
        }}
      />
    </div>
  );
}
