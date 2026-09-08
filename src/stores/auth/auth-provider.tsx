"use client";

import { createContext, use, useEffect, useState } from "react";

import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { type StoreApi, useStore } from "zustand";

import { auth, googleProvider } from "@/config/firebase";
import { clearAuthSessionCookie, setAuthSessionCookie, validateOrganizerAction } from "@/server/auth-actions";

import { type AuthOrganizer, type AuthState, createAuthStore } from "./auth-store";

const AuthStoreContext = createContext<StoreApi<AuthState> | null>(null);

function mapFirebaseUserToOrganizer(
  user: import("firebase/auth").User,
  validation?: import("@/lib/bevy/types").OrganizerValidationResult,
): AuthOrganizer {
  return {
    id: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Organizer",
    email: user.email || "",
    avatar: user.photoURL || "",
    role: validation?.role || "organizer",
    bevyUserId: validation?.bevyUserId,
    chapterRole: validation?.chapterRole || "Organizer",
  };
}

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<StoreApi<AuthState>>(() => createAuthStore());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let validation: import("@/lib/bevy/types").OrganizerValidationResult | undefined;
        if (firebaseUser.email) {
          try {
            validation = await validateOrganizerAction(firebaseUser.email);
          } catch {
            // Fallback gracefully
          }
        }

        const organizer = mapFirebaseUserToOrganizer(firebaseUser, validation);
        try {
          const token = await firebaseUser.getIdToken();
          const role = validation?.isValidOrganizer ? "organizer" : "member";
          await setAuthSessionCookie(token, role, true);
        } catch {
          // Ignore token retrieval errors
        }
        store.getState().setUser(organizer, firebaseUser);
      } else {
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
 * Step 1-4: Triggers Google Sign In popup with Firebase auth,
 * then validates against Bevy Chapter Teams and establishes the session.
 */
export async function signInWithGoogle(): Promise<{ organizer: AuthOrganizer; isAllowed: boolean }> {
  // Step 1: Sign in with Google
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  // Step 2 & 3: Validate user against Bevy Chapter Team in single loading flow
  const email = user.email ?? "";
  const validation = await validateOrganizerAction(email);

  const organizer = mapFirebaseUserToOrganizer(user, validation);

  // Set Auth Session Cookie
  const token = await user.getIdToken();
  const role = validation.isValidOrganizer ? "organizer" : "member";
  await setAuthSessionCookie(token, role, true);

  return {
    organizer,
    isAllowed: validation.isValidOrganizer,
  };
}

/**
 * Signs the user out from Firebase and clears the session cookie.
 */
export async function signOutOrganizer(): Promise<void> {
  await signOut(auth);
  await clearAuthSessionCookie();
}
