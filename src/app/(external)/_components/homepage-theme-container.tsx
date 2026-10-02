"use client";

import { type ReactNode, useState } from "react";

import { Dices } from "lucide-react";

import {
  GOOGLE_THEME_KEYS,
  GOOGLE_THEMES,
  type GoogleThemeConfig,
  getRandomGoogleTheme,
} from "@/config/homepage-themes";
import { cn } from "@/lib/utils";

interface HomepageThemeContainerProps {
  initialTheme: GoogleThemeConfig;
  children: ReactNode;
}

export function HomepageThemeContainer({ initialTheme, children }: HomepageThemeContainerProps) {
  const [activeTheme, setActiveTheme] = useState<GoogleThemeConfig>(initialTheme);

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
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/90 p-1.5 shadow-lg backdrop-blur-md transition-all hover:shadow-xl dark:bg-card/90">
          <div className="flex items-center gap-1.5 pl-2 pr-1">
            <span
              className="size-3 rounded-full transition-transform duration-300 hover:scale-125"
              style={{ backgroundColor: activeTheme.primary }}
            />
            <span className="font-semibold text-xs tracking-tight">{activeTheme.name}</span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Color pickers for the 4 core Google colors */}
          <div className="flex items-center gap-1">
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
        </div>
      </aside>

      {children}
    </div>
  );
}
