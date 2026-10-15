"use client";

import { useState } from "react";

import { Check, CheckCircle2, Copy, KeyRound, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirestoreMember } from "@/lib/firestore/types";
import { signOutOrganizer } from "@/stores/auth/auth-provider";
import type { AuthOrganizer } from "@/stores/auth/auth-store";

interface AccountSecurityTabProps {
  user: AuthOrganizer;
  member: FirestoreMember | null;
}

export function AccountSecurityTab({ user, member }: AccountSecurityTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error(`Failed to copy ${label}.`);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOutOrganizer();
      window.location.assign("/auth/login");
    } catch (err) {
      console.error("[AccountSecurityTab] Sign out error:", err);
      toast.error("Failed to sign out cleanly. Redirecting...");
      window.location.assign("/auth/login");
    }
  };

  const email = member?.email ?? user.email;
  const firebaseUid = user.id;
  const bevyUserId = String(member?.bevy_user_id ?? user.bevyUserId ?? "Not assigned");
  const referralCode = member?.referral_code ?? "GDG7X9K";

  return (
    <div className="space-y-6">
      {/* Identity Provider Card */}
      <Card className="border-none shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-500" />
            <div>
              <CardTitle className="text-lg">Authentication Provider</CardTitle>
              <CardDescription>Single Sign-On (SSO) credentials linked to your GDG Jakarta account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-background shadow-2xs">
                {/* Google "G" icon */}
                <svg className="size-5" viewBox="0 0 24 24" role="img" aria-label="Google Logo">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">Google Single Sign-On</span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="mr-1 size-3" />
                    Verified
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{email}</p>
              </div>
            </div>
            <span className="text-muted-foreground text-xs">Primary Login Provider</span>
          </div>
        </CardContent>
      </Card>

      {/* System Identifiers Card */}
      <Card className="border-none shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <div>
              <CardTitle className="text-lg">System Identifiers</CardTitle>
              <CardDescription>Unique keys associated with your account across Firebase and Bevy</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Firebase UID */}
          <div className="flex flex-col gap-2 rounded-xl bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <span className="font-medium text-muted-foreground text-xs">Firebase UID</span>
              <p className="truncate font-mono text-foreground text-xs">{firebaseUid}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(firebaseUid, "Firebase UID")}
              className="w-fit shrink-0 gap-1.5 text-xs"
            >
              {copiedKey === "Firebase UID" ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copiedKey === "Firebase UID" ? "Copied" : "Copy UID"}</span>
            </Button>
          </div>

          {/* Bevy User ID */}
          <div className="flex flex-col gap-2 rounded-xl bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <span className="font-medium text-muted-foreground text-xs">Bevy Chapter User ID</span>
              <p className="truncate font-mono text-foreground text-xs">{bevyUserId}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={bevyUserId === "Not assigned"}
              onClick={() => copyToClipboard(bevyUserId, "Bevy User ID")}
              className="w-fit shrink-0 gap-1.5 text-xs"
            >
              {copiedKey === "Bevy User ID" ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copiedKey === "Bevy User ID" ? "Copied" : "Copy Bevy ID"}</span>
            </Button>
          </div>

          {/* Referral Code */}
          <div className="flex flex-col gap-2 rounded-xl bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <span className="font-medium text-muted-foreground text-xs">Member Referral Code</span>
              <p className="truncate font-mono font-semibold text-foreground text-xs">{referralCode}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(referralCode, "Referral Code")}
              className="w-fit shrink-0 gap-1.5 text-xs"
            >
              {copiedKey === "Referral Code" ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copiedKey === "Referral Code" ? "Copied" : "Copy Code"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session & Sign Out Card */}
      <Card className="border-destructive/20 border-none bg-destructive/5 shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            <CardTitle className="text-lg">Session & Sign Out</CardTitle>
          </div>
          <CardDescription>
            Securely sign out of your GDG Jakarta Organizer & Member Dashboard on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-muted-foreground text-xs">
            Signing out will invalidate your current session cookies and clear all cached dashboard state.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isLoggingOut} className="shrink-0 gap-2">
                <LogOut className="size-4" />
                <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be logged out of your GDG Jakarta account. Any unsaved edits will be discarded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSignOut}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirm Sign Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
