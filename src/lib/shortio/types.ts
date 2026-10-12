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
}

export interface UpdateShortLinkInput {
  originalURL?: string;
  path?: string;
  title?: string;
  folderId?: string | null;
  tags?: string[];
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
