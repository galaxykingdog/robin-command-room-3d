import { radialInput } from './movement.js';

export function createMovementInput(pad, thumb, onGesture = () => {}) {
  let pointerId = null;
  let enabled = false;
  let analog = { x: 0, y: 0 };
  const keys = new Set();
  const bindings = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const listeners = [];
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  };

  function center() {
    analog = { x: 0, y: 0 };
    thumb.style.transform = 'translate(-50%, -50%)';
    pad.classList.remove('is-active');
  }
  function reset() {
    const heldPointer = pointerId;
    pointerId = null;
    keys.clear();
    center();
    if (heldPointer !== null && pad.hasPointerCapture(heldPointer)) pad.releasePointerCapture(heldPointer);
  }
  function updatePointer(event) {
    const rect = pad.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy);
    const limit = length > radius ? radius / length : 1;
    analog = radialInput((dx * limit) / radius, (-dy * limit) / radius);
    thumb.style.transform = `translate(calc(-50% + ${dx * limit}px), calc(-50% + ${dy * limit}px))`;
  }

  listen(pad, 'pointerdown', (event) => {
    if (!enabled || pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    pad.setPointerCapture(pointerId);
    pad.classList.add('is-active');
    updatePointer(event);
    onGesture();
  });
  listen(pad, 'pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    updatePointer(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(pad, name, (event) => { if (event.pointerId === pointerId) reset(); });
  }
  listen(window, 'keydown', (event) => {
    if (!enabled || !bindings.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    keys.add(event.code);
    onGesture();
  });
  listen(window, 'keyup', (event) => keys.delete(event.code));
  listen(window, 'blur', reset);
  listen(document, 'visibilitychange', reset);
  listen(window, 'orientationchange', reset);

  return {
    sample() {
      if (!enabled) return { x: 0, y: 0 };
      const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const y = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      return x || y ? radialInput(x, y, 0) : analog;
    },
    reset,
    setEnabled(value) {
      enabled = value;
      pad.setAttribute('aria-disabled', String(!value));
      if (!value) reset();
    },
    dispose() { reset(); listeners.forEach((remove) => remove()); },
  };
}
