import type { Metadata } from "next";

import { EmailBlastForm } from "./_components/email-blast-form";

export const metadata: Metadata = {
  title: "Email Blast",
};

export default function EmailBlastPage() {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl tracking-tight">Email Blast</h1>
        <p className="text-muted-foreground text-sm">Send bulk emails to your members via n8n integration.</p>
      </div>

      <div className="w-full">
        <EmailBlastForm />
      </div>
    </div>
  );
}
