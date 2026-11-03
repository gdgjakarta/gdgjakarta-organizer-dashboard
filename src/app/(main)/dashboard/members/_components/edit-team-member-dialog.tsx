"use client";

import * as React from "react";

import { Loader2, UserCog, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Switch } from "@/components/ui/switch";
import type { BevyChapterTeamMember } from "@/lib/bevy/types";
import { cn, getInitials, splitFullName } from "@/lib/utils";
import { updateBevyChapterTeamMemberAction } from "@/server/bevy-actions";

interface EditTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: BevyChapterTeamMember | null;
  onSuccess?: (updatedMember?: BevyChapterTeamMember) => void;
}

type RoleOption = {
  roleId: number;
  label: string;
  defaultTitle: string;
  description: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  { roleId: 1, label: "Organizer", defaultTitle: "Organizer", description: "Full Chapter Access" },
  { roleId: 2, label: "Team Member", defaultTitle: "Team Member", description: "Core Team Access" },
  { roleId: 3, label: "Check-in Staff", defaultTitle: "Check-in Staff", description: "On-site Check-in Staff" },
  { roleId: 4, label: "Regional Leader", defaultTitle: "Regional Lead", description: "Regional Leadership" },
];

function extractNumericRoleId(role: unknown): number {
  if (typeof role === "number") return role;
  if (typeof role === "object" && role !== null && "id" in role && typeof (role as { id: unknown }).id === "number") {
    return (role as { id: number }).id;
  }
  if (typeof role === "string") {
    const lower = role.toLowerCase();
    if (lower.includes("regional")) return 4;
    if (lower.includes("organizer") || lower.includes("lead")) return 1;
    if (lower.includes("check-in") || lower.includes("staff")) return 3;
    return 2;
  }
  return 3;
}

export function EditTeamMemberDialog({ open, onOpenChange, member, onSuccess }: EditTeamMemberDialogProps) {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [selectedRoleId, setSelectedRoleId] = React.useState<number>(3);
  const [isVisible, setIsVisible] = React.useState<boolean>(false);
  const [sendEmails, setSendEmails] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync state whenever active member changes
  React.useEffect(() => {
    if (member) {
      const u = member.user;
      const parsed = splitFullName(u?.full_name || "");
      setFirstName(u?.first_name || parsed.firstName || "");
      setLastName(u?.last_name || parsed.lastName || "");
      setTitle(member.title || "");
      setSelectedRoleId(extractNumericRoleId(member.role));
      setIsVisible(Boolean(member.visible));
      setSendEmails(member.send_chapter_team_emails ?? true);
    }
  }, [member]);

  if (!member) return null;

  const displayName =
    member.user?.full_name?.trim() || `${firstName} ${lastName}`.trim() || member.user?.email || "Team Member";

  const userId = member.user?.id || member.user_id;

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!member.id || !userId) {
      toast.error("Member ID or User ID is missing.");
      return;
    }

    const selectedRole = ROLE_OPTIONS.find((r) => r.roleId === selectedRoleId) || ROLE_OPTIONS[2];

    setIsSubmitting(true);
    try {
      const res = await updateBevyChapterTeamMemberAction({
        teamMemberId: member.id,
        userId: userId,
        email: member.user?.email,
        firstName: firstName.trim() || "Team",
        lastName: lastName.trim(),
        role: selectedRole.roleId,
        title: title.trim() || selectedRole.defaultTitle,
        visible: isVisible,
        sendChapterTeamEmails: sendEmails,
      });

      if (res.success) {
        toast.success(`Successfully updated ${displayName}!`);
        onOpenChange(false);
        if (onSuccess) {
          onSuccess(res.data || undefined);
        }
      } else {
        toast.error(res.error || "Failed to update team member.");
      }
    } catch {
      toast.error("An error occurred while updating team member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <UserCog className="size-4 text-primary" />
            Edit Team Member
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update role permissions, custom title, and visibility on the chapter team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-4 py-1">
          {/* Member Profile Preview */}
          <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/30 p-3">
            <Avatar className="size-10 rounded-full border border-border">
              <AvatarImage
                src={member.user?.avatar?.thumbnail_url || member.user?.avatar?.url || undefined}
                alt={displayName}
              />
              <AvatarFallback className="rounded-full bg-muted text-xs font-semibold text-foreground">
                {getInitials(displayName) || <UserIcon className="size-4" />}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-xs sm:text-sm text-foreground">{displayName}</span>
              <span className="truncate text-[11px] text-muted-foreground">{member.user?.email || "No email"}</span>
              <span className="font-mono text-[10px] text-muted-foreground/80">Bevy User ID: #{userId}</span>
            </div>
          </div>

          {/* First & Last Name Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first-name" className="text-xs font-semibold">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="h-9 text-xs sm:text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-last-name" className="text-xs font-semibold">
                Last Name
              </Label>
              <Input
                id="edit-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Custom Title Input */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title" className="text-xs font-semibold">
              Designation / Title
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Check-in Staff, Lead Organizer, Event Lead"
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          {/* Team Role Segmented Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Team Role</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROLE_OPTIONS.map((opt) => {
                const isSelected = selectedRoleId === opt.roleId;
                return (
                  <button
                    key={opt.roleId}
                    type="button"
                    onClick={() => {
                      setSelectedRoleId(opt.roleId);
                      if (!title || ROLE_OPTIONS.some((r) => r.defaultTitle === title)) {
                        setTitle(opt.defaultTitle);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                        : "border-border/60 bg-card hover:bg-muted/50 text-foreground text-xs",
                    )}
                  >
                    <span className="text-xs">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visibility and Notification Settings */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-visible-toggle" className="cursor-pointer text-xs font-semibold">
                  Visible on Chapter Page
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Display member publicly on the chapter team website.
                </p>
              </div>
              <Switch id="edit-visible-toggle" checked={isVisible} onCheckedChange={setIsVisible} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-send-emails-toggle" className="cursor-pointer text-xs font-semibold">
                  Send Chapter Team Emails
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Forward chapter announcements and team notices to this member.
                </p>
              </div>
              <Switch id="edit-send-emails-toggle" checked={sendEmails} onCheckedChange={setSendEmails} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
