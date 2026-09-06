"use client";

import { useRouter } from "next/navigation";

import { CircleUser, CreditCard, EllipsisVertical, LogOut, MessageSquareDot } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { signOutOrganizer, useAuthStore } from "@/stores/auth/auth-provider";

export function NavUser({
  user: fallbackUser,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const authUser = useAuthStore((s) => s.user);

  const currentUser = authUser
    ? {
        name: authUser.name,
        email: authUser.email,
        avatar: authUser.avatar,
      }
    : fallbackUser;

  const handleLogout = async () => {
    await signOutOrganizer();
    router.push("/auth/organizer/login");
    router.refresh();
  };

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
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquareDot />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
