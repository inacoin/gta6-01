// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a tiny scripted driver, so the frame is what real play looks like and the
// same seed always gives the same frame.
import { CFG } from './config.js';
import { roadAt } from './city.js';
import { startMission } from './missions.js';
import { nearestCar } from './sim.js';
import { clamp } from './rng.js';

const STEP = 1 / 60;

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
    // Park the player next to a parked car, steal it, drive east on the
    // beach road (row 10): sand, palms and the sea fill the lower frame.
    const spot = state.city.parked[3];
    state.player.x = spot.x - 20;
    state.player.y = spot.y;
    stealAndDrive(state, stepFn, 6, 10);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    const spot = state.city.parked[6];
    state.player.x = spot.x - 20;
    state.player.y = spot.y;
    stealAndDrive(state, stepFn, 4);
    // 4 stars: foot + car cops plus the police helicopter overhead.
    state.heat = 88;
    state.stars = CFG.starsFor(state.heat);
    state.lastCrime = state.clock;
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
    state.banner = 'Polisi mengejarmu! Helikopter di atasmu!';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Jump to the dockside deal: start mission 4, walk into the ambush, trade
    // shots with Los Halcones for a few seconds.
    state.mission.idx = 3;
    startMission(state);
    const docks = state.city.places.docks;
    state.player.x = docks.x - 60;
    state.player.y = docks.y + 20;
    state.player.mag = CFG.pistolMag;
    state.player.reserve = 120;
    for (let i = 0; i < 16 / STEP; i++) {
      const input = blankInput();
      const g = state.gang[0];
      // Walk toward the docks until close, then shoot the nearest gangster.
      const dx = docks.x - state.player.x;
      const dy = docks.y - state.player.y;
      const d = Math.hypot(dx, dy);
      if (d > 130) {
        input.up = dy < -10;
        input.down = dy > 10;
        input.left = dx < -10;
        input.right = dx > 10;
      } else if (g) {
        input.shoot = state.player.mag > 0 && i % 18 === 0;
        input.aimX = g.x;
        input.aimY = g.y;
        if (state.player.mag === 0) input.reload = true;
      }
      stepFn(state, input, STEP);
      // Stop once the ambush has started and only one gangster is left.
      if (state.gang.length === 1 && state.mission.stage === 1) break;
    }
    state.banner = 'Habisi semua anggota Los Halcones di dermaga';
    state.bannerT = 5;
    return { screen: 'play' };
  }
  // start: title screen over a living city, a few seconds in.
  for (let i = 0; i < 5 / STEP; i++) stepFn(state, blankInput(), STEP);
  return { screen: 'title' };
}
