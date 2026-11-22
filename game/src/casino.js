// Casino Oro interior: walk in off the street, play the slot machines with
// real in-game cash, walk out. The interior is its own little room — the
// street outside freezes while you are inside — with four machines, two card
// tables with NPC regulars, gold carpet and a chandelier. One machine at a
// time is playable: stand by it, press E, $25 a spin.
import { CFG } from './config.js';
import { clamp } from './rng.js';

export const SLOT_BET = 25;
export const SLOT_SYMBOLS = ['7', '★', '🍒', '◆', 'BAR'];

// Reel windows of the machines the player is NOT using: fixed symbols drawn
// once from the seeded rng, so the room always looks the same for one seed.
function idleReels(rng) {
  return [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(rng() * SLOT_SYMBOLS.length)]);
}

export function createCasino(rng) {
  const machines = [];
  for (let i = 0; i < 4; i++) {
    machines.push({
      x: 170 + i * 180, y: 92, // room coords, along the top wall
      reels: idleReels(rng),
      color: ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad'][i],
    });
  }
  return {
    inside: false,
    x: 500, y: 460, // player position inside the room (room is 1000×560)
    w: 1000, h: 560,
    machines,
    npcs: [
      // The two regulars stand on the far side of their table now: at
      // y=330 their bodies covered the BLACKJACK label in screenshots.
      { x: 250, y: 272, color: '#e74c3c', table: true },
      { x: 430, y: 330, color: '#3498db', table: true },
      { x: 700, y: 272, color: '#2ecc71', table: true },
      { x: 830, y: 330, color: '#f39c12', table: true },
      { x: 610, y: 120, color: '#9b59b6', table: false }, // a regular at the slots
      { x: 860, y: 398, color: '#1abc9c', table: false }, // watching the roulette
    ],
    lastSpin: null, // { reels, win, bet }
    msg: '',
    msgT: 0,
    spins: 0,
    won: 0,
  };
}

// Payouts on a $25 spin: three 7s pays 20×, any other three of a kind 5×,
// any pair 2×. Roughly half of all spins pay something.
export function slotPayout(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) return a === '7' ? SLOT_BET * 20 : SLOT_BET * 5;
  if (a === b || b === c || a === c) return SLOT_BET * 2;
  return 0;
}

export function nearestMachine(casino) {
  let best = null;
  let bestD = 90 * 90;
  for (const m of casino.machines) {
    const dx = casino.x - m.x;
    const dy = casino.y - (m.y + 30);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

// One real spin: $25 out, the reels from the seeded rng, the payout back.
// Returns the result so the smoke tests can settle the cash exactly.
export function spinSlots(state) {
  const c = state.casino;
  if (state.cash < SLOT_BET) {
    c.msg = 'Uang tidak cukup untuk main slot ($25)!';
    c.msgT = 3;
    return null;
  }
  state.cash -= SLOT_BET;
  const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(state.rng() * SLOT_SYMBOLS.length)]);
  const win = slotPayout(reels);
  state.cash += win;
  c.spins++;
  c.won += win;
  state.stats.slots = (state.stats.slots || 0) + 1;
  state.stats.slotWon = (state.stats.slotWon || 0) + win;
  const machine = nearestMachine(c) || c.machines[0];
  machine.reels = reels;
  c.lastSpin = { reels: [...reels], win, bet: SLOT_BET };
  c.msg = win > 0
    ? `SLOT MENANG +$${win}!  [ ${reels.join(' | ')} ]`
    : `Slot: [ ${reels.join(' | ')} ] — kalah $${SLOT_BET}. Coba lagi!`;
  c.msgT = 4;
  state.events.push(win > 0 ? 'slotWin' : 'slot');
  return c.lastSpin;
}

export function enterCasino(state) {
  const c = state.casino;
  if (c.inside) return false;
  c.inside = true;
  // Park the player outside the door; leaving restores the exact spot.
  c.returnX = state.player.x;
  c.returnY = state.player.y;
  c.returnCar = state.player.car;
  state.player.car = null;
  c.x = 500;
  c.y = 460;
  c.msg = 'Selamat datang di Casino Oro! Mesin slot $25 — tekan E di dekat mesin.';
  c.msgT = 5;
  state.banner = 'Kamu masuk Casino Oro. E: main slot · E di pintu: keluar.';
  state.bannerT = 5;
  return true;
}

export function exitCasino(state) {
  const c = state.casino;
  if (!c.inside) return false;
  c.inside = false;
  state.player.x = c.returnX;
  state.player.y = c.returnY;
  state.player.car = null;
  state.banner = 'Kamu keluar dari Casino Oro.';
  state.bannerT = 3;
  return true;
}

// Inside the casino the street freezes: only the room moves — WASD walks,
// E spins the nearest machine or leaves through the door at the bottom.
export function stepCasino(state, input, dt) {
  const c = state.casino;
  if (c.msgT > 0) c.msgT -= dt;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len; dy /= len;
    c.x = clamp(c.x + dx * 210 * dt, 40, c.w - 40);
    c.y = clamp(c.y + dy * 210 * dt, 150, c.h - 40);
    state.player.angle = Math.atan2(dy, dx);
  }
  if (input.enter) {
    // Door first: the gold mat at the bottom centre walks you back out.
    if (Math.abs(c.x - 500) < 70 && c.y > c.h - 90) {
      exitCasino(state);
      return;
    }
    if (nearestMachine(c)) spinSlots(state);
  }
}

// --- rendering: the room, in screen space, centred on the view. ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCasino(ctx, state, view) {
  const { w, h } = view;
  const c = state.casino;
  const rx = (w - c.w) / 2;
  const ry = (h - c.h) / 2;
  const X = (x) => rx + x;
  const Y = (y) => ry + y;

  // Outside the room: a dark street backdrop.
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, w, h);
  // Gold-trimmed walls.
  ctx.fillStyle = '#3d1a1a';
  ctx.fillRect(rx - 14, ry - 14, c.w + 28, c.h + 28);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(rx - 14, ry - 14, c.w + 28, 6);
  ctx.fillRect(rx - 14, ry + c.h + 8, c.w + 28, 6);
  // Carpet with a gold diamond pattern.
  ctx.fillStyle = '#7b241c';
  ctx.fillRect(rx, ry, c.w, c.h);
  ctx.strokeStyle = 'rgba(241,196,15,0.25)';
  ctx.lineWidth = 1;
  for (let gx = 40; gx < c.w; gx += 80) {
    for (let gy = 200; gy < c.h; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(X(gx), Y(gy - 14));
      ctx.lineTo(X(gx + 14), Y(gy));
      ctx.lineTo(X(gx), Y(gy + 14));
      ctx.lineTo(X(gx - 14), Y(gy));
      ctx.closePath();
      ctx.stroke();
    }
  }
  // Sign over the door wall.
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ CASINO ORO ★', X(500), Y(52));
  ctx.fillStyle = '#fdebd0';
  ctx.font = '13px sans-serif';
  ctx.fillText('SLOT $25  ·  TIGA 7 = $500  ·  TIGA SAMA = $125  ·  SEPASANG = $50', X(500), Y(74));

  // Chandelier glow.
  const glow = 0.10 + Math.sin(state.clock * 2) * 0.02;
  ctx.fillStyle = `rgba(255,233,163,${glow})`;
  ctx.beginPath();
  ctx.arc(X(500), Y(150), 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(X(500), Y(110), 10, 0, Math.PI * 2);
  ctx.fill();

  // Framed art on the side walls + potted palms in the bottom corners,
  // so the red carpet is not one flat field.
  for (const fx of [36, 928]) {
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(X(fx), Y(276), 36, 48);
    ctx.fillStyle = '#7b241c';
    ctx.fillRect(X(fx + 4), Y(280), 28, 40);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★', X(fx + 18), Y(308));
  }
  for (const px of [56, 952]) {
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(X(px - 10), Y(508), 20, 18);
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(X(px), Y(498), 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(X(px - 4), Y(494), 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Slot machines along the top wall.
  const near = nearestMachine(c);
  for (const m of c.machines) {
    const active = m === near;
    if (active) {
      ctx.fillStyle = 'rgba(241,196,15,0.35)';
      ctx.beginPath();
      ctx.arc(X(m.x), Y(m.y + 30), 62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1b2631';
    roundRect(ctx, X(m.x - 52), Y(m.y - 14), 104, 108, 10);
    ctx.fill();
    ctx.fillStyle = m.color;
    roundRect(ctx, X(m.x - 52), Y(m.y - 14), 104, 26, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SLOT', X(m.x), Y(m.y + 4));
    // Reel windows.
    ctx.fillStyle = '#fdfefe';
    roundRect(ctx, X(m.x - 44), Y(m.y + 18), 88, 34, 4);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    m.reels.forEach((s, i) => {
      // 'BAR' is wider than the other symbols: shrink it so it never
      // overlaps its neighbours.
      ctx.font = s.length > 1 ? 'bold 13px sans-serif' : 'bold 20px sans-serif';
      ctx.fillText(s, X(m.x - 30 + i * 30), Y(m.y + 43));
    });
    // Lever + coin tray.
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(m.x + 52), Y(m.y + 20));
    ctx.lineTo(X(m.x + 62), Y(m.y - 2));
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(X(m.x + 62), Y(m.y - 4), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('$25', X(m.x), Y(m.y + 68));
    // Blinking lights.
    const lit = Math.floor(state.clock * 3 + m.x) % 2 === 0;
    ctx.fillStyle = lit ? '#ffe066' : '#7d6608';
    for (let l = 0; l < 3; l++) {
      ctx.beginPath();
      ctx.arc(X(m.x - 30 + l * 30), Y(m.y + 84), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f1c40f';
    roundRect(ctx, X(m.x - 44), Y(m.y + 94), 88, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('TARIK / E', X(m.x), Y(m.y + 106));
  }

  // Card tables with NPC regulars.
  for (const t of [{ x: 300, y: 330 }, { x: 700, y: 330 }]) {
    ctx.fillStyle = '#145a32';
    ctx.beginPath();
    ctx.ellipse(X(t.x), Y(t.y), 90, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(X(t.x), Y(t.y), 90, 42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fdfefe';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('♠ ♥ BLACKJACK', X(t.x), Y(t.y + 4));
    // Chips on the table.
    const chips = ['#e74c3c', '#3498db', '#f1c40f'];
    chips.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(X(t.x - 30 + i * 30), Y(t.y - 18), 7, 0, Math.PI * 2);
      ctx.fill();
    });
    // Two face-up cards below the label + a chip stack at the table edge.
    ctx.fillStyle = '#fdfefe';
    ctx.fillRect(X(t.x - 16), Y(t.y + 12), 11, 15);
    ctx.fillRect(X(t.x + 5), Y(t.y + 12), 11, 15);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('A', X(t.x - 10), Y(t.y + 24));
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText('K', X(t.x + 11), Y(t.y + 24));
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = ['#e74c3c', '#3498db', '#f1c40f'][s];
      ctx.beginPath();
      ctx.arc(X(t.x + 68), Y(t.y + 8 - s * 5), 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Roulette wheel in the empty bottom-right corner.
  ctx.fillStyle = '#145a32';
  ctx.beginPath();
  ctx.ellipse(X(860), Y(452), 78, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(X(860), Y(452), 78, 36, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#0d3b21';
  ctx.beginPath();
  ctx.ellipse(X(860), Y(452), 54, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdfefe';
  ctx.beginPath();
  ctx.arc(X(882), Y(442), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdfefe';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('ROULETTE', X(860), Y(456));
  // NPCs (bobbing gently) and the player.
  for (const n of c.npcs) {
    const bob = Math.sin(state.clock * 2 + n.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(X(n.x), Y(n.y + 12), 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = n.color;
    ctx.beginPath();
    ctx.arc(X(n.x), Y(n.y + bob), 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath();
    ctx.arc(X(n.x), Y(n.y + bob - 4), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player — 1.5×, with the same gold ring + forward wedge as on the street.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(X(c.x), Y(c.y + 18), 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(241,196,15,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(X(c.x), Y(c.y), 26, 0, Math.PI * 2);
  ctx.stroke();
  const pa = state.player.angle;
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.moveTo(X(c.x + Math.cos(pa) * 34), Y(c.y + Math.sin(pa) * 34));
  ctx.lineTo(X(c.x + Math.cos(pa + 2.6) * 22), Y(c.y + Math.sin(pa + 2.6) * 22));
  ctx.lineTo(X(c.x + Math.cos(pa - 2.6) * 22), Y(c.y + Math.sin(pa - 2.6) * 22));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(X(c.x), Y(c.y), 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(X(c.x + Math.cos(pa) * 6), Y(c.y + Math.sin(pa) * 6), 7, 0, Math.PI * 2);
  ctx.fill();

  // Gold door mat at the bottom centre.
  ctx.fillStyle = '#b7950b';
  roundRect(ctx, X(430), Y(c.h - 52), 140, 40, 6);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('KELUAR (E)', X(500), Y(c.h - 27));

  // Hint + last spin result, under the room.
  ctx.textAlign = 'center';
  if (near) {
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('▶ Tekan E untuk main slot ($25)', X(500), Y(c.h - 62));
  }
  if (c.msgT > 0 && c.msg) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const mw = Math.min(w - 40, 560);
    roundRect(ctx, w / 2 - mw / 2, h - 64, mw, 30, 8);
    ctx.fill();
    ctx.fillStyle = c.lastSpin && c.lastSpin.win > 0 ? '#2ecc71' : '#ffe066';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(c.msg.slice(0, 72), w / 2, h - 44);
  }
  // Top bar: cash + place.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 260, 46, 8);
  ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.cash}`, 22, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('CASINO ORO · El Centro', 110, 42);
  // Controls hint on a dark pill, inset from the edges so the bar is
  // fully inside the frame.
  const hint = 'WASD jalan · E main slot / keluar · ESC jeda';
  ctx.textAlign = 'left';
  ctx.font = '11px sans-serif';
  const hw = ctx.measureText(hint).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, h - 30, hw + 20, 20, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(hint, 22, h - 16);
  ctx.textAlign = 'left';
}
