import type { User } from "firebase/auth";
import { createStore } from "zustand/vanilla";

export type OrganizerRole = string;

export interface AuthOrganizer {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  bevyUserId?: string | number | null;
  chapterRole?: string | null;
}

export interface AuthState {
  user: AuthOrganizer | null;
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthOrganizer | null, firebaseUser: User | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const createAuthStore = (initialState?: Partial<AuthState>) => {
  return createStore<AuthState>()((set) => ({
    user: null,
    firebaseUser: null,
    isLoading: true,
    isAuthenticated: false,
    ...initialState,

    setUser: (user, firebaseUser) =>
      set({
        user,
        firebaseUser,
        isAuthenticated: Boolean(user),
        isLoading: false,
      }),

    setLoading: (isLoading) => set({ isLoading }),
  }));
};
