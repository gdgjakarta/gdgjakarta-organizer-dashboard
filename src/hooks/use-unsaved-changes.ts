"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

export interface UseUnsavedChangesOptions {
  hasChanges: boolean;
  onSave?: () => Promise<boolean | undefined>;
  onDiscard?: () => void;
}

export function useUnsavedChanges({ hasChanges, onSave, onDiscard }: UseUnsavedChangesOptions) {
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [isBackNav, setIsBackNav] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const bypassRef = useRef({ enabled: false });

  // Keep latest onSave/onDiscard in refs to prevent unnecessary re-attachments
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  // 1. Browser tab close & page reload protection
  useEffect(() => {
    if (!hasChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassRef.current.enabled) return;
      e.preventDefault();
      // Required returnValue pattern for standard cross-browser prompt
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges]);

  // 2. Client-side link click interceptor (captures clicks on <a> elements before navigation)
  useEffect(() => {
    if (!hasChanges) return;

    const handleClick = (e: MouseEvent) => {
      if (bypassRef.current.enabled) return;
      if (e.defaultPrevented) return;
      // Ignore non-primary or modified clicks (new tab / auxiliary click)
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      // Allow links opening in a new window/tab (e.g. Preview Live)
      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;

      // Allow file downloads
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore hash jumps and non-navigational protocols
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const currentUrl = new URL(window.location.href);
        const destUrl = new URL(href, window.location.href);

        // Same page navigation (same pathname and search) is not leaving the page
        if (
          destUrl.origin === currentUrl.origin &&
          destUrl.pathname === currentUrl.pathname &&
          destUrl.search === currentUrl.search
        ) {
          return;
        }

        // Block navigation and show unsaved changes dialog
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        setPendingUrl(href);
        setIsBackNav(false);
        setShowPrompt(true);
      } catch {
        // Ignore parsing errors for custom schemes
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [hasChanges]);

  // 3. Browser Back / Forward button navigation (popstate)
  useEffect(() => {
    if (!hasChanges) return;

    const handlePopState = () => {
      if (bypassRef.current.enabled) return;

      // Push current URL back so browser history does not navigate away immediately
      window.history.pushState(null, "", window.location.href);
      setIsBackNav(true);
      setPendingUrl(null);
      setShowPrompt(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasChanges]);

  const cancelNavigation = useCallback(() => {
    setShowPrompt(false);
    setPendingUrl(null);
    setIsBackNav(false);
  }, []);

  const proceedNavigation = useCallback(() => {
    bypassRef.current.enabled = true;
    setShowPrompt(false);

    if (isBackNav) {
      window.history.back();
    } else if (pendingUrl) {
      try {
        const dest = new URL(pendingUrl, window.location.href);
        if (dest.origin === window.location.origin) {
          router.push(dest.pathname + dest.search + dest.hash);
        } else {
          window.location.href = pendingUrl;
        }
      } catch {
        router.push(pendingUrl);
      }
    }
  }, [isBackNav, pendingUrl, router]);

  const confirmDiscardAndLeave = useCallback(() => {
    onDiscardRef.current?.();
    proceedNavigation();
  }, [proceedNavigation]);

  const confirmSaveAndLeave = useCallback(async () => {
    if (onSaveRef.current) {
      setIsSaving(true);
      try {
        const result = await onSaveRef.current();
        if (result === false) {
          setIsSaving(false);
          return;
        }
      } catch {
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }
    proceedNavigation();
  }, [proceedNavigation]);

  return {
    showPrompt,
    setShowPrompt,
    isSaving,
    cancelNavigation,
    confirmDiscardAndLeave,
    confirmSaveAndLeave,
  };
}
