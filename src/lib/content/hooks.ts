"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import {
  getFaqContentDoc,
  getPartnershipContentDoc,
  saveFaqContentDoc,
  savePartnershipContentDoc,
  subscribeFaqContentDoc,
  subscribePartnershipContentDoc,
} from "@/lib/firestore/client";
import { revalidateDashboardPath } from "@/server/server-actions";

import { DEFAULT_FAQ_CONTENT, DEFAULT_PARTNERSHIP_CONTENT } from "./defaults";
import type { FaqContent, PartnershipContent } from "./types";

const LOCAL_STORAGE_FAQ_KEY = "gdg_faq_content_cache";
const LOCAL_STORAGE_PARTNERSHIP_KEY = "gdg_partnership_content_cache";

export function useFaqContent() {
  const [content, setContent] = useState<FaqContent>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_FAQ_KEY);
        if (cached) {
          return { ...DEFAULT_FAQ_CONTENT, ...JSON.parse(cached) };
        }
      } catch {
        // ignore cache parse error
      }
    }
    return DEFAULT_FAQ_CONTENT;
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // First fetch doc
    getFaqContentDoc()
      .then((data) => {
        if (isMounted && data) {
          setContent(data);
          try {
            localStorage.setItem(LOCAL_STORAGE_FAQ_KEY, JSON.stringify(data));
          } catch {
            // ignore storage quota
          }
        }
      })
      .catch((err) => {
        console.warn("[useFaqContent] getFaqContentDoc error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Subscribe to real-time changes
    const unsubscribe = subscribeFaqContentDoc((updated) => {
      if (isMounted && updated) {
        setContent(updated);
        try {
          localStorage.setItem(LOCAL_STORAGE_FAQ_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const saveContent = useCallback(async (newContent: FaqContent) => {
    setSaving(true);
    try {
      await saveFaqContentDoc(newContent);
      setContent(newContent);
      try {
        localStorage.setItem(LOCAL_STORAGE_FAQ_KEY, JSON.stringify(newContent));
      } catch {
        // ignore
      }
      await revalidateDashboardPath("/faq");
      await revalidateDashboardPath("/dashboard/faq");
      toast.success("FAQ content saved successfully!", {
        description: "Your changes are now live across GDG Jakarta.",
      });
      return true;
    } catch (err) {
      console.error("[useFaqContent] save error:", err);
      toast.error("Failed to save FAQ content", {
        description: err instanceof Error ? err.message : "Please check your network connection.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    return saveContent(DEFAULT_FAQ_CONTENT);
  }, [saveContent]);

  return {
    content,
    setContent,
    loading,
    saving,
    saveContent,
    resetToDefaults,
  };
}

export function usePartnershipContent() {
  const [content, setContent] = useState<PartnershipContent>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_PARTNERSHIP_KEY);
        if (cached) {
          return { ...DEFAULT_PARTNERSHIP_CONTENT, ...JSON.parse(cached) };
        }
      } catch {
        // ignore cache parse error
      }
    }
    return DEFAULT_PARTNERSHIP_CONTENT;
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial doc
    getPartnershipContentDoc()
      .then((data) => {
        if (isMounted && data) {
          setContent(data);
          try {
            localStorage.setItem(LOCAL_STORAGE_PARTNERSHIP_KEY, JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        console.warn("[usePartnershipContent] getPartnershipContentDoc error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Subscribe to real-time changes
    const unsubscribe = subscribePartnershipContentDoc((updated) => {
      if (isMounted && updated) {
        setContent(updated);
        try {
          localStorage.setItem(LOCAL_STORAGE_PARTNERSHIP_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const saveContent = useCallback(async (newContent: PartnershipContent) => {
    setSaving(true);
    try {
      await savePartnershipContentDoc(newContent);
      setContent(newContent);
      try {
        localStorage.setItem(LOCAL_STORAGE_PARTNERSHIP_KEY, JSON.stringify(newContent));
      } catch {
        // ignore
      }
      await revalidateDashboardPath("/partnership");
      await revalidateDashboardPath("/dashboard/partnership");
      toast.success("Partnership content saved successfully!", {
        description: "Your changes are now live across GDG Jakarta.",
      });
      return true;
    } catch (err) {
      console.error("[usePartnershipContent] save error:", err);
      toast.error("Failed to save Partnership content", {
        description: err instanceof Error ? err.message : "Please check your network connection.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    return saveContent(DEFAULT_PARTNERSHIP_CONTENT);
  }, [saveContent]);

  return {
    content,
    setContent,
    loading,
    saving,
    saveContent,
    resetToDefaults,
  };
}
