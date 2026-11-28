export type ShortlinkProviderName = "cloudflare" | "shortio";

export type ShortLinkType = "redirect" | "split" | "bundle";

export type RedirectStatusCode = 301 | 302 | 307 | 308;

export interface GeoTargetRule {
  country: string;
  url: string;
  region?: string;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface LinkPixelConfig {
  metaPixelId?: string;
  gtmId?: string;
  ga4Id?: string;
}

export interface SplitTestTarget {
  url: string;
  weight: number;
  label: string;
}

export interface LinkBundleItem {
  title: string;
  url: string;
  description?: string;
  icon?: string;
}

export interface CityStat {
  city: string;
  country?: string;
  score: number;
}

export interface ClickStreamEntry {
  id: string;
  linkId: string;
  hostname: string;
  path: string;
  clickedAt: number;
  country?: string | null;
  city?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  referer?: string | null;
  isBot: boolean;
  variantLabel?: string | null;
  targetUrl?: string | null;
}

export interface EdgeShortLinkRecord {
  id: string;
  domainId: number;
  hostname: string;
  path: string;
  originalURL: string;
  redirectType: RedirectStatusCode;
  archived: boolean;
  expiresAt: number | null;
  expiredURL?: string | null;
  passwordHash?: string | null;
  cloaking: boolean;
  androidURL?: string | null;
  iphoneURL?: string | null;
  geoTargets?: GeoTargetRule[];
  utmParams?: UtmParams | null;
  pixels?: LinkPixelConfig | null;
  maxClicks?: number | null;
  linkType: ShortLinkType;
  splitTargets?: SplitTestTarget[];
  bundleItems?: LinkBundleItem[];
  title?: string | null;
  folderId?: string | null;
  tags?: string[];
  updatedAt?: string;
}

export interface EdgeDomainConfig {
  id: number;
  hostname: string;
  state: string;
  linkType?: string | null;
  appleAppSiteAssociation?: string | null;
  assetLinks?: string | null;
  updatedAt?: string;
}

export interface ShortlinkWorkerEnv {
  SHORTLINKS_KV: KVNamespace;
  SHORTLINKS_DB: D1Database;
  SHORTLINK_API_KEY?: string;
  SHORTLINK_COOKIE_SECRET?: string;
  SHORTLINK_PROVIDER?: string;
}

export const DOMAIN_CONFIG_KV_KEY_SUFFIX = "__domain__";

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

export function normalizeSlugPath(path: string): string {
  return path.trim().replace(/^\/+/, "");
}

export function buildLinkKvKey(hostname: string, path: string): string {
  return `${normalizeHostname(hostname)}:${normalizeSlugPath(path)}`;
}

export function buildDomainKvKey(hostname: string): string {
  return `${normalizeHostname(hostname)}:${DOMAIN_CONFIG_KV_KEY_SUFFIX}`;
}

export interface D1ShortDomainRow {
  id: number;
  hostname: string;
  state: string;
  link_type: string;
  apple_app_site_association: string | null;
  asset_links: string | null;
  created_at: string;
  updated_at: string;
}

export interface D1ShortFolderRow {
  id: string;
  domain_id: number;
  name: string;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface D1ShortLinkRow {
  id: string;
  domain_id: number;
  hostname: string;
  path: string;
  original_url: string;
  title: string | null;
  tags_json: string;
  folder_id: string | null;
  archived: number;
  redirect_type: number;
  expires_at: number | null;
  expired_url: string | null;
  password_hash: string | null;
  has_password: number;
  cloaking: number;
  android_url: string | null;
  iphone_url: string | null;
  geo_targets_json: string;
  utm_params_json: string | null;
  pixels_json: string | null;
  max_clicks: number | null;
  clicks_count: number;
  legacy_clicks: number;
  link_type: ShortLinkType;
  split_targets_json: string;
  bundle_items_json: string;
  owner_id: number | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface D1ShortLinkClickRow {
  id: string;
  link_id: string;
  hostname: string;
  path: string;
  clicked_at: number;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  referer: string | null;
  is_bot: number;
  variant_label: string | null;
  target_url: string | null;
}
