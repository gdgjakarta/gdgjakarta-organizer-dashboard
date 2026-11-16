"use client";

import * as React from "react";

import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { bulkImportShortLinksAction } from "@/server/shortio-advanced-actions";

import { type ParsedRow, parseLinksCsv } from "./parse-csv";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function BulkImportDialog({ open, onOpenChange, onImported }: Props) {
  const [text, setText] = React.useState("");
  const [results, setResults] = React.useState<{ originalURL: string; ok: boolean; error?: string }[] | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const parsed: ParsedRow[] = React.useMemo(() => parseLinksCsv(text), [text]);
  const valid = parsed.filter((p) => !p.error);

  const handleFile = async (file?: File) => {
    if (file) setText(await file.text());
    setResults(null);
  };

  const handleImport = () =>
    startTransition(async () => {
      const res = await bulkImportShortLinksAction(valid.map((p) => p.row));
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Import failed");
        return;
      }
      setResults(res.data);
      const ok = res.data.filter((r) => r.ok).length;
      toast.success(`Imported ${ok} of ${res.data.length} links`);
      if (ok > 0) onImported();
    });

  const reset = (o: boolean) => {
    if (!o) {
      setText("");
      setResults(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk import links</DialogTitle>
          <DialogDescription>
            CSV columns: <code>originalURL, path, title, tags</code> (path/title/tags optional; separate tags with{" "}
            <code>;</code>). Up to 1000 rows.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="text-sm"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResults(null);
            }}
            placeholder={"https://example.com/page,my-slug,My title,tag1;tag2"}
            className="min-h-32 font-mono text-xs"
            disabled={isPending}
          />
          {parsed.length > 0 && !results && (
            <div className="max-h-40 overflow-y-auto rounded-md border text-xs">
              {parsed.map((p) => (
                <div key={p.line} className="flex justify-between gap-2 border-b px-2 py-1 last:border-0">
                  <span className="truncate">{p.row.originalURL}</span>
                  <span className={p.error ? "text-destructive" : "text-emerald-600"}>{p.error ?? "OK"}</span>
                </div>
              ))}
            </div>
          )}
          {results && (
            <div className="max-h-40 overflow-y-auto rounded-md border text-xs">
              {results.map((r, i) => (
                <div
                  key={`${r.originalURL}-${i}`}
                  className="flex justify-between gap-2 border-b px-2 py-1 last:border-0"
                >
                  <span className="truncate">{r.originalURL}</span>
                  <span className={r.ok ? "text-emerald-600" : "text-destructive"}>
                    {r.ok ? "Created" : (r.error ?? "Failed")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)} disabled={isPending}>
            Close
          </Button>
          <Button
            onClick={handleImport}
            disabled={isPending || valid.length === 0 || valid.length > 1000 || Boolean(results)}
          >
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            Import {valid.length} link{valid.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
