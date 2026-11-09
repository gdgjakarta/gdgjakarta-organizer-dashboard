"use client";

import { useMemo, useState } from "react";

import { Calendar, CheckCircle2, Filter, Sparkles, Tag, Wrench, Zap } from "lucide-react";

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
import { CHANGELOG_RELEASES, type ChangelogRelease, CURRENT_APP_VERSION } from "@/config/changelog";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * If provided, displays only these diff releases (for What's New modal).
   * If omitted or empty array, displays all releases from CHANGELOG.md.
   */
  releases?: ChangelogRelease[];
  /**
   * Optional custom title override, defaults to "What's New in GDG Jakarta"
   */
  title?: string;
  /**
   * Optional button label, defaults to "Got it, explore"
   */
  confirmText?: string;
  onConfirm?: () => void;
}

export function ChangelogDialog({
  open,
  onOpenChange,
  releases,
  title,
  confirmText = "Got it, explore",
  onConfirm,
}: ChangelogDialogProps) {
  const isDiffMode = Boolean(releases && releases.length > 0);
  const displayReleases = isDiffMode && releases ? releases : CHANGELOG_RELEASES;

  const [selectedVersionFilter, setSelectedVersionFilter] = useState<string>("all");

  const filteredReleases = useMemo(() => {
    if (selectedVersionFilter === "all") {
      return displayReleases;
    }
    return displayReleases.filter((r) => r.version === selectedVersionFilter);
  }, [displayReleases, selectedVersionFilter]);

  const handleClose = () => {
    onConfirm?.();
    onOpenChange(false);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Added":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            <Sparkles className="mr-1 size-3" />
            Added
          </Badge>
        );
      case "Fixed":
        return (
          <Badge
            variant="outline"
            className="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400"
          >
            <Wrench className="mr-1 size-3" />
            Fixed
          </Badge>
        );
      case "Improved":
      case "Changed":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400"
          >
            <Zap className="mr-1 size-3" />
            Improved
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Tag className="mr-1 size-3" />
            {category}
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        {/* Header with decorative banner */}
        <div className="relative border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <Badge variant="secondary" className="gap-1 font-mono text-xs">
                v{CURRENT_APP_VERSION}
              </Badge>
              {isDiffMode && (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  New updates for you
                </Badge>
              )}
            </div>

            <DialogTitle className="font-bold text-xl tracking-tight">
              {title || (isDiffMode ? "What's New in GDG Jakarta" : "Release Changelog")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {isDiffMode
                ? "Here is what we've improved and built since you last opened the dashboard."
                : "Explore all recent features, stability fixes, and community improvements."}
            </DialogDescription>
          </DialogHeader>

          {/* Quick version filter pills if not in diff mode */}
          {!isDiffMode && displayReleases.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 flex items-center gap-1 text-muted-foreground text-xs">
                <Filter className="size-3" /> Version:
              </span>
              <button
                type="button"
                onClick={() => setSelectedVersionFilter("all")}
                className={`rounded-full px-2.5 py-0.5 font-medium text-xs transition-colors ${
                  selectedVersionFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All Releases
              </button>
              {displayReleases.map((rel) => (
                <button
                  type="button"
                  key={rel.version}
                  onClick={() => setSelectedVersionFilter(rel.version)}
                  className={`rounded-full px-2.5 py-0.5 font-medium font-mono text-xs transition-colors ${
                    selectedVersionFilter === rel.version
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  v{rel.version}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content list with native smooth scroll */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="relative space-y-6 pb-6">
            {filteredReleases.map((release, releaseIdx) => {
              const isLatestRelease = releaseIdx === 0;

              return (
                <div
                  key={release.version}
                  className="relative rounded-xl border bg-card/60 p-4 shadow-2xs backdrop-blur-xs transition-all hover:border-primary/30"
                >
                  {/* Release Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground text-sm">v{release.version}</span>
                      {release.badge && (
                        <Badge
                          variant={isLatestRelease ? "default" : "secondary"}
                          className="font-bold text-[10px] uppercase tracking-wider"
                        >
                          {release.badge}
                        </Badge>
                      )}
                      <h4 className="font-medium text-foreground/90 text-sm">{release.title}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Calendar className="size-3.5" />
                      <span>{release.releaseDate}</span>
                    </div>
                  </div>

                  {/* Release Items */}
                  <div className="mt-3.5 space-y-2.5">
                    {release.items.map((item) => (
                      <div
                        key={`${release.version}-${item.category}-${item.text.slice(0, 20)}`}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <div className="mt-0.5 shrink-0">{getCategoryBadge(item.category)}</div>
                        <p className="flex-1 text-muted-foreground leading-snug">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredReleases.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No changelog records found for this version.
              </div>
            )}
          </div>
        </div>

        {/* Footer (only in diff/welcome mode or when explicit confirm action exists) */}
        {isDiffMode && (
          <DialogFooter className="items-center border-t bg-muted/30 px-6 pt-4 pb-6 sm:pb-5 sm:justify-between">
            <div className="hidden items-center gap-1.5 text-muted-foreground text-xs sm:flex">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>GDG Jakarta Community Dashboard</span>
            </div>
            <Button onClick={handleClose} className="w-full sm:w-auto">
              {confirmText}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
