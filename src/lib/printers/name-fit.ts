// Name handling for thermal badge labels: HTML escaping, abbreviations (`[[nameShort]]`, `[[nameInitials]]`)
// and the in-page script that shrinks / abbreviates a name that does not fit its box.

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  // Square brackets are escaped too so a value like "[[qr]]" can never be re-read as a template token.
  "[": "&#91;",
  "]": "&#93;",
};

/** Escapes a plain-text value so it is safe to place in label HTML (text or attribute context). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'[\]]/g, (char) => HTML_ESCAPES[char] ?? char);
}

function nameWords(name: string): string[] {
  return name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function initialOf(word: string): string {
  return `${(Array.from(word)[0] ?? "").toLocaleUpperCase()}.`;
}

function isShortPrefix(word: string): boolean {
  return word.replace(/\./g, "").length <= 2;
}

/**
 * Returns how many leading words must be kept whole:
 * always at least 2 words AND always past any leading short prefixes (e.g. "R. M. Muhammad ..." keeps 3 words: "R. M. Muhammad").
 */
function leadingKeepCount(w: string[]): number {
  const firstRealIdx = w.findIndex((word) => !isShortPrefix(word));
  if (firstRealIdx === -1) return Math.min(2, w.length);
  return Math.min(w.length, Math.max(2, firstRealIdx + 1));
}

/**
 * Generates readable single-line name candidates in priority order:
 * 1. Full name
 * 2. Abbreviate trailing words from the right while keeping leading prefixes + first real name (at least 2 words) whole
 *    (e.g. "R. M. Muhammad Dzaka Muharam Wiraharjasakti" -> "R. M. Muhammad D. M. W.")
 * 3. Drop excess trailing initials while keeping the head whole ("R. M. Muhammad D. M." -> "R. M. Muhammad D." -> "R. M. Muhammad")
 * 4. Final fallback if even 2 words overflow: keep first word + initial of second (only if word 1 is not a short prefix like "R.")
 */
export function buildNameCandidates(name: string): string[] {
  const w = nameWords(name);
  if (w.length === 0) return [];
  if (w.length === 1) return [w[0]];

  const keepMin = leadingKeepCount(w);
  const candidates: string[] = [w.join(" ")];
  const trailingCount = w.length - keepMin;

  // Abbreviate trailing words from the right while keeping the head whole
  for (let k = 1; k <= trailingCount; k++) {
    candidates.push([...w.slice(0, w.length - k), ...w.slice(w.length - k).map(initialOf)].join(" "));
  }

  // Drop excess trailing initials one by one while keeping the head whole
  const keptHead = w.slice(0, keepMin);
  const trailingInitials = w.slice(keepMin).map(initialOf);
  for (let keepTail = trailingInitials.length - 1; keepTail >= 0; keepTail--) {
    candidates.push([...keptHead, ...trailingInitials.slice(0, keepTail)].join(" "));
  }

  // Final fallback if the 2 kept words alone are still too wide
  if (!isShortPrefix(w[0])) {
    candidates.push(`${w[0]} ${initialOf(w[1])}`);
    candidates.push(w[0]);
  }

  return candidates.filter((v, i, all) => all.indexOf(v) === i);
}

/**
 * Abbreviates the last `count` words (default 1), keeping leading prefixes + first real name whole:
 * "R. M. Muhammad Dzaka" -> "R. M. Muhammad D.".
 */
export function shortenName(name: string, count = 1): string {
  const words = nameWords(name);
  if (words.length < 2) return name.trim();
  const firstRealIdx = words.findIndex((word) => !isShortPrefix(word));
  const keepMin = firstRealIdx > 0 ? Math.min(words.length, firstRealIdx + 1) : 1;
  const maxAbbreviate = Math.max(0, words.length - keepMin);
  if (maxAbbreviate === 0) return words.join(" ");
  const abbreviated = Math.min(Math.max(count, 1), maxAbbreviate);
  return [
    ...words.slice(0, words.length - abbreviated),
    ...words.slice(words.length - abbreviated).map(initialOf),
  ].join(" ");
}

/** "Muhammad Fachridan Tamami" -> "M. F. T." */
export function initialsOf(name: string): string {
  return nameWords(name).map(initialOf).join(" ");
}

export const NAME_FIT_SCRIPT_ID = "gdg-name-fit";

/**
 * Runs inside the label document (headless Chrome for the worker, the iframe for the preview).
 *
 * For every `.attendee-name` / `[data-fit-name]` element it tries, in order: the full name, the last word as an
 * initial (`Muhammad Fachridan T.`), then one more word from the back each time (`Muhammad F. T.`), and finally
 * all initials (`M. F. T.`), keeping the first that fits in `data-fit-lines` lines (default 2). The font size is NOT
 * changed unless the element sets `data-fit-min` (pt): then each variant is also tried at smaller sizes down to
 * that minimum before moving on to the next, shorter variant. A single word (nothing to abbreviate) is truncated
 * with an ellipsis instead. Tunable per element: `data-fit-lines`, `data-fit-min`.
 * Keep the abbreviation rules in sync with shortenName/initialsOf above.
 */
const NAME_FIT_SCRIPT = `
(function () {
  var STEP_PT = 0.25;
  var DEFAULT_LINES = 2;

  function words(text) { return text.replace(/\\s+/g, " ").trim().split(" ").filter(Boolean); }
  function initial(word) { return (Array.from(word)[0] || "").toLocaleUpperCase() + "."; }
  function isShortPrefix(word) { return word.replace(/\\./g, "").length <= 2; }
  function leadingKeepCount(w) {
    var firstRealIdx = -1;
    for (var idx = 0; idx < w.length; idx++) {
      if (!isShortPrefix(w[idx])) { firstRealIdx = idx; break; }
    }
    if (firstRealIdx === -1) return Math.min(2, w.length);
    return Math.min(w.length, Math.max(2, firstRealIdx + 1));
  }
  function buildVariants(text) {
    var w = words(text);
    if (w.length < 2) return [text];
    var keepMin = leadingKeepCount(w);
    var trailingCount = w.length - keepMin;
    var list = [w.join(" ")];
    for (var k = 1; k <= trailingCount; k++) {
      list.push(w.slice(0, w.length - k).concat(w.slice(w.length - k).map(initial)).join(" "));
    }
    var head = w.slice(0, keepMin);
    var tailInitials = w.slice(keepMin).map(initial);
    for (var keepTail = tailInitials.length - 1; keepTail >= 0; keepTail--) {
      list.push(head.concat(tailInitials.slice(0, keepTail)).join(" "));
    }
    if (!isShortPrefix(w[0])) {
      list.push(w[0] + " " + initial(w[1]));
      list.push(w[0]);
    }
    return list.filter(function (v, i, all) { return all.indexOf(v) === i; });
  }

  function lineCount(el) {
    var style = getComputedStyle(el);
    var lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    return Math.round(el.getBoundingClientRect().height / lineHeight);
  }
  function fits(el, maxLines) {
    var tooWide = el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
    return !tooWide && lineCount(el) <= maxLines;
  }

  function fit(el) {
    if (el.children.length > 0) return;
    var full = el.getAttribute("data-fit-original");
    if (full === null) {
      full = el.textContent.trim();
      el.setAttribute("data-fit-original", full);
    }
    if (!full) return;

    var maxLines = parseInt(el.getAttribute("data-fit-lines") || "", 10) || DEFAULT_LINES;
    el.style.fontSize = "";
    var basePt = parseFloat(getComputedStyle(el).fontSize) * 0.75;
    var minPt = parseFloat(el.getAttribute("data-fit-min") || "");
    // Allow gentle shrinking down to 70% (min 9.5pt) so 2-word readable names fit before cutting trailing initials.
    var floorPt = minPt > 0 ? Math.min(basePt, minPt) : Math.max(9.5, Math.round(basePt * 0.7 * 4) / 4);

    var singleWord = words(full).length < 2;
    var variants = singleWord ? [full] : buildVariants(full);
    for (var i = 0; i < variants.length; i++) {
      el.textContent = variants[i];
      for (var pt = basePt; ; pt -= STEP_PT) {
        el.style.fontSize = pt + "pt";
        if (fits(el, maxLines)) return;
        if (pt - STEP_PT < floorPt) break;
      }
    }

    // Final safety cutoff with ellipsis if even the shortest variant overflows
    var chars = Array.from(el.textContent || full);
    el.style.fontSize = floorPt + "pt";
    for (var n = chars.length - 1; n > 0; n--) {
      el.textContent = chars.slice(0, n).join("").trim() + "\u2026";
      if (fits(el, maxLines)) return;
    }
  }

  function fitDetails(details) {
    var topBlock = details.firstElementChild;
    var titleEl = details.querySelector(".attendee-title");
    var companyEl = details.querySelector(".attendee-company");
    var eventEl = details.querySelector(".event-name");
    var refEl = details.querySelector(".ref-code");

    details.style.zoom = "1";
    if (titleEl) titleEl.style.fontSize = "";
    if (companyEl) companyEl.style.fontSize = "";
    if (eventEl) eventEl.style.display = "";
    if (refEl) refEl.style.display = "";

    function overflows() {
      var detailsOver = details.clientHeight > 0 && details.scrollHeight > details.clientHeight + 1;
      var topOver = topBlock && topBlock.clientHeight > 0 && topBlock.scrollHeight > topBlock.clientHeight + 1;
      return detailsOver || topOver;
    }

    if (!overflows()) return;

    // 1. Shrink title (down to 5.5pt) and company (down to 5.0pt)
    var titlePt = titleEl ? parseFloat(getComputedStyle(titleEl).fontSize) * 0.75 || 8 : 0;
    var companyPt = companyEl ? parseFloat(getComputedStyle(companyEl).fontSize) * 0.75 || 6.8 : 0;
    var minTitlePt = 5.5;
    var minCompanyPt = 5.0;
    while (overflows() && ((titleEl && titlePt > minTitlePt) || (companyEl && companyPt > minCompanyPt))) {
      if (titleEl && titlePt > minTitlePt) {
        titlePt = Math.max(minTitlePt, Math.round((titlePt - STEP_PT) * 100) / 100);
        titleEl.style.fontSize = titlePt + "pt";
      }
      if (companyEl && companyPt > minCompanyPt) {
        companyPt = Math.max(minCompanyPt, Math.round((companyPt - STEP_PT) * 100) / 100);
        companyEl.style.fontSize = companyPt + "pt";
      }
    }

    // 2. Sacrifice event name if still overflowing
    if (overflows() && eventEl) {
      eventEl.style.display = "none";
    }

    // 3. Sacrifice ref code if still overflowing
    if (overflows() && refEl) {
      refEl.style.display = "none";
    }

    // 4. Gentle zoom fallback (never hides ticket pill)
    var scale = 1.0;
    while (overflows() && scale > 0.75) {
      scale = Math.round((scale - 0.03) * 100) / 100;
      details.style.zoom = String(scale);
    }
  }

  function run() {
    Array.prototype.forEach.call(document.querySelectorAll(".attendee-name, [data-fit-name]"), fit);
    Array.prototype.forEach.call(document.querySelectorAll(".ticket-details"), fitDetails);
  }
  run();
  window.addEventListener("load", run);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
})();
`;

/** Adds the name-fit script to a full label document (idempotent). */
export function injectNameFit(html: string): string {
  if (html.includes(`id="${NAME_FIT_SCRIPT_ID}"`)) return html;
  const tag = `<script id="${NAME_FIT_SCRIPT_ID}">${NAME_FIT_SCRIPT}</script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => `${tag}\n</body>`) : `${html}\n${tag}`;
}
