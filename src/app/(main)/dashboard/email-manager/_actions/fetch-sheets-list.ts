"use server";

import { google } from "googleapis";

import { extractApiMessage } from "@/lib/utils";

export async function fetchSheetsList(spreadsheetUrl: string) {
  try {
    // Extract Spreadsheet ID from URL
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match?.[1]) {
      return { success: false, error: "Invalid Spreadsheet URL. Please check the link and try again." };
    }
    const spreadsheetId = match[1];

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    // If an API key is provided, use the official Google Sheets API
    if (apiKey) {
      const sheets = google.sheets("v4");
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        key: apiKey,
      });

      const sheetNames = (response.data.sheets || [])
        .map((s) => s.properties?.title)
        .filter((title): title is string => Boolean(title));

      if (sheetNames.length === 0) {
        return { success: true, sheets: ["Sheet1"], message: "No visible sheets found, defaulting to Sheet1." };
      }

      return {
        success: true,
        sheets: sheetNames,
        message: `Found ${sheetNames.length} sheet${sheetNames.length === 1 ? "" : "s"}.`,
      };
    }

    // Fallback: Scrape public sheet HTML to get sheet names from the bottom tabs
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
    const response = await fetch(htmlUrl);

    if (!response.ok) {
      return {
        success: false,
        error: "Could not access spreadsheet. Please make sure the sheet is public (Anyone with the link can view).",
      };
    }

    const htmlText = await response.text();

    // Match tab names in standard Google Sheets HTML output: <li class="..."><a ...>SheetName</a>
    const tabRegex = /<li id="sheet-button-[^"]*"[^>]*><a[^>]*>(.*?)<\/a>/g;
    const sheets: string[] = [];
    let matchGroup = tabRegex.exec(htmlText);

    while (matchGroup !== null) {
      if (matchGroup[1]) {
        // Decode HTML entities if any
        const cleanName = matchGroup[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
        sheets.push(cleanName);
      }
      matchGroup = tabRegex.exec(htmlText);
    }

    if (sheets.length > 0) {
      return {
        success: true,
        sheets,
        message: `Found ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}.`,
      };
    }

    // Secondary fallback: Check for standard Sheet1 / default
    return {
      success: true,
      sheets: ["Sheet1"],
      message: "Detected default Sheet1.",
    };
  } catch (error: unknown) {
    console.error("[fetchSheetsList] Error:", error);
    const cleanError = extractApiMessage(
      error,
      "Failed to fetch sheet list. Please check the URL and ensure the sheet is accessible.",
    );
    return { success: false, error: cleanError };
  }
}
