import type {
  CityStat,
  ClickStreamEntry,
  GeoTargetRule,
  LinkBundleItem,
  LinkPixelConfig,
  RedirectStatusCode,
  ShortLinkType,
  ShortlinkProviderName,
  SplitTestTarget,
  UtmParams,
} from "@/lib/shortlinks/types";

export type {
  CityStat,
  ClickStreamEntry,
  GeoTargetRule,
  LinkBundleItem,
  LinkPixelConfig,
  RedirectStatusCode,
  ShortLinkType,
  ShortlinkProviderName,
  SplitTestTarget,
  UtmParams,
} from "@/lib/shortlinks/types";

export interface ShortFolder {
  id: string;
  name: string;
  color: string;
  icon?: string;
  DomainId: number;
}

export interface ShortLinkItem {
  id: string;
  idString: string;
  shortURL: string;
  secureShortURL: string;
  originalURL: string;
  path: string;
  displayPath?: string | null;
  title?: string;
  tags?: string[];
  FolderId?: string;
  DomainId?: number;
  OwnerId?: number;
  createdAt: string;
  updatedAt?: string;
  archived?: boolean;
  clicks?: number;
  cloaking?: boolean;
  hasPassword?: boolean;
  redirectType?: string;
  expiresAt?: string | number | null;
  expiredURL?: string | null;
  androidURL?: string | null;
  iphoneURL?: string | null;
  User?: {
    id: number;
    name: string;
    email: string;
    photoURL?: string;
  };
  hostname?: string;
  linkType?: ShortLinkType;
  maxClicks?: number | null;
  clicksCount?: number;
  legacyClicks?: number;
  geoTargets?: GeoTargetRule[];
  utmParams?: UtmParams | null;
  pixels?: LinkPixelConfig | null;
  splitTargets?: SplitTestTarget[];
  bundleItems?: LinkBundleItem[];
}

export interface CreateShortLinkInput {
  originalURL: string;
  path?: string;
  title?: string;
  folderId?: string;
  tags?: string[];
  password?: string;
  cloaking?: boolean;
  redirectType?: RedirectStatusCode;
  expiresAt?: string | number | null;
  expiredURL?: string | null;
  androidURL?: string | null;
  iphoneURL?: string | null;
  hostname?: string;
  linkType?: ShortLinkType;
  maxClicks?: number | null;
  geoTargets?: GeoTargetRule[];
  utmParams?: UtmParams | null;
  pixels?: LinkPixelConfig | null;
  splitTargets?: SplitTestTarget[];
  bundleItems?: LinkBundleItem[];
}

export interface UpdateShortLinkInput {
  originalURL?: string;
  path?: string;
  title?: string;
  folderId?: string | null;
  tags?: string[];
  password?: string;
  cloaking?: boolean;
  redirectType?: RedirectStatusCode;
  expiresAt?: string | number | null;
  expiredURL?: string | null;
  androidURL?: string | null;
  iphoneURL?: string | null;
  hostname?: string;
  linkType?: ShortLinkType;
  maxClicks?: number | null;
  clearPassword?: boolean;
  geoTargets?: GeoTargetRule[] | null;
  utmParams?: UtmParams | null;
  pixels?: LinkPixelConfig | null;
  splitTargets?: SplitTestTarget[] | null;
  bundleItems?: LinkBundleItem[] | null;
}

export interface CreateShortFolderInput {
  name: string;
  color?: string;
}

export interface EventShortLinksStatus {
  liveShortLink?: ShortLinkItem | null;
  bevyShortLink?: ShortLinkItem | null;
}

export interface ShortLinkListResponse {
  count: number;
  links: ShortLinkItem[];
  nextPageToken?: string;
}

export interface ClickStats {
  totalClicks?: number;
  humanClicks?: number;
  clicks?: number;
  clickStatistics?: { datasets?: { data: { x: string; y: string }[] }[] };
  country?: { country: string; countryName?: string; score: number }[];
  browser?: { browser: string; score: number }[];
  os?: { os: string; score: number }[];
  device?: { device: string; score: number }[];
  referer?: { referer: string; score: number }[];
  cities?: CityStat[];
  clickstream?: ClickStreamEntry[];
  legacyClicks?: number;
}

export type StatsPeriod = "today" | "week" | "month" | "last7" | "last30" | "total";

export interface ShortDomain {
  id: number;
  hostname: string;
  state: string;
  linkType?: string;
  createdAt?: string;
  appleAppSiteAssociation?: string | null;
  assetLinks?: string | null;
  updatedAt?: string;
  provider?: ShortlinkProviderName;
}

export interface BulkImportRow {
  originalURL: string;
  path?: string;
  title?: string;
  tags?: string[];
}
