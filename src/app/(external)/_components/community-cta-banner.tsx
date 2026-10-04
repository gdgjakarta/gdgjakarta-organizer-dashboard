"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowRight, Sparkles } from "lucide-react";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function CommunityCtaBanner() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      setIsNavigating(false);
    }
  }, [pathname]);

  const renderDashboardAction = () => {
    if (isLoading) {
      return (
        <div className="relative h-12 w-52 overflow-hidden rounded-full bg-muted/40">
          <div className="shimmer-wave" aria-hidden="true" />
        </div>
      );
    }

    if (user) {
      return (
        <Button
          asChild
          size="lg"
          className="relative h-12 overflow-hidden rounded-full px-8 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all hover:scale-[1.02]"
          style={{
            backgroundColor: "var(--theme-primary)",
            color: "var(--theme-primary-foreground)",
          }}
        >
          <Link
            href={user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member"}
            onClick={() => setIsNavigating(true)}
          >
            <span>Open Your Dashboard</span>
            <ArrowRight className="ml-2 size-4" />
            {isNavigating && <div className="shimmer-wave" aria-hidden="true" />}
          </Link>
        </Button>
      );
    }

    return (
      <GoogleButton
        size="lg"
        variant="default"
        className="h-12 w-auto rounded-full px-8 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all hover:scale-[1.02]"
        style={{
          backgroundColor: "var(--theme-primary)",
          color: "var(--theme-primary-foreground)",
        }}
      >
        Join with Google
      </GoogleButton>
    );
  };

  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div
        className="relative overflow-hidden rounded-[2.5rem] border p-8 text-center shadow-xl transition-all duration-500 sm:p-14 lg:p-20"
        style={{
          backgroundColor: "var(--theme-bg-subtle)",
          borderColor: "var(--theme-border)",
          boxShadow: "var(--theme-shadow)",
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-medium text-xs shadow-xs"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--background)",
              color: "var(--theme-text)",
            }}
          >
            <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>Open & Free Community</span>
          </div>

          <h2 className="mt-6 font-medium text-[32px] leading-tight tracking-tight sm:text-[44px] lg:text-[59.33px]">
            Your community to grow.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-[14px] leading-relaxed">
            Join thousands of developers in Jakarta building the future of software, cloud infrastructure, and AI. Zero
            membership fees, maximum impact.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {renderDashboardAction()}

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-[var(--theme-border)] bg-background/80 px-8 font-medium text-[14px] backdrop-blur-xs transition-all hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
            >
              <Link href="/events">Browse Events</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
