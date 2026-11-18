// STACKS — synthesized spooky sounds (browser only).
// Every sound is generated with the WebAudio API: no audio files, no network.
// All failures degrade silently to a no-op so the player never breaks.

let ctx = null;
let master = null;

function getContext() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

function noiseBuffer(context, seconds, brown = false) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function playNoise(context, { seconds, type = "lowpass", freq = 800, gain = 0.5, brown = false, sweepTo = null }) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, seconds, brown);
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  if (sweepTo !== null) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), context.currentTime + seconds);
  }
  const g = context.createGain();
  g.gain.setValueAtTime(gain, context.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
  source.connect(filter).connect(g).connect(master);
  source.start();
  source.stop(context.currentTime + seconds);
  return seconds;
}

function playTone(context, { freq, endFreq = null, seconds, type = "sine", gain = 0.3, at = 0 }) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime + at);
  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), context.currentTime + at + seconds);
  }
  const g = context.createGain();
  g.gain.setValueAtTime(0.0001, context.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, context.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + at + seconds);
  osc.connect(g).connect(master);
  osc.start(context.currentTime + at);
  osc.stop(context.currentTime + at + seconds + 0.05);
  return at + seconds;
}

const SOUND_DEFS = {
  // A door hinge: sawtooth gliding down with a tremble.
  creak(context) {
    playTone(context, { freq: 320, endFreq: 140, seconds: 0.7, type: "sawtooth", gain: 0.08 });
    playTone(context, { freq: 640, endFreq: 300, seconds: 0.5, type: "triangle", gain: 0.05, at: 0.1 });
    return 0.8;
  },
  // Distant thunder: brown noise through a low filter.
  thunder(context) {
    playNoise(context, { seconds: 1.8, type: "lowpass", freq: 220, gain: 0.9, brown: true, sweepTo: 60 });
    return 1.8;
  },
  // A bright little chime arpeggio.
  chime(context) {
    [880, 1174.7, 1568].forEach((freq, i) => {
      playTone(context, { freq, seconds: 0.9, type: "sine", gain: 0.18, at: i * 0.12 });
    });
    return 1.2;
  },
  // Two knocks on a wooden door.
  knock(context) {
    [0, 0.35].forEach((at) => {
      playTone(context, { freq: 110, endFreq: 55, seconds: 0.16, type: "sine", gain: 0.7, at });
    });
    return 0.6;
  },
  // Wind through the tower: bandpassed noise sweeping up and down.
  wind(context) {
    playNoise(context, { seconds: 2.2, type: "bandpass", freq: 500, gain: 0.25, sweepTo: 1200 });
    return 2.2;
  },
  // A whisper: quiet bandpassed noise with a shaky gain.
  whisper(context) {
    playNoise(context, { seconds: 1.4, type: "bandpass", freq: 2400, gain: 0.12 });
    playTone(context, { freq: 1200, endFreq: 900, seconds: 1.2, type: "sine", gain: 0.03 });
    return 1.4;
  },
};

export const SOUND_NAMES = Object.keys(SOUND_DEFS);

/**
 * Play a synthesized sound by name. Resolves when the sound finishes.
 * Never throws: unknown names and missing WebAudio resolve immediately.
 */
export function playSound(name) {
  const context = getContext();
  const def = SOUND_DEFS[name];
  if (!context || !def) return Promise.resolve();
  try {
    if (context.state === "suspended") void context.resume();
    const seconds = def(context) || 0;
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  } catch {
    return Promise.resolve();
  }
}
