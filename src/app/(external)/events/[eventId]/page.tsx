import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { getPublicEventById } from "@/lib/bevy/client";

import { PublicEventDetailView } from "./_components/public-event-detail-view";

export const dynamic = "force-dynamic";

interface PublicEventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: PublicEventDetailPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getPublicEventById(eventId);

  if (!event) {
    return {
      title: "Event Not Found | GDG Jakarta",
      description: "The requested event could not be found.",
    };
  }

  const thumbnailImageUrl =
    event.cropped_picture_url ??
    event.picture?.url ??
    event.picture?.thumbnail_url ??
    event.cropped_banner_url ??
    event.banner?.url;
  const bannerImageUrl = event.cropped_banner_url ?? event.banner?.url ?? event.banner?.thumbnail_url;

  const ogImages = [];
  if (thumbnailImageUrl) {
    ogImages.push({
      url: thumbnailImageUrl,
      width: 1080,
      height: 1080,
      alt: event.title,
    });
  }
  if (bannerImageUrl && bannerImageUrl !== thumbnailImageUrl) {
    ogImages.push({
      url: bannerImageUrl,
      width: 2560,
      height: 650,
      alt: `${event.title} Banner`,
    });
  }

  return {
    title: `${event.title} | GDG Jakarta`,
    description: event.description_short ?? "Join us for this exciting Google Developer Groups Jakarta event!",
    openGraph: {
      title: event.title,
      description: event.description_short ?? "Join us for this exciting Google Developer Groups Jakarta event!",
      images: ogImages.length > 0 ? ogImages : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: event.description_short ?? "Join us for this exciting Google Developer Groups Jakarta event!",
      images: thumbnailImageUrl ? [thumbnailImageUrl] : undefined,
    },
  };
}

export default async function PublicEventDetailPage({ params }: PublicEventDetailPageProps) {
  const { eventId } = await params;
  const event = await getPublicEventById(eventId);

  if (!event) {
    notFound();
  }

  return <PublicEventDetailView event={event} />;
}
