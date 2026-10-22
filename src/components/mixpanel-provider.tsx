"use client";

import { useEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import { identifyMixpanelUser, initMixpanel, resetMixpanelUser, trackMixpanelEvent } from "@/lib/mixpanel";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function MixpanelProvider() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const prevUserIdRef = useRef<string | null>(null);

  // Initialize Mixpanel once on client mount
  useEffect(() => {
    initMixpanel();
  }, []);

  // Track page views on route transitions
  useEffect(() => {
    if (pathname) {
      trackMixpanelEvent("$pageview", {
        path: pathname,
        url: typeof window !== "undefined" ? window.location.href : pathname,
      });
    }
  }, [pathname]);

  // Sync authenticated user with Mixpanel identity
  useEffect(() => {
    if (user?.id) {
      if (prevUserIdRef.current !== user.id) {
        prevUserIdRef.current = user.id;
        identifyMixpanelUser(user.id, {
          $name: user.name,
          $email: user.email,
          $avatar: user.avatar,
          role: user.role,
          chapter_role: user.chapterRole,
        });
      }
    } else if (prevUserIdRef.current) {
      prevUserIdRef.current = null;
      resetMixpanelUser();
    }
  }, [user]);

  return null;
}
