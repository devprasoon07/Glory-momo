/* Glory Momo — board, order slip, and the jhol build.
   Production grade, zero crashes, accessible, and high performance. */
import { getCurrentLang, setLang, t, applyTranslations, getLocalizedItem, getLocalizedGroup } from './shared/i18n.js';
import { getStoredLocalOrders } from './shared/firestore.js';
import { clearLocalAuthUser } from './shared/auth-guard.js';
import { init3DCardTilt, initMagneticButtons, triggerEmberBurst } from './shared/motion.js';

const html = document.documentElement;
html.classList.add('js');

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = n => '₹' + n;
const PHONE = '919851585245';

  /* ------------------------------------------------------------------
     The board. Edit prices and dishes here — everything else follows.
     ------------------------------------------------------------------ */
  const GROUPS = [
    { id:'jhol',  name:'Signature jhol', bn:'ঝোল',    note:'Momos sunk in hot-and-sour broth. Ask for extra chutney on the rim.' },
    { id:'steam', name:'Steamed',        bn:'স্টিম',   note:'Eight minutes in the steamer, folded after you order.' },
    { id:'fried', name:'Fried & crisp',  bn:'ভাজা',   note:'Steamed first, then taken to the oil.' },
    { id:'grill', name:'Tandoori & chilli', bn:'তন্দুরি', note:'Marinated, charred, or tossed in the wok.' },
    { id:'plate', name:'Platters & combos', bn:'থালা', note:'For when you cannot decide, or you are not alone.' },
    { id:'side',  name:'Noodles, soup & sides', bn:'সাইড', note:'These are the ones that take 15–20 minutes at peak.' },
    { id:'drink', name:'Cold things',    bn:'পানীয়',  note:'For after the jhol.' }
  ];

  const MENU = [
    { id:'jhol-veg',      g:'jhol',  n:'Jhol Momo · Veg',      bn:'ঝোল মোমো', p:75,  pc:'6 pc', h:4, v:1, d:'Cabbage, carrot and beans, in the same broth as the chicken one.' },
    { id:'jhol-chicken',  g:'jhol',  n:'Jhol Momo · Chicken',  bn:'ঝোল মোমো', p:90,  pc:'6 pc', h:4, v:0, d:'The one the reviews are about. Roasted tomato, dry chilli, mustard oil.' },
    { id:'jhol-paneer',   g:'jhol',  n:'Jhol Momo · Paneer',   bn:'পনির ঝোল', p:95,  pc:'6 pc', h:4, v:1, d:'Fresh paneer and crushed pepper, heavier than the veg.' },
    { id:'jhol-double',   g:'jhol',  n:'Double Jhol · Chicken', bn:'ডবল ঝোল', p:150, pc:'10 pc', h:5, v:0, d:'Ten momos, twice the broth, chilli oil floated on top.' },
    { id:'jhol-extra',    g:'jhol',  n:'Extra Jhol',           bn:'বাড়তি ঝোল', p:25, pc:'200 ml', h:5, v:1, d:'A cup of broth on its own. Regulars order two.' },
    { id:'steam-veg',     g:'steam', n:'Steamed Momo · Veg',   bn:'ভেজ মোমো', p:55,  pc:'6 pc', h:1, v:1, d:'Thin skin, tight pleats, chutney on the side.' },
    { id:'steam-chicken', g:'steam', n:'Steamed Momo · Chicken', bn:'চিকেন মোমো', p:70, pc:'6 pc', h:1, v:0, d:'Minced leg meat, ginger and spring onion. The baseline.' },
    { id:'steam-paneer',  g:'steam', n:'Steamed Momo · Paneer', bn:'পনির মোমো', p:80, pc:'6 pc', h:1, v:1, d:'Grated paneer with green chilli and coriander stem.' },
    { id:'steam-corn',    g:'steam', n:'Corn & Cheese Momo',   bn:'কর্ন চিজ', p:90,  pc:'6 pc', h:1, v:1, d:'Sweet corn and melted cheese. The one children finish first.' },
    { id:'steam-chzchk',  g:'steam', n:'Chicken Cheese Momo',  bn:'চিকেন চিজ', p:100, pc:'6 pc', h:1, v:0, d:'Mince and cheese together, heavier than it sounds.' },
    { id:'fried-veg',     g:'fried', n:'Fried Momo · Veg',     bn:'ভেজ ফ্রাই', p:65,  pc:'6 pc', h:2, v:1, d:'Blistered skin, still soft inside.' },
    { id:'fried-chicken', g:'fried', n:'Fried Momo · Chicken', bn:'চিকেন ফ্রাই', p:80, pc:'6 pc', h:2, v:0, d:'Deep fried till the pleats go dark gold.' },
    { id:'pan-chicken',   g:'fried', n:'Pan-fried Momo · Chicken', bn:'প্যান ফ্রাই', p:85, pc:'6 pc', h:2, v:0, d:'Crisp on one face only, steamed on the other.' },
    { id:'kurkure-veg',   g:'fried', n:'Kurkure Momo · Veg',   bn:'কুড়কুড়ে', p:95,  pc:'6 pc', h:2, v:1, d:'Rolled in crumb and fried hard. Loud first bite.' },
    { id:'kurkure-chicken', g:'fried', n:'Kurkure Momo · Chicken', bn:'কুড়কুড়ে', p:110, pc:'6 pc', h:2, v:0, d:'Same crumb, chicken filling. Goes fast after 8 pm.' },
    { id:'tandoori-veg',  g:'grill', n:'Tandoori Momo · Veg',  bn:'তন্দুরি', p:100, pc:'6 pc', h:3, v:1, d:'Curd, chilli and ajwain marinade, charred on the grill.' },
    { id:'tandoori-chicken', g:'grill', n:'Tandoori Momo · Chicken', bn:'তন্দুরি', p:120, pc:'6 pc', h:3, v:0, d:'Blackened pleats, smoke you can smell across the court.' },
    { id:'chilli-veg',    g:'grill', n:'Chilli Momo · Veg',    bn:'চিলি মোমো', p:95,  pc:'6 pc', h:4, v:1, d:'Wok-tossed with onion, capsicum and green chilli.' },
    { id:'chilli-chicken', g:'grill', n:'Chilli Momo · Chicken', bn:'চিলি মোমো', p:110, pc:'6 pc', h:4, v:0, d:'Dry, sticky and sharp. Say the word for extra chilli.' },
    { id:'schezwan-chicken', g:'grill', n:'Schezwan Momo · Chicken', bn:'শেজওয়ান', p:115, pc:'6 pc', h:4, v:0, d:'Our own schezwan paste, made in-house every evening.' },
    { id:'chatpata-veg',  g:'grill', n:'Momo Chatpata · Veg',  bn:'চটপটা', p:85,  pc:'6 pc', h:3, v:1, d:'Chopped momos with onion, lemon, chaat masala and mustard oil.' },
    { id:'platter-one',   g:'plate', n:'Momo Platter for One', bn:'থালা', p:190, pc:'12 pc', h:3, v:0, d:'Four steamed, four kurkure, four in jhol. Chicken or veg.' },
    { id:'platter-two',   g:'plate', n:'Battle of Buds Platter', bn:'বড় থালা', p:200, pc:'16 pc', h:3, v:0, d:'Enough for two, priced for one and a half.' },
    { id:'combo-chow',    g:'plate', n:'Momo + Chowmein Combo', bn:'কম্বো', p:150, pc:'6 pc + plate', h:2, v:0, d:'Six steamed momos with a plate of chowmein.' },
    { id:'combo-jhol',    g:'plate', n:'Jhol Momo + Cold Drink', bn:'কম্বো', p:110, pc:'6 pc + 300 ml', h:4, v:0, d:'The standard order for anyone eating alone at the counter.' },
    { id:'chow-veg',      g:'side',  n:'Veg Chowmein',         bn:'ভেজ চাউমিন', p:70,  pc:'plate', h:2, v:1, d:'Hakka style, plenty of cabbage, a spoon of vinegar chilli.' },
    { id:'chow-egg',      g:'side',  n:'Egg Chowmein',         bn:'এগ চাউমিন', p:85,  pc:'plate', h:2, v:0, d:'Scrambled through the noodles, not on top.' },
    { id:'chow-chicken',  g:'side',  n:'Chicken Chowmein',     bn:'চিকেন চাউমিন', p:95, pc:'plate', h:2, v:0, d:'Shredded chicken, spring onion greens, wok heat.' },
    { id:'chilli-dry',    g:'side',  n:'Chilli Chicken · Dry', bn:'চিলি চিকেন', p:130, pc:'plate', h:4, v:0, d:'Battered, fried, then tossed. Order it with chowmein.' },
    { id:'thukpa-veg',    g:'side',  n:'Veg Thukpa',           bn:'ভেজ থুকপা', p:95,  pc:'bowl', h:3, v:1, d:'Noodle soup with a clear, peppery broth. Good in December.' },
    { id:'thukpa-chicken', g:'side', n:'Chicken Thukpa',       bn:'চিকেন থুকপা', p:120, pc:'bowl', h:3, v:0, d:'Bone broth, noodles, shredded chicken, coriander.' },
    { id:'soup-corn',     g:'side',  n:'Sweet Corn Soup',      bn:'কর্ন সুপ', p:55,  pc:'bowl', h:1, v:1, d:'Thick, mild, and the fastest thing on this list.' },
    { id:'soup-chicken',  g:'side',  n:'Chicken Clear Soup',   bn:'চিকেন সুপ', p:60,  pc:'bowl', h:1, v:0, d:'What the broth tastes like before the chilli goes in.' },
    { id:'lemon-soda',    g:'drink', n:'Masala Lemon Soda',    bn:'মশলা সোডা', p:35,  pc:'300 ml', h:0, v:1, d:'Black salt, lemon, soda. The correct answer after jhol.' },
    { id:'iced-tea',      g:'drink', n:'Iced Lemon Tea',       bn:'আইস টি', p:45,  pc:'300 ml', h:0, v:1, d:'Brewed, chilled, not from a powder.' },
    { id:'cold-drink',    g:'drink', n:'Cold Drink',           bn:'ঠান্ডা পানীয়', p:25, pc:'300 ml', h:0, v:1, d:'Whatever is coldest in the fridge.' },
    { id:'water',         g:'drink', n:'Bottled Water',        bn:'জল', p:20,  pc:'1 L', h:0, v:1, d:'Sealed bottle.' }
  ];

  const byId = id => MENU.find(m => m.id === id);

  /* ---------------- the board ---------------- */
  const board    = $('[data-menu]');
  const tabsBox  = $('[data-tabs]');
  const search   = $('[data-search]');
  const vegBox   = $('[data-veg]');
  const emptyMsg = $('[data-empty]');
  let activeGroup = 'all';

  const heat = h =>
    `<span class="heat" data-heat="${h}" title="Heat ${h} of 5" aria-label="Heat ${h} of 5">${'<i></i>'.repeat(5)}</span>`;

  const rowHTML = m => {
    const lang = getCurrentLang();
    const loc = getLocalizedItem(m.id, lang) || { n: m.n, d: m.d, pc: m.pc };
    const name = loc.n || m.n;
    const desc = loc.d || m.d;
    const pc = loc.pc || m.pc;
    const bnSpan = lang === 'bn' ? '' : `<span class="row__bn" lang="bn">${m.bn}</span>`;

    return `<li class="row" data-row="${m.id}">
      <span class="row__mark${m.v ? ' row__mark--veg' : ''}" role="img" aria-label="${m.v ? (lang === 'hi' ? 'शाकाहारी' : (lang === 'bn' ? 'নিরামিষ' : 'Veg')) : (lang === 'hi' ? 'मांसाहारी' : (lang === 'bn' ? 'আমিষ' : 'Non-veg'))}"></span>
      <span class="row__main">
        <span class="row__name">${name}${bnSpan}</span>
        <span class="row__desc">${desc}</span>
      </span>
      <span class="row__meta">${heat(m.h)}<span class="row__pc">${pc}</span></span>
      <button class="row__price" type="button" data-add="${m.id}" aria-label="Add ${name} to order slip, ${money(m.p)}">
        ${money(m.p)}<svg class="ico" aria-hidden="true"><use href="#iPlus"/></svg>
      </button>
    </li>`;
  };

  const groupName = id => (GROUPS.find(g => g.id === id) || {}).name || '';

  function shows(m){
    if (vegBox && vegBox.checked && !m.v) return false;
    if (activeGroup !== 'all' && m.g !== activeGroup) return false;
    if (!search) return true;
    const q = search.value.trim().toLowerCase();
    if (!q) return true;
    const lang = getCurrentLang();
    const loc = getLocalizedItem(m.id, lang) || {};
    const locGrp = getLocalizedGroup(m.g, lang) || {};
    return `${m.n} ${m.bn} ${m.d} ${groupName(m.g)} ${loc.n || ''} ${loc.d || ''} ${locGrp.name || ''}`.toLowerCase().includes(q);
  }

  function renderBoard(){
    if (!board) return;
    const lang = getCurrentLang();
    const shown = MENU.filter(shows);
    board.innerHTML = GROUPS.map(g => {
      const items = shown.filter(m => m.g === g.id);
      if (!items.length) return '';
      const loc = getLocalizedGroup(g.id, lang) || { name: g.name, note: g.note };
      const grpName = loc.name || g.name;
      const grpNote = loc.note || g.note;
      const bnSpan = lang === 'bn' ? '' : `<span class="grp__bn" lang="bn">${g.bn}</span>`;
      return `<section class="grp">
        <h3 class="grp__name">${grpName}${bnSpan}</h3>
        <p class="grp__note">${grpNote}</p>
        <ul class="rows">${items.map(rowHTML).join('')}</ul>
      </section>`;
    }).join('');

    if (emptyMsg) emptyMsg.hidden = shown.length > 0;
    flagAdded();
    init3DCardTilt();
  }

  function renderTabs(){
    if (!tabsBox) return;
    const lang = getCurrentLang();
    const allText = t('tab_all', lang) || 'Everything';
    const list = [{ id:'all', name: allText }].concat(GROUPS.map(g => {
      const loc = getLocalizedGroup(g.id, lang);
      return { id: g.id, name: loc ? loc.name : g.name };
    }));
    tabsBox.innerHTML = list.map(g => {
      const n = g.id === 'all' ? MENU.length : MENU.filter(m => m.g === g.id).length;
      return `<button class="tab" type="button" data-group="${g.id}" aria-pressed="${g.id === activeGroup}">${g.name}<span class="tab__n">${n}</span></button>`;
    }).join('');
  }

  /* ---------------- order slip ---------------- */
  const KEY = 'glory-momo-slip';
  const slip          = $('[data-cart]');
  const scrim         = $('[data-scrim]');
  const slipList      = $('[data-cart-list]');
  const slipEmpty     = $('[data-cart-empty]');
  const slipTotal     = $('[data-cart-total]');
  const slipWa        = $('[data-cart-wa]');
  const cartBtn       = $('[data-cart-open]');
  const cartCount     = $('[data-cart-count]');
  const toastBox      = $('[data-toast]');
  const cartPill      = $('[data-cart-pill]');
  const cartPillCount = $('[data-cart-pill-count]');
  const cartPillTotal = $('[data-cart-pill-total]');

  let items = [];
  let lastFocus = null;
  let toastTimer = null;
  let closeTimer = null;

  try {
    items = JSON.parse(localStorage.getItem(KEY)) || [];
    if (!Array.isArray(items)) items = [];
  } catch (e) {
    items = [];
  }
  items = items.filter(i => i && typeof i.id === 'string' && byId(i.id) && Number(i.q) > 0);

  const save  = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} };
  const total = () => items.reduce((s, i) => {
    const item = byId(i.id);
    return s + (item ? item.p * Number(i.q) : 0);
  }, 0);
  const count = () => items.reduce((s, i) => s + Number(i.q || 0), 0);

  function waLink(){
    const base = `https://wa.me/${PHONE}?text=`;
    if (!items.length) return base + encodeURIComponent('Hi Glory Momo, I would like to order.');
    const lines = items.map(i => {
      const m = byId(i.id);
      return m ? `${i.q} x ${m.n} — ${money(m.p * i.q)}` : '';
    }).filter(Boolean);
    return base + encodeURIComponent(
      ['Hi Glory Momo, order please:', ...lines, `Total ${money(total())}`, '', 'Name:', 'Pickup or delivery:'].join('\n')
    );
  }

  function flagAdded(){
    const ids = new Set(items.map(i => i.id));
    $$('.row').forEach(r => r.classList.toggle('is-added', ids.has(r.dataset.row)));
  }

  /* ---------------- order slip state & calculations ---------------- */
  let currentDistance = 2.0; // in km (default fallback)
  let isGpsDetected = false;
  let userCoords = null;
  let appliedCoupon = null; // { code, discount, label }
  let paymentChoice = 'upi'; // 'upi' or 'cod'

  function autoDetectGpsDistance() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        userCoords = { lat, lng };
        // Newtown Shop: 22.5855, 88.4837
        const R = 6371; // Earth's radius in km
        const dLat = (lat - 22.5855) * Math.PI / 180;
        const dLng = (lng - 88.4837) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(22.5855 * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const dist = Math.max(0.5, parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)));
        currentDistance = dist;
        isGpsDetected = true;
        renderSlip();
      },
      () => {
        // Silently fallback to default 2.0 km
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }

  // Automatically start GPS distance calculation in the background
  autoDetectGpsDistance();

  const COUPONS = {
    'GLORY20': { min: 199, pct: 0.20, maxDiscount: 60, desc: '20% OFF on ₹199+' },
    'GLORY30': { min: 299, pct: 0.30, maxDiscount: 100, desc: '30% OFF on ₹299+' },
    'FIRSTMOMO': { min: 149, flat: 50, desc: '₹50 FLAT OFF on ₹149+' },
    'FEAST40': { min: 499, pct: 0.40, maxDiscount: 200, desc: '40% OFF on ₹499+' }
  };

  function getDeliveryFee(dist) {
    if (dist <= 3) return 10;
    if (dist <= 6) return 30;
    if (dist <= 9) return 50;
    if (dist <= 12) return 70;
    return 10 + Math.ceil((dist - 3) / 3) * 20;
  }

  function getUsedCoupons() {
    try {
      return JSON.parse(localStorage.getItem('glory-momo-used-coupons')) || [];
    } catch(e) {
      return [];
    }
  }

  function calculateCartTotals() {
    const subtotal = total();
    const deliveryFee = subtotal > 0 ? getDeliveryFee(currentDistance) : 0;
    let discount = 0;

    if (appliedCoupon && subtotal >= appliedCoupon.min) {
      if (appliedCoupon.flat) {
        discount = Math.min(subtotal, appliedCoupon.flat);
      } else if (appliedCoupon.pct) {
        discount = Math.min(appliedCoupon.maxDiscount || Infinity, Math.round(subtotal * appliedCoupon.pct));
      }
    } else if (appliedCoupon && subtotal < appliedCoupon.min) {
      // Minimum condition not met anymore
      appliedCoupon = null;
    }

    const grandTotal = subtotal > 0 ? Math.max(0, subtotal - discount) + deliveryFee : 0;
    return { subtotal, discount, deliveryFee, grandTotal };
  }

  // Expose Cart State Globally for Checkout Handler (pay.js)
  window.GloryCart = {
    getItems: () => items,
    getTotals: () => ({ ...calculateCartTotals(), distance: currentDistance, userCoords, isGpsDetected, coupon: appliedCoupon, paymentMethod: paymentChoice }),
    clear: () => {
      items = [];
      appliedCoupon = null;
      renderSlip();
    },
    markCouponUsed: (code) => {
      if (!code) return;
      const used = getUsedCoupons();
      if (!used.includes(code)) {
        used.push(code);
        try { localStorage.setItem('glory-momo-used-coupons', JSON.stringify(used)); } catch(e) {}
      }
    }
  };

  function renderSlip(){
    if (!slipList) return;
    const lang = getCurrentLang();
    slipList.innerHTML = items.map(i => {
      const m = byId(i.id);
      if (!m) return '';
      const loc = getLocalizedItem(m.id, lang) || { n: m.n, pc: m.pc };
      const name = loc.n || m.n;
      const pc = loc.pc || m.pc;
      return `<li class="sli">
        <div><p class="sli__name">${name}</p><p class="sli__sub">${pc} · ${money(m.p)} ${t('slip_each', lang)}</p></div>
        <p class="sli__amt">${money(m.p * i.q)}</p>
        <div class="qty">
          <button type="button" data-step="-1" data-id="${i.id}" aria-label="One less ${name}"><svg class="ico" aria-hidden="true"><use href="#iMinus"/></svg></button>
          <output>${i.q}</output>
          <button type="button" data-step="1" data-id="${i.id}" aria-label="One more ${name}"><svg class="ico" aria-hidden="true"><use href="#iPlus"/></svg></button>
        </div>
      </li>`;
    }).join('');

    const { subtotal, discount, deliveryFee, grandTotal } = calculateCartTotals();
    const c = count();

    if (slipEmpty) slipEmpty.hidden = items.length > 0;
    if (slipTotal) slipTotal.textContent = money(grandTotal);

    // Itemized Breakdown Elements
    const elSubtotal = document.getElementById('breakdown-subtotal');
    const elDiscountRow = document.getElementById('breakdown-discount-row');
    const elDiscount = document.getElementById('breakdown-discount');
    const elCouponLabel = document.getElementById('breakdown-coupon-label');
    const elDeliveryLabel = document.getElementById('breakdown-delivery-label');
    const elDelivery = document.getElementById('breakdown-delivery');

    if (elSubtotal) elSubtotal.textContent = money(subtotal);
    const delText = t('cart_delivery', lang);
    if (elDeliveryLabel) elDeliveryLabel.textContent = isGpsDetected ? `${delText} (${currentDistance} km GPS):` : `${delText} (~${currentDistance} km):`;
    if (elDelivery) elDelivery.textContent = money(deliveryFee);

    if (discount > 0 && appliedCoupon) {
      if (elDiscountRow) elDiscountRow.hidden = false;
      if (elCouponLabel) elCouponLabel.textContent = `${t('cart_discount', lang)} (${appliedCoupon.code}):`;
      if (elDiscount) elDiscount.textContent = `-${money(discount)}`;
    } else {
      if (elDiscountRow) elDiscountRow.hidden = true;
    }

    // Pay on Delivery Availability Gate (Orders >= ₹199)
    const selectPay = document.getElementById('cart-pay-select');
    const codHint = document.getElementById('cod-hint');
    const codOption = selectPay?.querySelector('option[value="cod"]');

    if (subtotal >= 199) {
      if (codOption) {
        codOption.disabled = false;
        codOption.textContent = t('opt_cod', lang);
      }
      if (codHint) {
        codHint.textContent = t('cod_hint', lang);
        codHint.style.color = 'var(--coriander)';
      }
    } else {
      if (codOption) {
        codOption.disabled = true;
        codOption.textContent = t('opt_cod', lang);
      }
      if (codHint) {
        codHint.textContent = t('cod_hint', lang);
        codHint.style.color = 'var(--steel-400)';
      }
      if (paymentChoice === 'cod') {
        paymentChoice = 'upi';
        if (selectPay) selectPay.value = 'upi';
      }
    }

    const sumCouponBadge = document.getElementById('sum-coupon-badge');
    if (sumCouponBadge) {
      if (appliedCoupon && discount > 0) {
        sumCouponBadge.textContent = t('cart_applied_coupon', lang).replace('%s', appliedCoupon.code).replace('%s', money(discount));
        sumCouponBadge.style.color = 'var(--coriander)';
      } else {
        sumCouponBadge.textContent = t('cart_available_offers', lang);
        sumCouponBadge.style.color = 'var(--turmeric)';
      }
    }

    const sumBreakdownBadge = document.getElementById('sum-breakdown-badge');
    if (sumBreakdownBadge) {
      sumBreakdownBadge.textContent = t('cart_total_badge', lang).replace('%s', money(grandTotal));
    }

    const btnPay = document.getElementById("btn-pay-now");
    if (btnPay) {
      if (paymentChoice === 'cod') {
        btnPay.innerHTML = `<span>${t('cart_place_cod', lang).replace('%s', money(grandTotal))}</span> <svg class="ico" aria-hidden="true"><use href="#iCheck"/></svg>`;
      } else {
        btnPay.innerHTML = `<span>${t('cart_place_upi', lang).replace('%s', money(grandTotal))}</span> <svg class="ico" aria-hidden="true"><use href="#iCheck"/></svg>`;
      }
    }

    // Highlight active coupon tags
    document.querySelectorAll('.coupon-tag').forEach(tag => {
      const code = tag.dataset.code;
      tag.classList.toggle('is-applied', appliedCoupon?.code === code);
    });

    if (slipWa) slipWa.href = waLink();
    if (cartCount) cartCount.textContent = c;
    if (cartBtn) cartBtn.dataset.tally = c ? '1' : '0';

    if (cartPill) {
      if (c > 0) {
        cartPill.hidden = false;
        if (cartPillCount) cartPillCount.textContent = c;
        if (cartPillTotal) cartPillTotal.textContent = money(grandTotal);
        requestAnimationFrame(() => cartPill.classList.add('is-on'));
      } else {
        cartPill.classList.remove('is-on');
        cartPill.hidden = true;
      }
    }

    flagAdded();
    save();
  }

  // Coupon Application Logic
  function applyCouponCode(code) {
    const statusEl = document.getElementById('coupon-status');
    const normalized = (code || '').trim().toUpperCase();
    const coupon = COUPONS[normalized];

    if (!coupon) {
      if (statusEl) { statusEl.textContent = '❌ Invalid coupon code'; statusEl.style.color = '#ff6b6b'; }
      return;
    }

    const usedList = getUsedCoupons();
    if (usedList.includes(normalized)) {
      if (statusEl) { statusEl.textContent = '⚠️ Already redeemed once!'; statusEl.style.color = '#ff6b6b'; }
      return;
    }

    const currentSubtotal = total();
    if (currentSubtotal < coupon.min) {
      if (statusEl) { statusEl.textContent = `⚠️ Add ₹${coupon.min - currentSubtotal} more to use ${normalized}`; statusEl.style.color = 'var(--turmeric)'; }
      return;
    }

    appliedCoupon = { code: normalized, ...coupon };
    if (statusEl) { statusEl.textContent = `✅ Applied ${normalized}!`; statusEl.style.color = 'var(--coriander)'; }
    renderSlip();
    toast(`Coupon ${normalized} applied!`);
  }

  document.querySelectorAll('.coupon-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      applyCouponCode(tag.dataset.code);
    });
  });

  document.getElementById('btn-apply-coupon')?.addEventListener('click', () => {
    const input = document.getElementById('coupon-input');
    if (input) applyCouponCode(input.value);
  });

  // Payment Option selection handlers
  const selectPay = document.getElementById('cart-pay-select');
  if (selectPay) {
    selectPay.addEventListener('change', (e) => {
      const chosen = e.target.value;
      if (chosen === 'cod' && total() < 199) {
        alert("Pay on Delivery (COD) is only available on orders above ₹199. Please add more items or pay via UPI.");
        selectPay.value = 'upi';
        paymentChoice = 'upi';
      } else {
        paymentChoice = chosen;
      }
      renderSlip();
    });
  }

  const optUpi = document.getElementById('opt-upi');
  const optCod = document.getElementById('opt-cod');

  if (optUpi) {
    optUpi.addEventListener('click', () => {
      paymentChoice = 'upi';
      optUpi.classList.add('is-selected');
      if (optCod) optCod.classList.remove('is-selected');
      renderSlip();
    });
  }

  if (optCod) {
    optCod.addEventListener('click', () => {
      if (total() < 199) {
        alert("Pay on Delivery (COD) is only available on orders above ₹199. Please add more items or pay via UPI.");
        return;
      }
      paymentChoice = 'cod';
      optCod.classList.add('is-selected');
      if (optUpi) optUpi.classList.remove('is-selected');
      renderSlip();
    });
  }

  function bump(id, n){
    const it = items.find(i => i.id === id);
    if (!it){ if (n > 0) items.push({ id, q:n }); }
    else { it.q += n; if (it.q < 1) items = items.filter(i => i.id !== id); }
    renderSlip();
  }

  function toast(msg){
    if (!toastBox) return;
    toastBox.innerHTML = `<span>${msg}</span><span class="toast__action">View slip &rarr;</span>`;
    toastBox.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('is-on'), 3000);
  }

  if (toastBox) {
    toastBox.addEventListener('click', () => {
      openSlip();
      toastBox.classList.remove('is-on');
    });
  }

  const focusables = () =>
    slip ? $$('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])', slip)
      .filter(el => el.offsetWidth || el.offsetHeight) : [];

  function openSlip(){
    if (!slip) return;
    if (!isGpsDetected) {
      autoDetectGpsDistance();
    }
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    lastFocus = document.activeElement;
    if (scrim) {
      scrim.hidden = false;
    }
    slip.hidden = false;
    html.classList.add('is-locked');
    $$('[data-cart-open]').forEach(btn => btn.setAttribute('aria-expanded', 'true'));

    // Force layout reflow before triggering smooth CSS slide-in
    void slip.offsetWidth;

    requestAnimationFrame(() => {
      if (scrim) scrim.classList.add('is-on');
      slip.classList.add('is-on');
    });
    const closeBtn = $('[data-cart-close]', slip) || slip;
    if (closeBtn) closeBtn.focus();
  }

  function closeSlip(){
    if (!slip || slip.hidden) return;
    if (closeTimer) clearTimeout(closeTimer);

    slip.classList.remove('is-on');
    if (scrim) scrim.classList.remove('is-on');
    html.classList.remove('is-locked');
    $$('[data-cart-open]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));

    const hide = () => {
      slip.hidden = true;
      if (scrim) scrim.hidden = true;
      closeTimer = null;
    };

    if (reduce) {
      hide();
    } else {
      closeTimer = setTimeout(hide, 380);
    }
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  // Handle all cart open triggers (header button, floating pill, etc.)
  document.addEventListener('click', e => {
    const openTrigger = e.target.closest('[data-cart-open]');
    if (openTrigger) {
      e.preventDefault();
      openSlip();
      return;
    }

    const closeTrigger = e.target.closest('[data-cart-close]');
    if (closeTrigger) {
      e.preventDefault();
      closeSlip();
      return;
    }

    if (scrim && e.target === scrim) {
      closeSlip();
      closeProfile();
      return;
    }

    const clearTrigger = e.target.closest('[data-cart-clear]');
    if (clearTrigger) {
      if (!items.length) return;
      items = [];
      renderSlip();
      toast(t('slip_cleared', getCurrentLang()));
      return;
    }

    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const m = byId(addBtn.dataset.add);
      if (!m) return;
      bump(m.id, 1);
      const loc = getLocalizedItem(m.id, getCurrentLang());
      const itemName = loc ? loc.n : m.n;
      toast(`${itemName} ${t('cart_added', getCurrentLang())} · ${money(total())}`);
      addBtn.classList.remove('is-pop');
      if (!reduce) requestAnimationFrame(() => addBtn.classList.add('is-pop'));
      return;
    }

    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn && slip && slip.contains(stepBtn)) {
      bump(stepBtn.dataset.id, Number(stepBtn.dataset.step));
      return;
    }
  });

  if (slip) {
    slip.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  }

  /* ---------------- board interactions ---------------- */
  if (tabsBox) {
    tabsBox.addEventListener('click', e => {
      const tab = e.target.closest('[data-group]');
      if (!tab) return;
      activeGroup = tab.dataset.group;
      $$('.tab', tabsBox).forEach(t => t.setAttribute('aria-pressed', String(t === tab)));
      renderBoard();
    });
  }

  if (search) {
    search.addEventListener('input', renderBoard);
    search.addEventListener('search', renderBoard);
  }
  if (vegBox) {
    vegBox.addEventListener('change', renderBoard);
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (slip && !slip.hidden) { closeSlip(); return; }
    if (profileDrawer && !profileDrawer.hidden) { closeProfile(); return; }
    if (nav && nav.classList.contains('is-open')) closeNav();
  });

  /* ---------------- nav, rail, back to top ---------------- */
  const bar     = $('[data-bar]');
  const nav     = $('#nav');
  const burger  = $('[data-burger]');
  const railFill = $('[data-progress]');
  const toTop   = $('[data-totop]');
  const navLinks = $$('.nav a');

  function closeNav(){
    if (!nav || !burger) return;
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open section menu');
  }

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close section menu' : 'Open section menu');
    });

    nav.addEventListener('click', e => { if (e.target.closest('a')) closeNav(); });
  }

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top:0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // Safe sections mapping: only query selector for valid in-page hash links!
  const sections = navLinks
    .map(a => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return null;
      try {
        const el = $(href);
        return el ? { a, el } : null;
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  let barHeight = 68;
  function updateMeasurements() {
    barHeight = (parseFloat(getComputedStyle(html).getPropertyValue('--bar-h')) || 68);
  }
  updateMeasurements();

  let ticking = false;
  function onScroll(){
    const y   = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (railFill) railFill.style.width = (max > 0 ? Math.min(1, y / max) * 100 : 0) + '%';
    if (bar) bar.classList.toggle('is-stuck', y > 12);
    if (toTop) toTop.classList.toggle('is-on', y > window.innerHeight * 0.7);

    let current = null;
    const line = barHeight + 48;
    for (let i = sections.length - 1; i >= 0; i--) {
      const s = sections[i];
      if (s.el.getBoundingClientRect().top <= line) {
        current = s.a;
        break;
      }
    }
    navLinks.forEach(a => a.classList.toggle('is-active', a === current));
    ticking = false;
  }

  const queueScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  };
  addEventListener('scroll', queueScroll, { passive:true });
  addEventListener('resize', () => {
    updateMeasurements();
    queueScroll();
    queueJhol();
  });

  /* ---------------- reveal on scroll ---------------- */
  function reveal(){
    const rises = $$('[data-rise]');
    if (!rises.length) return;

    // Immediately reveal hero elements for instant visual feedback
    $$('.hero [data-rise]').forEach((el, n) => {
      el.style.setProperty('--d', Math.min(n, 6) * 70 + 'ms');
      el.classList.add('is-in');
    });

    if (reduce || !('IntersectionObserver' in window)){
      rises.forEach(el => el.classList.add('is-in'));
      return;
    }

    const groups = new Map();
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const key = el.parentElement || document.body;
        const n = groups.get(key) || 0;
        groups.set(key, n + 1);
        el.style.setProperty('--d', Math.min(n, 6) * 80 + 'ms');
        el.classList.add('is-in');
        obs.unobserve(el);
      });
    }, { rootMargin:'0px 0px -6% 0px', threshold:0.05 });

    rises.forEach(el => io.observe(el));

    // Fallback insurance: elements in view become visible regardless
    setTimeout(() => {
      rises.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 1.05) {
          el.classList.add('is-in');
        }
      });
    }, 350);
  }

  /* ---------------- the jhol build (scroll driven) ---------------- */
  const jholGrid  = $('[data-jhol]');
  const jholSteps = $$('.jhol__step', jholGrid);
  const jholBowl  = $('.jhol__bowl', jholGrid);
  const jholCount = $('[data-jhol-step]');

  const STATES = [
    { fill:0, momos:0, garnish:0, steam:0 },
    { fill:0, momos:1, garnish:0, steam:1 },
    { fill:1, momos:1, garnish:0, steam:1 },
    { fill:1, momos:1, garnish:1, steam:.5 }
  ];
  let jholAt = -1;

  function paintJhol(i){
    if (i === jholAt || !jholBowl) return;
    jholAt = i;
    const s = STATES[i] || STATES[3];
    jholBowl.style.setProperty('--fill', s.fill);
    jholBowl.style.setProperty('--momos', s.momos);
    jholBowl.style.setProperty('--garnish', s.garnish);
    jholBowl.style.setProperty('--steamOn', s.steam);
    if (jholCount) jholCount.textContent = '0' + (i + 1);
    jholSteps.forEach((st, n) => st.classList.toggle('is-on', n === i));
  }

  function jholScan(){
    if (!jholBowl || !jholSteps.length) return;
    const line = window.innerHeight * 0.58;
    let at = 0;
    jholSteps.forEach((st, n) => {
      if (st.getBoundingClientRect().top < line) at = n;
    });
    paintJhol(at);
  }

  let jholTick = false;
  function queueJhol(){
    if (jholTick) return;
    jholTick = true;
    requestAnimationFrame(() => { jholTick = false; jholScan(); });
  }

  if (jholGrid && jholBowl && jholSteps.length){
    jholGrid.classList.add('is-live');
    paintJhol(0);
    addEventListener('scroll', queueJhol, { passive:true });
  }

  /* ---------------- open / closed, Kolkata time ---------------- */
  const OPEN_MIN  = 17 * 60 + 30;   /* 5:30 pm */
  const CLOSE_MIN = 22 * 60 + 30;   /* 10:30 pm */
  const tube      = $('[data-status]');
  const tubeTxt   = tube ? $('.tube__txt', tube) : null;
  const statusLong = $('[data-status-long]');
  const hoursBody = $('[data-hours]');

  function kolkata(){
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', weekday:'short', hour12:false
    }).formatToParts(new Date());
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const days = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
    let h = Number(get('hour'));
    if (h === 24) h = 0;
    return { day: days[get('weekday')] ?? new Date().getDay(), mins: h * 60 + Number(get('minute')) };
  }

  function clockTxt(m){
    const h24 = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
    const h12 = ((h24 + 11) % 12) + 1;
    return `${h12}:${mm} ${h24 < 12 ? 'am' : 'pm'}`;
  }

  function paintStatus(){
    const { day, mins } = kolkata();
    const open = mins >= OPEN_MIN && mins < CLOSE_MIN;
    const left = CLOSE_MIN - mins;
    const lang = getCurrentLang();
    const short = open
      ? (left <= 30 ? (t('status_closing_soon', lang).replace('%s', clockTxt(CLOSE_MIN))) : t('opens_status_open', lang))
      : (t('opens_status', lang));

    if (tubeTxt) tubeTxt.textContent = short;
    if (tube) tube.classList.toggle('is-open', open);

    if (statusLong){
      statusLong.textContent = open
        ? t('status_open_long', lang).replace('%s', clockTxt(CLOSE_MIN))
        : (mins < OPEN_MIN ? t('status_closed_today', lang).replace('%s', clockTxt(OPEN_MIN)) : t('status_closed_tomorrow', lang).replace('%s', clockTxt(OPEN_MIN)));
      statusLong.classList.toggle('is-open', open);
    }
    if (hoursBody) $$('tr', hoursBody).forEach(tr => tr.classList.toggle('is-today', Number(tr.dataset.day) === day));
  }

  /* ---------------- ticker, tray light, year ---------------- */
  const track = $('[data-ticker]');
  if (track && !track.dataset.doubled) {
    track.innerHTML += track.innerHTML;
    track.dataset.doubled = 'true';
  }

  if (matchMedia('(pointer:fine)').matches && !reduce){
    $$('.tray').forEach(t => t.addEventListener('pointermove', e => {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      t.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }));
  }

  const yr = $('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------- Profile & Settings Drawer ---------------- */
  const profileDrawer = $('#profile-drawer');
  let profileCloseTimer = null;

  function openProfile() {
    if (!profileDrawer) return;
    if (profileCloseTimer) {
      clearTimeout(profileCloseTimer);
      profileCloseTimer = null;
    }
    lastFocus = document.activeElement;
    if (scrim) scrim.hidden = false;
    profileDrawer.hidden = false;
    html.classList.add('is-locked');

    syncProfileUserData();
    renderProfileOrderHistory();
    syncLanguageUI();

    void profileDrawer.offsetWidth;
    requestAnimationFrame(() => {
      if (scrim) scrim.classList.add('is-on');
      profileDrawer.classList.add('is-on');
    });

    const closeBtn = $('[data-profile-close]', profileDrawer);
    if (closeBtn) closeBtn.focus();
  }

  function closeProfile() {
    if (!profileDrawer || profileDrawer.hidden) return;
    if (profileCloseTimer) clearTimeout(profileCloseTimer);

    profileDrawer.classList.remove('is-on');
    if (scrim) scrim.classList.remove('is-on');
    html.classList.remove('is-locked');

    const hide = () => {
      profileDrawer.hidden = true;
      if (scrim && (!slip || slip.hidden)) scrim.hidden = true;
      profileCloseTimer = null;
    };

    if (reduce) hide();
    else profileCloseTimer = setTimeout(hide, 380);

    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function syncProfileUserData() {
    const nameEl = $('#profile-user-name');
    const emailEl = $('#profile-user-email');
    const btnLogin = $('#btn-profile-login');
    const btnLogout = $('#btn-profile-logout');

    try {
      const raw = localStorage.getItem('glory_auth_user');
      const u = raw ? JSON.parse(raw) : null;
      if (u) {
        if (nameEl) nameEl.textContent = u.name || u.displayName || u.email?.split('@')[0] || 'Member';
        if (emailEl) emailEl.textContent = `${u.email || ''} (${u.role || 'customer'})`;
        if (btnLogin) {
          btnLogin.textContent = 'Switch Account';
          btnLogin.href = 'auth/login.html';
        }
        if (btnLogout) btnLogout.style.display = 'inline-block';
      } else {
        if (nameEl) nameEl.textContent = t('profile_guest');
        if (emailEl) emailEl.textContent = 'Browsing as Guest';
        if (btnLogin) {
          btnLogin.textContent = 'Login';
          btnLogin.href = 'auth/login.html';
        }
        if (btnLogout) btnLogout.style.display = 'none';
      }
    } catch(e) {}
  }

  const btnProfileLogout = $('#btn-profile-logout');
  if (btnProfileLogout) {
    btnProfileLogout.addEventListener('click', () => {
      clearLocalAuthUser();
      syncProfileUserData();
      toast('Logged out of account.');
    });
  }

  $('#btn-open-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    openProfile();
  });
  $('#btn-bar-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    openProfile();
  });
  $('[data-profile-close]')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeProfile();
  });

  /* ---------------- Language Selector ---------------- */
  function syncLanguageUI() {
    const current = getCurrentLang();
    $$('.lang-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.lang === current);
    });
    const labelEl = $('#lang-current-label');
    if (labelEl) {
      const labels = { en: 'English', hi: 'हिन्दी', bn: 'বাংলা' };
      labelEl.textContent = labels[current] || 'English';
    }
  }

  $$('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setLang(lang);
      syncLanguageUI();
      syncProfileUserData();
      toast(`Language set to ${lang === 'hi' ? 'हिन्दी' : (lang === 'bn' ? 'বাংলা' : 'English')}`);
    });
  });

  window.addEventListener('glory_lang_changed', (e) => {
    applyTranslations(e.detail.lang);
    renderTabs();
    renderBoard();
    renderSlip();
    paintStatus();
    updateLiveOrderPill();
    renderProfileOrderHistory();
    syncLanguageUI();
  });

  /* ---------------- Order History & Quick Reorder ---------------- */
  function renderProfileOrderHistory() {
    const listEl = $('#profile-order-history');
    if (!listEl) return;
    const lang = getCurrentLang();

    const orders = getStoredLocalOrders();
    if (!orders || orders.length === 0) {
      listEl.innerHTML = `<p style="color:var(--steel-400); font-size:0.85rem; margin:0;">${t('profile_history_empty', lang)}</p>`;
      return;
    }

    listEl.innerHTML = orders.slice(0, 5).map(o => {
      const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Recently';
      const itemsSummary = (o.items || []).map(i => {
        const loc = getLocalizedItem(i.id, lang);
        return `${i.q}x ${loc ? loc.n : i.id}`;
      }).join(', ');
      const waHelpText = encodeURIComponent(`Hi Glory Momo, I need help with my Order #${o.id.slice(-6).toUpperCase()}`);

      return `
        <div class="reorder-card">
          <div class="reorder-card__head">
            <strong style="color:var(--steel-050);">Order #${o.id.slice(-6).toUpperCase()}</strong>
            <span style="color:var(--turmeric); font-weight:700;">₹${o.total}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--steel-400); margin-bottom:4px;">🕒 ${timeStr} · <span class="order-badge ${o.status}" style="font-size:0.7rem; padding:1px 6px;">${o.status.replace('_', ' ')}</span></div>
          <div style="font-size:0.8rem; color:var(--steel-300); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${itemsSummary || 'Momo Assortment'}
          </div>
          <div class="reorder-card__acts">
            <button type="button" class="btn btn--hot btn-repeat-order" data-order-id="${o.id}">
              <span>🔁 ${t('profile_repeat_order', lang)}</span>
            </button>
            <a class="btn btn--ghost" href="https://wa.me/${PHONE}?text=${waHelpText}" target="_blank" rel="noopener">
              <span>💬 ${lang === 'hi' ? 'सहायता' : (lang === 'bn' ? 'সাহায্য' : 'Help')}</span>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Wire up repeat order buttons
    $$('.btn-repeat-order', listEl).forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.dataset.orderId;
        const ord = orders.find(o => o.id === orderId);
        if (!ord || !ord.items) return;

        ord.items.forEach(it => {
          const matched = MENU.find(m => m.id === it.id || m.n === it.id) || MENU[0];
          if (matched) {
            const existing = items.find(i => i.id === matched.id);
            if (existing) {
              existing.q += Number(it.q || 1);
            } else {
              items.push({ id: matched.id, q: Number(it.q || 1) });
            }
          }
        });

        renderSlip();
        closeProfile();
        openSlip();
        toast(`🔁 Past order items added to your slip!`);
      });
    });
  }

  /* ---------------- Floating Live Order Pill on Homepage ---------------- */
  const livePill = $('#live-order-pill');
  const livePillTitle = $('#live-pill-title');
  const livePillStatus = $('#live-pill-status');
  let currentActiveOrderId = null;

  function updateLiveOrderPill() {
    if (!livePill) return;
    const lang = getCurrentLang();
    const orders = getStoredLocalOrders();
    const active = orders.find(o => ['awaiting_verification', 'pending', 'accepted', 'out_for_delivery'].includes(o.status));

    if (active) {
      currentActiveOrderId = active.id;
      livePill.hidden = false;
      if (livePillTitle) livePillTitle.textContent = `Order #${active.id.slice(-6).toUpperCase()}`;

      const statusMap = {
        'awaiting_verification': lang === 'hi' ? '⚠️ यूपीआई सत्यापन जारी' : (lang === 'bn' ? '⚠️ ইউপিআই যাচাই চলছে' : '⚠️ Verifying UPI'),
        'pending': lang === 'hi' ? '⏳ किचन कतार में है' : (lang === 'bn' ? '⏳ রান্নাঘরে অপেক্ষারত' : '⏳ In Kitchen Queue'),
        'accepted': lang === 'hi' ? '🍳 स्टीमर में पक रहा है' : (lang === 'bn' ? '🍳 ভাপে সেদ্ধ হচ্ছে' : '🍳 In Steamer'),
        'out_for_delivery': lang === 'hi' ? '🚴 डिलीवरी के लिए निकला' : (lang === 'bn' ? '🚴 ডেলিভারি চলছে' : '🚴 Out for Delivery')
      };

      if (livePillStatus) livePillStatus.textContent = statusMap[active.status] || active.status;
      requestAnimationFrame(() => livePill.classList.add('is-on'));
    } else {
      currentActiveOrderId = null;
      livePill.classList.remove('is-on');
      livePill.hidden = true;
    }
  }

  if (livePill) {
    livePill.addEventListener('click', () => {
      if (currentActiveOrderId) {
        window.location.href = `customer/index.html?orderId=${currentActiveOrderId}`;
      } else {
        window.location.href = 'customer/index.html';
      }
    });
  }

  window.addEventListener('glory_local_orders_updated', () => {
    updateLiveOrderPill();
    renderProfileOrderHistory();
  });

  /* ---------------- start execution ---------------- */
  applyTranslations(getCurrentLang());
  syncLanguageUI();
  syncProfileUserData();
  updateLiveOrderPill();
  setInterval(updateLiveOrderPill, 4000);

  renderTabs();
  renderBoard();
  renderSlip();
  reveal();
  paintStatus();
  init3DCardTilt();
  initMagneticButtons();
  setInterval(paintStatus, 60000);
  onScroll();
  jholScan();
