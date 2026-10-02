import Link from "next/link";

import { Globe } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:px-6 md:flex-row lg:px-8">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <p className="font-medium text-sm">{APP_CONFIG.name}</p>
          <p className="text-muted-foreground text-xs">{APP_CONFIG.copyright}</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-muted-foreground text-sm">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <div className="flex items-center gap-1.5">
            <Globe className="size-4" />
            <span>Jakarta, Indonesia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
