"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  getPreferencePersistence,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";

export async function getValueFromCookie(key: string): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(key)?.value;
  } catch {
    return undefined;
  }
}

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number } = {},
): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(key, value, {
      path: options.path ?? "/",
      maxAge: options.maxAge ?? 60 * 60 * 24 * 7, // default: 7 days
    });
  } catch (error) {
    console.warn(`[Preference] Error setting cookie "${key}":`, error);
  }
}

export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  const definition = PREFERENCE_REGISTRY[key];
  const persistence = getPreferencePersistence(key);

  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return definition.defaultValue as PreferenceValueMap[K];
  }

  try {
    const cookieStore = await cookies();
    return parsePreference(key, cookieStore.get(key)?.value?.trim());
  } catch (error) {
    console.warn(`[Preference] Error retrieving cookie for key "${key}":`, error);
    return definition.defaultValue as PreferenceValueMap[K];
  }
}

export async function revalidateDashboardPath(path: string): Promise<void> {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn(`[revalidateDashboardPath] Error revalidating "${path}":`, error);
  }
}
