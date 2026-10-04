/**
 * Firebase Remote Config parameter keys matching the KawalEvent project specification.
 */
export const REMOTE_CONFIG_KEYS = {
  BEVY_COOKIE: "cfg_bevy_cookie",
  BEVY_X_CSRFTOKEN: "cfg_bevy_x_csrftoken",
  BEVY_REFERER_URL: "cfg_bevy_referer_url",
  ORGANIZER_EMAILS: "cfg_organizer_emails",
} as const;

export type RemoteConfigKey = (typeof REMOTE_CONFIG_KEYS)[keyof typeof REMOTE_CONFIG_KEYS];
