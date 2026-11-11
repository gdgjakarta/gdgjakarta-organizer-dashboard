import { notFound } from "next/navigation";

import { getFirestoreEventByIdServer } from "@/server/firestore-admin";

import { SpeakerConfirmationForm } from "./_components/speaker-confirmation-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function SpeakerConfirmationPage({ params, searchParams }: PageProps) {
  const { eventId } = await params;
  const { token } = await searchParams;

  const event = await getFirestoreEventByIdServer(String(eventId));
  if (!event) {
    notFound();
  }

  // Verify token matches event's speaker share token
  const expectedToken = event.speaker_config?.share_token;
  const isEnabled = event.speaker_config?.enabled !== false;

  if (!token || !expectedToken || token !== expectedToken || !isEnabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-bold text-destructive">Invalid or Expired Speaker Confirmation Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This speaker confirmation form link is invalid, has expired, or confirmations have been closed by the event
            organizers.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            If you were invited to speak at <strong>{event.title}</strong>, please contact the GDG Jakarta organizing
            team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 sm:px-6 lg:px-8">
      <SpeakerConfirmationForm event={event} token={token} />
    </div>
  );
}
