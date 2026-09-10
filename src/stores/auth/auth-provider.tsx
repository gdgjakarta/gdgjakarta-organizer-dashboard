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
  return {
    id: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Organizer",
    email: user.email || "",
    avatar: user.photoURL || "",
    role: validation?.role || (validation?.isValidOrganizer ? "organizer" : "member"),
    bevyUserId: validation?.bevyUserId,
    chapterRole: validation?.chapterRole || (validation?.isValidOrganizer ? "Organizer" : "Member"),
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
            const token = await firebaseUser.getIdToken();
            validation = await handleUserPostLoginAction({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || undefined,
              avatar: firebaseUser.photoURL || undefined,
              token,
            });
          } catch {
            // Fallback gracefully
          }
        }

        const organizer = mapFirebaseUserToOrganizer(firebaseUser, validation);
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
 * Triggers Google Sign In with Firebase auth, validates against Bevy Chapter Team,
 * syncs member profile to Firestore, and establishes the role-based session.
 */
export async function signInWithGoogle(): Promise<{ organizer: AuthOrganizer; isAllowed: boolean }> {
  // Step 1: Sign in with Google
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  // Step 2: Validate user against Bevy Chapter Team, sync Firestore, and set Session Cookie
  const email = user.email ?? "";
  const token = await user.getIdToken();
  const validation = await handleUserPostLoginAction({
    uid: user.uid,
    email,
    name: user.displayName || undefined,
    avatar: user.photoURL || undefined,
    token,
  });

  const organizer = mapFirebaseUserToOrganizer(user, validation);

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
