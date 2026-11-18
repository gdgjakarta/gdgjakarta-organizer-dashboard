import type { Metadata } from "next";

import { getOrInitChapterSponsorConfigAction } from "@/server/sponsor-actions";

import { ChapterSponsorConfirmationForm } from "./_components/chapter-sponsor-confirmation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner & Sponsor Confirmation | GDG Jakarta",
  description: "Official brand partner and sponsor confirmation form for GDG Jakarta community chapter.",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ChapterSponsorConfirmationPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  const configRes = await getOrInitChapterSponsorConfigAction();
  const config = configRes.config;

  const expectedToken = config?.share_token;
  const isEnabled = config?.enabled !== false;

  if (!token || !expectedToken || token !== expectedToken || !isEnabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-bold text-destructive">Invalid or Expired Partner Confirmation Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This sponsor confirmation form link is invalid, has expired, or sponsor confirmations have been closed by
            the chapter team.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            If your organization is partnering with GDG Jakarta, please reach out to hello@gdgjakarta.org or your GDG
            liaison.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
      <ChapterSponsorConfirmationForm token={token} config={config} />
    </div>
  );
}
