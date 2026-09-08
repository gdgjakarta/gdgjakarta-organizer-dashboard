import { Globe } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <p className="text-sm font-medium">{APP_CONFIG.name}</p>
          <p className="text-xs text-muted-foreground">{APP_CONFIG.copyright}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Globe className="size-4" />
            <span>Jakarta, Indonesia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
