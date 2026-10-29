"use client";

import { createContext, use, useEffect, useState } from "react";

import { getAdditionalUserInfo, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { type StoreApi, useStore } from "zustand";

import { auth, googleProvider } from "@/config/firebase";
import { ChapterRole, type OrganizerValidationResult } from "@/lib/bevy/types";
import type { FirestoreMember } from "@/lib/firestore/types";
import { splitFullName } from "@/lib/utils";
import { clearAuthSessionCookie, handleUserPostLoginAction, restoreSessionCookieAction } from "@/server/auth-actions";

import {
  type AuthOrganizer,
  type AuthState,
  createAuthStore,
  getGlobalAuthUser,
  setGlobalAuthStore,
} from "./auth-store";

export { getGlobalAuthUser };

const AuthStoreContext = createContext<StoreApi<AuthState> | null>(null);

let globalStore: StoreApi<AuthState> | null = null;
let isSigningInWithGoogle = false;

function mapFirebaseUserToOrganizer(user: User, validation?: OrganizerValidationResult): AuthOrganizer {
  const isOrg = validation?.isValidOrganizer ?? false;
  return {
    id: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: user.photoURL || "",
    role: validation?.role ?? (isOrg ? "organizer" : "member"),
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
    const { saveFirestoreMember, generateUserReferralCode } = await import("@/lib/firestore/client");
    const { isCoreTeamOrStaff } = await import("@/lib/auth-roles");
    const isStaff = isCoreTeamOrStaff(validation);
    const isOrg = validation?.isValidOrganizer ?? false;
    const isStaffOrOrg = isOrg || isStaff;
    const now = new Date().toISOString();
    let fallbackRole = "member";
    if (isOrg) {
      fallbackRole = "organizer";
    } else if (isStaff) {
      fallbackRole = "Core Team";
    }

    let fallbackChapterRole = "Member";
    if (isOrg) {
      fallbackChapterRole = "Organizer";
    } else if (isStaff) {
      fallbackChapterRole = "Core Team";
    }

    const email = user.email ?? "";
    const memberData: FirestoreMember = {
      id: user.uid,
      uid: user.uid,
      bevy_user_id: validation?.bevyUserId ? String(validation.bevyUserId) : null,
      name: user.displayName ?? (email ? email.split("@")[0] : "Community Member"),
      email,
      avatar_url: user.photoURL ?? "",
      role: validation?.role ?? fallbackRole,
      chapter_role: validation?.chapterRole ?? fallbackChapterRole,
      team: isStaffOrOrg ? "Core Team" : "Community",
      status: "Active",
      joined_date: now,
      events_registered_count: 0,
      events_attended_count: 0,
      last_active: now,
      updated_at: now,
      referral_code: generateUserReferralCode(user.uid),
    };
    await saveFirestoreMember(memberData);
    console.log(`[Auth Flow - Client] Synced member profile to Firestore for ${email}`);
  } catch (fsErr) {
    console.warn("[Auth Flow - Client] Firestore sync error (non-fatal):", fsErr);
  }
}

async function syncBevyUserToFirestore(uid: string, email: string) {
  if (typeof window === "undefined" || !email) return;
  try {
    console.log(`[Auth Flow - Client] Starting post-import Bevy sync for ${email}...`);
    const { syncMemberBevyUserAction } = await import("@/server/auth-actions");
    const { updateFirestoreMemberBevyId } = await import("@/lib/firestore/client");

    const syncResult = await syncMemberBevyUserAction(email);
    if (syncResult.success && syncResult.bevyUserId) {
      console.log(
        `[Auth Flow - Client] Post-import Bevy sync succeeded. Updating Firestore member ${uid} with bevy_user_id: ${syncResult.bevyUserId}`,
      );
      await updateFirestoreMemberBevyId(uid, syncResult.bevyUserId);

      // Update local auth store so the client state reflects the new bevyUserId
      if (globalStore) {
        const currentUser = globalStore.getState().user;
        if (currentUser && currentUser.id === uid) {
          globalStore.getState().setUser(
            {
              ...currentUser,
              bevyUserId: syncResult.bevyUserId,
            },
            auth.currentUser,
          );
        }
      }
    } else {
      console.warn("[Auth Flow - Client] Post-import Bevy sync did not find Bevy ID yet:", syncResult.error);
    }
  } catch (err) {
    console.warn("[Auth Flow - Client] Error during post-import Bevy sync:", err);
  }
}

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<StoreApi<AuthState>>(() => createAuthStore());
  globalStore = store;
  setGlobalAuthStore(store);

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

          // 1. Fetch local Firestore member profile
          const { getFirestoreMemberById } = await import("@/lib/firestore/client");
          const memberDoc = await getFirestoreMemberById(firebaseUser.uid);

          const isDocOrg =
            memberDoc?.role === "organizer" ||
            memberDoc?.role === "Organizer" ||
            (typeof memberDoc?.chapter_role === "string" &&
              (memberDoc.chapter_role.toLowerCase().includes("organizer") ||
                memberDoc.chapter_role.toLowerCase().includes("googler")));
          const isDocStaff =
            !isDocOrg &&
            (memberDoc?.team === "Core Team" ||
              memberDoc?.role === "core_team" ||
              memberDoc?.role === "Core Team" ||
              memberDoc?.role === "Check-in Staff" ||
              memberDoc?.role === "check_in_staff" ||
              (typeof memberDoc?.chapter_role === "string" &&
                (memberDoc.chapter_role.toLowerCase().includes("core team") ||
                  memberDoc.chapter_role.toLowerCase().includes("staff"))));

          // If member profile in Firestore already confirms organizer or staff, set fast interactive state
          if (isDocOrg || isDocStaff) {
            const initialRole = isDocOrg ? "organizer" : "core_team";
            const initialChapterRole = memberDoc?.chapter_role ?? (isDocOrg ? "Organizer" : "Core Team");
            const initialOrganizer: AuthOrganizer = {
              id: firebaseUser.uid,
              name: memberDoc?.name || firebaseUser.displayName || "User",
              email,
              avatar: memberDoc?.avatar_url || firebaseUser.photoURL || "",
              role: initialRole,
              bevyUserId: memberDoc?.bevy_user_id ? String(memberDoc.bevy_user_id) : undefined,
              chapterRole: initialChapterRole,
              chapterRoleType: isDocOrg ? ChapterRole.ORGANIZER : ChapterRole.CORE_TEAM,
              roleId: isDocOrg ? 1 : typeof memberDoc?.bevy_member_id === "number" ? memberDoc.bevy_member_id : 2,
            };
            store.getState().setUser(initialOrganizer, firebaseUser);
          }

          // Authoritatively restore session and evaluate Bevy chapter permissions on server
          const restoreRes = await restoreSessionCookieAction(token, memberDoc?.role);

          const isOrg =
            restoreRes.role === "organizer" ||
            (Boolean(restoreRes.isValidOrganizer) && restoreRes.roleId === 1) ||
            isDocOrg;
          const isStaff =
            !isOrg && (restoreRes.role === "core_team" || isDocStaff || Boolean(restoreRes.isValidOrganizer));

          const finalRole = isOrg ? "organizer" : isStaff ? "core_team" : "member";
          const finalChapterRole =
            restoreRes.chapterRole ||
            memberDoc?.chapter_role ||
            (isOrg ? "Organizer" : isStaff ? "Core Team" : "Member");
          const finalChapterRoleType =
            restoreRes.chapterRoleType ??
            (isOrg ? ChapterRole.ORGANIZER : isStaff ? ChapterRole.CORE_TEAM : ChapterRole.MEMBER);
          const finalRoleId = restoreRes.roleId ?? (isOrg ? 1 : isStaff ? 2 : undefined);
          const finalBevyUserId =
            restoreRes.bevyUserId || (memberDoc?.bevy_user_id ? String(memberDoc.bevy_user_id) : undefined);

          // Always set a fresh AuthOrganizer object reference so Zustand and React subscribers (AppSidebar) re-render immediately
          const authoritativeUser: AuthOrganizer = {
            id: firebaseUser.uid,
            name: memberDoc?.name || firebaseUser.displayName || email.split("@")[0] || "User",
            email,
            avatar: memberDoc?.avatar_url || firebaseUser.photoURL || "",
            role: finalRole,
            chapterRole: finalChapterRole,
            chapterRoleType: finalChapterRoleType,
            roleId: finalRoleId,
            bevyUserId: finalBevyUserId ?? null,
          };

          store.getState().setUser(authoritativeUser, firebaseUser);

          // Sync freshly resolved permissions or Bevy ID to Firestore if needed
          if (!memberDoc?.bevy_user_id && finalBevyUserId) {
            await syncBevyUserToFirestore(firebaseUser.uid, email);
          }
          if (finalRole !== memberDoc?.role || finalChapterRole !== memberDoc?.chapter_role) {
            await syncMemberToFirestore(firebaseUser, {
              isValidOrganizer: isOrg || isStaff,
              role: finalRole,
              chapterRole: finalChapterRole,
              bevyUserId: finalBevyUserId ?? null,
              roleId: finalRoleId,
            });
          }
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

    // Extract first_name and last_name from Google profile or fallback to user displayName
    let firstName: string | undefined;
    let lastName: string | undefined;
    try {
      const additionalInfo = getAdditionalUserInfo(result);
      const profile = additionalInfo?.profile as { given_name?: string; family_name?: string } | undefined;
      firstName = profile?.given_name;
      lastName = profile?.family_name;
    } catch {
      // additionalUserInfo not available
    }

    if (!firstName && user.displayName) {
      const split = splitFullName(user.displayName);
      firstName = split.firstName;
      lastName = split.lastName;
    }

    // Step 2: Validate against Bevy API directly upon Google Sign-In to always establish fresh permissions
    const email = user.email ?? "";
    const token = await user.getIdToken();

    console.log(`[Auth Flow Step 3 - Client] Calling handleUserPostLoginAction on server for ${email}...`);
    const validation = await handleUserPostLoginAction({
      uid: user.uid,
      email,
      name: user.displayName ?? undefined,
      avatar: user.photoURL ?? undefined,
      token,
      firstName: firstName?.trim() ? firstName : undefined,
      lastName: lastName?.trim() ? lastName : undefined,
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

    // Only sync Bevy User ID in background if it wasn't resolved yet and user was newly imported
    if (!validation.bevyUserId && validation.wasImported) {
      await syncBevyUserToFirestore(user.uid, email);
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
 * Signs the user out from Firebase and clears all cookies and storage.
 */
export async function signOutOrganizer(): Promise<void> {
  console.log("[Auth Flow - Client] Signing out from Firebase and clearing all session cookies...");
  if (globalStore) {
    globalStore.getState().setLoggingOut(true);
    globalStore.getState().setUser(null, null);
  }
  setGlobalAuthStore(null);

  // Clear client-accessible cookies, localStorage, and sessionStorage
  if (typeof document !== "undefined") {
    try {
      const cookiesList = document.cookie.split(";");
      for (const c of cookiesList) {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
        if (name) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
        }
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("[Sign Out] Storage clearing error:", e);
    }
  }

  // Clear server HTTP-only session cookies
  await clearAuthSessionCookie();

  // Sign out from Firebase
  await signOut(auth);
  console.log("[Auth Flow - Client] Sign out completed.");
}

/**
 * Forces a fresh Bevy permission evaluation for the current user,
 * bypasses all caches, updates Firestore and session cookies,
 * and refreshes local auth state.
 */
export async function refreshCurrentUserRole(): Promise<{
  success: boolean;
  role?: string;
  chapterRole?: string;
  message: string;
}> {
  try {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      return { success: false, message: "No active Firebase session found." };
    }

    console.log(`[Auth Flow - Client] Manually refreshing role from Bevy for: ${firebaseUser.email}...`);
    const token = await firebaseUser.getIdToken(true);

    const { refreshUserRoleAction } = await import("@/server/auth-actions");
    const result = await refreshUserRoleAction({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      token,
      displayName: firebaseUser.displayName ?? undefined,
    });

    if (result.success) {
      // 1. Sync fresh permissions to Firestore on client
      await syncMemberToFirestore(firebaseUser, {
        isValidOrganizer: result.isValidOrganizer,
        role: result.role,
        chapterRole: result.chapterRole,
        bevyUserId: result.bevyUserId,
        roleTitle: result.roleTitle,
      });

      // 2. Update local Zustand state
      const isOrg = result.role === "organizer";
      const isStaff = !isOrg && (result.role === "core_team" || result.isValidOrganizer);
      const organizer: AuthOrganizer = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName ?? "",
        avatar: firebaseUser.photoURL ?? "",
        role: result.role,
        chapterRole: result.chapterRole,
        chapterRoleType: isOrg ? ChapterRole.ORGANIZER : isStaff ? ChapterRole.CORE_TEAM : ChapterRole.MEMBER,
        roleId: isOrg ? 1 : isStaff ? 2 : undefined,
        bevyUserId: result.bevyUserId,
      };

      if (globalStore) {
        globalStore.getState().setUser(organizer, firebaseUser);
      }

      console.log(`[Auth Flow - Client] Role successfully refreshed from Bevy: ${result.roleTitle} (${result.role})`);
      return {
        success: true,
        role: result.role,
        chapterRole: result.chapterRole,
        message: `Synced with Bevy: ${result.roleTitle}`,
      };
    }

    return {
      success: false,
      message: result.message || "Failed to sync permissions from Bevy.",
    };
  } catch (err) {
    console.error("[Auth Flow - Client] Error during manual role refresh:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unexpected error during role refresh.",
    };
  }
}
