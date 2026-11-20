"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Award, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CertificateLookupForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = input.trim();
    if (!trimmed) {
      setError("Please enter a certificate token or verification URL.");
      return;
    }

    const match = trimmed.match(/cert_[a-f0-9]{32}/i);
    if (!match) {
      setError("Invalid format. Paste the full verification URL or cert_... token.");
      return;
    }

    router.push(`/certificates/${match[0].toLowerCase()}`);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Award className="size-6" />
        </div>
        <CardTitle className="text-xl">Verify GDG Jakarta Certificate</CardTitle>
        <CardDescription>
          Paste your certificate verification link or <code className="rounded bg-muted px-1 text-xs">cert_...</code>{" "}
          token to view and verify its authenticity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="https://gdgjakarta.com/certificates/cert_..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Verify Certificate
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
