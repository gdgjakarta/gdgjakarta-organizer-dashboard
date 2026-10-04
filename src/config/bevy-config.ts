/**
 * Bevy API Integration Configuration
 *
 * Credentials (CSRF token & session cookie) are migrated to Firebase Remote Config
 * (`cfg_bevy_cookie`, `cfg_bevy_x_csrftoken`) matching KawalEvent.
 * The environment variables BEVY_CSRF_TOKEN and BEVY_COOKIE serve as local and deployment fallbacks.
 */
export const BEVY_CONFIG = {
  baseUrl: process.env.BEVY_API_BASE_URL || "https://gdg.community.dev/api",
  chapterSlug: process.env.BEVY_CHAPTER_SLUG || "gdg-jakarta",
  chapterId: process.env.BEVY_CHAPTER_ID || "642",
  apiToken: process.env.BEVY_API_TOKEN,
  defaultCsrfToken: process.env.BEVY_CSRF_TOKEN || "",
  defaultCookie: process.env.BEVY_COOKIE || "",

  /**
   * Synchronous fallback getter for CSRF token.
   * Prefer using async `getBevyCsrfToken()` from "@/config/remote-config" for dynamic resolution.
   */
  get csrfToken() {
    return process.env.BEVY_CSRF_TOKEN || this.defaultCsrfToken;
  },

  /**
   * Synchronous fallback getter for Cookie.
   * Prefer using async `getBevyCookie()` from "@/config/remote-config" for dynamic resolution.
   */
  get cookie() {
    return process.env.BEVY_COOKIE || this.defaultCookie;
  },
};

export {
  getBevyAuthCredentials,
  getBevyCookie,
  getBevyCsrfToken,
  getBevyRefererUrl,
  REMOTE_CONFIG_KEYS,
} from "./remote-config";
