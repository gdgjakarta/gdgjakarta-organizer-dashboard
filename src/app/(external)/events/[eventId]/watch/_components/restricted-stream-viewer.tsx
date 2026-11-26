"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ArrowLeft, KeyRound, Loader2, Lock, Mail, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  heartbeatStreamSessionAction,
  type PublicEventStreamMeta,
  redeemStreamAccessCodeAction,
  requestStreamAccessCodeAction,
} from "@/server/stream-actions";

import { ProtectedYoutubePlayer } from "./protected-youtube-player";

interface RestrictedStreamViewerProps {
  eventId: string;
  eventTitle: string;
  streamMeta: PublicEventStreamMeta;
}

interface UnlockedSession {
  sessionId: string;
  youtubeVideoId: string;
  viewerEmail: string;
  watermarkEnabled: boolean;
}

export function RestrictedStreamViewer({ eventId, eventTitle, streamMeta }: RestrictedStreamViewerProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedSession | null>(null);

  const activeSessionIdRef = useRef<string | null>(null);
  const hasSentLeaveRef = useRef(false);

  useEffect(() => {
    activeSessionIdRef.current = unlocked?.sessionId ?? null;
    if (unlocked?.sessionId) {
      hasSentLeaveRef.current = false;
    }
  }, [unlocked?.sessionId]);

  // Countdown for OTP resend cooldown
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSec]);

  const sendLeaveBeacon = useCallback(() => {
    const sid = activeSessionIdRef.current;
    if (!sid || hasSentLeaveRef.current) return;
    hasSentLeaveRef.current = true;

    const url = `/api/events/${encodeURIComponent(eventId)}/stream/leave`;
    const payload = JSON.stringify({ sessionId: sid });

    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      // Best-effort teardown on page leave
    }
  }, [eventId]);

  // Page-leave listeners while unlocked
  useEffect(() => {
    if (!unlocked) return;

    const handleLeave = () => {
      sendLeaveBeacon();
    };

    window.addEventListener("pagehide", handleLeave);
    window.addEventListener("beforeunload", handleLeave);

    return () => {
      window.removeEventListener("pagehide", handleLeave);
      window.removeEventListener("beforeunload", handleLeave);
    };
  }, [unlocked, sendLeaveBeacon]);

  // Dedicated unmount cleanup (BUG-1 hygiene)
  useEffect(() => {
    return () => {
      sendLeaveBeacon();
    };
  }, [sendLeaveBeacon]);

  // Jittered 45–60s heartbeat to detect revocation & kill-switch while reducing Firestore ops (PERF-5)
  useEffect(() => {
    if (!unlocked) return;
    const intervalMs = 45_000 + Math.floor(Math.random() * 15_000);

    const timer = window.setInterval(() => {
      void heartbeatStreamSessionAction(eventId, unlocked.sessionId).then((res) => {
        if (!res.active) {
          activeSessionIdRef.current = null;
          setUnlocked(null);
          setCode("");
          setStep("email");
          setErrorMsg(res.reason ?? "Your viewing session has ended. Request a new code to continue watching.");
          toast.error(res.reason ?? "Viewing session ended.");
        }
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [eventId, unlocked]);

  const handleRequestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    try {
      const res = await requestStreamAccessCodeAction(eventId, email, streamMeta.title || eventTitle);
      if (!res.success) {
        setErrorMsg(res.error ?? "Could not send access code.");
        if (res.retryAfterSec) {
          setCooldownSec(res.retryAfterSec);
        }
        return;
      }
      setStep("code");
      setCooldownSec(60);
      setInfoMsg(res.message ?? "Access code sent! Check your email inbox.");
      toast.success("Single-use access code sent to your email.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await redeemStreamAccessCodeAction(eventId, email, code);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }

      setUnlocked({
        sessionId: res.sessionId,
        youtubeVideoId: res.youtubeVideoId,
        viewerEmail: res.viewerEmail,
        watermarkEnabled: res.watermarkEnabled,
      });
      setCode("");
      toast.success("Stream unlocked. Leaving this page will end your session.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayTitle = streamMeta.title || eventTitle;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={`/events/${encodeURIComponent(eventId)}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Event Details
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-xl tracking-tight sm:text-2xl">{displayTitle}</h1>
            <Badge variant={streamMeta.accessMode === "whitelisted" ? "default" : "secondary"} className="gap-1">
              {streamMeta.accessMode === "whitelisted" ? (
                <>
                  <Lock className="size-3" />
                  Whitelisted Stream
                </>
              ) : (
                <>
                  <Radio className="size-3" />
                  Public Stream
                </>
              )}
            </Badge>
          </div>
        </div>

        {unlocked && (
          <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />
            Active Session • {unlocked.viewerEmail}
          </Badge>
        )}
      </div>

      {/* Public Stream */}
      {streamMeta.accessMode === "public" ? (
        streamMeta.publicYoutubeVideoId ? (
          <ProtectedYoutubePlayer
            videoId={streamMeta.publicYoutubeVideoId}
            title={displayTitle}
            watermarkEnabled={false}
          />
        ) : (
          /* Public stream missing video URL — do not fall through to OTP gate (BUG-5) */
          <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-base">Stream Not Yet Configured</CardTitle>
              <CardDescription className="text-xs">
                This public stream is enabled, but the organizer has not added a YouTube video URL yet.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : unlocked ? (
        /* Unlocked Whitelisted Stream */
        <div className="space-y-3">
          <ProtectedYoutubePlayer
            videoId={unlocked.youtubeVideoId}
            title={displayTitle}
            viewerEmail={unlocked.viewerEmail}
            sessionId={unlocked.sessionId}
            watermarkEnabled={unlocked.watermarkEnabled}
          />
          <p className="text-center text-muted-foreground text-xs">
            Your single-use code has been consumed. Leaving or refreshing this page ends your session—you can request a
            fresh code anytime with your whitelisted email.
          </p>
        </div>
      ) : (
        /* Whitelisted OTP Access Gate */
        <Card className="mx-auto max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {step === "email" ? <Mail className="size-4" /> : <KeyRound className="size-4" />}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {step === "email" ? "Verify Whitelisted Email" : "Enter Single-Use Access Code"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {step === "email"
                    ? "Enter your registered email to receive a 6-character one-time code."
                    : `We sent a 6-character code to ${email}.`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertTitle className="text-xs font-semibold">Access Notice</AlertTitle>
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}

            {infoMsg && !errorMsg && (
              <Alert>
                <AlertDescription className="text-xs">{infoMsg}</AlertDescription>
              </Alert>
            )}

            {step === "email" ? (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="viewer-email">Whitelisted Email Address</Label>
                  <Input
                    id="viewer-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || cooldownSec > 0}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : cooldownSec > 0 ? (
                    `Wait ${cooldownSec}s to resend`
                  ) : (
                    "Send Single-Use Code"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRedeemCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="access-code">6-Character Access Code</Label>
                  <Input
                    id="access-code"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="e.g. K7M9P2"
                    className="text-center font-mono text-lg tracking-[0.35em] uppercase"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || code.trim().length < 6}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Unlock Stream"
                  )}
                </Button>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCooldownSec(0);
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    disabled={submitting || cooldownSec > 0}
                    onClick={() => void handleRequestCode()}
                    className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className="size-3" />
                    {cooldownSec > 0 ? `Resend in ${cooldownSec}s` : "Request new code"}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
