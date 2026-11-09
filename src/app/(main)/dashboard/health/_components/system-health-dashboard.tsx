"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
  Server,
  Settings,
  ShieldCheck,
  Square,
  Terminal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { FloatingSaveBar } from "@/app/(main)/dashboard/_components/floating-save-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ContainerTelemetry, SystemHealthConfig, SystemHealthSnapshot } from "@/lib/system-health/types";
import { cn } from "@/lib/utils";
import {
  executeContainerAction,
  getContainerLogsAction,
  getSystemHealthSnapshotAction,
  revalidateSystemHealthAction,
} from "@/server/system-health-actions";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface SystemHealthDashboardProps {
  initialConfig: SystemHealthConfig;
  initialSnapshot: SystemHealthSnapshot;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / 1024 ** i;
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function meterColorClass(percent: number): string {
  if (percent >= 88) return "bg-destructive";
  if (percent >= 72) return "bg-amber-500";
  return "bg-emerald-500";
}

export function SystemHealthDashboard({ initialConfig, initialSnapshot }: SystemHealthDashboardProps) {
  const user = useAuthStore((s) => s.user);

  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot>(initialSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Settings tab state
  const [config, setConfig] = useState<SystemHealthConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<SystemHealthConfig>(initialConfig);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Container action confirmation & update modal state
  const [pendingAction, setPendingAction] = useState<{
    containerName: string;
    action: "restart" | "start" | "stop" | "update";
    currentImage: string;
  } | null>(null);
  const [targetImageTag, setTargetImageTag] = useState("latest");
  const [runningContainerOp, setRunningContainerOp] = useState<string | null>(null);

  // Logs modal state
  const [logsTarget, setLogsTarget] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState("");
  const [logsTail, setLogsTail] = useState(200);

  // Backup state
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  // Settings dialog state (clean popover/dialog for endpoint config)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenHtmlError = (html: string, title = "Error Page") => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const isDirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);

  const handleRefresh = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const next = await getSystemHealthSnapshotAction();
      setSnapshot(next);
      if (!silent) {
        toast.success("System health refreshed");
      }
    } catch (err) {
      if (!silent) {
        toast.error("Failed to refresh system health", {
          description: err instanceof Error ? err.message : "Network error",
        });
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalMs = Math.max(10, Number(savedConfig.autoRefreshSeconds || 30)) * 1000;
    const id = setInterval(() => {
      void handleRefresh(true);
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, savedConfig.autoRefreshSeconds, handleRefresh]);

  const handleOpenLogs = async (containerName: string, tail = logsTail) => {
    setLogsTarget(containerName);
    setLogsLoading(true);
    try {
      const res = await getContainerLogsAction(containerName, tail);
      if (res.ok) {
        setLogsContent(res.logs || "(No log output)");
      } else {
        setLogsContent(`Error loading logs: ${res.error || "Unknown error"}`);
      }
    } catch (err) {
      setLogsContent(`Error: ${err instanceof Error ? err.message : "Failed to load logs"}`);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleConfirmContainerAction = async () => {
    if (!pendingAction) return;
    const { containerName, action } = pendingAction;
    setRunningContainerOp(`${containerName}:${action}`);
    setPendingAction(null);

    try {
      const res = await executeContainerAction(containerName, action, action === "update" ? targetImageTag : undefined);
      if (res.ok) {
        toast.success(res.message);
        await handleRefresh(true);
      } else {
        toast.error(res.message, {
          description: res.error,
        });
      }
    } catch (err) {
      toast.error(`Failed to ${action} ${containerName}`, {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setRunningContainerOp(null);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const res = await fetch("/api/system-health/backup", { method: "GET" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `gdg-jakarta-postgres-${dateStr}.dump`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PostgreSQL backup downloaded");
    } catch (err) {
      toast.error("Failed to download PostgreSQL backup", {
        description: err instanceof Error ? err.message : "Backup failed",
      });
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const payload: Partial<SystemHealthConfig> = {
        ...config,
        updated_by_name: user?.name || user?.email || "Organizer",
      };
      const { saveSystemHealthConfigDoc } = await import("@/lib/firestore/client");
      await saveSystemHealthConfigDoc(payload);
      const synced = await revalidateSystemHealthAction();
      setSavedConfig(synced.config);
      setConfig(synced.config);
      await handleRefresh(true);
      toast.success("System Health settings saved");
    } catch (err) {
      toast.error("Failed to save settings", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!logsFilter.trim()) return logsContent;
    const q = logsFilter.toLowerCase();
    return logsContent
      .split("\n")
      .filter((line) => line.toLowerCase().includes(q))
      .join("\n");
  }, [logsContent, logsFilter]);

  const host = snapshot.host;
  const ramPercent = host?.memTotalBytes
    ? Math.min(100, Math.round((host.memUsedBytes / host.memTotalBytes) * 100))
    : 0;
  const swapPercent = host?.swapTotalBytes
    ? Math.min(100, Math.round((host.swapUsedBytes / host.swapTotalBytes) * 100))
    : 0;
  const diskPercent = host?.diskTotalBytes
    ? Math.min(100, Math.round((host.diskUsedBytes / host.diskTotalBytes) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-bold text-2xl tracking-tight">System Health</h1>
            {snapshot.opsAgentConnected ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                Ops Agent Connected
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                <span className="size-2 rounded-full bg-amber-500" />
                Public Probes Active
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Monitor n8n, PostgreSQL, and GoWA health, inspect RAM/Swap/Volume usage, and restart or update Docker
            containers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={cn(
              "h-8 gap-2 rounded-md border text-xs font-medium transition-colors",
              autoRefresh
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full transition-all",
                autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40",
              )}
            />
            <span>Auto-refresh</span>
            <span className="font-mono text-[11px] opacity-75">{savedConfig.autoRefreshSeconds}s</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => void handleRefresh(false)} disabled={isRefreshing}>
            <RefreshCw className={cn("mr-1.5 size-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={!snapshot.opsAgentConnected || isDownloadingBackup}
            onClick={() => void handleDownloadBackup()}
          >
            <Download className="mr-1.5 size-3.5" />
            {isDownloadingBackup ? "Dumping DB..." : "Backup PostgreSQL"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="size-3.5" />
            <span>Settings</span>
          </Button>
        </div>
      </div>

      {/* Main Single-View Health & Telemetry Content */}
      <div className="space-y-6">
        {/* 1. Live Endpoint Health Probes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.probes.map((probe) => (
            <Card key={probe.id} className="border-border/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-semibold text-sm">{probe.label}</CardTitle>
                  {probe.healthy ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs dark:text-emerald-300"
                    >
                      <CheckCircle2 className="size-3" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-destructive/40 bg-destructive/10 text-destructive text-xs"
                    >
                      <XCircle className="size-3" />
                      Offline
                    </Badge>
                  )}
                </div>
                <CardDescription className="truncate font-mono text-xs">{probe.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{probe.message}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {probe.htmlError && (
                      <button
                        type="button"
                        onClick={() => handleOpenHtmlError(probe.htmlError!, `${probe.label} Error`)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 font-medium text-[11px] text-destructive transition-colors hover:bg-destructive/20 hover:text-destructive active:scale-95"
                        title="View error page in new tab"
                      >
                        <span>Error Page</span>
                        <ExternalLink className="size-2.5 opacity-70" />
                      </button>
                    )}
                    <span className="font-medium font-mono">{probe.latencyMs > 0 ? `${probe.latencyMs} ms` : "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 2. Host VM & Volume Resource Meters */}
        {host ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Physical RAM */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 font-semibold text-sm">
                    <Cpu className="size-4 text-primary" />
                    Physical RAM
                  </CardTitle>
                  <span className="font-mono font-semibold text-xs">{ramPercent}%</span>
                </div>
                <CardDescription className="text-xs">
                  {formatBytes(host.memUsedBytes)} / {formatBytes(host.memTotalBytes)} used
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full transition-all", meterColorClass(ramPercent))}
                    style={{ width: `${ramPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Load avg: {host.loadAvg.map((n) => n.toFixed(2)).join(", ")} ({host.cpuCount} vCPU) • Up{" "}
                  {formatUptime(host.uptimeSeconds)}
                </p>
              </CardContent>
            </Card>

            {/* Swap Memory */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 font-semibold text-sm">
                    <Activity className="size-4 text-primary" />
                    Swap Buffer
                  </CardTitle>
                  <span className="font-mono font-semibold text-xs">
                    {host.swapTotalBytes > 0 ? `${swapPercent}%` : "Off"}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  {host.swapTotalBytes > 0
                    ? `${formatBytes(host.swapUsedBytes)} / ${formatBytes(host.swapTotalBytes)} used`
                    : "No /swapfile active"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full transition-all", meterColorClass(swapPercent))}
                    style={{ width: `${swapPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Prevents OOM crashes during npm ci &amp; n8n updates
                </p>
              </CardContent>
            </Card>

            {/* Boot Disk (30 GB) */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 font-semibold text-sm">
                    <HardDrive className="size-4 text-primary" />
                    Boot Disk
                  </CardTitle>
                  <span className="font-mono font-semibold text-xs">{diskPercent}%</span>
                </div>
                <CardDescription className="text-xs">
                  {formatBytes(host.diskUsedBytes)} / {formatBytes(host.diskTotalBytes)} used
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full transition-all", meterColorClass(diskPercent))}
                    style={{ width: `${diskPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Free: {formatBytes(host.diskAvailableBytes)} • Images: {formatBytes(host.dockerImagesBytes || 0)}
                </p>
              </CardContent>
            </Card>

            {/* Docker Volumes Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 font-semibold text-sm">
                  <Database className="size-4 text-primary" />
                  Docker Volumes
                </CardTitle>
                <CardDescription className="text-xs">Persistent data across container updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {snapshot.volumes.length > 0 ? (
                  snapshot.volumes.map((v) => (
                    <div key={v.name} className="flex items-center justify-between text-xs">
                      <span className="truncate font-mono text-muted-foreground">
                        {v.name.replace(/^gdg-jakarta_/, "")}
                      </span>
                      <span className="font-mono font-semibold">{formatBytes(v.sizeBytes)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs">Volume sizes reported when docker system df finishes</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Docker Ops Agent is not connected yet</p>
                  <p className="text-muted-foreground text-xs">
                    {!snapshot.opsAgentSecretConfigured
                      ? "Set OPS_AGENT_SECRET in your Next.js environment variables (.env.local) matching ~/.zeabur-migration/gdg-jakarta/.env to unlock container restart/update controls, live logs, and RAM/Volume telemetry."
                      : `Could not reach ${config.opsAgentUrl} (${snapshot.opsAgentError || "offline"}). Public HTTP health probes for n8n and GoWA are still active above.`}
                  </p>
                  {snapshot.opsAgentHtmlError && (
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
                        onClick={() => handleOpenHtmlError(snapshot.opsAgentHtmlError!, "Ops Agent Error Page")}
                      >
                        <ExternalLink className="size-3" />
                        Open Cloudflare / Origin Error in New Tab
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Container Lifecycle Management Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base tracking-tight">Managed Containers</h2>
            <span className="text-muted-foreground text-xs" suppressHydrationWarning>
              Last checked: {new Date(snapshot.checkedAt).toLocaleTimeString()}
            </span>
          </div>

          {snapshot.containers.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {snapshot.containers.map((c: ContainerTelemetry) => {
                const isRunning = c.state === "running";
                const isMutable = c.name !== "gdg-ops-agent";
                const isBusy = runningContainerOp?.startsWith(`${c.name}:`) ?? false;

                return (
                  <Card key={c.name} className="border-border/80">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Server className="size-4 text-primary" />
                            <CardTitle className="font-mono text-base">{c.name}</CardTitle>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize",
                                isRunning
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-destructive/40 bg-destructive/10 text-destructive",
                              )}
                            >
                              {c.state}
                            </Badge>
                            {c.health && c.health !== "none" && (
                              <Badge variant="secondary" className="text-[11px]">
                                {c.health}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="break-all font-mono text-xs">{c.image}</CardDescription>
                        </div>

                        <div className="text-right font-mono text-xs">
                          <div>
                            RAM: <span className="font-semibold">{formatBytes(c.memUsageBytes)}</span>
                          </div>
                          <div className="text-muted-foreground">CPU: {c.cpuPercent.toFixed(1)}%</div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="size-3.5" />
                          {c.status || "—"}
                        </span>
                        <span className="font-mono text-muted-foreground">Restarts: {c.restartCount}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={!isMutable || isBusy}
                          onClick={() =>
                            setPendingAction({
                              containerName: c.name,
                              action: "restart",
                              currentImage: c.image,
                            })
                          }
                        >
                          <RotateCw
                            className={cn(
                              "mr-1.5 size-3.5",
                              runningContainerOp === `${c.name}:restart` && "animate-spin",
                            )}
                          />
                          Restart
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 text-xs"
                          disabled={!isMutable || isBusy}
                          onClick={() => {
                            const defaultTag = c.name === "gdg-postgresql" ? "17.11" : "latest";
                            setTargetImageTag(defaultTag);
                            setPendingAction({
                              containerName: c.name,
                              action: "update",
                              currentImage: c.image,
                            });
                          }}
                        >
                          {runningContainerOp === `${c.name}:update` ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <ArrowUpCircle className="mr-1.5 size-3.5" />
                          )}
                          {runningContainerOp === `${c.name}:update` ? "Updating Image..." : "Update Image"}
                        </Button>

                        {isRunning ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive text-xs hover:text-destructive"
                            disabled={!isMutable || isBusy}
                            onClick={() =>
                              setPendingAction({
                                containerName: c.name,
                                action: "stop",
                                currentImage: c.image,
                              })
                            }
                          >
                            <Square className="mr-1.5 size-3.5" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-emerald-600 text-xs"
                            disabled={!isMutable || isBusy}
                            onClick={() =>
                              setPendingAction({
                                containerName: c.name,
                                action: "start",
                                currentImage: c.image,
                              })
                            }
                          >
                            <Play className="mr-1.5 size-3.5" />
                            Start
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-8 text-xs"
                          onClick={() => void handleOpenLogs(c.name)}
                        >
                          <FileText className="mr-1.5 size-3.5" />
                          Logs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Container cards (`gdg-n8n`, `gdg-postgresql`, `gdg-gowa`, `gdg-gateway`, `gdg-cloudflared`,{" "}
                `gdg-ops-agent`) will appear automatically once the Ops Agent is reachable.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Endpoint Configuration Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="size-4 text-primary" />
              Service &amp; Ops Agent Endpoints
            </DialogTitle>
            <DialogDescription>
              Configure the public service URLs and your Cloudflare Tunnel hostname for gdg-ops-agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ops-agent-url">Ops Agent Tunnel URL</Label>
              <Input
                id="ops-agent-url"
                value={config.opsAgentUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    opsAgentUrl: e.target.value,
                  }))
                }
                placeholder="https://ops.gdgjakarta.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="n8n-url">n8n Public Base URL</Label>
              <Input
                id="n8n-url"
                value={config.n8nPublicUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    n8nPublicUrl: e.target.value,
                  }))
                }
                placeholder="https://n8n.gdgjakarta.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gowa-url">GoWA Public Base URL</Label>
              <Input
                id="gowa-url"
                value={config.gowaPublicUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    gowaPublicUrl: e.target.value,
                  }))
                }
                placeholder="https://gowa.gdgjakarta.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refresh-seconds">Auto-Refresh Interval (seconds)</Label>
              <Input
                id="refresh-seconds"
                type="number"
                min={10}
                max={300}
                value={config.autoRefreshSeconds}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    autoRefreshSeconds: Number(e.target.value || 30),
                  }))
                }
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  Server Secret (`OPS_AGENT_SECRET`)
                </span>
                {snapshot.opsAgentSecretConfigured ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  >
                    Configured
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  >
                    Not Set
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Close
            </Button>
            <Button
              disabled={!isDirty || isSavingConfig}
              onClick={async () => {
                await handleSaveConfig();
                setIsSettingsOpen(false);
              }}
            >
              {isSavingConfig ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Container Action / Update Confirmation Modal */}
      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">
              {pendingAction?.action} {pendingAction?.containerName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "update"
                ? "This will pull the target Docker image, recreate the container with your existing persistent volumes and .env intact, and prune dangling images."
                : `Are you sure you want to ${pendingAction?.action} container ${pendingAction?.containerName}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingAction?.action === "update" && (
            <div className="space-y-2 py-2">
              <Label htmlFor="target-image-tag" className="text-xs">
                Target Image Tag (e.g. `latest` or `2.45.0`)
              </Label>
              <Input
                id="target-image-tag"
                value={targetImageTag}
                onChange={(e) => setTargetImageTag(e.target.value)}
                placeholder="latest"
                className="font-mono text-xs"
              />
              <p className="font-mono text-[11px] text-muted-foreground">Current image: {pendingAction.currentImage}</p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmContainerAction()}>
              Confirm {pendingAction?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Live Container Logs Modal */}
      <Dialog open={Boolean(logsTarget)} onOpenChange={(open) => !open && setLogsTarget(null)}>
        <DialogContent className="max-w-4xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <Terminal className="size-4 text-primary" />
              Logs: {logsTarget}
            </DialogTitle>
            <DialogDescription>Showing last {logsTail} lines of stdout/stderr from Docker Engine.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filter logs..."
              value={logsFilter}
              onChange={(e) => setLogsFilter(e.target.value)}
              className="h-8 max-w-xs text-xs"
            />
            <div className="ml-auto flex items-center gap-1.5">
              {[100, 200, 500].map((count) => (
                <Button
                  key={count}
                  size="sm"
                  variant={logsTail === count ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setLogsTail(count);
                    if (logsTarget) void handleOpenLogs(logsTarget, count);
                  }}
                >
                  {count} lines
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={logsLoading || !logsTarget}
                onClick={() => logsTarget && void handleOpenLogs(logsTarget, logsTail)}
              >
                <RefreshCw className={cn("mr-1 size-3", logsLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(filteredLogs);
                  toast.success("Logs copied to clipboard");
                }}
              >
                <Copy className="mr-1 size-3" />
                Copy
              </Button>
            </div>
          </div>

          <pre className="max-h-[420px] overflow-auto rounded-lg border bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100 leading-relaxed">
            {logsLoading ? "Loading container logs..." : filteredLogs}
          </pre>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={isSavingConfig}
        onSave={() => void handleSaveConfig()}
        onDiscard={() => setConfig(savedConfig)}
        helperText="Save endpoint URLs and refresh interval to system_settings/system_health"
      />
    </div>
  );
}
