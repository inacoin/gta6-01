// The story in three acts: 12 jobs from fixer Doña Carmen. Act 1 is small
// work for a newcomer, Act 2 builds the name, Act 3 ends in one last heist.
// A mission is a list of stages; a stage is done when its `done` check passes.
// Stages can spawn gangsters, set the heat, or demand the player hold a spot.
import { CFG } from './config.js';

// Acts: [first mission idx, last mission idx] plus the story beat each one
// carries. The HUD and the pause screen read this, so the outline shows the
// three-act structure plainly.
export const ACTS = [
  { name: 'Babak 1 — Pendatang', from: 0, to: 3, tagline: 'Baru tiba di Costa Verde. Carmen memberimu pekerjaan kecil.' },
  { name: 'Babak 2 — Naik Daun', from: 4, to: 7, tagline: 'Namamu mulai dikenal. Pekerjaan makin besar, musuh makin banyak.' },
  { name: 'Babak 3 — El Gran Golpe', from: 8, to: 11, tagline: 'Satu pukulan terakhir: rampok habis-habisan, lalu hilang.' },
];

export function actOf(idx) {
  for (let a = 0; a < ACTS.length; a++) {
    if (idx >= ACTS[a].from && idx <= ACTS[a].to) return a;
  }
  return ACTS.length - 1;
}

export function actName(idx) {
  return ACTS[actOf(idx)].name;
}

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
    name: 'Misi 6 — Asalto al Banco',
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
  {
    name: 'Misi 7 — Taxista Verde',
    brief: 'Jadi sopir taksi sehari: jemput penumpang, antar ke hotel sebelum waktu habis.',
    reward: CFG.missionReward[6],
    onComplete(s) {
      // Speed bonus: $5 per second left on the 75-second delivery clock.
      const left = Math.max(0, Math.round(75 - s.mission.stageT));
      const bonus = left * 5;
      if (bonus > 0) s.cash += bonus;
      return bonus;
    },
    stages: [
      {
        text: 'Pergi ke Pangkalan Taksi di La Marina',
        target: (s) => atPlace(s, 'taxiStand'), r: 60,
        onEnter(s) {
          if (!s._taxiCar) {
            const spot = atPlace(s, 'taxiStand');
            const car = {
              id: 501, x: spot.x + 20, y: spot.y, angle: 0, speed: 0,
              model: 5, name: 'Taxi', color: '#f1c40f', parked: true,
              traffic: false, driver: false, hp: 100, smoke: 0,
            };
            s.cars.push(car);
            s._taxiCar = 501;
          }
        },
      },
      {
        text: 'Naik taksi kuningmu (tekan E di dekatnya)',
        target: (s) => atPlace(s, 'taxiStand'), r: 90,
        done: (s) => s.player.car === 501,
      },
      {
        text: 'Antar penumpang ke Hotel Playa Verde — 75 detik!',
        target: (s) => atPlace(s, 'hotel'), r: 70,
        timeLimit: 75,
        onEnter(s) {
          s.banner = 'Penumpang naik! 75 detik menuju hotel — ngebut!';
          s.bannerT = 4;
        },
        done: (s) => s.player.car === 501 && near(s, atPlace(s, 'hotel'), 70),
      },
    ],
  },
  {
    name: 'Misi 8 — La Gran Carrera',
    brief: 'Balapan jalanan liar: lewati 3 gerbang — Dermaga, Pantai, Pondok — secepat mungkin.',
    reward: CFG.missionReward[7],
    onComplete(s) {
      // Sub-2:30 total earns a $500 record bonus.
      const bonus = s.mission.timerT < 150 ? 500 : 0;
      if (bonus > 0) s.cash += bonus;
      return bonus;
    },
    stages: [
      {
        text: 'Ke garis start di Banco Verde',
        target: (s) => atPlace(s, 'bank'), r: 70,
        onEnter(s) {
          s.banner = 'Balapan jalanan! Gerbang: Dermaga 7 → Playa Verde → Pondok Carmen.';
          s.bannerT = 5;
        },
      },
      { text: 'Gerbang 1/3: Dermaga 7 di Puerto Norte', target: (s) => atPlace(s, 'docks'), r: 80 },
      { text: 'Gerbang 2/3: Playa Verde', target: (s) => atPlace(s, 'beach'), r: 80 },
      { text: 'Gerbang 3/3: Pondok Carmen — FINISH!', target: (s) => atPlace(s, 'hideout'), r: 80 },
    ],
  },
  {
    name: 'Misi 9 — La Venganza',
    brief: 'Los Halcones membalas di Gudang 12. Balas mereka, lalu pulang ke pondok.',
    reward: CFG.missionReward[8],
    stages: [
      {
        text: 'Pergi ke Gudang 12 — Los Halcones menunggu',
        target: (s) => atPlace(s, 'warehouse'), r: 80,
      },
      {
        text: 'Balas dendam: habisi semua Los Halcones di gudang (8 orang)',
        target: (s) => atPlace(s, 'warehouse'), r: 240,
        onEnter(s) {
          if (!s._revengeAmbush) {
            s._revengeAmbush = true;
            const w = atPlace(s, 'warehouse');
            spawnGang(s, w.x, w.y, 8);
          }
        },
        done: (s) => s.gang.length === 0,
      },
      {
        text: 'Kembali ke Pondok Carmen, laporkan ke Doña Carmen',
        target: (s) => atPlace(s, 'hideout'), r: 80,
      },
    ],
  },
  {
    name: 'Misi 10 — El Informante',
    brief: 'Jemput informan di Bar La Luna, antar ke Dermaga 7 sebelum dia ketahuan.',
    reward: CFG.missionReward[9],
    onComplete(s) {
      // Speed bonus: $5 per second left on the 90-second escape clock.
      const left = Math.max(0, Math.round(90 - s.mission.stageT));
      const bonus = left * 5;
      if (bonus > 0) s.cash += bonus;
      return bonus;
    },
    stages: [
      {
        text: 'Pergi ke Bar La Luna dan jemput informan',
        target: (s) => atPlace(s, 'bar'), r: 60,
        onEnter(s) {
          s.banner = 'Informan naik! Dia membawa daftar nama Los Halcones.';
          s.bannerT = 4;
        },
      },
      {
        text: 'Antar informan ke Dermaga 7 — 90 detik, jangan sampai ketahuan!',
        target: (s) => atPlace(s, 'docks'), r: 70,
        timeLimit: 90,
        onEnter(s) {
          s.banner = 'Kabur ke Dermaga 7! 90 detik sebelum geng itu sadar.';
          s.bannerT = 4;
        },
      },
    ],
  },
  {
    name: 'Misi 11 — Dinero Sucio',
    brief: 'Kumpulkan uang kotor di tiga titik kota, lalu bawa ke pondok Carmen.',
    reward: CFG.missionReward[10],
    stages: [
      {
        text: 'Ambil setoran pertama di Casino Oro, El Centro',
        target: (s) => atPlace(s, 'casino'), r: 70,
        onEnter(s) { s.banner = 'Setoran 1/3: uang kasino. Jangan berhenti lama.'; s.bannerT = 3; },
      },
      {
        text: 'Ambil setoran kedua di Hotel Playa Verde',
        target: (s) => atPlace(s, 'hotel'), r: 70,
        onEnter(s) { s.banner = 'Setoran 2/3: uang hotel.'; s.bannerT = 3; },
      },
      {
        text: 'Ambil setoran terakhir di Playa Verde',
        target: (s) => atPlace(s, 'beach'), r: 70,
        onEnter(s) { s.banner = 'Setoran 3/3: uang pantai. Semua terkumpul!'; s.bannerT = 3; },
      },
      {
        text: 'Bawa semua uang ke Pondok Carmen',
        target: (s) => atPlace(s, 'hideout'), r: 80,
      },
    ],
  },
  {
    name: 'Misi 12 — El Gran Golpe',
    brief: 'FINALE: bobol Banco Verde, lawan seluruh geng, kabur naik perahu dari pantai.',
    reward: CFG.missionReward[11],
    stages: [
      {
        text: 'FINALE — Pergi ke Banco Verde. Ini dia.',
        target: (s) => atPlace(s, 'bank'), r: 70,
        onEnter(s) {
          s.banner = 'EL GRAN GOLPE: bobol bank, lawan geng, kabur ke pantai!';
          s.bannerT = 5;
        },
      },
      {
        text: 'Bobol brankas utama! Bertahan 10 detik di dalam bank',
        target: (s) => atPlace(s, 'bank'), r: 70,
        hold: 10,
        onEnter(s) {
          s.banner = 'Alarm berbunyi! Seluruh kota mengejarmu!';
          s.bannerT = 3;
          s.heat = Math.max(s.heat, 70);
          s.stars = CFG.starsFor(s.heat);
          s.lastCrime = s.clock;
        },
        done: (s) => s.mission.holdT >= 10,
      },
      {
        text: 'Los Halcones menyerbu bank! Habisi mereka semua (10 orang)',
        target: (s) => atPlace(s, 'bank'), r: 260,
        onEnter(s) {
          if (!s._finaleAmbush) {
            s._finaleAmbush = true;
            const b = atPlace(s, 'bank');
            spawnGang(s, b.x, b.y, 10);
          }
        },
        done: (s) => s.gang.length === 0,
      },
      {
        text: 'KABUR! Lari ke perahu di Playa Verde — 120 detik!',
        target: (s) => atPlace(s, 'beach'), r: 80,
        timeLimit: 120,
        onEnter(s) {
          s.banner = 'Perahu menunggumu di pantai. LARI!';
          s.bannerT = 4;
        },
      },
    ],
  },
];

export function missionState(idx) {
  return { idx, active: false, stage: 0, holdT: 0, entered: false, timerT: 0, stageT: 0 };
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
  m.timerT = 0;
  m.stageT = 0;
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
  m.timerT += dt;
  m.stageT += dt;
  const stage = def.stages[m.stage];
  if (!stage) return;
  if (!m.entered) {
    m.entered = true;
    m.stageT = 0;
    if (stage.onEnter) stage.onEnter(state);
    if (stage.text) {
      state.banner = stage.text;
      state.bannerT = 4;
    }
  }
  // A timed stage that runs out fails the mission; N retries it.
  if (stage.timeLimit && m.stageT > stage.timeLimit) {
    m.active = false;
    m.stage = 0;
    m.holdT = 0;
    m.entered = false;
    state.banner = `${def.name} GAGAL — waktu habis! Tekan N untuk coba lagi.`;
    state.bannerT = 5;
    state.events.push('missionFail');
    return;
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
      const bonus = def.onComplete ? def.onComplete(state) || 0 : 0;
      state.cash += def.reward + bonus;
      state.stats.missions++;
      state.banner = `${def.name} SELESAI! +$${def.reward + bonus}`;
      state.bannerT = 5;
      state.events.push('mission');
      state.events.push('autosave');
      m.idx++;
      m.active = false;
      m.stage = 0;
    }
  }
}
