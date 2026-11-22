// Costa Verde, the procedural city. A grid of blocks and roads, each block
// assigned a district, a use (buildings / park / plaza / beach / docks) and a
// set of buildings drawn from a seeded rng, so seed 7 always builds the same
// streets. Everything is pure data: sim.js moves through it, draw.js paints it.
import { CFG, MODELS } from './config.js';
import { mulberry32, hash2, pick, range, int, chance } from './rng.js';

export const WORLD = CFG.blocks * CFG.pitch + CFG.road; // world is square

// Road centre lines run at these coordinates, one per grid line.
export function roadCenters() {
  const out = [];
  for (let i = 0; i <= CFG.blocks; i++) out.push(i * CFG.pitch + CFG.road / 2);
  return out;
}

export function roadAt(i) {
  return i * CFG.pitch + CFG.road / 2;
}

// Which district a block belongs to. The map is hand-shaped so the city reads
// like a real place: old town north-west, downtown in the middle, docks east,
// industry south-west, beach along the whole south edge.
export function districtOf(col, row) {
  const B = CFG.blocks;
  if (row >= B - 2) return 'Playa Verde';
  if (col >= B - 2 && row <= 5) return 'Puerto Norte';
  if (col >= 4 && col <= 7 && row >= 4 && row <= 6) return 'El Centro';
  if (col >= 2 && col <= 4 && row >= 1 && row <= 3) return 'Barrio Viejo';
  if (row >= 7 && col <= 3) return 'Zona Industrial';
  if (col <= 2 && row <= 2) return 'Las Colinas';
  if (col === 5 && row === 5) return 'Parque Central';
  if (row <= 2) return 'Las Colinas';
  if (col >= 8) return 'La Marina';
  return 'Barrio Viejo';
}

// True when a world point is on a road (not inside a block).
export function onRoad(x, y) {
  const rx = x % CFG.pitch;
  const ry = y % CFG.pitch;
  return rx < CFG.road || ry < CFG.road || x < CFG.road || y < CFG.road;
}

// Nearest road-centre coordinate to a value (used to snap traffic to lanes).
export function snapRoad(v) {
  const i = Math.round((v - CFG.road / 2) / CFG.pitch);
  return Math.max(0, Math.min(CFG.blocks, i)) * CFG.pitch + CFG.road / 2;
}

const PALETTES = {
  'El Centro': ['#3d5a80', '#293241', '#5d6d7e', '#7d8597', '#2f3e46'],
  'Barrio Viejo': ['#b08968', '#ddb892', '#9c6644', '#e6ccb2', '#7f4f24'],
  'La Marina': ['#a8dadc', '#457b9d', '#caf0f8', '#90e0ef'],
  'Puerto Norte': ['#6c757d', '#495057', '#868e96', '#343a40'],
  'Zona Industrial': ['#6d6875', '#7f7f7f', '#595959', '#8d99ae'],
  'Las Colinas': ['#dda15e', '#bc6c25', '#e9c46a', '#f4d58d'],
  'Playa Verde': ['#f4d58d', '#faedcd', '#e9c46a'],
  'Parque Central': ['#588157', '#3a5a40', '#a3b18a'],
};

export function buildCity(seed = 7) {
  const rng = mulberry32(seed);
  const blocks = [];
  const buildings = [];
  const parks = [];
  const plazas = [];
  const containers = [];
  const beachProps = [];
  const trees = []; // street trees on sidewalk corners, one per block corner

  for (let row = 0; row < CFG.blocks; row++) {
    for (let col = 0; col < CFG.blocks; col++) {
      const x0 = col * CFG.pitch + CFG.road;
      const y0 = row * CFG.pitch + CFG.road;
      const size = CFG.pitch - CFG.road;
      const district = districtOf(col, row);
      const h = hash2(col, row, seed);
      let use = 'buildings';
      if (district === 'Playa Verde') use = 'beach';
      else if (district === 'Parque Central' || (h < 0.1 && district !== 'El Centro')) use = 'park';
      else if (h < 0.16) use = 'plaza';
      blocks.push({ col, row, x: x0, y: y0, size, district, use });

      if (use === 'park') {
        parks.push({ x: x0, y: y0, size, trees: int(rng, 6, 12), pond: chance(rng, 0.4) });
        continue;
      }
      // A street tree or two on the block's sidewalk corners, so the roads
      // read green instead of bare grey. Deterministic per block.
      const cornerTrees = int(rng, 1, 3);
      for (let t = 0; t < cornerTrees; t++) {
        trees.push({
          x: x0 + (chance(rng, 0.5) ? 8 : size - 8),
          y: y0 + (chance(rng, 0.5) ? 8 : size - 8),
          r: range(rng, 9, 13),
        });
      }
      if (use === 'plaza' || use === 'beach') {
        plazas.push({ x: x0, y: y0, size, kind: use });
        if (use === 'beach') {
          // Palms and umbrellas scattered on the sand.
          const n = int(rng, 3, 5);
          for (let i = 0; i < n; i++) {
            const px = x0 + range(rng, 20, size - 20);
            const py = y0 + range(rng, 20, size - 20);
            if (chance(rng, 0.55)) beachProps.push({ x: px, y: py, kind: 'palm' });
            else beachProps.push({ x: px, y: py, kind: 'umbrella', color: pick(rng, ['#e74c3c', '#f39c12', '#3498db', '#9b59b6']) });
          }
        }
        continue;
      }
      // Buildings: 1 big tower downtown, otherwise 2-4 smaller ones.
      const downtown = district === 'El Centro';
      const count = downtown ? 1 : int(rng, 2, 4);
      const palette = PALETTES[district] || PALETTES['Barrio Viejo'];
      for (let b = 0; b < count; b++) {
        const bw = downtown ? size * 0.86 : range(rng, size * 0.3, size * 0.44);
        const bh = downtown ? size * 0.86 : range(rng, size * 0.3, size * 0.44);
        const bx = downtown ? x0 + size * 0.07 : x0 + range(rng, 6, size - bw - 6);
        const by = downtown ? y0 + size * 0.07 : y0 + range(rng, 6, size - bh - 6);
        const style = downtown ? 'tower'
          : (district === 'Zona Industrial' || district === 'Puerto Norte') ? 'warehouse'
          : chance(rng, 0.3) ? 'shop' : 'house';
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(rng, palette),
          tall: downtown && chance(rng, 0.75),
          floors: downtown ? int(rng, 3, 6) : int(rng, 1, 3),
          roof: pick(rng, ['#2b2d42', '#6c757d', '#495057', '#8d0801']),
          windows: downtown ? 6 : int(rng, 2, 4),
          style,
          awning: style === 'shop' ? pick(rng, ['#e74c3c', '#f39c12', '#2e86c1', '#27ae60']) : null,
          sign: style === 'shop' ? pick(rng, ['TIENDA', 'BAR', 'CAFÉ', 'HOTEL', 'TACOS', 'PIZZA']) : null,
        });
      }
      // Shipping containers stack up in the dock and industrial blocks.
      if (district === 'Puerto Norte' || district === 'Zona Industrial') {
        const n = int(rng, 3, 5);
        for (let i = 0; i < n; i++) {
          containers.push({
            x: x0 + range(rng, 4, size - 60),
            y: y0 + range(rng, 4, size - 30),
            w: range(rng, 34, 56), h: 16,
            color: pick(rng, ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#7f8c8d']),
          });
        }
      }
    }
  }

  // Wooden piers reaching into the sea along the south edge, with boats.
  const piers = [];
  const boats = [];
  const prng2 = mulberry32(seed * 7 + 11);
  for (const fx of [0.3, 0.68]) {
    const px = WORLD * fx + range(prng2, -60, 60);
    piers.push({ x: px, w: 26, y0: WORLD - 2 * CFG.pitch + 40, y1: WORLD - 8 });
    boats.push({
      x: px + range(prng2, -90, 90), y: WORLD - 30,
      sail: pick(prng2, ['#f8f9f9', '#f39c12', '#e74c3c']),
      hull: pick(prng2, ['#7b2d26', '#1b2631', '#145a32']),
    });
  }

  // Named places the missions and the HUD point at. Positions are road
  // intersections / block corners, chosen to spread across the map.
  const at = (col, row) => ({ x: roadAt(col), y: roadAt(row) });
  const places = {
    hideout: { ...at(1, 1), name: 'Pondok Carmen — Las Colinas' },
    bar: { ...at(3, 2), name: "Bar La Luna — Barrio Viejo" },
    marinaKiosk: { ...at(9, 3), name: 'Kios Marina — La Marina' },
    garage: { ...at(2, 8), name: 'Bengkel Rico — Zona Industrial' },
    hotCar: { ...at(6, 4), name: 'Flecha Kuning — El Centro' },
    docks: { ...at(10, 4), name: 'Dermaga 7 — Puerto Norte' },
    warehouse: { ...at(2, 9), name: 'Gudang 12 — Zona Industrial' },
    bank: { ...at(5, 5), name: 'Banco Verde — El Centro' },
    hospital: { ...at(4, 8), name: 'Hospital Costa — Barrio Viejo' },
    policeHQ: { ...at(7, 6), name: 'Kantor Polisi — El Centro' },
    gunShop: { ...at(4, 3), name: "Toko Senjata Tito — Barrio Viejo" },
    beach: { ...at(6, 11), name: 'Playa Verde' },
    taxiStand: { ...at(9, 2), name: 'Pangkalan Taksi — La Marina' },
    hotel: { ...at(8, 10), name: 'Hotel Playa Verde' },
    casino: { ...at(7, 5), name: 'Casino Oro — El Centro' },
  };

  // Carmen's hidden parcels: 8 stashes tucked by the roadside across the
  // city, worth $150 each. Positions sit on or just off the road so they are
  // always reachable and never inside a building.
  const parcels = [
    { x: roadAt(2) + 18, y: roadAt(2) - 18 },
    { x: roadAt(5) - 18, y: roadAt(1) + 18 },
    { x: roadAt(8) + 18, y: roadAt(3) - 18 },
    { x: roadAt(10) - 18, y: roadAt(6) + 18 },
    { x: roadAt(3) + 18, y: roadAt(7) - 18 },
    { x: roadAt(6) - 18, y: roadAt(8) + 18 },
    { x: roadAt(9) + 18, y: roadAt(9) - 18 },
    { x: roadAt(3) + 18, y: roadAt(10) + 44 }, // on the sand by the beach road
  ];

  // Parked cars: seeded spots along road edges, away from intersections.
  const parked = [];
  const prng = mulberry32(seed * 31 + 5);
  for (let i = 0; i < CFG.parkedCars; i++) {
    const horizontal = chance(prng, 0.5);
    const line = int(prng, 0, CFG.blocks);
    const along = int(prng, 1, CFG.blocks - 1) * CFG.pitch + range(prng, 60, CFG.pitch - CFG.road - 60);
    const off = chance(prng, 0.5) ? 18 : -18;
    parked.push({
      x: horizontal ? along : roadAt(line) + off,
      y: horizontal ? roadAt(line) + off : along,
      angle: horizontal ? (off > 0 ? 0 : Math.PI) : (off > 0 ? Math.PI / 2 : -Math.PI / 2),
      model: int(prng, 0, MODELS.length - 1),
    });
  }

  return { seed, blocks, buildings, parks, plazas, places, parked, parcels, containers, beachProps, trees, piers, boats, size: WORLD };
}

// Circle-vs-buildings collision: push the circle out of any building it overlaps.
export function collideBuildings(city, x, y, r) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        ny = b.y - r; // dead centre: shove out the top
      }
    }
  }
  return { x: Math.max(20, Math.min(city.size - 20, nx)), y: Math.max(20, Math.min(city.size - 20, ny)) };
}
