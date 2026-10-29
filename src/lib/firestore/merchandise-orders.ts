"use client";

import { collection, getDocs, getFirestore, onSnapshot, query, where } from "firebase/firestore";

import { app } from "@/config/firebase";

import type {
  EventBundlePackage,
  EventMerchandiseItem,
  EventMerchandiseOrder,
  FirestoreEvent,
  FirestoreRegistration,
} from "./types";

const db = getFirestore(app);
const COLLECTION_NAME = "event_merchandise_orders";

import { normalizeMerchandiseOrder } from "./normalization";

export { normalizeMerchandiseOrder };

/**
 * Fetches all on-the-spot merchandise orders for a given event.
 */
export async function getEventMerchandiseOrders(eventId: string): Promise<EventMerchandiseOrder[]> {
  const q = query(collection(db, COLLECTION_NAME), where("event_id", "==", String(eventId)));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => normalizeMerchandiseOrder(d.data() as Record<string, unknown>, d.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Subscribes to real-time updates for on-the-spot merchandise orders for a given event.
 */
export function subscribeEventMerchandiseOrders(
  eventId: string,
  callback: (orders: EventMerchandiseOrder[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (typeof window === "undefined" || !eventId) {
    callback([]);
    return () => {
      // no-op
    };
  }

  const strId = String(eventId);
  const numId = Number(eventId);
  const hasNum = !Number.isNaN(numId) && String(numId) === strId;

  const colRef = collection(db, COLLECTION_NAME);
  const q = hasNum
    ? query(colRef, where("event_id", "in", [strId, numId]))
    : query(colRef, where("event_id", "==", strId));

  try {
    return onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs
          .map((d) => normalizeMerchandiseOrder(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        callback(orders);
      },
      (err) => {
        console.warn("[subscribeEventMerchandiseOrders] Subscription error:", err);
        onError?.(err);
        callback([]);
      },
    );
  } catch (err) {
    console.warn("[subscribeEventMerchandiseOrders] Initialization error:", err);
    onError?.(err as Error);
    callback([]);
    return () => {
      // no-op
    };
  }
}

/**
 * Fetches all on-the-spot merchandise orders placed by a specific member email.
 */
export async function getMemberMerchandiseOrders(email: string): Promise<EventMerchandiseOrder[]> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return [];
  const q = query(collection(db, COLLECTION_NAME), where("customer.email", "==", cleanEmail));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => normalizeMerchandiseOrder(d.data() as Record<string, unknown>, d.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Subscribes to on-the-spot orders placed by a specific customer email.
 */
export function subscribeMemberMerchandiseOrders(
  email: string,
  callback: (orders: EventMerchandiseOrder[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) {
    callback([]);
    return () => {
      // no-op unsubscribe when email is empty
    };
  }
  const q = query(collection(db, COLLECTION_NAME), where("customer.email", "==", cleanEmail));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs
        .map((d) => normalizeMerchandiseOrder(d.data() as Record<string, unknown>, d.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      callback(orders);
    },
    (err) => {
      console.warn("[subscribeMemberMerchandiseOrders] Subscription error:", err);
      onError?.(err);
      callback([]);
    },
  );
}

/**
 * Calculates how many units of a merchandise item a customer has already purchased/claimed
 * across both event registrations (pre-order) and OTS orders, and returns the remaining quota.
 */
export function calculateCustomerRemainingMerchLimit(params: {
  email: string;
  item: EventMerchandiseItem;
  event: FirestoreEvent;
  registrations: FirestoreRegistration[];
  orders: EventMerchandiseOrder[];
}): { currentCount: number; maxAllowed: number | null; remaining: number } {
  const { email, item, event, registrations, orders } = params;
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) {
    const maxAllowed = item.max_per_person ?? event.max_merchandise_per_person ?? null;
    return { currentCount: 0, maxAllowed, remaining: maxAllowed ?? 999 };
  }

  // 1. Count from OTS orders (excluding cancelled/failed)
  let otsCount = 0;
  for (const o of orders) {
    if (o.customer.email === cleanEmail && o.payment_status !== "cancelled" && o.payment_status !== "failed") {
      for (const it of o.items) {
        if (it.merchandise_id === item.id) {
          otsCount += it.quantity || 1;
        }
      }
    }
  }

  // 2. Count from pre-registration merchandise
  let regCount = 0;
  for (const r of registrations) {
    const rEmail = (r.member_email || (r.answers?.email as string) || "").toLowerCase().trim();
    if (rEmail === cleanEmail && r.status !== "cancelled" && r.status !== "canceled" && r.status !== "rejected") {
      const selected = r.selected_merchandise ?? [];
      for (const m of selected) {
        if (m.id === item.id || m.merchandise_id === item.id) {
          regCount += m.quantity || 1;
        }
      }
    }
  }

  const currentCount = otsCount + regCount;
  const maxAllowed = item.max_per_person ?? event.max_merchandise_per_person ?? null;
  const remaining = maxAllowed !== null && maxAllowed !== undefined ? Math.max(0, maxAllowed - currentCount) : 999;

  return { currentCount, maxAllowed, remaining };
}

/**
 * Calculates remaining purchase limit for a bundle package.
 */
export function calculateCustomerRemainingBundleLimit(params: {
  email: string;
  bundle: EventBundlePackage;
  orders: EventMerchandiseOrder[];
}): { currentCount: number; maxAllowed: number | null; remaining: number } {
  const { email, bundle, orders } = params;
  const cleanEmail = email.toLowerCase().trim();
  const maxAllowed = bundle.capacity ?? null;
  if (!cleanEmail) {
    return { currentCount: 0, maxAllowed, remaining: maxAllowed ?? 999 };
  }

  let currentCount = 0;
  for (const o of orders) {
    if (
      o.customer.email === cleanEmail &&
      o.bundle_id === bundle.id &&
      o.payment_status !== "cancelled" &&
      o.payment_status !== "failed"
    ) {
      currentCount += 1;
    }
  }

  const remaining = maxAllowed !== null ? Math.max(0, maxAllowed - currentCount) : 999;
  return { currentCount, maxAllowed, remaining };
}
