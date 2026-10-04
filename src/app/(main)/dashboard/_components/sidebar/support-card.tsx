"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SUPPORT_CARD_DISMISSED_KEY = "gdg_support_card_dismissed";

export function SupportCard() {
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(SUPPORT_CARD_DISMISSED_KEY);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore localStorage errors (e.g. private mode)
    } finally {
      setMounted(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(SUPPORT_CARD_DISMISSED_KEY, "true");
    } catch {
      // Ignore localStorage errors
    }
  };

  if (!mounted || isDismissed) {
    return null;
  }

  return (
    <Card
      size="sm"
      className="fade-in slide-in-from-bottom-2 animate-in overflow-hidden shadow-none duration-300 group-data-[collapsible=icon]:hidden"
    >
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">Have something in mind?</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleDismiss}
            aria-label="Dismiss feedback card"
            className="-mt-1 -mr-1.5 size-5 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        </CardAction>
        <CardDescription className="line-clamp-3">
          Send your feedback and suggestion{" "}
          <Link
            href="https://forms.gle/yNxbRvtyQYBs6ZFU7"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
          >
            here
          </Link>
          .
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
