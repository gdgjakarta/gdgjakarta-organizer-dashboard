"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BevyChapterTeamMember } from "@/lib/bevy/types";
import { cn, getInitials } from "@/lib/utils";

interface SortableTeamMemberCardProps {
  member: BevyChapterTeamMember;
  index: number;
  roleName: string;
  roleBadgeVariant: string;
  maskedEmail: string;
  onEdit: (member: BevyChapterTeamMember) => void;
  onDelete: (member: BevyChapterTeamMember) => void;
  isDragDisabled?: boolean;
}

export function SortableTeamMemberCard({
  member,
  index,
  roleName,
  roleBadgeVariant,
  maskedEmail,
  onEdit,
  onDelete,
  isDragDisabled = false,
}: SortableTeamMemberCardProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id: String(member.id),
    index,
    type: "team-member",
    accept: "team-member",
    group: "chapter-team-members",
    disabled: isDragDisabled,
  });

  const fullName =
    member.user?.full_name?.trim() ||
    `${member.user?.first_name || ""} ${member.user?.last_name || ""}`.trim() ||
    "Community Member";
  const subtitle = member.title?.trim() || roleName;
  const isVisible = member.visible ?? false;

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex items-center justify-between gap-2.5 rounded-xl border bg-card p-3 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm",
        isDragging && "relative z-20 opacity-50 ring-2 ring-primary/40 shadow-md",
      )}
    >
      {/* Draggable grip handle */}
      {!isDragDisabled && (
        <Button
          ref={handleRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0 cursor-grab text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          title="Drag to reorder team member"
          aria-label={`Drag to reorder ${fullName}`}
        >
          <GripVertical className="size-4" />
        </Button>
      )}

      {/* Clickable info to edit */}
      <button
        type="button"
        onClick={() => onEdit(member)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
      >
        <Avatar className="size-10 rounded-full border border-border shrink-0">
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
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", roleBadgeVariant)}
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
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onEdit(member)}
          className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Edit team member"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(member)}
          className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Remove from chapter team"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
