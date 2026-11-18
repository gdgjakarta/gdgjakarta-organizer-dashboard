import { notFound } from "next/navigation";

import { getPublicSponsorDocumentByTokenAction } from "@/server/sponsor-document-actions";

import { PublicSponsorDocumentPortal } from "./_components/public-sponsor-document-portal";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicSponsorDocumentPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const res = await getPublicSponsorDocumentByTokenAction(token);
  if (!res.success || !res.document) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-bold text-destructive">Invalid or Expired Document Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This sponsorship document link could not be found or is no longer active.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Please reach out to the GDG Jakarta team at info@gdgjakarta.org for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <PublicSponsorDocumentPortal initialDocument={res.document} templatesConfig={res.templatesConfig} />
    </div>
  );
}
