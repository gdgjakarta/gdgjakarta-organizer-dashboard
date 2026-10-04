"use client";

import { useState } from "react";

import {
  CircleUser,
  EllipsisVertical,
  ExternalLink,
  LogOut,
  MessageSquareHeart,
  MessageSquarePlus,
} from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import { signOutOrganizer, useAuthStore } from "@/stores/auth/auth-provider";

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
  const authUser = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleLogout = async () => {
    await signOutOrganizer();
    window.location.assign("/auth/login");
  };

  if (isLoading || (!authUser && !fallbackUser)) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-12 items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-32" />
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
                      {authUser.chapterRole}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CircleUser />
                Account
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
