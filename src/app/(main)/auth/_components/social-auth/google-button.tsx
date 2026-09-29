"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";
import { siGoogle } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signInWithGoogle, useAuthStore } from "@/stores/auth/auth-provider";

export function GoogleButton({
  className,
  onClick,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // If returning from Google redirect, show loading state while AuthProvider resolves redirect
  const [isPendingRedirect, setIsPendingRedirect] = useState(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("auth_redirect_in_progress") === "true") {
      return true;
    }
    return false;
  });

  // If auth has resolved (user authenticated or store done loading without user), clear pending redirect state
  useEffect(() => {
    if (!isAuthLoading || user) {
      setIsPendingRedirect(false);
    }
  }, [isAuthLoading, user]);

  const isLoading = isRedirecting || (isPendingRedirect && !user);

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    try {
      setIsRedirecting(true);
      console.log("[Google Button] User clicked Sign in with Google (initiating redirect)");
      const callbackUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("callbackUrl") : null;

      await signInWithGoogle(callbackUrl);
    } catch (err: unknown) {
      console.error("[Google Button] Error during Google Sign-In redirect:", err);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("auth_redirect_in_progress");
        sessionStorage.removeItem("auth_redirect_callback_url");
      }
      setIsRedirecting(false);
      setIsPendingRedirect(false);
      const error = err as { code?: string; message?: string };
      toast.error(error.message ?? "Failed to initiate Google Sign-In. Please try again.");
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
          {children ?? "Sign in with Google"}
        </>
      )}
    </Button>
  );
}
