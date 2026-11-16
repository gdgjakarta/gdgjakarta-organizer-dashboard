import type { BulkImportRow } from "@/lib/shortio/types";

/** Splits one CSV line, honoring double-quoted fields and "" escapes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export interface ParsedRow {
  line: number;
  row: BulkImportRow;
  error?: string;
}

/** Columns: originalURL, path (optional), title (optional), tags (optional, `;`-separated). A header row is skipped. */
export function parseLinksCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  const rows: ParsedRow[] = [];
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const [originalURL = "", path, title, tags] = splitLine(raw);
    if (idx === 0 && /^original_?url$/i.test(originalURL)) return;
    const row: BulkImportRow = {
      originalURL,
      path: path?.replace(/^\//, "") || undefined,
      title: title || undefined,
      tags: tags
        ? tags
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    };
    let error: string | undefined;
    if (!/^https?:\/\/\S+$/i.test(originalURL)) error = "Invalid URL";
    else if (row.path && !/^[a-zA-Z0-9-_]+$/.test(row.path)) error = "Invalid slug";
    rows.push({ line: idx + 1, row, error });
  });
  return rows;
}

if (process.env.NODE_ENV === "test") {
  const r = parseLinksCsv('originalURL,path,title,tags\nhttps://a.com,x,"Hi, there",a;b\nnope');
  console.assert(r.length === 2 && r[0].row.title === "Hi, there" && r[0].row.tags?.length === 2 && r[1].error);
}
