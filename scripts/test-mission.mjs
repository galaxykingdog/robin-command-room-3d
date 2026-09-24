import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIVATION_RADIUS, CHARGE_DURATION, RETENTION_RADIUS, STATIONS,
  activateStation, canActivate, createMissionState, distanceToTarget,
  freeExplore, getMissionTarget, startMission, tickMission,
} from '../src/mission-state.js';
import { isBlocked, moveWithCollisions, PLAYER_RADIUS } from '../src/movement.js';

const layout = JSON.parse(readFileSync(new URL('../public/assets/room-layout.json', import.meta.url), 'utf8'));
const frozenState = (state) => Object.freeze({ ...state, completed: Object.freeze([...state.completed]) });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);
const chargeStation = (state, hz = 60) => {
  const position = getMissionTarget(state).position;
  let next = activateStation(state, position);
  for (let frame = 0; frame < Math.ceil(CHARGE_DURATION * hz); frame += 1) {
    next = tickMission(next, { dt: 1 / hz, position });
  }
  return next;
};

assert.ok(Object.isFrozen(STATIONS));
for (const station of STATIONS) {
  assert.ok(Object.isFrozen(station) && Object.isFrozen(station.position));
  assert.equal(isBlocked(station.position.x, station.position.z, PLAYER_RADIUS, layout.walkBounds, layout.colliders), false,
    `${station.name} must be reachable with Robin's full collision radius`);
}
// Cross in front of the captain's chair, using the actual collision system.
let walker = { ...layout.spawn };
for (const station of STATIONS) {
  const waypoints = [{ x: walker.x, z: 0.3 }, { x: station.position.x, z: 0.3 }, station.position];
  for (const waypoint of waypoints) {
    walker = moveWithCollisions(walker, { x: waypoint.x - walker.x, z: waypoint.z - walker.z },
      PLAYER_RADIUS, layout.walkBounds, layout.colliders);
  }
  assert.ok(Math.hypot(walker.x - station.position.x, walker.z - station.position.z) < 1e-8,
    `${station.name} must be reachable along the intended route`);
}

const briefing = frozenState(createMissionState());
assert.deepEqual(briefing, { phase: 'briefing', step: 0, completed: [], elapsed: 0, charge: 0 });
assert.equal(getMissionTarget(briefing).id, 'navigation');
assert.equal(canActivate(briefing, STATIONS[0].position), false);
assert.equal(tickMission(briefing, { dt: 1, position: STATIONS[0].position }), briefing);
const free = frozenState(freeExplore());
assert.equal(getMissionTarget(free), null);
assert.equal(distanceToTarget(free, STATIONS[0].position), Infinity);
assert.equal(activateStation(free, STATIONS[0].position), free);
assert.equal(tickMission(free, { dt: 0.05, position: STATIONS[0].position }), free);

let state = frozenState(startMission());
const target = STATIONS[0].position;
assert.equal(canActivate(state, { x: 100, z: 100 }), false);
assert.equal(canActivate(state, STATIONS[1].position), false, 'Cannot activate objectives out of order');
assert.equal(canActivate(state, { x: target.x, z: target.z + ACTIVATION_RADIUS }), true);
assert.equal(canActivate(state, { x: target.x, z: target.z + ACTIVATION_RADIUS + 0.001 }), false);
for (const position of [undefined, null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: '0', z: 0 }]) {
  assert.equal(distanceToTarget(state, position), Infinity);
  assert.equal(activateStation(state, position), state);
}
const charging = frozenState(activateStation(state, target));
assert.equal(charging.phase, 'charging');
assert.equal(activateStation(charging, target), charging, 'Repeated input must not restart charging');
assert.equal(tickMission(charging, { dt: 0.05, position: target, paused: true }), charging);
assert.equal(tickMission(state, { dt: 0.05, position: target, paused: true }), state);
for (const dt of [undefined, NaN, Infinity, -Infinity, -1, '0.05']) {
  const next = tickMission(charging, { dt, position: target });
  assert.equal(next.charge, 0);
  assert.equal(next.elapsed, 0);
}
const capped = tickMission(charging, { dt: 999, position: target });
near(capped.charge, 0.05);
near(capped.elapsed, 0.05);
const halfway = tickMission(capped, { dt: 0.05, position: target });
const edge = tickMission(halfway, { dt: 0.05, position: { x: target.x, z: target.z + RETENTION_RADIUS } });
assert.equal(edge.phase, 'charging');
for (const position of [{ x: target.x, z: target.z + RETENTION_RADIUS + 0.001 }, undefined, { x: NaN, z: 0 }]) {
  const cancelled = tickMission(halfway, { dt: 0.05, position });
  assert.equal(cancelled.phase, 'active');
  assert.equal(cancelled.charge, 0);
  assert.deepEqual(cancelled.completed, []);
  near(cancelled.elapsed, 0.15);
}
// Even valid proximity alone never triggers a station without deliberate input.
for (let frame = 0; frame < 100; frame += 1) state = tickMission(state, { dt: 0.05, position: target });
assert.equal(state.step, 0);
assert.equal(state.phase, 'active');
assert.equal(state.charge, 0);

for (const hz of [30, 60, 120, 144]) {
  let mission = startMission();
  for (let index = 0; index < STATIONS.length; index += 1) {
    assert.equal(getMissionTarget(mission), STATIONS[index]);
    mission = chargeStation(frozenState(mission), hz);
    assert.equal(mission.step, index + 1);
    assert.deepEqual(mission.completed, STATIONS.slice(0, index + 1).map(({ id }) => id));
    assert.equal(mission.charge, 0);
  }
  assert.equal(mission.phase, 'complete');
  assert.equal(getMissionTarget(mission), null);
  assert.equal(canActivate(mission, target), false);
  assert.equal(activateStation(mission, target), mission);
  assert.equal(tickMission(mission, { dt: 0.05, position: target }), mission);
  assert.ok(Math.abs(mission.elapsed - CHARGE_DURATION * STATIONS.length) <= 3 / hz + 1e-8,
    'Completion time must remain independent of frame rate within one frame per station');
}
const replay = startMission();
assert.deepEqual(replay, { phase: 'active', step: 0, completed: [], elapsed: 0, charge: 0 });
assert.notEqual(replay.completed, startMission().completed, 'Fresh missions must not share mutable completion arrays');
assert.deepEqual(charging.completed, [], 'State transitions must not mutate their inputs');
console.log('Mission checks passed: reachable stations, objective order, deliberate activation, cancellation, pause, finite timing, replay, frame rate, immutable transitions.');
