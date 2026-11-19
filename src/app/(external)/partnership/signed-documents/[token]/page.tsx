import { notFound } from "next/navigation";

import { getPublicPartnerSignedDocumentByTokenAction } from "@/server/partner-signage-actions";

import { PublicSignedDocumentVerifier } from "./_components/public-signed-document-verifier";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicSignedDocumentVerifyPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const res = await getPublicPartnerSignedDocumentByTokenAction(token);
  if (!res.success || !res.document) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-bold text-destructive">Invalid or Expired Verification Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This signed partnership document record could not be found or is no longer active.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Please reach out to the GDG Jakarta team at info@gdgjakarta.org for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <PublicSignedDocumentVerifier document={res.document} />
    </div>
  );
}
