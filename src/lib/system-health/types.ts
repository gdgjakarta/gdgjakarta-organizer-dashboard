export interface SystemHealthConfig {
  id: string;
  opsAgentUrl: string;
  n8nPublicUrl: string;
  gowaPublicUrl: string;
  autoRefreshSeconds: number;
  updated_at?: string;
  updated_by_name?: string;
}

export const DEFAULT_SYSTEM_HEALTH_CONFIG: SystemHealthConfig = {
  id: "system_health",
  opsAgentUrl: process.env.OPS_AGENT_URL || "https://ops.gdgjakarta.com",
  n8nPublicUrl: "https://n8n.gdgjakarta.com",
  gowaPublicUrl: "https://gowa.gdgjakarta.org",
  autoRefreshSeconds: 30,
};

export interface HostMetrics {
  memTotalBytes: number;
  memAvailableBytes: number;
  memUsedBytes: number;
  swapTotalBytes: number;
  swapFreeBytes: number;
  swapUsedBytes: number;
  diskTotalBytes: number;
  diskAvailableBytes: number;
  diskUsedBytes: number;
  dockerImagesBytes?: number;
  cpuCount: number;
  loadAvg: [number, number, number];
  uptimeSeconds: number;
  hostname?: string;
}

export interface ContainerTelemetry {
  id: string;
  name: string;
  service: string;
  image: string;
  imageId: string;
  state: string;
  status: string;
  health: string;
  startedAt: string | null;
  restartCount: number;
  cpuPercent: number;
  memUsageBytes: number;
  memLimitBytes: number;
}

export interface VolumeTelemetry {
  name: string;
  mountpoint: string;
  sizeBytes: number;
}

export interface EndpointProbeResult {
  id: "n8n" | "gowa" | "postgresql" | "ops-agent";
  label: string;
  url: string;
  healthy: boolean;
  statusCode: number;
  latencyMs: number;
  message: string;
  checkedAt: string;
}

export interface SystemHealthSnapshot {
  checkedAt: string;
  opsAgentConfigured: boolean;
  opsAgentSecretConfigured: boolean;
  opsAgentConnected: boolean;
  opsAgentError?: string;
  probes: EndpointProbeResult[];
  host: HostMetrics | null;
  containers: ContainerTelemetry[];
  volumes: VolumeTelemetry[];
}
