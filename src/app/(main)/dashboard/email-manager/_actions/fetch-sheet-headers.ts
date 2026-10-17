"use server";

import { google } from "googleapis";

import { extractApiMessage } from "@/lib/utils";

export async function fetchSheetHeaders(spreadsheetUrl: string, sheetName: string, headerRow = 1) {
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
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!${rowNumber}:${rowNumber}`,
          key: apiKey,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          return { success: true, headers: [], message: `No titles found in row ${rowNumber}.` };
        }

        const headers = rows[0].map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);

        return {
          success: true,
          headers,
          message: `Successfully loaded ${headers.length} tag${headers.length === 1 ? "" : "s"} from row ${rowNumber}.`,
        };
      } catch (apiError: unknown) {
        console.warn("[fetchSheetHeaders] Google Sheets API error, falling back to public gviz endpoint:", apiError);
      }
    }

    // Fallback: Read public sheets via the gviz export endpoint (doesn't require API key for public sheets)
    // headers=0 prevents gviz from automatically combining multiple rows as column titles
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(
      sheetName,
    )}&range=${rowNumber}:${rowNumber}`;

    let response = await fetch(gvizUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });

    // If range query fails on gviz, fallback to fetching without range and slicing rows manually
    if (!response.ok) {
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        sheetName,
      )}`;
      response = await fetch(fallbackUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        next: { revalidate: 0 },
      });
    }

    if (!response.ok) {
      return {
        success: false,
        error:
          "Could not read sheet. Please make sure the sheet is public (Anyone with the link can view) and the tab name is spelled correctly.",
      };
    }

    const csvText = await response.text();
    const csvRows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

    // If range=${rowNumber}:${rowNumber} succeeded, the target row is index 0; otherwise it's index rowNumber - 1
    const targetRow = csvRows.length === 1 ? csvRows[0] : (csvRows[rowNumber - 1] ?? csvRows[0]);

    if (!targetRow) {
      return { success: true, headers: [], message: `Row ${rowNumber} appears to be empty.` };
    }

    // Robust CSV row parser that handles quoted commas
    const parseCsvRow = (rowStr: string): string[] => {
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
    };

    const headers = parseCsvRow(targetRow)
      .map((h) => h.replace(/^"|"$/g, "").trim())
      .filter((h) => h.length > 0);

    return {
      success: true,
      headers,
      message: `Successfully loaded ${headers.length} tag${headers.length === 1 ? "" : "s"} from row ${rowNumber} of "${sheetName}".`,
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
