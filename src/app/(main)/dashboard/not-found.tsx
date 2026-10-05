"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Calendar, FileQuestion, House } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth/auth-provider";

export default function DashboardNotFound() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const homeHref = user?.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member";
  const eventsHref = user?.role === "organizer" ? "/dashboard/events" : "/dashboard/member/my-events";

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(homeHref);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-var(--dashboard-header-height,3rem)-6rem)] w-full items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border text-center shadow-xs">
        <CardHeader className="flex flex-col items-center gap-3 pb-2">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-blue-500" />
              <span className="size-1.5 rounded-full bg-red-500" />
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span className="size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span>404 • Resource Not Found</span>
          </div>

          {/* Icon */}
          <div className="mt-2 flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <FileQuestion className="size-7 text-primary" />
          </div>

          <CardTitle className="font-bold text-2xl text-foreground tracking-tight">Dashboard Page Not Found</CardTitle>
          <CardDescription className="max-w-md text-muted-foreground text-sm leading-relaxed">
            The dashboard page, event, or record you are trying to view doesn&apos;t exist, has been moved, or you might
            not have access to it.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Button asChild size="default" className="gap-2 shadow-xs">
              <Link href={homeHref}>
                <House className="size-4" />
                <span>Dashboard Home</span>
              </Link>
            </Button>
            <Button variant="outline" size="default" onClick={handleGoBack} className="gap-2">
              <ArrowLeft className="size-4" />
              <span>Go Back</span>
            </Button>
            <Button asChild variant="outline" size="default" className="gap-2">
              <Link href={eventsHref}>
                <Calendar className="size-4" />
                <span>Events</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
