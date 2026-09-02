# Glory Momo — Production Hardening Design

**Date:** 2026-09-02
**Status:** Draft — pending user review
**Scope:** All 6 CRITICAL and 15 HIGH findings from the verification report, plus the structural MEDIUMs they require. The cosmetic LOWs (M8 dead modules, M9 morphicons, canvas RAF waste, etc.) are out of scope for this design — they'll be addressed in a separate polish pass.

---

## 1. Goals and non-goals

**Goals**

- Make the app safely demoable on a second device (cross-device realtime actually works when Firestore is online).
- Make the app safely demoable on a flaky network (no silent order loss; no false success states).
- Replace client-trusted enforcement (payment, pricing, coupon, role, delivery assignment) with server-side enforcement that the rules + Cloud Functions actually back.
- Ship a 1-page README that describes the product that exists, not the product we wish existed.

**Non-goals (this round)**

- Visual redesign or new features.
- Migration of the menu catalog to a Firestore-driven schema.
- Production merchant onboarding, KYC, or real Razorpay/Stripe integration.
- Internationalization beyond EN/HI/BN.
- The Remotion reel engine (it stays as a docs-only sibling; the README line is removed).

---

## 2. Architecture: client + Cloud Functions

The client keeps its 4-portal shape (storefront, customer tracker, kitchen admin, delivery partner). The Firebase side gains:

- **Firebase Auth** — phone OTP is the primary path; email/password is retained for admin bootstrap only. Each user gets Firebase custom claims (`role: 'customer' | 'delivery' | 'admin'`) set by a Cloud Function.
- **Firestore** — same `orders` / `users` collections. New: `coupon_redemptions/{redemptionId}` (immutable, server-set), `orders/{id}/events` (audit trail), and `outbox/{uid}/{orderId}` (the client's pending writes). The `reviews` collection gets a real rule.
- **Realtime Database** — `locations/{uid}` keeps the current shape but the read rule is tightened (only the assigned customer + admins).
- **Cloud Functions (2nd gen, Node 20, region `asia-south1`)** — new module `functions/`. Functions are the only place that writes the order total, the discount, the coupon state, and the audit trail. Functions are also the only place that calls the Razorpay (or manual UPI confirmation) verification, sets custom claims, and toggles `deliveryId`.
- **App Check (reCAPTCHA Enterprise)** — enabled on all Firebase resources to prevent scripted abuse of the public API key.
- **Crashlytics** — browser-side error reporting wired into every `console.warn` site in `shared/`.

The client contract is:
- Reads (Firestore listeners, RTDB listeners) stay as today.
- Writes go through an **outbox** that queues the intent, dispatches to the Cloud Function, and surfaces status to the UI. Local-only writes are not the happy path.

---

## 3. Data model

### 3.1 `users/{uid}` — slimmed down

```js
{
  uid: string,
  phone: string,         // E.164, set by bootstrapUser
  displayName: string,
  role: 'customer' | 'delivery' | 'admin',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  totalOrders: number    // server-incremented by a function; client cannot write
}
```

`usedCoupons` is **removed** from this doc. Coupon state lives in `coupon_redemptions` (see 3.3) and is enforced by a uniqueness check in the function.

### 3.2 `orders/{orderId}`

```js
{
  id: string,
  customerId: string,            // auth.uid
  customerName: string,          // server-resolved from users/{uid}
  items: [{ id, q, price }],     // server-resolved from menu catalog
  subtotal: number,              // server-computed
  discount: number,              // server-computed
  couponCode: string | null,     // server-validated
  deliveryLat: number,
  deliveryLng: number,
  deliveryAddress: string,       // human-readable, customer-entered
  deliveryDistanceKm: number,    // server-computed via haversine
  deliveryFee: number,           // server-computed from a distance ladder
  total: number,                 // server-computed = subtotal - discount + fee
  paymentMethod: 'cod' | 'manual_upi',
  paymentStatus: 'pending' | 'awaiting_admin_verification' | 'paid' | 'failed',
  status: 'awaiting_verification' | 'accepted' | 'out_for_delivery' | 'delivered' | 'cancelled',
  assignedDeliveryId: string | null,  // server-set
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  deliveredAt: serverTimestamp() | null,
  rating: { stars: number, foodStars: number, deliveryStars: number, comment: string } | null
}
```

The `customerEmail` field is **dropped** (it's already in `users/{uid}` and the kitchen doesn't need it on the order doc).

### 3.3 `coupon_redemptions/{autoId}`

```js
{
  uid: string,
  code: string,
  orderId: string,
  redeemedAt: serverTimestamp()
}
```

Uniqueness enforced by `(uid, code)` in a Firestore composite index + a check in the redeem function. Client cannot create these.

### 3.4 `orders/{id}/events/{eventId}`

```js
{
  from: 'awaiting_verification' | 'accepted' | ...,
  to: 'accepted' | 'out_for_delivery' | ...,
  by: string,        // uid of the actor
  at: serverTimestamp(),
  reason: string | null   // optional, e.g. "customer cancelled"
}
```

Append-only. Written by the same Cloud Function that does the state transition. Used for the audit trail and for the customer's status timeline.

### 3.5 `menu/{itemId}` (new, server-driven)

A small static-ish collection of the current catalog with `{ id, name, price, category, soundCue, emoji }`. Client reads the menu from Firestore once on load; the hardcoded `script.js` catalog becomes a fallback only. Allows the kitchen to update prices without a redeploy.

### 3.6 `outbox/{uid}/{orderId}` (client-side, IndexedDB)

Not a Firestore path. A persistent client queue. Shape:

```js
{
  intent: 'createOrder' | 'cancelOrder' | 'rateOrder' | ...,
  payload: object,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  attempts: number,
  lastError: string | null,
  createdAt: ISO,
  updatedAt: ISO
}
```

The queue is replayed by a `BackgroundSync` registration when the browser is back online. The UI shows a banner if any item is `pending` or `failed`.

---

## 4. Security rules

### 4.1 Firestore rules — full rewrite

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() { return request.auth != null; }
    function isOwner(uid) { return isAuth() && request.auth.uid == uid; }
    function role() { return request.auth.token.role; }
    function isCustomer() { return isAuth() && role() == 'customer'; }
    function isDelivery() { return isAuth() && role() == 'delivery'; }
    function isAdmin()    { return isAuth() && role() == 'admin'; }

    function validStatusTransition(from, to) {
      return (from == 'awaiting_verification' && to == 'accepted')
          || (from == 'accepted'              && to == 'out_for_delivery')
          || (from == 'out_for_delivery'      && to == 'delivered')
          || (from == 'awaiting_verification' && to == 'cancelled')
          || (from == 'accepted'              && to == 'cancelled');
    }

    match /users/{uid} {
      allow read:   if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid)
                    && request.resource.data.role == 'customer'
                    && request.resource.data.totalOrders == 0
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uid','phone','displayName','role','createdAt','updatedAt','totalOrders']);
      allow update: if isAdmin()
                    || (isOwner(uid) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName','updatedAt']));
      allow delete: if false;
    }

    match /orders/{id} {
      allow read:   if isCustomer() && resource.data.customerId == request.auth.uid
                    || isDelivery() && resource.data.assignedDeliveryId == request.auth.uid
                    || isAdmin();
      // CREATE is blocked at the rules layer; orders are created by the createOrder function.
      allow create: if false;
      // UPDATE: status transitions go through the updateOrderStatus function (rules block direct client writes).
      allow update: if false;
      // Rating is allowed by a dedicated function that the customer calls.
      allow delete: if isAdmin();
    }

    match /orders/{id}/events/{eventId} {
      allow read:   if isAuth();  // simplified; tighten by order visibility
      allow write:  if false;     // server-only
    }

    match /coupon_redemptions/{rid} {
      allow read:   if isOwner(resource.data.uid) || isAdmin();
      allow write:  if false;     // server-only
    }

    match /menu/{itemId} {
      allow read:   if isAuth();
      allow write:  if isAdmin();
    }

    match /reviews/{rid} {
      allow read:   if true;
      allow create: if isCustomer()
                    && request.resource.data.userId == request.auth.uid
                    && exists(/databases/$(database)/documents/orders/$(request.resource.data.orderId))
                    && get(/databases/$(database)/documents/orders/$(request.resource.data.orderId)).data.status == 'delivered';
    }
  }
}
```

The pattern is: **the client can read freely within scope; the client can write nothing that touches money, state, or audit.** All writes go through callable functions that re-validate and re-compute server-side.

### 4.2 RTDB rules

```json
{
  "rules": {
    "locations": {
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('activeDeliveries').child($uid).child('customerId').val() === auth.uid)",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['lat','lng','timestamp']) && newData.child('lat').isNumber() && newData.child('lat').val() >= -90 && newData.child('lat').val() <= 90 && newData.child('lng').isNumber() && newData.child('lng').val() >= -180 && newData.child('lng').val() <= 180 && newData.child('timestamp').isNumber() && newData.child('timestamp').val() <= now",
        "$other": { ".validate": false }
      }
    },
    "activeDeliveries": {
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'customer' || root.child('users').child(auth.uid).child('role').val() === 'admin')",
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'delivery')",
        ".validate": "newData.hasChildren(['orderId','customerId'])"
      }
    }
  }
}
```

The `activeDeliveries` map is the bridge: when the kitchen admin assigns a rider, the `assignDelivery` function writes `activeDeliveries/{riderUid} = { orderId, customerId }`. The customer's tracker only reads the `locations/{riderUid}` where the rule's lookup finds their own UID. No more `locations/delivery-live` shared key.

### 4.3 App Check

`firebase.appCheck().activate(siteKey)` on every entry point. The reCAPTCHA Enterprise key is configured per environment (dev uses the test key, prod uses the real key). The `firebase.json` deploy command includes `firebase deploy --only apphosting,functions,firestore,storage,database`.

---

## 5. Cloud Functions

All in `functions/index.js`, region `asia-south1`, 2nd gen. Every function is `onCall` (HTTPS) unless otherwise noted.

### 5.1 Auth triggers

- **`bootstrapUser`** (`auth.user.onCreate`) — when a user is created:
  1. Reads the phone number.
  2. If no admin exists yet (first-ever user), grants `role: 'admin'` via `admin.auth().setCustomUserClaims`.
  3. Otherwise grants `role: 'customer'`.
  4. Writes a minimal `users/{uid}` doc.
- **`onUserDeleted`** — removes the user's `users/{uid}` doc and any pending `outbox` items.

### 5.2 Order functions

- **`createOrder`** — `onCall({ items, couponCode, deliveryLat, deliveryLng, deliveryAddress })`. Auth required.
  1. Re-validates: caller is `customer`; cart shape OK; min subtotal ≥ ₹199; address present.
  2. Looks up the canonical prices from `menu/{itemId}` and re-computes `subtotal`, `discount`, `deliveryDistanceKm`, `deliveryFee`, `total`.
  3. Validates the coupon: if `couponCode` is present, checks that `coupon_redemptions` has no doc for `(uid, code)`. If valid, writes a new `coupon_redemptions/{rid}` (composite uniqueness via `where('uid','==',uid).where('code','==',code).get()` + a transaction).
  4. Writes the `orders/{id}` doc with `status: 'awaiting_verification'`, `paymentStatus: 'pending'` (UPI) or `pending` (COD).
  5. Writes an `orders/{id}/events/{eid}` with `from: null, to: 'awaiting_verification', by: caller`.
  6. Returns `{ orderId, total, eta }`.
- **`confirmManualPayment`** — `onCall({ orderId })`. Caller must be the order's `customerId`.
  - Flips `paymentStatus` to `awaiting_admin_verification` and appends an event.
- **`adminMarkPaid`** — `onCall({ orderId })`. Caller must be `admin`. Flips `paymentStatus: 'paid'` and appends an event.
- **`acceptOrder`** — `onCall({ orderId })`. Caller must be `admin`. State transition `awaiting_verification → accepted`. Validates current status.
- **`assignDelivery`** — `onCall({ orderId, deliveryUid })`. Caller must be `admin`. State transition `accepted → out_for_delivery`, sets `assignedDeliveryId`, writes `activeDeliveries/{deliveryUid} = { orderId, customerId }`.
- **`markDelivered`** — `onCall({ orderId })`. Caller must be the order's `assignedDeliveryId`. State transition `out_for_delivery → delivered`, appends event.
- **`rateOrder`** — `onCall({ orderId, stars, foodStars, deliveryStars, comment })`. Caller must be the order's `customerId` and order status must be `delivered`. Writes the `rating` field.
- **`createReview`** — `onCall({ orderId, text, stars })`. Same gate as `rateOrder`. Writes a public `reviews/{rid}` doc.

### 5.3 Coupon / menu functions

- **`createMenuItem`** / **`updateMenuItem`** / **`deleteMenuItem`** — admin-only. CRUD on `menu/{itemId}`.
- **`recomputeCatalog`** — admin-only callable that re-publishes the hardcoded catalog into `menu/` on first run (idempotent).

### 5.4 Outbox sync (the client-side queue)

The client owns the IndexedDB outbox. Cloud Functions don't need a separate "process outbox" function — every `onCall` returns a structured result and the client's outbox marks the item `synced` or `failed`. A `BackgroundSync` registration retries pending items on reconnect.

### 5.5 Error reporting

Every function logs to `console.error` and returns a structured `{ ok: false, code, message }` shape. The client maps `code` to a user-facing toast. The same `code` is sent to Crashlytics for triage.

---

## 6. Client changes

### 6.1 New files

- `shared/outbox.js` — IndexedDB-backed queue with `enqueue`, `dispatch`, `replay`, `subscribe`. Exposes a `getStatus()` that the UI can poll.
- `shared/auth-claims.js` — thin wrapper around `getIdTokenResult(forceRefresh)`; caches the role; subscribes to token refresh.
- `shared/geocoder.js` — Nominatim client with 1 req/sec throttling, pin-drop helper, distance compute.
- `shared/state-machine.js` — single source of truth for legal status transitions; consumed by the admin and delivery UIs.
- `shared/sound-cues.js` — re-export of the existing audio-synth with explicit `enabled: boolean` opt-in saved to localStorage.
- `functions/` — Firebase Functions source (TypeScript).
- `tests/` — Vitest unit + integration suites.

### 6.2 Modified files

- `shared/firestore.js` — **strips all write helpers** (`createOrder`, `updateOrderStatus`, `assignDelivery`, `submitOrderReview` are deleted; the module exports only read helpers and the outbox-queue submitter).
- `pay.js` — refactored to: enqueue `createOrder` via the outbox, then call the `createOrder` function, then wait for the function result before showing the celebration modal. The `manual_upi` flow calls `confirmManualPayment` after the user clicks "I have paid."
- `admin/admin.js` — uses `state-machine.js` to disable illegal status options; calls `acceptOrder` and `assignDelivery` and `adminMarkPaid` functions instead of direct Firestore writes; renders the `orders/{id}/events` timeline.
- `delivery/delivery.js` — the simulator and real GPS write to `locations/{deliveryUid}` only; the customer tracker is fed by `activeDeliveries`; the "Pickup" button calls `assignDelivery`; "Delivered" calls `markDelivered`.
- `customer/customer.js` — subscribes to a single `orders/{id}` doc + the corresponding `locations/{riderUid}`; tears both down on `delivered`; renders the events timeline.
- `auth/login.js` — phone OTP is the primary tab; email/password is admin-bootstrap only; the email-string role inference is removed; `loginOrRegister` no longer auto-creates the demo account (the bootstrap function is the only way a user doc is created).
- `shared/auth-guard.js` — role is read from custom claims (`request.auth.token.role`), not from the email string and not from localStorage; the 1.2s timeout fallback is replaced with a "Reconnecting…" indicator.
- `script.js` — `script.js` is split into:
  - `cart/cart.js` — cart, slip persistence, checkout entry.
  - `cart/coupons.js` — coupon table + validation (validation is server-side; this is just the UI).
  - `cart/menu.js` — reads the `menu/` collection; falls back to the hardcoded list if the read fails.
  - `customer/profile.js` — order history, live order pill, profile drawer.
  - `customer/community.js` — public reviews wall.
  - `i18n/i18n.js` — moved to its own folder; parity check is a Vitest test.
  - `index.js` — wires the modules and owns the entry point.
- `index.html` — adds a `data-i18n` attribute to every text node; adds a status banner slot for the outbox indicator.
- `firebase.json` — replaces the single `**` rewrite with explicit per-portal rewrites. Adds `apphosting` config for App Check.
- `firestore.rules` — full rewrite per §4.1.
- `database.rules.json` — full rewrite per §4.2.
- `vite.config.js` — adds the new entry points; adds a `test` script hook.
- `package.json` — adds `vitest`, `@vitest/coverage-v8`, `firebase-functions`, `firebase-admin`, `firebase-tools`; adds `test`, `test:emulator`, `deploy` scripts.

### 6.3 New dependencies

| Package | Why |
|---|---|
| `firebase-functions` | Functions runtime. |
| `firebase-admin` | Admin SDK inside the functions. |
| `vitest` | Tests. |
| `@vitest/coverage-v8` | Coverage. |
| `idb` (or hand-rolled) | IndexedDB Promise wrapper. |
| `node-fetch` (or undici) | Nominatim client. |
| `libphonenumber-js` | E.164 normalization. |

### 6.4 Dropped dependencies

- `morphicons` — never imported; remove.
- `shadcn` — was for component scaffolding; remove (or keep for future use, your call).

---

## 7. i18n, observability, hosting

### 7.1 i18n

- The 185-key dictionary stays; we add the missing keys (status badges, stepper labels, admin filter chips, delivery buttons, celebration modal, outbox banner) symmetrically across `en` / `hi` / `bn`.
- A Vitest test (`tests/i18n-parity.test.js`) enforces that any key in `en` is present in `hi` and `bn`. The test runs in CI.
- The 4 hardcoded trilingual ternaries in `script.js` are replaced with `t('status.delivered')` etc.

### 7.2 Observability

- **Crashlytics** (browser) initialized in `firebase-config.js`. Every `console.warn` and `console.error` site in `shared/`, `auth/`, `pay.js`, `admin/`, `customer/`, `delivery/` is wrapped in a `logError(err, context)` helper that pushes to Crashlytics and (in `import.meta.env.DEV`) keeps the `console.warn`.
- **Functions logger**: every Cloud Function uses `functions.logger` with structured fields; logs flow to Cloud Logging.
- **Healthcheck**: a `healthCheck` callable that returns `{ ok, version, buildAt, firestoreOk, rtdbOk }` for the deploy smoke test.

### 7.3 Hosting (`firebase.json`)

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/admin/**",    "destination": "/admin/index.html" },
      { "source": "/customer/**", "destination": "/customer/index.html" },
      { "source": "/delivery/**", "destination": "/delivery/index.html" },
      { "source": "/auth/**",     "destination": "/auth/login.html" }
    ],
    "headers": [
      { "source": "**/*.@(js|css)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
    ]
  },
  "firestore":  { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "database":   { "rules": "database.rules.json" },
  "functions":  { "source": "functions" },
  "apphosting": { "rewrites": [{ "source": "/api/**", "destination": "functions" }] }
}
```

`firestore.indexes.json` declares the composite index on `(customerId, createdAt desc)` and `(uid, code)` for `coupon_redemptions`.

### 7.4 README — honest version

The README is rewritten to describe the product that ships. Concretely:

- Drop the "Remotion Video Reel Engine" line (the folder exists but is not wired to the main app). A short "Video reel (sibling tool)" section replaces it, pointing to the `remotion/` folder as a separately-built artifact.
- "Real-time across separate devices" → "Real-time when online; resilient offline via the local outbox. Orders always reach the kitchen when the network is available; if not, the customer sees a clear 'pending sync' banner."
- "Multilingual (English, Hindi, Bengali)" stays, with a note about coverage parity enforced by CI.
- The "Demo Account Credentials" table is removed from the public README. The hard-coded demo accounts are removed from the client. The first user to register becomes the admin (documented in the deploy guide).
- The system architecture diagram and the sequence diagram are updated to show the Cloud Functions as the writer of money/state/audit and the client as a thin read/UI layer.

---

## 8. Migration plan (no data loss)

The app is in demo state — no real orders or users. The migration is therefore:

1. **Deploy schema first** — push the new `firestore.rules` and `database.rules.json`. This will break the existing local-storage path (which is fine, the rules now refuse client-side writes).
2. **Deploy functions** — push `functions/`. Bootstrap is the only function that runs on auth; the rest are idle until called.
3. **Deploy client** — push the new client. Existing tabs refresh to the new build; the local outbox replays any pending orders through the function.
4. **Wipe demo data** — admin can call a `wipeDemoData` callable that deletes every doc in `orders`, `reviews`, `coupon_redemptions`, and the `glory_demo_orders` localStorage key. Documented as a one-time post-deploy step.

No data is preserved because there is no real data to preserve. If the user later wants to seed the menu, they call `recomputeCatalog`.

---

## 9. Testing strategy

| Layer | Tool | What we test |
|---|---|---|
| Unit | Vitest | i18n parity; status state machine; coupon table; delivery-fee ladder; outbox queue replay; geocoder rate limiting |
| Integration | Firebase Emulator Suite + Vitest | Firestore rules (`@firebase/rules-unit-testing`); RTDB rules; `createOrder` end-to-end (custom claims, coupon redemption, total recompute, event append) |
| E2E | Playwright (deferred — not in this round) | (skipped for this design; would be added in a follow-up polish round) |
| CI | GitHub Actions | `npm test` + `npm run build` on every PR; `firebase emulators:exec` runs the integration tests |

---

## 10. Out of scope / future work

- Production Razorpay/Stripe integration (the manual UPI path is the chosen MVP).
- PWA / service worker for offline menu browsing (the outbox handles writes; the menu catalog is read from Firestore, so a SW cache is a sensible follow-up).
- Splitting `script.js` further (it goes from 1370 lines to ~600 in this round; the residual `customer/profile.js` + `customer/community.js` can split later if they grow).
- The dead `shared/roulette.js` and `shared/alchemy-lab.js` — left in place; a polish pass can remove them.
- Real geocoding quality (Nominatim is rate-limited; Mapbox is a sensible upgrade if budget allows).
- Analytics (GA4 / Mixpanel) — not in this design.

---

## 11. Acceptance criteria

- [ ] All 6 CRITICAL issues from the verification report are closed and have a regression test.
- [ ] All 15 HIGH issues are closed and have a regression test where applicable (hosting rewrites, geocoding, etc. have manual repro).
- [ ] An order placed in a private window is visible in the admin kitchen within 5 s of online sync.
- [ ] A network outage during checkout does not produce a false success state. The order is in the outbox; the UI shows a "pending sync" banner; the order syncs within 10 s of reconnect.
- [ ] The `manual_upi` flow requires admin confirmation before the kitchen can start cooking.
- [ ] A user with an email containing "admin" cannot reach `/admin/` unless they actually have the admin custom claim.
- [ ] A logged-in customer can read only their own order's courier location, not other couriers.
- [ ] `npm test` passes locally and in CI.
- [ ] `npm run build` produces a clean bundle with no warnings about unused dependencies.
- [ ] `npm run deploy` (after `firebase login`) deploys the full stack (hosting + functions + rules) without manual intervention.
- [ ] The README matches the shipped product.
