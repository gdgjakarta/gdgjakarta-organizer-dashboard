"use client";

import { useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    try {
      setIsLoading(true);
      const { organizer, isAllowed } = await signInWithGoogle();

      if (isAllowed) {
        toast.success(`Welcome back, ${organizer.name}! (${organizer.chapterRole ?? "Organizer"})`);
        const callbackUrl = searchParams.get("callbackUrl");
        const targetUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard/organizer";
        router.push(targetUrl);
      } else {
        toast.success(`Welcome, ${organizer.name}!`);
        const callbackUrl = searchParams.get("callbackUrl");
        const targetUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard/member";
        router.push(targetUrl);
      }

      router.refresh();
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
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
