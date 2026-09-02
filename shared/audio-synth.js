/**
 * Glory Momo — Procedural Street-Food ASMR Sound Synthesizer
 * 100% Web Audio API procedural synthesis (Zero audio files needed, 0-byte network overhead).
 * Generates authentic street-kitchen acoustic textures:
 * - Kurkure mouth crunch bursts
 * - High-pressure steamer release hisses
 * - Sizzling tadka & flame whooshes
 * - Spiced Jhol broth pouring & bubble splashes
 * - Soft item removals & downward pops
 * - Melodic doodle swooshes for order placement & coupons
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
    playDoodleSwooshSound();
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
 * 1. Kurkure Mouth Crunch (multi-burst granular fried batter crisp bites)
 */
export function playCrunchSound() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const burstCount = 4;

  for (let b = 0; b < burstCount; b++) {
    const burstTime = now + b * 0.022 + (Math.random() * 0.008);
    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.009));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600 + (b * 650) + Math.random() * 400, burstTime);
    filter.Q.setValueAtTime(4.5, burstTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 / (b * 0.3 + 1), burstTime);
    gain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(burstTime);
  }
}

/**
 * 2. High-Pressure Steamer Release Hiss
 */
export function playSteamHissSound() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.28;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(4800, now);
  filter.frequency.exponentialRampToValueAtTime(2800, now + duration);
  filter.Q.setValueAtTime(2.2, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Pressure whistle overtone
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1180, now);
  osc.frequency.linearRampToValueAtTime(1420, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(620, now + duration);

  oscGain.gain.setValueAtTime(0.03, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  osc.start(now);
  osc.stop(now + duration);
}

/**
 * 3. Tadka Sizzle & Flame Flare Whoosh
 */
export function playTadkaFlameSound(intensity = 1.0) {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Layer A: Sizzling hot mustard oil crackle
  const crackleDuration = 0.32;
  const bufferSize = Math.floor(ctx.sampleRate * crackleDuration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const isPop = Math.random() > 0.94;
    data[i] = isPop ? (Math.random() * 2 - 1) * 1.5 : (Math.random() * 0.2 - 0.1);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.setValueAtTime(3200, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.22, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + crackleDuration);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // Layer B: Flame ignition whoosh
  const osc = ctx.createOscillator();
  const flameGain = ctx.createGain();
  const flameFilter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(65 * intensity, now);
  osc.frequency.exponentialRampToValueAtTime(260 * intensity, now + 0.14);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.36);

  flameFilter.type = 'lowpass';
  flameFilter.frequency.setValueAtTime(300, now);
  flameFilter.frequency.exponentialRampToValueAtTime(850 * intensity, now + 0.14);
  flameFilter.frequency.exponentialRampToValueAtTime(120, now + 0.36);

  flameGain.gain.setValueAtTime(0.01, now);
  flameGain.gain.linearRampToValueAtTime(0.22, now + 0.1);
  flameGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

  osc.connect(flameFilter);
  flameFilter.connect(flameGain);
  flameGain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.37);
}

/**
 * 4. Spiced Jhol Broth Pouring & Bubble Splashes
 */
export function playJholPourSound() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bubbles = 4;

  for (let i = 0; i < bubbles; i++) {
    const bubbleTime = now + (i * 0.045) + Math.random() * 0.02;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 260 + (i * 90) + Math.random() * 120;
    osc.frequency.setValueAtTime(baseFreq, bubbleTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 280, bubbleTime + 0.07);

    gain.gain.setValueAtTime(0.24, bubbleTime);
    gain.gain.exponentialRampToValueAtTime(0.001, bubbleTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(bubbleTime);
    osc.stop(bubbleTime + 0.095);
  }
}

/**
 * 5. Item Deselect / Decrement / Remove Sound (downward suction pop)
 */
export function playItemRemove() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(580, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.115);
}

/**
 * 6. Doodle / Swoosh Melodic Chime (Order placement, coupons, checkout)
 */
export function playDoodleSwooshSound() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

  notes.forEach((freq, idx) => {
    const noteTime = now + idx * 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.01, noteTime + 0.35);

    gain.gain.setValueAtTime(0.2, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.46);
  });

  // Swoosh air glide underneath
  const duration = 0.32;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(3200, now + 0.18);
  filter.frequency.exponentialRampToValueAtTime(600, now + duration);
  filter.Q.setValueAtTime(1.8, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * 7. Dispatcher helper: Plays the contextual ASMR sound matching the item
 */
export function playItemSound(itemOrId) {
  const id = typeof itemOrId === 'string'
    ? itemOrId.toLowerCase()
    : `${itemOrId?.id || ''} ${itemOrId?.g || ''} ${itemOrId?.n || ''}`.toLowerCase();

  if (id.includes('kurkure') || id.includes('fried') || id.includes('pan') || id.includes('crunch')) {
    playCrunchSound();
  } else if (id.includes('tandoori') || id.includes('grill') || id.includes('chilli') || id.includes('chow') || id.includes('schezwan') || id.includes('chatpata') || id.includes('fire') || id.includes('flame')) {
    playTadkaFlameSound();
  } else if (id.includes('jhol') || id.includes('thukpa') || id.includes('drink') || id.includes('soda') || id.includes('tea') || id.includes('water') || id.includes('soup') || id.includes('broth')) {
    playJholPourSound();
  } else {
    playSteamHissSound();
  }
}

/**
 * Legacy Aliases for compatibility
 */
export function playChime(freq = 528) {
  playDoodleSwooshSound();
}

export function playBubbleSplash() {
  playJholPourSound();
}

export function playSizzlePop() {
  playCrunchSound();
}

export function playFlameWhoosh() {
  playTadkaFlameSound();
}

export function playSteamRelease() {
  playSteamHissSound();
}

/**
 * Ambient background steaming texture
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
    data[i] = (lastOut + 0.02 * white) / 1.02;
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
