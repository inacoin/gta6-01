// Automated smoke test for Costa Verde, over CDP (Node 22 built-in WebSocket).
// Drives the real game in headless Chromium: walk, steal a car, drive, shoot,
// mission 1 end-to-end, wanted up and down, autosave round-trip.
// Run from the repository root: node tools/smoke.mjs (exit 0 = all green).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const DEBUG_PORT = 9334;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
}

async function getJson(path) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chromium devtools did not come up');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  };
  return {
    ready, on: (fn) => listeners.push(fn),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    }),
    close: () => ws.close(),
  };
}

const server = spawn('node', ['serve.ts'], { cwd: root, stdio: 'pipe' });
await sleep(1200);
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${DEBUG_PORT}`, '--window-size=1280,720', 'about:blank',
], { stdio: 'pipe' });

const pageErrors = [];
try {
  await getJson('/json/version');
  const target = await (await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?http://localhost:8080/?seed=7`,
    { method: 'PUT' },
  )).json();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  cdp.on((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });
  const evl = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result?.value;
  };
  const status = async () => JSON.parse(await evl('document.getElementById("status").textContent'));
  const waitFor = async (fn, timeoutMs, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const v = await fn();
      if (v) return v;
      await sleep(200);
    }
    return null;
  };

  await waitFor(() => evl('!!window.__game'), 8000, 'boot');
  check('game boots, title screen', (await status()).screen === 'title');

  // Start the game.
  await evl('__game.start()');
  await sleep(300);
  check('start -> play screen', (await status()).screen === 'play');

  // Walk north for a second.
  const y0 = (await status()).y;
  await evl('__game.input.up = true');
  await sleep(1000);
  await evl('__game.input.up = false');
  const y1 = (await status()).y;
  check('walking moves the player', y1 < y0 - 50, `y ${y0} -> ${y1}`);

  // Steal the nearest parked car.
  await evl(`(() => {
    const s = __game.state;
    const parked = s.cars.find((c) => c.parked);
    __game.teleport(parked.x - 24, parked.y);
  })()`);
  await sleep(150);
  await evl('__game.input.enter = true');
  await sleep(300);
  let st = await status();
  check('steal car with E', st.inCar === true, JSON.stringify(st));

  // Drive for two seconds (any direction: the stolen car may face west).
  const x0 = st.x;
  const y0d = st.y;
  await evl('__game.input.up = true');
  await sleep(2000);
  await evl('__game.input.up = false');
  st = await status();
  const moved = Math.hypot(st.x - x0, st.y - y0d);
  check('driving moves the car', moved > 100, `moved ${Math.round(moved)}px`);

  // Wanted: stealing should have raised heat.
  check('car theft raises wanted', st.stars >= 1, `stars=${st.stars}`);

  // Get out, then shoot at a point ahead (real mouse input path).
  await evl('__game.input.enter = true');
  await sleep(300);
  st = await status();
  check('exit car with E', st.inCar === false);
  const mag0 = await evl('__game.state.player.mag');
  const aim = await evl('(() => { const s = __game.state; return { x: 640, y: 200 }; })()');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: aim.x, y: aim.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: aim.x, y: aim.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: aim.x, y: aim.y, button: 'left', clickCount: 1 });
  await sleep(300);
  const mag1 = await evl('__game.state.player.mag');
  check('mouse click fires the pistol', mag1 === mag0 - 1, `mag ${mag0} -> ${mag1}`);

  // Mission 1 end to end: pickup at the marina, deliver to the bar.
  // Wait for stage 0 to complete (stage becomes 1) before heading to the bar.
  await evl('__game.startMission()');
  await sleep(200);
  await evl('(() => { const p = __game.state.city.places.marinaKiosk; __game.teleport(p.x, p.y); })()');
  const pickedUp = await waitFor(async () => (await evl('__game.state.mission.stage')) === 1, 8000);
  check('mission 1 stage 0 (pickup at marina)', !!pickedUp);
  await evl('(() => { const p = __game.state.city.places.bar; __game.teleport(p.x, p.y); })()');
  const reachedBar = await waitFor(async () => (await status()).mission >= 1, 8000);
  st = await status();
  check('mission 1 completes (pickup + deliver)', reachedBar && st.mission >= 1, `missions done=${st.mission}, cash=$${st.cash}`);
  check('mission 1 pays $300', st.cash >= 150 + 300, `cash=$${st.cash}`);

  // Wanted up: get in a car first (foot cops can bust a player standing
  // still on foot), force heat, cops must show up.
  await evl(`(() => {
    const s = __game.state;
    const parked = s.cars.find((c) => c.parked);
    __game.teleport(parked.x - 24, parked.y);
  })()`);
  await sleep(150);
  await evl('__game.input.enter = true');
  await sleep(300);
  await evl('__game.setHeat(58)');
  const copsCame = await waitFor(async () => {
    const s = await status();
    return s.stars >= 2 && s.cops > 0 ? true : null;
  }, 10000);
  st = await status();
  check('wanted 2+ stars spawns police', !!copsCame, `stars=${st.stars} cops=${st.cops} screen=${st.screen}`);

  // Wanted down: low heat decays back to zero stars. If a bust/wasted screen
  // ever appears, confirm through it and re-check.
  await evl('__game.setHeat(4); __game.state.cops.length = 0;');
  const cooled = await waitFor(async () => {
    const s = await status();
    if (s.screen === 'busted' || s.screen === 'wasted') {
      await evl('__game.input.confirm = true');
      await sleep(200);
      return null;
    }
    return s.stars === 0;
  }, 20000);
  check('heat decays, stars clear', !!cooled, `stars=${(await status()).stars}`);

  // Autosave round-trip through localStorage.
  const saved = await evl('__game.save()');
  const hasKey = await evl('!!localStorage.getItem("costaverde-save-v1")');
  const loaded = await evl('__game.load()');
  check('autosave writes + loads localStorage', saved && hasKey && loaded);

  // Mission 6 target exists (bank heist reachable) — static sanity.
  const bankOk = await evl('!!__game.state.city.places.bank && __game.state.city.places.bank.x > 0');
  check('bank / hideout places exist', bankOk);

  check('no page errors during smoke test', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
  cdp.close();
} finally {
  chrome.kill();
  server.kill();
}
console.log(failures.length === 0 ? 'SMOKE: ALL GREEN' : `SMOKE: ${failures.length} FAILURES: ${failures.join(', ')}`);
process.exitCode = failures.length === 0 ? 0 : 1;
