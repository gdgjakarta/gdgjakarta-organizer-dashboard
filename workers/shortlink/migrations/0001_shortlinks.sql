-- Cloudflare D1 Schema for GDG Jakarta Shortlinks (gdgjakarta-shortlinks)
-- Phase 2 Migration 0001

CREATE TABLE IF NOT EXISTS short_domains (
  id INTEGER PRIMARY KEY,
  hostname TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'configured',
  link_type TEXT NOT NULL DEFAULT 'custom',
  apple_app_site_association TEXT,
  asset_links TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS short_folders (
  id TEXT PRIMARY KEY,
  domain_id INTEGER NOT NULL REFERENCES short_domains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0693E3',
  icon TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain_id, name)
);

CREATE INDEX IF NOT EXISTS idx_short_folders_domain_id
  ON short_folders(domain_id);

CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  domain_id INTEGER NOT NULL REFERENCES short_domains(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL DEFAULT 'gdgjakarta.org',
  path TEXT NOT NULL,
  original_url TEXT NOT NULL,
  title TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  folder_id TEXT REFERENCES short_folders(id) ON DELETE SET NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  redirect_type INTEGER NOT NULL DEFAULT 302 CHECK (redirect_type IN (301, 302, 307, 308)),
  expires_at INTEGER,
  expired_url TEXT,
  password_hash TEXT,
  has_password INTEGER NOT NULL DEFAULT 0 CHECK (has_password IN (0, 1)),
  cloaking INTEGER NOT NULL DEFAULT 0 CHECK (cloaking IN (0, 1)),
  android_url TEXT,
  iphone_url TEXT,
  geo_targets_json TEXT NOT NULL DEFAULT '[]',
  utm_params_json TEXT,
  pixels_json TEXT,
  max_clicks INTEGER CHECK (max_clicks IS NULL OR max_clicks >= 0),
  clicks_count INTEGER NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  legacy_clicks INTEGER NOT NULL DEFAULT 0 CHECK (legacy_clicks >= 0),
  link_type TEXT NOT NULL DEFAULT 'redirect' CHECK (link_type IN ('redirect', 'split', 'bundle')),
  split_targets_json TEXT NOT NULL DEFAULT '[]',
  bundle_items_json TEXT NOT NULL DEFAULT '[]',
  owner_id INTEGER,
  owner_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(hostname, path)
);

CREATE INDEX IF NOT EXISTS idx_short_links_hostname_path
  ON short_links(hostname, path);

CREATE INDEX IF NOT EXISTS idx_short_links_folder_id
  ON short_links(folder_id);

CREATE INDEX IF NOT EXISTS idx_short_links_domain_archived_created
  ON short_links(domain_id, archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_short_links_original_url
  ON short_links(hostname, original_url);

CREATE TABLE IF NOT EXISTS short_link_clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  path TEXT NOT NULL,
  clicked_at INTEGER NOT NULL,
  country TEXT,
  city TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  referer TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
  variant_label TEXT,
  target_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_link_clicked_at
  ON short_link_clicks(link_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_hostname_clicked_at
  ON short_link_clicks(hostname, clicked_at DESC);
