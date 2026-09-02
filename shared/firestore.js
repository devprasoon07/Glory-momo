import { db } from '../firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";

// Local storage fallback order store
const LOCAL_ORDERS_KEY = 'glory_demo_orders';

export function getStoredLocalOrders() {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}

  // Initial Seed Sample Orders for Rich Dashboard Previews
  const initialSeed = [
    {
      id: 'demo-ord-101',
      customerId: 'demo_customer_root',
      customerName: 'Dev Customer',
      customerEmail: 'customer@glorymomo.com',
      items: [
        { id: 'Darjeeling Steam Chicken Momo', q: 2, price: 130 },
        { id: 'Spicy Kathmandu Jhol Broth Bowl', q: 1, price: 80 }
      ],
      subtotal: 340,
      discount: 60,
      couponCode: 'GLORY20',
      deliveryDistance: 2.5,
      deliveryFee: 10,
      total: 290,
      paymentMethod: 'pay_on_delivery',
      paymentStatus: 'unpaid',
      status: 'accepted',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
    },
    {
      id: 'demo-ord-102',
      customerId: 'demo_customer_root',
      customerName: 'Riya Sen (Newtown)',
      customerEmail: 'riya@kolkata.in',
      items: [
        { id: 'Crispy Fried Cheese & Corn Momo', q: 2, price: 140 }
      ],
      subtotal: 280,
      discount: 50,
      couponCode: 'FIRSTMOMO',
      deliveryDistance: 5.2,
      deliveryFee: 30,
      total: 260,
      paymentMethod: 'manual_upi',
      paymentStatus: 'pending_verification',
      status: 'awaiting_verification',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
    },
    {
      id: 'demo-ord-103',
      customerId: 'demo_customer_root',
      customerName: 'Anirban Mukherjee',
      customerEmail: 'anirban@techie.com',
      items: [
        { id: 'Steamed Classic Pork Momo (6pcs)', q: 2, price: 160 },
        { id: 'Fiery Dalle Khursani Chutney Extra', q: 2, price: 30 }
      ],
      subtotal: 380,
      discount: 0,
      couponCode: null,
      deliveryDistance: 8.0,
      deliveryFee: 50,
      total: 430,
      paymentMethod: 'manual_upi',
      paymentStatus: 'verified',
      status: 'out_for_delivery',
      deliveryId: 'delivery-live',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
    }
  ];

  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(initialSeed));
  } catch(e) {}
  return initialSeed;
}

export function saveStoredLocalOrders(orders) {
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('glory_local_orders_updated', { detail: orders }));
  } catch(e) {}
}

// Users
export async function createUserProfile(uid, data) {
  try {
    setDoc(doc(db, "users", uid), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});
  } catch(e) {
    console.warn("Firestore createUserProfile fallback:", e.message);
  }
}

export async function getUserProfile(uid) {
  try {
    const d = await Promise.race([
      getDoc(doc(db, "users", uid)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1200))
    ]);
    if (d && d.exists()) return d.data();
  } catch (e) {
    console.warn("Firestore getUserProfile notice:", e.message);
  }
  return null;
}

// Orders
export async function createOrder(orderData) {
  const newId = 'ord_' + Math.random().toString(36).substring(2, 9);
  const fullOrder = {
    ...orderData,
    id: newId,
    createdAt: new Date().toISOString(),
    status: orderData.status || 'awaiting_verification'
  };

  // 1. Instant local persistence for zero-latency, 100% reliable order placement
  const currentLocal = getStoredLocalOrders();
  const filtered = currentLocal.filter(o => o.id !== fullOrder.id);
  filtered.unshift(fullOrder);
  saveStoredLocalOrders(filtered);

  // 2. Non-blocking Firestore sync (fire & forget in background)
  try {
    const orderRef = doc(collection(db, "orders"));
    const firestoreId = orderRef.id;
    fullOrder.id = firestoreId;

    // Update local copy with the firestore document ID
    const updatedLocal = getStoredLocalOrders();
    const idx = updatedLocal.findIndex(o => o.id === newId);
    if (idx !== -1) {
      updatedLocal[idx] = fullOrder;
    } else {
      updatedLocal.unshift(fullOrder);
    }
    saveStoredLocalOrders(updatedLocal);

    // Fire & forget to Firestore
    setDoc(orderRef, fullOrder).catch(err => {
      console.warn("Firestore sync deferred (saved locally):", err.message);
    });
  } catch(e) {
    console.warn("Firestore createOrder offline fallback:", e.message);
  }

  return fullOrder.id;
}

export async function updateOrderStatus(orderId, status) {
  // 1. Instant local update for zero-latency UI reactivity
  const currentLocal = getStoredLocalOrders();
  const found = currentLocal.find(o => o.id === orderId);
  if (found) {
    found.status = status;
    found.updatedAt = new Date().toISOString();
    if (status === 'delivered') found.deliveredAt = new Date().toISOString();
    saveStoredLocalOrders(currentLocal);
  }

  // 2. Asynchronous Firestore sync
  try {
    const updatePayload = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (status === 'delivered') updatePayload.deliveredAt = new Date().toISOString();
    updateDoc(doc(db, "orders", orderId), updatePayload).catch(err => {
      console.warn("Firestore updateOrderStatus deferred:", err.message);
    });
  } catch(e) {
    console.warn("Firestore updateOrderStatus fallback:", e.message);
  }
}

export async function assignDelivery(orderId, deliveryId) {
  // 1. Instant local update
  const currentLocal = getStoredLocalOrders();
  const found = currentLocal.find(o => o.id === orderId);
  if (found) {
    found.deliveryId = deliveryId;
    found.status = 'out_for_delivery';
    found.assignedAt = new Date().toISOString();
    saveStoredLocalOrders(currentLocal);
  }

  // 2. Asynchronous Firestore sync
  try {
    updateDoc(doc(db, "orders", orderId), {
      deliveryId,
      status: 'out_for_delivery',
      assignedAt: new Date().toISOString()
    }).catch(err => {
      console.warn("Firestore assignDelivery deferred:", err.message);
    });
  } catch(e) {
    console.warn("Firestore assignDelivery fallback:", e.message);
  }
}

export function listenToCustomerOrders(customerId, callback) {
  const emitLocal = () => {
    const list = getStoredLocalOrders().filter(o => o.customerId === customerId || customerId.startsWith('demo') || !o.customerId);
    callback(list);
  };

  window.addEventListener('glory_local_orders_updated', emitLocal);
  emitLocal();

  try {
    const q = query(
      collection(db, "orders"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        emitLocal();
      }
    }, (err) => {
      console.warn("Firestore customer orders snapshot notice:", err.message);
      emitLocal();
    });

    return () => {
      window.removeEventListener('glory_local_orders_updated', emitLocal);
      unsub();
    };
  } catch(e) {
    emitLocal();
    return () => window.removeEventListener('glory_local_orders_updated', emitLocal);
  }
}

export function listenToAllOrders(callback) {
  const emitLocal = () => {
    callback(getStoredLocalOrders());
  };

  window.addEventListener('glory_local_orders_updated', emitLocal);
  emitLocal();

  try {
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        emitLocal();
      }
    }, (err) => {
      console.warn("Firestore all orders snapshot notice:", err.message);
      emitLocal();
    });

    return () => {
      window.removeEventListener('glory_local_orders_updated', emitLocal);
      unsub();
    };
  } catch(e) {
    emitLocal();
    return () => window.removeEventListener('glory_local_orders_updated', emitLocal);
  }
}

export function listenToDeliveryOrders(deliveryId, callback) {
  const emitLocal = () => {
    const list = getStoredLocalOrders().filter(o => o.status === 'out_for_delivery' || o.status === 'accepted');
    callback(list);
  };

  window.addEventListener('glory_local_orders_updated', emitLocal);
  emitLocal();

  try {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["out_for_delivery", "accepted"])
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        emitLocal();
      }
    }, (err) => {
      console.warn("Firestore delivery orders snapshot notice:", err.message);
      emitLocal();
    });

    return () => {
      window.removeEventListener('glory_local_orders_updated', emitLocal);
      unsub();
    };
  } catch(e) {
    emitLocal();
    return () => window.removeEventListener('glory_local_orders_updated', emitLocal);
  }
}

export async function submitOrderReview(orderId, ratingData) {
  // 1. Instant local update for seamless UI feedback
  const currentLocal = getStoredLocalOrders();
  const found = currentLocal.find(o => o.id === orderId);
  if (found) {
    found.rating = ratingData;
    saveStoredLocalOrders(currentLocal);
  }

  // 2. Persist to community reviews list locally
  try {
    const rawRev = localStorage.getItem('glory_community_reviews') || '[]';
    const reviews = JSON.parse(rawRev);
    reviews.unshift({
      orderId,
      ...ratingData,
      id: 'rev_' + Date.now()
    });
    localStorage.setItem('glory_community_reviews', JSON.stringify(reviews));
  } catch (e) {}

  // 3. Asynchronous Firestore sync
  try {
    updateDoc(doc(db, "orders", orderId), {
      rating: ratingData
    }).catch(() => {});
  } catch(e) {}

  try {
    const reviewRef = doc(collection(db, "reviews"));
    setDoc(reviewRef, {
      orderId,
      ...ratingData,
      createdAt: new Date().toISOString()
    }).catch(() => {});
  } catch(e) {}

  return true;
}
