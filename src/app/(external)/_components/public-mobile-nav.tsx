"use client";

import { type ReactNode, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight, Menu } from "lucide-react";

import { GdgLogo } from "@/components/gdg-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { APP_CONFIG } from "@/config/app-config";
import { cn } from "@/lib/utils";

import { isPublicNavItemActive, PUBLIC_NAV_ITEMS } from "./public-nav-items";

interface PublicMobileNavProps {
  authAction: ReactNode;
}

export function PublicMobileNav({ authAction }: PublicMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full md:hidden" aria-label="Open navigation menu">
          <Menu />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[85%] gap-0 sm:max-w-xs">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-3">
            <GdgLogo size={48} className="h-7 w-auto shrink-0" />
            <span className="font-medium text-base tracking-tight">{APP_CONFIG.name}</span>
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive = isPublicNavItemActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-4 py-3 font-medium text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {item.title}
                      <ChevronRight
                        className={cn("size-4", isActive ? "text-foreground" : "text-muted-foreground")}
                        aria-hidden="true"
                      />
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>

        <SheetFooter className="border-t sm:hidden [&_a]:w-full [&_button]:w-full">{authAction}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
