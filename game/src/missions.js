// The story: six jobs from fixer Doña Carmen, each one chained to the next.
// A mission is a list of stages; a stage is done when its `done` check passes.
// Stages can spawn gangsters, set the heat, or demand the player hold a spot.
import { CFG } from './config.js';

function atPlace(state, key) {
  const p = state.city.places[key];
  return { x: p.x, y: p.y };
}

function near(state, t, r) {
  const dx = state.player.x - t.x;
  const dy = state.player.y - t.y;
  return dx * dx + dy * dy < r * r;
}

function spawnGang(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    state.gang.push({
      x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 70,
      hp: CFG.enemyHp, cool: 0.5 + i * 0.4,
    });
  }
  state.banner = `Los Halcones menyerang! (${n} orang)`;
  state.bannerT = 3;
}

export const MISSIONS = [
  {
    name: 'Misi 1 — El Encargo',
    brief: 'Ambil paket di kios marina, antar ke Bar La Luna.',
    reward: CFG.missionReward[0],
    stages: [
      { text: 'Pergi ke Kios Marina dan ambil paketnya', target: (s) => atPlace(s, 'marinaKiosk'), r: 60 },
      { text: 'Antar paket ke Bar La Luna di Barrio Viejo', target: (s) => atPlace(s, 'bar'), r: 60 },
    ],
  },
  {
    name: 'Misi 2 — Coche Caliente',
    brief: 'Curilah Flecha kuning di El Centro, antar ke Bengkel Rico.',
    reward: CFG.missionReward[1],
    stages: [
      {
        text: 'Curilah Flecha kuning di El Centro (tekan E di dekatnya)',
        target: (s) => atPlace(s, 'hotCar'), r: 90,
        onEnter(s) {
          if (!s._hotCar) {
            const spot = atPlace(s, 'hotCar');
            const car = {
              id: 500, x: spot.x + 20, y: spot.y, angle: 0, speed: 0,
              model: 2, name: 'Flecha', color: '#e7c60a', parked: true,
              traffic: false, driver: false, hp: 100, smoke: 0,
            };
            s.cars.push(car);
            s._hotCar = 500;
          }
        },
        done: (s) => s.player.car === 500,
      },
      {
        text: 'Antar Flecha ke Bengkel Rico di Zona Industrial',
        target: (s) => atPlace(s, 'garage'), r: 70,
        done: (s) => s.player.car === 500 && near(s, atPlace(s, 'garage'), 70),
      },
    ],
  },
  {
    name: 'Misi 3 — Perder la Cola',
    brief: 'Polisi mengincarmu. Hilang dari radar mereka.',
    reward: CFG.missionReward[2],
    stages: [
      {
        text: 'Kamu diburu! Bintang wanted naik ke 2',
        target: null, r: 0,
        onEnter(s) {
          s.heat = 40;
          s.stars = CFG.starsFor(s.heat);
          s.lastCrime = s.clock;
          s.banner = 'Polisi mengejarmu! Sembunyi sampai bintang hilang.';
          s.bannerT = 4;
        },
        done: (s) => s.stars >= 2,
      },
      {
        text: 'Sembunyi sampai wanted hilang (jauhi polisi, jangan berbuat kriminal)',
        target: null, r: 0,
        done: (s) => s.stars === 0,
      },
    ],
  },
  {
    name: 'Misi 4 — Trato en el Muelle',
    brief: 'Transaksi di Dermaga 7 dijebak. Habisi Los Halcones.',
    reward: CFG.missionReward[3],
    stages: [
      {
        text: 'Pergi ke Dermaga 7 di Puerto Norte',
        target: (s) => atPlace(s, 'docks'), r: 80,
        onEnter(s) { s._dockAmbush = false; },
      },
      {
        text: 'Habisi semua anggota Los Halcones di dermaga',
        target: (s) => atPlace(s, 'docks'), r: 200,
        onEnter(s) {
          if (!s._dockAmbush) {
            s._dockAmbush = true;
            const d = atPlace(s, 'docks');
            spawnGang(s, d.x, d.y, 4);
          }
        },
        done: (s) => s.gang.length === 0,
      },
    ],
  },
  {
    name: 'Misi 5 — Guerra de Almacén',
    brief: 'Gudang 12 dikuasai geng. Bersihkan gudangnya.',
    reward: CFG.missionReward[4],
    stages: [
      {
        text: 'Pergi ke Gudang 12 di Zona Industrial',
        target: (s) => atPlace(s, 'warehouse'), r: 80,
      },
      {
        text: 'Bersihkan gudang: habisi semua Los Halcones',
        target: (s) => atPlace(s, 'warehouse'), r: 220,
        onEnter(s) {
          if (!s._warehouseAmbush) {
            s._warehouseAmbush = true;
            const w = atPlace(s, 'warehouse');
            spawnGang(s, w.x, w.y, 6);
          }
        },
        done: (s) => s.gang.length === 0,
      },
    ],
  },
  {
    name: 'Misi 6 — El Gran Golpe',
    brief: 'Rampok Banco Verde, lalu kabur ke pondok Carmen.',
    reward: CFG.missionReward[5],
    stages: [
      {
        text: 'Pergi ke Banco Verde di El Centro',
        target: (s) => atPlace(s, 'bank'), r: 70,
      },
      {
        text: 'Bobol brankas! Bertahan 8 detik di dalam bank',
        target: (s) => atPlace(s, 'bank'), r: 70,
        hold: 8,
        onEnter(s) {
          s.banner = 'Alarm berbunyi! Polisi datang!';
          s.bannerT = 3;
          s.heat = Math.max(s.heat, 55);
          s.stars = CFG.starsFor(s.heat);
          s.lastCrime = s.clock;
        },
        done: (s) => s.mission.holdT >= 8,
      },
      {
        text: 'Kabur! Kembali ke Pondok Carmen di Las Colinas',
        target: (s) => atPlace(s, 'hideout'), r: 80,
      },
    ],
  },
];

export function missionState(idx) {
  return { idx, active: false, stage: 0, holdT: 0, entered: false };
}

export function currentStage(state) {
  const m = state.mission;
  if (!m.active || m.idx >= MISSIONS.length) return null;
  return MISSIONS[m.idx].stages[m.stage] || null;
}

export function currentTarget(state) {
  const stage = currentStage(state);
  if (!stage || !stage.target) return null;
  return stage.target(state);
}

export function startMission(state) {
  const m = state.mission;
  if (m.active || m.idx >= MISSIONS.length) return false;
  m.active = true;
  m.stage = 0;
  m.holdT = 0;
  m.entered = false;
  state.banner = `${MISSIONS[m.idx].name}: ${MISSIONS[m.idx].brief}`;
  state.bannerT = 5;
  state.events.push('missionStart');
  return true;
}

export function updateMission(state, dt, input) {
  const m = state.mission;
  if (!m.active) {
    if (input && input.missionKey) startMission(state);
    return;
  }
  const def = MISSIONS[m.idx];
  if (!def) return;
  const stage = def.stages[m.stage];
  if (!stage) return;
  if (!m.entered) {
    m.entered = true;
    if (stage.onEnter) stage.onEnter(state);
    if (stage.text) {
      state.banner = stage.text;
      state.bannerT = 4;
    }
  }
  let done = false;
  if (stage.hold) {
    const t = stage.target(state);
    if (near(state, t, stage.r)) {
      m.holdT += dt;
      if (m.holdT >= stage.hold) done = true;
    } else {
      m.holdT = Math.max(0, m.holdT - dt * 0.5);
    }
  } else if (stage.done) {
    done = stage.done(state);
  } else if (stage.target) {
    done = near(state, stage.target(state), stage.r);
  }
  if (done) {
    m.stage++;
    m.holdT = 0;
    m.entered = false;
    if (m.stage >= def.stages.length) {
      state.cash += def.reward;
      state.stats.missions++;
      state.banner = `${def.name} SELESAI! +$${def.reward}`;
      state.bannerT = 5;
      state.events.push('mission');
      state.events.push('autosave');
      m.idx++;
      m.active = false;
      m.stage = 0;
    }
  }
}
