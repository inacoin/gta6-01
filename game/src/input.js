// Keyboard + mouse input, kept as a plain object the sim reads each frame.
// Keys are edge-triggered where the sim needs a single press (enter, reload,
// mission, pause) and level-triggered where it needs holding (drive, run).
export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    run: false, handbrake: false,
    enter: false, reload: false, missionKey: false, pause: false,
    shoot: false, shootQueued: false,
    help: false, mute: false, confirm: false, cont: false,
    aimX: 0, aimY: 0, mouseX: 0, mouseY: 0,
  };
  const down = new Set();
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down.add(e.code);
    const mapped = keyMap[e.code];
    if (mapped) { input[mapped] = true; e.preventDefault(); }
    if (e.code === 'KeyE') input.enter = true;
    if (e.code === 'KeyR') input.reload = true;
    if (e.code === 'KeyN') input.missionKey = true;
    if (e.code === 'Escape') input.pause = true;
    if (e.code === 'KeyH') input.help = true;
    if (e.code === 'KeyM') input.mute = true;
    if (e.code === 'Enter') input.confirm = true;
    if (e.code === 'KeyC') input.cont = true;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    down.delete(e.code);
    const mapped = keyMap[e.code];
    if (mapped) input[mapped] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.shootQueued = true;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keyMap)) input[keyMap[k]] = false;
    down.clear();
  });
  // Consume all one-shot flags after the sim read them this frame.
  input.endFrame = () => {
    input.enter = false;
    input.reload = false;
    input.missionKey = false;
    input.pause = false;
    input.help = false;
    input.mute = false;
    input.confirm = false;
    input.cont = false;
    input.shoot = input.shootQueued;
    input.shootQueued = false;
  };
  return input;
}
