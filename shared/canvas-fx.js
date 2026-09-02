/**
 * Glory Momo — Cosmic Broth & Ember Nebula Canvas Reactor
 * Single Signature Obsidian Ember & Spiced Jhol dynamic fluid particle engine
 * rendering rising aromatic steam curls, glowing spices, and mouse-gravity vortexes.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SIGNATURE_PROFILE = {
  name: 'Obsidian Ember & Spiced Jhol',
  colors: ['#FF7315', '#FFB703', '#FF451A', '#FF9F1C', '#E9A21B'],
  speedMult: 1.0,
  glowSize: 18,
  density: 50,
  themeColor: '#FF7315',
  jholColor: '#FF451A'
};

let canvas = null;
let ctx = null;
let particles = [];
let animationFrameId = null;
let mouse = { x: -1000, y: -1000, radius: 140, isHovering: false };
let width = 0;
let height = 0;

class Particle {
  constructor(w, h, profile) {
    this.reset(w, h, profile, true);
  }

  reset(w, h, profile, initial = false) {
    this.x = Math.random() * w;
    this.y = initial ? Math.random() * h : h + 15 + Math.random() * 20;
    this.radius = 1.5 + Math.random() * 3.5;
    this.color = profile.colors[Math.floor(Math.random() * profile.colors.length)];
    this.vy = -(0.4 + Math.random() * 0.9) * profile.speedMult;
    this.vx = (Math.random() - 0.5) * 0.5 * profile.speedMult;
    this.alpha = 0.15 + Math.random() * 0.65;
    this.maxAlpha = this.alpha;
    this.decay = 0.0015 + Math.random() * 0.003;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.02 + Math.random() * 0.03;
    this.isSteam = Math.random() > 0.6;
    if (this.isSteam) {
      this.radius = 6 + Math.random() * 14;
      this.alpha = 0.04 + Math.random() * 0.08;
      this.maxAlpha = this.alpha;
    }
  }

  update(w, h, profile, mouse) {
    this.wobble += this.wobbleSpeed;
    this.x += this.vx + Math.sin(this.wobble) * 0.35;
    this.y += this.vy;
    this.alpha -= this.decay;

    // Mouse magnetic vortex / repulsion physics
    if (mouse.x > 0 && mouse.y > 0) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouse.radius) {
        const force = (1 - dist / mouse.radius) * 1.5;
        this.x += (dx / dist) * force * 1.2;
        this.y += (dy / dist) * force * 1.2;
        this.alpha = Math.min(this.maxAlpha * 1.5, 0.9);
      }
    }

    if (this.y < -30 || this.alpha <= 0) {
      this.reset(w, h, profile, false);
    }
  }

  draw(ctx, profile) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);

    if (this.isSteam) {
      // Soft diffused steam cloud
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, 'rgba(255, 245, 230, 0.18)');
      grad.addColorStop(0.7, 'rgba(255, 183, 3, 0.05)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Radiant Glowing Ember Spark
      ctx.shadowColor = this.color;
      ctx.shadowBlur = profile.glowSize;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function initCanvasReactor(canvasId = 'cosmic-nebula-canvas') {
  if (reduceMotion) return;

  canvas = document.getElementById(canvasId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
      opacity: 0.85;
      transition: opacity 0.5s ease;
    `;
    document.body.prepend(canvas);
  }

  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize, { passive: true });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.isHovering = true;
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
    mouse.isHovering = false;
  });

  applySignatureTheme();
  populateParticles();
  startLoop();
}

function resize() {
  if (!canvas) return;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}

function applySignatureTheme() {
  const root = document.documentElement;
  root.style.setProperty('--scoville-theme', SIGNATURE_PROFILE.themeColor);
  root.style.setProperty('--scoville-jhol', SIGNATURE_PROFILE.jholColor);
  root.style.setProperty('--scoville-glow', `0 0 25px rgba(255, 115, 21, 0.45)`);
}

function populateParticles() {
  const profile = SIGNATURE_PROFILE;
  const targetCount = window.innerWidth < 768 ? Math.floor(profile.density * 0.45) : profile.density;
  particles = [];
  for (let i = 0; i < targetCount; i++) {
    particles.push(new Particle(width, height, profile));
  }
}

function startLoop() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  function render() {
    if (!ctx || !canvas) return;
    const profile = SIGNATURE_PROFILE;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update(width, height, profile, mouse);
      particles[i].draw(ctx, profile);
    }

    animationFrameId = requestAnimationFrame(render);
  }

  render();
}

export function setScovilleHeat() {
  applySignatureTheme();
}
