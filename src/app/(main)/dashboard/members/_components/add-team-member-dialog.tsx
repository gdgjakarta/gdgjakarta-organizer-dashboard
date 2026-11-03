"use client";

import * as React from "react";

import { CheckCircle2, Loader2, Search, User as UserIcon, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BevyChapterTeamMember, BevyUser } from "@/lib/bevy/types";
import { cn, getInitials, splitFullName } from "@/lib/utils";
import { addBevyChapterTeamMemberAction, findBevyUserByEmailAction } from "@/server/bevy-actions";

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newMember?: BevyChapterTeamMember) => void;
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

export function AddTeamMemberDialog({ open, onOpenChange, onSuccess }: AddTeamMemberDialogProps) {
  const [emailInput, setEmailInput] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [foundUser, setFoundUser] = React.useState<BevyUser | null>(null);

  // Form state
  const [selectedRoleId, setSelectedRoleId] = React.useState<number>(3); // Default Check-in Staff
  const [isVisible, setIsVisible] = React.useState<boolean>(false);
  const [sendEmails, setSendEmails] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setEmailInput("");
      setFoundUser(null);
      setSelectedRoleId(3);
      setIsVisible(false);
      setSendEmails(true);
      setIsSearching(false);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSearching(true);
    try {
      const res = await findBevyUserByEmailAction(cleanEmail);
      if (res.success && res.data) {
        setFoundUser(res.data);
      } else {
        toast.error(res.error || "User not found on Bevy.");
      }
    } catch {
      toast.error("Failed to lookup user. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!foundUser) return;

    const selectedRole = ROLE_OPTIONS.find((r) => r.roleId === selectedRoleId) || ROLE_OPTIONS[2];
    const fullName =
      foundUser.full_name?.trim() ||
      `${foundUser.first_name || ""} ${foundUser.last_name || ""}`.trim() ||
      (foundUser.email ? foundUser.email.split("@")[0] : "Team Member");

    const { firstName, lastName } = splitFullName(fullName);

    setIsSubmitting(true);
    try {
      const res = await addBevyChapterTeamMemberAction({
        userId: String(foundUser.id),
        firstName: foundUser.first_name || firstName || "Team",
        lastName: foundUser.last_name || lastName || "Member",
        role: selectedRole.roleId,
        title: selectedRole.defaultTitle,
        visible: isVisible,
        sendChapterTeamEmails: sendEmails,
      });

      if (res.success) {
        toast.success(`Successfully added ${fullName} to chapter team!`);
        handleOpenChange(false);
        if (onSuccess) {
          onSuccess(res.data || undefined);
        }
      } else {
        toast.error(res.error || "Failed to add member to team.");
      }
    } catch {
      toast.error("An error occurred while adding team member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName =
    foundUser?.full_name?.trim() ||
    `${foundUser?.first_name || ""} ${foundUser?.last_name || ""}`.trim() ||
    foundUser?.email ||
    "User";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <UserPlus className="size-4 text-primary" />
            Add Team Member
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search for a Bevy community member by email and assign them a role on the chapter team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Email Search Section */}
          <div className="space-y-1.5">
            <Label htmlFor="member-email" className="text-xs font-semibold">
              Member Email <span className="text-destructive">*</span>
            </Label>

            {!foundUser ? (
              <form onSubmit={handleSearchUser} className="flex gap-2">
                <Input
                  id="member-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. member@gdg.community.dev"
                  className="h-9 text-xs sm:text-sm"
                  disabled={isSearching}
                  autoFocus
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 font-medium"
                  disabled={isSearching || !emailInput.trim()}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="size-3.5" />
                      <span>Find User</span>
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9 rounded-full border border-primary/30">
                    <AvatarImage
                      src={foundUser.avatar?.thumbnail_url || foundUser.avatar?.url || undefined}
                      alt={displayName}
                    />
                    <AvatarFallback className="rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(displayName) || <UserIcon className="size-4" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-xs sm:text-sm text-foreground">{displayName}</span>
                      <CheckCircle2 className="size-3.5 shrink-0 fill-emerald-500 text-white dark:text-black" />
                    </div>
                    <span className="truncate text-[11px] text-muted-foreground">{foundUser.email}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/80">ID: #{foundUser.id}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFoundUser(null)}
                  className="h-7 px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                >
                  Change
                </Button>
              </div>
            )}
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
                    onClick={() => setSelectedRoleId(opt.roleId)}
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
                <Label htmlFor="visible-toggle" className="cursor-pointer text-xs font-semibold">
                  Visible on Chapter Page
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Display member publicly on the chapter team website.
                </p>
              </div>
              <Switch id="visible-toggle" checked={isVisible} onCheckedChange={setIsVisible} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="send-emails-toggle" className="cursor-pointer text-xs font-semibold">
                  Send Chapter Team Emails
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Forward chapter announcements and team notices to this member.
                </p>
              </div>
              <Switch id="send-emails-toggle" checked={sendEmails} onCheckedChange={setSendEmails} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAddMember}
            disabled={!foundUser || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              "Add Member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
