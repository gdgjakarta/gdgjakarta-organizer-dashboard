/**
 * Server-side no-op stub for firebase/firestore.
 *
 * All server-side database operations in this application run exclusively via the
 * Firebase REST API (src/server/firestore-admin.ts). Client-side Firestore SDK
 * operations run in the browser after hydration.
 *
 * When Next.js compiles server bundles (SSR / Cloudflare Worker runtime), this module
 * replaces @firebase/firestore to prevent @grpc/proto-loader and protobufjs from being
 * bundled into worker.js, eliminating dynamic codegen (Function/eval) and preventing
 * Cloudflare Worker EvalError crashes.
 */

export const db = null;

export const deleteField = () => ({
  _methodName: "deleteField",
});

export const getFirestore = () => null;
export const doc = () => ({});
export const collection = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => null });
export const getDocs = async () => ({ docs: [], empty: true, size: 0 });
export const setDoc = async () => {
  // no-op on server
};
export const updateDoc = async () => {
  // no-op on server
};
export const deleteDoc = async () => {
  // no-op on server
};
export const addDoc = async () => ({ id: "" });
export const writeBatch = () => ({
  set: () => {
    // no-op on server
  },
  update: () => {
    // no-op on server
  },
  delete: () => {
    // no-op on server
  },
  commit: async () => {
    // no-op on server
  },
});
export const query = () => ({});
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});
export const onSnapshot = () => () => {
  // no-op on server
};

export default {
  deleteField,
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
};
