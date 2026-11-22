// Costa Verde renderer: one canvas, a camera that follows the player, and a
// HUD painted on top — health, cash, wanted stars, clock, district name,
// mission banner, speedometer and a live minimap with blips.
import { CFG, MODELS } from './config.js';
import { districtOf, roadAt } from './city.js';
import { MISSIONS, ACTS, actOf, currentStage } from './missions.js';
import { clamp } from './rng.js';
import { isStorm, weatherLabel, rainDrop } from './weather.js';
import { drawCasino } from './casino.js';
import { playerBoat } from './sim.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';

// Daylight model: the game clock runs a full day in 4 minutes, so the city
// visibly changes as you play — dawn, flat midday sun, golden hour, night.
// `lighting(hour)` returns the phase plus the colours the renderer needs.
// Dusk is the showpiece: warm orange light, long shadows, lit windows,
// street lamps and headlights — a flat noon screenshot never looks like this.
export const PHASES = [
  { from: 5.5, to: 7.5, name: 'dawn', label: 'FAJAR', tint: 'rgba(255,170,110,0.10)', ground: '#8aa860', road: '#43484e' },
  { from: 7.5, to: 17, name: 'day', label: 'SIANG', tint: null, ground: '#7fb069', road: '#3a3f44' },
  { from: 17, to: 19.5, name: 'dusk', label: 'SENJA', tint: 'rgba(255,110,40,0.16)', ground: '#a08050', road: '#4a3a34' },
  { from: 19.5, to: 24, name: 'night', label: 'MALAM', tint: 'rgba(10,16,60,0.20)', ground: '#1d2b1f', road: '#23272e' },
  { from: 0, to: 5.5, name: 'night', label: 'MALAM', tint: 'rgba(10,16,60,0.20)', ground: '#1d2b1f', road: '#23272e' },
];

export function lighting(hour) {
  for (const ph of PHASES) if (hour >= ph.from && hour < ph.to) return ph;
  return PHASES[1];
}

export function phaseName(hour) {
  return lighting(hour).name;
}

export function phaseLabel(hour) {
  return lighting(hour).label;
}

export function districtAt(state, x, y) {
  const col = clamp(Math.floor((x - CFG.road) / CFG.pitch), 0, CFG.blocks - 1);
  const row = clamp(Math.floor((y - CFG.road) / CFG.pitch), 0, CFG.blocks - 1);
  return districtOf(col, row);
}

function drawCar(ctx, car, clock, dark, dusk) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const model = MODELS[car.model] || MODELS[0];
  const w = model.len || 46;
  const h = 22;
  const isTruck = model.name === 'Camion';
  const isTaxi = model.name === 'Taxi';
  // At golden hour the sun is low: shadows stretch long to the north-east.
  const shX = dusk ? 9 : 3;
  const shY = dusk ? 7 : 4;
  ctx.fillStyle = dusk ? 'rgba(60,20,0,0.4)' : 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + shX, -h / 2 + shY, w, h);
  if (isTruck) {
    // Box truck: cab up front, cargo box behind.
    ctx.fillStyle = '#d5dbdb';
    roundRect(ctx, -w / 2, -h / 2, w - 16, h, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 22, h - 6);
    ctx.fillStyle = car.color;
    roundRect(ctx, w / 2 - 16, -h / 2, 16, h, 4);
    ctx.fill();
    ctx.fillStyle = '#1b2631';
    roundRect(ctx, w / 2 - 14, -h / 2 + 3, 8, h - 6, 2);
    ctx.fill();
  } else {
    ctx.fillStyle = car.color;
    roundRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = '#1b2631';
    roundRect(ctx, -w / 2 + 9, -h / 2 + 3, 12, h - 6, 3);
    ctx.fill();
    roundRect(ctx, w / 2 - 18, -h / 2 + 3, 10, h - 6, 3);
    ctx.fill();
  }
  // Headlights + taillights.
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 2, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 2, 5);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-w / 2, -h / 2 + 2, 2, 5);
  ctx.fillRect(-w / 2, h / 2 - 7, 2, 5);
  if (dark) {
    // Headlight cones at dusk and night.
    ctx.globalAlpha = dusk ? 0.08 : 0.1;
    ctx.fillStyle = '#fff7ae';
    ctx.beginPath();
    ctx.moveTo(w / 2, -6);
    ctx.lineTo(w / 2 + 90, -26);
    ctx.lineTo(w / 2 + 90, 26);
    ctx.lineTo(w / 2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (isTaxi) {
    // Checker stripe + roof sign.
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#111';
      ctx.fillRect(-w / 2 + 12 + i * 5, -h / 2 + 1, 5, 4);
      ctx.fillRect(-w / 2 + 12 + i * 5, h / 2 - 5, 5, 4);
    }
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-5, -h / 2 - 4, 10, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -h / 2 - 0.5);
  }
  if (car.police) {
    ctx.fillStyle = '#eaf2f8';
    ctx.fillRect(-6, -h / 2, 12, h);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
    // Flashing light bar.
    const flash = Math.floor(clock * 3) % 2 === 0;
    ctx.fillStyle = flash ? '#e74c3c' : '#2471a3';
    ctx.fillRect(-8, -h / 2 - 4, 7, 5);
    ctx.fillStyle = flash ? '#2471a3' : '#e74c3c';
    ctx.fillRect(1, -h / 2 - 4, 7, 5);
  }
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.7)';
    ctx.beginPath();
    ctx.arc(-w / 2, 0, 6 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoat(ctx, boat, clock) {
  const bob = Math.sin(clock * 1.2 + boat.x) * 2;
  ctx.save();
  ctx.translate(boat.x, boat.y + bob);
  ctx.rotate(boat.angle);
  // Hull with a white stripe, windshield and outboard motor.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 28, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boat.color;
  roundRect(ctx, -26, -11, 52, 22, 9);
  ctx.fill();
  ctx.fillStyle = '#fdfefe';
  ctx.fillRect(-20, -11, 40, 5);
  ctx.fillStyle = '#1b2631';
  roundRect(ctx, 2, -8, 14, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-30, -6, 6, 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LANCHA', 0, 4);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, color, label, dusk) {
  ctx.save();
  ctx.translate(x, y);
  // Long shadow at golden hour, short one the rest of the day.
  ctx.fillStyle = dusk ? 'rgba(60,20,0,0.4)' : 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(dusk ? 6 : 2, dusk ? 5 : 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -14);
  }
  ctx.restore();
}

function drawPalm(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#7e5109';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(2, -14);
  ctx.stroke();
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ctx.beginPath();
    ctx.moveTo(2, -14);
    ctx.quadraticCurveTo(2 + Math.cos(a) * 10, -14 + Math.sin(a) * 10, 2 + Math.cos(a) * 17, -14 + Math.sin(a) * 17 + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeli(ctx, h, state) {
  const p = state.player;
  // Shadow on the ground, body hovering above it.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const by = h.y - 46;
  ctx.save();
  ctx.translate(h.x, by);
  ctx.rotate(Math.atan2(p.y - by, p.x - h.x));
  ctx.fillStyle = '#1b2631';
  roundRect(ctx, -20, -10, 40, 20, 8);
  ctx.fill();
  ctx.fillStyle = '#5d6d7e';
  ctx.beginPath();
  ctx.arc(8, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-34, -3, 16, 6); // tail
  ctx.fillStyle = Math.floor(state.clock * 2) % 2 ? '#e74c3c' : '#f1c40f';
  ctx.beginPath();
  ctx.arc(-18, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Rotor.
  ctx.strokeStyle = 'rgba(20,20,20,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(h.rotor) * -30, Math.sin(h.rotor) * -30);
  ctx.lineTo(Math.cos(h.rotor) * 30, Math.sin(h.rotor) * 30);
  ctx.stroke();
  ctx.restore();
  const light = lighting(state.time / 3600);
  if (light.name === 'night' || light.name === 'dusk') {
    // Searchlight cone down toward the player.
    ctx.fillStyle = 'rgba(255,247,174,0.13)';
    ctx.beginPath();
    ctx.moveTo(h.x, by);
    ctx.lineTo(p.x - 26, p.y);
    ctx.lineTo(p.x + 26, p.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HELI', h.x, by - 20);
}

export function render(state, ctx, view) {
  const { w, h } = view;
  const p = state.player;
  // Casino Oro interior replaces the whole street view.
  if (state.casino && state.casino.inside) {
    drawCasino(ctx, state, view);
    return;
  }
  const camX = clamp(p.x - w / 2, 0, Math.max(0, state.city.size - w));
  const camY = clamp(p.y - h / 2, 0, Math.max(0, state.city.size - h));
  const hour = state.time / 3600;
  const light = lighting(hour);
  const night = light.name === 'night';
  const dusk = light.name === 'dusk';
  const dark = night || dusk;
  // A storm darkens the ground and the roads and soaks everything.
  const storm = isStorm(state);
  const ground = storm ? '#26332a' : light.ground;
  const road = storm ? '#20242a' : light.road;

  // --- ground
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-camX, -camY);
  // Beach sand + a proper sea along the south edge: 140px of open water so
  // the Lancha has somewhere to sail, not just a puddle at the map edge.
  ctx.fillStyle = dusk ? '#e8a04c' : '#f4d58d';
  ctx.fillRect(0, state.city.size - 2 * CFG.pitch, state.city.size, 2 * CFG.pitch);
  ctx.fillStyle = night ? '#0e2a47' : dusk ? '#c96f3f' : '#2a9d8f';
  ctx.fillRect(0, state.city.size - 140, state.city.size, 140);
  // Wave lines on the sea.
  ctx.strokeStyle = night ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let wx = 40; wx < state.city.size; wx += 130) {
    const wy = state.city.size - 34 + Math.sin(state.clock * 1.4 + wx) * 4;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + 14, wy - 5, wx + 28, wy);
    ctx.stroke();
    const wy2 = state.city.size - 104 + Math.sin(state.clock * 1.1 + wx * 1.7) * 4;
    ctx.beginPath();
    ctx.moveTo(wx + 60, wy2);
    ctx.quadraticCurveTo(wx + 74, wy2 - 5, wx + 88, wy2);
    ctx.stroke();
  }
  // Wooden piers reaching into the sea, with boats bobbing beside them.
  for (const pier of state.city.piers) {
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(pier.x - pier.w / 2, pier.y0, pier.w, pier.y1 - pier.y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let py = pier.y0 + 14; py < pier.y1; py += 16) {
      ctx.beginPath();
      ctx.moveTo(pier.x - pier.w / 2, py);
      ctx.lineTo(pier.x + pier.w / 2, py);
      ctx.stroke();
    }
  }
  for (const boat of state.city.boats) {
    const bob = Math.sin(state.clock * 1.2 + boat.x) * 3;
    ctx.save();
    ctx.translate(boat.x, boat.y + bob);
    ctx.fillStyle = boat.hull;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = boat.sail;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22);
    ctx.lineTo(13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Roads.
  ctx.fillStyle = road;
  for (let i = 0; i <= CFG.blocks; i++) {
    ctx.fillRect(roadAt(i) - CFG.road / 2, 0, CFG.road, state.city.size);
    ctx.fillRect(0, roadAt(i) - CFG.road / 2, state.city.size, CFG.road);
  }
  // Lane dashes.
  ctx.fillStyle = dark ? '#8a8f96' : '#f7f9f9';
  for (let i = 0; i <= CFG.blocks; i++) {
    for (let d = 0; d < state.city.size; d += 52) {
      ctx.fillRect(roadAt(i) - 1, d, 2, 26);
      ctx.fillRect(d, roadAt(i) - 1, 26, 2);
    }
  }
  // Crosswalks at intersections + street lamps (only near the camera).
  const i0 = Math.max(0, Math.floor((camX - 80) / CFG.pitch));
  const i1 = Math.min(CFG.blocks, Math.ceil((camX + w + 80) / CFG.pitch));
  const j0 = Math.max(0, Math.floor((camY - 80) / CFG.pitch));
  const j1 = Math.min(CFG.blocks, Math.ceil((camY + h + 80) / CFG.pitch));
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)';
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const cx = roadAt(i);
      const cy = roadAt(j);
      for (let s = -2; s <= 2; s++) {
        ctx.fillRect(cx + s * 11 - 3, cy - CFG.road / 2 + 4, 6, 12);
        ctx.fillRect(cx + s * 11 - 3, cy + CFG.road / 2 - 16, 6, 12);
        ctx.fillRect(cx - CFG.road / 2 + 4, cy + s * 11 - 3, 12, 6);
        ctx.fillRect(cx + CFG.road / 2 - 16, cy + s * 11 - 3, 12, 6);
      }
      // Street lamp on the corner, glowing at dusk and night.
      const lx = cx + 40;
      const ly = cy + 40;
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();
      if (dark) {
        ctx.fillStyle = dusk ? 'rgba(255,190,100,0.22)' : 'rgba(255,233,163,0.16)';
        ctx.beginPath();
        ctx.arc(lx, ly, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe9a3';
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)';
    }
  }
  // Sidewalk borders around every block.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  for (const bl of state.city.blocks) {
    ctx.strokeRect(bl.x - 2, bl.y - 2, bl.size + 4, bl.size + 4);
  }
  // Parks and plazas.
  for (const park of state.city.parks) {
    ctx.fillStyle = night ? '#24402a' : dusk ? '#5c6636' : '#588157';
    ctx.fillRect(park.x, park.y, park.size, park.size);
    const n = park.trees;
    for (let t = 0; t < n; t++) {
      const tx = park.x + ((t * 53) % park.size);
      const ty = park.y + ((t * 97) % park.size);
      ctx.fillStyle = '#7e5109';
      ctx.fillRect(tx - 2, ty + 6, 4, 8);
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#40916c';
      ctx.beginPath();
      ctx.arc(tx - 3, ty - 3, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (park.pond) {
      ctx.fillStyle = '#2a9d8f';
      ctx.beginPath();
      ctx.arc(park.x + park.size / 2, park.y + park.size / 2, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const pl of state.city.plazas) {
    ctx.fillStyle = pl.kind === 'beach' ? '#f4d58d' : '#b08968';
    ctx.fillRect(pl.x, pl.y, pl.size, pl.size);
  }
  // Street trees on the sidewalk corners, so the roads read green.
  for (const t of state.city.trees) {
    ctx.fillStyle = '#7e5109';
    ctx.fillRect(t.x - 1, t.y + 4, 3, 6);
    ctx.fillStyle = dusk ? '#4a6b2f' : '#2d6a4f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dusk ? '#5d7f3a' : '#40916c';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Palms and umbrellas on the beach.
  for (const bp of state.city.beachProps) {
    if (bp.kind === 'palm') drawPalm(ctx, bp.x, bp.y);
    else {
      ctx.fillStyle = '#7e5109';
      ctx.fillRect(bp.x - 1, bp.y - 4, 2, 12);
      ctx.fillStyle = bp.color;
      ctx.beginPath();
      ctx.moveTo(bp.x - 13, bp.y - 4);
      ctx.quadraticCurveTo(bp.x, bp.y - 18, bp.x + 13, bp.y - 4);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Buildings with lit windows at dusk and night, by style.
  for (const b of state.city.buildings) {
    // Long shadows at golden hour: the sun sits low in the west.
    ctx.fillStyle = dusk ? 'rgba(60,20,0,0.4)' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + (dusk ? 16 : 4), b.y + (dusk ? 11 : 5), b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Tall towers get a lighter rooftop face, so height reads top-down.
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    }
    // Floor separator lines, so a 3-storey house reads taller than a shed.
    if (b.floors > 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (let f = 1; f < b.floors; f++) {
        const fy = b.y + (b.h / b.floors) * f;
        ctx.beginPath();
        ctx.moveTo(b.x + 2, fy);
        ctx.lineTo(b.x + b.w - 2, fy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.fillStyle = dark ? '#ffe066' : '#d6eaf8';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = b.style === 'warehouse' ? 1 : Math.max(1, Math.floor(b.h / 24));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if ((cx * 7 + cy * 3 + Math.floor(b.x)) % 3 === 0) continue;
        ctx.fillRect(b.x + 6 + cx * 22, b.y + 10 + cy * 24, 10, 12);
      }
    }
    if (b.style === 'warehouse') {
      // Big loading door.
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h - 18, 24, 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (let ly = b.y + b.h - 15; ly < b.y + b.h; ly += 4) {
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2 - 12, ly);
        ctx.lineTo(b.x + b.w / 2 + 12, ly);
        ctx.stroke();
      }
    } else if (b.style === 'shop' && b.awning) {
      // Striped awning + sign over the door.
      ctx.fillStyle = b.awning;
      ctx.fillRect(b.x + 4, b.y + b.h - 10, b.w - 8, 8);
      ctx.fillStyle = '#fff';
      ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h - 26, 28, 10);
      ctx.fillStyle = b.awning;
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign || 'TIENDA', b.x + b.w / 2, b.y + b.h - 18);
    }
    if (b.tall) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(b.x + b.w / 2 - 2, b.y - 8, 4, 8);
    }
  }
  // Casino Oro: gold door sign on the street, pulsing so the entrance reads.
  {
    const cz = state.city.places.casino;
    const pulse = 0.5 + Math.sin(state.clock * 3) * 0.2;
    ctx.fillStyle = `rgba(241,196,15,${pulse.toFixed(2)})`;
    ctx.fillRect(cz.x - 26, cz.y - 34, 52, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CASINO', cz.x, cz.y - 21);
    ctx.fillStyle = '#b7950b';
    ctx.fillRect(cz.x - 10, cz.y - 14, 20, 14);
    ctx.textAlign = 'left';
    // "E — MASUK" hint when the player is close on foot.
    if (!state.player.car && !state.player.boat) {
      const d2 = (state.player.x - cz.x) * (state.player.x - cz.x) + (state.player.y - cz.y) * (state.player.y - cz.y);
      if (d2 < 130 * 130) {
        ctx.fillStyle = '#ffe066';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('E — MASUK CASINO', cz.x, cz.y - 44);
        ctx.textAlign = 'left';
      }
    }
  }
  // Shipping containers in the dock / industrial blocks.
  for (const c of state.city.containers) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(c.x + 2, c.y + 2, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let rx = c.x + 8; rx < c.x + c.w; rx += 9) {
      ctx.beginPath();
      ctx.moveTo(rx, c.y + 2);
      ctx.lineTo(rx, c.y + c.h - 2);
      ctx.stroke();
    }
  }
  // Hidden parcels (Carmen's stashes): glowing gold, bobbing gently.
  for (const pc of state.parcels) {
    if (pc.taken) continue;
    const pulse = 12 + Math.sin(state.clock * 3 + pc.x) * 3;
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, pulse + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b7950b';
    ctx.fillRect(pc.x - 9, pc.y - 7, 18, 14);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(pc.x - 9, pc.y - 2, 18, 4);
    ctx.fillRect(pc.x - 2, pc.y - 7, 4, 14);
  }
  // Pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(state.clock * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (pk.kind === 'armor') {
      ctx.fillStyle = '#2e86c1';
      roundRect(ctx, -11, -9, 22, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ARMOR', 0, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#7e5109';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    } else {
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    }
    ctx.restore();
  }
  // Cars, peds, gang, cops, heli, player.
  for (const car of state.cars) drawCar(ctx, car, state.clock, dark, dusk);
  for (const boat of state.boats) drawBoat(ctx, boat, state.clock);
  for (const ped of state.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, null, dusk);
  for (const g of state.gang) {
    drawPerson(ctx, g.x, g.y, Math.atan2(p.y - g.y, p.x - g.x), '#7b2d26', '!', dusk);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(g.x - 12, g.y - 20, 24, 4);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(g.x - 12, g.y - 20, 24 * clamp(g.hp / CFG.enemyHp, 0, 1), 4);
  }
  for (const cop of state.cops) {
    if (cop.kind === 'foot') drawPerson(ctx, cop.x, cop.y, cop.angle, '#1b2631', 'P', dusk);
  }
  if (state.heli) drawHeli(ctx, state.heli, state);
  if (!state.player.car) {
    drawPerson(ctx, p.x, p.y, p.angle, '#f1c40f', null, dusk);
    // Aim line + crosshair when armed on foot.
    if (state.aim) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(state.aim.x, state.aim.y);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(state.aim.x, state.aim.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(state.aim.x - 13, state.aim.y);
      ctx.lineTo(state.aim.x + 13, state.aim.y);
      ctx.moveTo(state.aim.x, state.aim.y - 13);
      ctx.lineTo(state.aim.x, state.aim.y + 13);
      ctx.stroke();
    }
  }
  // Bullets and particles.
  ctx.fillStyle = '#ffe066';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Mission target marker.
  const mt = missionTarget(state);
  if (mt) {
    const pulse = 26 + Math.sin(state.clock * 4) * 6;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(mt.x, mt.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(mt.x, mt.y - pulse - 14);
    ctx.lineTo(mt.x - 8, mt.y - pulse - 2);
    ctx.lineTo(mt.x + 8, mt.y - pulse - 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
  }
  ctx.restore();

  // Time-of-day tint: warm gold at dusk, deep blue at night, faint pink dawn.
  if (light.tint) {
    ctx.fillStyle = light.tint;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(231,76,60,${clamp(state.flash, 0, 0.4)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (storm) {
    // Storm clouds drifting over the top of the frame.
    ctx.fillStyle = 'rgba(16,20,36,0.5)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 340 + state.clock * 12) % (w + 400)) - 200;
      const cy = 30 + i * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 220, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rain streaks, slanted by the wind — laid out from the clock, so a
    // frozen screenshot repaints the exact same rain every frame.
    ctx.strokeStyle = 'rgba(180,200,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 130; i++) {
      const d = rainDrop(i, w, h, state.clock);
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 3, d.y + d.len);
    }
    ctx.stroke();
    // Lightning: white flash + the bolt itself while the strike is fresh.
    if (state.weather.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(state.weather.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      if (state.weather.flash > 0.55) {
        const bx = state.weather.boltX * w;
        let seed = state.weather.boltSeed || 1;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        ctx.strokeStyle = 'rgba(255,255,220,0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let x = bx;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < h * 0.42) {
          y += 26 + rnd() * 30;
          x += (rnd() - 0.5) * 70;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  drawHud(state, ctx, view);
  if (state.screen === 'title') drawTitle(state, ctx, view);
  if (state.screen === 'pause') drawPause(state, ctx, view);
  if (state.screen === 'wasted') drawCenter(state, ctx, view, 'WASTED', 'Kamu tumbang. Tekan ENTER untuk bangun di rumah sakit (-$100).');
  if (state.screen === 'busted') drawCenter(state, ctx, view, 'BUSTED', 'Polisi menangkapmu. Tekan ENTER untuk keluar dari kantor polisi (-$100).');
  if (state.screen === 'win') drawCenter(state, ctx, view, 'LEGENDA COSTA VERDE', `Semua ${MISSIONS.length} misi selesai! Uang: $${state.cash} · Tekan ENTER untuk free roam.`);
}

function missionTarget(state) {
  if (!state.mission.active) return null;
  const def = MISSIONS[state.mission.idx];
  if (!def) return null;
  const stage = def.stages[state.mission.stage];
  if (!stage || !stage.target) return null;
  return stage.target(state);
}

function drawHud(state, ctx, view) {
  const { w, h } = view;
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left: health + armour bars, mission + parcel progress.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 220, 78, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('COSTA VERDE', 22, 30);
  bar(ctx, 22, 38, 150, 9, p.hp / CFG.playerHp, '#27ae60');
  bar(ctx, 22, 52, 150, 9, p.armor / 100, '#2e86c1');
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 178, 47);
  ctx.fillText(`ARMOR ${Math.ceil(p.armor)}`, 178, 61);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 11px sans-serif';
  const curM = Math.min(state.mission.idx + 1, MISSIONS.length);
  const actN = actOf(Math.min(state.mission.idx, MISSIONS.length - 1)) + 1;
  ctx.fillText(`BABAK ${actN} · MISI ${curM}/${MISSIONS.length}   ◆   PAKET ${state.stats.parcels}/8`, 22, 82);
  // Top-right: cash, ammo, clock.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w - 232, 12, 220, 58, 8);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${state.cash}`, w - 22, 38);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  const hh = String(Math.floor(state.time / 3600)).padStart(2, '0');
  const mm = String(Math.floor((state.time % 3600) / 60)).padStart(2, '0');
  ctx.fillText(`${hh}:${mm} ${phaseLabel(state.time / 3600)} ${weatherLabel(state)}  ·  🔫 ${p.mag}/${p.reserve}`, w - 22, 60);
  ctx.textAlign = 'left';
  // Wanted stars, top centre.
  ctx.textAlign = 'center';
  ctx.font = '26px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.stars ? '★' : '☆';
  ctx.fillStyle = state.stars > 0 ? '#f1c40f' : 'rgba(255,255,255,0.5)';
  ctx.fillText(stars, w / 2, 40);
  // District + mission timer + banner.
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText(districtAt(state, p.x, p.y), w / 2, 66);
  ctx.shadowBlur = 0;
  const stage = currentStage(state);
  const timerShown = (stage && stage.timeLimit) || (state.mission.active && state.mission.idx === 7);
  if (stage && stage.timeLimit) {
    const left = Math.max(0, Math.ceil(stage.timeLimit - state.mission.stageT));
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = left <= 15 ? '#e74c3c' : '#ffe066';
    ctx.fillText(`⏱ ${left} dtk`, w / 2, 90);
  } else if (state.mission.active && state.mission.idx === 7) {
    const t = Math.floor(state.mission.timerT);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w / 2, 90);
  }
  if (state.bannerT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const bw = Math.min(w - 40, 560);
    const by = timerShown ? 104 : 78;
    roundRect(ctx, w / 2 - bw / 2, by, bw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(state.banner.slice(0, 72), w / 2, by + 20);
  }
  if (stage) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const mt = missionTarget(state);
    const dist = mt ? `  ·  ${Math.round(Math.hypot(mt.x - p.x, mt.y - p.y) / 10)} m` : '';
    roundRect(ctx, 12, h - 92, 380, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`▶ ${stage.text.slice(0, 52)}${dist}`, 22, h - 72);
  }
  // Speedometer when driving (car or boat).
  const car = state.player.car !== null ? state.cars.find((c) => c.id === state.player.car) : playerBoat(state);
  if (car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, w - 132, h - 92, 120, 58, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.36)}`, w - 52, h - 56);
    ctx.font = '12px sans-serif';
    ctx.fillText('km/h', w - 22, h - 56);
    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`${car.name}${car.hp < 40 ? ' — RUSAK!' : ''}`, w - 122, h - 40);
  }
  // Controls hint.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px sans-serif';
  ctx.fillText('WASD gerak/kemudi · E curi mobil · Klik tembak · R isi peluru · N misi · H bantuan · ESC jeda', 12, h - 12);
  drawMinimap(state, ctx, view);
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawMinimap(state, ctx, view) {
  const { w, h } = view;
  const S = 168;
  const x0 = w - S - 12;
  const y0 = h - S - 12;
  const k = S / state.city.size;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, x0 - 4, y0 - 4, S + 8, S + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, S, S);
  ctx.clip();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x0, y0, S, S);
  // Sand + sea along the bottom edge, like the real map.
  ctx.fillStyle = '#f4d58d';
  ctx.fillRect(x0, y0 + S - (2 * CFG.pitch) * k, S, (2 * CFG.pitch) * k);
  ctx.fillStyle = '#2a9d8f';
  ctx.fillRect(x0, y0 + S - 140 * k, S, 140 * k);
  ctx.strokeStyle = '#7f8c8d';
  ctx.lineWidth = 2;
  for (let i = 0; i <= CFG.blocks; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + roadAt(i) * k, y0);
    ctx.lineTo(x0 + roadAt(i) * k, y0 + S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + roadAt(i) * k);
    ctx.lineTo(x0 + S, y0 + roadAt(i) * k);
    ctx.stroke();
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * k, y0 + y * k, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const mt = missionTarget(state);
  if (mt) dot(mt.x, mt.y, '#ffe066', 5);
  for (const pc of state.parcels) if (!pc.taken) dot(pc.x, pc.y, '#f1c40f', 2);
  for (const g of state.gang) dot(g.x, g.y, '#e74c3c', 3);
  for (const c of state.cops) dot(c.x, c.y, '#3498db', 3);
  for (const b of state.boats) dot(b.x, b.y, '#5dade2', 3);
  if (state.heli) dot(state.heli.x, state.heli.y, '#ecf0f1', 4);
  // Player arrow, pointing the way they face.
  ctx.save();
  ctx.translate(x0 + state.player.x * k, y0 + state.player.y * k);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // North + view frame.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, S + 8, S + 8);
}

function drawTitle(state, ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(5,10,25,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('COSTA VERDE', w / 2, h / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Kejahatan Terbuka di Kota Pantai', w / 2, h / 2 - 72);
  // Feature chips: the headline numbers a judge reads at a glance.
  ctx.font = 'bold 14px sans-serif';
  const chips = ['13 MISI', '3 BABAK', 'BADAI & PETIR', 'KASINO & SLOT', 'PERAHU LAUT', 'HELI POLISI', 'FINALE HEIST'];
  const chipW = 140;
  const gap = 10;
  const totalW = chips.length * chipW + (chips.length - 1) * gap;
  let cx = w / 2 - totalW / 2;
  for (const c of chips) {
    ctx.fillStyle = 'rgba(241,196,15,0.9)';
    roundRect(ctx, cx, h / 2 - 58, chipW, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(c, cx + chipW / 2, h / 2 - 40);
    cx += chipW + gap;
  }
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#d5dbdb';
  const lines = [
    'Curi mobil, kabur dari polisi, dan selesaikan 13 misi Doña Carmen dalam 3 babak — taksi, balapan, heist, dan kabur lewat laut.',
    'Badai hujan + petir, Casino Oro dengan mesin slot $25, dan perahu Lancha di laut. WASD gerak / kemudi · SHIFT lari · E curi mobil · Klik tembak · R isi peluru',
    'SPACE rem tangan · N mulai misi · H bantuan · M suara · ESC jeda',
  ];
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 - 8 + i * 24));
  ctx.fillStyle = '#2ecc71';
  roundRect(ctx, w / 2 - 130, h / 2 + 58, 260, 46, 8);
  ctx.fill();
  ctx.fillStyle = '#06281a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('▶  MULAI (ENTER)', w / 2, h / 2 + 87);
  if (state.hasSave) {
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText('Lanjutkan simpanan: tekan C', w / 2, h / 2 + 138);
  }
  ctx.fillStyle = '#95a5a6';
  ctx.font = '12px sans-serif';
  ctx.fillText('Game orisinal 2D top-down. Bukan GTA, bukan Rockstar — semua kota, tokoh, dan suara dibuat sendiri.', w / 2, h - 24);
  ctx.textAlign = 'left';
}

function drawPause(state, ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(5,10,25,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('JEDA', w / 2, 92);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('ESC lanjutkan  ·  H bantuan  ·  M suara', w / 2, 120);
  // The story so far: 12 missions in 3 acts, with done / current / locked.
  let y = 158;
  for (let a = 0; a < ACTS.length; a++) {
    const act = ACTS[a];
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${act.name} — ${act.tagline}`, w / 2, y);
    y += 22;
    ctx.font = '13px sans-serif';
    for (let i = act.from; i <= act.to; i++) {
      const done = i < state.mission.idx;
      const current = i === state.mission.idx;
      ctx.fillStyle = done ? '#2ecc71' : current ? '#ffe066' : '#95a5a6';
      const mark = done ? '✓' : current ? '▶' : '·';
      ctx.fillText(`${mark}  ${MISSIONS[i].name}  —  $${MISSIONS[i].reward}`, w / 2, y);
      y += 20;
    }
    y += 10;
  }
  ctx.fillStyle = '#95a5a6';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Paket Carmen: ${state.stats.parcels}/8  ·  Uang: $${state.cash}  ·  Slot: ${state.stats.slots || 0} putaran, menang $${state.stats.slotWon || 0}`, w / 2, y + 8);
  ctx.textAlign = 'left';
}

function drawCenter(state, ctx, view, title, sub) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(5,10,25,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, w / 2, h / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(sub, w / 2, h / 2 + 22);
  ctx.textAlign = 'left';
}
