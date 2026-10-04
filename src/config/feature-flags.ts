import type { NavBadge, NavGroup, NavMainItem, NavSubItem } from "@/navigation/sidebar/sidebar-items";

import { parseMappedConfigValue } from "./remote-config-utils";

/**
 * Feature flag configuration item for an individual feature or navigation item.
 */
export interface FeatureFlagItemConfig {
  /**
   * Controls whether the feature or navigation item is visible in the UI.
   * If omitted, the menu item remains visible by default.
   */
  visible?: boolean;

  /**
   * Badge label to display (e.g. "new", "soon", "beta").
   * Set to `null`, `""`, or `"none"` to explicitly remove the badge.
   * If omitted, the menu retains its default badge from code.
   */
  badge?: NavBadge | null;

  /**
   * Controls whether the feature or navigation item is disabled / unclickable.
   * If omitted, the menu retains its default disabled state from code.
   */
  disabled?: boolean;
}

/**
 * Map of feature identifiers or menu names to their configuration flags.
 * Only menus specified here will be modified; all other menus remain visible
 * with their default code configurations.
 *
 * Example:
 * {
 *   "Members": { "badge": null },
 *   "Others": { "visible": false },
 *   "Email Manager": { "badge": "new" }
 * }
 */
export type FeatureFlagsConfig = Record<string, FeatureFlagItemConfig>;

/**
 * Default feature flags is empty by design.
 * Unconfigured menu items remain completely visible and untouched.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagsConfig = {};

function parseBadgeValue(val: unknown): NavBadge | null | undefined {
  if (val === null || val === "" || val === "none") {
    return null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower === "preview" ||
      lower === "under development" ||
      lower === "under-development" ||
      lower === "under_development" ||
      lower === "dev" ||
      lower === "wip"
    ) {
      return "preview";
    }
    return trimmed as NavBadge;
  }
  return undefined;
}

function normalizeKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Matches a menu item with its corresponding feature flag.
 * Searches with the following precedence:
 * 1. Direct match on item ID (e.g. "members")
 * 2. Direct match on menu title/name (e.g. "Members", "Email Manager")
 * 3. Direct match on item URL (e.g. "/dashboard/members")
 * 4. Normalized match (case-insensitive, ignoring spaces and dashes)
 */
export function findItemFlag(
  id: string,
  title?: string,
  url?: string,
  flags?: FeatureFlagsConfig,
): FeatureFlagItemConfig | undefined {
  if (!flags || Object.keys(flags).length === 0) {
    return undefined;
  }

  // 1. Direct key lookups
  if (flags[id] !== undefined) return flags[id];
  if (title && flags[title] !== undefined) return flags[title];
  if (url && flags[url] !== undefined) return flags[url];

  // 2. Normalized lookups (case-insensitive & whitespace/delimiter-agnostic)
  const normalizedId = normalizeKey(id);
  const normalizedTitle = title ? normalizeKey(title) : undefined;
  const normalizedUrl = url ? normalizeKey(url.replace(/^\/dashboard\/?/, "").replace(/^\//, "")) : undefined;

  for (const [key, value] of Object.entries(flags)) {
    if (key.startsWith("$")) continue;

    const normalizedKey = normalizeKey(key);
    if (
      normalizedKey === normalizedId ||
      (normalizedTitle && normalizedKey === normalizedTitle) ||
      (normalizedUrl && normalizedKey === normalizedUrl)
    ) {
      return value;
    }
  }

  return undefined;
}

/**
 * Parses raw JSON string (or chapter-mapped array) from Remote Config into FeatureFlagsConfig.
 *
 * Supports:
 * 1. Standard JSON object: `{ "Members": { "badge": null } }`
 * 2. Boolean shorthand: `{ "Members": false }`
 * 3. Chapter mapped array: `[ { "key": "642", "value": "{...}" } ]`
 */
export function parseFeatureFlags(
  rawValue: string | null | undefined,
  chapterId?: string | number,
): FeatureFlagsConfig {
  if (!rawValue) {
    return DEFAULT_FEATURE_FLAGS;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return DEFAULT_FEATURE_FLAGS;
  }

  let resolvedJson = trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const mapped = parseMappedConfigValue(trimmed, chapterId);
    if (mapped) {
      resolvedJson = mapped.trim();
    }
  }

  try {
    const parsed = JSON.parse(resolvedJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_FEATURE_FLAGS;
    }

    const flagsRecord = parsed as Record<string, unknown>;
    const result: FeatureFlagsConfig = {};

    for (const [key, value] of Object.entries(flagsRecord)) {
      if (key.startsWith("$")) {
        // Skip comment or metadata properties
        continue;
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const item = value as Record<string, unknown>;
        result[key] = {
          visible: typeof item.visible === "boolean" ? item.visible : undefined,
          badge: parseBadgeValue(item.badge),
          disabled: typeof item.disabled === "boolean" ? item.disabled : undefined,
        };
      } else if (typeof value === "boolean") {
        result[key] = {
          visible: value,
        };
      }
    }

    return result;
  } catch (err) {
    console.warn("[Feature Flags] Failed to parse Remote Config JSON:", err);
    return DEFAULT_FEATURE_FLAGS;
  }
}

/**
 * Applies feature flags to navigation groups.
 * Any item without a matching flag remains completely visible and retains
 * its code-defined badge and disabled state.
 */
export function applyFeatureFlags(groups: readonly NavGroup[], flags: FeatureFlagsConfig): NavGroup[] {
  if (Object.keys(flags).length === 0) {
    return groups as NavGroup[];
  }

  const result: NavGroup[] = [];

  for (const group of groups) {
    const filteredItems: NavMainItem[] = [];

    for (const item of group.items) {
      const itemUrl = "url" in item && typeof item.url === "string" ? item.url : undefined;
      const flag = findItemFlag(item.id, item.title, itemUrl, flags);

      // 1. Check visibility (defaults to visible unless explicitly false)
      if (flag?.visible === false) {
        continue;
      }

      // 2. Resolve badge (retains code default unless explicitly specified)
      let badge = item.badge;
      if (flag !== undefined && "badge" in flag) {
        badge = flag.badge === null || flag.badge === "" || flag.badge === "none" ? undefined : flag.badge;
      }

      // 3. Resolve disabled (retains code default unless explicitly specified)
      let disabled = item.disabled;
      if (flag?.disabled !== undefined) {
        disabled = flag.disabled;
      }

      // 4. Handle nested sub-items if present
      if ("subItems" in item && Array.isArray(item.subItems)) {
        const filteredSubItems: NavSubItem[] = [];

        for (const sub of item.subItems) {
          const subFlag = findItemFlag(sub.id, sub.title, sub.url, flags);
          if (subFlag?.visible === false) {
            continue;
          }

          let subBadge = sub.badge;
          if (subFlag !== undefined && "badge" in subFlag) {
            subBadge =
              subFlag.badge === null || subFlag.badge === "" || subFlag.badge === "none" ? undefined : subFlag.badge;
          }

          const subDisabled = subFlag?.disabled !== undefined ? subFlag.disabled : sub.disabled;

          filteredSubItems.push({
            ...sub,
            badge: subBadge,
            disabled: subDisabled,
          });
        }

        filteredItems.push({
          ...item,
          badge,
          disabled,
          subItems: filteredSubItems,
        });
      } else {
        filteredItems.push({
          ...item,
          badge,
          disabled,
        });
      }
    }

    if (filteredItems.length > 0) {
      result.push({
        ...group,
        items: filteredItems,
      });
    }
  }

  return result;
}
