import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Calendar, ChevronRight, MapPin, Mic, Presentation, Sparkles } from "lucide-react";

import {
  DEFAULT_SPEAKER_HANDBOOK_MARKDOWN,
  interpolateHandbookVariables,
  renderSlideTemplatesHtml,
  simpleMarkdownToHtml,
} from "@/lib/events/speaker-handbook";
import { SPEAKER_SLIDE_TEMPLATE_PRESETS } from "@/lib/firestore/types";
import { getFirestoreEventByIdServer } from "@/server/firestore-admin";

const DEFAULT_EMAIL_HEADER_URL = "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function SpeakerHandbookPage({ params, searchParams }: PageProps) {
  const { eventId } = await params;
  const { token } = await searchParams;

  const event = await getFirestoreEventByIdServer(String(eventId));
  if (!event) {
    notFound();
  }

  // Token check for private handbook access
  const expectedToken = event.speaker_config?.share_token;
  if (!token || !expectedToken || token !== expectedToken) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="font-bold text-destructive text-xl">Restricted Access</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            This speaker handbook is restricted to confirmed speakers of <strong>{event.title}</strong>.
          </p>
          <p className="mt-4 text-muted-foreground text-xs">
            Please use the secure link sent in your Speaker Invitation email.
          </p>
        </div>
      </div>
    );
  }

  const headerImageUrl = event.banner_url || event.picture_url || DEFAULT_EMAIL_HEADER_URL;

  const rawMarkdown = event.speaker_config?.handbook_content || DEFAULT_SPEAKER_HANDBOOK_MARKDOWN;

  // Active slide templates
  const activePresetKey = event.speaker_config?.active_slide_preset || "gdg_default";
  const activePreset = SPEAKER_SLIDE_TEMPLATE_PRESETS[activePresetKey] || SPEAKER_SLIDE_TEMPLATE_PRESETS.gdg_default;
  const slideTemplates = [
    activePreset,
    ...(event.speaker_config?.custom_slide_template_url
      ? [
          {
            id: "custom",
            label: "Custom Event Slide Template",
            url: event.speaker_config.custom_slide_template_url,
          },
        ]
      : []),
  ];

  const interpolatedMarkdown = interpolateHandbookVariables(rawMarkdown, event, slideTemplates);
  const contentHtml = simpleMarkdownToHtml(interpolatedMarkdown);
  const slidesHtml = renderSlideTemplatesHtml(slideTemplates);

  const venueDisplayName = event.venue?.name || [event.venue?.address, event.venue?.city].filter(Boolean).join(", ");

  return (
    <div className="font-sans mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Breadcrumb / Top bar */}
      <div className="mb-4 flex items-center gap-1.5 text-muted-foreground text-xs">
        <Link href={`/events/${eventId}`} className="hover:text-foreground hover:underline">
          {event.title}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">Speaker Handbook</span>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Email Header Banner */}
        <div className="relative aspect-[1244/388] max-h-72 w-full overflow-hidden border-b bg-muted">
          <Image
            src={headerImageUrl}
            alt={`${event.title} Header`}
            fill
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
            priority
          />
        </div>

        {/* Header Title & Event Metadata Pill */}
        <div className="border-b bg-muted/20 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs uppercase tracking-wider">
              <Mic className="size-3.5" />
              Official Speaker Handbook
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-[11px] text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3" />
              Verified Event Access
            </span>
          </div>

          <h1 className="mt-2.5 font-bold text-xl text-foreground tracking-tight sm:text-2xl">{event.title}</h1>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            Guidelines, slide dimensions, stage equipment, and logistics for confirmed speakers.
          </p>

          {/* Quick Meta Row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground text-xs">
            {event.start_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>
                  {new Date(event.start_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {venueDisplayName && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                <span>{venueDisplayName}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Presentation className="size-3.5 text-primary" />
              <span>16:9 Widescreen Slides</span>
            </div>
          </div>
        </div>

        {/* Handbook Content Card Body */}
        <div className="space-y-6 p-5 sm:p-8">
          {/* Handbook Body */}
          <div
            className="prose prose-neutral dark:prose-invert max-w-none space-y-3 prose-p:my-1.5 prose-p:leading-normal prose-headings:my-2 prose-ul:my-1.5 prose-li:my-0.5"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized markdown to HTML for speaker handbook
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* Slide Templates Cards */}
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-2 font-semibold text-foreground text-xs uppercase tracking-wider">
              Official Slide Decks &amp; Resources
            </h3>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized slide templates HTML */}
            <div dangerouslySetInnerHTML={{ __html: slidesHtml }} />
          </div>
        </div>

        {/* Bottom GDG Signature Footer */}
        <div className="border-t bg-muted/30 px-6 py-4 text-center sm:px-8">
          <div className="flex flex-col items-center justify-center gap-2">
            <Image
              alt="GDG Jakarta"
              src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png"
              width={112}
              height={38}
              className="inline-block h-auto w-28 opacity-90"
            />
            <p className="text-muted-foreground text-xs">
              Google Developer Group Jakarta &bull; Empowering developers across Indonesia
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
