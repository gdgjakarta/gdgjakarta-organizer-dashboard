"use server";

import { google } from "googleapis";

import { extractApiMessage } from "@/lib/utils";

export async function fetchSheetsList(spreadsheetUrl: string) {
  try {
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match?.[1]) {
      return { success: false, error: "Invalid Spreadsheet URL. Please check the link and try again." };
    }
    const spreadsheetId = match[1];

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: "Google Sheets API Key is not configured in the environment (.env).",
      };
    }

    const sheets = google.sheets("v4");
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      key: apiKey,
      includeGridData: false,
    });

    const sheetTitles = response.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) as string[];

    if (sheetTitles.length === 0) {
      return { success: false, error: "No sheets found in this spreadsheet." };
    }

    return {
      success: true,
      sheets: sheetTitles,
      message: `Successfully loaded ${sheetTitles.length} sheet${sheetTitles.length === 1 ? "" : "s"}.`,
    };
  } catch (error: unknown) {
    console.error("[fetchSheetsList] Error:", error);
    const cleanError = extractApiMessage(
      error,
      "Failed to fetch spreadsheet details. Please verify the URL and permissions.",
    );
    return { success: false, error: cleanError };
  }
}
