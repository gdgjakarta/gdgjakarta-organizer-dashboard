"use client";

import { createContext, use, useEffect, useState } from "react";

import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { type StoreApi, useStore } from "zustand";

import { auth, googleProvider } from "@/config/firebase";
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

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<StoreApi<AuthState>>(() => createAuthStore());

  useEffect(() => {
    console.log("[Auth Provider] Subscribing to onAuthStateChanged");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log(`[Auth Provider] Firebase user detected: ${firebaseUser.email} (UID: ${firebaseUser.uid})`);
        let validation: import("@/lib/bevy/types").OrganizerValidationResult | undefined;
        if (firebaseUser.email) {
          try {
            const token = await firebaseUser.getIdToken();
            console.log(`[Auth Provider] Syncing Firebase user ${firebaseUser.email} with server...`);
            validation = await handleUserPostLoginAction({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || undefined,
              avatar: firebaseUser.photoURL || undefined,
              token,
            });
            console.log(
              `[Auth Provider] Server sync completed for ${firebaseUser.email}. isOrganizer:`,
              validation.isValidOrganizer,
            );
          } catch (syncErr) {
            console.error("[Auth Provider] Error during post-login sync:", syncErr);
          }
        }

        const organizer = mapFirebaseUserToOrganizer(firebaseUser, validation);
        console.log(`[Auth Provider] Updating client AuthState with user role: "${organizer.role}"`);
        store.getState().setUser(organizer, firebaseUser);
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
 * Triggers Google Sign In with Firebase auth, validates against Bevy Chapter Team,
 * syncs member profile to Firestore, and establishes the role-based session.
 */
export async function signInWithGoogle(): Promise<{ organizer: AuthOrganizer; isAllowed: boolean }> {
  console.log("[Auth Flow Step 1 - Client] Initiating Firebase signInWithPopup (Google Provider)...");
  // Step 1: Sign in with Google
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  console.log(`[Auth Flow Step 2 - Client] Firebase Google Sign-In successful for: ${user.email} (UID: ${user.uid})`);

  // Step 2: Validate user against Bevy Chapter Team, sync Firestore, and set Session Cookie
  const email = user.email ?? "";
  const token = await user.getIdToken();
  console.log(`[Auth Flow Step 3 - Client] Calling handleUserPostLoginAction on server for ${email}...`);
  const validation = await handleUserPostLoginAction({
    uid: user.uid,
    email,
    name: user.displayName || undefined,
    avatar: user.photoURL || undefined,
    token,
  });

  const organizer = mapFirebaseUserToOrganizer(user, validation);
  console.log(`[Auth Flow Step 4 - Client] Post-login sync response:`, {
    email: organizer.email,
    role: organizer.role,
    chapterRole: organizer.chapterRole,
    isAllowed: validation.isValidOrganizer,
  });

  return {
    organizer,
    isAllowed: validation.isValidOrganizer,
  };
}

/**
 * Signs the user out from Firebase and clears the session cookie.
 */
export async function signOutOrganizer(): Promise<void> {
  console.log("[Auth Flow - Client] Signing out from Firebase and clearing session cookie...");
  await signOut(auth);
  await clearAuthSessionCookie();
  console.log("[Auth Flow - Client] Sign out completed.");
}
