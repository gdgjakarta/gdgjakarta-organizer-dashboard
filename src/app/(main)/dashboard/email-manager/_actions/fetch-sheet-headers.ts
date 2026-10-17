"use server";

import { google } from "googleapis";

import { extractApiMessage } from "@/lib/utils";

export async function fetchSheetHeaders(spreadsheetUrl: string, sheetName: string) {
  try {
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
          range: `${sheetName}!1:1`,
          key: apiKey,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          return { success: true, headers: [], message: "No headers found in the first row." };
        }

        const headers = rows[0].map(String).filter(Boolean);
        return {
          success: true,
          headers,
          message: `Successfully loaded ${headers.length} tag${headers.length === 1 ? "" : "s"} from the sheet.`,
        };
      } catch (apiError: unknown) {
        console.warn("[fetchSheetHeaders] Google Sheets API error, falling back to public gviz endpoint:", apiError);
      }
    }

    // Fallback: Read public sheets via the gviz export endpoint (doesn't require API key for public sheets)
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
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
    const firstRow = csvText.split("\n")[0];

    if (!firstRow) {
      return { success: true, headers: [], message: "The sheet appears to be empty." };
    }

    // Simple CSV parser for the first row (removes surrounding quotes)
    const headers = firstRow
      .split(",")
      .map((h) => h.replace(/^"|"$/g, "").trim())
      .filter(Boolean);

    return {
      success: true,
      headers,
      message: `Successfully loaded ${headers.length} tag${headers.length === 1 ? "" : "s"} from sheet "${sheetName}".`,
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
