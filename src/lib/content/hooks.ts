"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import { revalidateDashboardPath } from "@/server/server-actions";

import { DEFAULT_FAQ_CONTENT, DEFAULT_PARTNERSHIP_CONTENT } from "./defaults";
import type { FaqContent, PartnershipContent } from "./types";

// NOTE: `@/lib/firestore/client` is always loaded via dynamic `import()` so that
// `firebase/firestore` never ends up in the server / Cloudflare Worker bundle (see dev-note.md).

type ContentKind = "faq" | "partnership";

interface ContentConfig<T> {
  cacheKey: string;
  defaults: T;
  revalidatePaths: string[];
  label: string;
  load: () => Promise<T | null>;
  save: (content: T) => Promise<void>;
  subscribe: (onUpdate: (content: T) => void) => Promise<() => void>;
}

const CONFIGS: { faq: ContentConfig<FaqContent>; partnership: ContentConfig<PartnershipContent> } = {
  faq: {
    cacheKey: "gdg_faq_content_cache",
    defaults: DEFAULT_FAQ_CONTENT,
    revalidatePaths: ["/faq", "/dashboard/faq"],
    label: "FAQ",
    load: async () => (await import("@/lib/firestore/client")).getFaqContentDoc(),
    save: async (content) => (await import("@/lib/firestore/client")).saveFaqContentDoc(content),
    subscribe: async (onUpdate) => (await import("@/lib/firestore/client")).subscribeFaqContentDoc(onUpdate),
  },
  partnership: {
    cacheKey: "gdg_partnership_content_cache",
    defaults: DEFAULT_PARTNERSHIP_CONTENT,
    revalidatePaths: ["/partnership", "/dashboard/partnership"],
    label: "Partnership",
    load: async () => (await import("@/lib/firestore/client")).getPartnershipContentDoc(),
    save: async (content) => (await import("@/lib/firestore/client")).savePartnershipContentDoc(content),
    subscribe: async (onUpdate) => (await import("@/lib/firestore/client")).subscribePartnershipContentDoc(onUpdate),
  },
};

function writeCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy-mode errors; cache is best-effort only.
  }
}

export function fastCanonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(fastCanonicalStringify).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys
    .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${fastCanonicalStringify((obj as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

function useContent<T extends object>(config: ContentConfig<T>) {
  // Always start from defaults so server and client render the same markup (no hydration mismatch).
  const [content, setContent] = useState<T>(config.defaults);
  const [savedContent, setSavedContent] = useState<T>(config.defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasUserEditedRef = useRef({ edited: false });

  const hasChanges = useMemo(() => {
    return fastCanonicalStringify(content) !== fastCanonicalStringify(savedContent);
  }, [content, savedContent]);

  const updateContent: typeof setContent = useCallback((value) => {
    hasUserEditedRef.current.edited = true;
    setContent(value);
  }, []);

  const discardChanges = useCallback(() => {
    setContent(savedContent);
    hasUserEditedRef.current.edited = false;
  }, [savedContent]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    try {
      const cached = localStorage.getItem(config.cacheKey);
      if (cached) {
        const parsed = { ...config.defaults, ...(JSON.parse(cached) as Partial<T>) };
        setContent(parsed);
        setSavedContent(parsed);
      }
    } catch {
      // Ignore malformed cache.
    }

    const apply = (data: T) => {
      if (!isMounted) return;
      const merged = { ...config.defaults, ...data };
      if (!hasUserEditedRef.current.edited) {
        setContent(merged);
        setSavedContent(merged);
      } else {
        setSavedContent(merged);
      }
      writeCache(config.cacheKey, merged);
    };

    config
      .load()
      .then((data) => {
        if (data) apply(data);
      })
      .catch((err: unknown) => console.warn(`[use${config.label}Content] load error:`, err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    config
      .subscribe(apply)
      .then((unsub) => {
        if (isMounted) unsubscribe = unsub;
        else unsub();
      })
      .catch((err: unknown) => console.warn(`[use${config.label}Content] subscribe error:`, err));

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [config]);

  const saveContent = useCallback(
    async (newContent: T) => {
      setSaving(true);
      try {
        await config.save(newContent);
        setContent(newContent);
        setSavedContent(newContent);
        hasUserEditedRef.current.edited = false;
        writeCache(config.cacheKey, newContent);
        await Promise.all(config.revalidatePaths.map((p) => revalidateDashboardPath(p)));
        toast.success(`${config.label} content saved`, {
          description: "Your changes are now live on the public page.",
        });
        return true;
      } catch (err) {
        console.error(`[use${config.label}Content] save error:`, err);
        toast.error(`Failed to save ${config.label} content`, {
          description: err instanceof Error ? err.message : "Please check your connection and permissions.",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [config],
  );

  const resetToDefaults = useCallback(() => saveContent(config.defaults), [saveContent, config]);

  return {
    content,
    setContent: updateContent,
    savedContent,
    hasChanges,
    discardChanges,
    loading,
    saving,
    saveContent,
    resetToDefaults,
  };
}

export function useFaqContent() {
  return useContent(CONFIGS.faq);
}

export function usePartnershipContent() {
  return useContent(CONFIGS.partnership);
}

export type { ContentKind };
