/**
 * Global API Request & Response Logger
 * Logs URL, method, request headers & body, and response headers & body in beautified JSON.
 */

export interface ApiLogPayload {
  timestamp: string;
  url: string;
  method: string;
  durationMs?: number;
  request: {
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number | null;
    statusText: string | null;
    headers: Record<string, string>;
    body: unknown;
  };
}

export function formatHeaders(
  headers?: Headers | Record<string, unknown> | [string, string][] | null,
): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  if (typeof headers === "object") {
    if (typeof (headers as Headers).entries === "function") {
      try {
        return Object.fromEntries((headers as Headers).entries());
      } catch {
        // Fall back to iterating or property extraction
      }
    }
    if (typeof (headers as Headers).forEach === "function") {
      const result: Record<string, string> = {};
      (headers as Headers).forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v !== undefined && v !== null) {
        result[k] = String(v);
      }
    }
    return result;
  }
  return {};
}

export function tryParseJson(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }
  return value;
}

export function serializeRequestBody(body: unknown): unknown {
  if (!body) return null;
  if (typeof body === "string") {
    return tryParseJson(body);
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const entries: Record<string, string> = {};
    body.forEach((val, key) => {
      if (typeof val === "string") {
        entries[key] = val;
      } else if (typeof File !== "undefined" && val instanceof File) {
        entries[key] = `[File: ${val.name}, ${val.size} bytes, ${val.type}]`;
      } else {
        entries[key] = "[Blob/File]";
      }
    });
    return { _type: "FormData", entries };
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries());
  }
  return body;
}

export function serializeResponseBody(text: string, contentType?: string | null): unknown {
  if (!text) return null;
  if (
    contentType &&
    (contentType.includes("image/") ||
      contentType.includes("octet-stream") ||
      contentType.includes("audio/") ||
      contentType.includes("video/"))
  ) {
    return `[Binary content: ${contentType}]`;
  }
  return tryParseJson(text);
}

export function logApiTransaction(params: {
  url: string;
  method?: string;
  requestHeaders?: Headers | Record<string, unknown> | [string, string][] | null;
  requestBody?: unknown;
  responseStatus?: number;
  responseStatusText?: string;
  responseHeaders?: Headers | Record<string, unknown> | [string, string][] | null;
  responseBody?: unknown;
  durationMs?: number;
  error?: unknown;
}) {
  const method = (params.method ?? "GET").toUpperCase();
  const requestHeaders = formatHeaders(params.requestHeaders);
  const requestBody = serializeRequestBody(params.requestBody);

  const responseHeaders = formatHeaders(params.responseHeaders);
  const responseBody =
    typeof params.responseBody === "string"
      ? serializeResponseBody(params.responseBody, responseHeaders["content-type"])
      : (params.responseBody ?? null);

  const payload: ApiLogPayload = {
    timestamp: new Date().toISOString(),
    url: params.url,
    method,
    ...(typeof params.durationMs === "number" ? { durationMs: params.durationMs } : {}),
    request: {
      headers: requestHeaders,
      body: requestBody ?? null,
    },
    response: {
      status: params.responseStatus ?? null,
      statusText: params.responseStatusText ?? null,
      headers: responseHeaders,
      body: responseBody ?? (params.error ? { error: String(params.error) } : null),
    },
  };

  console.log(`[API Call Details]\n${JSON.stringify(payload, null, 2)}`);
}

/**
 * Initializes global fetch interception to log all incoming & outgoing API calls
 * in beautified JSON format. Skips internal Next.js assets/HMR requests.
 */
export function initGlobalApiLogger() {
  if (typeof globalThis === "undefined" || typeof globalThis.fetch !== "function") return;

  // Prevent multiple patching
  if ((globalThis.fetch as { __isApiLoggerPatched?: boolean }).__isApiLoggerPatched) {
    return;
  }

  const originalFetch = globalThis.fetch;

  const patchedFetch: typeof fetch = async (input, init) => {
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === "object" && "url" in input) {
      url = (input as { url: string }).url;
    }

    // Skip Next.js internal chunks, static assets, hot reload, fonts, and data URIs
    if (
      !url ||
      url.includes("/_next/") ||
      url.includes("__nextjs") ||
      url.includes(".hot-update.") ||
      url.startsWith("data:") ||
      url.includes("/favicon") ||
      url.endsWith(".woff") ||
      url.endsWith(".woff2") ||
      url.endsWith(".ttf") ||
      url.endsWith(".css")
    ) {
      return originalFetch(input, init);
    }

    // Resolve relative URL to full URL if in browser
    if (url.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
      url = `${window.location.origin}${url}`;
    }

    const method = init?.method || (input instanceof Request ? input.method : "GET");
    const startTime = Date.now();

    // Extract request headers
    let requestHeaders: Headers | Record<string, unknown> | [string, string][] | null = null;
    if (init?.headers) {
      requestHeaders = init.headers as Headers | Record<string, unknown>;
    } else if (input instanceof Request) {
      requestHeaders = input.headers;
    }

    // Extract request body
    let requestBody: unknown = init?.body;
    if (!requestBody && input instanceof Request) {
      try {
        requestBody = await input.clone().text();
      } catch {
        /* stream reading not possible */
      }
    }

    try {
      const response = await originalFetch(input, init);
      const durationMs = Date.now() - startTime;

      // Read response body safely via clone, avoiding hanging on streams
      let responseBody: unknown = null;
      const cType = response.headers.get("content-type") || "";
      if (cType.includes("event-stream") || cType.includes("stream")) {
        responseBody = "[Streaming Response]";
      } else {
        try {
          const cloned = response.clone();
          const text = await cloned.text();
          responseBody = serializeResponseBody(text, cType);
        } catch {
          /* Response body cannot be cloned or is closed */
        }
      }

      logApiTransaction({
        url,
        method,
        requestHeaders,
        requestBody,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseHeaders: response.headers,
        responseBody,
        durationMs,
      });

      return response;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logApiTransaction({
        url,
        method,
        requestHeaders,
        requestBody,
        error: err,
        durationMs,
      });
      throw err;
    }
  };

  (patchedFetch as { __isApiLoggerPatched?: boolean }).__isApiLoggerPatched = true;
  globalThis.fetch = patchedFetch;
}

// Auto-initialize if running in Node or browser
if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
  initGlobalApiLogger();
}
