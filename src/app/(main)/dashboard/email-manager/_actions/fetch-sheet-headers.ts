"use server";

import { google } from "googleapis";

import { extractApiMessage } from "@/lib/utils";

function parseCsvRow(rowStr: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (inQuotes && rowStr[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export interface FetchSheetHeadersResult {
  success: boolean;
  headers?: string[];
  rowCount?: number;
  sampleRow?: Record<string, string>;
  message?: string;
  error?: string;
}

export async function fetchSheetHeaders(
  spreadsheetUrl: string,
  sheetName: string,
  headerRow = 1,
): Promise<FetchSheetHeadersResult> {
  try {
    const rowNumber = Math.max(1, Math.floor(Number(headerRow) || 1));

    // Extract Spreadsheet ID from URL
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match?.[1]) {
      return { success: false, error: "Invalid Spreadsheet URL. Please check the link and try again." };
    }
    const spreadsheetId = match[1];

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    // If an API key is provided, try the official Google Sheets API first
    if (apiKey) {
      try {
        const sheets = google.sheets("v4");
        const safeSheetRange =
          sheetName.includes(" ") || /[^a-zA-Z0-9]/.test(sheetName) ? `'${sheetName.replace(/'/g, "''")}'` : sheetName;

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: safeSheetRange,
          key: apiKey,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          return {
            success: true,
            headers: [],
            rowCount: 0,
            sampleRow: {},
            message: `No data found in sheet "${sheetName}".`,
          };
        }

        const headerIndex = rowNumber - 1;
        const rawHeaders = rows[headerIndex] || [];
        const headers = rawHeaders.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);

        // Count data rows below the header row that have at least one non-empty cell
        const dataRows = rows.slice(rowNumber);
        const nonEmptyDataRows = dataRows.filter((r) => r.some((cell) => String(cell ?? "").trim().length > 0));
        const rowCount = nonEmptyDataRows.length;

        const sampleRow: Record<string, string> = {};
        if (nonEmptyDataRows.length > 0) {
          const firstRow = nonEmptyDataRows[0];
          rawHeaders.forEach((h, idx) => {
            const hStr = String(h ?? "").trim();
            if (hStr) {
              sampleRow[hStr] = String(firstRow[idx] ?? "").trim();
            }
          });
        }

        return {
          success: true,
          headers,
          rowCount,
          sampleRow,
          message: `Successfully loaded ${headers.length} tag${headers.length === 1 ? "" : "s"} and ${rowCount} recipient row${rowCount === 1 ? "" : "s"} from row ${rowNumber}.`,
        };
      } catch (apiError: unknown) {
        console.warn("[fetchSheetHeaders] Google Sheets API error, falling back to public gviz endpoint:", apiError);
      }
    }

    // Fallback: Read public sheets via the gviz export endpoint (doesn't require API key for public sheets)
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(
      sheetName,
    )}`;

    const response = await fetch(gvizUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        success: false,
        error:
          "Could not read sheet. Please make sure the sheet is public (Anyone with the link can view) and the tab name is spelled correctly.",
      };
    }

    const csvText = await response.text();
    const csvRows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const headerIndex = rowNumber - 1;
    const targetRow = csvRows[headerIndex] ?? csvRows[0];

    if (!targetRow) {
      return {
        success: true,
        headers: [],
        rowCount: 0,
        sampleRow: {},
        message: `Row ${rowNumber} appears to be empty.`,
      };
    }

    const parsedHeaderCols = parseCsvRow(targetRow);
    const headers = parsedHeaderCols.map((h) => h.replace(/^"|"$/g, "").trim()).filter((h) => h.length > 0);

    // Count non-empty data rows after the header row
    const dataLines = csvRows.slice(rowNumber);
    const nonEmptyDataLines = dataLines.filter((line) => {
      const cols = parseCsvRow(line);
      return cols.some((col) => col.replace(/^"|"$/g, "").trim().length > 0);
    });
    const rowCount = nonEmptyDataLines.length;

    const sampleRow: Record<string, string> = {};
    if (nonEmptyDataLines.length > 0) {
      const firstDataLineParsed = parseCsvRow(nonEmptyDataLines[0]);
      headers.forEach((h, idx) => {
        sampleRow[h] = (firstDataLineParsed[idx] ?? "").replace(/^"|"$/g, "").trim();
      });
    }

    return {
      success: true,
      headers,
      rowCount,
      sampleRow,
      message: `Successfully loaded ${headers.length} tag${headers.length === 1 ? "" : "s"} and ${rowCount} recipient row${rowCount === 1 ? "" : "s"} from row ${rowNumber} of "${sheetName}".`,
    };
  } catch (error: unknown) {
    console.error("[fetchSheetHeaders] Error:", error);
    const cleanError = extractApiMessage(
      error,
      "Failed to fetch spreadsheet headers. Please verify sheet access permissions.",
    );
    return { success: false, error: cleanError };
  }
}
