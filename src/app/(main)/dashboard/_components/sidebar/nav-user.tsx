"use client";

import { useState } from "react";

import Link from "next/link";

import {
  CircleUser,
  EllipsisVertical,
  ExternalLink,
  LogOut,
  MessageSquareHeart,
  MessageSquarePlus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { formatRoleTitle } from "@/components/role-badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import { refreshCurrentUserRole, signOutOrganizer, useAuthStore } from "@/stores/auth/auth-provider";

export function NavUser({
  user: fallbackUser,
}: {
  readonly user?: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
} = {}) {
  const { isMobile } = useSidebar();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const authUser = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isLoggingOut = useAuthStore((s) => s.isLoggingOut);
  const setLoggingOut = useAuthStore((s) => s.setLoggingOut);

  const handleRefreshCache = async () => {
    try {
      setIsRefreshing(true);
      toast.loading("Clearing cache and syncing role from Bevy...", { id: "refresh-role" });
      const result = await refreshCurrentUserRole();
      if (result.success) {
        toast.success(result.message || "Permissions updated from Bevy!", { id: "refresh-role" });
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        toast.error(result.message || "Failed to sync role with Bevy", { id: "refresh-role" });
      }
    } catch (err) {
      console.error("Error refreshing role:", err);
      toast.error("Failed to sync role from Bevy", { id: "refresh-role" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOutOrganizer();
    window.location.assign("/auth/login");
  };

  if (isLoading || isLoggingOut || (!authUser && !fallbackUser)) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-12 items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
            <div className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-muted">
              <div className="shimmer-wave" aria-hidden="true" />
            </div>
            <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
              <div className="relative h-3.5 w-24 overflow-hidden rounded bg-muted">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
              <div className="relative h-2.5 w-32 overflow-hidden rounded bg-muted/80">
                <div className="shimmer-wave" aria-hidden="true" />
              </div>
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const currentUser = authUser
    ? {
        name: authUser.name,
        email: authUser.email,
        avatar: authUser.avatar,
      }
    : (fallbackUser ?? {
        name: "User",
        email: "",
        avatar: "",
      });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={currentUser.avatar || undefined} alt={currentUser.name} />
                <AvatarFallback className="rounded-lg">{getInitials(currentUser.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentUser.name}</span>
                <span className="truncate text-muted-foreground text-xs">{currentUser.email}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={currentUser.avatar || undefined} alt={currentUser.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(currentUser.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{currentUser.name}</span>
                  <span className="truncate text-muted-foreground text-xs">{currentUser.email}</span>
                  {authUser?.chapterRole && (
                    <span className="mt-0.5 inline-block font-semibold text-[10px] text-primary">
                      {formatRoleTitle(authUser.chapterRole)}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/account">
                  <CircleUser className="size-4" />
                  <span>Account</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefreshCache} disabled={isRefreshing} className="cursor-pointer">
                <RotateCcw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Clear Cache & Sync Role</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsFeedbackOpen(true)} className="cursor-pointer">
                <MessageSquarePlus className="size-4" />
                Feedback & Suggestions
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquareHeart className="size-5" />
              </div>
              <DialogTitle>Have something in mind?</DialogTitle>
              <DialogDescription>
                We'd love to hear your feedback, suggestions, or ideas to help us improve the GDG Jakarta platform.
              </DialogDescription>
            </DialogHeader>

            <div className="py-1 text-muted-foreground text-sm">
              <p>
                Your feedback directly influences our community initiatives and developer experiences. Submit your
                thoughts via our quick form.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsFeedbackOpen(false)}>
                Cancel
              </Button>
              <Button type="button" asChild>
                <a
                  href="https://forms.gle/yNxbRvtyQYBs6ZFU7"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5"
                  onClick={() => setIsFeedbackOpen(false)}
                >
                  <span>Give Feedback</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
