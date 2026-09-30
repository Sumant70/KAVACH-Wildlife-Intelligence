// Tactical Audio Synthesizer & Siren Controller for KAVACH
// Dual-Mode Audio: Native Web Audio API + Local /siren.mp3
// 100% dependable on any desktop or mobile browser with zero paid services

let audioCtx = null;
let isMuted = false;
let audioActivated = false;
let sirenLoopTimer = null;
let activeSirenOsc = null;
let activeSirenGain = null;
let audioTag = null;

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioActivated() {
  if (audioActivated) return true;
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("kavach_audio_unlocked") === "true";
    }
  } catch (e) {}
  return false;
}

export function activateAudio() {
  audioActivated = true;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("kavach_audio_unlocked", "true");
    }
  } catch (e) {}

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  // Pre-warm HTML5 audio element completely silently (zero audible sound)
  try {
    if (!audioTag && typeof window !== "undefined") {
      audioTag = new Audio("/siren.mp3");
      audioTag.volume = 0.001;
      const playPromise = audioTag.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          audioTag.pause();
          audioTag.currentTime = 0;
          audioTag.volume = 1.0;
        }).catch(() => {
          // Autoplay permission established
        });
      }
    }
  } catch (e) {
    console.warn("[AUDIO] Pre-warm failed, falling back to WebAudio oscillator", e);
  }

  // SILENT UNLOCK ONLY — User activation must NEVER play a chime, alert, or siren
  return true;
}

export function setAudioMuted(muted) {
  isMuted = muted;
  if (muted) {
    stopContinuousSiren();
  }
}

export function getAudioMuted() {
  return isMuted;
}

// Phone vibration support
export function isVibrationSupported() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function vibratePhone(pattern = [200, 100, 200, 100, 500]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Vibration failed:", e);
    }
  }
}

export function stopPhoneVibration() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch (e) {
      // ignore
    }
  }
}

// 1. Continuous Emergency Siren (loops until stopped)
export function startContinuousSiren() {
  if (isMuted) return;

  // 1. Try HTML5 Audio /siren.mp3
  try {
    if (!audioTag && typeof window !== "undefined") {
      audioTag = new Audio("/siren.mp3");
    }
    if (audioTag) {
      audioTag.loop = true;
      audioTag.volume = 1.0;
      audioTag.play().catch(() => {
        // Autoplay may be restricted if user hasn't clicked activate
      });
    }
  } catch (e) {
    console.warn("Audio element error:", e);
  }

  // 2. Synthesize continuous oscillating wail with Web Audio API for guaranteed coverage
  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (activeSirenOsc) {
        stopContinuousSiren();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(650, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      activeSirenOsc = osc;
      activeSirenGain = gain;

      // Cycle frequency periodically for realistic wailing siren
      let high = false;
      sirenLoopTimer = setInterval(() => {
        if (!activeSirenOsc || !audioCtx) return;
        try {
          const now = audioCtx.currentTime;
          activeSirenOsc.frequency.cancelScheduledValues(now);
          if (high) {
            activeSirenOsc.frequency.exponentialRampToValueAtTime(600, now + 0.35);
          } else {
            activeSirenOsc.frequency.exponentialRampToValueAtTime(950, now + 0.35);
          }
          high = !high;
        } catch (e) {
          // ignore
        }
      }, 400);

    } catch (e) {
      console.warn("WebAudio siren oscillator error:", e);
    }
  }

  // Trigger tactile vibration
  vibratePhone([300, 150, 300, 150, 600]);
}

export function stopContinuousSiren() {
  // 1. Stop HTML5 audio
  if (audioTag) {
    try {
      audioTag.pause();
      audioTag.currentTime = 0;
    } catch (e) {
      // ignore
    }
  }

  // 2. Stop oscillator
  if (sirenLoopTimer) {
    clearInterval(sirenLoopTimer);
    sirenLoopTimer = null;
  }
  if (activeSirenOsc) {
    try {
      activeSirenOsc.stop();
      activeSirenOsc.disconnect();
    } catch (e) {
      // ignore
    }
    activeSirenOsc = null;
  }
  if (activeSirenGain) {
    try {
      activeSirenGain.disconnect();
    } catch (e) {
      // ignore
    }
    activeSirenGain = null;
  }

  // Stop vibration
  stopPhoneVibration();
}

// 2. One-shot emergency alarm tone
export function playEmergencyAlarm() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.6);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.9);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.1);
  } catch (e) {
    console.warn("Audio alarm playback error:", e);
  }

  vibratePhone([200, 100, 200]);
}

// 3. Tactical Radar Ping (when new detection is recorded)
export function playRadarPing() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn("Radar ping playback error:", e);
  }
}

// 4. Positive Confirmation Chime
export function playSuccessChime() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.08, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  } catch (e) {
    console.warn("Chime error:", e);
  }
}
