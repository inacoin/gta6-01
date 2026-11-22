// Costa Verde weather: clear skies and sudden tropical storms. A storm
// rolls in on a seeded schedule (long clear spells, shorter storms), brings
// driving rain, a darker sky, wet roads and lightning — each strike flashes
// the screen white and rumbles thunder through sound.js. The renderer draws
// the rain deterministically from the game clock, so a frozen screenshot
// frame always shows the same drops.
import { clamp } from './rng.js';

export function createWeather(rng) {
  return {
    kind: 'clear', // 'clear' | 'storm'
    changeIn: 70 + rng() * 60, // seconds until the weather flips
    flash: 0, // lightning flash, 1 right after a strike, decays to 0
    nextFlash: 5, // seconds until the next strike during a storm
    boltX: 0.5, // horizontal position of the last bolt, 0..1 across the view
    boltSeed: 0, // shapes the bolt's jagged path
  };
}

// True while a storm is overhead — the renderer and HUD read this.
export function isStorm(state) {
  return state.weather && state.weather.kind === 'storm';
}

export function weatherLabel(state) {
  return isStorm(state) ? '🌧 BADAI' : '☀ CERAH';
}

// Force a storm right now (screenshot staging + smoke tests). The flash is
// set high so the staged frame catches the bolt mid-sky.
export function setStorm(state) {
  const w = state.weather;
  w.kind = 'storm';
  w.changeIn = 9999;
  w.flash = 0.9;
  w.nextFlash = 999;
  w.boltX = 0.68;
  w.boltSeed = 7;
}

export function setClear(state) {
  const w = state.weather;
  w.kind = 'clear';
  w.changeIn = 9999;
  w.flash = 0;
}

export function stepWeather(state, dt) {
  const w = state.weather;
  if (!w) return;
  if (w.flash > 0) w.flash = Math.max(0, w.flash - dt * 1.6);
  w.changeIn -= dt;
  if (w.changeIn <= 0) {
    if (w.kind === 'clear') {
      w.kind = 'storm';
      w.changeIn = 40 + state.rng() * 30;
      w.nextFlash = 1.5 + state.rng() * 2;
      state.banner = 'Badai datang! Hujan deras dan petir menyambar Costa Verde.';
      state.bannerT = 4;
    } else {
      w.kind = 'clear';
      w.changeIn = 90 + state.rng() * 120;
      w.flash = 0;
    }
    return;
  }
  if (w.kind === 'storm') {
    w.nextFlash -= dt;
    if (w.nextFlash <= 0) {
      // Lightning: full flash, a bolt somewhere over the camera, thunder.
      w.flash = 1;
      w.boltX = 0.15 + state.rng() * 0.7;
      w.boltSeed = Math.floor(state.rng() * 1000);
      w.nextFlash = 4 + state.rng() * 8;
      state.events.push('thunder');
    }
  }
}

// Deterministic rain-drop layout for one frame: `n` slanted streaks across
// a view of w×h, falling with the game clock. Pure function of (clock, i),
// so a frozen screenshot repaints the exact same rain every frame.
export function rainDrop(i, w, h, clock) {
  const x0 = ((i * 137.508) % (w + 60)) - 30;
  const fall = (clock * 620 + i * 61.7) % (h + 40);
  const y = fall - 20;
  // Wind slants the drops; the slant grows with the drop's speed.
  const x = (x0 + fall * 0.22) % (w + 60) - 30;
  return { x, y, len: 13 + (i % 5) * 2 };
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}
