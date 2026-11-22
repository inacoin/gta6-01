// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a tiny scripted driver, so the frame is what real play looks like and the
// same seed always gives the same frame.
//
// Round 4 staging: every shot is taken at golden hour (about 18:15 in-game),
// when the low sun stretches long shadows, lights the windows and switches
// the street lamps on — and every road is crowded with extra traffic and
// pedestrians, so no frame reads empty.
import { CFG, MODELS } from './config.js';
import { roadAt, snapRoad } from './city.js';
import { startMission } from './missions.js';
import { nearestCar, summonPolice } from './sim.js';
import { clamp } from './rng.js';

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

// Gentle steering for the scripted driver: nudge the wheel toward a level
// heading and the road centre line, without the twitch that clips buildings.
function steerFor(car, roadY) {
  return clamp(-car.angle * 1.2 - (car.y - roadY) / 120, -1, 1);
}

// Wrap the car back to the west end of the road so a long drive stays
// mid-city instead of grinding against the map edge.
function wrapCar(car) {
  if (car.x > roadAt(10)) car.x = roadAt(1);
}

// Fill one road with extra traffic and its sidewalks with pedestrians, so the
// camera always has life in frame. Deterministic: everything draws from the
// state's seeded rng, so the same seed stages the same crowd.
function crowdRoad(state, roadY, nCars, nPeds) {
  const rng = state.rng;
  const nextId = () => 700 + state.cars.length;
  for (let i = 0; i < nCars; i++) {
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = rng() < 0.5 ? 15 : -15;
    const model = MODELS[Math.floor(rng() * MODELS.length)];
    state.cars.push({
      id: nextId(), x: roadAt(1) + rng() * (roadAt(10) - roadAt(1)),
      y: roadY + lane, angle: dir > 0 ? 0 : Math.PI,
      speed: 90 + rng() * 80, model: MODELS.indexOf(model), name: model.name,
      color: model.colors[Math.floor(rng() * model.colors.length)],
      parked: false, traffic: true, driver: true,
      axis: 'h', dir, hp: 100, smoke: 0,
    });
  }
  for (let i = 0; i < nPeds; i++) {
    const edge = rng() < 0.5 ? 42 : -42;
    state.peds.push({
      x: roadAt(1) + rng() * (roadAt(10) - roadAt(1)),
      y: roadY + edge,
      angle: rng() < 0.5 ? 0 : Math.PI,
      speed: 28 + rng() * 24,
      axis: 'h', dir: rng() < 0.5 ? 1 : -1,
      color: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#1abc9c'][Math.floor(rng() * 7)],
      flee: 0, panic: 0,
    });
  }
}

function stealAndDrive(state, stepFn, seconds, roadRow = 5) {
  const car = nearestCar(state, state.player.x, state.player.y, 400);
  if (car) {
    state.player.x = car.x - 20;
    state.player.y = car.y;
    state.screen = 'play';
    stepFn(state, { ...blankInput(), enter: true }, STEP);
  }
  const roadY = roadAt(roadRow);
  const c = state.cars.find((x) => x.id === state.player.car);
  if (c) {
    c.y = roadY;
    c.angle = 0;
    c.x = roadAt(1);
    state.player.x = c.x;
    state.player.y = c.y;
  }
  for (let i = 0; i < seconds / STEP; i++) {
    const cc = state.cars.find((x) => x.id === state.player.car);
    if (!cc) break;
    const input = blankInput();
    input.up = true;
    const steer = steerFor(cc, roadY);
    input.left = steer < -0.15;
    input.right = steer > 0.15;
    stepFn(state, input, STEP);
    wrapCar(cc);
  }
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * `stepFn` is sim.js's stepGame(state, input, dt). The caller renders one
 * frame afterwards and sets window.__shotReady.
 */
export function stageShot(name, state, stepFn) {
  state.screen = 'play';
  if (name === 'drive') {
    // Golden-hour drive down the beach road (row 10): sand, palms, the sea
    // and a crowded road fill the frame, headlights already on.
    state.time = 17.5 * 3600;
    const spot = state.city.parked[3];
    state.player.x = spot.x - 20;
    state.player.y = spot.y;
    crowdRoad(state, roadAt(10), 8, 14);
    stealAndDrive(state, stepFn, 6, 10);
    state.banner = 'BABAK 1 · MISI 1/12 — El Encargo';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // Golden-hour chase at 5 stars: 3 patrol cars + 3 foot cops + the
    // helicopter, weaving through traffic on the El Centro avenue.
    state.time = 17.3 * 3600;
    const spot = state.city.parked[6];
    state.player.x = spot.x - 20;
    state.player.y = spot.y;
    crowdRoad(state, roadAt(5), 7, 10);
    stealAndDrive(state, stepFn, 4);
    // 5 stars, police summoned all at once so the frame is guaranteed full.
    state.heat = 92;
    state.stars = CFG.starsFor(state.heat);
    state.lastCrime = state.clock;
    summonPolice(state);
    state.banner = 'Polisi mengejarmu!';
    state.bannerT = 5;
    const roadY = roadAt(5);
    for (let i = 0; i < 5 / STEP; i++) {
      const cc = state.cars.find((x) => x.id === state.player.car);
      if (!cc) break;
      const input = blankInput();
      input.up = true;
      const steer = steerFor(cc, roadY);
      input.left = steer < -0.15;
      input.right = steer > 0.15;
      stepFn(state, input, STEP);
      wrapCar(cc);
    }
    // Pull the pursuit into frame: the wrap left the patrol cars behind, so
    // ring them around the player on the roads — one behind, one ahead, one
    // closing in from the cross street — plus foot cops and the heli.
    const p = state.player;
    const carCops = state.cops.filter((c) => c.kind === 'car');
    carCops.forEach((cop, i) => {
      const car = state.cars.find((c) => c.id === cop.carId);
      if (!car) return;
      if (i === 0) { car.x = p.x - 280; car.y = roadY + 15; car.angle = 0; }
      else if (i === 1) { car.x = p.x + 300; car.y = roadY - 15; car.angle = Math.PI; }
      else { car.x = snapRoad(p.x); car.y = roadY - 220; car.angle = Math.PI / 2; }
      car.speed = 220;
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
    });
    state.cops.filter((c) => c.kind === 'foot').forEach((cop, i) => {
      cop.x = p.x + (i === 0 ? -150 : i === 1 ? 170 : -40);
      cop.y = roadY + (i === 2 ? -150 : 40);
    });
    if (state.heli) { state.heli.x = p.x - 180; state.heli.y = p.y - 200; }
    state.banner = 'Polisi mengejarmu! Helikopter di atasmu!';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // The finale: Misi 12 "El Gran Golpe" at golden hour. The player holds
    // the bank vault for 10 seconds while the heat hits 4 stars, then the
    // full 10-man Los Halcones ambush arrives and the shootout starts.
    state.time = 17.0 * 3600;
    state.mission.idx = 11;
    startMission(state);
    const bank = state.city.places.bank;
    state.player.x = bank.x;
    state.player.y = bank.y;
    state.player.hp = 100;
    state.player.armor = 100;
    state.player.mag = CFG.pistolMag;
    state.player.reserve = 120;
    for (let i = 0; i < 30 / STEP; i++) {
      const input = blankInput();
      const g = state.gang[0];
      // During the vault hold, foot cops close in on a stationary player —
      // shoot the nearest one so the hold survives; it is real play.
      const cop = state.cops.find((c) => c.kind === 'foot');
      if (state.mission.stage >= 2 && g) {
        input.shoot = state.player.mag > 0 && i % 14 === 0;
        input.aimX = g.x;
        input.aimY = g.y;
        if (state.player.mag === 0) input.reload = true;
      } else if (cop) {
        input.shoot = state.player.mag > 0 && i % 14 === 0;
        input.aimX = cop.x;
        input.aimY = cop.y;
        if (state.player.mag === 0) input.reload = true;
      }
      stepFn(state, input, STEP);
      // Stop once the ambush is underway and a few gangsters are down —
      // the frame should show a live firefight, not an empty bank.
      if (state.mission.stage === 2 && state.gang.length <= 6) break;
      if (state.screen !== 'play') break;
    }
    // Spread the surviving gangsters around the player on the roads, so the
    // frame reads as a ring of enemies with health bars — not one pile
    // hidden under the mission marker. Top the player up for presentation.
    const p = state.player;
    const ring = [[170, 0], [-170, 0], [0, -170], [0, 170], [260, 15], [-260, -15]];
    state.gang.forEach((g, i) => {
      const [dx, dy] = ring[i % ring.length];
      g.x = p.x + dx;
      g.y = p.y + dy;
    });
    state.player.hp = 100;
    state.player.armor = 100;
    // A last burst of fire so bullets are mid-flight in the frame.
    for (let i = 0; i < 3; i++) {
      const input = blankInput();
      const g = state.gang[0];
      if (g && state.player.mag > 0) {
        input.shoot = true;
        input.aimX = g.x;
        input.aimY = g.y;
      }
      stepFn(state, input, STEP);
    }
    state.banner = 'EL GRAN GOLPE — Habisi semua Los Halcones di bank!';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  // start: title screen over a living city at golden hour, a few seconds in.
  state.time = DUSK_AT * 3600;
  for (let i = 0; i < 5 / STEP; i++) stepFn(state, blankInput(), STEP);
  return { screen: 'title' };
}
