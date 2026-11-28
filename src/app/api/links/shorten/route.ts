import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import type { ShortLinkItem } from "@/lib/shortio/types";
import { timingSafeEqualHex } from "@/lib/shortlinks/crypto";
import { ShortlinkConflictError, ShortlinkNotFoundError, ShortlinkValidationError } from "@/lib/shortlinks/d1-store";
import { getShortlinkApiSecrets } from "@/lib/shortlinks/env";
import {
  createShortLinkViaProvider,
  findShortLinkByOriginalUrlViaProvider,
  getShortLinkByPathViaProvider,
} from "@/lib/shortlinks/provider";

export const dynamic = "force-dynamic";

const textEncoder = new TextEncoder();

function hasAsciiControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function isValidHttpUrl(raw: string): boolean {
  if (hasAsciiControlChar(raw)) {
    return false;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

const httpUrlSchema = z
  .string()
  .refine(isValidHttpUrl, { message: "Must be a valid http:// or https:// URL without control characters" })
  .transform((val) => val.trim());

const optionalHttpUrlSchema = z
  .union([
    z.literal(""),
    z.null(),
    z
      .string()
      .refine((val) => !hasAsciiControlChar(val), {
        message: "URL must not contain control characters",
      })
      .transform((val) => val.trim())
      .refine((val) => val === "" || isValidHttpUrl(val), {
        message: "Must be a valid http:// or https:// URL",
      }),
  ])
  .optional();

const shortenBodySchema = z.object({
  originalURL: httpUrlSchema,
  path: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  title: z.string().trim().optional(),
  tags: z.array(z.string().trim()).optional(),
  folderId: z.string().trim().optional(),
  hostname: z.string().trim().optional(),
  domain: z.string().trim().optional(),
  redirectType: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
  password: z.string().optional(),
  cloaking: z.boolean().optional(),
  expiresAt: z.union([z.string(), z.number(), z.null()]).optional(),
  expiredURL: optionalHttpUrlSchema,
  androidURL: optionalHttpUrlSchema,
  iphoneURL: optionalHttpUrlSchema,
  geoTargets: z
    .array(
      z.object({
        country: z.string().trim().length(2),
        url: httpUrlSchema,
        region: z.string().trim().optional(),
      }),
    )
    .optional(),
  utmParams: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      term: z.string().optional(),
      content: z.string().optional(),
    })
    .nullable()
    .optional(),
  pixels: z
    .object({
      metaPixelId: z.string().optional(),
      gtmId: z.string().optional(),
      ga4Id: z.string().optional(),
    })
    .nullable()
    .optional(),
  maxClicks: z.number().int().nonnegative().nullable().optional(),
  linkType: z.enum(["redirect", "split", "bundle"]).optional(),
  splitTargets: z
    .array(
      z.object({
        url: httpUrlSchema,
        weight: z.number().positive(),
        label: z.string().trim().min(1),
      }),
    )
    .optional(),
  bundleItems: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: httpUrlSchema,
        description: z.string().optional(),
        icon: z.string().optional(),
      }),
    )
    .optional(),
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function extractPresentedApiKey(req: NextRequest): string {
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match?.[1]?.trim() ?? "";
}

async function isAuthorizedApiRequest(req: NextRequest): Promise<boolean> {
  const configuredSecrets = await getShortlinkApiSecrets();
  if (configuredSecrets.length === 0) {
    return false;
  }
  const presented = extractPresentedApiKey(req);
  if (!presented) {
    return false;
  }

  const presentedDigest = await sha256Hex(presented);
  let matched = false;
  for (const secret of configuredSecrets) {
    const secretDigest = await sha256Hex(secret);
    if (timingSafeEqualHex(presentedDigest, secretDigest)) {
      matched = true;
    }
  }
  return matched;
}

function sanitizeLinkForResponse(link: ShortLinkItem | null): ShortLinkItem | null {
  if (!link) return null;
  const clone = { ...link } as ShortLinkItem & { password_hash?: unknown; passwordHash?: unknown };
  delete clone.password_hash;
  delete clone.passwordHash;
  return clone;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorizedApiRequest(req))) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing API key." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = shortenBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request payload." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  try {
    const created = await createShortLinkViaProvider({
      originalURL: input.originalURL,
      path: input.path || input.slug || undefined,
      title: input.title,
      tags: input.tags,
      folderId: input.folderId,
      hostname: input.hostname || input.domain || undefined,
      redirectType: input.redirectType,
      password: input.password,
      cloaking: input.cloaking,
      expiresAt: input.expiresAt,
      expiredURL: input.expiredURL || undefined,
      androidURL: input.androidURL || undefined,
      iphoneURL: input.iphoneURL || undefined,
      geoTargets: input.geoTargets,
      utmParams: input.utmParams,
      pixels: input.pixels,
      maxClicks: input.maxClicks,
      linkType: input.linkType,
      splitTargets: input.splitTargets,
      bundleItems: input.bundleItems,
    });

    const sanitized = sanitizeLinkForResponse(created);
    if (!sanitized) {
      return NextResponse.json({ error: "Failed to create short link." }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        link: sanitized,
        data: sanitized,
        id: sanitized.id,
        idString: sanitized.idString,
        shortURL: sanitized.shortURL,
        path: sanitized.path,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ShortlinkConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ShortlinkValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ShortlinkNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to create short link.";
    if (/already exists|duplicate|conflict/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorizedApiRequest(req))) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing API key." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const pathParam = (searchParams.get("path") ?? searchParams.get("slug") ?? "").trim();
  const rawOriginalUrlParam = searchParams.get("originalURL") ?? "";
  const originalUrlParam = rawOriginalUrlParam.trim();
  const domainParam = (searchParams.get("domain") ?? searchParams.get("hostname") ?? "").trim() || undefined;

  if (!pathParam && !originalUrlParam) {
    return NextResponse.json(
      { error: "Provide either 'path' (or 'slug') or 'originalURL' query parameter." },
      { status: 400 },
    );
  }

  if (!pathParam && rawOriginalUrlParam && !isValidHttpUrl(rawOriginalUrlParam)) {
    return NextResponse.json({ error: "originalURL must be a valid http:// or https:// URL." }, { status: 400 });
  }

  try {
    const found = pathParam
      ? await getShortLinkByPathViaProvider(pathParam, domainParam)
      : await findShortLinkByOriginalUrlViaProvider(originalUrlParam, domainParam);

    const sanitized = sanitizeLinkForResponse(found);
    return NextResponse.json(
      {
        success: true,
        link: sanitized,
        data: sanitized,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof ShortlinkValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to look up short link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
