# Glory Momo Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 6 CRITICAL and 15 HIGH issues from the verification report by introducing server-side enforcement (Cloud Functions + custom claims), an honest outbox-based sync story, phone-OTP auth, geocoded delivery addresses, and an i18n-parity-enforced UI — without breaking the procedural audio/canvas alchemy that defines the brand.

**Architecture:** Client keeps its 4-portal Vite SPA shape. Firebase side gains a `functions/` package (Node 20, 2nd-gen, region `asia-south1`) that owns all writes touching money, status, role, and audit. Firestore and RTDB rules are tightened so the client can read freely within scope but cannot write anything that's not pure UI state. A new `shared/outbox.js` queues every write in IndexedDB with a visible status, so a flaky network never produces a false success state. Custom claims (`role: customer | delivery | admin`) are the only source of authorization; email-string inference and localStorage role are removed. The 1370-line `script.js` is split into focused modules.

**Tech Stack:** Vite 5, Firebase 10 (Auth + Firestore + RTDB + Functions + App Check + Crashlytics), Leaflet 1.9, Nominatim (free, 1 req/s), Vitest 1, Firebase Emulator Suite 13, `idb` for IndexedDB, `libphonenumber-js` for E.164 normalization, `firebase-functions` 5 (Node 20).

**Spec:** `docs/superpowers/specs/2026-09-02-glory-momo-hardening-design.md`

---

## Global Constraints

These are project-wide requirements that every task implicitly inherits. Copied verbatim from the spec.

- **Node version:** Node 20 LTS. Older Node versions are unsupported by `firebase-functions` v5.
- **Region:** `asia-south1` for all Cloud Functions. RTDB and Firestore are `global` by default; the emulator uses `localhost`.
- **Project ID:** `glory-momo` (matches `firebase-config.js`).
- **Custom claims shape:** `{ role: 'customer' | 'delivery' | 'admin', phone?: string }`. Every rule check uses `request.auth.token.role` — never `getUserData().role` and never email substring.
- **Outbox DB name:** `glory_outbox` (object store `outbox` keyed by `intent+orderId+ts`).
- **i18n parity rule:** every key in `en` must exist in `hi` and `bn`. Enforced by `tests/i18n-parity.test.js`.
- **Status state machine:** the only legal transitions are `awaiting_verification → accepted`, `accepted → out_for_delivery`, `out_for_delivery → delivered`, plus `awaiting_verification | accepted → cancelled`. Anything else is rejected.
- **Commit cadence:** every task ends with a commit. Use Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- **No client-side money writes.** Every doc that contains `total`, `discount`, `paymentStatus`, `status` (on `orders`), or `role` (on `users`) is written by a Cloud Function only. The client may read; the client may not write.
- **App Check:** required in production; the test key `6LfA6gYqAAAAAOPSd-...` (placeholder — replace at deploy) is used in `import.meta.env.DEV`.

---

## File Structure

This plan creates and modifies the following files. Listed in dependency order so later tasks can rely on earlier ones.

### New files

```
functions/
  package.json
  index.js                          # all callable + auth triggers
  lib/
    pricing.js                      # computeSubtotal, computeDelivery, computeTotal
    coupons.js                      # validateCoupon, redeemCoupon
    state-machine.js                # legalTransitions
    audit.js                        # appendEvent
    geocode.js                      # haversine
    errors.js                       # error code -> message map
  test/
    pricing.test.js
    coupons.test.js
    state-machine.test.js

shared/
  outbox.js                         # IndexedDB queue with replay + subscribe
  auth-claims.js                    # read/write custom claims
  geocoder.js                       # Nominatim client + pin-drop helper
  state-machine.js                  # client mirror of the legal transitions
  sound-cues.js                     # re-export of audio-synth with opt-in
  i18n-keys.js                      # every missing key added here (en/hi/bn)

cart/
  cart.js                           # cart, slip persistence, checkout entry
  coupons.js                        # coupon table + UI; validation is server-side
  menu.js                           # reads menu/ collection, falls back to hardcoded

customer/
  profile.js                        # order history, live order pill, profile drawer
  community.js                      # public reviews wall

tests/
  i18n-parity.test.js
  outbox.test.js
  state-machine.test.js
  rules.test.js                     # @firebase/rules-unit-testing
  integration.test.js               # createOrder end-to-end against emulator

scripts/
  seed-catalog.js                   # calls recomputeCatalog
  wipe-demo-data.js                 # admin callable

docs/
  superpowers/
    specs/2026-09-02-glory-momo-hardening-design.md   # already written
    plans/2026-09-02-glory-momo-hardening.md          # this file
```

### Modified files

```
package.json                        # scripts, deps, devDeps
vite.config.js                      # new entry points, test config
firebase.json                       # per-portal rewrites, apphosting
firestore.rules                     # full rewrite
database.rules.json                 # full rewrite
firebase-config.js                  # App Check + Crashlytics init
shared/firestore.js                 # strip all write helpers; read-only + outbox enqueue
shared/auth-guard.js                # role from custom claims; no email inference
shared/i18n.js                      # re-export from i18n-keys.js (no behaviour change)
shared/audio-synth.js               # add isAudioEnabled() default true; close on pagehide
shared/canvas-fx.js                 # pause on visibilitychange + intersection
shared/routing.js                   # remove hardcoded fallback; accept coords as args
auth/login.js                       # phone OTP primary; email only for admin bootstrap
pay.js                              # outbox enqueue; function call; no false success
admin/admin.js                      # state machine; function calls; events timeline
delivery/delivery.js                # assignDelivery via function; locations/{uid} only
customer/customer.js                # single-order sub; teardown on delivered
script.js                           # DELETED after the modules above are wired in
index.html                          # data-i18n coverage; outbox banner slot
admin/index.html                    # data-i18n coverage
customer/index.html                 # data-i18n coverage
delivery/index.html                 # data-i18n coverage
auth/login.html                     # data-i18n coverage
README.md                           # honest rewrite (Task 32)
```

### Decomposition rationale

- `cart/*` and `customer/*` are separated by responsibility, not by technical layer. Cart is "what the customer is about to order." Customer is "what the customer has ordered and is doing." They share an outbox dependency but otherwise have nothing in common.
- `shared/state-machine.js` exists on the client *and* `functions/lib/state-machine.js` exists on the server. They are kept identical by a test in `tests/state-machine.test.js` that imports both. This is the only intentional duplication.
- `script.js` is deleted, not split-in-place, because a 1370-line file is not safe to edit incrementally. New code goes into the new modules; the old file is removed at the end of Phase 7.
- `shared/firestore.js` is reduced to read-only exports + outbox enqueue. All `createOrder`, `updateOrderStatus`, `assignDelivery`, `submitOrderReview` functions are deleted; the client calls the Cloud Function equivalents.

---

## Phase 0 — Foundations

These tasks set up the test harness, the emulator, the Cloud Functions package, and the i18n parity test that the rest of the plan relies on. They produce no user-visible change but everything downstream assumes they are green.

---

### Task 1: Add Vitest, Firebase Emulator, and a single smoke test

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` script that runs `vitest run` and exits non-zero on failure.

- [ ] **Step 1: Install dev dependencies**

Run: `cd glory-momo && npm install --save-dev vitest@^1.6.0 @vitest/coverage-v8@^1.6.0 jsdom@^24.0.0`

Expected: `package.json` `devDependencies` now contains `vitest`, `@vitest/coverage-v8`, `jsdom`. `package-lock.json` updated.

- [ ] **Step 2: Add test scripts to `package.json`**

Modify `package.json` `scripts` block (lines 6-10). Add the following entries, preserving the existing `dev` / `build` / `preview` keys:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:emulator": "firebase emulators:exec --only firestore,database,auth 'vitest run tests/integration.test.js tests/rules.test.js'",
    "emulators": "firebase emulators:start --only firestore,database,auth,functions",
    "deploy:rules": "firebase deploy --only firestore:rules,database",
    "deploy:functions": "firebase deploy --only functions",
    "deploy:hosting": "firebase deploy --only hosting",
    "deploy": "firebase deploy"
  }
}
```

- [ ] **Step 3: Add a `test` block to `vite.config.js`**

Modify `vite.config.js`. Add the `test` key (Vitest reads it) without removing the existing `defineConfig` call or the `rollupOptions.input` block. Append after the closing `})` of `defineConfig` is not valid; instead, merge:

```js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        customer: resolve(__dirname, 'customer/index.html'),
        delivery: resolve(__dirname, 'delivery/index.html'),
        login: resolve(__dirname, 'auth/login.html')
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js', 'functions/test/**/*.test.js', 'cart/**/*.test.js', 'customer/**/*.test.js', 'shared/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'tests/integration.test.js', 'tests/rules.test.js']
  }
});
```

- [ ] **Step 4: Create the smoke test**

Create `tests/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd glory-momo && npm test`
Expected: PASS — `1 passed`.

- [ ] **Step 6: Commit**

```bash
cd glory-momo
git add package.json package-lock.json vite.config.js tests/smoke.test.js
git commit -m "chore: add vitest, jsdom, and a smoke test"
```

---

### Task 2: Add Firebase Emulator configuration

**Files:**
- Create: `firebase.json` (modify existing, see Step 1)
- Create: `.firebaserc`
- Create: `firestore.indexes.json`

**Interfaces:**
- Produces: `npm run emulators` starts a local Auth + Firestore + RTDB + Functions emulator on standard ports.

- [ ] **Step 1: Add `emulators` block to `firebase.json`**

The existing `firebase.json` has `hosting`, `firestore`, `database` blocks. Append the `emulators` block before the closing `}`:

```json
{
  "hosting": { ... existing ... },
  "firestore": { ... existing ... },
  "database": { ... existing ... },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "emulators": {
    "auth":      { "port": 9099 },
    "firestore": { "port": 8080 },
    "database":  { "port": 9000 },
    "functions": { "port": 5001 },
    "hosting":   { "port": 5000 },
    "ui":        { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 2: Create `.firebaserc`**

Create `.firebaserc` with:

```json
{
  "projects": {
    "default": "glory-momo"
  }
}
```

- [ ] **Step 3: Create `firestore.indexes.json`**

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "customerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignedDeliveryId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "coupon_redemptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "code", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "coupon_redemptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "code", "order": "ASCENDING" },
        { "fieldPath": "redeemedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 4: Verify `firebase` CLI is installed**

Run: `npx firebase --version`
Expected: prints a version `13.x` or higher. If not, run `npm install --save-dev firebase-tools@^13.0.0`.

- [ ] **Step 5: Commit**

```bash
cd glory-momo
git add firebase.json .firebaserc firestore.indexes.json
git commit -m "chore: configure Firebase emulators and composite indexes"
```

---

### Task 3: Add i18n parity test and the missing keys

**Files:**
- Modify: `shared/i18n.js`
- Create: `tests/i18n-parity.test.js`
- Create: `shared/i18n-keys.js`

**Interfaces:**
- Produces: `shared/i18n-keys.js` exports `{ en, hi, bn }` with the full key set used in the UI.

- [ ] **Step 1: Create the new i18n-keys file with the gaps closed**

Create `shared/i18n-keys.js`:

```js
// The complete dictionary. Every key used in any data-i18n attribute must appear here
// in all three languages. The parity test in tests/i18n-parity.test.js enforces this.

export const en = {
  // Cart
  'cart.title': 'Your Momo Slip',
  'cart.empty': 'Your slip is empty. Add some momos!',
  'cart.subtotal': 'Subtotal',
  'cart.deliveryFee': 'Delivery fee',
  'cart.discount': 'Discount',
  'cart.total': 'Total',
  'cart.placeOrder': 'Place Order',
  'cart.placing': 'Placing your order…',
  'cart.cod': 'Cash on Delivery',
  'cart.upi': 'UPI / Manual Pay',
  'cart.minOrder': 'Minimum order is ₹199.',
  'cart.coupon.placeholder': 'Coupon code',
  'cart.coupon.apply': 'Apply',
  'cart.coupon.applied': 'Coupon applied',
  'cart.coupon.invalid': 'Invalid or already-used coupon',
  'cart.address.placeholder': 'Delivery address',
  'cart.address.pin': 'Drop a pin on the map',
  'cart.address.geocoding': 'Looking up your address…',
  'cart.address.notFound': 'Could not find that address. Please try again or drop a pin.',

  // Outbox / sync
  'sync.pending': 'Order pending sync',
  'sync.syncing': 'Syncing…',
  'sync.synced': 'Synced',
  'sync.failed': 'Could not reach the kitchen. Tap to retry.',
  'sync.retry': 'Retry',

  // Payment
  'pay.upi.scan': 'Scan this QR with any UPI app',
  'pay.upi.confirm': 'I have paid',
  'pay.upi.confirming': 'Confirming…',
  'pay.upi.amount': 'Amount',
  'pay.upi.payee': 'Pay to',
  'pay.cod.note': 'Pay cash when your momos arrive.',
  'pay.celebrate.title': 'Order placed!',
  'pay.celebrate.subtitle': 'The kitchen has been notified. Watch your order live on the tracker.',

  // Status (state machine)
  'status.awaiting_verification': 'Awaiting verification',
  'status.accepted': 'Preparing',
  'status.out_for_delivery': 'On the way',
  'status.delivered': 'Delivered',
  'status.cancelled': 'Cancelled',

  // Customer tracker
  'tracker.title': 'Your order',
  'tracker.liveMap': 'Live map',
  'tracker.timeline': 'Timeline',
  'tracker.rate.title': 'How was your order?',
  'tracker.rate.food': 'Food',
  'tracker.rate.delivery': 'Delivery',
  'tracker.rate.comment': 'Leave a comment (optional)',
  'tracker.rate.submit': 'Submit rating',
  'tracker.rate.thanks': 'Thanks for your feedback!',

  // Admin
  'admin.title': 'Kitchen Console',
  'admin.filter.all': 'All',
  'admin.filter.pending': 'Pending',
  'admin.filter.preparing': 'Preparing',
  'admin.filter.delivering': 'Delivering',
  'admin.filter.delivered': 'Delivered',
  'admin.action.accept': 'Accept',
  'admin.action.send': 'Send with courier',
  'admin.action.markPaid': 'Confirm payment',
  'admin.action.cancel': 'Cancel',
  'admin.kpi.revenue': 'Today’s revenue',
  'admin.kpi.orders': 'Orders',
  'admin.kpi.pending': 'Pending',
  'admin.kpi.avg': 'Avg ticket',

  // Delivery
  'delivery.title': 'Delivery Dashboard',
  'delivery.pickup': 'Pickup & start',
  'delivery.delivered': 'Mark delivered',
  'delivery.empty': 'No active orders',

  // Auth
  'auth.title': 'Welcome to Glory Momo',
  'auth.phone.label': 'Phone number',
  'auth.phone.send': 'Send code',
  'auth.otp.label': '6-digit code',
  'auth.otp.verify': 'Verify',
  'auth.switch.admin': 'I am the kitchen',
  'auth.switch.delivery': 'I am a rider',
  'auth.switch.customer': 'I am a customer',
  'auth.demo.banner': 'Demo mode: anyone registering as the first user becomes the admin.',

  // Generic
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.retry': 'Retry',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong'
};

export const hi = {
  'cart.title': 'आपकी मोमो पर्ची',
  'cart.empty': 'पर्ची खाली है। कुछ मोमो जोड़ें!',
  'cart.subtotal': 'उप-योग',
  'cart.deliveryFee': 'डिलीवरी शुल्क',
  'cart.discount': 'छूट',
  'cart.total': 'कुल',
  'cart.placeOrder': 'ऑर्डर करें',
  'cart.placing': 'ऑर्डर भेजा जा रहा है…',
  'cart.cod': 'कैश ऑन डिलीवरी',
  'cart.upi': 'UPI / मैन्युअल पेमेंट',
  'cart.minOrder': 'न्यूनतम ऑर्डर ₹199 है।',
  'cart.coupon.placeholder': 'कूपन कोड',
  'cart.coupon.apply': 'लागू करें',
  'cart.coupon.applied': 'कूपन लागू',
  'cart.coupon.invalid': 'अमान्य या पहले से उपयोग किया हुआ कूपन',
  'cart.address.placeholder': 'डिलीवरी पता',
  'cart.address.pin': 'मानचित्र पर पिन डालें',
  'cart.address.geocoding': 'आपका पता खोजा जा रहा है…',
  'cart.address.notFound': 'पता नहीं मिला। कृपया फिर से प्रयास करें या पिन डालें।',

  'sync.pending': 'ऑर्डर सिंक के लिए लंबित',
  'sync.syncing': 'सिंक हो रहा है…',
  'sync.synced': 'सिंक हो गया',
  'sync.failed': 'रसोई तक नहीं पहुंचा। पुनः प्रयास के लिए टैप करें।',
  'sync.retry': 'पुनः प्रयास',

  'pay.upi.scan': 'किसी भी UPI ऐप से इस QR को स्कैन करें',
  'pay.upi.confirm': 'मैंने भुगतान कर दिया',
  'pay.upi.confirming': 'पुष्टि हो रही है…',
  'pay.upi.amount': 'राशि',
  'pay.upi.payee': 'को भुगतान',
  'pay.cod.note': 'मोमो आने पर नकद भुगतान करें।',
  'pay.celebrate.title': 'ऑर्डर सफल!',
  'pay.celebrate.subtitle': 'रसोई को सूचित कर दिया गया है। ट्रैकर पर लाइव देखें।',

  'status.awaiting_verification': 'सत्यापन लंबित',
  'status.accepted': 'तैयार हो रहा है',
  'status.out_for_delivery': 'रास्ते में',
  'status.delivered': 'वितरित',
  'status.cancelled': 'रद्द',

  'tracker.title': 'आपका ऑर्डर',
  'tracker.liveMap': 'लाइव मानचित्र',
  'tracker.timeline': 'टाइमलाइन',
  'tracker.rate.title': 'ऑर्डर कैसा रहा?',
  'tracker.rate.food': 'खाना',
  'tracker.rate.delivery': 'डिलीवरी',
  'tracker.rate.comment': 'टिप्पणी (वैकल्पिक)',
  'tracker.rate.submit': 'रेटिंग भेजें',
  'tracker.rate.thanks': 'आपकी प्रतिक्रिया के लिए धन्यवाद!',

  'admin.title': 'रसोई कंसोल',
  'admin.filter.all': 'सभी',
  'admin.filter.pending': 'लंबित',
  'admin.filter.preparing': 'तैयार हो रहा',
  'admin.filter.delivering': 'डिलीवरी पर',
  'admin.filter.delivered': 'वितरित',
  'admin.action.accept': 'स्वीकार करें',
  'admin.action.send': 'कूरियर के साथ भेजें',
  'admin.action.markPaid': 'भुगतान पुष्टि',
  'admin.action.cancel': 'रद्द करें',
  'admin.kpi.revenue': 'आज की आय',
  'admin.kpi.orders': 'ऑर्डर',
  'admin.kpi.pending': 'लंबित',
  'admin.kpi.avg': 'औसत टिकट',

  'delivery.title': 'डिलीवरी डैशबोर्ड',
  'delivery.pickup': 'पिकअप और शुरू',
  'delivery.delivered': 'वितरित चिह्नित करें',
  'delivery.empty': 'कोई सक्रिय ऑर्डर नहीं',

  'auth.title': 'ग्लोरी मोमो में आपका स्वागत है',
  'auth.phone.label': 'फ़ोन नंबर',
  'auth.phone.send': 'कोड भेजें',
  'auth.otp.label': '6-अंकीय कोड',
  'auth.otp.verify': 'सत्यापित करें',
  'auth.switch.admin': 'मैं रसोई हूँ',
  'auth.switch.delivery': 'मैं राइडर हूँ',
  'auth.switch.customer': 'मैं ग्राहक हूँ',
  'auth.demo.banner': 'डेमो मोड: पहला पंजीकरण करने वाला व्यक्ति एडमिन बन जाता है।',

  'common.cancel': 'रद्द करें',
  'common.close': 'बंद करें',
  'common.retry': 'पुनः प्रयास',
  'common.loading': 'लोड हो रहा है…',
  'common.error': 'कुछ गलत हो गया'
};

export const bn = {
  'cart.title': 'আপনার মোমো স্লিপ',
  'cart.empty': 'স্লিপ খালি। কিছু মোমো যোগ করুন!',
  'cart.subtotal': 'সাবটোটাল',
  'cart.deliveryFee': 'ডেলিভারি ফি',
  'cart.discount': 'ছাড়',
  'cart.total': 'মোট',
  'cart.placeOrder': 'অর্ডার করুন',
  'cart.placing': 'অর্ডার পাঠানো হচ্ছে…',
  'cart.cod': 'ক্যাশ অন ডেলিভারি',
  'cart.upi': 'UPI / ম্যানুয়াল পেমেন্ট',
  'cart.minOrder': 'সর্বনিম্ন অর্ডার ₹১৯৯।',
  'cart.coupon.placeholder': 'কুপন কোড',
  'cart.coupon.apply': 'প্রয়োগ করুন',
  'cart.coupon.applied': 'কুপন প্রয়োগ হয়েছে',
  'cart.coupon.invalid': 'অবৈধ বা ইতিমধ্যে ব্যবহৃত কুপন',
  'cart.address.placeholder': 'ডেলিভারি ঠিকানা',
  'cart.address.pin': 'মানচিত্রে পিন রাখুন',
  'cart.address.geocoding': 'আপনার ঠিকানা খোঁজা হচ্ছে…',
  'cart.address.notFound': 'ঠিকানা পাওয়া যায়নি। আবার চেষ্টা করুন অথবা পিন রাখুন।',

  'sync.pending': 'অর্ডার সিঙ্কের জন্য অপেক্ষমাণ',
  'sync.syncing': 'সিঙ্ক হচ্ছে…',
  'sync.synced': 'সিঙ্ক হয়েছে',
  'sync.failed': 'রান্নাঘরে পৌঁছানো যায়নি। পুনরায় চেষ্টা করতে ট্যাপ করুন।',
  'sync.retry': 'পুনরায় চেষ্টা',

  'pay.upi.scan': 'যেকোনো UPI অ্যাপ দিয়ে এই QR স্ক্যান করুন',
  'pay.upi.confirm': 'আমি পেমেন্ট করেছি',
  'pay.upi.confirming': 'নিশ্চিত হচ্ছে…',
  'pay.upi.amount': 'পরিমাণ',
  'pay.upi.payee': 'প্রাপক',
  'pay.cod.note': 'মোমো আসলে নগদ পেমেন্ট করুন।',
  'pay.celebrate.title': 'অর্ডার সফল!',
  'pay.celebrate.subtitle': 'রান্নাঘরকে জানানো হয়েছে। ট্র্যাকারে লাইভ দেখুন।',

  'status.awaiting_verification': 'যাচাইয়ের অপেক্ষায়',
  'status.accepted': 'প্রস্তুত হচ্ছে',
  'status.out_for_delivery': 'পথে',
  'status.delivered': 'পৌঁছেছে',
  'status.cancelled': 'বাতিল',

  'tracker.title': 'আপনার অর্ডার',
  'tracker.liveMap': 'লাইভ মানচিত্র',
  'tracker.timeline': 'টাইমলাইন',
  'tracker.rate.title': 'অর্ডার কেমন ছিল?',
  'tracker.rate.food': 'খাবার',
  'tracker.rate.delivery': 'ডেলিভারি',
  'tracker.rate.comment': 'মন্তব্য (ঐচ্ছিক)',
  'tracker.rate.submit': 'রেটিং পাঠান',
  'tracker.rate.thanks': 'আপনার মতামতের জন্য ধন্যবাদ!',

  'admin.title': 'রান্নাঘর কনসোল',
  'admin.filter.all': 'সব',
  'admin.filter.pending': 'অপেক্ষমাণ',
  'admin.filter.preparing': 'প্রস্তুত হচ্ছে',
  'admin.filter.delivering': 'ডেলিভারিতে',
  'admin.filter.delivered': 'পৌঁছেছে',
  'admin.action.accept': 'গ্রহণ',
  'admin.action.send': 'কুরিয়ারে পাঠান',
  'admin.action.markPaid': 'পেমেন্ট নিশ্চিত',
  'admin.action.cancel': 'বাতিল',
  'admin.kpi.revenue': 'আজকের আয়',
  'admin.kpi.orders': 'অর্ডার',
  'admin.kpi.pending': 'অপেক্ষমাণ',
  'admin.kpi.avg': 'গড় টিকিট',

  'delivery.title': 'ডেলিভারি ড্যাশবোর্ড',
  'delivery.pickup': 'পিকআপ ও শুরু',
  'delivery.delivered': 'পৌঁছেছে চিহ্নিত করুন',
  'delivery.empty': 'কোনো সক্রিয় অর্ডার নেই',

  'auth.title': 'গ্লোরি মোমোতে স্বাগতম',
  'auth.phone.label': 'ফোন নম্বর',
  'auth.phone.send': 'কোড পাঠান',
  'auth.otp.label': '৬-সংখ্যার কোড',
  'auth.otp.verify': 'যাচাই করুন',
  'auth.switch.admin': 'আমি রান্নাঘর',
  'auth.switch.delivery': 'আমি রাইডার',
  'auth.switch.customer': 'আমি গ্রাহক',
  'auth.demo.banner': 'ডেমো মোড: প্রথম যিনি নিবন্ধন করবেন তিনি অ্যাডমিন হবেন।',

  'common.cancel': 'বাতিল',
  'common.close': 'বন্ধ করুন',
  'common.retry': 'পুনরায় চেষ্টা',
  'common.loading': 'লোড হচ্ছে…',
  'common.error': 'কিছু ভুল হয়েছে'
};
```

- [ ] **Step 2: Modify `shared/i18n.js` to re-export from `i18n-keys.js`**

Replace the entire contents of `shared/i18n.js` with:

```js
// Re-export of the dictionary plus the t() helper.
// The actual keys live in shared/i18n-keys.js so they can be unit-tested
// independently of this module.
import { en, hi, bn } from './i18n-keys.js';

export const dictionaries = { en, hi, bn };

let currentLang = 'en';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang in dictionaries) currentLang = lang;
}

export function t(key, fallback) {
  const dict = dictionaries[currentLang] || dictionaries.en;
  return dict[key] ?? fallback ?? key;
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key, el.textContent);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const spec = el.getAttribute('data-i18n-attr');
    spec.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key, el.getAttribute(attr)));
    });
  });
}
```

- [ ] **Step 3: Create the parity test**

Create `tests/i18n-parity.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { en, hi, bn } from '../shared/i18n-keys.js';

describe('i18n parity', () => {
  it('every en key is present in hi and bn', () => {
    const enKeys = Object.keys(en);
    const hiKeys = new Set(Object.keys(hi));
    const bnKeys = new Set(Object.keys(bn));
    for (const k of enKeys) {
      expect(hiKeys.has(k), `hi is missing key ${k}`).toBe(true);
      expect(bnKeys.has(k), `bn is missing key ${k}`).toBe(true);
    }
  });
  it('hi has no keys that en does not have', () => {
    const enKeys = new Set(Object.keys(en));
    for (const k of Object.keys(hi)) {
      expect(enKeys.has(k), `hi has extra key ${k}`).toBe(true);
    }
  });
  it('bn has no keys that en does not have', () => {
    const enKeys = new Set(Object.keys(en));
    for (const k of Object.keys(bn)) {
      expect(enKeys.has(k), `bn has extra key ${k}`).toBe(true);
    }
  });
  it('no value is empty or whitespace-only', () => {
    for (const [lang, dict] of Object.entries({ en, hi, bn })) {
      for (const [k, v] of Object.entries(dict)) {
        expect(v && v.trim().length > 0, `${lang}.${k} is empty`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 4: Run the test**

Run: `cd glory-momo && npm test`
Expected: all parity tests PASS, plus the smoke test from Task 1. Total 4+ passing.

- [ ] **Step 5: Commit**

```bash
cd glory-momo
git add shared/i18n.js shared/i18n-keys.js tests/i18n-parity.test.js
git commit -m "feat(i18n): full en/hi/bn dictionary with parity test"
```

---

## Phase 1 — Server-side pricing and state machine

These tasks build the Cloud Functions package, the state machine, the pricing math, and the unit tests that lock them in. The client is untouched. At the end of this phase, the functions can be deployed to the emulator and called from a test script, but no client wires them up yet.

---

### Task 4: Bootstrap the `functions/` package

**Files:**
- Create: `functions/package.json`
- Create: `functions/index.js` (placeholder)
- Create: `functions/.gitignore`

**Interfaces:**
- Produces: a `functions/` directory that can be built with `npm --prefix functions run build` and that exposes an empty handler. The Firebase emulator will pick it up via the `functions` block in `firebase.json` (already in Task 2).

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "glory-momo-functions",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": "20" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc -p .",
    "serve": "tsc -p . --watch",
    "test": "vitest run",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^5.1.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "test"]
}
```

- [ ] **Step 3: Create `functions/.gitignore`**

```
node_modules
lib
.firebase
*.log
```

- [ ] **Step 4: Create `functions/src/index.ts` (placeholder)**

```ts
// Handlers are added in subsequent tasks. This file is the entry point that
// Firebase Functions looks for at functions/lib/index.js after tsc runs.
import { setGlobalOptions } from 'firebase-functions/v2';
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

export const _placeholder = true;
```

- [ ] **Step 5: Install**

Run: `cd glory-momo/functions && npm install`
Expected: `functions/node_modules/` contains `firebase-admin`, `firebase-functions`, `typescript`, `vitest`.

- [ ] **Step 6: Commit**

```bash
cd glory-momo
git add functions/package.json functions/tsconfig.json functions/.gitignore
git commit -m "chore(functions): bootstrap Cloud Functions package"
```

---

### Task 5: Implement the state machine (TDD)

**Files:**
- Create: `functions/src/lib/state-machine.ts`
- Create: `functions/test/state-machine.test.ts`
- Create: `shared/state-machine.js`

**Interfaces:**
- Produces: `isLegalTransition(from, to): boolean` exported from both `functions/src/lib/state-machine.ts` and `shared/state-machine.js`. The two are kept identical by a shared test in `tests/state-machine.test.js` (Task 6).

- [ ] **Step 1: Write the failing test in `functions/test/state-machine.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isLegalTransition, LEGAL_STATUSES } from '../src/lib/state-machine.js';

describe('state-machine', () => {
  it('exposes the 5 legal statuses', () => {
    expect(LEGAL_STATUSES).toEqual([
      'awaiting_verification',
      'accepted',
      'out_for_delivery',
      'delivered',
      'cancelled'
    ]);
  });

  it('allows awaiting_verification -> accepted', () => {
    expect(isLegalTransition('awaiting_verification', 'accepted')).toBe(true);
  });

  it('allows accepted -> out_for_delivery', () => {
    expect(isLegalTransition('accepted', 'out_for_delivery')).toBe(true);
  });

  it('allows out_for_delivery -> delivered', () => {
    expect(isLegalTransition('out_for_delivery', 'delivered')).toBe(true);
  });

  it('allows awaiting_verification -> cancelled', () => {
    expect(isLegalTransition('awaiting_verification', 'cancelled')).toBe(true);
  });

  it('allows accepted -> cancelled', () => {
    expect(isLegalTransition('accepted', 'cancelled')).toBe(true);
  });

  it('rejects awaiting_verification -> out_for_delivery (skipping accepted)', () => {
    expect(isLegalTransition('awaiting_verification', 'out_for_delivery')).toBe(false);
  });

  it('rejects awaiting_verification -> delivered', () => {
    expect(isLegalTransition('awaiting_verification', 'delivered')).toBe(false);
  });

  it('rejects delivered -> accepted (no going back)', () => {
    expect(isLegalTransition('delivered', 'accepted')).toBe(false);
  });

  it('rejects out_for_delivery -> accepted (no going back)', () => {
    expect(isLegalTransition('out_for_delivery', 'accepted')).toBe(false);
  });

  it('rejects any -> awaiting_verification', () => {
    for (const from of LEGAL_STATUSES) {
      expect(isLegalTransition(from, 'awaiting_verification')).toBe(false);
    }
  });

  it('rejects self-transitions', () => {
    for (const s of LEGAL_STATUSES) {
      expect(isLegalTransition(s, s)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd glory-momo/functions && npx vitest run test/state-machine.test.ts`
Expected: FAIL — "Cannot find module ../src/lib/state-machine.js".

- [ ] **Step 3: Implement `functions/src/lib/state-machine.ts`**

```ts
export const LEGAL_STATUSES = [
  'awaiting_verification',
  'accepted',
  'out_for_delivery',
  'delivered',
  'cancelled'
] as const;

export type OrderStatus = (typeof LEGAL_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  awaiting_verification: ['accepted', 'cancelled'],
  accepted: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: []
};

export function isLegalTransition(from: string, to: string): boolean {
  if (!LEGAL_STATUSES.includes(from as OrderStatus)) return false;
  if (!LEGAL_STATUSES.includes(to as OrderStatus)) return false;
  if (from === to) return false;
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to as OrderStatus);
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd glory-momo/functions && npx vitest run test/state-machine.test.ts`
Expected: all 11 tests PASS.

- [ ] **Step 5: Mirror the implementation in `shared/state-machine.js`**

Create `shared/state-machine.js` with the same logic. This file is consumed by the client (admin UI, delivery UI) to disable illegal options before the user even tries to select them:

```js
// Client mirror of functions/src/lib/state-machine.ts.
// Kept identical by tests/state-machine.test.js (Task 6).

export const LEGAL_STATUSES = [
  'awaiting_verification',
  'accepted',
  'out_for_delivery',
  'delivered',
  'cancelled'
];

const TRANSITIONS = {
  awaiting_verification: ['accepted', 'cancelled'],
  accepted: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: []
};

export function isLegalTransition(from, to) {
  if (!LEGAL_STATUSES.includes(from)) return false;
  if (!LEGAL_STATUSES.includes(to)) return false;
  if (from === to) return false;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function legalNextStates(from) {
  return TRANSITIONS[from] ?? [];
}
```

- [ ] **Step 6: Commit**

```bash
cd glory-momo
git add functions/src/lib/state-machine.ts functions/test/state-machine.test.ts shared/state-machine.js
git commit -m "feat(state-machine): legal status transitions, server + client"
```

---

### Task 6: Add a cross-process parity test for the state machine

**Files:**
- Create: `tests/state-machine.test.js`

**Interfaces:**
- Produces: a Vitest test that imports the client `shared/state-machine.js` and asserts that its `LEGAL_STATUSES` and `isLegalTransition` are byte-identical to the server version's contract.

- [ ] **Step 1: Write the parity test**

Create `tests/state-machine.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  LEGAL_STATUSES as clientStatuses,
  isLegalTransition as clientIsLegal
} from '../shared/state-machine.js';
import {
  LEGAL_STATUSES as serverStatuses,
  isLegalTransition as serverIsLegal
} from '../functions/src/lib/state-machine.js';

describe('state-machine parity (client <-> server)', () => {
  it('LEGAL_STATUSES are identical', () => {
    expect(clientStatuses).toEqual(serverStatuses);
  });

  it('isLegalTransition agrees on every (from, to) pair', () => {
    for (const from of clientStatuses) {
      for (const to of clientStatuses) {
        expect(clientIsLegal(from, to), `client disagrees on ${from}->${to}`).toBe(
          serverIsLegal(from, to)
        );
      }
    }
  });

  it('all 9 legal transitions are legal in both', () => {
    const legalPairs = [
      ['awaiting_verification', 'accepted'],
      ['awaiting_verification', 'cancelled'],
      ['accepted', 'out_for_delivery'],
      ['accepted', 'cancelled'],
      ['out_for_delivery', 'delivered']
    ];
    for (const [from, to] of legalPairs) {
      expect(clientIsLegal(from, to)).toBe(true);
      expect(serverIsLegal(from, to)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd glory-momo && npm test`
Expected: the new parity test PASSES alongside the i18n parity and smoke tests.

- [ ] **Step 3: Commit**

```bash
cd glory-momo
git add tests/state-machine.test.js
git commit -m "test(state-machine): client and server parity"
```

---

### Task 7: Implement pricing (TDD)

**Files:**
- Create: `functions/src/lib/pricing.ts`
- Create: `functions/test/pricing.test.ts`

**Interfaces:**
- Produces: `computeSubtotal(items, menu)`, `computeDelivery(distanceKm)`, `computeTotal(subtotal, discount, fee)`, `haversineKm(a, b)`. Pure functions, no side effects.

- [ ] **Step 1: Write the failing test in `functions/test/pricing.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeSubtotal, computeDelivery, computeTotal, haversineKm } from '../src/lib/pricing.js';

describe('pricing', () => {
  it('haversineKm is 0 for the same point', () => {
    expect(haversineKm({ lat: 22.6, lng: 88.4 }, { lat: 22.6, lng: 88.4 })).toBe(0);
  });

  it('haversineKm matches a known distance (Kolkata to Howrah ~5 km)', () => {
    const km = haversineKm(
      { lat: 22.5726, lng: 88.3639 },
      { lat: 22.5958, lng: 88.2636 }
    );
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(7);
  });

  it('computeSubtotal sums price * qty', () => {
    const menu = new Map([
      ['momo-1', { price: 130 }],
      ['momo-2', { price: 80 }]
    ]);
    expect(computeSubtotal([{ id: 'momo-1', q: 2 }, { id: 'momo-2', q: 1 }], menu)).toBe(340);
  });

  it('computeSubtotal throws on an unknown item id', () => {
    const menu = new Map([['momo-1', { price: 130 }]]);
    expect(() => computeSubtotal([{ id: 'momo-999', q: 1 }], menu)).toThrow(/unknown item/);
  });

  it('computeDelivery follows the distance ladder', () => {
    // 0-2 km: ₹10, 2-5 km: ₹30, 5-10 km: ₹50, >10 km: ₹80
    expect(computeDelivery(0.5)).toBe(10);
    expect(computeDelivery(2.0)).toBe(10);
    expect(computeDelivery(2.1)).toBe(30);
    expect(computeDelivery(5.0)).toBe(30);
    expect(computeDelivery(5.1)).toBe(50);
    expect(computeDelivery(10.0)).toBe(50);
    expect(computeDelivery(10.1)).toBe(80);
  });

  it('computeTotal = subtotal - discount + fee', () => {
    expect(computeTotal(340, 60, 10)).toBe(290);
    expect(computeTotal(200, 0, 30)).toBe(230);
  });

  it('computeTotal never goes negative', () => {
    expect(computeTotal(100, 200, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd glory-momo/functions && npx vitest run test/pricing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `functions/src/lib/pricing.ts`**

```ts
export interface LatLng { lat: number; lng: number; }
export interface CartItem { id: string; q: number; }
export interface MenuEntry { price: number; }

const EARTH_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(sa));
}

export function computeSubtotal(
  items: ReadonlyArray<CartItem>,
  menu: ReadonlyMap<string, MenuEntry>
): number {
  let s = 0;
  for (const it of items) {
    if (it.q <= 0) throw new Error(`invalid qty for ${it.id}`);
    const entry = menu.get(it.id);
    if (!entry) throw new Error(`unknown item ${it.id}`);
    s += entry.price * it.q;
  }
  return s;
}

export function computeDelivery(distanceKm: number): number {
  if (distanceKm <= 2) return 10;
  if (distanceKm <= 5) return 30;
  if (distanceKm <= 10) return 50;
  return 80;
}

export function computeTotal(subtotal: number, discount: number, fee: number): number {
  return Math.max(0, subtotal - discount + fee);
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `cd glory-momo/functions && npx vitest run test/pricing.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd glory-momo
git add functions/src/lib/pricing.ts functions/test/pricing.test.ts
git commit -m "feat(pricing): subtotal, delivery ladder, total"
```

---

### Task 8: Implement coupon validation (TDD)

**Files:**
- Create: `functions/src/lib/coupons.ts`
- Create: `functions/test/coupons.test.ts`

**Interfaces:**
- Produces: `validateCoupon(code, subtotal, existingRedemptions): { ok: true, discount: number } | { ok: false, reason: string }` and `computeDiscount(code, subtotal): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeDiscount, validateCoupon } from '../src/lib/coupons.js';

describe('coupons', () => {
  it('GLORY20 gives 20% off up to ₹100', () => {
    expect(computeDiscount('GLORY20', 200)).toBe(40);
    expect(computeDiscount('GLORY20', 600)).toBe(100);
    expect(computeDiscount('GLORY20', 50)).toBe(10);
  });

  it('FIRSTMOMO gives ₹50 off', () => {
    expect(computeDiscount('FIRSTMOMO', 200)).toBe(50);
    expect(computeDiscount('FIRSTMOMO', 30)).toBe(30);
  });

  it('unknown code gives 0', () => {
    expect(computeDiscount('NOPE', 200)).toBe(0);
  });

  it('case-insensitive lookup', () => {
    expect(computeDiscount('glory20', 200)).toBe(40);
  });

  it('validateCoupon rejects already-redeemed', () => {
    const result = validateCoupon('GLORY20', 200, ['GLORY20']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already/i);
  });

  it('validateCoupon accepts fresh code with discount', () => {
    const result = validateCoupon('GLORY20', 200, []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discount).toBe(40);
  });

  it('validateCoupon requires min subtotal of 199', () => {
    const result = validateCoupon('GLORY20', 100, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/minimum/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd glory-momo/functions && npx vitest run test/coupons.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `functions/src/lib/coupons.ts`**

```ts
const COUPONS: Record<string, { pct?: number; cap?: number; flat?: number; minSubtotal?: number }> = {
  GLORY20:   { pct: 0.20, cap: 100, minSubtotal: 199 },
  FIRSTMOMO: { flat: 50,  minSubtotal: 199 }
};

export function computeDiscount(code: string, subtotal: number): number {
  const c = COUPONS[code.toUpperCase()];
  if (!c) return 0;
  if (c.minSubtotal && subtotal < c.minSubtotal) return 0;
  let d = 0;
  if (typeof c.pct === 'number') d = Math.floor(subtotal * c.pct);
  if (typeof c.flat === 'number') d = c.flat;
  if (typeof c.cap === 'number') d = Math.min(d, c.cap);
  return Math.max(0, Math.min(d, subtotal));
}

export type ValidationResult =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

export function validateCoupon(
  code: string,
  subtotal: number,
  existingRedemptions: ReadonlyArray<string>
): ValidationResult {
  if (existingRedemptions.includes(code.toUpperCase())) {
    return { ok: false, reason: 'Coupon already used' };
  }
  if (subtotal < 199) {
    return { ok: false, reason: 'Minimum order is ₹199' };
  }
  const discount = computeDiscount(code, subtotal);
  if (discount <= 0) {
    return { ok: false, reason: 'Coupon is not valid' };
  }
  return { ok: true, discount };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `cd glory-momo/functions && npx vitest run test/coupons.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd glory-momo
git add functions/src/lib/coupons.ts functions/test/coupons.test.ts
git commit -m "feat(coupons): GLORY20 + FIRSTMOMO with redemption check"
```

---

