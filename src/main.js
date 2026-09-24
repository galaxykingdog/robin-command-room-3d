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
import './styles.css';

const asset = (name) => `${import.meta.env.BASE_URL}${name}`;
const get = (id) => document.getElementById(id);
const ui = Object.fromEntries(['scene', 'experience', 'status', 'loading', 'loading-label', 'loading-bar',
  'loading-percent', 'error', 'error-message', 'retry', 'joystick', 'joystick-thumb', 'motion-toggle',
  'orbit-toggle', 'reset-camera', 'fullscreen', 'wave'].map((id) => [id, get(id)]));
const compact = matchMedia('(max-width: 760px), (max-height: 560px)');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = Boolean(navigator.connection?.saveData);
let reducedMotion = motionPreference.matches;
let paused = false;
let ready = false;
let contextLost = false;
let previousTime = null;
let autoOrbit = false;
let idleTime = 0;
let orbitTime = 0;
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

const input = createMovementInput(ui.joystick, ui['joystick-thumb'], () => {
  if (autoOrbit) { autoOrbit = false; updateButtons(); }
  if (waving) { waving = false; actions.Wave?.fadeOut(0.18); }
});

function updateButtons() {
  ui['motion-toggle'].textContent = paused ? 'Resume' : 'Pause';
  ui['motion-toggle'].setAttribute('aria-pressed', String(paused));
  ui['orbit-toggle'].textContent = autoOrbit ? 'Stop orbit' : 'Orbit';
  ui['orbit-toggle'].setAttribute('aria-pressed', String(autoOrbit));
  input.setEnabled(ready && !paused && !contextLost);
  ui.wave.disabled = !ready || paused || !actions.Wave;
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
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xcde8ff, 0x46505b, 1.25));
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
  const consoleGlow = new THREE.PointLight(0x59baff, 18, 9, 2);
  consoleGlow.position.set(0, 2.3, -2.8);
  scene.add(consoleGlow);
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
    }
  });
  scene.add(room.scene);
  prepareCharacter(character);
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
  } else {
    // Only used by the development preview before the rigged asset is integrated.
    idleTime += dt;
    avatar.position.y = !reducedMotion ? Math.sin(idleTime * 1.7) * 0.008 : 0;
  }
}

function render(time) {
  const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  if (ready && !paused) {
    cameraForward.subVectors(controls.target, camera.position);
    const desired = cameraRelativeInput(input.sample(), cameraForward);
    locomotion = stepLocomotion(locomotion, desired, dt, layout);
    avatar.position.x = locomotion.x;
    avatar.position.z = locomotion.z;
    if (Math.hypot(desired.x, desired.z) > 0.015) {
      const heading = Math.atan2(desired.x, desired.z);
      const difference = Math.atan2(Math.sin(heading - avatar.rotation.y), Math.cos(heading - avatar.rotation.y));
      avatar.rotation.y += difference * (1 - Math.exp(-dt * 12));
    }
    updateAnimation(dt);
    desiredTarget.set(avatar.position.x, 1.65, avatar.position.z);
    followDelta.subVectors(desiredTarget, controls.target).multiplyScalar(1 - Math.exp(-dt * 7));
    controls.target.add(followDelta);
    camera.position.add(followDelta);
    setStatus(waving ? 'Hello!' : locomotion.speed > 0.1 ? 'Exploring' : 'Ready to explore');
  }
  controls.autoRotate = ready && autoOrbit && !paused;
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
  if (document.hidden || contextLost) locomotion.vx = locomotion.vz = 0;
  renderer.setAnimationLoop(document.hidden || contextLost ? null : render);
}
ui['motion-toggle'].addEventListener('click', () => {
  paused = !paused;
  locomotion.vx = locomotion.vz = locomotion.speed = 0;
  updateButtons();
  setStatus(paused ? 'Paused' : 'Ready to explore');
});
ui.wave.addEventListener('click', () => {
  if (!ready || paused || !actions.Wave) return;
  input.reset();
  locomotion.vx = locomotion.vz = 0;
  waving = true;
  actions.Wave.reset().setEffectiveWeight(1).play();
});
ui['orbit-toggle'].addEventListener('click', () => { autoOrbit = !autoOrbit; updateButtons(); });
ui['reset-camera'].addEventListener('click', resetScene);
ui.retry.addEventListener('click', () => location.reload());
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
window.addEventListener('orientationchange', () => { resize(); if (ready) homeCamera(); });
motionPreference.addEventListener('change', (event) => { reducedMotion = event.matches; if (reducedMotion) autoOrbit = false; updateButtons(); });
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
