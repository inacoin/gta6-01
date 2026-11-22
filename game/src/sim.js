// Costa Verde simulation: everything that moves and everything that can go
// wrong. Pure state + step function — no canvas, no audio here — so the
// screenshot stager and the smoke tests can drive the exact same rules.
import { CFG, MODELS } from './config.js';
import { buildCity, roadAt, snapRoad, collideBuildings, onRoad } from './city.js';
import { mulberry32, pick, range, int, chance, clamp, dist2, angleTo, angleDiff } from './rng.js';
import { updateMission, missionState, MISSIONS, currentStage } from './missions.js';
import { createWeather, stepWeather } from './weather.js';
import { createCasino, enterCasino, stepCasino } from './casino.js';

export function createGame(seed = 7) {
  const city = buildCity(seed);
  const rng = mulberry32(seed * 101 + 3);
  const start = city.places.hideout;
  const state = {
    seed,
    city,
    rng,
    screen: 'title', // title | play | pause | wasted | busted | win
    time: 8 * 3600 + 20 * 60, // 08:20 in the morning
    clock: 0,
    cash: CFG.startCash,
    heat: 0,
    stars: 0,
    lastCrime: -999,
    banner: '',
    bannerT: 0,
    stats: { kills: 0, thefts: 0, shots: 0, missions: 0, driven: 0, parcels: 0, slots: 0, slotWon: 0 },
    weather: createWeather(rng),
    casino: createCasino(rng),
    boats: [], // drivable boats moored in the sea (see below)
    wakeT: 0,
    spawnFootT: 0,
    spawnCarT: 0,
    player: {
      x: start.x, y: start.y + 40, angle: -Math.PI / 2,
      hp: CFG.playerHp, armor: CFG.playerArmor,
      mag: CFG.pistolMag, reserve: 48,
      car: null, // id of the car the player is driving, or null
      boat: null, // id of the boat the player is sailing, or null
      speed: 0, run: false, moving: false,
    },
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    heli: null, // police helicopter circling at 4-5 stars
    bullets: [],
    pickups: [],
    parcels: city.parcels.map((p) => ({ ...p, taken: false })),
    particles: [],
    mission: missionState(0),
    autosaveT: 0,
    events: [],
    flash: 0,
  };

  // Parked cars from the city plan.
  city.parked.forEach((p, i) => {
    const model = MODELS[p.model];
    state.cars.push({
      id: i, x: p.x, y: p.y, angle: p.angle, speed: 0,
      model: p.model, name: model.name, color: pick(rng, model.colors),
      parked: true, traffic: false, driver: false, hp: 100, smoke: 0,
    });
  });
  // Drivable boats moored in the sea: one at the beach (Misi 13's Lancha),
  // one by the east pier. bx/by remember the mooring for test resets.
  // They sit just off the waterline (size-150) so the player on the sand
  // can reach them, and the sea is 140px deep.
  const beach = city.places.beach;
  const pierX = city.piers[1] ? city.piers[1].x : city.size * 0.68;
  state.boats.push(
    { id: 600, x: beach.x + 60, y: city.size - 100, bx: beach.x + 60, by: city.size - 100, angle: 0, speed: 0, name: 'Lancha', color: '#e74c3c', hp: 100 },
    { id: 601, x: pierX + 70, y: city.size - 100, bx: pierX + 70, by: city.size - 100, angle: Math.PI / 2, speed: 0, name: 'Lancha', color: '#2e86c1', hp: 100 },
  );
  // Traffic: cars already rolling on the roads.
  for (let i = 0; i < CFG.trafficCars; i++) {
    const horizontal = chance(rng, 0.5);
    const line = int(rng, 0, CFG.blocks);
    const along = range(rng, 100, city.size - 100);
    const lane = chance(rng, 0.5) ? 15 : -15;
    const dir = chance(rng, 0.5) ? 1 : -1;
    const model = MODELS[int(rng, 0, MODELS.length - 1)];
    state.cars.push({
      id: 100 + i, x: horizontal ? along : roadAt(line) + lane, y: horizontal ? roadAt(line) + lane : along,
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 90, 170), model: MODELS.indexOf(model), name: model.name,
      color: pick(rng, model.colors), parked: false, traffic: true, driver: true,
      axis: horizontal ? 'h' : 'v', dir, hp: 100, smoke: 0,
    });
  }
  // Pedestrians strolling the sidewalks.
  for (let i = 0; i < CFG.pedestrians; i++) spawnPed(state, rng, true);
  // Static pickups: health at the hospital, armour + ammo at the gun shop.
  state.pickups.push(
    { x: city.places.hospital.x + 30, y: city.places.hospital.y, kind: 'health' },
    { x: city.places.gunShop.x + 30, y: city.places.gunShop.y, kind: 'armor' },
    { x: city.places.gunShop.x - 30, y: city.places.gunShop.y, kind: 'ammo' },
    { x: city.places.beach.x, y: city.places.beach.y + 30, kind: 'cash' },
  );
  return state;
}

function spawnPed(state, rng, anywhere) {
  const line = int(rng, 0, CFG.blocks);
  const along = anywhere ? range(rng, 80, state.city.size - 80) : range(rng, 0, 600);
  const horizontal = chance(rng, 0.5);
  const edge = chance(rng, 0.5) ? 40 : -40;
  state.peds.push({
    x: horizontal ? along : roadAt(line) + edge,
    y: horizontal ? roadAt(line) + edge : along,
    angle: chance(rng, 0.5) ? 0 : Math.PI,
    speed: range(rng, 28, 52),
    axis: horizontal ? 'h' : 'v',
    dir: chance(rng, 0.5) ? 1 : -1,
    color: pick(rng, ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#1abc9c']),
    flee: 0, panic: 0,
  });
}

export function nearestCar(state, x, y, maxD) {
  let best = null;
  let bestD = maxD * maxD;
  for (const car of state.cars) {
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function playerCar(state) {
  return state.player.car === null ? null : state.cars.find((c) => c.id === state.player.car) || null;
}

export function nearestBoat(state, x, y, maxD) {
  let best = null;
  let bestD = maxD * maxD;
  for (const b of state.boats) {
    const d = dist2(x, y, b.x, b.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function playerBoat(state) {
  return state.player.boat === null ? null : state.boats.find((b) => b.id === state.player.boat) || null;
}

function witnessNear(state, x, y) {
  for (const p of state.peds) if (dist2(x, y, p.x, p.y) < 280 * 280) return true;
  for (const c of state.cops) if (dist2(x, y, c.x, c.y) < 520 * 520) return true;
  return false;
}

export function addHeat(state, amount, x, y) {
  const seen = witnessNear(state, x, y);
  state.heat = clamp(state.heat + amount * (seen ? 1 : 0.45), 0, 100);
  state.lastCrime = state.clock;
  state.stars = CFG.starsFor(state.heat);
}

function burst(state, x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    state.particles.push({ x, y, vx: Math.cos(a) * speed * state.rng(), vy: Math.sin(a) * speed * state.rng(), life: 0.5 + state.rng() * 0.4, color });
  }
}

function spawnCop(state, kind) {
  const p = state.player;
  const a = state.rng() * Math.PI * 2;
  const d = kind === 'car' ? 700 : 520;
  const x = clamp(p.x + Math.cos(a) * d, 40, state.city.size - 40);
  const y = clamp(p.y + Math.sin(a) * d, 40, state.city.size - 40);
  if (kind === 'car') {
    const id = 900 + state.cops.length + Math.floor(state.rng() * 1000);
    const car = {
      id, x, y, angle: angleTo(x, y, p.x, p.y), speed: 0,
      model: 4, name: 'Patrulla', color: '#1b2631', parked: false,
      traffic: false, driver: true, police: true, axis: 'h', dir: 1, hp: 120, smoke: 0,
    };
    state.cars.push(car);
    state.cops.push({ x, y, angle: 0, kind: 'car', carId: id, bustT: 0 });
  } else {
    state.cops.push({ x, y, angle: 0, kind: 'foot', carId: null, bustT: 0 });
  }
}

function wantedUpkeep(state, dt) {
  const wantFoot = Math.min(state.stars, 3);
  const wantCars = state.stars >= 2 ? Math.min(state.stars - 1, 3) : 0;
  const foot = state.cops.filter((c) => c.kind === 'foot').length;
  const cars = state.cops.filter((c) => c.kind === 'car').length;
  // Spawn timers, not coin flips: a wanted level always brings its cops
  // within a bounded ~1s (foot) / ~1.6s (car), so the response never depends
  // on a lucky rng roll mid-frame. Only the spawn direction stays random.
  if (foot < wantFoot) {
    state.spawnFootT += dt;
    if (state.spawnFootT > 1.0) { state.spawnFootT = 0; spawnCop(state, 'foot'); }
  } else state.spawnFootT = 0;
  if (cars < wantCars) {
    state.spawnCarT += dt;
    if (state.spawnCarT > 1.6) { state.spawnCarT = 0; spawnCop(state, 'car'); }
  } else state.spawnCarT = 0;
  // At 4-5 stars a police helicopter joins the hunt and watches from above.
  if (state.stars >= 4 && !state.heli) {
    state.heli = { x: state.player.x, y: state.player.y - 320, rotor: 0 };
    state.banner = 'Helikopter polisi mengawasimu dari udara!';
    state.bannerT = 4;
  }
  if (state.stars < 3) state.heli = null;
  // Heat cools when nobody is watching and no crime just happened — but the
  // helicopter's eye in the sky counts as being watched.
  const anyNear = state.cops.some((c) => dist2(c.x, c.y, state.player.x, state.player.y) < 420 * 420) || !!state.heli;
  const rate = anyNear || state.clock - state.lastCrime < 4 ? CFG.heatDecaySeen : CFG.heatDecay;
  state.heat = clamp(state.heat - rate * dt, 0, 100);
  state.stars = CFG.starsFor(state.heat);
}

// Bring the police presence up to what the current stars demand, right now
// instead of trickling in over seconds. Used by the chase screenshot staging
// so the frame is guaranteed to show 3 patrol cars + the helicopter; the
// same rules as wantedUpkeep, just all at once, driven by the seeded rng.
export function summonPolice(state) {
  const wantFoot = Math.min(state.stars, 3);
  const wantCars = state.stars >= 2 ? Math.min(state.stars - 1, 3) : 0;
  let foot = state.cops.filter((c) => c.kind === 'foot').length;
  let cars = state.cops.filter((c) => c.kind === 'car').length;
  while (foot < wantFoot) { spawnCop(state, 'foot'); foot++; }
  while (cars < wantCars) { spawnCop(state, 'car'); cars++; }
  if (state.stars >= 4 && !state.heli) {
    state.heli = { x: state.player.x, y: state.player.y - 320, rotor: 0 };
  }
}

function stepHeli(state, dt) {
  const h = state.heli;
  if (!h) return;
  const p = state.player;
  h.rotor += dt * 25;
  // Circle the player at ~260px, one slow orbit.
  const a = state.clock * 0.45;
  const tx = p.x + Math.cos(a) * 260;
  const ty = p.y + Math.sin(a) * 260;
  const d = Math.hypot(tx - h.x, ty - h.y);
  if (d > 4) {
    const sp = Math.min(520, d * 2);
    h.x += ((tx - h.x) / d) * sp * dt;
    h.y += ((ty - h.y) / d) * sp * dt;
  }
}

function stepPlayer(state, input, dt) {
  const p = state.player;
  const car = playerCar(state);
  const boat = playerBoat(state);
  p.moving = false;
  if (boat) {
    // --- sailing: arcade model like driving, but on the open sea — no
    // walls, only the shoreline and the map edge to hold the boat in.
    const fwd = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    boat.speed += fwd * CFG.boatAccel * dt;
    boat.speed -= boat.speed * 0.5 * dt;
    boat.speed = clamp(boat.speed, -CFG.boatMax * 0.4, CFG.boatMax);
    const turnRate = CFG.boatTurn * clamp(Math.abs(boat.speed) / 180, 0, 1) * (boat.speed < 0 ? -1 : 1);
    boat.angle += steer * turnRate * dt;
    boat.x += Math.cos(boat.angle) * boat.speed * dt;
    boat.y += Math.sin(boat.angle) * boat.speed * dt;
    boat.x = clamp(boat.x, 30, state.city.size - 30);
    boat.y = clamp(boat.y, state.city.size - 140, state.city.size - 12); // stays in the sea
    p.x = boat.x; p.y = boat.y; p.angle = boat.angle; p.speed = boat.speed;
    p.moving = Math.abs(boat.speed) > 20;
    state.stats.driven += Math.abs(boat.speed) * dt;
    // Wake: white foam trailing behind the hull while it moves.
    state.wakeT -= dt;
    if (Math.abs(boat.speed) > 100 && state.wakeT <= 0) {
      state.wakeT = 0.06;
      const bx = boat.x - Math.cos(boat.angle) * 26;
      const by = boat.y - Math.sin(boat.angle) * 26;
      state.particles.push({
        x: bx + (state.rng() - 0.5) * 14, y: by + (state.rng() - 0.5) * 14,
        vx: -Math.cos(boat.angle) * 30, vy: -Math.sin(boat.angle) * 30,
        life: 0.9, color: '#d6eaf8',
      });
    }
    if (input.enter) {
      // Step off onto the sand, due north of the boat.
      p.boat = null;
      p.x = boat.x;
      p.y = state.city.size - 2 * CFG.pitch + 60;
      p.angle = -Math.PI / 2;
    }
    return;
  }
  if (car) {
    // --- driving: arcade model, steering scales with speed, handbrake slides.
    const model = MODELS[car.model];
    const fwd = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const top = CFG.carMax * model.top;
    car.speed += fwd * CFG.carAccel * model.acc * dt;
    car.speed -= car.speed * (input.handbrake ? 2.2 : 0.55) * dt;
    car.speed = clamp(car.speed, -CFG.carReverse, top);
    const turnRate = CFG.carTurn * clamp(Math.abs(car.speed) / 180, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.angle += steer * turnRate * dt * (input.handbrake ? 1.35 : 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hit = collideBuildings(state.city, car.x, car.y, 22);
    if (hit.x !== car.x || hit.y !== car.y) {
      if (Math.abs(car.speed) > 240) {
        car.hp -= 8;
        car.smoke = 1;
        state.events.push('crash');
        burst(state, car.x, car.y, '#f39c12', 6);
      }
      car.speed *= 0.4;
      car.x = hit.x; car.y = hit.y;
    }
    car.x = clamp(car.x, 24, state.city.size - 24);
    car.y = clamp(car.y, 24, state.city.size - 24);
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    p.moving = Math.abs(car.speed) > 20;
    state.stats.driven += Math.abs(car.speed) * dt;
    if (car.hp <= 0) {
      car.smoke = 1;
      car.speed = 0;
      p.car = null; // wrecked: bail out on foot
      p.x = car.x + 30; p.y = car.y;
      state.banner = 'Mobil rusak! Cari mobil lain.';
      state.bannerT = 3;
    }
    if (input.enter) {
      p.car = null;
      p.x = car.x + 34; p.y = car.y + 10;
      p.angle = car.angle;
    }
    return;
  }
  // --- on foot.
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len; dy /= len;
    const speed = input.run ? CFG.runSpeed : CFG.walkSpeed;
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
    p.angle = Math.atan2(dy, dx);
    p.moving = true;
    p.run = input.run;
    const hit = collideBuildings(state.city, p.x, p.y, CFG.playerRadius);
    p.x = hit.x; p.y = hit.y;
    // The sea is not a sidewalk: on foot the player stops at the waterline.
    p.y = Math.min(p.y, state.city.size - 150);
  }
  if (input.enter) {
    // Casino Oro door: standing right at the gold door walks you in — the
    // door wins over any car parked beside it, so entry is always reliable.
    const casinoPlace = state.city.places.casino;
    const nearCasino = dist2(p.x, p.y, casinoPlace.x, casinoPlace.y) < 40 * 40;
    if (nearCasino) {
      enterCasino(state);
      return;
    }
    // Boats: E boards the nearest moored Lancha.
    const boat0 = nearestBoat(state, p.x, p.y, 56);
    if (boat0) {
      p.boat = boat0.id;
      p.x = boat0.x; p.y = boat0.y; p.angle = boat0.angle;
      state.banner = `Naik ${boat0.name}! WASD kemudi — E turun di pasir.`;
      state.bannerT = 3;
      return;
    }
    // Mission cars (id >= 500: the hot Flecha, the taxi) take priority over
    // passing traffic — the job needs that exact car, not whatever is nearest.
    let car = null;
    for (const c of state.cars) {
      if (c.id >= 500 && dist2(p.x, p.y, c.x, c.y) < 64 * 64) { car = c; break; }
    }
    car = car || nearestCar(state, p.x, p.y, 64);
    if (car) {
      if (car.traffic && car.driver) {
        // Driver bails and runs; the car is yours now.
        spawnPed(state, state.rng, false);
        const esc = state.peds[state.peds.length - 1];
        esc.x = car.x + 20; esc.y = car.y + 20; esc.flee = 6;
        car.driver = false; car.traffic = false;
        state.stats.thefts++;
        addHeat(state, CFG.heatPerCarTheft, p.x, p.y);
        state.events.push('theft');
        state.banner = `Mencuri ${car.name}! Polisi mungkin melihat.`;
        state.bannerT = 3;
      } else if (car.parked) {
        car.parked = false;
        state.stats.thefts++;
        addHeat(state, CFG.heatPerCarTheft, p.x, p.y);
        state.events.push('theft');
        state.banner = `Mencuri ${car.name}!`;
        state.bannerT = 2.5;
      }
      p.car = car.id;
      car.speed = 0;
    }
  }
}

function stepTraffic(state, dt) {
  const p = state.player;
  const holdingVault = isHoldingVault(state);
  for (const car of state.cars) {
    if (!car.traffic) continue;
    // Slow down for the car ahead on the same lane.
    let ahead = Infinity;
    for (const other of state.cars) {
      if (other === car || other.parked) continue;
      const d = dist2(car.x, car.y, other.x, other.y);
      if (d < 90 * 90) {
        const a = angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y));
        if (Math.abs(a) < 0.6) ahead = Math.min(ahead, Math.sqrt(d));
      }
    }
    const target = ahead < 70 ? 0 : 150;
    car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
    // At an intersection, sometimes turn onto the crossing road.
    const cx = snapRoad(car.x);
    const cy = snapRoad(car.y);
    const nearCross = Math.abs(car.x - cx) < 12 && Math.abs(car.y - cy) < 12;
    if (nearCross && state.rng() < dt * 0.25) {
      if (car.axis === 'h') { car.axis = 'v'; car.dir = chance(state.rng, 0.5) ? 1 : -1; }
      else { car.axis = 'h'; car.dir = chance(state.rng, 0.5) ? 1 : -1; }
      car.angle = car.axis === 'h' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.x = cx; car.y = cy;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep inside the city; bounce at the edge roads — and at the sea:
    // the beach road (row 11) is the last road south, traffic never drives
    // into the water where the boats sail.
    if (car.x < 40 || car.x > state.city.size - 40 || car.y < 40 || car.y > state.city.size - 200) {
      car.angle += Math.PI;
      car.axis = car.axis === 'h' ? 'v' : 'h';
      car.dir = -car.dir;
      car.x = clamp(car.x, 40, state.city.size - 40);
      car.y = clamp(car.y, 40, state.city.size - 200);
    }
    // Traffic that hits the player hard is a crime the player did not commit;
    // a traffic car ramming the player's car still hurts the player. (Not
    // while holding a vault: the player is indoors, see isHoldingVault.
    // Never while sailing: traffic stays out of the sea, and a car cannot
    // ram a boat.)
    const d2 = dist2(car.x, car.y, p.x, p.y);
    if (d2 < 30 * 30 && playerCar(state) === null && playerBoat(state) === null && Math.abs(car.speed) > 60 && !holdingVault) {
      hurtPlayer(state, 12);
      burst(state, p.x, p.y, '#e74c3c', 5);
      state.events.push('crash');
    }
  }
}

function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += Math.cos(ped.angle) * 190 * dt;
      ped.y += Math.sin(ped.angle) * 190 * dt;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      const cx = snapRoad(ped.x);
      const cy = snapRoad(ped.y);
      if (Math.abs(ped.x - cx) < 10 && Math.abs(ped.y - cy) < 10 && state.rng() < dt * 0.3) {
        ped.angle = pick(state.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
    }
    const hit = collideBuildings(state.city, ped.x, ped.y, 10);
    ped.x = hit.x; ped.y = hit.y;
    ped.x = clamp(ped.x, 20, state.city.size - 20);
    ped.y = clamp(ped.y, 20, state.city.size - 150); // beachgoers stop at the waterline
  }
  // A panicked crowd thins out: replace peds that ran far away.
  if (state.peds.length < 48 && state.rng() < dt * 0.5) spawnPed(state, state.rng, true);
}

function hurtPlayer(state, dmg) {
  const p = state.player;
  let left = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  state.flash = 0.35;
  if (p.hp <= 0) {
    p.hp = 0;
    state.screen = 'wasted';
    state.events.push('wasted');
  }
}

// Vault-hold rule (Misi 6 + Misi 12 finale): while the player is inside
// the bank holding the vault, they are conceptually indoors — the cops
// surround the building but cannot bust them, and passing traffic cannot
// ram them. Without this, a foot cop wandering in (or a traffic car
// crossing the bank intersection) during the fixed 8/10s hold could end
// the run on pure timing luck. The hold itself is the deterministic part;
// the fight after it is not protected.
function isHoldingVault(state) {
  const stage = currentStage(state);
  if (!stage || !stage.hold || !stage.target) return false;
  const t = stage.target(state);
  return dist2(state.player.x, state.player.y, t.x, t.y) < stage.r * stage.r;
}

function stepCops(state, dt) {
  const p = state.player;
  const pcar = playerCar(state);
  const holdingVault = isHoldingVault(state);
  for (let i = state.cops.length - 1; i >= 0; i--) {
    const cop = state.cops[i];
    if (cop.kind === 'foot') {
      const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
      cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
      const sp = CFG.copChaseSpeed * (state.stars >= 3 ? 1.12 : 1);
      cop.x += Math.cos(cop.angle) * sp * dt;
      cop.y += Math.sin(cop.angle) * sp * dt;
      const hit = collideBuildings(state.city, cop.x, cop.y, 11);
      cop.x = hit.x; cop.y = hit.y;
      if (d < CFG.bustRadius && !pcar && p.speed < 60 && !holdingVault) {
        cop.bustT += dt;
        if (cop.bustT > 0.9) {
          state.screen = 'busted';
          state.events.push('busted');
          return;
        }
      } else cop.bustT = 0;
      if (d > 1100) state.cops.splice(i, 1); // lost the trail
    } else {
      const car = state.cars.find((c) => c.id === cop.carId);
      if (!car) { state.cops.splice(i, 1); continue; }
      const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
      const want = angleTo(car.x, car.y, p.x, p.y);
      car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
      const target = d > 60 ? CFG.copCarSpeed : 120;
      car.speed += clamp(target - car.speed, -500 * dt, 380 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const hit = collideBuildings(state.city, car.x, car.y, 22);
      car.x = hit.x; car.y = hit.y;
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
      if (cop.ramT > 0) cop.ramT -= dt;
      if (d < 46) {
        // Ram: shove the player's car and hurt the player a little. The
        // damage has a cooldown — without it a cop car sitting on top of
        // the player would melt the car in under a second.
        if (!cop.ramT || cop.ramT <= 0) {
          if (pcar) {
            pcar.hp -= 6;
            pcar.speed *= 0.7;
            burst(state, p.x, p.y, '#f39c12', 4);
            state.events.push('crash');
          } else {
            hurtPlayer(state, 10);
          }
          cop.ramT = 0.9;
        }
        car.speed *= 0.4;
      }
      if (d > 1300) { state.cops.splice(i, 1); state.cars = state.cars.filter((c) => c.id !== car.id); }
    }
  }
}

function stepGang(state, dt) {
  const p = state.player;
  for (let i = state.gang.length - 1; i >= 0; i--) {
    const g = state.gang[i];
    g.cool -= dt;
    const d = Math.sqrt(dist2(g.x, g.y, p.x, p.y));
    if (d < CFG.enemyRange && g.cool <= 0) {
      g.cool = 1.1 + state.rng() * 0.9;
      const a = angleTo(g.x, g.y, p.x, p.y) + (state.rng() - 0.5) * 0.24;
      state.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed, from: 'gang', life: 1.2 });
      state.events.push('enemyShot');
    }
    if (d > 260) {
      // Close the distance on foot.
      const a = angleTo(g.x, g.y, p.x, p.y);
      g.x += Math.cos(a) * 120 * dt;
      g.y += Math.sin(a) * 120 * dt;
      const hit = collideBuildings(state.city, g.x, g.y, 11);
      g.x = hit.x; g.y = hit.y;
    }
  }
}

function stepBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      if (b.from === 'player') {
        for (let j = state.gang.length - 1; j >= 0; j--) {
          const g = state.gang[j];
          if (dist2(b.x, b.y, g.x, g.y) < 16 * 16) {
            g.hp -= CFG.pistolDamage;
            burst(state, g.x, g.y, '#e74c3c', 6);
            dead = true;
            if (g.hp <= 0) {
              state.gang.splice(j, 1);
              state.stats.kills++;
              state.cash += 60;
              state.pickups.push({ x: g.x, y: g.y, kind: 'cash' });
              addHeat(state, CFG.heatPerKillSeen, g.x, g.y);
              state.events.push('kill');
            }
            break;
          }
        }
        if (!dead) for (const cop of state.cops) {
          if (cop.kind === 'foot' && dist2(b.x, b.y, cop.x, cop.y) < 16 * 16) {
            state.cops.splice(state.cops.indexOf(cop), 1);
            addHeat(state, CFG.heatPerKillSeen, cop.x, cop.y);
            burst(state, cop.x, cop.y, '#2c3e50', 8);
            state.events.push('kill');
            dead = true;
            break;
          }
        }
        if (!dead) for (const ped of state.peds) {
          if (dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
            ped.flee = 6;
            ped.angle = angleTo(b.x, b.y, ped.x, ped.y);
            addHeat(state, CFG.heatPerHitPed, ped.x, ped.y);
            burst(state, ped.x, ped.y, '#e74c3c', 5);
            dead = true;
            break;
          }
        }
      } else {
        if (dist2(b.x, b.y, p.x, p.y) < 15 * 15) {
          hurtPlayer(state, CFG.enemyDamage);
          dead = true;
        }
      }
    }
    if (!dead) {
      // Bullets stop at walls.
      for (const bd of state.city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; break; }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function stepPickups(state) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    if (dist2(p.x, p.y, pk.x, pk.y) < 34 * 34) {
      if (pk.kind === 'health') p.hp = Math.min(CFG.playerHp, p.hp + 50);
      if (pk.kind === 'armor') p.armor = Math.min(100, p.armor + 50);
      if (pk.kind === 'ammo') p.reserve += 36;
      if (pk.kind === 'cash') state.cash += 60;
      state.pickups.splice(i, 1);
      state.events.push('pickup');
    }
  }
  // Carmen's hidden parcels: $150 each, tracked in the stats.
  for (const pc of state.parcels) {
    if (!pc.taken && dist2(p.x, p.y, pc.x, pc.y) < 34 * 34) {
      pc.taken = true;
      state.cash += CFG.parcelReward;
      state.stats.parcels++;
      state.banner = `Paket Carmen ditemukan! (${state.stats.parcels}/8) +$${CFG.parcelReward}`;
      state.bannerT = 3;
      state.events.push('pickup');
      burst(state, pc.x, pc.y, '#f1c40f', 8);
    }
  }
}

export function shoot(state, wx, wy) {
  const p = state.player;
  if (p.car) return; // no drive-bys: get out to shoot
  if (p.mag <= 0) { state.events.push('dry'); return; }
  p.mag--;
  state.stats.shots++;
  const a = angleTo(p.x, p.y, wx, wy) + (state.rng() - 0.5) * 0.05;
  state.bullets.push({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed, from: 'player', life: 1.1 });
  p.angle = a;
  state.events.push('shot');
  addHeat(state, CFG.heatPerShotSeen, p.x, p.y);
  for (const ped of state.peds) {
    if (dist2(p.x, p.y, ped.x, ped.y) < 320 * 320) { ped.flee = 4; ped.angle = angleTo(p.x, p.y, ped.x, ped.y); }
  }
}

export function reload(state) {
  const p = state.player;
  if (p.mag === CFG.pistolMag || p.reserve === 0) return;
  const need = CFG.pistolMag - p.mag;
  const take = Math.min(need, p.reserve);
  p.mag += take;
  p.reserve -= take;
  state.events.push('reload');
}

export function stepGame(state, input, dt) {
  state.events.length = 0;
  if (state.screen !== 'play') return;
  state.clock += dt;
  state.time = (state.time + dt * (86400 / CFG.dayLength)) % 86400;
  if (state.bannerT > 0) state.bannerT -= dt;
  if (state.flash > 0) state.flash -= dt;
  stepWeather(state, dt);
  if (state.casino.inside) {
    // Inside Casino Oro the street freezes: only the room moves.
    stepCasino(state, input, dt);
    return;
  }
  if (input.shoot) shoot(state, input.aimX, input.aimY);
  if (input.reload) reload(state);
  stepPlayer(state, input, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepCops(state, dt);
  stepHeli(state, dt);
  stepGang(state, dt);
  stepBullets(state, dt);
  stepPickups(state);
  wantedUpkeep(state, dt);
  updateMission(state, dt, input);
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  state.autosaveT += dt;
  if (state.autosaveT > CFG.autosaveEvery) {
    state.autosaveT = 0;
    state.events.push('autosave');
  }
  if (state.mission.idx >= MISSIONS.length && state.screen === 'play') {
    state.screen = 'win';
    state.events.push('win');
  }
}
