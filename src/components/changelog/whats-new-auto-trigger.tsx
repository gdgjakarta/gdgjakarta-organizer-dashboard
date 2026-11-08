"use client";

import { useEffect, useState } from "react";

import { ChangelogDialog } from "@/components/changelog/changelog-dialog";
import {
  type ChangelogRelease,
  CURRENT_APP_VERSION,
  getChangelogDiff,
  LAST_SEEN_VERSION_STORAGE_KEY,
} from "@/config/changelog";

export function WhatsNewAutoTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [diffReleases, setDiffReleases] = useState<ChangelogRelease[]>([]);

  useEffect(() => {
    try {
      const lastSeenVersion = window.localStorage.getItem(LAST_SEEN_VERSION_STORAGE_KEY);

      // If already on the current version, do nothing
      if (lastSeenVersion === CURRENT_APP_VERSION) {
        return;
      }

      // Compute diff (either from cutoff date or > lastSeenVersion)
      const diff = getChangelogDiff(lastSeenVersion);

      if (diff.length > 0) {
        setDiffReleases(diff);
        setIsOpen(true);
      } else {
        // Mark current version if no diff items
        window.localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
      }
    } catch (_e) {
      // Ignore localStorage errors (e.g. private mode or SSR)
    }
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
    } catch (_e) {
      // Ignore localStorage errors
    }
    setIsOpen(false);
  };

  if (!isOpen || diffReleases.length === 0) {
    return null;
  }

  return (
    <ChangelogDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleDismiss();
        } else {
          setIsOpen(true);
        }
      }}
      releases={diffReleases}
      title="What's New in GDG Jakarta"
      confirmText="Got it, explore"
      onConfirm={handleDismiss}
    />
  );
}
