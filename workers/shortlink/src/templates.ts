import type { LinkBundleItem, LinkPixelConfig } from "@/lib/shortlinks/types";

const META_PIXEL_REGEX = /^\d{5,20}$/;
const GTM_REGEX = /^GTM-[A-Z0-9]{4,12}$/;
const GA4_REGEX = /^G-[A-Z0-9]{6,16}$/;

const GDG_LOGO_SVG = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
  <rect width="36" height="36" rx="10" fill="#0F172A"/>
  <path d="M9 12L17 18L9 24" stroke="#4285F4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 12L26 18L18 24" stroke="#34A853" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const BASE_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    background: radial-gradient(circle at top right, #e8f0fe 0%, #f8fafc 55%, #ffffff 100%);
    color: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 480px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
  }
  .brand-name {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
    color: #0f172a;
  }
  .brand-sub {
    font-size: 12px;
    color: #64748b;
  }
  h1 {
    margin: 0 0 10px;
    font-size: 22px;
    line-height: 1.25;
    color: #0f172a;
  }
  p {
    margin: 0 0 18px;
    font-size: 14px;
    line-height: 1.6;
    color: #475569;
    word-break: break-word;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 11px 16px;
    border-radius: 10px;
    border: none;
    background: #1a73e8;
    color: #ffffff;
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
  }
  .btn:hover { background: #1557b0; }
  .pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #334155;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    margin-bottom: 12px;
  }
  .error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 13px;
    margin-bottom: 14px;
  }
  input[type="password"] {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 14px;
    margin-bottom: 12px;
    outline: none;
  }
  input[type="password"]:focus {
    border-color: #1a73e8;
    box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.16);
  }
  .bundle-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
  }
  .bundle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #0f172a;
    text-decoration: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .bundle-item:hover {
    border-color: #1a73e8;
    background: #eff6ff;
  }
  .bundle-title { font-weight: 600; font-size: 14px; }
  .bundle-desc { font-size: 12px; color: #64748b; margin-top: 3px; }
  .bundle-arrow { color: #1a73e8; font-weight: 700; font-size: 16px; }
  .footer {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid #f1f5f9;
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
  }
  .footer a { color: #475569; text-decoration: none; }
`;

export function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

export function serializeJsString(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function sanitizePixels(pixels: LinkPixelConfig | null | undefined): LinkPixelConfig | null {
  if (!pixels || typeof pixels !== "object") {
    return null;
  }

  const sanitized: LinkPixelConfig = {};
  if (typeof pixels.metaPixelId === "string") {
    const candidate = pixels.metaPixelId.trim();
    if (META_PIXEL_REGEX.test(candidate)) {
      sanitized.metaPixelId = candidate;
    }
  }
  if (typeof pixels.gtmId === "string") {
    const candidate = pixels.gtmId.trim().toUpperCase();
    if (GTM_REGEX.test(candidate)) {
      sanitized.gtmId = candidate;
    }
  }
  if (typeof pixels.ga4Id === "string") {
    const candidate = pixels.ga4Id.trim().toUpperCase();
    if (GA4_REGEX.test(candidate)) {
      sanitized.ga4Id = candidate;
    }
  }

  if (!sanitized.metaPixelId && !sanitized.gtmId && !sanitized.ga4Id) {
    return null;
  }
  return sanitized;
}

export function buildPixelHeadSnippets(pixels: LinkPixelConfig | null): string {
  if (!pixels) {
    return "";
  }

  const snippets: string[] = [];

  if (pixels.metaPixelId) {
    const safeId = serializeJsString(pixels.metaPixelId);
    snippets.push(`<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${safeId});
fbq('track', 'PageView');
</script>`);
  }

  if (pixels.gtmId) {
    const safeId = serializeJsString(pixels.gtmId);
    snippets.push(`<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
j.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(i)+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${safeId});
</script>`);
  }

  if (pixels.ga4Id) {
    const escapedId = escapeHtml(pixels.ga4Id);
    const safeId = serializeJsString(pixels.ga4Id);
    snippets.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${escapedId}"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${safeId});
</script>`);
  }

  return snippets.join("\n");
}

function buildPageShell(params: { title: string; body: string; headExtra?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
  <style>${BASE_STYLES}</style>
  ${params.headExtra ?? ""}
</head>
<body>
  <main class="card">
    <div class="brand">
      ${GDG_LOGO_SVG}
      <div>
        <div class="brand-name">GDG Jakarta</div>
        <div class="brand-sub">gdgjakarta.org</div>
      </div>
    </div>
    ${params.body}
    <div class="footer">
      <a href="https://gdgjakarta.com">gdgjakarta.com</a>
    </div>
  </main>
</body>
</html>`;
}

export function renderNotFoundPage(pathname: string): Response {
  const safePath = escapeHtml(pathname || "/");
  const html = buildPageShell({
    title: "Link Not Found — GDG Jakarta",
    body: `
      <span class="pill">404 &middot; ${safePath}</span>
      <h1>Short link not found</h1>
      <p>The link <strong>${safePath}</strong> does not exist or has been archived by GDG Jakarta organizers.</p>
      <a class="btn" href="https://gdgjakarta.com">Visit GDG Jakarta</a>
    `,
  });

  return new Response(html, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

export function renderExpiredPage(title?: string | null): Response {
  const heading = title ? `${escapeHtml(title)} has expired` : "This link has expired";
  const html = buildPageShell({
    title: "Link Expired — GDG Jakarta",
    body: `
      <span class="pill">410 &middot; Link Expired</span>
      <h1>${heading}</h1>
      <p>This GDG Jakarta short link is no longer active because its expiration window or click limit has been reached.</p>
      <a class="btn" href="https://gdgjakarta.com">Go to GDG Jakarta</a>
    `,
  });

  return new Response(html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

export function renderPasswordPromptPage(params: {
  title?: string | null;
  slug: string;
  errorMessage?: string | null;
  status?: number;
}): Response {
  const safeTitle = escapeHtml(params.title || "Protected Link");
  const safeSlug = escapeHtml(params.slug);
  const errorBanner = params.errorMessage
    ? `<div class="error" role="alert">${escapeHtml(params.errorMessage)}</div>`
    : "";
  const html = buildPageShell({
    title: `${safeTitle} — Password Required`,
    body: `
      <span class="pill">/${safeSlug}</span>
      <h1>Password Required</h1>
      <p>Enter the access password to continue to <strong>${safeTitle}</strong>.</p>
      ${errorBanner}
      <form method="POST">
        <input type="password" name="password" placeholder="Enter password" required autocomplete="current-password" aria-label="Link password" />
        <button class="btn" type="submit">Unlock Link</button>
      </form>
    `,
  });

  return new Response(html, {
    status: params.status ?? 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    },
  });
}

export function renderCloakPage(params: {
  targetUrl: string;
  title?: string | null;
  pixels?: LinkPixelConfig | null;
}): Response {
  const safeUrl = escapeHtml(params.targetUrl);
  const safeTitle = escapeHtml(params.title || "GDG Jakarta");
  const pixelHead = buildPixelHeadSnippets(params.pixels ?? null);
  const csp = params.pixels
    ? "default-src 'none'; script-src 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com; img-src https: data:; connect-src https:; style-src 'unsafe-inline'; frame-src https: http:"
    : "default-src 'none'; style-src 'unsafe-inline'; frame-src https: http:";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
    .fallback { padding: 16px; text-align: center; font-size: 14px; }
  </style>
  ${pixelHead}
</head>
<body>
  <iframe src="${safeUrl}" title="${safeTitle}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen>
    <p class="fallback">Unable to embed destination. <a href="${safeUrl}" rel="noopener noreferrer">Continue to ${safeTitle}</a>.</p>
  </iframe>
  <noscript><p class="fallback"><a href="${safeUrl}" rel="noopener noreferrer">Open ${safeTitle}</a></p></noscript>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": csp,
    },
  });
}

export function renderPixelInterstitialPage(params: {
  targetUrl: string;
  title?: string | null;
  pixels: LinkPixelConfig;
}): Response {
  const safeUrl = escapeHtml(params.targetUrl);
  const safeTitle = escapeHtml(params.title || "Redirecting — GDG Jakarta");
  const jsTarget = serializeJsString(params.targetUrl);
  const pixelHead = buildPixelHeadSnippets(params.pixels);

  const html = buildPageShell({
    title: safeTitle,
    headExtra: `${pixelHead}\n<meta http-equiv="refresh" content="1;url=${safeUrl}" />`,
    body: `
      <span class="pill">Redirecting&hellip;</span>
      <h1>Taking you to your destination</h1>
      <p>If your browser does not redirect automatically in a moment, use the button below.</p>
      <a class="btn" href="${safeUrl}" rel="noopener noreferrer">Continue</a>
      <script>setTimeout(function(){window.location.replace(${jsTarget});}, 180);</script>
    `,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com; img-src https: data:; connect-src https:; style-src 'unsafe-inline'",
    },
  });
}

export function renderBundlePage(params: {
  title?: string | null;
  items: LinkBundleItem[];
  pixels?: LinkPixelConfig | null;
}): Response {
  const safeTitle = escapeHtml(params.title || "GDG Jakarta Links");
  const pixelHead = buildPixelHeadSnippets(params.pixels ?? null);
  const csp = params.pixels
    ? "default-src 'none'; script-src 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com; img-src https: data:; connect-src https:; style-src 'unsafe-inline'"
    : "default-src 'none'; style-src 'unsafe-inline'";

  const itemsHtml =
    params.items.length > 0
      ? params.items
          .map((item) => {
            const safeItemUrl = escapeHtml(item.url);
            const safeItemTitle = escapeHtml(item.title || item.url);
            const iconPrefix = item.icon ? `${escapeHtml(item.icon)} ` : "";
            const descHtml = item.description ? `<div class="bundle-desc">${escapeHtml(item.description)}</div>` : "";
            return `<a class="bundle-item" href="${safeItemUrl}" rel="noopener noreferrer">
              <div>
                <div class="bundle-title">${iconPrefix}${safeItemTitle}</div>
                ${descHtml}
              </div>
              <span class="bundle-arrow" aria-hidden="true">&rarr;</span>
            </a>`;
          })
          .join("\n")
      : `<p>No active links are currently listed in this bundle.</p>`;

  const html = buildPageShell({
    title: safeTitle,
    headExtra: pixelHead,
    body: `
      <span class="pill">Link Bundle</span>
      <h1>${safeTitle}</h1>
      <div class="bundle-list">
        ${itemsHtml}
      </div>
    `,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": csp,
    },
  });
}
