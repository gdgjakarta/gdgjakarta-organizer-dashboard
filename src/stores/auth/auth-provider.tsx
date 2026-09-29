"use client";

import { createContext, use, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { getRedirectResult, onAuthStateChanged, signInWithRedirect, signOut } from "firebase/auth";
import { toast } from "sonner";
import { type StoreApi, useStore } from "zustand";

import { auth, googleProvider } from "@/config/firebase";
import type { FirestoreMember } from "@/lib/firestore/types";
import { clearAuthSessionCookie, handleUserPostLoginAction } from "@/server/auth-actions";

import { type AuthOrganizer, type AuthState, createAuthStore } from "./auth-store";

const AuthStoreContext = createContext<StoreApi<AuthState> | null>(null);

function mapFirebaseUserToOrganizer(
  user: import("firebase/auth").User,
  validation?: import("@/lib/bevy/types").OrganizerValidationResult,
): AuthOrganizer {
  const isOrg = validation?.isValidOrganizer ?? false;
  return {
    id: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: user.photoURL || "",
    role: isOrg ? "organizer" : "member",
    bevyUserId: validation?.bevyUserId,
    chapterRole: validation?.chapterRole || (isOrg ? "Organizer" : "Member"),
  };
}

async function syncMemberToFirestore(
  user: import("firebase/auth").User,
  validation?: import("@/lib/bevy/types").OrganizerValidationResult,
) {
  if (typeof window === "undefined") return;
  try {
    const { saveFirestoreMember } = await import("@/lib/firestore/client");
    const isOrg = validation?.isValidOrganizer ?? false;
    const now = new Date().toISOString();
    const email = user.email ?? "";
    const memberData: FirestoreMember = {
      id: user.uid,
      uid: user.uid,
      bevy_user_id: validation?.bevyUserId ? String(validation.bevyUserId) : null,
      name: user.displayName ?? (email ? email.split("@")[0] : "Community Member"),
      email,
      avatar_url: user.photoURL ?? "",
      role: isOrg ? "organizer" : "member",
      chapter_role: validation?.chapterRole ?? (isOrg ? "Organizer" : "Member"),
      team: isOrg ? "Core Team" : "Community",
      status: "Active",
      joined_date: now,
      events_registered_count: 0,
      events_attended_count: 0,
      last_active: now,
      updated_at: now,
    };
    await saveFirestoreMember(memberData);
    console.log(`[Auth Flow - Client] Synced member profile to Firestore for ${email}`);
  } catch (fsErr) {
    console.warn("[Auth Flow - Client] Firestore sync error (non-fatal):", fsErr);
  }
}

const REDIRECT_PENDING_KEY = "auth_redirect_in_progress";
const REDIRECT_CALLBACK_KEY = "auth_redirect_callback_url";

let activeSyncUid: string | null = null;
let hasNavigated = false;

async function syncAndNavigate(
  user: import("firebase/auth").User,
  source: "redirect" | "auth_state_change",
  store: StoreApi<AuthState>,
  router: ReturnType<typeof useRouter>,
) {
  if (activeSyncUid === user.uid) {
    console.log(`[Auth Provider - ${source}] Sync already active for ${user.email}. Skipping duplicate call.`);
    return;
  }

  activeSyncUid = user.uid;
  try {
    console.log(`[Auth Provider - ${source}] Completing authentication for: ${user.email} (UID: ${user.uid})`);

    const email = user.email ?? "";
    const token = await user.getIdToken();
    console.log(`[Auth Provider - ${source}] Calling handleUserPostLoginAction on server for ${email}...`);

    const validation = await handleUserPostLoginAction({
      uid: user.uid,
      email,
      name: user.displayName ?? undefined,
      avatar: user.photoURL ?? undefined,
      token,
    });

    const organizer = mapFirebaseUserToOrganizer(user, validation);
    console.log(`[Auth Provider - ${source}] Post-login sync response:`, {
      email: organizer.email,
      role: organizer.role,
      chapterRole: organizer.chapterRole,
      isAllowed: validation.isValidOrganizer,
    });

    // Sync member profile in Firestore on client
    await syncMemberToFirestore(user, validation);

    // Update client AuthState
    store.getState().setUser(organizer, user);

    // Read redirect parameters and cleanup
    const isRedirectPending = typeof window !== "undefined" && sessionStorage.getItem(REDIRECT_PENDING_KEY) === "true";
    const savedCallbackUrl = typeof window !== "undefined" ? sessionStorage.getItem(REDIRECT_CALLBACK_KEY) : null;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
      sessionStorage.removeItem(REDIRECT_CALLBACK_KEY);
    }

    const isAuthPage = typeof window !== "undefined" && window.location.pathname.startsWith("/auth");

    if ((isRedirectPending || isAuthPage) && !hasNavigated) {
      hasNavigated = true;
      if (validation.isValidOrganizer) {
        toast.success(`Welcome back, ${organizer.name}! (${organizer.chapterRole ?? "Organizer"})`);
        const targetUrl = savedCallbackUrl?.startsWith("/") ? savedCallbackUrl : "/dashboard/organizer";
        console.log(`[Auth Provider - ${source}] Navigating organizer (${organizer.email}) to: ${targetUrl}`);
        router.push(targetUrl);
      } else {
        toast.success(`Welcome, ${organizer.name}!`);
        const isOrganizerOnlyCallback =
          savedCallbackUrl?.startsWith("/dashboard/organizer") ||
          savedCallbackUrl?.startsWith("/dashboard/events") ||
          savedCallbackUrl?.startsWith("/dashboard/email-manager") ||
          savedCallbackUrl?.startsWith("/dashboard/members");

        const targetUrl =
          savedCallbackUrl?.startsWith("/") && !isOrganizerOnlyCallback ? savedCallbackUrl : "/dashboard/member";
        console.log(`[Auth Provider - ${source}] Navigating member (${organizer.email}) to: ${targetUrl}`);
        router.push(targetUrl);
      }
      router.refresh();
    }
  } catch (err: unknown) {
    console.error(`[Auth Provider - ${source}] Error during sync and navigate:`, err);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
      sessionStorage.removeItem(REDIRECT_CALLBACK_KEY);
    }
    const error = err as { code?: string; message?: string };
    toast.error(error.message ?? "An error occurred while finishing sign-in.");
  } finally {
    activeSyncUid = null;
  }
}

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<StoreApi<AuthState>>(() => createAuthStore());
  const router = useRouter();

  // 1. Process getRedirectResult on mount
  useEffect(() => {
    let isCancelled = false;

    async function handleRedirect() {
      const isRedirectPending =
        typeof window !== "undefined" && sessionStorage.getItem(REDIRECT_PENDING_KEY) === "true";

      if (!isRedirectPending) {
        return;
      }

      try {
        console.log("[Auth Provider] Checking Firebase getRedirectResult...");
        const result = await getRedirectResult(auth);

        if (result?.user && !isCancelled) {
          console.log("[Auth Provider] getRedirectResult resolved with user. Triggering syncAndNavigate...");
          await syncAndNavigate(result.user, "redirect", store, router);
        } else {
          console.log(
            "[Auth Provider] getRedirectResult resolved with null. Waiting for onAuthStateChanged fallback...",
          );
          // If onAuthStateChanged does not fire with a user in 3s, clear pending state
          setTimeout(() => {
            if (typeof window !== "undefined" && !auth.currentUser) {
              console.log("[Auth Provider] Timeout reached without Firebase user. Clearing redirect state.");
              sessionStorage.removeItem(REDIRECT_PENDING_KEY);
              sessionStorage.removeItem(REDIRECT_CALLBACK_KEY);
              store.getState().setLoading(false);
            }
          }, 3000);
        }
      } catch (err: unknown) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          sessionStorage.removeItem(REDIRECT_CALLBACK_KEY);
        }
        store.getState().setLoading(false);
        console.error("[Auth Provider] Error during getRedirectResult:", err);
        const error = err as { code?: string; message?: string };
        if (error.code !== "auth/redirect-cancelled-by-user") {
          let message = error.message ?? "Failed to sign in with Google. Please try again.";
          if (message.includes("Minified React error") || message.includes("Server Components render")) {
            message = "An error occurred while communicating with the server. Please try again.";
          }
          toast.error(message);
        }
      }
    }

    void handleRedirect();

    return () => {
      isCancelled = true;
    };
  }, [store, router]);

  // 2. Subscribe to onAuthStateChanged (handles normal sessions and acts as redirect fallback)
  useEffect(() => {
    console.log("[Auth Provider] Subscribing to onAuthStateChanged");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log(
          `[Auth Provider] onAuthStateChanged user detected: ${firebaseUser.email} (UID: ${firebaseUser.uid})`,
        );
        await syncAndNavigate(firebaseUser, "auth_state_change", store, router);
      } else {
        console.log("[Auth Provider] No Firebase user session active. Resetting auth state.");
        store.getState().setUser(null, null);
      }
    });

    return () => unsubscribe();
  }, [store, router]);

  return <AuthStoreContext.Provider value={store}>{children}</AuthStoreContext.Provider>;
}

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  const store = use(AuthStoreContext) as StoreApi<AuthState> | null;
  if (!store) {
    throw new Error("useAuthStore must be used within an AuthStoreProvider");
  }
  return useStore(store, selector);
}

/**
 * Triggers Google Sign In with Firebase auth using full-page redirect,
 * records return destination in sessionStorage, validates against Bevy Chapter Team,
 * syncs member profile to Firestore, and establishes the role-based session.
 */
export async function signInWithGoogle(callbackUrl?: string | null): Promise<void> {
  console.log("[Auth Flow Step 1 - Client] Initiating Firebase signInWithRedirect (Google Provider)...");
  if (typeof window !== "undefined") {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, "true");
    if (callbackUrl) {
      sessionStorage.setItem(REDIRECT_CALLBACK_KEY, callbackUrl);
    }
  }
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Signs the user out from Firebase and clears the session cookie.
 */
export async function signOutOrganizer(): Promise<void> {
  console.log("[Auth Flow - Client] Signing out from Firebase and clearing session cookie...");
  hasNavigated = false;
  activeSyncUid = null;
  await signOut(auth);
  await clearAuthSessionCookie();
  console.log("[Auth Flow - Client] Sign out completed.");
}
