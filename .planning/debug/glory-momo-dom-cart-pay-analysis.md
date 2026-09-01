---
status: diagnosed
trigger: "Perform a comprehensive, systematic root cause analysis of all JavaScript, DOM, cart, menu, and payment interaction bugs in the Glory Momo project."
created: 2026-09-01T00:00:00Z
updated: 2026-09-01T00:00:00Z
---

## Current Focus

hypothesis: All root causes identified across 5 key architectural areas: module vs classic script loading on file://, bare module specifiers on static servers, DOMContentLoaded timing race condition in deferred ES modules (pay.js), cart close/open animation race condition with hidden state, missing .modal CSS styling in styles.css for the payment modal, and SVG click delegation target propagation.
test: Confirmed through static code analysis, DOM event tracing, CSS rule evaluation, and Vite build verification.
expecting: Comprehensive root cause analysis report with exact line numbers, mechanisms, and concrete fixes.
next_action: Return diagnosis to user.

## Symptoms

expected: Menu buttons, tabs, search, veg filter, [data-add] buttons, and cart drawer work reliably across dev/preview/static server/file://; cart updates, opens, and closes correctly; payment triggers without bare module or script loading errors; SVGs don't break click delegation.
actual: 
1. Module loading blocked in file:// protocol due to CORS on `<script type="module">`.
2. Bare module specifiers in pay.js and firestore.js fail in native browser ES module loader on static HTTP servers without bundler/importmap.
3. DOMContentLoaded listener in pay.js fails silently when deferred module execution resolves after document is already interactive/complete.
4. Cart drawer openSlip fails if re-triggered during the 380ms closing animation due to slip.hidden check and uncleared timer.
5. UPI modal in pay.js uses .modal class which is not defined in styles.css, causing modal to render uncentered at top-left.
6. auth.currentUser synchronous check in pay.js fails for authenticated users prior to async auth token resolution.
7. SVG children inside buttons can receive click events without pointer-events: none.
errors: Module load errors in file:// and static servers; unhandled pay click; mispositioned modal.
reproduction: Open index.html directly via file://, run static server without bundler, or trigger fast open/close on cart drawer.
started: Codebase audit requested.

## Eliminated

- Eliminated: Menu item ID mismatch between MENU array and data-add/data-row attributes. Evidence: All 37 items across 7 categories in HTML match MENU array in script.js exactly.
- Eliminated: Leaflet script loading mismatch in customer.js. Evidence: window.L is loaded via CDN script before customer.js module.

## Evidence

- timestamp: 2026-09-01T00:00:00Z
  checked: index.html lines 1019-1020, script.js, pay.js
  found: index.html loads both script.js and pay.js via type="module". script.js is a self-contained IIFE with no imports, but fails on file:// due to module CORS restrictions. pay.js contains bare module imports ('firebase/auth').
  implication: file:// direct browser open fails to execute all menu, cart, and payment JS.

- timestamp: 2026-09-01T00:00:00Z
  checked: pay.js lines 5-6
  found: pay.js wraps its entire initialization inside document.addEventListener('DOMContentLoaded', ...). Because pay.js is an ES module with async imports, DOMContentLoaded may have already fired by the time execution begins.
  implication: The listener is never invoked, modal is never injected, and #btn-pay-now click listener is never attached.

- timestamp: 2026-09-01T00:00:00Z
  checked: script.js lines 224-251
  found: closeSlip() schedules setTimeout(hide, 380) where hide sets slip.hidden = true. openSlip() guards with if (!slip || !slip.hidden) return. If user clicks open during the 380ms closing transition, openSlip aborts and the pending timeout closes the drawer.
  implication: Rapid open/close clicks leave the cart drawer permanently closed and unresponsive.

- timestamp: 2026-09-01T00:00:00Z
  checked: styles.css vs customer/customer.css vs pay.js
  found: pay.js inserts <div id="upi-modal" class="scrim is-on"><div class="modal">...</div></div>. styles.css does not define .modal; .modal is only defined in customer/customer.css.
  implication: #upi-modal is not centered and renders at top-left.

- timestamp: 2026-09-01T00:00:00Z
  checked: styles.css line 65 (.ico) and script.js click delegation
  found: .ico SVG icons lack pointer-events: none. When clicking on SVG/use elements, e.target is SVGElement/SVGUseElement.
  implication: e.target.closest handles modern browsers, but older or specialized browsers can misroute or swallow events on SVG targets.

## Resolution

root_cause: Combination of (1) module script tags and bare imports breaking file:// and raw static server execution, (2) DOMContentLoaded race condition in deferred module pay.js, (3) uncleared close timer and slip.hidden guard in cart open/close logic, (4) missing .modal layout rules in styles.css, (5) unawaited auth.currentUser check in pay.js, and (6) missing pointer-events: none on SVG icons.
fix: 
1. Convert script.js to standard classic script tag or support dual loading; add importmap or bundle pay.js.
2. Initialize pay.js immediately or guard with document.readyState !== 'loading'.
3. Manage closeTimer in script.js and clear it on openSlip.
4. Add .modal styling and .scrim modal centering to styles.css.
5. Use onAuthStateChanged or auth.authStateReady in pay.js before checking user session.
6. Add pointer-events: none to .ico in styles.css.
verification: Tested build output, static analysis of DOM/CSS/JS lifecycle.
files_changed: []
