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

/**
 * Abbreviates the last `count` words (default 1), keeping everything before them whole:
 * "Muhammad Fachridan Tamami" -> "Muhammad Fachridan T."  (count 2 -> "Muhammad F. T.").
 * The first word is never abbreviated; one-word names are unchanged.
 */
export function shortenName(name: string, count = 1): string {
  const words = nameWords(name);
  if (words.length < 2) return name.trim();
  const abbreviated = Math.min(Math.max(count, 1), words.length - 1);
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
  // Abbreviates the last k words, keeping the first word and everything before them whole.
  function abbreviateLast(text, k) {
    var w = words(text);
    return w.slice(0, w.length - k).concat(w.slice(w.length - k).map(initial)).join(" ");
  }
  function initialsName(text) { return words(text).map(initial).join(" "); }

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
    // Font size is kept by default; only an explicit data-fit-min (pt) allows shrinking before abbreviating.
    var minPt = parseFloat(el.getAttribute("data-fit-min") || "");
    var floorPt = minPt > 0 ? Math.min(basePt, minPt) : basePt;

    // A single word has nothing to abbreviate ("S." would be useless), so it is truncated instead.
    var singleWord = words(full).length < 2;
    var variants = [full];
    if (!singleWord) {
      // Last word first, then one more word from the back each time; all initials is the last resort.
      for (var k = 1; k < words(full).length; k++) variants.push(abbreviateLast(full, k));
      variants.push(initialsName(full));
    }
    variants = variants.filter(function (v, i, all) {
      return all.indexOf(v) === i;
    });
    for (var i = 0; i < variants.length; i++) {
      el.textContent = variants[i];
      for (var pt = basePt; ; pt -= STEP_PT) {
        el.style.fontSize = pt + "pt";
        if (fits(el, maxLines)) return;
        if (pt - STEP_PT < floorPt) break;
      }
    }

    if (singleWord) {
      var chars = Array.from(full);
      el.style.fontSize = floorPt + "pt";
      for (var n = chars.length - 1; n > 0; n--) {
        el.textContent = chars.slice(0, n).join("") + "\u2026";
        if (fits(el, maxLines)) return;
      }
    }
  }

  function run() {
    Array.prototype.forEach.call(document.querySelectorAll(".attendee-name, [data-fit-name]"), fit);
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
