// All sound is synthesised live with WebAudio — no audio files. Engine hum,
// sirens, gunshots, pickups and a small procedural music loop built from a
// bass line and a hat, scheduled a bar ahead so it never stutters.
export function createSound() {
  const s = {
    ctx: null, master: null, muted: false, engineOsc: null, engineGain: null,
    musicTimer: null, bar: 0,
    ensure() {
      if (s.ctx) {
        if (s.ctx.state === 'suspended') s.ctx.resume();
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        s.ctx = new AC();
        s.master = s.ctx.createGain();
        s.master.gain.value = 0.5;
        s.master.connect(s.ctx.destination);
        // Engine: a low sawtooth whose pitch follows speed, always running.
        s.engineOsc = s.ctx.createOscillator();
        s.engineOsc.type = 'sawtooth';
        s.engineOsc.frequency.value = 55;
        s.engineGain = s.ctx.createGain();
        s.engineGain.gain.value = 0;
        const filt = s.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 500;
        s.engineOsc.connect(filt);
        filt.connect(s.engineGain);
        s.engineGain.connect(s.master);
        s.engineOsc.start();
        s.startMusic();
        return true;
      } catch {
        return false;
      }
    },
    setMuted(m) {
      s.muted = m;
      if (s.master) s.master.gain.value = m ? 0 : 0.5;
    },
    tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
      if (!s.ctx || s.muted) return;
      const t = s.ctx.currentTime + when;
      const o = s.ctx.createOscillator();
      const g = s.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(s.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.3, freq = 1200) {
      if (!s.ctx || s.muted) return;
      const t = s.ctx.currentTime;
      const len = Math.floor(s.ctx.sampleRate * dur);
      const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = s.ctx.createBufferSource();
      src.buffer = buf;
      const f = s.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      const g = s.ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(s.master);
      src.start(t);
    },
    engine(speed, driving) {
      if (!s.ctx) return;
      const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 520 * 0.12) : 0;
      s.engineGain.gain.setTargetAtTime(s.muted ? 0 : target, s.ctx.currentTime, 0.1);
      s.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.22, s.ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!s.ctx || s.muted) return;
      if (!on) return;
      s.tone(720, 0.28, 'sine', 0.05);
      s.tone(540, 0.28, 'sine', 0.05, 0.3);
    },
    // Procedural loop: Am – F – C – G bass, a soft hat on the off-beat.
    startMusic() {
      const bass = [110, 87.3, 130.8, 98];
      const step = () => {
        if (!s.ctx) return;
        const root = bass[s.bar % 4];
        s.tone(root, 0.5, 'triangle', 0.1);
        s.tone(root / 2, 0.5, 'sine', 0.12);
        s.noise(0.05, 0.03, 6000);
        s.bar++;
      };
      s.musicTimer = setInterval(step, 420);
    },
    play(event) {
      if (!s.ctx) return;
      switch (event) {
        case 'shot': s.noise(0.12, 0.4, 900); s.tone(180, 0.08, 'square', 0.15); break;
        case 'enemyShot': s.noise(0.1, 0.2, 700); break;
        case 'kill': s.tone(220, 0.15, 'square', 0.12); s.tone(110, 0.25, 'square', 0.12, 0.1); break;
        case 'theft': s.tone(660, 0.1, 'square', 0.12); s.tone(880, 0.12, 'square', 0.12, 0.1); break;
        case 'crash': s.noise(0.25, 0.35, 300); break;
        case 'pickup': s.tone(880, 0.09, 'sine', 0.15); s.tone(1320, 0.14, 'sine', 0.15, 0.09); break;
        case 'mission': [523, 659, 784, 1047].forEach((f, i) => s.tone(f, 0.18, 'triangle', 0.16, i * 0.11)); break;
        case 'missionStart': s.tone(392, 0.15, 'triangle', 0.14); s.tone(523, 0.2, 'triangle', 0.14, 0.13); break;
        case 'reload': s.tone(300, 0.06, 'square', 0.1); s.tone(420, 0.06, 'square', 0.1, 0.12); break;
        case 'wasted': [330, 262, 196, 131].forEach((f, i) => s.tone(f, 0.3, 'sawtooth', 0.12, i * 0.22)); break;
        case 'busted': [440, 415, 392].forEach((f, i) => s.tone(f, 0.25, 'square', 0.1, i * 0.2)); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone(f, 0.3, 'triangle', 0.16, i * 0.14)); break;
        default: break;
      }
    },
  };
  return s;
}
