"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { siGoogle } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signInWithGoogle } from "@/stores/auth/auth-provider";

export function GoogleButton({
  className,
  onClick,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    try {
      setIsLoading(true);
      console.log("[Google Button] User clicked Sign in with Google");
      const { organizer, isAllowed } = await signInWithGoogle();
      const callbackUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("callbackUrl") : null;

      console.log(
        "[Google Button] Processing redirection. Role allowed as organizer:",
        isAllowed,
        "callbackUrl:",
        callbackUrl,
      );

      if (isAllowed) {
        toast.success(`Welcome back, ${organizer.name}! (${organizer.chapterRole ?? "Organizer"})`);
        const targetUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard/organizer";
        console.log(`[Google Button] Navigating organizer (${organizer.email}) to: ${targetUrl}`);
        router.push(targetUrl);
      } else {
        toast.success(`Welcome, ${organizer.name}!`);
        // If callbackUrl points to organizer-specific paths, redirect to member dashboard instead
        const isOrganizerOnlyCallback =
          callbackUrl?.startsWith("/dashboard/organizer") ||
          callbackUrl?.startsWith("/dashboard/events") ||
          callbackUrl?.startsWith("/dashboard/email-manager") ||
          callbackUrl?.startsWith("/dashboard/members");

        const targetUrl = callbackUrl?.startsWith("/") && !isOrganizerOnlyCallback ? callbackUrl : "/dashboard/member";
        console.log(`[Google Button] Navigating member (${organizer.email}) to: ${targetUrl}`);
        router.push(targetUrl);
      }

      router.refresh();
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("[Google Button] Error during Google Sign-In:", error);
      if (error.code !== "auth/popup-closed-by-user") {
        toast.error(error.message ?? "Failed to sign in with Google. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      className={cn("w-full", className)}
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          <SimpleIcon icon={siGoogle} className="mr-2 size-4" />
          {children || "Sign in with Google"}
        </>
      )}
    </Button>
  );
}
