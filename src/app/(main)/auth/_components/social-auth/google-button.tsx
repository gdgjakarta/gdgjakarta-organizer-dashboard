"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import googleFavicon from "@/app/Google_Favicon.webp";
import { Button } from "@/components/ui/button";
import { isCoreTeamOrStaff, isExecutiveOrganizer } from "@/lib/auth-roles";
import { cn } from "@/lib/utils";
import { handleGoogleRedirectResult, signInWithGoogle, signInWithGoogleRedirect } from "@/stores/auth/auth-provider";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

export interface GoogleButtonProps extends React.ComponentProps<typeof Button> {
  redirect?: boolean;
  callbackUrl?: string;
  authMode?: "redirect" | "popup";
  onSuccess?: (result: { organizer: AuthOrganizer; isAllowed: boolean }) => void;
}

const PENDING_CALLBACK_URL_KEY = "gdg_auth_callback_url";

function navigateAfterLogin(organizer: AuthOrganizer, isAllowed: boolean, callbackUrl: string | null) {
  const isExecutive = isExecutiveOrganizer(organizer);
  const isStaff = isCoreTeamOrStaff(organizer);

  if (isExecutive) {
    toast.success(`Welcome back, ${organizer.name}! (${organizer.chapterRole ?? "Organizer"})`);
    const targetUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard/organizer";
    console.log(`[Google Auth] Navigating organizer (${organizer.email}) to: ${targetUrl}`);
    window.location.assign(targetUrl);
  } else if (isStaff) {
    toast.success(`Welcome back, ${organizer.name}! (${organizer.chapterRole ?? "Core Team"})`);
    const isRestrictedForStaff =
      callbackUrl?.startsWith("/dashboard/organizer") ||
      callbackUrl?.startsWith("/dashboard/email-manager") ||
      callbackUrl?.startsWith("/dashboard/members") ||
      callbackUrl?.startsWith("/dashboard/referrals") ||
      callbackUrl?.startsWith("/dashboard/partnership") ||
      callbackUrl?.startsWith("/dashboard/crm") ||
      callbackUrl?.startsWith("/dashboard/roles");

    const targetUrl = callbackUrl?.startsWith("/") && !isRestrictedForStaff ? callbackUrl : "/dashboard/member";
    console.log(`[Google Auth] Navigating core team/staff (${organizer.email}) to: ${targetUrl}`);
    window.location.assign(targetUrl);
  } else {
    toast.success(`Welcome, ${organizer.name}!`);
    const isOrganizerOnlyCallback =
      callbackUrl?.startsWith("/dashboard/organizer") ||
      callbackUrl?.startsWith("/dashboard/events") ||
      callbackUrl?.startsWith("/dashboard/email-manager") ||
      callbackUrl?.startsWith("/dashboard/members") ||
      callbackUrl?.startsWith("/dashboard/referrals");

    const targetUrl = callbackUrl?.startsWith("/") && !isOrganizerOnlyCallback ? callbackUrl : "/dashboard/member";
    console.log(`[Google Auth] Navigating member (${organizer.email}) to: ${targetUrl}`);
    window.location.assign(targetUrl);
  }
}

export function GoogleButton({
  className,
  onClick,
  disabled,
  children,
  redirect = true,
  authMode = "popup",
  callbackUrl: propCallbackUrl,
  onSuccess,
  ...props
}: GoogleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Signing in…");

  // Consume any redirect result upon mount (e.g. returning from Google Sign-In redirect flow)
  useEffect(() => {
    let isMounted = true;

    async function checkRedirectResult() {
      try {
        const result = await handleGoogleRedirectResult();
        if (!result || !isMounted) return;

        setIsLoading(true);
        setLoadingText("Navigating to dashboard…");

        const savedCallback = typeof window !== "undefined" ? sessionStorage.getItem(PENDING_CALLBACK_URL_KEY) : null;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(PENDING_CALLBACK_URL_KEY);
        }

        const queryCallback =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("callbackUrl") : null;
        const callbackUrl = propCallbackUrl ?? savedCallback ?? queryCallback;

        if (!redirect) {
          setIsLoading(false);
          onSuccess?.(result);
          return;
        }

        // Allow server cookie setting from handleUserPostLoginAction to settle before navigating
        await new Promise((resolve) => setTimeout(resolve, 150));
        navigateAfterLogin(result.organizer, result.isAllowed, callbackUrl);
      } catch (err) {
        if (!isMounted) return;
        setIsLoading(false);
        const error = err as { code?: string; message?: string };
        console.error("[Google Button] Redirect login error:", error);
        toast.error(error.message ?? "Failed to complete sign in. Please try again.");
      }
    }

    void checkRedirectResult();

    return () => {
      isMounted = false;
    };
  }, [propCallbackUrl, redirect, onSuccess]);

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    try {
      setIsLoading(true);
      setLoadingText("Signing in…");

      const callbackUrl =
        propCallbackUrl ??
        (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("callbackUrl") : null);

      if (authMode === "popup") {
        console.log("[Google Button] User clicked Sign in with Google (Popup mode)");
        try {
          const result = await signInWithGoogle();
          if (!redirect) {
            setIsLoading(false);
            onSuccess?.(result);
            return;
          }
          setLoadingText("Navigating to dashboard…");
          navigateAfterLogin(result.organizer, result.isAllowed, callbackUrl);
          return;
        } catch (popupErr: unknown) {
          const error = popupErr as { code?: string; message?: string };
          // If popup was blocked or unsupported, seamlessly fall back to redirect
          if (
            error.code === "auth/popup-blocked" ||
            error.code === "auth/operation-not-supported-in-this-environment" ||
            error.code === "auth/cancelled-popup-request"
          ) {
            console.warn("[Google Button] Popup blocked or not supported. Falling back to redirect mode:", error.code);
            if (callbackUrl && typeof window !== "undefined") {
              sessionStorage.setItem(PENDING_CALLBACK_URL_KEY, callbackUrl);
            }
            await signInWithGoogleRedirect();
            return;
          }
          throw popupErr;
        }
      }

      // Default redirect mode
      if (callbackUrl && typeof window !== "undefined") {
        sessionStorage.setItem(PENDING_CALLBACK_URL_KEY, callbackUrl);
      }

      console.log("[Google Button] User clicked Sign in with Google (Redirect mode)");
      await signInWithGoogleRedirect();
      // Browser immediately redirects to accounts.google.com
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
