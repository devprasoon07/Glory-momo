import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile, createUserProfile } from './firestore.js';

export function getLocalAuthUser() {
  try {
    const raw = localStorage.getItem('glory_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setLocalAuthUser(userObj) {
  try {
    localStorage.setItem('glory_auth_user', JSON.stringify(userObj));
  } catch (e) {
    console.warn("Failed to set local auth user:", e);
  }
}

export function clearLocalAuthUser() {
  localStorage.removeItem('glory_auth_user');
}

export function requireRole(allowedRole) {
  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      // Fallback check on localStorage if Firebase Auth doesn't answer in 1s
      const localUser = getLocalAuthUser();
      if (localUser && (localUser.role === allowedRole || (allowedRole === 'customer' && !localUser.role))) {
        resolved = true;
        return resolve({ user: localUser, profile: localUser });
      } else if (localUser && localUser.role !== allowedRole) {
        resolved = true;
        alert(`Access denied. You are logged in as "${localUser.role}", but this page requires "${allowedRole}". Please switch account.`);
        window.location.href = '../auth/login.html';
        return;
      }
      resolved = true;
      window.location.href = '../auth/login.html';
    }, 1200);

    onAuthStateChanged(auth, async (user) => {
      if (resolved) return;

      if (!user) {
        const localUser = getLocalAuthUser();
        if (localUser && (localUser.role === allowedRole || (allowedRole === 'customer' && !localUser.role))) {
          clearTimeout(timeout);
          resolved = true;
          return resolve({ user: localUser, profile: localUser });
        }
        clearTimeout(timeout);
        resolved = true;
        window.location.href = '../auth/login.html';
        return;
      }

      // Check Firestore profile
      let profile = null;
      try {
        profile = await getUserProfile(user.uid);
      } catch (err) {
        console.warn("Failed to fetch firestore profile:", err);
      }

      const email = user.email || '';
      let role = profile?.role;

      // Smart role inference if profile is missing
      if (!role) {
        if (email.includes('admin') || email === 'admin@glorymomo.com') role = 'admin';
        else if (email.includes('delivery') || email === 'delivery@glorymomo.com') role = 'delivery';
        else role = 'customer';

        profile = {
          role,
          name: user.displayName || email.split('@')[0] || 'User',
          email: email
        };

        try {
          await createUserProfile(user.uid, profile);
        } catch(e) {
          console.warn("Could not sync profile to firestore:", e);
        }
      }

      // Store in local storage as synced session
      const userPayload = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || profile?.name || email.split('@')[0],
        role: role
      };
      setLocalAuthUser(userPayload);

      clearTimeout(timeout);
      resolved = true;

      if (role !== allowedRole) {
        alert(`Access denied. You are logged in as "${role}", but this page requires "${allowedRole}". Please switch account.`);
        window.location.href = '../auth/login.html';
        return;
      }

      resolve({ user: userPayload, profile: profile || userPayload });
    });
  });
}

