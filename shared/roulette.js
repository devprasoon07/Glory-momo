/**
 * Glory Momo — Dalle Chili Momo Roulette & Mystery Jhol Drop
 * Gamified reward wheel awarding live instant coupon drops with physics audio and particle bursts.
 */

import { playSizzlePop, playChime } from './audio-synth.js';
import { triggerEmberBurst } from './motion.js';

const PRIZES = [
  { code: 'JHOL25', label: '🔥 25% OFF', desc: 'Flat 25% discount on orders above ₹199', discount: 25, type: 'percent', min: 199 },
  { code: 'FREE_CRUNCH', label: '🧄 Free Garlic Crunch', desc: '₹30 off toppings on any order', discount: 30, type: 'flat', min: 140 },
  { code: 'MOMO50', label: '⚡ ₹50 OFF', desc: '₹50 flat discount on orders above ₹299', discount: 50, type: 'flat', min: 299 },
  { code: 'SUPER_FEAST', label: '👑 35% Super Feast', desc: 'Massive 35% discount on orders above ₹399', discount: 35, type: 'percent', min: 399 },
  { code: 'CHILI_DROP', label: '🌶️ ₹20 Jhol Drop', desc: 'Instant ₹20 off on your next momo bowl', discount: 20, type: 'flat', min: 120 }
];

let isSpinning = false;

export function initMomoRoulette(containerId = 'momo-roulette-mount') {
  const mount = document.getElementById(containerId);
  if (!mount) return;

  renderRoulette(mount);
}

function renderRoulette(mount) {
  const storedCoupon = localStorage.getItem('glory_roulette_won');
  const wonItem = storedCoupon ? JSON.parse(storedCoupon) : null;

  mount.innerHTML = `
    <div class="roulette-box">
      <div class="roulette-header">
        <span class="roulette-badge">🎰 DAILY MYSTERY DROP</span>
        <h3>Spin the Dalle Chili Roulette</h3>
        <p>Unlock secret kitchen discounts, complimentary crispy toppings, and super feast coupons.</p>
      </div>

      <div class="roulette-stage">
        <div class="roulette-wheel-container">
          <div class="roulette-pointer">▼</div>
          <div class="roulette-wheel" id="roulette-wheel-disc">
            ${PRIZES.map((p, idx) => {
              const rot = idx * (360 / PRIZES.length);
              return `
                <div class="wheel-slice" style="--rot: ${rot}deg;">
                  <span>${p.label}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="roulette-hub">🥟</div>
        </div>

        <div class="roulette-action-pane">
          ${wonItem ? `
            <div class="won-reward-card">
              <div class="reward-tag">🎉 ACTIVE REWARD UNLOCKED</div>
              <h4>${wonItem.label}</h4>
              <p>${wonItem.desc}</p>
              <div class="code-pill">CODE: <strong>${wonItem.code}</strong></div>
              <button type="button" class="btn btn--hot btn-apply-won-code" data-code="${wonItem.code}">
                <span>Apply to Order Slip &rarr;</span>
              </button>
            </div>
          ` : `
            <div class="spin-callout">
              <p>Ready for your daily Kolkata spice perk? Spin now to reveal your secret drop!</p>
              <button type="button" class="btn btn--hot btn--magnetic" id="btn-spin-roulette">
                <span>🔥 Spin the Wheel</span>
              </button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  attachRouletteEvents(mount);
}

function attachRouletteEvents(mount) {
  const btnSpin = mount.querySelector('#btn-spin-roulette');
  const wheel = mount.querySelector('#roulette-wheel-disc');

  if (btnSpin && wheel) {
    btnSpin.addEventListener('click', (e) => {
      if (isSpinning) return;
      isSpinning = true;
      btnSpin.disabled = true;

      const prizeIndex = Math.floor(Math.random() * PRIZES.length);
      const chosen = PRIZES[prizeIndex];

      // Audio ticks
      let tickInterval = setInterval(() => {
        playSizzlePop();
      }, 120);

      const segmentAngle = 360 / PRIZES.length;
      const targetDeg = 360 * 5 + (360 - (prizeIndex * segmentAngle + segmentAngle / 2));

      wheel.style.transition = 'transform 3.8s cubic-bezier(0.12, 0.95, 0.2, 1)';
      wheel.style.transform = `rotate(${targetDeg}deg)`;

      setTimeout(() => {
        clearInterval(tickInterval);
        isSpinning = false;
        localStorage.setItem('glory_roulette_won', JSON.stringify(chosen));

        triggerEmberBurst(window.innerWidth / 2, window.innerHeight / 2, 30);
        playChime(720);

        renderRoulette(mount);

        // Auto announce
        window.dispatchEvent(new CustomEvent('glory_roulette_reward', {
          detail: { prize: chosen }
        }));
      }, 4000);
    });
  }

  const btnApply = mount.querySelector('.btn-apply-won-code');
  if (btnApply) {
    btnApply.addEventListener('click', (e) => {
      const code = btnApply.dataset.code;
      window.dispatchEvent(new CustomEvent('glory_apply_coupon_code', {
        detail: { code }
      }));
      triggerEmberBurst(e.clientX, e.clientY, 16);
      playChime(580);
    });
  }
}
