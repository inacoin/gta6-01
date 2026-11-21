// Save / load through localStorage. Small and versioned: cash, missions done,
// player position and health. Autosave fires after every mission and on the
// sim's autosave event; Continue on the title screen restores it.
const KEY = 'costaverde-save-v1';

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.cash,
      missions: state.stats.missions,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      hp: Math.round(state.player.hp),
      armor: Math.round(state.player.armor),
      mag: state.player.mag,
      reserve: state.player.reserve,
      time: state.time,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(state, data) {
  state.cash = data.cash;
  state.stats.missions = data.missions;
  state.mission.idx = data.missions;
  state.player.x = data.x;
  state.player.y = data.y;
  state.player.hp = data.hp;
  state.player.armor = data.armor;
  state.player.mag = data.mag;
  state.player.reserve = data.reserve;
  state.time = data.time;
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
