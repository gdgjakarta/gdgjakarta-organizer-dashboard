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

  const imageUrl = event.cropped_banner_url ?? event.banner?.url ?? event.cropped_picture_url ?? event.picture?.url;

  return {
    title: `${event.title} | GDG Jakarta`,
    description: event.description_short ?? "Join us for this exciting Google Developer Groups Jakarta event!",
    openGraph: {
      title: event.title,
      description: event.description_short ?? "Join us for this exciting Google Developer Groups Jakarta event!",
      images: imageUrl ? [{ url: imageUrl, alt: event.title }] : undefined,
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
