import type { User } from "firebase/auth";
import { createStore } from "zustand/vanilla";

import type { ChapterRole } from "@/lib/bevy/types";

export type OrganizerRole = string;

export interface AuthOrganizer {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  bevyUserId?: string | number | null;
  chapterRole?: string | null;
  chapterRoleType?: ChapterRole;
  roleId?: number | null;
}

export interface AuthState {
  user: AuthOrganizer | null;
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  setUser: (user: AuthOrganizer | null, firebaseUser: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setLoggingOut: (isLoggingOut: boolean) => void;
}

let activeStore: ReturnType<typeof createAuthStore> | null = null;

export const setGlobalAuthStore = (store: ReturnType<typeof createAuthStore> | null) => {
  activeStore = store;
};

export const getGlobalAuthUser = (): AuthOrganizer | null => {
  return activeStore?.getState().user ?? null;
};

export const createAuthStore = (initialState?: Partial<AuthState>) => {
  return createStore<AuthState>()((set) => ({
    user: null,
    firebaseUser: null,
    isLoading: true,
    isAuthenticated: false,
    isLoggingOut: false,
    ...initialState,

    setUser: (user, firebaseUser) =>
      set((state) => ({
        user,
        firebaseUser,
        isAuthenticated: Boolean(user),
        isLoading: state.isLoggingOut,
      })),

    setLoading: (isLoading) => set({ isLoading }),
    setLoggingOut: (isLoggingOut) => set({ isLoggingOut, isLoading: isLoggingOut }),
  }));
};
