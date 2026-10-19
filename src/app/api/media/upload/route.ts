import { type NextRequest, NextResponse } from "next/server";

import { uploadMediaObject } from "@/lib/r2/client";
import type { MediaItem } from "@/lib/r2/types";
import { isAuthorizedExecutiveOrganizerSession as isAuthorizedOrganizerSession } from "@/server/auth-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/upload
 * Handles single and multi-file uploads into Cloudflare R2 under the active directory prefix.
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedOrganizerSession())) {
    return NextResponse.json({ error: "Unauthorized: Organizer privileges required" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const prefix = formData.get("prefix")?.toString() || "";

    // Support both 'files' (multi) and 'file' (single) form field
    const fileEntries = formData.getAll("files");
    const singleFile = formData.get("file");

    const filesToUpload: File[] = [];
    if (fileEntries.length > 0) {
      for (const entry of fileEntries) {
        if (entry instanceof File) {
          filesToUpload.push(entry);
        }
      }
    } else if (singleFile instanceof File) {
      filesToUpload.push(singleFile);
    }

    if (filesToUpload.length === 0) {
      return NextResponse.json({ error: "No files provided in upload payload" }, { status: 400 });
    }

    const uploadedItems: MediaItem[] = [];
    const errors: string[] = [];

    for (const file of filesToUpload) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await uploadMediaObject(prefix, file.name, arrayBuffer, {
          contentType: file.type || "application/octet-stream",
          customMetadata: {
            originalSize: file.size.toString(),
            lastModified: file.lastModified.toString(),
          },
        });

        if (res.success && res.item) {
          uploadedItems.push(res.item);
        } else {
          errors.push(`Failed to upload ${file.name}: ${res.error ?? "Unknown error"}`);
        }
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : "Upload error";
        errors.push(`Failed to upload ${file.name}: ${msg}`);
      }
    }

    if (uploadedItems.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      uploadedCount: uploadedItems.length,
      items: uploadedItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Media Upload API] Error processing upload:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
