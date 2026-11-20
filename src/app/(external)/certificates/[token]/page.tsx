import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { getPublicCertificateByTokenAction } from "@/server/certificate-actions";

import { PublicCertificateViewer } from "./_components/public-certificate-viewer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const res = await getPublicCertificateByTokenAction(token);
  const cert = res.certificate;

  if (!cert) {
    return {
      title: "Certificate Verification | GDG Jakarta",
      description: "Verify official Google Developer Group Jakarta event certificates.",
    };
  }

  const label = cert.certificate_type === "speaker" ? "Certificate of Appreciation" : "Certificate of Attendance";
  const title = `${label} — ${cert.recipient_name} | ${cert.event_title}`;
  const description = `Official ${label} issued by GDG Jakarta to ${cert.recipient_name} for ${cert.event_title}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://gdgjakarta.com/certificates/${cert.token}`,
      siteName: "GDG Jakarta",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicCertificatePage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const res = await getPublicCertificateByTokenAction(token);
  if (!res.success || !res.certificate) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-bold text-destructive">Certificate Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This certificate verification link is invalid or does not exist.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Need help? Contact GDG Jakarta at info@gdgjakarta.org.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
      <PublicCertificateViewer certificate={res.certificate} />
    </div>
  );
}
