import { getCloudflareContext } from "@opennextjs/cloudflare";

import { normalizeHostname, type ShortlinkProviderName } from "./types";

const DEFAULT_PRIMARY_DOMAIN = "gdgjakarta.org";
const DEFAULT_PRIMARY_DOMAIN_ID = 1516440;

export interface PrimaryDomainConfig {
  domain: string;
  domainId: number;
}

export interface ShortlinkBindings {
  db: D1Database;
  kv: KVNamespace;
  env: Record<string, unknown>;
}

/**
 * Safely reads the OpenNext Cloudflare environment bindings when running on Workers or platform proxy.
 */
export async function getOptionalCloudflareEnv(): Promise<Record<string, unknown> | null> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    if (typeof ctx.env === "object") {
      return ctx.env as unknown as Record<string, unknown>;
    }
  } catch {
    // getCloudflareContext throws outside Worker / OpenNext context (e.g., local Node scripts/tests)
  }
  return null;
}

function readDynamicEnvVar(cfEnv: Record<string, unknown> | null, key: string): string | undefined {
  const cfValue = cfEnv?.[key];
  if (typeof cfValue === "string" && cfValue.trim().length > 0) {
    return cfValue.trim();
  }
  const procValue = process.env[key];
  if (typeof procValue === "string" && procValue.trim().length > 0) {
    return procValue.trim();
  }
  return undefined;
}

/**
 * Resolves the active shortlink backend dynamically per call.
 * Defaults safely to "shortio" unless SHORTLINK_PROVIDER is explicitly "cloudflare".
 */
export async function getShortlinkProvider(): Promise<ShortlinkProviderName> {
  const cfEnv = await getOptionalCloudflareEnv();
  const raw = readDynamicEnvVar(cfEnv, "SHORTLINK_PROVIDER") ?? "shortio";
  return raw.toLowerCase() === "cloudflare" ? "cloudflare" : "shortio";
}

/**
 * Resolves D1 and KV bindings required when SHORTLINK_PROVIDER === "cloudflare".
 */
export async function getShortlinkBindings(): Promise<ShortlinkBindings> {
  const cfEnv = await getOptionalCloudflareEnv();
  if (!cfEnv) {
    throw new Error(
      "Cloudflare context is unavailable. SHORTLINKS_DB and SHORTLINKS_KV bindings require OpenNext/Cloudflare runtime.",
    );
  }

  const db = cfEnv.SHORTLINKS_DB as D1Database | undefined;
  if (!db) {
    throw new Error(
      "Cloudflare D1 binding 'SHORTLINKS_DB' is not available. Verify wrangler.jsonc d1_databases configuration.",
    );
  }

  const kv = cfEnv.SHORTLINKS_KV as KVNamespace | undefined;
  if (!kv) {
    throw new Error(
      "Cloudflare KV binding 'SHORTLINKS_KV' is not available. Verify wrangler.jsonc kv_namespaces configuration.",
    );
  }

  return { db, kv, env: cfEnv };
}

/**
 * Resolves the configured primary shortlink domain and numeric domain ID dynamically.
 */
export async function getPrimaryDomainConfig(): Promise<PrimaryDomainConfig> {
  const cfEnv = await getOptionalCloudflareEnv();
  const rawDomain = readDynamicEnvVar(cfEnv, "SHORTIO_DOMAIN") ?? DEFAULT_PRIMARY_DOMAIN;
  const rawDomainId = readDynamicEnvVar(cfEnv, "SHORTIO_DOMAIN_ID");
  const parsedId = rawDomainId ? Number(rawDomainId) : DEFAULT_PRIMARY_DOMAIN_ID;

  return {
    domain: normalizeHostname(rawDomain) || DEFAULT_PRIMARY_DOMAIN,
    domainId: Number.isInteger(parsedId) && parsedId > 0 ? parsedId : DEFAULT_PRIMARY_DOMAIN_ID,
  };
}

/**
 * Returns non-empty configured API keys accepted by /api/links/shorten.
 * Empty when neither SHORTLINK_API_KEY nor N8N_WEBHOOK_API_KEY is configured (fail-closed).
 */
export async function getShortlinkApiSecrets(): Promise<string[]> {
  const cfEnv = await getOptionalCloudflareEnv();
  const secrets = new Set<string>();
  const shortlinkKey = readDynamicEnvVar(cfEnv, "SHORTLINK_API_KEY");
  const n8nKey = readDynamicEnvVar(cfEnv, "N8N_WEBHOOK_API_KEY");
  if (shortlinkKey) secrets.add(shortlinkKey);
  if (n8nKey) secrets.add(n8nKey);
  return Array.from(secrets);
}

/**
 * Checks whether Short.io API credentials are available in the current runtime environment.
 */
export async function hasShortioCredentials(): Promise<boolean> {
  const cfEnv = await getOptionalCloudflareEnv();
  return Boolean(readDynamicEnvVar(cfEnv, "SHORTIO_API_KEY"));
}
