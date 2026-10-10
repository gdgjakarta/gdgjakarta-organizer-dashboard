/**
 * Utilities for parsing and embedding event highlight videos and photo album links.
 */

export interface ParsedVideo {
  type: "youtube" | "vimeo" | "direct" | "external";
  embedUrl?: string;
  originalUrl: string;
  videoId?: string;
}

export interface ParsedPhotoAlbum {
  type: "google_photos" | "google_drive" | "other";
  label: string;
  url: string;
}

export function parseVideoUrl(rawUrl?: string | null): ParsedVideo | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // 1. YouTube (Standard, Shortened youtu.be, Shorts, Embeds)
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch?.[1]) {
    const videoId = ytMatch[1];
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
      originalUrl: url,
      videoId,
    };
  }

  // 2. Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|video\/|)(\d+)/);
  if (vimeoMatch?.[1]) {
    const videoId = vimeoMatch[1];
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${videoId}?dnt=1`,
      originalUrl: url,
      videoId,
    };
  }

  // 3. Direct HTML5 video file
  if (/\.(mp4|webm|ogg)($|\?)/i.test(url)) {
    return {
      type: "direct",
      embedUrl: url,
      originalUrl: url,
    };
  }

  // 4. Other web link
  return {
    type: "external",
    originalUrl: url,
  };
}

export function parsePhotoAlbum(rawUrl?: string | null): ParsedPhotoAlbum | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();
  if (!url) return null;

  if (url.includes("photos.app.goo.gl") || url.includes("photos.google.com")) {
    return {
      type: "google_photos",
      label: "Google Photos",
      url,
    };
  }

  if (url.includes("drive.google.com")) {
    return {
      type: "google_drive",
      label: "Google Drive",
      url,
    };
  }

  return {
    type: "other",
    label: "Photo Album",
    url,
  };
}

/**
 * Safely extract an image URL from an event or registration object,
 * checking all known Bevy, Cloudinary, Firestore, and fallback fields.
 */
export function extractEventImageUrl(
  event?: Record<string, unknown> | null,
  registration?: Record<string, unknown> | null,
): string | null {
  if (!event && !registration) return null;

  const candidateFields: (unknown | undefined | null)[] = [
    // 1. Event primary image fields
    event?.picture_url,
    event?.banner_url,
    event?.cropped_picture_url,
    event?.cropped_banner_url,
    event?.image_url,
    event?.imageUrl,
    event?.thumbnail_url,
    typeof event?.picture === "string" ? event.picture : undefined,
    typeof event?.banner === "string" ? event.banner : undefined,

    // 2. Nested Bevy picture / banner objects
    (event?.picture as { url?: string; thumbnail_url?: string } | undefined)?.url,
    (event?.picture as { url?: string; thumbnail_url?: string } | undefined)?.thumbnail_url,
    (event?.banner as { url?: string; thumbnail_url?: string } | undefined)?.url,
    (event?.banner as { url?: string; thumbnail_url?: string } | undefined)?.thumbnail_url,

    // 3. Registration-level cached event image fields
    registration?.event_picture_url,
    registration?.event_banner_url,
    typeof registration?.event_picture === "string" ? registration.event_picture : undefined,
    typeof registration?.event_banner === "string" ? registration.event_banner : undefined,
    (registration?.answers as Record<string, unknown> | undefined)?.event_picture_url,
    (registration?.answers as Record<string, unknown> | undefined)?.event_banner_url,
    (registration?.answers as Record<string, unknown> | undefined)?.picture_url,
    (registration?.answers as Record<string, unknown> | undefined)?.picture,
    (registration?.answers as Record<string, unknown> | undefined)?.banner,
  ];

  for (const candidate of candidateFields) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}
