import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDemoInput } from '../src/demo-pilot.js';
import { activateStation, distanceToTarget, startMission, STATIONS, tickMission } from '../src/mission-state.js';
import { isBlocked, PLAYER_RADIUS, stepLocomotion } from '../src/movement.js';

const layout = JSON.parse(readFileSync(new URL('../public/assets/room-layout.json', import.meta.url), 'utf8'));
const active = startMission();
const zero = { x: 0, z: 0 };
for (const phase of ['briefing', 'charging', 'free', 'complete']) {
  assert.deepEqual(getDemoInput({ ...active, phase }, layout.spawn), zero);
}
for (const position of [null, undefined, {}, { x: NaN, z: 1 }, { x: 0, z: Infinity }, { x: '0', z: 0 }]) {
  assert.deepEqual(getDemoInput(active, position), zero);
}
assert.deepEqual(getDemoInput(null, layout.spawn), zero);
assert.deepEqual(getDemoInput({ ...active, step: 99 }, layout.spawn), zero);
assert.deepEqual(getDemoInput(active, STATIONS[0].position), zero);
assert.deepEqual(getDemoInput(active, { x: -3.35, z: -0.35 }), zero);
const opening = getDemoInput(active, layout.spawn);
assert.ok(opening.x < 0 && opening.z === 0, 'Start with a horizontal foreground approach');
const aligned = getDemoInput(active, { x: -3.3, z: 1.5 });
assert.ok(aligned.z < 0, 'Once aligned, approach the left console');
const retreat = getDemoInput({ ...active, step: 1 }, { x: -3.35, z: -0.4 });
assert.ok(retreat.x === 0 && retreat.z > 0, 'Exit to the aisle before crossing to the right');
const crossing = getDemoInput({ ...active, step: 1 }, { x: 0, z: 0.35 });
assert.ok(crossing.x > 0 && crossing.z === 0, 'Cross in front of the chair');
const returnToAisle = getDemoInput({ ...active, step: 2 }, { x: 3.35, z: -0.4 });
assert.ok(returnToAisle.x === 0 && returnToAisle.z > 0, 'Exit right console before returning to the center');

function simulate(dt, spawn = layout.spawn) {
  let mission = startMission();
  let position = { ...spawn, vx: 0, vz: 0, speed: 0 };
  const inputState = Object.freeze({ ...active, completed: Object.freeze([]) });
  const inputPosition = Object.freeze({ ...spawn });
  assert.deepEqual(getDemoInput(inputState, inputPosition), getDemoInput(inputState, inputPosition), 'Inputs are deterministic and immutable');
  const activationSteps = [];
  const paths = [[], [], []];
  let elapsed = 0;
  for (let frame = 0; frame < 12000 && mission.phase !== 'complete'; frame += 1) {
    const direction = getDemoInput(mission, position);
    assert.ok(Number.isFinite(direction.x) && Number.isFinite(direction.z));
    assert.ok(Math.hypot(direction.x, direction.z) <= 1 + 1e-9, 'World input must be normalized');
    position = stepLocomotion(position, direction, dt, layout);
    assert.equal(isBlocked(position.x, position.z, PLAYER_RADIUS, layout.walkBounds, layout.colliders), false,
      'Guided route must respect full character collision radius');
    paths[mission.step].push({ ...position });
    if (mission.phase === 'active' && distanceToTarget(mission, position) < 0.68) {
      activationSteps.push(mission.step);
      mission = activateStation(mission, position);
    }
    mission = tickMission(mission, { dt, position });
    elapsed += Math.min(dt, 0.05);
  }
  assert.equal(mission.phase, 'complete', `Pilot must finish at dt=${dt}`);
  assert.deepEqual(activationSteps, [0, 1, 2], 'Charging must not cancel or repeatedly restart');
  assert.deepEqual(mission.completed, STATIONS.map(({ id }) => id));
  assert.ok(elapsed < 30, 'Guided presentation should finish without stalling');
  // The long traversal has one forward retreat and one final console approach,
  // with a single-direction horizontal leg instead of waypoint oscillation.
  const powerPath = paths[1];
  for (let index = 1; index < powerPath.length; index += 1) {
    assert.ok(powerPath[index].x >= powerPath[index - 1].x - 0.005, 'No horizontal zigzag while crossing the room');
    if (Math.abs(powerPath[index].x) < 1.6) assert.ok(powerPath[index].z >= 0.25, 'Cross the central aisle safely');
  }
  return elapsed;
}

const times = [30, 60, 120, 144].map((hz) => simulate(1 / hz));
assert.ok(Math.max(...times) - Math.min(...times) < 0.3, 'Guided route should be frame-rate independent');
simulate(0.5); // Both motion and mission cap delayed frames at 50 ms.
simulate(1 / 60, { x: -1.2, z: 2.5 });
simulate(1 / 60, { x: 1.2, z: 1 });
console.log('Guided-demo checks passed: deterministic input, safe aisle routing, three-station completion, capped frames, frame rate, no waypoint zigzag.');
