import { distanceToTarget, getMissionTarget } from './mission-state.js';

const AISLE_Z = 0.35;
const AISLE_TOLERANCE = 0.05;
const SIDE_ALIGNMENT = 0.15;
const STOP_RADIUS = 0.65;

function toward(position, destination) {
  const dx = destination.x - position.x;
  const dz = destination.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-9) return { x: 0, z: 0 };
  // Ease into each corner so existing locomotion inertia cannot overshoot it.
  const amount = Math.min(1, distance / 0.5);
  return { x: (dx / distance) * amount, z: (dz / distance) * amount };
}

// A memoryless route through the front aisle. These are world-space inputs;
// do not rotate them with the camera like a player's joystick direction.
export function getDemoInput(state, position) {
  const target = getMissionTarget(state);
  if (state?.phase !== 'active' || !target ||
      !Number.isFinite(position?.x) || !Number.isFinite(position?.z) ||
      distanceToTarget(state, position) <= STOP_RADIUS) return { x: 0, z: 0 };

  const isSideStation = state.step < 2;
  if (isSideStation && Math.abs(target.position.x - position.x) <= SIDE_ALIGNMENT) {
    return toward(position, target.position);
  }
  // First leave the side console; never cross through the captain's chair.
  if (position.z < AISLE_Z - AISLE_TOLERANCE) {
    return toward(position, { x: position.x, z: AISLE_Z });
  }
  // The opening leg retains the spawn's foreground depth. Later legs use
  // the aisle reached above, and residual forward velocity settles safely.
  if (isSideStation) return toward(position, { x: target.position.x, z: position.z });
  return toward(position, target.position);
}
