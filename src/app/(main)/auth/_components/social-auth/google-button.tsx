"use client";

import { useState } from "react";

import Image from "next/image";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import googleFavicon from "@/app/Google_Favicon.webp";
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Signing in…");

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    try {
      setIsLoading(true);
      setLoadingText("Signing in…");
      console.log("[Google Button] User clicked Sign in with Google (using Popup)");

      const { organizer, isAllowed } = await signInWithGoogle();

      setLoadingText("Navigating to dashboard…");
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
        window.location.assign(targetUrl);
      } else {
        toast.success(`Welcome, ${organizer.name}!`);
        const isOrganizerOnlyCallback =
          callbackUrl?.startsWith("/dashboard/organizer") ||
          callbackUrl?.startsWith("/dashboard/events") ||
          callbackUrl?.startsWith("/dashboard/email-manager") ||
          callbackUrl?.startsWith("/dashboard/members");

        const targetUrl = callbackUrl?.startsWith("/") && !isOrganizerOnlyCallback ? callbackUrl : "/dashboard/member";
        console.log(`[Google Button] Navigating member (${organizer.email}) to: ${targetUrl}`);
        window.location.assign(targetUrl);
      }
      // Note: We deliberately do not call setIsLoading(false) on success so the button
      // stays in a clean loading state until the new page load completes.
    } catch (err: unknown) {
      setIsLoading(false);
      const error = err as { code?: string; message?: string };
      console.error("[Google Button] Error during Google Sign-In:", error);
      if (error.code !== "auth/popup-closed-by-user") {
        let message = error.message ?? "Failed to sign in with Google. Please try again.";
        if (message.includes("Minified React error") || message.includes("Server Components render")) {
          message = "An error occurred while communicating with the server. Please try again.";
        }
        toast.error(message);
      }
    }
  };

  return (
    <Button
      className={cn("h-11 w-full bg-blue-700 hover:bg-blue-600", className)}
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          <Image src={googleFavicon} alt="Google" width={24} height={24} className="mr-2 size-5 object-contain" />
          {children ?? "Sign in with Google"}
        </>
      )}
    </Button>
  );
}
