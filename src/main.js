import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMovementInput } from './input.js';
import { cameraRelativeInput, stepLocomotion, clamp, isBlocked, PLAYER_RADIUS, resolveCameraPosition } from './movement.js';
import { STATIONS, CHARGE_DURATION, createMissionState, startMission, freeExplore, tickMission, activateStation, distanceToTarget, getMissionTarget } from './mission-state.js';
import { createMissionEffects } from './mission-effects.js';
import { createMissionView } from './mission-view.js';
import { createSound } from './sound.js';
import { getDemoInput } from './demo-pilot.js';
import './styles.css';

const asset = (name) => `${import.meta.env.BASE_URL}${name}`;
const get = (id) => document.getElementById(id);
const ui = Object.fromEntries(['scene', 'experience', 'status', 'loading', 'loading-label', 'loading-bar',
  'loading-percent', 'error', 'error-message', 'retry', 'joystick', 'joystick-thumb', 'motion-toggle',
  'orbit-toggle', 'reset-camera', 'fullscreen', 'wave', 'sound-toggle'].map((id) => [id, get(id)]));
ui.retry.addEventListener('click', () => location.reload());
const compact = matchMedia('(max-width: 760px), (max-height: 560px)');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = Boolean(navigator.connection?.saveData);
let reducedMotion = motionPreference.matches;
let paused = false;
let ready = false;
let contextLost = false;
let previousTime = null;
let autoOrbit = false;
let orbitTime = 0;
let mission = createMissionState();
let effects;
let effectsTime = 0;
let cinematic = null;
let guided = false;
let celebrationRemaining = 0;
let illumination = 0;
const roomEmissions = [];
const roomLights = {};
const sound = createSound();
let model = null;
let mixer = null;
let waving = false;
let walkWeight = 0;
let waveWeight = 0;
let currentStatus = '';
let layout;
let locomotion = { x: 0, z: 1.4, vx: 0, vz: 0, speed: 0 };
const actions = {};

function setStatus(text) {
  if (text !== currentStatus) { ui.status.textContent = text; currentStatus = text; }
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111a25);
scene.fog = new THREE.Fog(0x111a25, 18, 42);
const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 70);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: ui.scene, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  ui.loading.hidden = true;
  ui.error.hidden = false;
  ui['error-message'].textContent = 'This experience needs WebGL. Try an up-to-date browser with graphics acceleration enabled.';
  throw error;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, ui.scene);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.1;
controls.maxDistance = 8.5;
controls.minPolarAngle = 0.21 * Math.PI;
controls.maxPolarAngle = 0.47 * Math.PI;
controls.minAzimuthAngle = -1.25;
controls.maxAzimuthAngle = 1.25;
controls.autoRotateSpeed = 0.45;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.17, 0.45, 1.15));
composer.addPass(new OutputPass());
let usePostProcessing = !compact.matches && !saveData;

const avatar = new THREE.Group();
avatar.name = 'RobinPlayer';
scene.add(avatar);
const desiredTarget = new THREE.Vector3();
const followDelta = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const projectedTarget = new THREE.Vector3();

const input = createMovementInput(ui.joystick, ui['joystick-thumb'], () => {
  guided = false;
  if (autoOrbit) { autoOrbit = false; updateButtons(); }
  if (waving) { waving = false; actions.Wave?.fadeOut(0.18); }
});
const missionView = createMissionView({
  onLaunch: () => launchMission(), onReplay: () => launchMission(), onActivate: interact,
  onDemo: () => launchMission(true), onTakeControl: () => { guided = false; input.reset(); },
  onSkip: finishIntro, onFree: exploreFreely, onContinue: () => {
    mission = { ...mission, phase: 'free' };
    celebrationRemaining = 0;
    homeCamera();
    updateButtons();
    ui.scene.focus({ preventScroll: true });
  },
});

function isPlayerLocked() { return mission.phase === 'briefing' || mission.phase === 'complete' || Boolean(cinematic); }

function updateButtons() {
  ui['motion-toggle'].textContent = paused ? 'Resume' : 'Pause';
  ui['motion-toggle'].setAttribute('aria-pressed', String(paused));
  ui['orbit-toggle'].textContent = autoOrbit ? 'Stop orbit' : 'Orbit';
  ui['orbit-toggle'].setAttribute('aria-pressed', String(autoOrbit));
  input.setEnabled(ready && !paused && !contextLost && !isPlayerLocked());
  controls.enabled = ready && !contextLost && !isPlayerLocked();
  ui.wave.disabled = !ready || paused || !actions.Wave || isPlayerLocked() || mission.phase === 'charging';
  ui['motion-toggle'].disabled = !ready;
  ui['reset-camera'].disabled = !ready;
  ui['orbit-toggle'].disabled = !ready;
}

function homeCamera() {
  const portrait = innerWidth / innerHeight < 0.85;
  controls.autoRotate = false;
  controls.enableDamping = false;
  controls.update(0);
  controls.target.set(avatar.position.x, 1.65, avatar.position.z);
  camera.position.set(avatar.position.x + 0.15, portrait ? 2.7 : 2.5, avatar.position.z + (portrait ? 6.3 : 5.8));
  controls.update(0);
  controls.enableDamping = true;
}

function cardFraming() {
  const stacked = innerWidth <= 760 && innerHeight > 560;
  return {
    position: new THREE.Vector3(avatar.position.x + (stacked ? 0.2 : 1.5), 2.65, avatar.position.z + (stacked ? 5.7 : 5.9)),
    target: new THREE.Vector3(avatar.position.x + (stacked ? 0 : 1.4), stacked ? 0.35 : 1.3, avatar.position.z),
  };
}

function showCardCamera() {
  const frame = cardFraming();
  controls.enableDamping = false;
  controls.update(0);
  camera.position.copy(frame.position);
  controls.target.copy(frame.target);
  controls.update(0);
  controls.enableDamping = true;
}

function finishIntro() {
  if (!cinematic) return;
  cinematic = null;
  homeCamera();
  updateButtons();
  missionView.announce('Mission started. Find beacon 01 at the left console.');
  ui.scene.focus({ preventScroll: true });
}

function launchMission(demo = false) {
  if (!ready || contextLost) return;
  mission = startMission();
  guided = demo;
  cinematic = null;
  paused = false;
  celebrationRemaining = 0;
  resetScene();
  sound.play('start');
  if (!reducedMotion) {
    cinematic = { elapsed: 0, endPosition: camera.position.clone(), endTarget: controls.target.clone() };
    camera.position.set(3.5, 3.45, 7.5);
    controls.target.set(0, 1.4, -0.15);
    cinematic.startPosition = camera.position.clone();
    cinematic.startTarget = controls.target.clone();
  } else missionView.announce('Mission started. Find beacon 01 at the left console.');
  updateButtons();
  ui.scene.focus({ preventScroll: true });
}

function exploreFreely() {
  if (!ready || contextLost) return;
  cinematic = null;
  celebrationRemaining = 0;
  mission = freeExplore();
  guided = false;
  paused = false;
  resetScene();
  missionView.announce('Free exploration. Use the joystick or WASD to move Robin.');
  ui.scene.focus({ preventScroll: true });
}

function wave() {
  if (!ready || paused || !actions.Wave) return;
  guided = false;
  input.reset();
  locomotion.vx = locomotion.vz = locomotion.speed = 0;
  waving = true;
  actions.Wave.reset().setEffectiveWeight(1).play();
}

function interact() {
  if (!ready || paused || contextLost || cinematic) return;
  const next = activateStation(mission, locomotion);
  if (next === mission) return;
  mission = next;
  input.reset();
  locomotion.vx = locomotion.vz = locomotion.speed = 0;
  waving = false;
  sound.play('start');
  updateButtons();
}

function resetScene() {
  if (!layout) return;
  input.reset();
  locomotion = { ...layout.spawn, vx: 0, vz: 0, speed: 0 };
  avatar.position.set(locomotion.x, 0, locomotion.z);
  avatar.rotation.set(0, 0, 0);
  waving = false;
  autoOrbit = false;
  actions.Wave?.stop();
  walkWeight = 0;
  waveWeight = 0;
  homeCamera();
  if (mission.phase === 'briefing') showCardCamera();
  updateButtons();
  setStatus(paused ? 'Paused' : 'Ready to explore');
}

function resize() {
  const width = Math.max(innerWidth, 1);
  const height = Math.max(innerHeight, 1);
  const pixelRatio = Math.min(devicePixelRatio, compact.matches || saveData ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.fov = width / height < 0.85 ? 52 : 50;
  camera.updateProjectionMatrix();
  usePostProcessing = !compact.matches && !saveData;
  if (ready && (mission.phase === 'briefing' || mission.phase === 'complete')) showCardCamera();
}

function buildLights() {
  roomLights.ambient = new THREE.HemisphereLight(0xcde8ff, 0x46505b, 0.72);
  scene.add(roomLights.ambient);
  const key = new THREE.DirectionalLight(0xfff2df, 3.1);
  key.position.set(3.5, 5.2, 4);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(compact.matches ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.2, far: 22 });
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.00015;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb6dbff, 1.05);
  fill.position.set(-4, 4, -3);
  scene.add(fill);
  roomLights.fill = fill;
  const consoleGlow = new THREE.PointLight(0x59baff, 18, 9, 2);
  consoleGlow.position.set(0, 2.3, -2.8);
  scene.add(consoleGlow);
  roomLights.console = consoleGlow;
}

function prepareCharacter(gltf) {
  model = gltf.scene;
  // The source's face points toward -Z. Keep the approved front as the opening pose.
  model.rotation.y = Math.PI;
  model.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(model);
  const size = original.getSize(new THREE.Vector3());
  if (original.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid character bounds');
  model.scale.multiplyScalar(2.18 / size.y);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y + 0.012, -center.z);
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // Pose-aware bounds avoid arms being culled during a wave.
    if (node.isSkinnedMesh) node.frustumCulled = false;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.envMapIntensity = 0.65;
      if (material.map) material.map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    }
  });
  avatar.add(model);
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const name = ['Idle', 'Walk', 'Wave'].find((key) => clip.name.toLowerCase() === key.toLowerCase());
      if (name) actions[name] = mixer.clipAction(clip);
    }
    for (const name of ['Idle', 'Walk']) actions[name]?.setEffectiveWeight(name === 'Idle' ? 1 : 0).play();
    if (actions.Wave) {
      actions.Wave.setLoop(THREE.LoopOnce, 1);
      actions.Wave.clampWhenFinished = true;
    }
    mixer.addEventListener('finished', ({ action }) => { if (action === actions.Wave) waving = false; });
  }
}

async function loadScene() {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    const percent = Math.round(loaded / total * 100);
    ui['loading-bar'].style.width = `${percent}%`;
    ui['loading-percent'].textContent = `${percent}%`;
    document.querySelector('.loading__track').setAttribute('aria-valuenow', String(percent));
  };
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(new DRACOLoader(manager).setDecoderPath(asset('decoders/draco/')));
  loader.setKTX2Loader(new KTX2Loader(manager).setTranscoderPath(asset('decoders/basis/')).detectSupport(renderer));
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [character, room, roomLayout] = await Promise.all([
    loader.loadAsync(asset('assets/robin.glb')),
    loader.loadAsync(asset('assets/command-room.glb')),
    fetch(asset('assets/room-layout.json')).then((response) => {
      if (!response.ok) throw new Error('Room layout unavailable');
      return response.json();
    }),
  ]);
  layout = roomLayout;
  if (!layout.walkBounds || !Array.isArray(layout.colliders) || !layout.spawn ||
      !Number.isFinite(layout.spawn.x) || !Number.isFinite(layout.spawn.z) ||
      isBlocked(layout.spawn.x, layout.spawn.z, PLAYER_RADIUS, layout.walkBounds, layout.colliders)) {
    throw new Error('Room spawn is not safe');
  }
  room.scene.traverse((node) => {
    if (!node.isMesh) return;
    node.receiveShadow = true;
    node.castShadow = true;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.envMapIntensity = 0.3;
      if (material.emissive?.getHex() && !roomEmissions.some((entry) => entry.material === material)) {
        roomEmissions.push({ material, intensity: material.emissiveIntensity });
      }
    }
  });
  scene.add(room.scene);
  prepareCharacter(character);
  effects = createMissionEffects(scene, STATIONS);
  ready = true;
  resetScene();
  ui.loading.hidden = true;
  ui.experience.classList.add('is-ready');
  // Only reflections use the panorama. All visible architecture is real geometry.
  new THREE.TextureLoader().load(asset('assets/command-room-pano.jpg'), (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  }, undefined, () => {});
}

function updateAnimation(dt) {
  const requestedWalk = clamp(locomotion.speed / 1.2, 0, 1);
  const response = 1 - Math.exp(-dt * 9);
  walkWeight += ((waving ? 0 : requestedWalk) - walkWeight) * response;
  waveWeight += ((waving ? 1 : 0) - waveWeight) * response;
  actions.Idle?.setEffectiveWeight(Math.max(0, 1 - walkWeight - waveWeight));
  actions.Walk?.setEffectiveWeight(walkWeight).setEffectiveTimeScale(clamp(locomotion.speed / 1.3, 0.35, 1.5));
  actions.Wave?.setEffectiveWeight(waveWeight);
  if (mixer) {
    // Honor reduced-motion preference while still animating intentional movement.
    const advance = !reducedMotion || requestedWalk > 0.01 || waving || waveWeight > 0.01;
    mixer.update(advance ? dt : 0);
  }
}

function updateMission(dt) {
  const previous = mission;
  mission = tickMission(mission, { dt, position: locomotion, paused: paused || Boolean(cinematic) });
  if (mission.completed.length > previous.completed.length) {
    sound.play(mission.phase === 'complete' ? 'complete' : 'station');
    missionView.announce(mission.phase === 'complete' ? 'All systems online. Mission complete!' : `${STATIONS[previous.step].name} restored. ${STATIONS[mission.step].hint}.`);
    if (mission.phase === 'complete') {
      celebrationRemaining = reducedMotion ? 0 : 4.2;
      guided = false;
      avatar.rotation.y = 0;
      autoOrbit = false;
      wave();
      if (reducedMotion) showCardCamera();
    }
    updateButtons();
  } else if (previous.phase !== mission.phase) updateButtons();
  if (mission.phase === 'complete' && celebrationRemaining > 0) {
    celebrationRemaining = Math.max(0, celebrationRemaining - dt);
    const frame = cardFraming();
    const response = 1 - Math.exp(-dt * 1.4);
    camera.position.lerp(frame.position, response);
    controls.target.lerp(frame.target, response);
  }
  const brightness = mission.phase === 'free' ? 1 : mission.completed.length / STATIONS.length;
  illumination += (brightness - illumination) * (1 - Math.exp(-dt * 1.8));
  roomLights.ambient.intensity = 0.72 + illumination * 0.53;
  roomLights.fill.intensity = 0.7 + illumination * 0.35;
  roomLights.console.intensity = 6 + illumination * 17;
  for (const entry of roomEmissions) entry.material.emissiveIntensity = entry.intensity * (0.28 + illumination * 0.72);
  effectsTime += dt;
}

function render(time) {
  const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  if (ready && !paused && !isPlayerLocked()) {
    cameraForward.subVectors(controls.target, camera.position);
    const desired = guided ? getDemoInput(mission, locomotion) : cameraRelativeInput(input.sample(), cameraForward);
    if (guided && mission.phase === 'active' && distanceToTarget(mission, locomotion) < 0.68) interact();
    locomotion = stepLocomotion(locomotion, desired, dt, layout);
    avatar.position.x = locomotion.x;
    avatar.position.z = locomotion.z;
    if (Math.hypot(desired.x, desired.z) > 0.015) {
      const heading = Math.atan2(desired.x, desired.z);
      const difference = Math.atan2(Math.sin(heading - avatar.rotation.y), Math.cos(heading - avatar.rotation.y));
      avatar.rotation.y += difference * (1 - Math.exp(-dt * 12));
    }
    desiredTarget.set(avatar.position.x, 1.65, avatar.position.z);
    followDelta.subVectors(desiredTarget, controls.target).multiplyScalar(1 - Math.exp(-dt * 7));
    controls.target.add(followDelta);
    camera.position.add(followDelta);
  }
  if (ready) {
    if (!paused) {
      if (cinematic) {
        cinematic.elapsed += dt;
        const p = Math.min(1, cinematic.elapsed / 4.5);
        const ease = p * p * (3 - 2 * p);
        camera.position.lerpVectors(cinematic.startPosition, cinematic.endPosition, ease);
        controls.target.lerpVectors(cinematic.startTarget, cinematic.endTarget, ease);
        if (p >= 1) finishIntro();
      }
      updateAnimation(dt);
      updateMission(dt);
    }
    effects.update({ dt: paused ? 0 : dt, time: effectsTime, activeIndex: mission.step,
      completedCount: mission.completed.length, charge: mission.charge / CHARGE_DURATION,
      phase: mission.phase, reducedMotion, playerPosition: locomotion });
    const target = getMissionTarget(mission);
    if (target) projectedTarget.set(target.position.x, 0.7, target.position.z).project(camera);
    missionView.update({ state: mission, position: locomotion, ready, paused, guided, bearing: projectedTarget.x,
      cinematic: Boolean(cinematic), celebrating: celebrationRemaining > 0 });
    setStatus(paused ? 'Paused' : cinematic ? 'Incoming signal' : mission.phase === 'briefing' ? 'Awaiting a hero' :
      mission.phase === 'complete' ? 'Systems online' : mission.phase === 'charging' ? 'Connecting…' :
      waving ? 'Hello!' : locomotion.speed > 0.1 ? 'Exploring' : 'Ready');
  }
  controls.autoRotate = ready && autoOrbit && !paused && !isPlayerLocked();
  if (controls.autoRotate) orbitTime += dt;
  controls.autoRotateSpeed = Math.cos(orbitTime * 0.22) * 0.7;
  controls.dampingFactor = 1 - Math.pow(1 - 0.065, dt * 60);
  controls.update(dt);
  // Keep the camera inside the open-front room instead of clipping through its shell.
  const safeCamera = resolveCameraPosition(camera.position, controls.target, controls.minDistance);
  camera.position.set(safeCamera.x, safeCamera.y, safeCamera.z);
  camera.lookAt(controls.target);
  if (usePostProcessing) composer.render(dt);
  else renderer.render(scene, camera);
}

function refreshLoop() {
  previousTime = null;
  input.reset();
  if (document.hidden || contextLost) sound.stop();
  if (document.hidden || contextLost) locomotion.vx = locomotion.vz = 0;
  renderer.setAnimationLoop(document.hidden || contextLost ? null : render);
}
ui['motion-toggle'].addEventListener('click', () => {
  paused = !paused;
  locomotion.vx = locomotion.vz = locomotion.speed = 0;
  updateButtons();
  if (paused) sound.stop();
  setStatus(paused ? 'Paused' : 'Ready to explore');
});
ui.wave.addEventListener('click', wave);
ui['sound-toggle'].addEventListener('click', async () => {
  ui['sound-toggle'].disabled = true;
  const enabled = await sound.toggle();
  ui['sound-toggle'].textContent = enabled ? 'Sound on' : 'Sound off';
  ui['sound-toggle'].setAttribute('aria-pressed', String(enabled));
  ui['sound-toggle'].disabled = false;
});
window.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (event.code === 'KeyE') { event.preventDefault(); interact(); }
  if (event.code === 'Escape' && cinematic) finishIntro();
});
ui['orbit-toggle'].addEventListener('click', () => { autoOrbit = !autoOrbit; updateButtons(); });
ui['reset-camera'].addEventListener('click', () => { guided = false; resetScene(); });
ui.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { setStatus('Full screen unavailable'); }
});
const updateFullscreen = () => {
  ui.fullscreen.hidden = !(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  ui.fullscreen.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
};
document.addEventListener('fullscreenchange', updateFullscreen);
document.addEventListener('visibilitychange', refreshLoop);
window.addEventListener('blur', () => { locomotion.vx = locomotion.vz = 0; });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  resize();
  if (!ready) return;
  if (cinematic) finishIntro();
  else if (mission.phase === 'briefing' || mission.phase === 'complete') showCardCamera();
  else homeCamera();
});
motionPreference.addEventListener('change', (event) => {
  reducedMotion = event.matches;
  if (reducedMotion) { autoOrbit = false; finishIntro(); celebrationRemaining = 0; }
  updateButtons();
});
controls.addEventListener('start', () => { autoOrbit = false; updateButtons(); });
ui.scene.addEventListener('webglcontextlost', (event) => {
  event.preventDefault(); contextLost = true; refreshLoop(); updateButtons(); setStatus('Restoring graphics…');
});
ui.scene.addEventListener('webglcontextrestored', () => {
  contextLost = false; refreshLoop(); updateButtons(); setStatus('Ready to explore');
});
resize();
buildLights();
updateButtons();
updateFullscreen();
refreshLoop();
loadScene().catch((error) => {
  console.error('Scene could not load:', error);
  ui.loading.hidden = true;
  ui.error.hidden = false;
  ui['error-message'].textContent = 'The room or character could not be loaded. Check your connection and try again.';
  setStatus('Scene unavailable');
});
