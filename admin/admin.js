import { auth } from '../firebase-config.js';
import { requireRole, clearLocalAuthUser } from '../shared/auth-guard.js';
import { listenToAllOrders, updateOrderStatus as dbUpdateOrderStatus } from '../shared/firestore.js';

let allOrders = [];
let activeFilter = 'all';
let searchQuery = '';
let isAudioEnabled = true;
let prevOrderIds = new Set();
let isInitialLoad = true;

// Web Audio API Synthesizer Bell/Chime
let audioCtx = null;
function playKitchenChime() {
  if (!isAudioEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High A
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    console.warn("Audio chime notice:", e);
  }
}

// Audio Toggle Button
const btnAudio = document.getElementById('btn-audio-toggle');
const textAudio = document.getElementById('audio-toggle-text');
if (btnAudio && textAudio) {
  btnAudio.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    textAudio.textContent = isAudioEnabled ? 'Chime On' : 'Chime Muted';
    btnAudio.style.opacity = isAudioEnabled ? '1' : '0.6';
    if (isAudioEnabled) playKitchenChime();
  });
}

requireRole('admin').then(({ profile, user }) => {
  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = profile?.name || user?.displayName || 'Kitchen Admin';
  initFilters();

  listenToAllOrders((orders) => {
    if (!isInitialLoad) {
      const hasNewOrder = orders.some(o => !prevOrderIds.has(o.id));
      if (hasNewOrder) playKitchenChime();
    }
    isInitialLoad = false;
    prevOrderIds = new Set(orders.map(o => o.id));

    allOrders = orders;
    updateKPIs(orders);
    renderOrders();
  });
});

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    clearLocalAuthUser();
    try { await auth.signOut(); } catch(e) {}
    window.location.href = '../index.html';
  });
}

function initFilters() {
  const chips = document.querySelectorAll('.admin-chips .chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeFilter = chip.dataset.filter;
      renderOrders();
    });
  });

  const searchInput = document.getElementById('order-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderOrders();
    });
  }
}

function updateKPIs(orders) {
  let todayCount = 0;
  let todayEarnings = 0;
  let awaitingCount = 0;
  let cookingCount = 0;
  let deliveryCount = 0;
  let deliveredCount = 0;
  let cancelledCount = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  orders.forEach(o => {
    if (o.createdAt && o.createdAt.startsWith(todayStr)) {
      todayCount++;
      if (o.status === 'delivered') todayEarnings += (Number(o.total) || 0);
    }
    if (o.status === 'awaiting_verification') awaitingCount++;
    if (o.status === 'accepted') cookingCount++;
    if (o.status === 'out_for_delivery') deliveryCount++;
    if (o.status === 'delivered') deliveredCount++;
    if (o.status === 'cancelled') cancelledCount++;
  });

  const elOrders = document.getElementById('stat-orders');
  const elEarnings = document.getElementById('stat-earnings');
  const elAwaiting = document.getElementById('stat-awaiting');
  const elCooking = document.getElementById('stat-cooking');

  if (elOrders) elOrders.textContent = todayCount || orders.length;
  if (elEarnings) elEarnings.textContent = '₹' + (todayEarnings || orders.reduce((sum, o) => sum + (o.status === 'delivered' ? (Number(o.total) || 0) : 0), 0));
  if (elAwaiting) elAwaiting.textContent = awaitingCount;
  if (elCooking) elCooking.textContent = cookingCount;

  // Filter badge counts
  document.getElementById('count-all')?.replaceChildren(document.createTextNode(orders.length));
  document.getElementById('count-awaiting')?.replaceChildren(document.createTextNode(awaitingCount));
  document.getElementById('count-accepted')?.replaceChildren(document.createTextNode(cookingCount));
  document.getElementById('count-delivery')?.replaceChildren(document.createTextNode(deliveryCount));
  document.getElementById('count-delivered')?.replaceChildren(document.createTextNode(deliveredCount));
  document.getElementById('count-cancelled')?.replaceChildren(document.createTextNode(cancelledCount));
}

function renderOrders() {
  const container = document.getElementById('admin-orders');
  if (!container) return;

  let filtered = allOrders;

  if (activeFilter !== 'all') {
    filtered = filtered.filter(o => o.status === activeFilter);
  }

  if (searchQuery) {
    filtered = filtered.filter(o => {
      const matchId = (o.id || '').toLowerCase().includes(searchQuery);
      const matchName = (o.customerName || '').toLowerCase().includes(searchQuery);
      const matchEmail = (o.customerEmail || '').toLowerCase().includes(searchQuery);
      return matchId || matchName || matchEmail;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background:var(--steel-900); padding:40px; border-radius:var(--r); text-align:center; border:1px dashed var(--steel-700);">
        <p style="color:var(--steel-300); font-size:1.05rem;">No orders match this filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(o => {
    const isAwaiting = o.status === 'awaiting_verification';
    const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';

    return `
      <article class="admin-order ${isAwaiting ? 'is-urgent' : ''}" data-id="${o.id}">
        <div class="admin-order__header">
          <div>
            <strong style="color:var(--steel-050); font-size:1.15rem; letter-spacing:0.02em;">Order #${(o.id || '100').slice(-6).toUpperCase()}</strong>
            <span style="color:var(--steel-400); font-size:0.85rem; margin-left:8px;">🕒 ${timeStr}</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="order-badge ${o.status}">${formatStatus(o.status)}</span>
            <strong style="font-size:1.3rem; color:var(--turmeric); font-family:var(--ff-display);">₹${o.total}</strong>
          </div>
        </div>

        <div style="color:var(--steel-300); font-size:0.92rem; margin-bottom:12px;">
          <strong>Customer:</strong> ${escapeHtml(o.customerName || 'Anonymous')}
          ${o.customerEmail ? `<span style="color:var(--steel-400); font-size:0.85rem;">(${escapeHtml(o.customerEmail)})</span>` : ''}
          · <strong>Payment:</strong> <span style="color:${o.paymentMethod === 'pay_on_delivery' ? 'var(--coriander)' : 'var(--turmeric)'}; font-weight:700;">
            ${o.paymentMethod === 'pay_on_delivery' ? '💵 Pay on Delivery (COD)' : '📱 Manual UPI'}
          </span> (${escapeHtml(o.paymentStatus || 'pending')})
        </div>

        <!-- Itemized Cost Summary -->
        <div style="background:var(--steel-800); padding:8px 12px; border-radius:4px; margin-bottom:12px; font-size:0.82rem; color:var(--steel-200); display:flex; gap:12px; flex-wrap:wrap;">
          <span>Items: ₹${o.subtotal || o.total}</span>
          ${o.discount ? `<span style="color:var(--coriander);">Discount (${escapeHtml(o.couponCode || 'OFFER')}): -₹${o.discount}</span>` : ''}
          <span>Delivery (${o.deliveryDistance || 2} km): +₹${o.deliveryFee || 10}</span>
          <strong style="color:var(--turmeric); margin-left:auto;">Final: ₹${o.total}</strong>
        </div>

        <!-- Item list -->
        <div style="margin-bottom:14px;">
          ${(o.items || []).map(i => `
            <span class="item-chip">
              <strong style="color:var(--turmeric);">${i.q}x</strong> ${escapeHtml(i.id || 'Momo Item')}
            </span>
          `).join('')}
        </div>

        <!-- Urgent Verification Action Banner -->
        ${isAwaiting ? `
          <div class="verification-banner">
            <div>
              <strong style="color:var(--turmeric); display:block; font-size:0.95rem;">⚠️ UPI Payment Verification Required</strong>
              <span style="color:var(--steel-300); font-size:0.85rem;">Check UPI account for ₹${o.total} received before accepting.</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn--hot btn-admin-action" data-action="accept" data-id="${o.id}" style="padding:6px 14px; font-size:0.88rem;">
                ✓ Confirm & Start Cooking
              </button>
              <button type="button" class="btn btn--ghost btn-admin-action" data-action="cancel" data-id="${o.id}" style="padding:6px 14px; font-size:0.88rem; color:#ff6b6b;">
                ✕ Reject
              </button>
            </div>
          </div>
        ` : `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-top:10px; border-top:1px solid var(--steel-800);">
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="color:var(--steel-300); font-size:0.88rem;">Workflow Status:</label>
              <select class="admin-status-select" data-id="${o.id}" style="background:var(--iron); color:white; border:1px solid var(--steel-600); padding:6px 12px; border-radius:4px; font-size:0.88rem; cursor:pointer;">
                <option value="pending" ${o.status==='pending'?'selected':''}>⏳ Received</option>
                <option value="accepted" ${o.status==='accepted'?'selected':''}>🍳 Accepted / In Steamer</option>
                <option value="out_for_delivery" ${o.status==='out_for_delivery'?'selected':''}>🚴 Out for Delivery</option>
                <option value="delivered" ${o.status==='delivered'?'selected':''}>✅ Delivered</option>
                <option value="cancelled" ${o.status==='cancelled'?'selected':''}>❌ Cancelled</option>
              </select>
            </div>

            ${o.status === 'accepted' ? `
              <button type="button" class="btn btn--hot btn-admin-action" data-action="dispatch" data-id="${o.id}" style="padding:6px 14px; font-size:0.85rem;">
                Send with Courier 🚴
              </button>
            ` : ''}
          </div>
        `}

        ${o.rating ? `
          <div style="margin-top:10px; padding:6px 10px; background:rgba(233,162,27,0.1); border-radius:4px; font-size:0.85rem; color:var(--turmeric);">
            ⭐ Customer Rating: Food (${o.rating.food || 0}/5) · Delivery (${o.rating.delivery || 0}/5)
          </div>
        ` : ''}
      </article>
    `;
  }).join('');
}

// Global Event Delegation for Admin Actions (Zero-failure on dynamic re-renders)
const ordersContainer = document.getElementById('admin-orders');
if (ordersContainer) {
  ordersContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-admin-action');
    if (!btn) return;
    const action = btn.dataset.action;
    const orderId = btn.dataset.id;
    if (!orderId) return;

    btn.disabled = true;
    if (action === 'accept') {
      await handleStatusChange(orderId, 'accepted');
    } else if (action === 'cancel') {
      if (confirm("Are you sure you want to reject/cancel this order?")) {
        await handleStatusChange(orderId, 'cancelled');
      } else {
        btn.disabled = false;
      }
    } else if (action === 'dispatch') {
      await handleStatusChange(orderId, 'out_for_delivery');
    }
  });

  ordersContainer.addEventListener('change', async (e) => {
    const select = e.target.closest('.admin-status-select');
    if (!select) return;
    const orderId = select.dataset.id;
    const newStatus = select.value;
    if (orderId && newStatus) {
      await handleStatusChange(orderId, newStatus);
    }
  });
}

async function handleStatusChange(orderId, newStatus) {
  // Optimistic local update
  const order = allOrders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    renderOrders();
    updateKPIs(allOrders);
  }

  try {
    await dbUpdateOrderStatus(orderId, newStatus);
  } catch (err) {
    console.warn("Status update fallback notice:", err.message);
  }
}

function formatStatus(status) {
  const map = {
    'awaiting_verification': 'Needs Verification',
    'pending': 'Received',
    'accepted': 'In Steamer',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled'
  };
  return map[status] || status;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.verifyAndAccept = async function(orderId) {
  await handleStatusChange(orderId, 'accepted');
};

window.updateOrderStatus = async function(orderId, status) {
  await handleStatusChange(orderId, status);
};
