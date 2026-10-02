"use client";

import { createContext, use, useEffect, useState } from "react";

import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { type StoreApi, useStore } from "zustand";

import { auth, googleProvider } from "@/config/firebase";
import type { FirestoreMember } from "@/lib/firestore/types";
import { clearAuthSessionCookie, handleUserPostLoginAction } from "@/server/auth-actions";

import { type AuthOrganizer, type AuthState, createAuthStore } from "./auth-store";

const AuthStoreContext = createContext<StoreApi<AuthState> | null>(null);

let globalStore: StoreApi<AuthState> | null = null;
let isSigningInWithGoogle = false;

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
    chapterRoleType: validation?.chapterRoleType,
    roleId: validation?.roleId,
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

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<StoreApi<AuthState>>(() => createAuthStore());
  globalStore = store;

  // Subscribe to Firebase onAuthStateChanged to persist/restore session on load or reload
  useEffect(() => {
    console.log("[Auth Provider] Subscribing to onAuthStateChanged");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log(`[Auth Provider] Firebase user detected: ${firebaseUser.email} (UID: ${firebaseUser.uid})`);

        // Skip duplicate server sync if signInWithGoogle popup is actively handling it
        if (isSigningInWithGoogle) {
          console.log(
            "[Auth Provider] signInWithGoogle is actively syncing. Skipping duplicate onAuthStateChanged sync.",
          );
          return;
        }

        try {
          const email = firebaseUser.email ?? "";
          const token = await firebaseUser.getIdToken();
          console.log(`[Auth Provider] Restoring session via handleUserPostLoginAction for ${email}...`);

          const validation = await handleUserPostLoginAction({
            uid: firebaseUser.uid,
            email,
            name: firebaseUser.displayName ?? undefined,
            avatar: firebaseUser.photoURL ?? undefined,
            token,
          });

          const organizer = mapFirebaseUserToOrganizer(firebaseUser, validation);
          console.log("[Auth Provider] Session restored successfully:", {
            email: organizer.email,
            role: organizer.role,
            chapterRole: organizer.chapterRole,
          });

          await syncMemberToFirestore(firebaseUser, validation);
          store.getState().setUser(organizer, firebaseUser);
        } catch (err) {
          console.error("[Auth Provider] Error during session restoration:", err);
          store.getState().setLoading(false);
        }
      } else {
        console.log("[Auth Provider] No Firebase user session active. Resetting auth state.");
        store.getState().setUser(null, null);
      }
    });

    return () => unsubscribe();
  }, [store]);

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
 * Triggers Google Sign In with Firebase auth popup, validates against Bevy Chapter Team,
 * syncs member profile to Firestore, and establishes the role-based session.
 */
export async function signInWithGoogle(): Promise<{ organizer: AuthOrganizer; isAllowed: boolean }> {
  isSigningInWithGoogle = true;
  try {
    console.log("[Auth Flow Step 1 - Client] Initiating Firebase signInWithPopup (Google Provider)...");
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log(`[Auth Flow Step 2 - Client] Firebase Google Sign-In successful for: ${user.email} (UID: ${user.uid})`);

    // Step 2: Validate user against Bevy Chapter Team and set Session Cookie on server
    const email = user.email ?? "";
    const token = await user.getIdToken();
    console.log(`[Auth Flow Step 3 - Client] Calling handleUserPostLoginAction on server for ${email}...`);
    const validation = await handleUserPostLoginAction({
      uid: user.uid,
      email,
      name: user.displayName ?? undefined,
      avatar: user.photoURL ?? undefined,
      token,
    });

    const organizer = mapFirebaseUserToOrganizer(user, validation);
    console.log("[Auth Flow Step 4 - Client] Post-login sync response:", {
      email: organizer.email,
      role: organizer.role,
      chapterRole: organizer.chapterRole,
      isAllowed: validation.isValidOrganizer,
    });

    // Step 5: Sync member profile in Firestore on the client (browser-only)
    await syncMemberToFirestore(user, validation);

    // Update client AuthState immediately
    if (globalStore) {
      globalStore.getState().setUser(organizer, user);
    }

    return {
      organizer,
      isAllowed: validation.isValidOrganizer,
    };
  } finally {
    isSigningInWithGoogle = false;
  }
}

/**
 * Signs the user out from Firebase and clears the session cookie.
 */
export async function signOutOrganizer(): Promise<void> {
  console.log("[Auth Flow - Client] Signing out from Firebase and clearing session cookie...");
  if (globalStore) {
    globalStore.getState().setUser(null, null);
  }
  await signOut(auth);
  await clearAuthSessionCookie();
  console.log("[Auth Flow - Client] Sign out completed.");
}
