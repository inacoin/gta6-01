// Costa Verde — tuning constants for the whole game. One place to balance
// speeds, wanted heat, money and mission timers without hunting through logic.
export const CFG = {
  // World geometry: a grid of square blocks separated by roads.
  blocks: 12,
  pitch: 260, // block + road, in world pixels
  road: 64,
  // Player on foot.
  walkSpeed: 170,
  runSpeed: 290,
  playerRadius: 13,
  playerHp: 100,
  playerArmor: 50,
  // Driving.
  carAccel: 420,
  carReverse: 220,
  carMax: 520, // px/s, sports cars multiply this
  carTurn: 2.6, // rad/s at full lock, scaled by speed
  carGrip: 3.2,
  // Combat.
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 520,
  bulletSpeed: 900,
  enemyHp: 70,
  enemyDamage: 9,
  enemyRange: 380,
  // Wanted: heat 0..100 maps to stars; crimes add heat, hiding sheds it.
  heatPerCarTheft: 26,
  heatPerShotSeen: 8,
  heatPerKillSeen: 22,
  heatPerHitPed: 14,
  heatDecay: 2.2, // per second while unseen
  heatDecaySeen: 0.4,
  starsFor: (heat) => (heat < 12 ? 0 : heat < 30 ? 1 : heat < 48 ? 2 : heat < 66 ? 3 : heat < 84 ? 4 : 5),
  // Money.
  startCash: 150,
  missionReward: [300, 500, 400, 800, 1200, 3000],
  // Timing.
  autosaveEvery: 30,
  bustRadius: 26,
  copChaseSpeed: 205,
  copCarSpeed: 560,
  dayLength: 240, // seconds per full clock cycle
};

// Car models: name, colour palette, top-speed and acceleration multipliers.
export const MODELS = [
  { name: 'Burro', colors: ['#7a8a99', '#5d6d7e', '#95a5a6'], top: 0.82, acc: 0.9, seats: 4 },
  { name: 'Tortuga', colors: ['#c9a227', '#a67c00', '#d4ac0d'], top: 0.7, acc: 0.75, seats: 2 },
  { name: 'Flecha', colors: ['#c0392b', '#e74c3c', '#922b21'], top: 1.18, acc: 1.15, seats: 2 },
  { name: 'Camioneta', colors: ['#2e86c1', '#1a5276', '#5499c7'], top: 0.9, acc: 0.85, seats: 4 },
  { name: 'Lobo', colors: ['#1c1c1e', '#2c3e50', '#5d6d7e'], top: 1.05, acc: 1.0, seats: 4 },
];

// District names, by block column/row region. The lookup in city.js owns the
// exact map; these are just the labels shown on the HUD.
export const DISTRICTS = [
  'El Centro',
  'Barrio Viejo',
  'La Marina',
  'Puerto Norte',
  'Zona Industrial',
  'Las Colinas',
  'Playa Verde',
  'Parque Central',
];
