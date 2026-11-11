import { formatBevySessionTime } from "@/lib/events/email-templates";
import type { FirestoreEvent, SpeakerSlideTemplate } from "@/lib/firestore/types";

export const DEFAULT_SPEAKER_HANDBOOK_MARKDOWN = `# Speaker Handbook & Technical Guidelines

Welcome to **{{ eventName }}**! We are thrilled to have you as a speaker. This handbook provides all the technical details, venue logistics, and presentation guidelines you need for a smooth and impactful session.

---

## 1. Event Overview & Schedule

- **Event:** {{ eventName }}
- **Date:** {{ eventDate }}
- **Time:** {{ eventTime }}
- **Venue:** [{{ eventLocation }}]({{ eventLocationUrl }})
- **Event Page:** [{{ eventUrl }}]({{ eventUrl }})

> [!IMPORTANT]
> **Arrival Time:** Please arrive at the venue at least **30 to 45 minutes** before your scheduled session. This ensures ample time for badge collection, audio/video checks, and green room preparation.

---

## 2. Presentation & Slide Guidelines

### Aspect Ratio & Formatting
- **Aspect Ratio:** **16:9 widescreen** (Standard for modern displays and projectors).
- **Legibility:** Minimum font size of **24pt** for content and **18pt** for code snippets.
- **Code & Dark Mode:** If demonstrating code or IDEs, use high-contrast color themes and increase zoom levels.

### Official Slide Templates
You are welcome to use our official GDG community slide templates:

{{ slideTemplates }}

### Slide Submission
Please provide your public Google Slides link or deployed slides URL in the **Speaker Confirmation Form** at least 3 days before the event. If your slides contain animations or embedded videos, please inform the stage team in advance.

---

## 3. Venue & Technical Setup

- **Stage Connection:** Standard HDMI cables are provided at the podium.
  - *Dongles:* If your laptop uses USB-C or Mini DisplayPort, please bring your adapter just in case.
- **Audio:** Lavalier (lapel) mic or handheld wireless mic will be assigned before you take the stage.
- **Presenter Remote:** A wireless slide clicker with a laser pointer is available on stage.
- **Wi-Fi:** High-speed Wi-Fi details will be provided at the Speaker Check-in desk.

---

## 4. Session Q&A & Timekeeping

- Timekeeper staff at the front row will show cue cards: **10 minutes**, **5 minutes**, **1 minute**, and **Time's Up**.
- Please allocate **5 minutes** at the end of your session for audience Q&A.
- Slido / interactive polling links will be moderated by the session MC.

---

## 5. Speaker Lounge & Networking

- Feel free to relax and prepare your talk in the **Speaker Lounge / Green Room**.
- Complimentary coffee, refreshments, and snacks will be available throughout the day.
- Exclusive speaker merchandise and badges will be handed to you upon check-in.

---

## 6. Community Guidelines & Code of Conduct

All GDG Jakarta events follow the [Google Developer Groups Community Guidelines](https://developers.google.com/community-guidelines). We are dedicated to providing a harassment-free and inclusive experience for everyone.

---

## 7. Need Help or Have Questions?

If you have any questions, flight/travel updates, or special technical requirements, reach out to our organizing team:
- **Email:** [info@gdgjakarta.org](mailto:info@gdgjakarta.org)
- **WhatsApp Support:** Available via the contact channels provided in your confirmation.
`;

/**
 * Renders slide templates into sleek Google-styled action cards for the handbook view.
 */
export function renderSlideTemplatesHtml(templates?: (SpeakerSlideTemplate | null | undefined)[]): string {
  if (!templates || templates.length === 0) {
    return `<div style="padding: 14px 18px; margin: 12px 0; font-size: 13px; border-radius: 12px; border: 1px dashed #dadce0; background-color: #f8f9fa; color: #70757a;">No official slide templates configured for this session.</div>`;
  }

  const validTemplates = templates.filter((t): t is SpeakerSlideTemplate => Boolean(t?.url));

  if (validTemplates.length === 0) {
    return `<div style="padding: 14px 18px; margin: 12px 0; font-size: 13px; border-radius: 12px; border: 1px dashed #dadce0; background-color: #f8f9fa; color: #70757a;">No official slide templates configured for this session.</div>`;
  }

  const items = validTemplates
    .map((t) => {
      const isDefault = Boolean(t.is_default);
      // Clean, official Google Slides presentation SVG icon
      const slidesIconSvg = `<svg style="width: 22px; height: 22px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#F4B400"/>
        <rect x="6.5" y="6.5" width="11" height="8" rx="1.5" fill="#FFFFFF"/>
        <path d="M12 14.5V17.5M9.5 17.5H14.5" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;

      const externalLinkSvg = `<svg style="width: 14px; height: 14px; color: #5f6368; flex-shrink: 0; transition: transform 0.15s ease;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>`;

      return `
        <a href="${t.url}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; border-radius: 12px; text-decoration: none; border: 1px solid ${isDefault ? "#d2e3fc" : "#e0e0e0"}; background-color: ${isDefault ? "#f8fafd" : "#ffffff"}; color: #202124; box-shadow: 0 1px 2px rgba(60,64,67,0.08); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); margin: 6px 10px 6px 0; font-family: 'Google Sans', -apple-system, sans-serif;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${slidesIconSvg}
            <div style="text-align: left;">
              <div style="font-size: 13.5px; font-weight: 600; color: #202124; line-height: 1.35;">${t.label}</div>
              <div style="font-size: 11px; color: #5f6368; margin-top: 1px;">Google Slides 16:9 Presentation Deck</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${isDefault ? `<span style="font-size: 10.5px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background-color: #e8f0fe; color: #1a73e8; letter-spacing: 0.2px;">Official Template</span>` : ""}
            ${externalLinkSvg}
          </div>
        </a>
      `;
    })
    .join("");

  return `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0;">${items}</div>`;
}

/**
 * Resolves formatted metadata values for the speaker handbook from a FirestoreEvent.
 */
export function resolveSpeakerHandbookEventDetails(
  event: Partial<FirestoreEvent>,
  slideTemplates?: SpeakerSlideTemplate[],
): {
  title: string;
  date: string;
  time: string;
  location: string;
  locationUrl: string;
  eventUrl: string;
  slideTemplates?: SpeakerSlideTemplate[];
} {
  let eventDate = "To be announced";
  if (event.start_date) {
    try {
      const d = new Date(event.start_date);
      if (!Number.isNaN(d.getTime())) {
        eventDate = d.toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    } catch {
      // fallback
    }
  }

  const sessionTime =
    formatBevySessionTime(event.start_date, event.end_date) ||
    event.default_session_time?.trim() ||
    "09:00 - 17:00 WIB";

  const addressParts = [event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
  const location =
    event.venue?.name ||
    (addressParts.length > 0 ? addressParts : "Google Indonesia, Pacific Century Place Level 45, SCBD");

  const locationQuery = [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
  const locationUrl =
    event.google_maps_url ||
    event.venue?.google_maps_url ||
    event.venue?.url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery || location)}`;

  const eventUrl =
    event.url ||
    event.static_url ||
    (event.id ? `https://gdgjakarta.org/events/${event.id}` : "https://gdgjakarta.org/events");

  return {
    title: event.title || "GDG Jakarta Event",
    date: eventDate,
    time: sessionTime,
    location,
    locationUrl,
    eventUrl,
    slideTemplates,
  };
}

/**
 * Interpolates template variables in markdown or HTML content.
 */
export function interpolateHandbookVariables(
  rawContent: string,
  event:
    | Partial<FirestoreEvent>
    | {
        title: string;
        date: string;
        time: string;
        location: string;
        locationUrl: string;
        eventUrl: string;
        slideTemplates?: SpeakerSlideTemplate[];
      },
  slideTemplates?: SpeakerSlideTemplate[],
): string {
  let text = rawContent;

  const resolved =
    "date" in event && "time" in event && "location" in event
      ? {
          title: event.title || "GDG Jakarta Event",
          date: event.date || "To be announced",
          time: event.time || "09:00 - 17:00 WIB",
          location: event.location || "Google Indonesia",
          locationUrl: event.locationUrl || "https://maps.google.com",
          eventUrl: event.eventUrl || "https://gdgjakarta.org/events",
          slideTemplates: event.slideTemplates || slideTemplates,
        }
      : resolveSpeakerHandbookEventDetails(event as Partial<FirestoreEvent>, slideTemplates);

  const slideTemplatesHtml = renderSlideTemplatesHtml(resolved.slideTemplates);

  // Curly braces format (e.g. {{ eventName }}, {{eventName}})
  text = text.replaceAll("{{ eventName }}", resolved.title);
  text = text.replaceAll("{{eventName}}", resolved.title);
  text = text.replaceAll("{{ eventDate }}", resolved.date);
  text = text.replaceAll("{{eventDate}}", resolved.date);
  text = text.replaceAll("{{ eventTime }}", resolved.time);
  text = text.replaceAll("{{eventTime}}", resolved.time);
  text = text.replaceAll("{{ eventLocation }}", resolved.location);
  text = text.replaceAll("{{eventLocation}}", resolved.location);
  text = text.replaceAll("{{ eventLocationUrl }}", resolved.locationUrl);
  text = text.replaceAll("{{eventLocationUrl}}", resolved.locationUrl);
  text = text.replaceAll("{{ eventUrl }}", resolved.eventUrl);
  text = text.replaceAll("{{eventUrl}}", resolved.eventUrl);
  text = text.replaceAll("{{ slideTemplates }}", slideTemplatesHtml);
  text = text.replaceAll("{{slideTemplates}}", slideTemplatesHtml);

  // Email Templates double-bracket format (e.g. [[EventName]], [[EventDate]], [[SlideTemplates]], etc.)
  text = text.replaceAll(/\[\[\s*EventName\s*\]\]/gi, resolved.title);
  text = text.replaceAll(/\[\[\s*EventDate\s*\]\]/gi, resolved.date);
  text = text.replaceAll(/\[\[\s*EventTime\s*\]\]/gi, resolved.time);
  text = text.replaceAll(/\[\[\s*EventVenue\s*\]\]/gi, resolved.location);
  text = text.replaceAll(/\[\[\s*EventLocation\s*\]\]/gi, resolved.location);
  text = text.replaceAll(/\[\[\s*EventVenueUrl\s*\]\]/gi, resolved.locationUrl);
  text = text.replaceAll(/\[\[\s*EventLocationUrl\s*\]\]/gi, resolved.locationUrl);
  text = text.replaceAll(/\[\[\s*EventAddress\s*\]\]/gi, resolved.location);
  text = text.replaceAll(/\[\[\s*EventUrl\s*\]\]/gi, resolved.eventUrl);
  text = text.replaceAll(/\[\[\s*SlideTemplates\s*\]\]/gi, slideTemplatesHtml);
  text = text.replaceAll(/\[\[\s*SlideTemplate\s*\]\]/gi, slideTemplatesHtml);

  return text;
}

/**
 * Lightweight, zero-dependency Markdown-to-HTML parser for Speaker Handbook.
 * Supports headings, alerts, code blocks, tables, bold/italic, links, lists.
 */
export function simpleMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Preserve HTML blocks or placeholders
  const codeBlocks: string[] = [];
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    codeBlocks.push(
      `<pre class="p-4 my-4 overflow-x-auto text-xs rounded-lg font-mono bg-zinc-900 text-zinc-100"><code>${escaped}</code></pre>`,
    );
    return `\n\n__CODE_BLOCK_${idx}__\n\n`;
  });

  // Callouts > [!NOTE], > [!IMPORTANT], > [!TIP], > [!WARNING]
  const calloutBlocks: string[] = [];
  html = html.replace(
    /^>\s*\[!(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\]\s*\n((?:^>.*$\n?)+)/gim,
    (_match, type, content) => {
      const cleanContent = content
        .replace(/^>\s?/gm, "")
        .trim()
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong style="font-weight: 600; color: #202124;"><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: #202124;">$1</strong>')
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, '<code style="padding: 2px 4px; border-radius: 4px; background: rgba(0,0,0,0.06); font-family: monospace; font-size: 12px;">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; font-weight: 600;">$1</a>')
        .replace(/\n{2,}/g, '</p><p style="margin-top: 4px;">')
        .replace(/\n/g, "<br>");
      const upper = type.toUpperCase();

      // Compact Material / Google-styled callout card tokens
      let borderColor = "#1a73e8";
      let bgColor = "#f8fafd";
      let titleColor = "#1a73e8";
      let title = "Note";
      let iconSvg = `<svg style="width: 14px; height: 14px; flex-shrink: 0; color: #1a73e8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`;

      if (upper === "IMPORTANT") {
        borderColor = "#ea4335";
        bgColor = "#fef7f6";
        titleColor = "#c5221f";
        title = "Important";
        iconSvg = `<svg style="width: 14px; height: 14px; flex-shrink: 0; color: #ea4335;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>`;
      } else if (upper === "TIP") {
        borderColor = "#34a853";
        bgColor = "#f6fbf7";
        titleColor = "#137333";
        title = "Tip";
        iconSvg = `<svg style="width: 14px; height: 14px; flex-shrink: 0; color: #34a853;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18h6"></path>
          <path d="M10 22h4"></path>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5h6.18z"></path>
        </svg>`;
      } else if (upper === "WARNING" || upper === "CAUTION") {
        borderColor = "#f9ab00";
        bgColor = "#fefbf3";
        titleColor = "#b06000";
        title = "Warning";
        iconSvg = `<svg style="width: 14px; height: 14px; flex-shrink: 0; color: #f9ab00;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
      }

      const idx = calloutBlocks.length;
      calloutBlocks.push(
        `<div style="border-left: 3.5px solid ${borderColor}; background-color: ${bgColor}; padding: 10px 14px; border-radius: 8px; margin: 12px 0; border-top: 1px solid rgba(0,0,0,0.04); border-right: 1px solid rgba(0,0,0,0.04); border-bottom: 1px solid rgba(0,0,0,0.04); box-shadow: 0 1px 2px rgba(60,64,67,0.03); font-family: 'Google Sans', -apple-system, sans-serif;">` +
          `<div style="font-weight: 700; font-size: 12.5px; color: ${titleColor}; line-height: 1.2; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; letter-spacing: -0.1px;">` +
          `${iconSvg}` +
          `<span>${title}</span>` +
          `</div>` +
          `<div style="font-size: 13px; line-height: 1.5; color: #3c4043; margin: 0; padding: 0;">${cleanContent}</div>` +
          `</div>`,
      );
      return `\n\n__CALLOUT_BLOCK_${idx}__\n\n`;
    },
  );

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="mt-4 mb-1.5 text-base font-bold text-foreground">$1</h3>');
  html = html.replace(
    /^## (.*$)/gim,
    '<h2 class="mt-5 mb-2 pb-1.5 text-lg font-bold tracking-tight border-b border-border text-foreground">$1</h2>',
  );
  html = html.replace(
    /^# (.*$)/gim,
    '<h1 class="mt-1 mb-2.5 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">$1</h1>',
  );

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="my-4 border-border" />');

  // Inline bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground">$1</code>',
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary underline underline-offset-4 hover:opacity-80">$1</a>',
  );

  // Lists (unordered)
  html = html.replace(
    /^\s*-\s+(.*)$/gim,
    '<li class="ml-4 list-disc text-sm leading-normal text-muted-foreground">$1</li>',
  );
  html = html.replace(
    /((?:<li class="ml-4 list-disc[^>]*>.*<\/li>(?:\n|$))+)/gi,
    (m) => `<ul class="my-2 space-y-0.5 pl-2">\n${m.trim()}\n</ul>\n\n`,
  );

  // Paragraphs
  html = html
    .split("\n\n")
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<div") ||
        trimmed.startsWith("__CODE_BLOCK_") ||
        trimmed.startsWith("__CALLOUT_BLOCK_")
      ) {
        return trimmed;
      }
      return `<p class="my-2 text-sm leading-normal text-muted-foreground">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  // Restore code blocks
  codeBlocks.forEach((codeHtml, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
  });

  // Restore callout blocks
  calloutBlocks.forEach((calloutHtml, idx) => {
    html = html.replace(`__CALLOUT_BLOCK_${idx}__`, calloutHtml);
  });

  return html;
}

export const DEFAULT_SPEAKER_CUSTOM_SWAGS = [
  {
    id: "default_tshirt",
    label: "T-Shirt Size (Unisex Standard)",
    description: "Official GDG community conference commemorative t-shirt",
    options: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
    is_default: true,
    hidden: false,
  },
];

