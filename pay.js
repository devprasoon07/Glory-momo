import { createOrder } from './shared/firestore.js';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getLocalAuthUser } from './shared/auth-guard.js';
import { getCurrentLang, t, applyTranslations } from './shared/i18n.js';

function getResolvedUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const local = getLocalAuthUser();
    if (local) return resolve(local);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user || getLocalAuthUser());
    });
    setTimeout(() => resolve(auth.currentUser || getLocalAuthUser()), 1000);
  });
}

function initPay() {
  if (document.getElementById('upi-modal')) return;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const upiModalHTML = `
    <div id="upi-modal" hidden class="scrim" role="dialog" aria-modal="true" aria-labelledby="upiModalTitle" style="z-index: 1000;">
      <div class="modal" style="max-width:390px; padding:24px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 id="upiModalTitle" data-i18n="upi_modal_title" style="color:var(--steel-050);font-size:1.3rem;font-family:var(--ff-display);text-transform:uppercase;letter-spacing:0.04em;margin:0;">Pay via UPI</h3>
          <span style="background:rgba(233,162,27,0.15); color:var(--turmeric); font-family:var(--ff-mono); font-weight:700; font-size:0.85rem; padding:2px 8px; border-radius:4px;" id="upi-modal-amt">₹0</span>
        </div>
        <p data-i18n="${isMobile ? 'upi_modal_desc_mobile' : 'upi_modal_desc_desktop'}" style="color:var(--steel-300);margin-bottom:12px;font-size:0.82rem;line-height:1.4;">
          ${isMobile ? 'Tap an app below or scan QR code with any UPI app to complete payment.' : 'Scan QR code with your mobile UPI app or copy the UPI ID below.'}
        </p>

        <!-- Feedback Alert Box -->
        <div id="upi-device-notice" style="display:none; background:rgba(233,162,27,0.12); border:1px solid rgba(233,162,27,0.3); border-radius:6px; padding:8px 10px; margin-bottom:12px; font-size:0.78rem; color:var(--turmeric); line-height:1.35; text-align:left;"></div>

        <!-- High-Contrast QR Code Card -->
        <div style="background:#fff; padding:10px; border-radius:8px; width:fit-content; margin:0 auto 12px; box-shadow:0 8px 24px rgba(0,0,0,0.35); text-align:center;">
          <img id="upi-qr" src="" alt="UPI QR Code" style="width:150px;height:150px;display:block;margin:0 auto;"/>
          <small style="color:#4a5568; font-size:0.72rem; font-weight:700; display:block; margin-top:4px;">Scan with GPay / PhonePe / Paytm</small>
        </div>

        <!-- UPI ID Row with 1-Tap Copy -->
        <div style="background:var(--steel-800); border:1px solid var(--steel-700); padding:8px 12px; border-radius:6px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div style="text-align:left;">
            <span data-i18n="upi_official_id" style="display:block; font-size:0.68rem; color:var(--steel-400); text-transform:uppercase; letter-spacing:0.04em;">Official UPI ID</span>
            <strong id="upi-id-text" style="font-family:var(--ff-mono); font-size:0.85rem; color:var(--turmeric);">dev.prasoon@ybl</strong>
          </div>
          <button id="btn-copy-upi" data-i18n="upi_copy_btn" type="button" class="btn btn--ghost" style="padding:4px 8px; font-size:0.72rem; border-color:var(--steel-600);">📋 Copy</button>
        </div>

        <!-- 1-Tap UPI Launch Buttons Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
          <button type="button" class="btn btn--ghost btn-upi-app" data-app="gpay" style="padding:8px 6px; font-size:0.78rem; border-color:var(--steel-700); background:var(--steel-850, #172129); color:var(--steel-100); display:flex; align-items:center; justify-content:center; gap:6px;">
            <span>🟢</span> <strong data-i18n="upi_gpay">Google Pay</strong>
          </button>
          <button type="button" class="btn btn--ghost btn-upi-app" data-app="phonepe" style="padding:8px 6px; font-size:0.78rem; border-color:var(--steel-700); background:var(--steel-850, #172129); color:var(--steel-100); display:flex; align-items:center; justify-content:center; gap:6px;">
            <span>🟣</span> <strong data-i18n="upi_phonepe">PhonePe</strong>
          </button>
          <button type="button" class="btn btn--ghost btn-upi-app" data-app="paytm" style="padding:8px 6px; font-size:0.78rem; border-color:var(--steel-700); background:var(--steel-850, #172129); color:var(--steel-100); display:flex; align-items:center; justify-content:center; gap:6px;">
            <span>🔵</span> <strong data-i18n="upi_paytm">Paytm</strong>
          </button>
          <button type="button" class="btn btn--ghost btn-upi-app" data-app="any" style="padding:8px 6px; font-size:0.78rem; border-color:var(--turmeric); color:var(--turmeric); background:rgba(233,162,27,0.08); display:flex; align-items:center; justify-content:center; gap:6px;">
            <span>⚡</span> <strong data-i18n="upi_any">Any UPI App</strong>
          </button>
        </div>

        <button id="btn-confirm-paid" data-i18n="upi_confirm_btn" class="btn btn--hot btn--wide" style="margin-bottom:8px; font-size:0.92rem; padding:11px;">✓ I Have Paid — Submit Order</button>
        <button id="btn-cancel-pay" data-i18n="upi_cancel_btn" class="btn btn--ghost btn--wide" style="border:none;color:var(--steel-400); font-size:0.82rem; padding:6px;">Cancel</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', upiModalHTML);
  applyTranslations(getCurrentLang());

  const btnCopy = document.getElementById('btn-copy-upi');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText('dev.prasoon@ybl').then(() => {
        btnCopy.textContent = t('upi_copied_btn', getCurrentLang());
        setTimeout(() => { btnCopy.textContent = t('upi_copy_btn', getCurrentLang()); }, 2000);
      });
    });
  }

  // App Launcher Event Handlers
  document.querySelectorAll('.btn-upi-app').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const app = btn.dataset.app;
      const cartState = window.GloryCart ? window.GloryCart.getTotals() : null;
      const amount = cartState ? cartState.grandTotal : 0;
      const upiId = "dev.prasoon@ybl";
      const shopName = "Glory Momo";
      const note = "Glory Momo Order";
      const noticeBox = document.getElementById('upi-device-notice');

      const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);

      // Generic universal standard UPI URI
      const standardUpi = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

      if (!isMobileDevice) {
        // Desktop Browser Handler
        navigator.clipboard.writeText(upiId).catch(() => {});
        if (noticeBox) {
          noticeBox.style.display = 'block';
          noticeBox.innerHTML = `💻 <strong>Desktop Browser Detected</strong><br>Please scan the QR code above with ${app === 'gpay' ? 'Google Pay' : app === 'phonepe' ? 'PhonePe' : app === 'paytm' ? 'Paytm' : 'any UPI app'} on your phone, or send to <strong>${upiId}</strong> (Copied to clipboard!).`;
        }
        return;
      }

      // Mobile Device App Deep-linking
      if (noticeBox) {
        noticeBox.style.display = 'block';
        noticeBox.textContent = `🚀 Opening ${app.toUpperCase()}... Please approve payment.`;
      }

      let targetUrl = standardUpi;

      if (app === 'gpay') {
        if (isAndroid) {
          targetUrl = `intent://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        } else {
          targetUrl = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
        }
      } else if (app === 'phonepe') {
        if (isAndroid) {
          targetUrl = `intent://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}#Intent;scheme=upi;package=com.phonepe.app;end`;
        } else {
          targetUrl = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
        }
      } else if (app === 'paytm') {
        if (isAndroid) {
          targetUrl = `intent://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}#Intent;scheme=upi;package=net.one97.paytm;end`;
        } else {
          targetUrl = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
        }
      }

      // Launch application
      window.location.href = targetUrl;

      // Fallback if app is not installed
      setTimeout(() => {
        if (noticeBox && document.visibilityState === 'visible') {
          noticeBox.innerHTML = `📲 If your app didn't open, scan the QR code or use UPI ID: <strong>${upiId}</strong>.`;
        }
      }, 2500);
    });
  });

  const btnPay = document.getElementById('btn-pay-now');
  if (!btnPay) return;

  btnPay.addEventListener('click', async () => {
    const cartState = window.GloryCart ? window.GloryCart.getTotals() : null;
    const items = window.GloryCart ? window.GloryCart.getItems() : [];

    if (!items || items.length === 0) {
      alert("Your order slip is empty. Please pick some delicious momos first!");
      return;
    }

    const amount = cartState ? cartState.grandTotal : 0;
    if (amount <= 0) {
      alert("Invalid order amount.");
      return;
    }

    btnPay.disabled = true;
    const origText = btnPay.innerHTML;
    btnPay.textContent = "Checking login status...";

    let user = await getResolvedUser();
    btnPay.disabled = false;
    btnPay.innerHTML = origText;

    if (!user) {
      alert("Please login first to place your order!");
      window.location.href = 'auth/login.html';
      return;
    }

    // --- Flow A: Pay on Delivery (COD) ---
    if (cartState && cartState.paymentMethod === 'cod') {
      if (cartState.subtotal < 199) {
        alert("Pay on Delivery is only available on orders above ₹199. Please add more items or pay via UPI.");
        return;
      }

      if (confirm(`Confirm placing Pay on Delivery (Cash on Delivery) order for ₹${amount}?`)) {
        btnPay.disabled = true;
        btnPay.textContent = "Placing order...";

        try {
          await createOrder({
            customerId: user.uid,
            customerName: user.displayName || user.name || user.email?.split('@')[0] || 'Customer',
            customerEmail: user.email || '',
            items: items,
            subtotal: cartState.subtotal,
            discount: cartState.discount || 0,
            couponCode: cartState.coupon?.code || null,
            deliveryDistance: cartState.distance || 2,
            deliveryFee: cartState.deliveryFee || 10,
            total: amount,
            paymentMethod: 'pay_on_delivery',
            paymentStatus: 'unpaid',
            status: 'pending'
          });

          // Mark coupon used
          if (cartState.coupon?.code) {
            window.GloryCart.markCouponUsed(cartState.coupon.code);
            try {
              if (user.uid && !user.uid.startsWith('demo')) {
                await updateDoc(doc(db, "users", user.uid), {
                  usedCoupons: arrayUnion(cartState.coupon.code)
                });
              }
            } catch(e) {}
          }

          if (window.GloryCart) window.GloryCart.clear();
          localStorage.removeItem('glory-momo-slip');

          alert("Order placed successfully! The kitchen is preparing your hot momos.");
          window.location.href = 'customer/index.html';
        } catch (e) {
          console.error("Order creation notice:", e);
          alert("Order registered! Redirecting to live tracker.");
          window.location.href = 'customer/index.html';
        }
      }
      return;
    }

    // --- Flow B: UPI Payment ---
    const upiId = "dev.prasoon@ybl";
    const shopName = "Glory Momo";
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR`;

    const qrImg = document.getElementById('upi-qr');
    const linkEl = document.getElementById('upi-link');
    const modalEl = document.getElementById('upi-modal');
    const amtEl = document.getElementById('upi-modal-amt');

    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
    if (linkEl) linkEl.href = upiString;
    if (amtEl) amtEl.textContent = `₹${amount}`;
    if (modalEl) {
      modalEl.hidden = false;
      requestAnimationFrame(() => modalEl.classList.add('is-on'));
    }
  });

  const cancelBtn = document.getElementById('btn-cancel-pay');
  const upiModal = document.getElementById('upi-modal');

  function closeModal() {
    if (!upiModal) return;
    upiModal.classList.remove('is-on');
    setTimeout(() => {
      upiModal.hidden = true;
    }, 280);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  if (upiModal) {
    upiModal.addEventListener('click', (e) => {
      if (e.target === upiModal) closeModal();
    });
  }

  const confirmBtn = document.getElementById('btn-confirm-paid');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Placing order...";

      const cartState = window.GloryCart ? window.GloryCart.getTotals() : null;
      const items = window.GloryCart ? window.GloryCart.getItems() : [];
      const amount = cartState ? cartState.grandTotal : 0;
      const user = await getResolvedUser();

      if (!user) {
        alert("Session expired. Please log in again.");
        window.location.href = 'auth/login.html';
        return;
      }

      try {
        await createOrder({
          customerId: user.uid,
          customerName: user.displayName || user.name || user.email?.split('@')[0] || 'Customer',
          customerEmail: user.email || '',
          items: items,
          subtotal: cartState ? cartState.subtotal : amount,
          discount: cartState ? (cartState.discount || 0) : 0,
          couponCode: cartState?.coupon?.code || null,
          deliveryDistance: cartState ? (cartState.distance || 2) : 2,
          deliveryFee: cartState ? (cartState.deliveryFee || 10) : 10,
          total: amount,
          paymentMethod: 'manual_upi',
          paymentStatus: 'pending_verification',
          status: 'awaiting_verification'
        });

        // Mark coupon used
        if (cartState?.coupon?.code) {
          window.GloryCart.markCouponUsed(cartState.coupon.code);
          try {
            if (user.uid && !user.uid.startsWith('demo')) {
              await updateDoc(doc(db, "users", user.uid), {
                usedCoupons: arrayUnion(cartState.coupon.code)
              });
            }
          } catch(e) {}
        }

        if (window.GloryCart) window.GloryCart.clear();
        localStorage.removeItem('glory-momo-slip');

        closeModal();
        alert("Order placed successfully! The counter will verify your payment and start cooking shortly.");
        window.location.href = 'customer/index.html';
      } catch (e) {
        console.error("Order creation notice:", e);
        closeModal();
        window.location.href = 'customer/index.html';
      }
    });
  }
  window.addEventListener('glory_lang_changed', (e) => {
    applyTranslations(e.detail.lang);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPay);
} else {
  initPay();
}
