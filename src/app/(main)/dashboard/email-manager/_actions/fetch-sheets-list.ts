"use server";

import { google } from "googleapis";

import { extractApiMessage } from "@/lib/utils";

export async function fetchSheetsList(spreadsheetUrl: string, accessToken?: string) {
  try {
    // Extract Spreadsheet ID from URL
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match?.[1]) {
      return { success: false, error: "Invalid Spreadsheet URL. Please check the link and try again." };
    }
    const spreadsheetId = match[1];

    // 1. If a Google Drive OAuth accessToken is provided, try authenticated Sheets API v4 first (supports private sheets)
    if (accessToken?.trim()) {
      try {
        const oauthRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
          {
            headers: {
              Authorization: `Bearer ${accessToken.trim()}`,
              Accept: "application/json",
            },
            cache: "no-store",
          },
        );
        if (oauthRes.ok) {
          const data = (await oauthRes.json()) as {
            sheets?: Array<{ properties?: { title?: string } }>;
          };
          const sheetNames = (data.sheets || [])
            .map((s) => s.properties?.title)
            .filter((title): title is string => Boolean(title));
          if (sheetNames.length > 0) {
            return {
              success: true,
              sheets: sheetNames,
              message: `Found ${sheetNames.length} sheet${sheetNames.length === 1 ? "" : "s"}.`,
            };
          }
        }
      } catch (oauthErr) {
        console.warn("[fetchSheetsList] OAuth token Sheets API error, falling back:", oauthErr);
      }
    }

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    // If an API key is provided, try the official Google Sheets API first
    if (apiKey) {
      try {
        const sheets = google.sheets("v4");
        const response = await sheets.spreadsheets.get({
          spreadsheetId,
          key: apiKey,
        });

        const sheetNames = (response.data.sheets || [])
          .map((s) => s.properties?.title)
          .filter((title): title is string => Boolean(title));

        if (sheetNames.length > 0) {
          return {
            success: true,
            sheets: sheetNames,
            message: `Found ${sheetNames.length} sheet${sheetNames.length === 1 ? "" : "s"}.`,
          };
        }
      } catch (apiError: unknown) {
        console.warn("[fetchSheetsList] Google Sheets API error, falling back to public HTML inspection:", apiError);
      }
    }

    // Fallback: Scrape public sheet HTML to get sheet names from the bottom tabs
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
    const response = await fetch(htmlUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Could not access spreadsheet. Please make sure the sheet is public (Anyone with the link can view).",
      };
    }

    const htmlText = await response.text();

    const sheets: string[] = [];

    // Modern Google Sheets htmlview stores sheet items in JavaScript: items.push({name: "SheetName", ...})
    const modernItemRegex = /items\.push\(\{\s*name:\s*"([^"]+)"/g;
    let modernMatch = modernItemRegex.exec(htmlText);
    while (modernMatch !== null) {
      if (modernMatch[1]) {
        const cleanName = modernMatch[1].replace(/\\"/g, '"').trim();
        sheets.push(cleanName);
      }
      modernMatch = modernItemRegex.exec(htmlText);
    }

    // Classic Google Sheets HTML output fallback: <li id="sheet-button-..."><a ...>SheetName</a>
    if (sheets.length === 0) {
      const tabRegex = /<li id="sheet-button-[^"]*"[^>]*><a[^>]*>(.*?)<\/a>/g;
      let matchGroup = tabRegex.exec(htmlText);
      while (matchGroup !== null) {
        if (matchGroup[1]) {
          const cleanName = matchGroup[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
          sheets.push(cleanName);
        }
        matchGroup = tabRegex.exec(htmlText);
      }
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
