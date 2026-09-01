import { auth, rtdb } from '../firebase-config.js';
import { requireRole, clearLocalAuthUser } from '../shared/auth-guard.js';
import { listenToDeliveryOrders, updateOrderStatus as dbUpdateOrderStatus, assignDelivery } from '../shared/firestore.js';
import { fetchRealRoadRoute, STALL_COORDS, NEWTOWN_FALLBACK_ROUTE } from '../shared/routing.js';
import { ref, set } from "firebase/database";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let watchId = null;
let currentUid = null;
let simInterval = null;
let delMap = null;
let riderMarker = null;
let stallMarker = null;
let destMarker = null;
let routeLine = null;
let activeRoadCoordinates = NEWTOWN_FALLBACK_ROUTE;

requireRole('delivery').then(({ user, profile }) => {
  currentUid = user?.uid || 'delivery-live';
  const nameEl = document.getElementById('rider-name');
  if (nameEl) nameEl.textContent = `🛵 ${profile?.name || user?.displayName || user?.name || 'Rider'}`;

  initDeliveryMap();
  setupOrderActionListeners();

  listenToDeliveryOrders(currentUid, (orders) => {
    renderActiveDeliveries(orders);
    updateMapForOrders(orders);
  });
});

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    stopAllTracking();
    clearLocalAuthUser();
    try { await auth.signOut(); } catch(e) {}
    window.location.href = '../index.html';
  });
}

async function initDeliveryMap() {
  const mapEl = document.getElementById('delivery-map');
  if (!mapEl || delMap) return;

  delMap = L.map('delivery-map').setView([STALL_COORDS.lat, STALL_COORDS.lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(delMap);

  const shopIcon = L.divIcon({
    html: '<div style="font-size:24px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🥟</div>',
    className: 'shop-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  stallMarker = L.marker([STALL_COORDS.lat, STALL_COORDS.lng], { icon: shopIcon }).addTo(delMap);
  stallMarker.bindPopup("<strong>Glory Momo Stall</strong><br>Pickup Counter").openPopup();

  const riderIcon = L.divIcon({
    html: '<div style="font-size:28px; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));">🛵</div>',
    className: 'rider-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  riderMarker = L.marker([STALL_COORDS.lat, STALL_COORDS.lng], { icon: riderIcon }).addTo(delMap);

  const destIcon = L.divIcon({
    html: '<div style="font-size:26px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">📍</div>',
    className: 'dest-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  const lastPoint = activeRoadCoordinates[activeRoadCoordinates.length - 1];
  destMarker = L.marker([lastPoint.lat, lastPoint.lng], { icon: destIcon }).addTo(delMap);
  destMarker.bindPopup("<strong>Customer Delivery Location</strong>");

  // Fetch genuine real road network route
  await refreshRoadRoute(lastPoint.lat, lastPoint.lng);
}

async function refreshRoadRoute(destLat = 22.5960, destLng = 88.4938) {
  if (!delMap) return;

  const routeData = await fetchRealRoadRoute(STALL_COORDS.lat, STALL_COORDS.lng, destLat, destLng);
  activeRoadCoordinates = routeData.coordinates;

  if (routeLine) {
    delMap.removeLayer(routeLine);
  }

  const latlngs = activeRoadCoordinates.map(p => [p.lat, p.lng]);
  routeLine = L.polyline(latlngs, {
    color: '#E9A21B',
    weight: 5,
    opacity: 0.9,
    lineJoin: 'round'
  }).addTo(delMap);

  if (destMarker) {
    destMarker.setLatLng([destLat, destLng]);
  }

  const badge = document.getElementById('nav-dist-badge');
  if (badge) {
    badge.textContent = `⚡ Fastest Road: ${routeData.distanceKm} km (~${routeData.durationMin} min ETA)`;
  }

  delMap.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
}

async function updateMapForOrders(orders) {
  if (!delMap) return;
  const active = orders.find(o => o.status === 'out_for_delivery') || orders[0];
  if (active) {
    const destLat = 22.5960;
    const destLng = 88.4938;
    await refreshRoadRoute(destLat, destLng);
  }
}

function updateRiderPosition(lat, lng) {
  if (!delMap) return;
  const pos = [lat, lng];
  if (riderMarker) {
    riderMarker.setLatLng(pos);
  }
  delMap.panTo(pos);
}

function stopAllTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  const locDot = document.getElementById('loc-dot');
  const locText = document.getElementById('loc-text');
  const btnToggleLoc = document.getElementById('btn-toggle-loc');
  const btnSim = document.getElementById('btn-sim-loc');

  if (locDot) locDot.classList.remove('live');
  if (locText) locText.textContent = "Location sharing idle";
  if (btnToggleLoc) btnToggleLoc.textContent = "Start Real GPS 📍";
  if (btnSim) btnSim.textContent = "Simulate Route 🛵";
}

function broadcastLocation(lat, lng) {
  const payload = {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    timestamp: Date.now()
  };

  updateRiderPosition(lat, lng);

  try {
    if (currentUid) {
      set(ref(rtdb, 'locations/' + currentUid), payload).catch(console.warn);
    }
    set(ref(rtdb, 'locations/delivery-live'), payload).catch(console.warn);
  } catch(e) {
    console.warn("RTDB broadcast notice:", e);
  }
}

// Real Device GPS Toggle
const btnToggleLoc = document.getElementById('btn-toggle-loc');
if (btnToggleLoc) {
  btnToggleLoc.addEventListener('click', () => {
    if (watchId) {
      stopAllTracking();
      return;
    }
    stopAllTracking();

    if ("geolocation" in navigator) {
      const locDot = document.getElementById('loc-dot');
      const locText = document.getElementById('loc-text');

      watchId = navigator.geolocation.watchPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        broadcastLocation(lat, lng);

        if (locDot) locDot.classList.add('live');
        if (locText) locText.textContent = `Live GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        btnToggleLoc.textContent = "Stop Real GPS ⏹️";
      }, (error) => {
        alert("Notice accessing location: " + error.message);
        stopAllTracking();
      }, { enableHighAccuracy: true });
    } else {
      alert("Geolocation is not supported by your browser");
    }
  });
}

// Simulated GPS Route for testing & demos
const btnSim = document.getElementById('btn-sim-loc');
if (btnSim) {
  btnSim.addEventListener('click', () => {
    if (simInterval) {
      stopAllTracking();
      return;
    }
    stopAllTracking();

    let step = 0;
    let forward = true;
    const locDot = document.getElementById('loc-dot');
    const locText = document.getElementById('loc-text');

    if (locDot) locDot.classList.add('live');
    if (btnSim) btnSim.textContent = "Stop Sim ⏸️";

    const initial = activeRoadCoordinates[0] || STALL_COORDS;
    broadcastLocation(initial.lat, initial.lng);
    if (locText) locText.textContent = `🛵 En Route to Customer: ${initial.lat.toFixed(4)}, ${initial.lng.toFixed(4)}`;

    simInterval = setInterval(() => {
      const len = activeRoadCoordinates.length;
      if (len === 0) return;

      if (forward) {
        step++;
        if (step >= len - 1) forward = false;
      } else {
        step--;
        if (step <= 0) forward = true;
      }

      const point = activeRoadCoordinates[step];
      const jitterLat = point.lat + (Math.random() - 0.5) * 0.0001;
      const jitterLng = point.lng + (Math.random() - 0.5) * 0.0001;

      broadcastLocation(jitterLat, jitterLng);
      if (locText) locText.textContent = `🛵 Moving (Point ${step + 1}/${len}): ${jitterLat.toFixed(4)}, ${jitterLng.toFixed(4)}`;
    }, 2000);
  });
}

function renderActiveDeliveries(orders) {
  const container = document.getElementById('del-orders');
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = '<p style="color:var(--steel-400); background:linear-gradient(180deg, var(--steel-900), var(--steel-950)); padding:34px 20px; border-radius:var(--r); text-align:center; border:1px dashed var(--steel-750); font-family:var(--ff-mono);">No active deliveries right now. Kitchen is preparing orders! ☕</p>';
    return;
  }

  container.innerHTML = orders.map(o => {
    const isOut = o.status === 'out_for_delivery';
    return `
      <div class="del-order" style="background:linear-gradient(180deg, var(--steel-900), var(--steel-950)); border:1px solid ${isOut ? 'var(--coriander)' : 'var(--steel-750)'}; padding:22px; border-radius:var(--r); margin-bottom:16px; box-shadow:0 6px 20px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
           <div>
             <strong style="color:var(--steel-050); font-size:1.2rem; font-family:var(--ff-display); letter-spacing:0.04em;">ORDER #${(o.id || '100').slice(-6).toUpperCase()}</strong>
             <span style="color:var(--turmeric); margin-left:8px; font-weight:800; font-family:var(--ff-mono); font-size:1.1rem;">₹${o.total}</span>
             <span style="background:var(--steel-850); color:var(--steel-200); padding:3px 10px; border-radius:4px; font-size:0.76rem; margin-left:6px; font-family:var(--ff-mono); text-transform:uppercase; border:1px solid var(--steel-700);">${o.status.replace(/_/g, ' ')}</span>
           </div>
           <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
             ${o.status === 'accepted' ? `<button type="button" class="btn btn--hot btn-pickup-order" data-order-id="${o.id}" style="padding:8px 16px; font-size:0.9rem;">🛵 Pickup &amp; Start</button>` : ''}
             ${isOut ? `<span style="background:rgba(16, 185, 129, 0.16); color:var(--coriander); padding:7px 16px; border-radius:999px; font-size:0.84rem; font-weight:800; border:1px solid var(--coriander); display:inline-flex; align-items:center; gap:8px; box-shadow:0 0 14px rgba(16,185,129,0.3); font-family:var(--ff-mono);"><span style="animation:pulseLive 1.2s infinite; font-size:1.1rem;">🛵</span> <strong>En Route · Approaching Customer</strong></span>` : ''}
             <button type="button" class="btn btn--steel btn-deliver-order" data-order-id="${o.id}" style="border-color:var(--coriander); color:var(--coriander-lit); padding:8px 16px; font-size:0.9rem;">Mark Delivered ✅</button>
           </div>
        </div>
        <p style="color:var(--steel-300); margin:12px 0 8px; font-size:0.92rem; line-height:1.5;">
          <strong>Customer:</strong> <span style="color:var(--steel-100);">${o.customerName || 'Customer'}</span>
          ${o.deliveryDistance ? `· 📍 <strong>${o.deliveryDistance} km</strong> from stall` : ''}
          · <strong>Payment:</strong> <span style="color:var(--turmeric); font-weight:700;">${o.paymentMethod === 'pay_on_delivery' ? '💵 Cash on Delivery (Collect ₹' + o.total + ')' : '📱 UPI (Prepaid)'}</span>
        </p>
        ${o.items ? `
          <div style="background:var(--steel-850); border:1px solid var(--steel-750); padding:10px 14px; border-radius:var(--r-sm); margin:10px 0 4px; font-size:0.85rem; color:var(--steel-200); font-family:var(--ff-mono);">
            ${o.items.map(i => `<span style="color:var(--turmeric); font-weight:700;">${i.q}x</span> ${i.id}`).join(' · ')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function setupOrderActionListeners() {
  const container = document.getElementById('del-orders');
  if (!container || container.dataset.listenerAttached) return;
  container.dataset.listenerAttached = 'true';

  container.addEventListener('click', async (e) => {
    const pickupBtn = e.target.closest('.btn-pickup-order');
    if (pickupBtn) {
      const orderId = pickupBtn.dataset.orderId;
      if (!orderId) return;

      pickupBtn.disabled = true;
      pickupBtn.style.background = 'var(--coriander)';
      pickupBtn.style.borderColor = 'var(--coriander)';
      pickupBtn.innerHTML = '<span>⚡</span> <strong>Started! En Route...</strong>';

      try {
        await assignDelivery(orderId, currentUid || 'delivery-live');
        await dbUpdateOrderStatus(orderId, 'out_for_delivery');

        // Automatically start GPS route simulation if tracking is idle so rider live location broadcasts immediately
        if (!watchId && !simInterval) {
          const btnSimLoc = document.getElementById('btn-sim-loc');
          if (btnSimLoc) btnSimLoc.click();
        }
      } catch (err) {
        console.error("Pickup order notice:", err);
        pickupBtn.disabled = false;
        pickupBtn.innerHTML = '🛵 Pickup &amp; Start';
      }
      return;
    }

    const deliverBtn = e.target.closest('.btn-deliver-order');
    if (deliverBtn) {
      const orderId = deliverBtn.dataset.orderId;
      if (!orderId) return;

      if (confirm(`Confirm that Order #${orderId.slice(-6).toUpperCase()} has been safely delivered?`)) {
        deliverBtn.disabled = true;
        deliverBtn.textContent = 'Delivering... ✅';

        try {
          await dbUpdateOrderStatus(orderId, 'delivered');
        } catch (err) {
          console.error("Deliver order notice:", err);
          alert("Failed to mark delivered: " + err.message);
          deliverBtn.disabled = false;
          deliverBtn.textContent = 'Mark Delivered ✅';
        }
      }
    }
  });
}

// Global hooks for fallback
window.markOutForDelivery = async function(orderId) {
  try {
    await assignDelivery(orderId, currentUid || 'delivery-live');
    await dbUpdateOrderStatus(orderId, 'out_for_delivery');
    if (!watchId && !simInterval) {
      document.getElementById('btn-sim-loc')?.click();
    }
  } catch(e) {
    alert("Notice: " + e.message);
  }
};

window.markDelivered = async function(orderId) {
  if (confirm("Confirm that this order has been safely handed over to the customer?")) {
    try {
      await dbUpdateOrderStatus(orderId, 'delivered');
    } catch(e) {
      alert("Notice: " + e.message);
    }
  }
};
