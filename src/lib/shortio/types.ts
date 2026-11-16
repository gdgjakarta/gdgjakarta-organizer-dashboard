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
}

export interface CreateShortLinkInput {
  originalURL: string;
  path?: string;
  title?: string;
  folderId?: string;
  tags?: string[];
  password?: string;
  cloaking?: boolean;
  redirectType?: 301 | 302 | 307 | 308;
  expiresAt?: string | number | null;
  expiredURL?: string | null;
  androidURL?: string | null;
  iphoneURL?: string | null;
}

export interface UpdateShortLinkInput {
  originalURL?: string;
  path?: string;
  title?: string;
  folderId?: string | null;
  tags?: string[];
  password?: string;
  cloaking?: boolean;
  redirectType?: 301 | 302 | 307 | 308;
  expiresAt?: string | number | null;
  expiredURL?: string | null;
  androidURL?: string | null;
  iphoneURL?: string | null;
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
}

export type StatsPeriod = "today" | "week" | "month" | "last7" | "last30" | "total";

export interface ShortDomain {
  id: number;
  hostname: string;
  state: string;
  linkType?: string;
  createdAt?: string;
}

export interface BulkImportRow {
  originalURL: string;
  path?: string;
  title?: string;
  tags?: string[];
}
