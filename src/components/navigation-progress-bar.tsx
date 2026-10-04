"use client";

import { createContext, type ReactNode, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavigationProgressContextType {
  isNavigating: boolean;
  pendingUrl: string | null;
  startNavigation: (url?: string) => void;
  finishNavigation: () => void;
}

const NavigationProgressContext = createContext<NavigationProgressContextType>({
  isNavigating: false,
  pendingUrl: null,
  startNavigation: () => undefined,
  finishNavigation: () => undefined,
});

export function useNavigationProgress() {
  return useContext(NavigationProgressContext);
}

export function triggerNavigationStart(url?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:navigation-start", { detail: { url } }));
  }
}

export function triggerNavigationEnd() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:navigation-end"));
  }
}

function NavigationRouteListener({ onRouteChanged }: { onRouteChanged: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const renderedPathRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const searchStr = searchParams.toString();
    const current = pathname + (searchStr ? `?${searchStr}` : "");
    if (renderedPathRef.current === undefined) {
      renderedPathRef.current = current;
      return;
    }
    if (renderedPathRef.current !== current) {
      renderedPathRef.current = current;
      onRouteChanged();
    }
  }, [pathname, searchParams, onRouteChanged]);

  return null;
}

function ProgressBarVisual({ progress, status }: { progress: number; status: "idle" | "loading" | "completing" }) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="pointer-events-none fixed top-0 right-0 left-0 z-[99999] h-[3px]"
    >
      <div
        className={cn(
          "relative h-full bg-primary shadow-xs transition-[width] duration-200 ease-out",
          status === "completing" && "opacity-0 transition-opacity delay-150 duration-300",
        )}
        style={{
          width: `${progress}%`,
          boxShadow: "0 0 10px var(--primary), 0 0 4px var(--primary)",
        }}
      >
        <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/20 to-white/40 opacity-80" />
      </div>
    </div>
  );
}

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "completing">("idle");
  const [progress, setProgress] = useState(0);

  const timersRef = useRef<{
    trickler?: ReturnType<typeof setInterval>;
    safetyTimeout?: ReturnType<typeof setTimeout>;
    completionTimer?: ReturnType<typeof setTimeout>;
    isNavigating?: boolean;
  }>({});

  const finishNavigation = useCallback(() => {
    if (timersRef.current.trickler !== undefined) {
      clearInterval(timersRef.current.trickler);
      timersRef.current.trickler = undefined;
    }
    if (timersRef.current.safetyTimeout !== undefined) {
      clearTimeout(timersRef.current.safetyTimeout);
      timersRef.current.safetyTimeout = undefined;
    }

    if (!timersRef.current.isNavigating) {
      return;
    }
    timersRef.current.isNavigating = false;

    setProgress(100);
    setStatus("completing");
    setIsNavigating(false);
    setPendingUrl(null);

    if (timersRef.current.completionTimer !== undefined) {
      clearTimeout(timersRef.current.completionTimer);
    }

    timersRef.current.completionTimer = setTimeout(() => {
      setStatus("idle");
      setProgress(0);
    }, 450);
  }, []);

  const startNavigation = useCallback(
    (url?: string) => {
      if (timersRef.current.completionTimer !== undefined) {
        clearTimeout(timersRef.current.completionTimer);
        timersRef.current.completionTimer = undefined;
      }
      if (timersRef.current.trickler !== undefined) {
        clearInterval(timersRef.current.trickler);
      }
      if (timersRef.current.safetyTimeout !== undefined) {
        clearTimeout(timersRef.current.safetyTimeout);
      }

      timersRef.current.isNavigating = true;
      setIsNavigating(true);
      if (url) {
        setPendingUrl(url);
      }
      setStatus("loading");
      setProgress(20);

      timersRef.current.trickler = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 92) return prev;
          if (prev < 45) return prev + 12;
          if (prev < 68) return prev + 6;
          if (prev < 82) return prev + 3;
          return prev + 1;
        });
      }, 180);

      timersRef.current.safetyTimeout = setTimeout(() => {
        finishNavigation();
      }, 10000);
    },
    [finishNavigation],
  );

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented) return;

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      if (
        anchor.getAttribute("aria-disabled") === "true" ||
        anchor.hasAttribute("disabled") ||
        anchor.classList.contains("disabled") ||
        anchor.closest("[aria-disabled='true']")
      ) {
        return;
      }

      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return;
      }

      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(href, window.location.href);

        if (targetUrl.origin !== currentUrl.origin) return;

        if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
          return;
        }

        startNavigation(targetUrl.pathname);
      } catch {
        // Ignore parsing errors for non-standard links
      }
    }

    function handlePopState() {
      startNavigation(window.location.pathname);
    }

    function handleCustomStart(e: Event) {
      const detail = (e as CustomEvent<{ url?: string }>).detail;
      startNavigation(detail?.url);
    }

    function handleCustomEnd() {
      finishNavigation();
    }

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("app:navigation-start", handleCustomStart);
    window.addEventListener("app:navigation-end", handleCustomEnd);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("app:navigation-start", handleCustomStart);
      window.removeEventListener("app:navigation-end", handleCustomEnd);
      if (timersRef.current.trickler !== undefined) {
        clearInterval(timersRef.current.trickler);
      }
      if (timersRef.current.safetyTimeout !== undefined) {
        clearTimeout(timersRef.current.safetyTimeout);
      }
      if (timersRef.current.completionTimer !== undefined) {
        clearTimeout(timersRef.current.completionTimer);
      }
    };
  }, [startNavigation, finishNavigation]);

  return (
    <NavigationProgressContext.Provider
      value={{
        isNavigating,
        pendingUrl,
        startNavigation,
        finishNavigation,
      }}
    >
      <ProgressBarVisual progress={progress} status={status} />
      <Suspense fallback={null}>
        <NavigationRouteListener onRouteChanged={finishNavigation} />
      </Suspense>
      {children}
    </NavigationProgressContext.Provider>
  );
}
