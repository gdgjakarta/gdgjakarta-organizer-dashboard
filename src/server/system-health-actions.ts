"use server";

import { revalidatePath } from "next/cache";

import { assertSafeWebhookUrl } from "@/lib/security/webhook-validator";
import {
  type ContainerTelemetry,
  DEFAULT_SYSTEM_HEALTH_CONFIG,
  type EndpointProbeResult,
  type HostMetrics,
  type SystemHealthConfig,
  type SystemHealthSnapshot,
  type VolumeTelemetry,
} from "@/lib/system-health/types";
import { isAuthorizedOrganizerSession } from "@/server/auth-guard";
import { getFirestoreDoc } from "@/server/firestore-admin";

const ALLOWED_CONTAINERS = new Set([
  "gdg-n8n",
  "gdg-postgresql",
  "gdg-gowa",
  "gdg-cloudflared",
  "gdg-gateway",
  "gdg-ops-agent",
]);

function normalizeUrl(raw: string | undefined, fallback: string): string {
  const safe = assertSafeWebhookUrl(raw, fallback);
  return safe.replace(/\/+$/, "");
}

export async function getSystemHealthConfigServer(): Promise<SystemHealthConfig> {
  try {
    const remote = (await getFirestoreDoc("system_settings", "system_health")) as Partial<SystemHealthConfig> | null;
    const merged: SystemHealthConfig = {
      ...DEFAULT_SYSTEM_HEALTH_CONFIG,
      ...(remote || {}),
    };
    return {
      ...merged,
      opsAgentUrl: normalizeUrl(
        remote?.opsAgentUrl || process.env.OPS_AGENT_URL,
        DEFAULT_SYSTEM_HEALTH_CONFIG.opsAgentUrl,
      ),
      n8nPublicUrl: normalizeUrl(remote?.n8nPublicUrl, DEFAULT_SYSTEM_HEALTH_CONFIG.n8nPublicUrl),
      gowaPublicUrl: normalizeUrl(remote?.gowaPublicUrl, DEFAULT_SYSTEM_HEALTH_CONFIG.gowaPublicUrl),
      autoRefreshSeconds: Math.min(300, Math.max(10, Number(merged.autoRefreshSeconds || 30))),
    };
  } catch {
    return DEFAULT_SYSTEM_HEALTH_CONFIG;
  }
}

async function probePublicUrl(id: EndpointProbeResult["id"], label: string, url: string): Promise<EndpointProbeResult> {
  const start = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - start;
    // 401 on gowa means Basic Auth challenge is active and service is healthy
    const healthy = res.status >= 200 && res.status < 500;
    let htmlError: string | undefined;
    if (!healthy) {
      const text = await res.text().catch(() => "");
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || text.includes("<body")) {
        htmlError = text;
      }
    }
    return {
      id,
      label,
      url,
      healthy,
      statusCode: res.status,
      latencyMs,
      message: res.status === 401 ? "HTTP 401 (Basic Auth Active)" : `HTTP ${res.status}`,
      checkedAt,
      htmlError,
    };
  } catch (err) {
    return {
      id,
      label,
      url,
      healthy: false,
      statusCode: 0,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Unreachable",
      checkedAt,
    };
  }
}

export async function getSystemHealthSnapshotAction(): Promise<SystemHealthSnapshot> {
  if (!(await isAuthorizedOrganizerSession())) {
    throw new Error("Unauthorized: Organizer session required.");
  }

  const config = await getSystemHealthConfigServer();
  const secret = (process.env.OPS_AGENT_SECRET || "").trim();
  const opsAgentSecretConfigured = secret.length >= 16;
  const opsAgentConfigured = Boolean(config.opsAgentUrl && opsAgentSecretConfigured);
  const checkedAt = new Date().toISOString();

  const n8nHealthUrl = `${config.n8nPublicUrl}/healthz`;
  const gowaHealthUrl = config.gowaPublicUrl;

  const [n8nProbe, gowaProbe, agentRes] = await Promise.all([
    probePublicUrl("n8n", "n8n Workflow Engine", n8nHealthUrl),
    probePublicUrl("gowa", "GoWA WhatsApp API", gowaHealthUrl),
    opsAgentConfigured
      ? (async () => {
          const start = Date.now();
          try {
            const res = await fetch(`${config.opsAgentUrl}/status`, {
              method: "GET",
              headers: {
                "X-Ops-Secret": secret,
              },
              cache: "no-store",
              signal: AbortSignal.timeout(8000),
            });
            const latencyMs = Date.now() - start;
            if (!res.ok) {
              const text = await res.text().catch(() => "");
              const isHtml =
                text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || text.includes("<body");
              return {
                ok: false as const,
                statusCode: res.status,
                latencyMs,
                error: isHtml ? `HTTP ${res.status} error page` : text || `HTTP ${res.status}`,
                htmlError: isHtml ? text : undefined,
              };
            }
            const data = (await res.json()) as {
              host?: HostMetrics;
              containers?: ContainerTelemetry[];
              volumes?: VolumeTelemetry[];
              internalProbes?: Record<
                string,
                { healthy: boolean; statusCode: number; latencyMs: number; message: string }
              >;
            };
            return {
              ok: true as const,
              statusCode: res.status,
              latencyMs,
              data,
            };
          } catch (err) {
            return {
              ok: false as const,
              statusCode: 0,
              latencyMs: Date.now() - start,
              error: err instanceof Error ? err.message : "Agent unreachable",
            };
          }
        })()
      : Promise.resolve(null),
  ]);

  const pgInternal = agentRes?.ok ? agentRes.data.internalProbes?.postgresql : null;
  const pgProbe: EndpointProbeResult = pgInternal
    ? {
        id: "postgresql",
        label: "PostgreSQL 17.11",
        url: "postgresql:5432 (Docker Internal)",
        healthy: pgInternal.healthy,
        statusCode: pgInternal.statusCode,
        latencyMs: pgInternal.latencyMs,
        message: pgInternal.message,
        checkedAt,
      }
    : {
        id: "postgresql",
        label: "PostgreSQL 17.11",
        url: "postgresql:5432 (via Ops Agent)",
        healthy: n8nProbe.healthy,
        statusCode: n8nProbe.healthy ? 200 : 0,
        latencyMs: n8nProbe.latencyMs,
        message: n8nProbe.healthy ? "Inferred healthy via n8n /healthz" : "Awaiting Ops Agent connection",
        checkedAt,
      };

  const agentProbe: EndpointProbeResult = {
    id: "ops-agent",
    label: "Docker Ops Agent",
    url: config.opsAgentUrl,
    healthy: Boolean(agentRes?.ok),
    statusCode: agentRes?.statusCode ?? 0,
    latencyMs: agentRes?.latencyMs ?? 0,
    message: agentRes?.ok
      ? "Connected to /var/run/docker.sock"
      : !opsAgentSecretConfigured
        ? "OPS_AGENT_SECRET env not set"
        : agentRes?.error || "Not connected",
    checkedAt,
    htmlError: agentRes && !agentRes.ok ? agentRes.htmlError : undefined,
  };

  return {
    checkedAt,
    opsAgentConfigured,
    opsAgentSecretConfigured,
    opsAgentConnected: Boolean(agentRes?.ok),
    opsAgentError: agentRes && !agentRes.ok ? agentRes.error : undefined,
    opsAgentHtmlError: agentRes && !agentRes.ok ? agentRes.htmlError : undefined,
    probes: [n8nProbe, gowaProbe, pgProbe, agentProbe],
    host: agentRes?.ok ? (agentRes.data.host ?? null) : null,
    containers: agentRes?.ok ? (agentRes.data.containers ?? []) : [],
    volumes: agentRes?.ok ? (agentRes.data.volumes ?? []) : [],
  };
}

export async function executeContainerAction(
  containerName: string,
  action: "restart" | "start" | "stop" | "update",
  imageTag?: string,
): Promise<{ ok: boolean; message: string; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { ok: false, message: "Unauthorized", error: "Organizer session required." };
  }
  if (!ALLOWED_CONTAINERS.has(containerName)) {
    return { ok: false, message: "Invalid container", error: `Unknown container: ${containerName}` };
  }

  const config = await getSystemHealthConfigServer();
  const secret = (process.env.OPS_AGENT_SECRET || "").trim();
  if (!secret || secret.length < 16) {
    return {
      ok: false,
      message: "Ops Agent not configured",
      error: "OPS_AGENT_SECRET environment variable is missing on the server.",
    };
  }

  try {
    const res = await fetch(`${config.opsAgentUrl}/containers/${encodeURIComponent(containerName)}/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ops-Secret": secret,
      },
      body: JSON.stringify({ action, imageTag }),
      cache: "no-store",
      signal: AbortSignal.timeout(action === "update" ? 180000 : 45000),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };

    if (!res.ok || payload.ok === false) {
      if (action === "update" && (res.status === 504 || res.status === 524)) {
        return {
          ok: true,
          message: `Image pull for ${containerName} is still running in the background and will finish shortly.`,
        };
      }
      return {
        ok: false,
        message: `Failed to ${action} ${containerName}`,
        error: payload.error || `HTTP ${res.status}`,
      };
    }

    try {
      revalidatePath("/dashboard/health");
    } catch {
      // ignore
    }

    return {
      ok: true,
      message: payload.message || `Successfully executed ${action} on ${containerName}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Error executing ${action} on ${containerName}`,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function getContainerLogsAction(
  containerName: string,
  tail = 200,
): Promise<{ ok: boolean; logs: string; error?: string }> {
  if (!(await isAuthorizedOrganizerSession())) {
    return { ok: false, logs: "", error: "Unauthorized: Organizer session required." };
  }
  if (!ALLOWED_CONTAINERS.has(containerName)) {
    return { ok: false, logs: "", error: `Unknown container: ${containerName}` };
  }

  const config = await getSystemHealthConfigServer();
  const secret = (process.env.OPS_AGENT_SECRET || "").trim();
  if (!secret || secret.length < 16) {
    return { ok: false, logs: "", error: "OPS_AGENT_SECRET is not configured on the server." };
  }

  try {
    const res = await fetch(`${config.opsAgentUrl}/containers/${encodeURIComponent(containerName)}/logs?tail=${tail}`, {
      method: "GET",
      headers: {
        "X-Ops-Secret": secret,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      logs?: string;
      error?: string;
    };
    if (!res.ok || payload.ok === false) {
      return { ok: false, logs: "", error: payload.error || `HTTP ${res.status}` };
    }
    return { ok: true, logs: payload.logs || "" };
  } catch (err) {
    return {
      ok: false,
      logs: "",
      error: err instanceof Error ? err.message : "Failed to fetch logs",
    };
  }
}

export async function revalidateSystemHealthAction(): Promise<{
  success: boolean;
  config: SystemHealthConfig;
}> {
  if (!(await isAuthorizedOrganizerSession())) {
    throw new Error("Unauthorized");
  }
  try {
    revalidatePath("/dashboard/health");
  } catch {
    // ignore
  }
  const config = await getSystemHealthConfigServer();
  return { success: true, config };
}
