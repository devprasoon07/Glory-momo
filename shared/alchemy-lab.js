/**
 * Glory Momo — The Jhol Alchemy Lab (Interactive Custom Bowl Crafter)
 * Users create their bespoke Kolkata street momo bowl with dynamic broth, spice dials, and toppings.
 * Real-time liquid physics visualizer, live pricing, and 1-click cart integration.
 */

import { playBubbleSplash, playSizzlePop, playFlameWhoosh, playChime } from './audio-synth.js';
import { triggerEmberBurst } from './motion.js';

export const BASES = [
  { id: 'base-chk', name: 'Steamed Darjeeling Chicken', price: 140, icon: '🥟', tag: 'Chef Favorite' },
  { id: 'base-pork', name: 'Juicy Himalayan Pork', price: 160, icon: '🥩', tag: 'Authentic' },
  { id: 'base-pan', name: 'Farmhouse Paneer & Coriander', price: 130, icon: '🧀', tag: 'Pure Veg', isVeg: true },
  { id: 'base-kurk', name: 'Crispy Kurkure Fried Momo', price: 150, icon: '🔥', tag: 'Extra Crunch' }
];

export const BROTHS = [
  { id: 'broth-dalle', name: 'Kathmandu Dalle Sesame Fire Jhol', price: 25, color: '#FF451A', spicy: 3, desc: 'Roasted sesame, charred tomatoes & fiery Dalle khursani chili.' },
  { id: 'broth-darj', name: 'Classic Darjeeling Fragrant Broth', price: 15, color: '#FFB703', spicy: 1, desc: 'Clear aromatic broth slow-simmered with ginger, black pepper & cilantro.' },
  { id: 'broth-datshi', name: 'Molten Bhutanese Ema Datshi Jhol', price: 35, color: '#FFD166', spicy: 2, desc: 'Silky melted yak-style cheese blended with sautéed green chilies.' }
];

export const SPICES = [
  { id: 'sp-mild', name: 'Darjeeling Mild', extra: 0, shu: '5,000 SHU', icon: '🌱' },
  { id: 'sp-street', name: 'Kolkata Street Fire', extra: 0, shu: '40,000 SHU', icon: '🌶️' },
  { id: 'sp-volcano', name: 'Volcanic Dalle Rush', extra: 10, shu: '150,000 SHU', icon: '🌋' },
  { id: 'sp-ghost', name: 'Ghost Pepper Inferno', extra: 20, shu: '1,000,000 SHU', icon: '☠️' }
];

export const TOPPINGS = [
  { id: 'top-garlic', name: 'Crispy Golden Garlic Crunch', price: 15, icon: '🧄' },
  { id: 'top-sesame', name: 'Toasted White Sesame Seeds', price: 10, icon: '✨' },
  { id: 'top-tingle', name: 'Sichuan Tingling Chili Crisp Oil', price: 15, icon: '🌶️' },
  { id: 'top-coriander', name: 'Fresh Himalayan Green Cilantro', price: 5, icon: '🌿' },
  { id: 'top-shallot', name: 'Sweet Caramelized Fried Shallots', price: 15, icon: '🧅' }
];

let customBowl = {
  base: BASES[0],
  broth: BROTHS[0],
  spice: SPICES[1],
  toppings: [TOPPINGS[0], TOPPINGS[3]]
};

export function initAlchemyLab(containerId = 'alchemy-lab-mount') {
  const mount = document.getElementById(containerId);
  if (!mount) return;

  renderAlchemyLab(mount);
}

function computePrice() {
  const basePrice = customBowl.base.price;
  const brothPrice = customBowl.broth.price;
  const spicePrice = customBowl.spice.extra;
  const toppingsPrice = customBowl.toppings.reduce((acc, t) => acc + t.price, 0);
  return basePrice + brothPrice + spicePrice + toppingsPrice;
}

export function renderAlchemyLab(mount) {
  const currentPrice = computePrice();

  mount.innerHTML = `
    <div class="alchemy-grid">
      <!-- Left: Interactive Alchemy 3D Bowl Visualizer -->
      <div class="alchemy-visualizer">
        <div class="alchemy-bowl-card">
          <div class="alchemy-steam-ring"></div>
          <div class="alchemy-bowl-stage" style="--broth-col:${customBowl.broth.color}">
            <div class="alchemy-broth-layer"></div>
            <div class="alchemy-momo-cluster">
              <span class="momo-drop" style="animation-delay: 0s;">${customBowl.base.icon}</span>
              <span class="momo-drop" style="animation-delay: 0.15s;">${customBowl.base.icon}</span>
              <span class="momo-drop" style="animation-delay: 0.3s;">${customBowl.base.icon}</span>
            </div>
            <div class="alchemy-toppings-layer">
              ${customBowl.toppings.map((t, idx) => `
                <span class="topping-float topping-${t.id}" style="--tx:${(idx * 28 - 25)}px; --ty:${(idx % 2 ? 15 : -10)}px;">${t.icon}</span>
              `).join('')}
            </div>
          </div>

          <div class="alchemy-recipe-summary">
            <div class="recipe-title">${customBowl.base.name}</div>
            <div class="recipe-sub">in <strong>${customBowl.broth.name}</strong> (${customBowl.spice.name})</div>
            <div class="recipe-toppings">
              ${customBowl.toppings.length ? 'Garnished with ' + customBowl.toppings.map(t => t.name).join(' · ') : 'No extra garnishes'}
            </div>
          </div>

          <div class="alchemy-price-bar">
            <div class="price-stack">
              <span class="label">Alchemy Total</span>
              <span class="amount" id="alchemy-live-price">₹${currentPrice}</span>
            </div>
            <button type="button" class="btn btn--hot btn--magnetic" id="btn-add-alchemy-bowl">
              <span>Craft & Add to Cart 🍲</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Step-by-Step Customization Controls -->
      <div class="alchemy-controls">
        <!-- 1. Momo Base -->
        <div class="alchemy-step">
          <div class="step-head">
            <span class="step-num">01</span>
            <h4>Choose Your Handcrafted Momo Base</h4>
          </div>
          <div class="pill-grid">
            ${BASES.map(b => `
              <button type="button" class="alchemy-choice-btn ${customBowl.base.id === b.id ? 'is-selected' : ''}" data-type="base" data-id="${b.id}">
                <span class="choice-icon">${b.icon}</span>
                <div class="choice-meta">
                  <strong>${b.name}</strong>
                  <span class="choice-price">₹${b.price} · <em class="tag">${b.tag}</em></span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 2. Jhol Broth -->
        <div class="alchemy-step">
          <div class="step-head">
            <span class="step-num">02</span>
            <h4>Select Steaming Jhol Broth</h4>
          </div>
          <div class="pill-grid">
            ${BROTHS.map(br => `
              <button type="button" class="alchemy-choice-btn ${customBowl.broth.id === br.id ? 'is-selected' : ''}" data-type="broth" data-id="${br.id}">
                <span class="broth-dot" style="background:${br.color};"></span>
                <div class="choice-meta">
                  <strong>${br.name} (+₹${br.price})</strong>
                  <span class="choice-desc">${br.desc}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 3. Scoville Heat Level -->
        <div class="alchemy-step">
          <div class="step-head">
            <span class="step-num">03</span>
            <h4>Dial the Scoville Spice Intensity</h4>
          </div>
          <div class="spice-slider-grid">
            ${SPICES.map(sp => `
              <button type="button" class="spice-btn ${customBowl.spice.id === sp.id ? 'is-selected' : ''}" data-type="spice" data-id="${sp.id}">
                <span class="sp-icon">${sp.icon}</span>
                <strong>${sp.name}</strong>
                <span class="sp-shu">${sp.shu}${sp.extra > 0 ? ' (+₹' + sp.extra + ')' : ''}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 4. Crunch & Garnishes (Multi-select) -->
        <div class="alchemy-step">
          <div class="step-head">
            <span class="step-num">04</span>
            <h4>Garnish, Crunch & Infusions (Select Multiple)</h4>
          </div>
          <div class="toppings-chips">
            ${TOPPINGS.map(top => {
              const isSelected = customBowl.toppings.some(t => t.id === top.id);
              return `
                <button type="button" class="topping-chip ${isSelected ? 'is-selected' : ''}" data-type="topping" data-id="${top.id}">
                  <span>${top.icon} ${top.name}</span>
                  <strong>+₹${top.price}</strong>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  attachEvents(mount);
}

function attachEvents(mount) {
  mount.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = btn.dataset.type;
      const id = btn.dataset.id;

      if (type === 'base') {
        const found = BASES.find(b => b.id === id);
        if (found) {
          customBowl.base = found;
          playSizzlePop();
        }
      } else if (type === 'broth') {
        const found = BROTHS.find(b => b.id === id);
        if (found) {
          customBowl.broth = found;
          playBubbleSplash();
        }
      } else if (type === 'spice') {
        const found = SPICES.find(s => s.id === id);
        if (found) {
          customBowl.spice = found;
          playFlameWhoosh();
        }
      } else if (type === 'topping') {
        const found = TOPPINGS.find(t => t.id === id);
        if (found) {
          const index = customBowl.toppings.findIndex(t => t.id === id);
          if (index > -1) {
            customBowl.toppings.splice(index, 1);
          } else {
            customBowl.toppings.push(found);
            playBubbleSplash();
          }
        }
      }

      renderAlchemyLab(mount);
    });
  });

  const btnAdd = mount.querySelector('#btn-add-alchemy-bowl');
  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      const finalPrice = computePrice();
      const customItem = {
        id: `alchemy_${Date.now().toString(36)}`,
        n: `✨ Custom ${customBowl.base.name}`,
        bn: `কাস্টম ঝোল মোমো বোল`,
        p: finalPrice,
        d: `${customBowl.broth.name} · ${customBowl.spice.name} · ${customBowl.toppings.map(t => t.name).join(', ')}`,
        v: customBowl.base.isVeg || false,
        q: 1,
        isCustom: true
      };

      triggerEmberBurst(e.clientX, e.clientY, 20);
      playChime(640);

      window.dispatchEvent(new CustomEvent('glory_add_custom_item', {
        detail: { item: customItem }
      }));
    });
  }
}
