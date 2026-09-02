/**
 * Glory Momo — Procedural Street-Food ASMR Sound Synthesizer
 * 100% Web Audio API procedural synthesis (Zero audio files needed, 0-byte latency).
 * Produces crisp street-kitchen textures: sizzling momos, bubbling jhol, flame whooshes, and Tibetan singing bowl chimes.
 */

let audioCtx = null;
let isAudioEnabled = false;
let ambientGainNode = null;
let ambientNoiseNode = null;
let ambientFilterNode = null;
let isAmbientPlaying = false;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function initAudio() {
  const stored = localStorage.getItem('glory_asmr_audio');
  isAudioEnabled = stored === 'true';
  updateAudioUiState();
}

export function toggleAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;

  isAudioEnabled = !isAudioEnabled;
  localStorage.setItem('glory_asmr_audio', String(isAudioEnabled));
  updateAudioUiState();

  if (isAudioEnabled) {
    playChime();
    startAmbientKitchen();
  } else {
    stopAmbientKitchen();
  }
  return isAudioEnabled;
}

export function getAudioState() {
  return isAudioEnabled;
}

function updateAudioUiState() {
  const eqBtns = document.querySelectorAll('.asmr-toggle-btn');
  eqBtns.forEach(btn => {
    btn.classList.toggle('is-active', isAudioEnabled);
    btn.setAttribute('aria-pressed', String(isAudioEnabled));
  });
}

/**
 * 1. Gentle Tibetan Singing Bowl Chime (for cart adds, checkout, rewards)
 */
export function playChime(freq = 528) {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  // Gentle harmonic overtone
  osc.frequency.exponentialRampToValueAtTime(freq * 1.002, now + 1.2);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 1.85);
}

/**
 * 2. Sizzling Pan / Steamer Crisp Pop (when adding item or hovering spicy food)
 */
export function playSizzlePop() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.Q.setValueAtTime(3, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * 3. Flame Whoosh / Spice Slider Ignition
 */
export function playFlameWhoosh(intensity = 1) {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  const startFreq = 80 * intensity;
  const endFreq = 240 * intensity;

  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(350 * intensity, now);
  filter.frequency.exponentialRampToValueAtTime(800 * intensity, now + 0.15);
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.35);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.36);
}

/**
 * 4. Jhol Soup Bubble Splash (when dropping ingredients in bowl)
 */
export function playBubbleSplash() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  const f1 = 280 + Math.random() * 160;
  const f2 = f1 + 320;

  osc.frequency.setValueAtTime(f1, now);
  osc.frequency.exponentialRampToValueAtTime(f2, now + 0.08);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.13);
}

/**
 * 5. Subtle Ambient Steamer Hiss (gentle background street-kitchen texture)
 */
export function startAmbientKitchen() {
  if (!isAudioEnabled || isAmbientPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02; // Pink-noise approximation
    lastOut = data[i];
  }

  ambientNoiseNode = ctx.createBufferSource();
  ambientNoiseNode.buffer = buffer;
  ambientNoiseNode.loop = true;

  ambientFilterNode = ctx.createBiquadFilter();
  ambientFilterNode.type = 'bandpass';
  ambientFilterNode.frequency.setValueAtTime(800, ctx.currentTime);
  ambientFilterNode.Q.setValueAtTime(1.5, ctx.currentTime);

  ambientGainNode = ctx.createGain();
  ambientGainNode.gain.setValueAtTime(0.001, ctx.currentTime);
  ambientGainNode.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 2.0);

  ambientNoiseNode.connect(ambientFilterNode);
  ambientFilterNode.connect(ambientGainNode);
  ambientGainNode.connect(ctx.destination);

  ambientNoiseNode.start(0);
  isAmbientPlaying = true;
}

export function stopAmbientKitchen() {
  if (!isAmbientPlaying || !ambientGainNode) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  ambientGainNode.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  setTimeout(() => {
    if (ambientNoiseNode) {
      try { ambientNoiseNode.stop(); } catch(e) {}
      ambientNoiseNode = null;
    }
    isAmbientPlaying = false;
  }, 850);
}
