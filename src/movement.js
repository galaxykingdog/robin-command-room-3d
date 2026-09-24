export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const PLAYER_RADIUS = 0.62;

export function resolveCameraPosition(position, target, minDistance = 3.1) {
  const x = clamp(position.x, -5.15, 5.15);
  const y = clamp(position.y, 1.8, 5.15);
  let z = clamp(Math.max(position.z, target.z + 1.2), -4.1, 7.8);
  const dx = x - target.x;
  const dy = y - target.y;
  if (Math.hypot(dx, dy, z - target.z) < minDistance) {
    // Rotate toward the open entrance when a wall prevents the chosen orbit.
    // Unlike independent axis clamps, this preserves clearance from Robin.
    z = target.z + Math.sqrt(Math.max(0, minDistance ** 2 - dx ** 2 - dy ** 2));
  }
  return { x, y, z };
}

export function radialInput(x, y, deadZone = 0.12) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= deadZone) return { x: 0, y: 0 };
  const amount = (Math.min(length, 1) - deadZone) / (1 - deadZone);
  return { x: (x / length) * amount, y: (y / length) * amount };
}

export function cameraRelativeInput(input, forward) {
  const length = Math.hypot(forward.x, forward.z);
  const fx = length > 1e-6 ? forward.x / length : 0;
  const fz = length > 1e-6 ? forward.z / length : -1;
  return { x: fx * input.y - fz * input.x, z: fz * input.y + fx * input.x };
}

export function isBlocked(x, z, radius, bounds, colliders) {
  if (x < bounds.minX + radius || x > bounds.maxX - radius ||
      z < bounds.minZ + radius || z > bounds.maxZ - radius) return true;
  return colliders.some((item) => {
    if (item.type === 'circle') return Math.hypot(x - item.x, z - item.z) < radius + item.radius;
    if (item.type !== 'rect') return false;
    const nearestX = clamp(x, item.minX, item.maxX);
    const nearestZ = clamp(z, item.minZ, item.maxZ);
    return Math.hypot(x - nearestX, z - nearestZ) < radius;
  });
}

// Short substeps prevent crossing a thin obstacle when a frame is delayed.
// Separate axes keep movement sliding naturally along a desk or wall.
export function moveWithCollisions(position, displacement, radius, bounds, colliders) {
  const steps = Math.max(1, Math.ceil(Math.hypot(displacement.x, displacement.z) / 0.08));
  let { x, z } = position;
  const dx = displacement.x / steps;
  const dz = displacement.z / steps;
  for (let index = 0; index < steps; index += 1) {
    if (!isBlocked(x + dx, z, radius, bounds, colliders)) x += dx;
    if (!isBlocked(x, z + dz, radius, bounds, colliders)) z += dz;
  }
  return { x, z };
}

export function stepLocomotion(state, desired, seconds, layout, speed = 1.5) {
  const dt = clamp(seconds, 0, 0.05);
  const moving = Math.hypot(desired.x, desired.z) > 0.01;
  const response = 1 - Math.exp(-(moving ? 12 : 20) * dt);
  const vx = state.vx + (desired.x * speed - state.vx) * response;
  const vz = state.vz + (desired.z * speed - state.vz) * response;
  const next = moveWithCollisions(state, { x: vx * dt, z: vz * dt }, PLAYER_RADIUS, layout.walkBounds, layout.colliders);
  const actualSpeed = dt ? Math.hypot(next.x - state.x, next.z - state.z) / dt : 0;
  return { ...next, vx, vz, speed: actualSpeed };
}
