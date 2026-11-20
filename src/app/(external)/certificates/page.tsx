import type { Metadata } from "next";

import { CertificateLookupForm } from "./_components/certificate-lookup-form";

export const metadata: Metadata = {
  title: "Verify Certificate | GDG Jakarta",
  description: "Verify the authenticity of official Google Developer Group Jakarta event certificates.",
};

export default function CertificatesIndexPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/30 px-4 py-12">
      <CertificateLookupForm />
    </div>
  );
}
