"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { parseVideoUrl } from "@/lib/events/media-utils";
import {
  type EventStreamSessionDoc,
  parseWhitelistEmails,
  type StreamAccessMode,
} from "@/lib/events/stream-access";
import type { FirestoreEvent } from "@/lib/firestore/types";
import {
  getEventStreamConfigAction,
  listEventStreamSessionsAction,
  revokeStreamSessionAction,
  saveEventStreamConfigAction,
} from "@/server/stream-actions";

interface StreamAccessTabProps {
  eventId: string;
  event: FirestoreEvent;
}

interface ConfigSnapshot {
  enabled: boolean;
  title: string;
  youtubeUrl: string;
  accessMode: StreamAccessMode;
  watermarkEnabled: boolean;
  includeApprovedRegistrants: boolean;
  manualWhitelistRaw: string;
}

export function StreamAccessTab({ eventId, event }: StreamAccessTabProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingSessions, setRefreshingSessions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState(event.title || "");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [accessMode, setAccessMode] = useState<StreamAccessMode>("whitelisted");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [includeApprovedRegistrants, setIncludeApprovedRegistrants] = useState(true);
  const [manualWhitelistRaw, setManualWhitelistRaw] = useState("");

  const [whitelistCount, setWhitelistCount] = useState(0);
  const [sessions, setSessions] = useState<EventStreamSessionDoc[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<ConfigSnapshot | null>(null);

  const watchUrl = `https://gdgjakarta.com/events/${encodeURIComponent(eventId)}/watch`;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getEventStreamConfigAction(eventId);
      if (!res.success) {
        setLoadError(res.error);
        toast.error(res.error);
        return;
      }
      const cfg = res.data;
      const rawManual = cfg.manualWhitelistEmails.join("\n");
      const snap: ConfigSnapshot = {
        enabled: cfg.enabled,
        title: cfg.title || event.title || "",
        youtubeUrl: cfg.youtubeUrl,
        accessMode: cfg.accessMode,
        watermarkEnabled: cfg.watermarkEnabled,
        includeApprovedRegistrants: cfg.includeApprovedRegistrants,
        manualWhitelistRaw: rawManual,
      };
      setEnabled(snap.enabled);
      setTitle(snap.title);
      setYoutubeUrl(snap.youtubeUrl);
      setAccessMode(snap.accessMode);
      setWatermarkEnabled(snap.watermarkEnabled);
      setIncludeApprovedRegistrants(snap.includeApprovedRegistrants);
      setManualWhitelistRaw(snap.manualWhitelistRaw);
      setWhitelistCount(cfg.whitelistCount);
      setSessions(cfg.sessions);
      setInitialSnapshot(snap);
    } catch {
      setLoadError("Failed to load stream configuration. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [eventId, event.title]);

  // Dedicated session refresh so clicking Refresh never wipes unsaved form edits (BUG-2)
  const refreshSessions = useCallback(async () => {
    setRefreshingSessions(true);
    try {
      const res = await listEventStreamSessionsAction(eventId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSessions(res.sessions);
    } finally {
      setRefreshingSessions(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const parsedVideo = useMemo(() => parseVideoUrl(youtubeUrl), [youtubeUrl]);
  const parsedManual = useMemo(() => parseWhitelistEmails(manualWhitelistRaw), [manualWhitelistRaw]);

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return (
      enabled !== initialSnapshot.enabled ||
      title !== initialSnapshot.title ||
      youtubeUrl !== initialSnapshot.youtubeUrl ||
      accessMode !== initialSnapshot.accessMode ||
      watermarkEnabled !== initialSnapshot.watermarkEnabled ||
      includeApprovedRegistrants !== initialSnapshot.includeApprovedRegistrants ||
      manualWhitelistRaw !== initialSnapshot.manualWhitelistRaw
    );
  }, [
    enabled,
    title,
    youtubeUrl,
    accessMode,
    watermarkEnabled,
    includeApprovedRegistrants,
    manualWhitelistRaw,
    initialSnapshot,
  ]);

  const handleDiscard = () => {
    if (!initialSnapshot) return;
    setEnabled(initialSnapshot.enabled);
    setTitle(initialSnapshot.title);
    setYoutubeUrl(initialSnapshot.youtubeUrl);
    setAccessMode(initialSnapshot.accessMode);
    setWatermarkEnabled(initialSnapshot.watermarkEnabled);
    setIncludeApprovedRegistrants(initialSnapshot.includeApprovedRegistrants);
    setManualWhitelistRaw(initialSnapshot.manualWhitelistRaw);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveEventStreamConfigAction({
        eventId,
        enabled,
        title,
        youtubeUrl,
        accessMode,
        watermarkEnabled,
        includeApprovedRegistrants,
        manualWhitelistRaw,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      toast.success(
        accessMode === "whitelisted"
          ? `Stream saved (${res.whitelistCount} whitelisted email${res.whitelistCount === 1 ? "" : "s"}).`
          : "Public stream configuration saved.",
      );
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWatchLink = async () => {
    try {
      await navigator.clipboard.writeText(watchUrl);
      setCopiedLink(true);
      toast.success("Watch link copied to clipboard.");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const res = await revokeStreamSessionAction(eventId, sessionId);
      if (!res.success) {
        toast.error(res.error ?? "Failed to revoke session.");
        return;
      }
      toast.success("Viewing session revoked.");
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: "revoked", ended_at: Date.now() } : s)),
      );
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading stream settings...
        </CardContent>
      </Card>
    );
  }

  // Dedicated error + retry state on initial load failure (BUG-3)
  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <ShieldAlert className="size-8 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium text-sm">Could not load stream configuration</p>
            <p className="text-muted-foreground text-xs">{loadError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadConfig()}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeSessionsCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6 pb-24">
      {/* Watch Page Link Bar */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-primary" />
              <CardTitle className="text-base sm:text-lg">Event Stream & Restricted Access</CardTitle>
              <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
            </div>
            <CardDescription>
              Configure an embedded YouTube stream as public or whitelisted with single-use email access codes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyWatchLink}>
              {copiedLink ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
              Copy Watch URL
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/events/${encodeURIComponent(eventId)}/watch`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-3.5" />
                Open Watch Page
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="stream-enabled" className="font-medium text-sm">
                Enable Watch Page
              </Label>
              <p className="text-muted-foreground text-xs">
                When enabled, attendees can access this stream at{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{watchUrl}</code>.
              </p>
            </div>
            <Switch id="stream-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stream-title">Stream Title</Label>
              <Input
                id="stream-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. DevFest Jakarta — Main Stage Livestream"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stream-youtube-url">YouTube Stream / Video URL</Label>
              <Input
                id="stream-youtube-url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/live/... or https://youtu.be/..."
              />
              {youtubeUrl.trim() && (
                <p className="text-xs">
                  {parsedVideo?.type === "youtube" && parsedVideo.videoId ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Valid YouTube ID detected: <code>{parsedVideo.videoId}</code>
                    </span>
                  ) : (
                    <span className="text-destructive">Enter a valid YouTube watch, live, or youtu.be URL.</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Access Mode Selector with proper radiogroup semantics (BUG-8) */}
          <div className="space-y-2">
            <Label id="access-mode-label">Access Mode</Label>
            <div role="radiogroup" aria-labelledby="access-mode-label" className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                role="radio"
                aria-checked={accessMode === "public"}
                onClick={() => setAccessMode("public")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  accessMode === "public"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <Globe className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="space-y-1">
                  <div className="font-medium text-sm">Public Stream</div>
                  <p className="text-muted-foreground text-xs">
                    Anyone with the watch link can view the embedded stream immediately without a code.
                  </p>
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={accessMode === "whitelisted"}
                onClick={() => setAccessMode("whitelisted")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  accessMode === "whitelisted"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="space-y-1">
                  <div className="font-medium text-sm">Whitelisted (Single-Use Email Code)</div>
                  <p className="text-muted-foreground text-xs">
                    Only whitelisted emails can request a 10-minute single-use code via email. Video ID is sealed
                    server-side until unlocked.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Watermark toggle only applies to whitelisted mode where viewer email is known (BUG-11) */}
          {accessMode === "whitelisted" && (
            <div className="flex items-center justify-between rounded-lg border p-3.5">
              <div className="space-y-0.5">
                <Label htmlFor="stream-watermark" className="font-medium text-sm">
                  Dynamic Viewer Watermark
                </Label>
                <p className="text-muted-foreground text-xs">
                  Overlays a moving semi-transparent watermark (viewer email + session ID + time) on the player to deter
                  screen recording and unauthorized sharing.
                </p>
              </div>
              <Switch id="stream-watermark" checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Whitelist Configuration */}
      {accessMode === "whitelisted" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <CardTitle className="text-base">Email Whitelist</CardTitle>
              </div>
              <Badge variant="outline">{whitelistCount} active hashed email(s)</Badge>
            </div>
            <CardDescription>
              Whitelisted emails are stored as server-salted HMAC hashes in an O(1) subcollection so the list is never
              exposed publicly. Saving re-syncs approved registrants automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3.5">
              <div className="space-y-0.5">
                <Label htmlFor="include-registrants" className="font-medium text-sm">
                  Auto-include Approved / Paid Event Registrants
                </Label>
                <p className="text-muted-foreground text-xs">
                  Automatically grants access to all registrants with status{" "}
                  <code>approved</code>, <code>paid_and_registered</code>, or <code>attended</code> on save.
                </p>
              </div>
              <Switch
                id="include-registrants"
                checked={includeApprovedRegistrants}
                onCheckedChange={setIncludeApprovedRegistrants}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="manual-whitelist">Additional Manual Whitelist Emails</Label>
                <span className="text-muted-foreground text-xs">
                  {parsedManual.valid.length} valid
                  {parsedManual.invalid.length > 0 ? ` • ${parsedManual.invalid.length} invalid` : ""}
                </span>
              </div>
              <Textarea
                id="manual-whitelist"
                rows={5}
                value={manualWhitelistRaw}
                onChange={(e) => setManualWhitelistRaw(e.target.value)}
                placeholder={"speaker@example.com\nvip@partner.org\n(Separate emails by newline or comma)"}
                className="font-mono text-xs"
              />
              {parsedManual.invalid.length > 0 && (
                <p className="text-destructive text-xs">
                  Invalid entries: {parsedManual.invalid.slice(0, 5).join(", ")}
                </p>
              )}
            </div>

            <Alert>
              <ShieldAlert className="size-4" />
              <AlertTitle className="text-xs font-semibold">Client-Only YouTube Deterrence Notice</AlertTitle>
              <AlertDescription className="text-xs">
                The YouTube Video ID is encrypted server-side and hidden until a single-use code is redeemed, and the
                player uses a click-shield + custom controls + email watermark to block casual URL copying. However,
                YouTube embeds cannot be hidden from browser DevTools Network inspection by technical users.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Active & Recent Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle className="text-base">Viewing Sessions</CardTitle>
              <Badge variant="secondary">{activeSessionsCount} active</Badge>
            </div>
            <CardDescription>
              Sessions expire automatically when a viewer leaves the page or requests a new code.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshingSessions}
            onClick={() => void refreshSessions()}
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${refreshingSessions ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">No viewing sessions recorded yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {sessions.slice(0, 50).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs font-medium">{s.viewer_email_masked}</span>
                      <Badge
                        variant={
                          s.status === "active" ? "default" : s.status === "revoked" ? "destructive" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Started {new Date(s.started_at).toLocaleString()}
                      {s.ended_at ? ` • Ended ${new Date(s.ended_at).toLocaleTimeString()}` : ""}
                    </p>
                  </div>
                  {s.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={revokingId === s.id}
                      onClick={() => void handleRevokeSession(s.id)}
                    >
                      {revokingId === s.id ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 size-3.5" />
                      )}
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveLabel="Save Stream Settings"
        savingLabel="Saving & Syncing..."
      />
    </div>
  );
}
