export interface GoogleThemeConfig {
  id: "red" | "yellow" | "green" | "blue";
  name: string;
  hex: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  textLight: string;
  textDark: string;
  bgSubtleLight: string;
  bgSubtleDark: string;
  borderLight: string;
  borderDark: string;
  borderHover: string;
  shadow: string;
  ring: string;
}

export const GOOGLE_THEMES: Record<GoogleThemeConfig["id"], GoogleThemeConfig> = {
  red: {
    id: "red",
    name: "Google Red",
    hex: "#EA4335",
    primary: "#EA4335",
    primaryHover: "#D93025",
    primaryForeground: "#FFFFFF",
    textLight: "#B3261E",
    textDark: "#F28B82",
    bgSubtleLight: "#FDF2F0",
    bgSubtleDark: "rgba(234, 67, 53, 0.08)",
    borderLight: "rgba(234, 67, 53, 0.22)",
    borderDark: "rgba(234, 67, 53, 0.28)",
    borderHover: "#EA4335",
    shadow: "0 14px 34px -8px rgba(234, 67, 53, 0.28)",
    ring: "rgba(234, 67, 53, 0.4)",
  },
  yellow: {
    id: "yellow",
    name: "Google Yellow",
    hex: "#F9AB00",
    primary: "#F9AB00",
    primaryHover: "#E37400",
    primaryForeground: "#202124",
    textLight: "#995200",
    textDark: "#FDD663",
    bgSubtleLight: "#FEFAF0",
    bgSubtleDark: "rgba(249, 171, 0, 0.08)",
    borderLight: "rgba(249, 171, 0, 0.25)",
    borderDark: "rgba(249, 171, 0, 0.32)",
    borderHover: "#F9AB00",
    shadow: "0 14px 34px -8px rgba(249, 171, 0, 0.28)",
    ring: "rgba(249, 171, 0, 0.4)",
  },
  green: {
    id: "green",
    name: "Google Green",
    hex: "#34A853",
    primary: "#34A853",
    primaryHover: "#1E8E3E",
    primaryForeground: "#FFFFFF",
    textLight: "#0D652D",
    textDark: "#81C995",
    bgSubtleLight: "#F1F8F3",
    bgSubtleDark: "rgba(52, 168, 83, 0.08)",
    borderLight: "rgba(52, 168, 83, 0.22)",
    borderDark: "rgba(52, 168, 83, 0.28)",
    borderHover: "#34A853",
    shadow: "0 14px 34px -8px rgba(52, 168, 83, 0.28)",
    ring: "rgba(52, 168, 83, 0.4)",
  },
  blue: {
    id: "blue",
    name: "Google Blue",
    hex: "#4285F4",
    primary: "#4285F4",
    primaryHover: "#1A73E8",
    primaryForeground: "#FFFFFF",
    textLight: "#174EA6",
    textDark: "#8AB4F8",
    bgSubtleLight: "#F4F8FE",
    bgSubtleDark: "rgba(66, 133, 244, 0.08)",
    borderLight: "rgba(66, 133, 244, 0.22)",
    borderDark: "rgba(66, 133, 244, 0.28)",
    borderHover: "#4285F4",
    shadow: "0 14px 34px -8px rgba(66, 133, 244, 0.28)",
    ring: "rgba(66, 133, 244, 0.4)",
  },
};

export const GOOGLE_THEME_KEYS = ["red", "yellow", "green", "blue"] as const;

export function getRandomGoogleTheme(): GoogleThemeConfig {
  const randomIndex = Math.floor(Math.random() * GOOGLE_THEME_KEYS.length);
  const key = GOOGLE_THEME_KEYS[randomIndex];
  return GOOGLE_THEMES[key];
}

export function getGoogleThemeByKey(key?: string | null): GoogleThemeConfig {
  if (key && key in GOOGLE_THEMES) {
    return GOOGLE_THEMES[key as GoogleThemeConfig["id"]];
  }
  return getRandomGoogleTheme();
}
