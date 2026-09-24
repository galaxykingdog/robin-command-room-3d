import assert from 'node:assert/strict';
import { cameraRelativeInput, isBlocked, moveWithCollisions, radialInput, stepLocomotion, resolveCameraPosition } from '../src/movement.js';

const bounds = { minX: -6, maxX: 6, minZ: -5, maxZ: 5 };
const obstacle = { type: 'rect', minX: -1, maxX: 1, minZ: -1, maxZ: 0 };
const layout = { walkBounds: bounds, colliders: [obstacle] };
assert.deepEqual(radialInput(0.02, 0.03), { x: 0, y: 0 });
assert.ok(Math.abs(Math.hypot(...Object.values(radialInput(1, 1))) - 1) < 1e-9);
assert.deepEqual(cameraRelativeInput({ x: 1, y: 0 }, { x: 0, z: -1 }), { x: 1, z: 0 });
assert.deepEqual(cameraRelativeInput({ x: 0, y: 1 }, { x: 1, z: 0 }), { x: 1, z: 0 });
const stopped = moveWithCollisions({ x: 0, z: 2 }, { x: 0, z: -8 }, 0.52, bounds, [obstacle]);
assert.ok(stopped.z >= 0.52, 'Must not tunnel through the console');
const slide = moveWithCollisions({ x: 0, z: 0.55 }, { x: 0.5, z: -0.3 }, 0.52, bounds, [obstacle]);
assert.ok(slide.x > 0.4 && slide.z >= 0.52, 'Must slide along obstacles');
assert.equal(isBlocked(5.8, 0, 0.52, bounds, []), true);
assert.equal(isBlocked(0.6, 1, 0.52, bounds, [{ type: 'circle', x: 0, z: 1, radius: 0.3 }]), true);
const run = (hz) => {
  let state = { x: 2, z: 2, vx: 0, vz: 0, speed: 0 };
  for (let index = 0; index < hz; index++) state = stepLocomotion(state, { x: 0, z: -1 }, 1 / hz, layout);
  return state;
};
assert.ok(Math.abs(run(30).z - run(144).z) < 0.025, 'Movement must be frame-rate independent');
let released = run(60);
for (let index = 0; index < 60; index++) released = stepLocomotion(released, { x: 0, z: 0 }, 1 / 60, layout);
assert.ok(released.speed < 1e-7, 'Released input must come to rest');
for (const x of [-4.93, 0, 4.93]) {
  for (const z of [-1.4, 1.5, 4.3]) {
    for (const angle of [-1.25, 0, 1.25]) {
      const target = { x, y: 1.1, z };
      const camera = resolveCameraPosition({ x: x + Math.sin(angle) * 3.1, y: 1.39, z: z + Math.cos(angle) * 3.1 }, target);
      assert.ok(Math.hypot(camera.x - x, camera.y - 1.1, camera.z - z) >= 3.1 - 1e-9, 'Camera must retain minimum clearance at walls');
      assert.ok(Math.abs(camera.x) <= 5.15 && camera.z <= 7.8, 'Camera must stay inside the viewing bounds');
    }
  }
}
console.log('Movement checks passed: dead zone, diagonals, camera direction, boundaries, collision sliding, tunneling, frame rate, release.');
