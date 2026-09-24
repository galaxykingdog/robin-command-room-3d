export const CHARGE_DURATION = 1.6;
export const ACTIVATION_RADIUS = 1.15;
export const RETENTION_RADIUS = 1.35;

export const STATIONS = Object.freeze([
  { id: 'navigation', name: 'Navigation', action: 'Align navigation', hint: 'Reach the left console', position: { x: -3.35, z: -1 }, color: 0xffc06f },
  { id: 'power', name: 'Power', action: 'Restore power', hint: 'Cross the front aisle to the right console', position: { x: 3.35, z: -1 }, color: 0x8debd5 },
  { id: 'uplink', name: 'Uplink', action: 'Open the uplink', hint: 'Return to the central beacon', position: { x: 0, z: 0.3 }, color: 0xa8bbff },
].map((station) => Object.freeze({ ...station, position: Object.freeze(station.position) })));

export function createMissionState() {
  return { phase: 'briefing', step: 0, completed: [], elapsed: 0, charge: 0 };
}

export function startMission() {
  return { ...createMissionState(), phase: 'active' };
}

export function freeExplore() {
  return { ...createMissionState(), phase: 'free' };
}

export function getMissionTarget(state) {
  if (!state || !['briefing', 'active', 'charging'].includes(state.phase)) return null;
  return STATIONS[state.step] ?? null;
}

export function distanceToTarget(state, position) {
  const target = getMissionTarget(state);
  if (!target || !Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return Infinity;
  return Math.hypot(position.x - target.position.x, position.z - target.position.z);
}

export function canActivate(state, position) {
  return state?.phase === 'active' && distanceToTarget(state, position) <= ACTIVATION_RADIUS;
}

export function activateStation(state, position) {
  return canActivate(state, position) ? { ...state, phase: 'charging', charge: 0 } : state;
}

// All transitions are pure. Charge is measured in seconds, not a percentage.
// A short time-step cap prevents a suspended tab from completing a station.
export function tickMission(state, { dt, position, paused = false } = {}) {
  if (paused || !['active', 'charging'].includes(state.phase)) return state;
  const seconds = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
  const elapsed = state.elapsed + seconds;
  if (state.phase === 'active') return seconds ? { ...state, elapsed } : state;
  if (distanceToTarget(state, position) > RETENTION_RADIUS) {
    return { ...state, phase: 'active', charge: 0, elapsed };
  }
  const charge = Math.min(CHARGE_DURATION, state.charge + seconds);
  if (charge + 1e-9 < CHARGE_DURATION) return { ...state, elapsed, charge };
  const completed = [...state.completed, STATIONS[state.step].id];
  const step = state.step + 1;
  return { phase: step === STATIONS.length ? 'complete' : 'active', step, completed, elapsed, charge: 0 };
}
