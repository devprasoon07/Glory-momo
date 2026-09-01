/**
 * Glory Momo — Kinetic Motion & Street-Food Micro-Interactions System
 * Engineered with physics springs, magnetic cursor pulls, and ember bursts.
 * Strictly respects prefers-reduced-motion across all utilities.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll reveal observer with staggered wave entrance for [data-rise]
 */
export function initScrollReveal() {
  const elements = document.querySelectorAll('[data-rise]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('is-in'));
    return;
  }

  const groups = new Map();
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const key = el.parentElement || document.body;
      const count = groups.get(key) || 0;
      groups.set(key, count + 1);
      el.style.setProperty('--d', `${Math.min(count, 6) * 90}ms`);
      el.classList.add('is-in');
      obs.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

  elements.forEach(el => observer.observe(el));
}

/**
 * Tactical Add-to-cart burst / pop animation feedback
 */
export function popButton(btn) {
  if (reduceMotion || !btn) return;
  btn.classList.remove('is-pop');
  requestAnimationFrame(() => {
    btn.classList.add('is-pop');
  });
}

/**
 * Ember Spark Particle Burst on interactive taps
 * Spawns radiant neon saffron & fiery jhol sparks that fly outwards
 */
export function triggerEmberBurst(x, y, count = 12) {
  if (reduceMotion) return;

  const container = document.createElement('div');
  container.className = 'ember-burst-container';
  container.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    pointer-events: none;
    z-index: 99999;
  `;
  document.body.appendChild(container);

  const colors = ['#FF451A', '#FFB703', '#FF7315', '#FFC83B', '#10B981'];

  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'ember-spark';
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const distance = 35 + Math.random() * 55;
    const size = 4 + Math.random() * 5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = 500 + Math.random() * 350;

    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 20; // Float slightly upwards

    spark.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      transform: translate(-50%, -50%) scale(1);
      transition: transform ${duration}ms cubic-bezier(0.1, 0.9, 0.2, 1), opacity ${duration}ms ease-out;
      opacity: 1;
    `;
    container.appendChild(spark);

    requestAnimationFrame(() => {
      spark.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
      spark.style.opacity = '0';
    });
  }

  setTimeout(() => {
    container.remove();
  }, 900);
}

/**
 * 3D Dynamic Card Tilt with Specular Glare Tracking
 */
export function init3DCardTilt(selector = '.tilt-card, .tray, .board__item') {
  if (reduceMotion || window.innerWidth < 768) return;

  const cards = document.querySelectorAll(selector);
  cards.forEach(card => {
    if (card.dataset.tiltInit) return;
    card.dataset.tiltInit = 'true';

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -7;
      const rotateY = ((x - centerX) / centerX) * 7;

      card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
      card.style.setProperty('--mouse-x', `${(x / rect.width * 100).toFixed(1)}%`);
      card.style.setProperty('--mouse-y', `${(y / rect.height * 100).toFixed(1)}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });
}

/**
 * Subtle Magnetic Pull for high-priority CTA buttons
 */
export function initMagneticButtons(selector = '.btn--magnetic, .btn--hot, .bar__cart-btn') {
  if (reduceMotion || window.innerWidth < 768) return;

  const btns = document.querySelectorAll(selector);
  btns.forEach(btn => {
    if (btn.dataset.magneticInit) return;
    btn.dataset.magneticInit = 'true';

    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      btn.style.transform = `translate(${x * 0.22}px, ${y * 0.22}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
    });

    btn.addEventListener('click', (e) => {
      triggerEmberBurst(e.clientX, e.clientY, 14);
    });
  });
}

/**
 * Animate numeric counter transition with spring ease
 */
export function animateCounter(element, targetValue, prefix = '', duration = 600) {
  if (reduceMotion || !element) {
    element.textContent = `${prefix}${targetValue}`;
    return;
  }

  const startValue = parseInt(element.textContent.replace(/[^0-9]/g, '') || '0', 10);
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Smooth quintic ease out
    const ease = 1 - Math.pow(1 - progress, 5);
    const current = Math.round(startValue + (targetValue - startValue) * ease);

    element.textContent = `${prefix}${current}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
