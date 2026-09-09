import Link from "next/link";

import { GdgLogo } from "@/components/gdg-logo";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <GdgLogo size={48} className="h-7 w-auto shrink-0" />
            <span className="font-bold text-lg">{APP_CONFIG.name}</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-6 font-medium text-sm md:flex">
            <Link href="/" className="text-foreground/60 transition-colors hover:text-foreground/80">
              Home
            </Link>
            <Link href="/events" className="text-foreground/60 transition-colors hover:text-foreground/80">
              Events
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/auth/member/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/organizer/login">Organizer Login</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
