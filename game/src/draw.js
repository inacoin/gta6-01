// Costa Verde renderer: one canvas, a camera that follows the player, and a
// HUD painted on top — health, cash, wanted stars, clock, district name,
// mission banner, speedometer and a live minimap with blips.
import { CFG } from './config.js';
import { districtOf, roadAt } from './city.js';
import { MISSIONS, currentStage } from './missions.js';
import { clamp } from './rng.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';

const DAY_COLORS = [
  [0, '#0b1026'], [5, '#1c2b4a'], [7, '#f4a261'], [9, '#87ceeb'],
  [17, '#87ceeb'], [19, '#f4a261'], [21, '#1c2b4a'], [23, '#0b1026'],
];

export function skyColor(hour) {
  let c = DAY_COLORS[0][1];
  for (const [h, col] of DAY_COLORS) if (hour >= h) c = col;
  return c;
}

export function districtAt(state, x, y) {
  const col = clamp(Math.floor((x - CFG.road) / CFG.pitch), 0, CFG.blocks - 1);
  const row = clamp(Math.floor((y - CFG.road) / CFG.pitch), 0, CFG.blocks - 1);
  return districtOf(col, row);
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = 46;
  const h = 22;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#1b2631';
  roundRect(ctx, -w / 2 + 9, -h / 2 + 3, 12, h - 6, 3);
  ctx.fill();
  roundRect(ctx, w / 2 - 18, -h / 2 + 3, 10, h - 6, 3);
  ctx.fill();
  ctx.fillStyle = '#f7f9f9';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 2, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 2, 5);
  if (car.police) {
    ctx.fillStyle = '#eaf2f8';
    ctx.fillRect(-6, -h / 2, 12, h);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
  }
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.7)';
    ctx.beginPath();
    ctx.arc(-w / 2, 0, 6 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
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

function drawPerson(ctx, x, y, angle, color, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
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

export function render(state, ctx, view) {
  const { w, h } = view;
  const p = state.player;
  const camX = clamp(p.x - w / 2, 0, Math.max(0, state.city.size - w));
  const camY = clamp(p.y - h / 2, 0, Math.max(0, state.city.size - h));
  const hour = state.time / 3600;
  const night = hour < 6 || hour > 19;

  // --- ground
  ctx.fillStyle = night ? '#1d2b1f' : '#7fb069';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-camX, -camY);
  // Beach sand + sea along the south edge.
  ctx.fillStyle = '#f4d58d';
  ctx.fillRect(0, state.city.size - 2 * CFG.pitch, state.city.size, 2 * CFG.pitch);
  ctx.fillStyle = night ? '#0e2a47' : '#2a9d8f';
  ctx.fillRect(0, state.city.size - 60, state.city.size, 60);
  // Roads.
  ctx.fillStyle = night ? '#23272e' : '#3a3f44';
  for (let i = 0; i <= CFG.blocks; i++) {
    ctx.fillRect(roadAt(i) - CFG.road / 2, 0, CFG.road, state.city.size);
    ctx.fillRect(0, roadAt(i) - CFG.road / 2, state.city.size, CFG.road);
  }
  // Lane dashes.
  ctx.fillStyle = night ? '#6b7280' : '#f7f9f9';
  for (let i = 0; i <= CFG.blocks; i++) {
    for (let d = 0; d < state.city.size; d += 52) {
      ctx.fillRect(roadAt(i) - 1, d, 2, 26);
      ctx.fillRect(d, roadAt(i) - 1, 26, 2);
    }
  }
  // Parks and plazas.
  for (const park of state.city.parks) {
    ctx.fillStyle = night ? '#24402a' : '#588157';
    ctx.fillRect(park.x, park.y, park.size, park.size);
    ctx.fillStyle = '#2d6a4f';
    const n = park.trees;
    for (let t = 0; t < n; t++) {
      const tx = park.x + ((t * 53) % park.size);
      const ty = park.y + ((t * 97) % park.size);
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
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
  // Buildings with lit windows at night.
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.fillStyle = night ? '#ffe066' : '#d6eaf8';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 24));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if ((cx * 7 + cy * 3 + Math.floor(b.x)) % 3 === 0) continue;
        ctx.fillRect(b.x + 6 + cx * 22, b.y + 10 + cy * 24, 10, 12);
      }
    }
    if (b.tall) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(b.x + b.w / 2 - 2, b.y - 8, 4, 8);
    }
  }
  // Mission target ring.
  const target = state.mission.active ? null : null;
  void target;
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
  // Cars, peds, gang, cops, player.
  for (const car of state.cars) drawCar(ctx, car);
  for (const ped of state.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color);
  for (const g of state.gang) {
    drawPerson(ctx, g.x, g.y, Math.atan2(p.y - g.y, p.x - g.x), '#7b2d26', '!');
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(g.x - 12, g.y - 20, 24, 4);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(g.x - 12, g.y - 20, 24 * clamp(g.hp / CFG.enemyHp, 0, 1), 4);
  }
  for (const cop of state.cops) {
    if (cop.kind === 'foot') drawPerson(ctx, cop.x, cop.y, cop.angle, '#1b2631', 'P');
  }
  if (!state.player.car) {
    drawPerson(ctx, p.x, p.y, p.angle, '#f1c40f');
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

  // Night tint.
  if (night) {
    ctx.fillStyle = 'rgba(10,16,60,0.18)';
    ctx.fillRect(0, 0, w, h);
  }
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(231,76,60,${clamp(state.flash, 0, 0.4)})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawHud(state, ctx, view);
  if (state.screen === 'title') drawTitle(state, ctx, view);
  if (state.screen === 'pause') drawCenter(state, ctx, view, 'JEDA', 'ESC lanjutkan · H bantuan · M suara');
  if (state.screen === 'wasted') drawCenter(state, ctx, view, 'WASTED', 'Kamu tumbang. Tekan ENTER untuk bangun di rumah sakit (-$100).');
  if (state.screen === 'busted') drawCenter(state, ctx, view, 'BUSTED', 'Polisi menangkapmu. Tekan ENTER untuk keluar dari kantor polisi (-$100).');
  if (state.screen === 'win') drawCenter(state, ctx, view, 'LEGENDA COSTA VERDE', `Semua 6 misi selesai! Uang: $${state.cash} · Tekan ENTER untuk free roam.`);
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
  // Top-left: health + armour bars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 220, 58, 8);
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
  ctx.fillText(`${hh}:${mm}  ·  🔫 ${p.mag}/${p.reserve}`, w - 22, 60);
  ctx.textAlign = 'left';
  // Wanted stars, top centre.
  ctx.textAlign = 'center';
  ctx.font = '26px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.stars ? '★' : '☆';
  ctx.fillStyle = state.stars > 0 ? '#f1c40f' : 'rgba(255,255,255,0.5)';
  ctx.fillText(stars, w / 2, 40);
  // District + mission banner.
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText(districtAt(state, p.x, p.y), w / 2, 66);
  ctx.shadowBlur = 0;
  if (state.bannerT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const bw = Math.min(w - 40, 560);
    roundRect(ctx, w / 2 - bw / 2, 78, bw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(state.banner.slice(0, 72), w / 2, 98);
  }
  const stage = currentStage(state);
  if (stage) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 12, h - 92, 330, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`▶ ${stage.text.slice(0, 48)}`, 22, h - 72);
  }
  // Speedometer when driving.
  const car = state.player.car !== null ? state.cars.find((c) => c.id === state.player.car) : null;
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
  for (const g of state.gang) dot(g.x, g.y, '#e74c3c', 3);
  for (const c of state.cops) dot(c.x, c.y, '#3498db', 3);
  dot(state.player.x, state.player.y, '#fff', 4);
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
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#d5dbdb';
  const lines = [
    'Curi mobil, kabur dari polisi, dan selesaikan 6 misi Doña Carmen.',
    'WASD gerak / kemudi · SHIFT lari · E curi & keluar mobil · Klik tembak · R isi peluru',
    'SPACE rem tangan · N mulai misi · H bantuan · M suara · ESC jeda',
  ];
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 - 34 + i * 24));
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
