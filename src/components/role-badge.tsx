"use client";

import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RoleBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "role"> {
  role?: string | null;
  /** Fallback label if role is missing or empty (default: "Member") */
  fallback?: string;
  /** Whether to render a colored status dot indicator (default: true) */
  showDot?: boolean;
  /** Visual badge size */
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * Formats a raw role string into a clean, capitalized, title-cased display label.
 * Handles snake_case, kebab-case, and preserves recognized roles like "Co-Organizer" and "Check-in Staff".
 */
export function formatRoleTitle(role?: string | null, fallback = "Member"): string {
  if (!role || typeof role !== "string") return fallback;
  const trimmed = role.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();

  // Known canonical mappings
  if (lower === "organizer") return "Organizer";
  if (lower === "core_team" || lower === "core-team" || lower === "core team") return "Core Team";
  if (lower === "googler") return "Googler";
  if (lower === "member") return "Member";
  if (lower === "admin") return "Admin";
  if (lower === "lead_organizer" || lower === "lead-organizer" || lower === "lead organizer") return "Lead Organizer";
  if (lower === "co_organizer" || lower === "co-organizer" || lower === "co organizer") return "Co-Organizer";
  if (lower === "check_in_staff" || lower === "checkin_staff" || lower === "check-in staff") return "Check-in Staff";
  if (lower === "chapter_lead" || lower === "chapter lead") return "Chapter Lead";

  // General Title Case conversion while preserving hyphenated compounds if already present
  return trimmed
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join("-");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Resolves color palette tokens for a given role based on the GDG Brand Palette and semantic styles.
 */
export function getRoleColorConfig(role?: string | null) {
  const normalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, " ");

  // Organizer / Lead (Official GDG Blue)
  if (normalized.includes("organizer") || normalized.includes("lead")) {
    return {
      badgeClass:
        "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300",
      dotClass: "bg-blue-600 dark:bg-blue-400",
    };
  }

  // Core Team (Purple / Violet)
  if (normalized.includes("core") || normalized.includes("team")) {
    return {
      badgeClass:
        "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-300",
      dotClass: "bg-purple-600 dark:bg-purple-400",
    };
  }

  // Googler (Google Red)
  if (normalized.includes("google")) {
    return {
      badgeClass:
        "border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300",
      dotClass: "bg-red-600 dark:bg-red-400",
    };
  }

  // Admin (Indigo)
  if (normalized.includes("admin")) {
    return {
      badgeClass:
        "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300",
      dotClass: "bg-indigo-600 dark:bg-indigo-400",
    };
  }

  // Staff / Check-in (Google Yellow / Amber)
  if (normalized.includes("staff") || normalized.includes("check")) {
    return {
      badgeClass:
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-300",
      dotClass: "bg-amber-600 dark:bg-amber-400",
    };
  }

  // Speaker / Presenter (Cyan)
  if (normalized.includes("speaker") || normalized.includes("presenter")) {
    return {
      badgeClass:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/20 dark:text-cyan-300",
      dotClass: "bg-cyan-600 dark:bg-cyan-400",
    };
  }

  // Volunteer / Contributor (Rose / Pink)
  if (normalized.includes("volunteer") || normalized.includes("contributor")) {
    return {
      badgeClass:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-300",
      dotClass: "bg-rose-600 dark:bg-rose-400",
    };
  }

  // Member / Default (Google Green / Emerald)
  return {
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300",
    dotClass: "bg-emerald-600 dark:bg-emerald-400",
  };
}

const SIZE_STYLES = {
  sm: {
    badge: "h-4.5 px-2 text-[10px] gap-1 font-medium",
    dot: "size-1",
  },
  default: {
    badge: "h-5 px-2.5 text-xs gap-1.5 font-medium",
    dot: "size-1.5",
  },
  lg: {
    badge: "h-6 px-3 text-xs gap-1.5 font-semibold",
    dot: "size-2",
  },
} as const;

export function RoleBadge({
  role,
  fallback = "Member",
  showDot = true,
  size = "default",
  className,
  ...props
}: RoleBadgeProps) {
  const displayTitle = formatRoleTitle(role, fallback);
  const colorConfig = getRoleColorConfig(role ?? displayTitle);
  const sizeConfig = SIZE_STYLES[size] ?? SIZE_STYLES.default;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border font-medium capitalize tracking-normal shadow-xs transition-colors",
        sizeConfig.badge,
        colorConfig.badgeClass,
        className,
      )}
      {...props}
    >
      {showDot && (
        <span className={cn("shrink-0 rounded-full", sizeConfig.dot, colorConfig.dotClass)} aria-hidden="true" />
      )}
      <span>{displayTitle}</span>
    </Badge>
  );
}
