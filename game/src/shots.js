// Screenshot scenes behind ?shot=start|storm|casino|boat. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a tiny scripted driver, so the frame is what real play looks like and
// the same seed always gives the same frame.
//
// Round 5 staging: the title at golden hour, then the three new headline
// features — a night thunderstorm drive (rain + lightning), the Casino Oro
// interior mid-jackpot, and the Misi 13 sea escape by boat at dusk.
import { startMission } from './missions.js';
import { setStorm } from './weather.js';
import { enterCasino, spinSlots, SLOT_BET } from './casino.js';

const STEP = 1 / 60;
// The clock runs a full day in 240 real seconds, so one second of staging
// moves the game clock 6 minutes. Staging starts before dusk so the final
// frame lands in it (17:00–19:30 is golden hour).
const DUSK_AT = 17.6;

function blankInput() {
  return {
    up: false, down: false, left: false, right: false, run: false,
    handbrake: false, enter: false, reload: false, missionKey: false,
    shoot: false, aimX: 0, aimY: 0,
  };
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * `stepFn` is sim.js's stepGame(state, input, dt). The caller renders one
 * frame afterwards and sets window.__shotReady.
 */
export function stageShot(name, state, stepFn) {
  state.screen = 'play';
  if (name === 'storm') {
    // Night thunderstorm drive: 21:30, rain hammering, a lightning bolt
    // frozen mid-sky over the avenue. The player drives a stolen car down
    // the El Centro avenue through the storm.
    state.time = 21.5 * 3600;
    setStorm(state);
    const spot = state.city.parked[6];
    state.player.x = spot.x - 20;
    state.player.y = spot.y;
    state.screen = 'play';
    stepFn(state, { ...blankInput(), enter: true }, STEP);
    const car = state.cars.find((x) => x.id === state.player.car);
    if (car) {
      car.angle = 0;
      car.x = 900;
      car.y = 1332;
      state.player.x = car.x;
      state.player.y = car.y;
    }
    for (let i = 0; i < 5 / STEP; i++) {
      const cc = state.cars.find((x) => x.id === state.player.car);
      if (!cc) break;
      const input = blankInput();
      input.up = true;
      stepFn(state, input, STEP);
    }
    // Re-light the bolt for the frozen frame: the drive decayed the flash.
    state.weather.flash = 0.9;
    state.weather.boltX = 0.68;
    state.weather.boltSeed = 7;
    state.banner = 'BADAI DI COSTA VERDE — hujan deras, petir menyambar!';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  if (name === 'casino') {
    // Casino Oro interior at night: the player at the second machine, a
    // real three-of-a-kind win on the reels. Spins are the real rule —
    // $25 a spin from the seeded rng — looped until a 5× win lands.
    state.time = 20.5 * 3600;
    state.cash = 5000;
    enterCasino(state);
    const c = state.casino;
    c.x = c.machines[1].x;
    c.y = c.machines[1].y + 110;
    let won = null;
    for (let i = 0; i < 80 && !won; i++) {
      const r = spinSlots(state);
      if (r && r.win >= SLOT_BET * 5) won = r;
    }
    state.banner = won
      ? `JACKPOT DI CASINO ORO! Tiga ${won.reels[0]} — +$${won.win}`
      : 'Casino Oro — mesin slot $25, tiga 7 bayar $500!';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  if (name === 'boat') {
    // Misi 13 "Huida por Mar" at golden hour: the player walks to the beach,
    // boards the Lancha for real, and sails east — wake trailing, sun low
    // over the sea.
    state.time = 17.8 * 3600;
    state.mission.idx = 12;
    startMission(state);
    const b = state.boats[0];
    const beach = state.city.places.beach;
    state.player.x = beach.x;
    state.player.y = beach.y;
    state.player.hp = 100;
    state.player.armor = 100;
    stepFn(state, blankInput(), STEP); // stage 0 completes at the beach
    state.player.x = b.x;
    state.player.y = b.y;
    stepFn(state, { ...blankInput(), enter: true }, STEP); // boards: stage 1 done
    for (let i = 0; i < 3 / STEP; i++) {
      const input = blankInput();
      input.up = true;
      stepFn(state, input, STEP);
    }
    state.banner = 'MISI 13 — HUIDA POR MAR: kabur lewat laut!';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  // start: title screen over a living city at golden hour, a few seconds in.
  state.time = DUSK_AT * 3600;
  for (let i = 0; i < 5 / STEP; i++) stepFn(state, blankInput(), STEP);
  return { screen: 'title' };
}
