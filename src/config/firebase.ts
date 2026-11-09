import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { getRemoteConfig } from "firebase/remote-config";

import { REMOTE_CONFIG_KEYS } from "./remote-config-keys";

// Your web app's Firebase configuration read from environment variables
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gdgjakarta-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gdgjakarta-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gdgjakarta-app.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "883556294048",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:883556294048:web:364631a561bd411a0ed8c5",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-YK2P07NQHZ",
};

// Initialize Firebase (safely handling hot reloads in Next.js)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Initialize Remote Config only on the client side
export const remoteConfig = typeof window !== "undefined" ? getRemoteConfig(app) : null;

if (remoteConfig) {
  remoteConfig.settings.minimumFetchIntervalMillis = process.env.NODE_ENV === "development" ? 10000 : 60000;

  // Only public client feature flags should have defaults in browser SDK.
  // Administrative credentials (BEVY_COOKIE, BEVY_CSRF_TOKEN) must remain server-only.
  remoteConfig.defaultConfig = {
    [REMOTE_CONFIG_KEYS.FEATURE_FLAGS]: process.env.FEATURE_FLAGS || process.env.NEXT_PUBLIC_FEATURE_FLAGS || "{}",
  };
}
