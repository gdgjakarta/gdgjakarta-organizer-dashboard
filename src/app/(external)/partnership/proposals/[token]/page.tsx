import { notFound } from "next/navigation";

import { getProposalByTokenAction } from "@/server/public-proposal-actions";

import { SponsorProposalPortal } from "./_components/sponsor-proposal-portal";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SponsorProposalPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const res = await getProposalByTokenAction(token);
  if (!res.success || !res.proposal) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-bold text-destructive">Invalid or Expired Proposal Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This partnership proposal link could not be found or has expired.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Please reach out to the GDG Jakarta team at partnership@gdgjakarta.org for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <SponsorProposalPortal proposal={res.proposal} />
    </div>
  );
}
