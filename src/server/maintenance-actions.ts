"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import type { MaintenanceConfig } from "@/config/maintenance-config";
import { isExecutiveOrganizer } from "@/lib/auth-roles";
import { getMaintenanceConfigServer, saveMaintenanceConfigServer } from "@/server/firestore-admin";

const AUTH_ROLE_COOKIE = "auth_role";
const AUTH_TOKEN_COOKIE = "auth_token";
const MAINTENANCE_COOKIE = "gdg_maintenance";

export async function getMaintenanceConfigAction(): Promise<MaintenanceConfig> {
  return await getMaintenanceConfigServer();
}

export async function saveMaintenanceConfigAction(
  config: Partial<MaintenanceConfig>,
): Promise<{ success: boolean; error?: string; config?: MaintenanceConfig }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
    const role = cookieStore.get(AUTH_ROLE_COOKIE)?.value;

    if (!token || !isExecutiveOrganizer(role)) {
      return {
        success: false,
        error:
          "Unauthorized: Only Executive Organizers (Leads, Co-Organizers, Googlers) can modify maintenance settings.",
      };
    }

    await saveMaintenanceConfigServer(config);

    // Set or clear the fast edge cookie for middleware / initial response
    if (config.enabled) {
      cookieStore.set(MAINTENANCE_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      });
    } else if (config.enabled === false) {
      cookieStore.delete(MAINTENANCE_COOKIE);
    }

    // Invalidate caches across the dashboard and public layout
    try {
      revalidatePath("/", "layout");
      revalidatePath("/dashboard/maintenance");
    } catch (revalidateErr) {
      console.warn("[Maintenance Actions] revalidatePath warning:", revalidateErr);
    }

    const updated = await getMaintenanceConfigServer();
    return { success: true, config: updated };
  } catch (err) {
    console.error("[Maintenance Actions] saveMaintenanceConfigAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update maintenance settings.",
    };
  }
}
