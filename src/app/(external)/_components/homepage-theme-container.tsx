"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { ChevronLeft, Dices, Palette } from "lucide-react";

import {
  GOOGLE_THEME_KEYS,
  GOOGLE_THEMES,
  type GoogleThemeConfig,
  getRandomGoogleTheme,
} from "@/config/homepage-themes";
import { cn } from "@/lib/utils";

const SWITCHER_EXPANDED_STORAGE_KEY = "homepage-theme-switcher-expanded";

interface HomepageThemeContainerProps {
  initialTheme: GoogleThemeConfig;
  children: ReactNode;
}

export function HomepageThemeContainer({ initialTheme, children }: HomepageThemeContainerProps) {
  const [activeTheme, setActiveTheme] = useState<GoogleThemeConfig>(initialTheme);
  const [isExpanded, setIsExpanded] = useState(true);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Restore the last collapsed/expanded preference after hydration
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SWITCHER_EXPANDED_STORAGE_KEY);
      if (saved !== null) setIsExpanded(saved === "true");
    } catch {
      // Ignore storage access errors (e.g. private mode)
    }
  }, []);

  // Auto-collapse when user scrolls the page
  useEffect(() => {
    if (!isExpanded) return;

    const initialScrollY = window.scrollY;

    const handleScroll = () => {
      if (Math.abs(window.scrollY - initialScrollY) > 20) {
        setIsExpanded(false);
        try {
          window.localStorage.setItem(SWITCHER_EXPANDED_STORAGE_KEY, "false");
        } catch {
          // Ignore storage access errors
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isExpanded]);

  const toggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    // Keep keyboard focus on a visible control once the panel becomes inert
    if (!next) toggleRef.current?.focus();
    try {
      window.localStorage.setItem(SWITCHER_EXPANDED_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage access errors (e.g. private mode)
    }
  };

  // If navigating client-side, randomize on every new navigation if desired
  const handleShuffle = () => {
    let nextTheme = getRandomGoogleTheme();
    // Ensure we pick a different color on shuffle
    while (nextTheme.id === activeTheme.id && GOOGLE_THEME_KEYS.length > 1) {
      nextTheme = getRandomGoogleTheme();
    }
    setActiveTheme(nextTheme);
  };

  return (
    <div className="homepage-theme-wrapper relative flex flex-col gap-16 pb-16 transition-colors duration-500">
      <style>{`
        .homepage-theme-wrapper {
          --theme-primary: ${activeTheme.primary};
          --theme-primary-hover: ${activeTheme.primaryHover};
          --theme-primary-foreground: ${activeTheme.primaryForeground};
          --theme-text: ${activeTheme.textLight};
          --theme-bg-subtle: ${activeTheme.bgSubtleLight};
          --theme-border: ${activeTheme.borderLight};
          --theme-border-hover: ${activeTheme.borderHover};
          --theme-shadow: ${activeTheme.shadow};
          --theme-ring: ${activeTheme.ring};
          --primary: ${activeTheme.primary};
          --primary-foreground: ${activeTheme.primaryForeground};
          --ring: ${activeTheme.ring};
        }
        .dark .homepage-theme-wrapper,
        [data-theme-mode="dark"] .homepage-theme-wrapper {
          --theme-text: ${activeTheme.textDark};
          --theme-bg-subtle: ${activeTheme.bgSubtleDark};
          --theme-border: ${activeTheme.borderDark};
        }
      `}</style>

      {/* Floating Theme Palette Controller (Shows Active Google Core Color & Switcher) */}
      <aside aria-label="Google color theme switcher" className="fixed bottom-20 left-4 z-40 sm:bottom-6 sm:left-6">
        <div className="flex items-center rounded-full border border-border/80 bg-background/90 p-1.5 shadow-lg backdrop-blur-md transition-shadow hover:shadow-xl dark:bg-card/90">
          {/* Toggle: shows the active color and expands/collapses the switcher */}
          <button
            ref={toggleRef}
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            aria-label={isExpanded ? "Collapse theme switcher" : `Expand theme switcher (current: ${activeTheme.name})`}
            title={isExpanded ? "Collapse theme switcher" : activeTheme.name}
            className="flex size-7 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-300",
                isExpanded ? "size-3" : "size-5",
              )}
              style={{ backgroundColor: activeTheme.primary, color: activeTheme.primaryForeground }}
            >
              <Palette
                className={cn("size-3 transition-opacity duration-200", isExpanded ? "opacity-0" : "opacity-100")}
                aria-hidden="true"
              />
            </span>
          </button>

          {/* Collapsible panel */}
          <div
            id={panelId}
            inert={!isExpanded}
            className={cn(
              "grid transition-[grid-template-columns,opacity] duration-300 ease-out motion-reduce:transition-none",
              isExpanded ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
            )}
          >
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 whitespace-nowrap py-1 pr-0.5">
                <span className="pr-1 font-semibold text-xs tracking-tight">{activeTheme.name}</span>

                <div className="h-4 w-px bg-border" />

                {/* Color pickers for the 4 core Google colors */}
                <div className="flex items-center gap-1 px-1">
                  {GOOGLE_THEME_KEYS.map((key) => {
                    const theme = GOOGLE_THEMES[key];
                    const isSelected = activeTheme.id === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTheme(theme)}
                        title={`Switch to ${theme.name}`}
                        aria-label={`Switch to ${theme.name}`}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full transition-all hover:scale-110",
                          isSelected
                            ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background"
                            : "opacity-80 hover:opacity-100",
                        )}
                        style={{ backgroundColor: theme.primary }}
                      >
                        {isSelected && <span className="size-1.5 rounded-full bg-white dark:bg-black" />}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleShuffle}
                  title="Randomize theme"
                  aria-label="Randomize color theme"
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Dices className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={toggleExpanded}
                  title="Collapse theme switcher"
                  aria-label="Collapse theme switcher"
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {children}
    </div>
  );
}
