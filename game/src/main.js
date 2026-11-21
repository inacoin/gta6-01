// Costa Verde boot + game loop. Owns the canvas, the frame clock, screen
// transitions (title / pause / wasted / busted / win) and the debug hooks the
// smoke tests use. All rules live in sim.js; this file only drives them.
import { createGame, stepGame, playerCar } from './sim.js';
import { render } from './draw.js';
import { createInput } from './input.js';
import { createSound } from './sound.js';
import { saveGame, loadGame, applySave, hasSave } from './store.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';
import { clamp } from './rng.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shotName = params.get('shot');

const state = createGame(seed);
state.hasSave = hasSave();
const input = createInput(canvas);
const sound = createSound();
let helpOn = false;
let sirenT = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// World position of the mouse, for aiming: invert the camera transform.
function updateAim() {
  const w = canvas.width;
  const h = canvas.height;
  const p = state.player;
  const camX = clamp(p.x - w / 2, 0, Math.max(0, state.city.size - w));
  const camY = clamp(p.y - h / 2, 0, Math.max(0, state.city.size - h));
  state.aim = { x: camX + input.mouseX, y: camY + input.mouseY };
  input.aimX = state.aim.x;
  input.aimY = state.aim.y;
}

function respawn(placeKey, heatTo) {
  const place = state.city.places[placeKey];
  const p = state.player;
  p.car = null;
  p.x = place.x;
  p.y = place.y + 40;
  p.hp = 100;
  p.armor = 50;
  p.mag = 12;
  state.cash = Math.max(0, state.cash - 100);
  state.heat = heatTo;
  state.stars = 0;
  state.cops.length = 0;
  state.gang.length = 0;
  state.screen = 'play';
  state.banner = placeKey === 'hospital' ? 'Kamu bangun di rumah sakit. -$100' : 'Kamu bebas dari kantor polisi. -$100';
  state.bannerT = 4;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  updateAim();
  // Screen transitions, driven by one-shot keys.
  if (state.screen === 'title') {
    if (input.confirm) {
      sound.ensure();
      state.screen = 'play';
      state.banner = 'Selamat datang di Costa Verde. Tekan N untuk misi pertama.';
      state.bannerT = 5;
    } else if (input.cont && state.hasSave) {
      const data = loadGame();
      if (data) {
        applySave(state, data);
        sound.ensure();
        state.screen = 'play';
        state.banner = 'Simpanan dimuat. Lanjutkan aksimu.';
        state.bannerT = 4;
      }
    }
  } else if (state.screen === 'pause') {
    if (input.pause || input.confirm) state.screen = 'play';
  } else if (state.screen === 'wasted') {
    if (input.confirm) respawn('hospital', state.heat / 2);
  } else if (state.screen === 'busted') {
    if (input.confirm) respawn('policeHQ', 0);
  } else if (state.screen === 'win') {
    if (input.confirm) state.screen = 'play';
  } else if (state.screen === 'play') {
    if (input.pause) state.screen = 'pause';
    if (input.help) helpOn = !helpOn;
    if (input.mute) sound.setMuted(!sound.muted);
    stepGame(state, input, dt);
    for (const e of state.events) {
      sound.play(e);
      if (e === 'autosave') saveGame(state);
    }
    const car = playerCar(state);
    sound.engine(car ? car.speed : 0, !!car);
    sirenT -= dt;
    if (state.stars > 0 && sirenT <= 0) {
      sirenT = 1.6;
      sound.siren(true);
    }
  }
  if (helpOn && state.screen === 'play') {
    state.banner = 'WASD gerak/kemudi · SHIFT lari · E curi mobil · Klik tembak · R isi peluru · SPACE rem tangan · N misi · M suara · ESC jeda';
    state.bannerT = 0.2;
  }
  render(state, ctx, { w: canvas.width, h: canvas.height });
  input.endFrame();
  // Status line for screen readers — and for the automated smoke tests.
  statusEl.textContent = JSON.stringify({
    screen: state.screen,
    cash: state.cash,
    stars: state.stars,
    hp: Math.round(state.player.hp),
    mission: state.mission.idx,
    missionActive: state.mission.active,
    inCar: state.player.car !== null,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    gang: state.gang.length,
    cops: state.cops.length,
  });
}

// Debug hooks for the smoke tests (tools/smoke.mjs). They only drive the
// public rules — no cheats a player could not do by playing.
window.__game = {
  state,
  input,
  start: () => { state.screen = 'play'; },
  startMission: () => startMission(state),
  teleport: (x, y) => {
    state.player.x = x;
    state.player.y = y;
    const car = playerCar(state);
    if (car) { car.x = x; car.y = y; }
  },
  setHeat: (v) => { state.heat = v; },
  save: () => saveGame(state),
  load: () => {
    const d = loadGame();
    if (d) applySave(state, d);
    return !!d;
  },
};

if (shotName) {
  // Screenshot mode: stage the scene synchronously, paint one frame, stop.
  const staged = stageShot(shotName, state, stepGame);
  state.screen = staged.screen;
  updateAim();
  render(state, ctx, { w: canvas.width, h: canvas.height });
  statusEl.textContent = JSON.stringify({
    screen: state.screen, cash: state.cash, stars: state.stars,
    hp: Math.round(state.player.hp), mission: state.mission.idx,
    missionActive: state.mission.active, inCar: state.player.car !== null,
    x: Math.round(state.player.x), y: Math.round(state.player.y),
    gang: state.gang.length, cops: state.cops.length,
  });
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
