"use client";

import { useState } from "react";

import Link from "next/link";

import { AlertTriangle, Settings, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MaintenanceBannerProps {
  onDismiss?: () => void;
}

export function MaintenanceBanner({ onDismiss }: MaintenanceBannerProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative z-50 flex items-center justify-between border-amber-500/30 border-b bg-amber-500/15 px-4 py-2 font-medium text-amber-950 text-xs backdrop-blur-md dark:bg-amber-500/20 dark:text-amber-200">
      <div className="flex flex-1 items-center justify-center gap-2 text-center sm:justify-start">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          <strong className="font-semibold">Maintenance Mode is ACTIVE:</strong> Public users are seeing the maintenance
          page. You are viewing the site with Organizer Bypass privileges.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 border-amber-500/40 bg-amber-500/10 px-2.5 text-amber-900 text-xs hover:bg-amber-500/20 dark:text-amber-200"
        >
          <Link href="/dashboard/maintenance">
            <Settings className="mr-1 h-3 w-3" />
            Manage Maintenance
          </Link>
        </Button>

        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          className="rounded p-1 text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
