import { auth, rtdb, db } from '../firebase-config.js';
import { requireRole, clearLocalAuthUser } from '../shared/auth-guard.js';
import { listenToCustomerOrders } from '../shared/firestore.js';
import { fetchRealRoadRoute, STALL_COORDS as DEFAULT_STALL } from '../shared/routing.js';
import { onValue, ref } from "firebase/database";
import { updateDoc, doc } from "firebase/firestore";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let map = null;
let courierMarker = null;
let stallMarker = null;
let customerMarker = null;
let routeLine = null;
let currentTrackingDeliveryId = null;
let currentTrackingUnsub = null;
let activeOrder = null;
let unratedOrder = null;

// Newtown Glory Momo Stall Coordinates
const STALL_COORDS = [DEFAULT_STALL.lat, DEFAULT_STALL.lng];
const DEFAULT_CUSTOMER_COORDS = [22.5960, 88.4938];

requireRole('customer').then(({ user, profile }) => {
  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = profile?.name || user?.displayName || user?.name || 'Customer';

  listenToCustomerOrders(user.uid, (orders) => {
    updateActiveOrderTracker(orders);
    renderOrderHistory(orders);
    checkDeliveredModals(orders);
  });
});

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    if (currentTrackingUnsub) currentTrackingUnsub();
    clearLocalAuthUser();
    try { await auth.signOut(); } catch(e) {}
    window.location.href = '../index.html';
  });
}

function updateActiveOrderTracker(orders) {
  const panel = document.getElementById('live-tracker-panel');
  if (!panel) return;

  // Find most recent active order
  const live = orders.find(o => ['awaiting_verification', 'pending', 'accepted', 'out_for_delivery'].includes(o.status));

  if (!live) {
    panel.hidden = true;
    if (currentTrackingUnsub) {
      currentTrackingUnsub();
      currentTrackingUnsub = null;
    }
    return;
  }

  activeOrder = live;
  panel.hidden = false;

  const orderTitle = document.getElementById('tracker-order-title');
  const subtitle = document.getElementById('tracker-subtitle');
  const statusBadge = document.getElementById('tracker-status-badge');

  if (orderTitle) orderTitle.textContent = `Order #${live.id.slice(-6).toUpperCase()}`;

  const statusLabels = {
    'awaiting_verification': { badge: '⚠️ Verification Pending', sub: 'We are verifying your UPI transaction at the counter.' },
    'pending': { badge: '⏳ Order Received', sub: 'Your order is in the kitchen queue.' },
    'accepted': { badge: '🍳 Steaming Fresh', sub: 'Our chef is steaming your hot momos with spiced Jhol broth.' },
    'out_for_delivery': { badge: '🚴 Out for Delivery', sub: 'Your delivery rider is on the way to your door!' }
  };

  const currentMeta = statusLabels[live.status] || { badge: live.status, sub: 'Processing order...' };
  if (statusBadge) statusBadge.textContent = currentMeta.badge;
  if (subtitle) subtitle.textContent = currentMeta.sub;

  // Update stepper dots
  updateStepper(live.status);

  // If out for delivery, show and track map
  const mapWrapper = document.getElementById('map-wrapper');
  if (live.status === 'out_for_delivery') {
    if (mapWrapper) mapWrapper.hidden = false;
    startCourierTracking(live.deliveryId || 'delivery-live');
  } else {
    if (mapWrapper) mapWrapper.hidden = true;
  }
}

function updateStepper(status) {
  const steps = ['awaiting_verification', 'accepted', 'out_for_delivery', 'delivered'];
  let activeIndex = 0;

  if (status === 'awaiting_verification' || status === 'pending') activeIndex = 0;
  else if (status === 'accepted') activeIndex = 1;
  else if (status === 'out_for_delivery') activeIndex = 2;
  else if (status === 'delivered') activeIndex = 3;

  const stepEls = document.querySelectorAll('.stepper .step');
  const lineEls = document.querySelectorAll('.stepper .step__line');

  stepEls.forEach((el, idx) => {
    el.classList.remove('is-done', 'is-current');
    if (idx < activeIndex) el.classList.add('is-done');
    else if (idx === activeIndex) el.classList.add('is-current');
  });

  lineEls.forEach((el, idx) => {
    el.classList.toggle('is-done', idx < activeIndex);
  });
}

function startCourierTracking(deliveryId) {
  if (currentTrackingDeliveryId === deliveryId && currentTrackingUnsub) return;
  if (currentTrackingUnsub) currentTrackingUnsub();

  currentTrackingDeliveryId = deliveryId;
  initMap();

  const timeEl = document.getElementById('courier-update-time');
  const locRef = ref(rtdb, 'locations/' + deliveryId);

  currentTrackingUnsub = onValue(locRef, (snapshot) => {
    const data = snapshot.val();
    if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
      const pos = [data.lat, data.lng];

      if (!courierMarker) {
        const bikeIcon = L.divIcon({
          html: '<div style="font-size:30px; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));">🛵</div>',
          className: 'custom-bike-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        courierMarker = L.marker(pos, { icon: bikeIcon }).addTo(map);
      } else {
        courierMarker.setLatLng(pos);
      }

      if (map) map.panTo(pos);
      if (timeEl) timeEl.textContent = `Last update: ${new Date(data.timestamp || Date.now()).toLocaleTimeString()}`;
    }
  });
}

async function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || map) return;

  map = L.map('map').setView(STALL_COORDS, 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const shopIcon = L.divIcon({
    html: '<div style="font-size:26px; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));">🥟</div>',
    className: 'shop-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  stallMarker = L.marker(STALL_COORDS, { icon: shopIcon }).addTo(map);
  stallMarker.bindPopup("<strong>Glory Momo Kitchen</strong><br>Sukhobrishti, Newtown").openPopup();

  const userIcon = L.divIcon({
    html: '<div style="font-size:26px; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));">📍</div>',
    className: 'user-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  customerMarker = L.marker(DEFAULT_CUSTOMER_COORDS, { icon: userIcon }).addTo(map);
  customerMarker.bindPopup("<strong>Your Delivery Location</strong>");

  // Fetch genuine turn-by-turn road route
  const routeData = await fetchRealRoadRoute(STALL_COORDS[0], STALL_COORDS[1], DEFAULT_CUSTOMER_COORDS[0], DEFAULT_CUSTOMER_COORDS[1]);
  const latlngs = routeData.coordinates.map(p => [p.lat, p.lng]);

  routeLine = L.polyline(latlngs, {
    color: '#C4441C',
    weight: 5,
    opacity: 0.9,
    lineJoin: 'round'
  }).addTo(map);

  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
}

function renderOrderHistory(orders) {
  const container = document.getElementById('orders-list');
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="background:var(--steel-900); padding:40px; border-radius:var(--r); text-align:center; border:1px dashed var(--steel-700);">
        <p style="color:var(--steel-300); font-size:1.1rem; margin-bottom:14px;">No orders found yet.</p>
        <a href="../index.html#menu" class="btn btn--hot">Browse Menu & Order</a>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => {
    const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently';

    return `
      <div class="order-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div>
            <strong style="color:var(--steel-050); font-size:1.15rem;">Order #${o.id.slice(-6).toUpperCase()}</strong>
            <span style="color:var(--steel-400); font-size:0.85rem; margin-left:8px;">${timeStr}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="order-badge ${o.status}">${formatStatus(o.status)}</span>
            <strong style="font-size:1.25rem; color:var(--turmeric); font-family:var(--ff-display);">₹${o.total}</strong>
          </div>
        </div>

        <div style="font-size:0.9rem; color:var(--steel-300); margin-bottom:8px;">
          ${(o.items || []).map(i => `${i.q}x ${escapeHtml(i.id)}`).join(' · ')}
        </div>

        <!-- Receipt summary -->
        <div style="font-size:0.82rem; color:var(--steel-400); display:flex; gap:10px; flex-wrap:wrap;">
          <span>Items: ₹${o.subtotal || o.total}</span>
          ${o.discount ? `<span style="color:var(--coriander);">Discount: -₹${o.discount}</span>` : ''}
          <span>Delivery: +₹${o.deliveryFee || 10}</span>
          <span>Payment: <strong style="color:var(--steel-200);">${o.paymentMethod === 'pay_on_delivery' ? 'Cash on Delivery' : 'UPI'}</strong></span>
        </div>

        ${o.rating ? `
          <div style="margin-top:10px; font-size:0.85rem; color:var(--turmeric);">
            ⭐ Rated: Food (${o.rating.food}/5) · Delivery (${o.rating.delivery}/5)
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function formatStatus(status) {
  const map = {
    'awaiting_verification': 'Needs Verification',
    'pending': 'Received',
    'accepted': 'In Steamer',
    'out_for_delivery': 'On Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled'
  };
  return map[status] || status;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Satisfaction Modal Logic */
function checkDeliveredModals(orders) {
  const deliveredUnrated = orders.find(o => o.status === 'delivered' && !o.rating);
  if (deliveredUnrated && !unratedOrder) {
    unratedOrder = deliveredUnrated;
    const modal = document.getElementById('satisfaction-modal');
    if (modal) {
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('is-on'));
    }
  }
}

let foodRating = 5;
let deliveryRating = 5;

document.querySelectorAll('.stars-row').forEach(row => {
  const type = row.dataset.type;
  const stars = row.querySelectorAll('.star-btn');

  function updateStars(val) {
    stars.forEach(s => {
      const starVal = Number(s.dataset.val);
      s.classList.toggle('is-lit', starVal <= val);
    });
  }
  updateStars(5);

  stars.forEach(s => {
    s.addEventListener('click', () => {
      const val = Number(s.dataset.val);
      if (type === 'food') foodRating = val;
      if (type === 'delivery') deliveryRating = val;
      updateStars(val);
    });
  });
});

const btnSubmitReview = document.getElementById('btn-submit-review');
if (btnSubmitReview) {
  btnSubmitReview.addEventListener('click', async () => {
    if (!unratedOrder) return;
    try {
      btnSubmitReview.disabled = true;
      btnSubmitReview.textContent = "Submitting...";

      await updateDoc(doc(db, "orders", unratedOrder.id), {
        rating: {
          food: foodRating,
          delivery: deliveryRating,
          ratedAt: new Date().toISOString()
        }
      });

      const modal = document.getElementById('satisfaction-modal');
      if (modal) {
        modal.classList.remove('is-on');
        setTimeout(() => modal.hidden = true, 280);
      }
      unratedOrder = null;
      alert("Thank you for supporting Glory Momo! ❤️🥟");
    } catch (e) {
      alert("Failed to save rating: " + e.message);
      btnSubmitReview.disabled = false;
      btnSubmitReview.textContent = "Submit Rating 🙏";
    }
  });
}

const btnSkip = document.getElementById('btn-skip-review');
if (btnSkip) {
  btnSkip.addEventListener('click', () => {
    const modal = document.getElementById('satisfaction-modal');
    if (modal) {
      modal.classList.remove('is-on');
      setTimeout(() => modal.hidden = true, 280);
    }
  });
}
