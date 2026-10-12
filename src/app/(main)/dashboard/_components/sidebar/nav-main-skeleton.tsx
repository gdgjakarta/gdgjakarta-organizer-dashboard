"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface ShimmerBarProps {
  readonly className?: string;
}

function ShimmerBar({ className }: ShimmerBarProps) {
  return (
    <div className={cn("relative overflow-hidden rounded bg-muted", className)}>
      <div className="shimmer-wave" aria-hidden="true" />
    </div>
  );
}

const SKELETON_GROUPS = [
  {
    id: "dashboards",
    labelWidth: "w-16",
    items: [{ id: "dashboards-1", width: "w-20", hasBadge: true }],
  },
  {
    id: "pages",
    labelWidth: "w-12",
    items: [
      { id: "pages-1", width: "w-28", hasBadge: false },
      { id: "pages-2", width: "w-24", hasBadge: true },
      { id: "pages-3", width: "w-32", hasBadge: false },
    ],
  },
  {
    id: "support",
    labelWidth: "w-14",
    items: [
      { id: "support-1", width: "w-36", hasBadge: false },
      { id: "support-2", width: "w-24", hasBadge: false },
    ],
  },
] as const;

export function NavMainSkeleton() {
  return (
    <div className="fade-in animate-in duration-200">
      {SKELETON_GROUPS.map((group) => (
        <SidebarGroup key={group.id}>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
            <ShimmerBar className={cn("h-2.5", group.labelWidth)} />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <div className="flex h-8 w-full items-center gap-2 rounded-md px-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!">
                    <ShimmerBar className="size-4 shrink-0 rounded-sm" />
                    <ShimmerBar className={cn("h-3.5 flex-1 group-data-[collapsible=icon]:hidden", item.width)} />
                    {item.hasBadge && (
                      <ShimmerBar className="ml-auto h-4 w-7 shrink-0 rounded-xs bg-muted/80 group-data-[collapsible=icon]:hidden" />
                    )}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  );
}
