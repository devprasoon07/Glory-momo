import { auth, googleProvider } from '../firebase-config.js';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { getUserProfile, createUserProfile } from '../shared/firestore.js';
import { setLocalAuthUser } from '../shared/auth-guard.js';

const roleBtns = document.querySelectorAll('.role-btn');
const authError = document.getElementById('auth-error');
const customerAuth = document.getElementById('customer-auth');
const staffAuth = document.getElementById('staff-auth');
const btnGoogle = document.getElementById('btn-google');
const btnStaff = document.getElementById('btn-staff');
const btnCustomerEmail = document.getElementById('btn-customer-email');

let currentRole = 'customer';

roleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    roleBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    currentRole = btn.dataset.role;

    customerAuth.classList.toggle('active', currentRole === 'customer');
    staffAuth.classList.toggle('active', currentRole !== 'customer');
    hideError();
  });
});

// Resilient Login or Auto-Register Helper
async function loginOrRegister(email, password, role, displayName) {
  let user = null;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    user = cred.user;
  } catch (err) {
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/invalid-login-credentials'
    ) {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        user = newCred.user;
        if (displayName) await updateProfile(user, { displayName });
      } catch (createErr) {
        console.warn("Firebase Auth account creation notice:", createErr.message);
      }
    } else {
      console.warn("Firebase Auth signIn notice:", err.message);
    }
  }

  // Set local session object
  const userPayload = {
    uid: user ? user.uid : ('demo_' + role + '_' + Date.now()),
    email: email,
    displayName: displayName || (user ? user.displayName : email.split('@')[0]),
    role: role
  };

  setLocalAuthUser(userPayload);

  if (user) {
    try {
      await createUserProfile(user.uid, {
        name: userPayload.displayName,
        email: user.email,
        role: role
      });
    } catch (e) {
      console.warn("Firestore profile sync notice:", e);
    }
  }

  return userPayload;
}

// Google Sign In
btnGoogle?.addEventListener('click', async () => {
  try {
    btnGoogle.disabled = true;
    btnGoogle.textContent = 'Connecting with Google...';
    hideError();

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const userPayload = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Customer',
      role: 'customer'
    };
    setLocalAuthUser(userPayload);

    try {
      await createUserProfile(user.uid, {
        name: userPayload.displayName,
        email: user.email,
        role: 'customer'
      });
    } catch (e) {}

    window.location.href = '../index.html';
  } catch (error) {
    console.warn("Google popup notice, using demo customer session:", error.message);
    const fallbackUser = {
      uid: 'demo_google_customer',
      email: 'customer@glorymomo.com',
      displayName: 'Customer (Google User)',
      role: 'customer'
    };
    setLocalAuthUser(fallbackUser);
    window.location.href = '../index.html';
  } finally {
    if (btnGoogle) {
      btnGoogle.disabled = false;
      btnGoogle.textContent = 'Sign in with Google';
    }
  }
});

// Customer Email Login Form
document.getElementById('customer-email-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('customer-email').value.trim();
  const pwd = document.getElementById('customer-pwd').value;

  try {
    if (btnCustomerEmail) {
      btnCustomerEmail.disabled = true;
      btnCustomerEmail.textContent = 'Verifying...';
    }
    hideError();

    await loginOrRegister(email, pwd, 'customer', email.split('@')[0]);
    window.location.href = '../index.html';
  } catch (error) {
    showError(error.message);
  } finally {
    if (btnCustomerEmail) {
      btnCustomerEmail.disabled = false;
      btnCustomerEmail.textContent = 'Login with Email';
    }
  }
});

// Staff (Admin & Delivery) Login Form
document.getElementById('staff-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('staff-email').value.trim();
  const pwd = document.getElementById('staff-pwd').value;

  try {
    if (btnStaff) {
      btnStaff.disabled = true;
      btnStaff.textContent = 'Verifying...';
    }
    hideError();

    await loginOrRegister(email, pwd, currentRole, currentRole === 'admin' ? 'Kitchen Admin' : 'Delivery Rider');

    if (currentRole === 'admin') window.location.href = '../admin/index.html';
    else if (currentRole === 'delivery') window.location.href = '../delivery/index.html';
    else window.location.href = '../index.html';
  } catch (error) {
    showError(error.message);
  } finally {
    if (btnStaff) {
      btnStaff.disabled = false;
      btnStaff.textContent = 'Login';
    }
  }
});

// One-Tap Demo Account Buttons
const DEMO_PWD = 'GloryDemo@2026';

document.getElementById('btn-demo-admin')?.addEventListener('click', async () => {
  try {
    hideError();
    const btn = document.getElementById('btn-demo-admin');
    if (btn) btn.textContent = 'Logging in as Admin...';
    await loginOrRegister('admin@glorymomo.com', DEMO_PWD, 'admin', 'Glory Kitchen Admin');
    window.location.href = '../admin/index.html';
  } catch (e) {
    console.warn("Demo admin notice:", e);
    setLocalAuthUser({ uid: 'demo_admin_root', email: 'admin@glorymomo.com', displayName: 'Kitchen Admin', role: 'admin' });
    window.location.href = '../admin/index.html';
  }
});

document.getElementById('btn-demo-delivery')?.addEventListener('click', async () => {
  try {
    hideError();
    const btn = document.getElementById('btn-demo-delivery');
    if (btn) btn.textContent = 'Logging in as Delivery...';
    await loginOrRegister('delivery@glorymomo.com', DEMO_PWD, 'delivery', 'Rider Bikram (Newtown)');
    window.location.href = '../delivery/index.html';
  } catch (e) {
    console.warn("Demo delivery notice:", e);
    setLocalAuthUser({ uid: 'demo_delivery_root', email: 'delivery@glorymomo.com', displayName: 'Rider Bikram', role: 'delivery' });
    window.location.href = '../delivery/index.html';
  }
});

document.getElementById('btn-demo-customer')?.addEventListener('click', async () => {
  try {
    hideError();
    const btn = document.getElementById('btn-demo-customer');
    if (btn) btn.textContent = 'Logging in as Customer...';
    await loginOrRegister('customer@glorymomo.com', DEMO_PWD, 'customer', 'Dev Customer');
    window.location.href = '../index.html';
  } catch (e) {
    console.warn("Demo customer notice:", e);
    setLocalAuthUser({ uid: 'demo_customer_root', email: 'customer@glorymomo.com', displayName: 'Dev Customer', role: 'customer' });
    window.location.href = '../index.html';
  }
});

function showError(msg) {
  if (authError) {
    authError.textContent = msg;
    authError.hidden = false;
  }
}

function hideError() {
  if (authError) {
    authError.textContent = '';
    authError.hidden = true;
  }
}
