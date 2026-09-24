import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './styles.css';

const publicUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
const MODEL_URL = publicUrl('assets/robin.glb');
const PANORAMA_URL = publicUrl('assets/command-room-pano.jpg');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
const compactLayout = window.matchMedia('(max-width: 760px), (max-height: 560px)');
const saveData = Boolean(navigator.connection?.saveData);

const ui = {
  canvas: document.querySelector('#scene'),
  loading: document.querySelector('#loading'),
  loadingLabel: document.querySelector('#loading-label'),
  loadingBar: document.querySelector('#loading-bar'),
  loadingTrack: document.querySelector('.loading__track'),
  loadingPercent: document.querySelector('#loading-percent'),
  error: document.querySelector('#error'),
  errorMessage: document.querySelector('#error-message'),
  retry: document.querySelector('#retry'),
  status: document.querySelector('#status'),
  clipSelect: document.querySelector('#clip-select'),
  motionToggle: document.querySelector('#motion-toggle'),
  orbitToggle: document.querySelector('#orbit-toggle'),
  resetCamera: document.querySelector('#reset-camera'),
  fullscreen: document.querySelector('#fullscreen'),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05090d);
const camera = new THREE.PerspectiveCamera(31, 1, 0.02, 120);
let renderer;

try {
  renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch (error) {
  ui.loading.hidden = true;
  ui.error.hidden = false;
  ui.retry.hidden = true;
  ui.errorMessage.textContent = 'This presentation needs a browser with WebGL enabled.';
  ui.status.textContent = '3D graphics unavailable';
  throw error;
}

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactLayout.matches || saveData ? 1.5 : 2));

const dracoLoader = new DRACOLoader().setDecoderPath(publicUrl('decoders/draco/'));
const ktx2Loader = new KTX2Loader()
  .setTranscoderPath(publicUrl('decoders/basis/'))
  .detectSupport(renderer);
const gltfLoader = new GLTFLoader()
  .setDRACOLoader(dracoLoader)
  .setKTX2Loader(ktx2Loader)
  .setMeshoptDecoder(MeshoptDecoder);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.55, 0.9);
composer.addPass(bloom);
// Render targets contain linear color. Match the direct-render path by applying
// the renderer's tone mapping and display color conversion after bloom.
composer.addPass(new OutputPass());
let postProcessingEnabled = !compactLayout.matches && !saveData;

const home = {
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
};

const MODEL_PRESENTATION_HEIGHT = 2.18;

function updateHomePose() {
  if (compactLayout.matches) {
    home.position.set(0.12, 1.65, 6.2);
    home.target.set(0, 0.75, 0);
  } else {
    home.position.set(0.18, 1.4, 5.25);
    home.target.set(0, 1.08, 0);
  }
}

updateHomePose();
camera.position.copy(home.position);

const controls = new OrbitControls(camera, ui.canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 7.4;
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.copy(home.target);
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.42;

const characterStage = new THREE.Group();
scene.add(characterStage);

let modelRoot = null;
let mixer = null;
let clips = [];
let activeAction = null;
let motionPlaying = !reducedMotion;
let heroHoldRemaining = 3;
let previousFrameTime = null;
let motionElapsed = 0;
let contextLost = false;
let currentCompactLayout = compactLayout.matches;
let loadStartedAt = performance.now();
let isLoadingModel = false;
let presentationScale = 1;
const normalizedModelSize = new THREE.Vector3(1.8, 2.42, 1);
const pointerTarget = new THREE.Vector2();
const pointerMotion = new THREE.Vector2();

function setStatus(message) {
  ui.status.textContent = message;
}

function setProgress(value, label) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  ui.loadingLabel.textContent = label;
  ui.loadingBar.style.width = `${percent}%`;
  ui.loadingTrack.setAttribute('aria-valuenow', String(percent));
  ui.loadingPercent.textContent = `${percent}%`;
}

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  updateHomePose();
  if (currentCompactLayout !== compactLayout.matches) {
    currentCompactLayout = compactLayout.matches;
    restoreHomeView();
  }
  if (compactLayout.matches) {
    const cameraDistance = home.position.distanceTo(home.target);
    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * cameraDistance;
    const visibleWidth = visibleHeight * (width / height);
    const widthFit = (visibleWidth * 0.86) / Math.max(normalizedModelSize.x, Number.EPSILON);
    presentationScale = THREE.MathUtils.clamp(widthFit, 0.62, 0.96);
  } else {
    presentationScale = 1;
  }
  postProcessingEnabled = !compactLayout.matches && !saveData;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const pixelRatio = Math.min(window.devicePixelRatio, compactLayout.matches || saveData ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  if (!motionPlaying) characterStage.scale.setScalar(presentationScale);
}

function buildLighting() {
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x111822, 1.05));

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(3.6, 5.2, 3.8);
  key.castShadow = true;
  const shadowSize = compactLayout.matches || saveData ? 1024 : 2048;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -1;
  key.shadow.bias = -0.00012;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x77c9ff, 2.1);
  rim.position.set(-4.5, 3.1, -3.6);
  scene.add(rim);

  const warmFill = new THREE.DirectionalLight(0xffd3a3, 0.8);
  warmFill.position.set(-3, 2.2, 4.4);
  scene.add(warmFill);
}

function buildStage() {
  // A real display plinth grounds the character independently of the panorama.
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.53, 1.57, 0.1, 128),
    new THREE.MeshStandardMaterial({ color: 0x101c27, metalness: 0.65, roughness: 0.4 }),
  );
  plinth.position.y = -0.055;
  plinth.receiveShadow = true;
  scene.add(plinth);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.51, 96),
    new THREE.ShadowMaterial({ color: 0x02070c, opacity: 0.48 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.receiveShadow = true;
  scene.add(shadow);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.52, 0.012, 10, 160),
    new THREE.MeshBasicMaterial({ color: 0x8dd9ff, transparent: true, opacity: 0.5 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.014;
  scene.add(ring);
}

async function loadPanorama() {
  const texture = await new THREE.TextureLoader().loadAsync(PANORAMA_URL);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene.background = texture;
  scene.environment = texture;
}

function disposeModel() {
  if (!modelRoot) return;
  if (mixer) {
    mixer.stopAllAction();
    mixer.uncacheRoot(modelRoot);
  }
  characterStage.remove(modelRoot);
  const textures = new Set();
  modelRoot.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
      material.dispose();
    });
  });
  textures.forEach((texture) => texture.dispose());
  modelRoot = null;
  mixer = null;
  clips = [];
  activeAction = null;
}

function normalizeModel(root) {
  if (!root?.isObject3D) throw new Error('The GLB does not contain a valid scene.');
  // Rodin's exported forward axis faces away from Three.js' presentation camera.
  // Turn the asset once at import so the approved face is the default view.
  root.rotateY(Math.PI);
  root.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(root);
  if (initialBounds.isEmpty()) throw new Error('The GLB does not contain visible geometry.');

  const size = initialBounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(Number.isFinite) || size.y <= Number.EPSILON) {
    throw new Error('The GLB has invalid model dimensions.');
  }
  const scale = MODEL_PRESENTATION_HEIGHT / size.y;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -bounds.min.y, -center.z);
  root.updateMatrixWorld(true);
  new THREE.Box3().setFromObject(root).getSize(normalizedModelSize);

  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      if ('envMapIntensity' in material) material.envMapIntensity = 0.85;
      Object.values(material).forEach((value) => {
        if (!value?.isTexture) return;
        value.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      });
      material.needsUpdate = true;
    });
  });
}

function playClip(index, fade = true) {
  if (!mixer || !clips[index]) return;
  const next = mixer.clipAction(clips[index]);
  if (activeAction && activeAction !== next) {
    if (fade) activeAction.fadeOut(0.28);
    else activeAction.stop();
  }
  next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade ? 0.28 : 0).play();
  activeAction = next;
  mixer.timeScale = motionPlaying ? 1 : 0;
  setStatus(`${clips[index].name || 'Animation'} active`);
}

function configureClips(animations, root) {
  clips = (animations ?? []).filter(
    (clip) => clip && Number.isFinite(clip.duration) && clip.duration > 0,
  );
  ui.clipSelect.replaceChildren();
  const clipControl = ui.clipSelect.closest('.clip-control');

  if (clips.length === 0) {
    ui.clipSelect.add(new Option('Idle', 'procedural'));
    ui.clipSelect.disabled = true;
    if (clipControl) clipControl.hidden = true;
    ui.motionToggle.disabled = false;
    setStatus(motionPlaying ? 'Robin ready' : 'Robin ready · motion paused');
    return;
  }

  if (clipControl) clipControl.hidden = false;
  mixer = new THREE.AnimationMixer(root);
  clips.forEach((clip, index) => ui.clipSelect.add(new Option(clip.name || `Motion ${index + 1}`, String(index))));
  const preferred = Math.max(0, clips.findIndex((clip) => /idle|stand|breath/i.test(clip.name)));
  ui.clipSelect.value = String(preferred);
  ui.clipSelect.disabled = false;
  ui.motionToggle.disabled = false;
  playClip(preferred, false);
}

async function loadRobin() {
  if (isLoadingModel) return;
  isLoadingModel = true;
  ui.retry.disabled = true;
  ui.motionToggle.disabled = true;
  disposeModel();
  ui.error.hidden = true;
  ui.loading.hidden = false;
  loadStartedAt = performance.now();
  setProgress(28, 'Loading Robin');
  setStatus('Loading Robin…');

  try {
    const gltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        MODEL_URL,
        resolve,
        (event) => {
          const value = event.lengthComputable && event.total > 0 ? 30 + (event.loaded / event.total) * 66 : 46;
          setProgress(value, 'Loading Robin');
        },
        reject,
      );
    });

    normalizeModel(gltf.scene);
    modelRoot = gltf.scene;
    characterStage.add(modelRoot);
    resize();
    // Loading can take several seconds while OrbitControls keeps ticking.
    // Restore the authored hero angle once the model is ready so every visit
    // opens on Robin's approved face before the slow orbit continues.
    restoreHomeView();
    configureClips(gltf.animations, modelRoot);
    setProgress(100, 'Robin ready');
    const elapsed = performance.now() - loadStartedAt;
    window.setTimeout(() => {
      ui.loading.hidden = true;
      document.querySelector('#experience').classList.add('is-ready');
    }, Math.max(180, 720 - elapsed));
  } finally {
    isLoadingModel = false;
    ui.retry.disabled = false;
  }
}

function showError(error) {
  console.error(error);
  ui.loading.hidden = true;
  ui.error.hidden = false;
  ui.motionToggle.disabled = true;
  const detail = String(error?.message ?? error);
  ui.errorMessage.textContent = /404|fetch|network|load failed/i.test(detail)
    ? 'The 3D model could not be downloaded. Check your connection and try again.'
    : 'The 3D model could not be opened. Please try again.';
  setStatus('Model unavailable');
}

function updateButtons() {
  ui.motionToggle.textContent = motionPlaying ? 'Pause motion' : 'Play motion';
  ui.motionToggle.setAttribute('aria-pressed', String(motionPlaying));
  ui.orbitToggle.textContent = controls.autoRotate ? 'Pause orbit' : 'Auto orbit';
  ui.orbitToggle.setAttribute('aria-pressed', String(controls.autoRotate));
}

function updateFullscreenButton() {
  const available = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  ui.fullscreen.hidden = !available;
  ui.fullscreen.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
}

function resetCharacterPose() {
  pointerTarget.set(0, 0);
  pointerMotion.set(0, 0);
  characterStage.position.set(0, 0, 0);
  characterStage.rotation.set(0, 0, 0);
  characterStage.scale.setScalar(presentationScale);
}

function restoreHomeView() {
  // Flush any remaining drag damping before restoring the exact front view.
  const autoRotate = controls.autoRotate;
  controls.autoRotate = false;
  controls.enableDamping = false;
  controls.update(0);
  camera.position.copy(home.position);
  controls.target.copy(home.target);
  controls.update(0);
  controls.enableDamping = true;
  controls.autoRotate = autoRotate;
  heroHoldRemaining = 3;
}

function updateRenderLoop() {
  // Reset only the frame timestamp, preserving animation phase across a pause.
  previousFrameTime = null;
  renderer.setAnimationLoop(document.hidden || contextLost ? null : render);
}

function bindControls() {
  ui.canvas.addEventListener('pointermove', (event) => {
    if (reducedMotion || !motionPlaying || event.pointerType === 'touch') return;
    const bounds = ui.canvas.getBoundingClientRect();
    pointerTarget.set(
      THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1),
    );
  });

  ui.canvas.addEventListener('pointerleave', () => pointerTarget.set(0, 0));

  ui.motionToggle.addEventListener('click', () => {
    motionPlaying = !motionPlaying;
    if (mixer) mixer.timeScale = motionPlaying ? 1 : 0;
    if (!motionPlaying) resetCharacterPose();
    updateButtons();
    setStatus(motionPlaying ? 'Motion resumed' : 'Motion paused');
  });

  ui.orbitToggle.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    heroHoldRemaining = 0;
    updateButtons();
    setStatus(controls.autoRotate ? 'Automatic orbit active' : 'Automatic orbit paused');
  });

  ui.resetCamera.addEventListener('click', () => {
    updateHomePose();
    restoreHomeView();
    setStatus('Presentation view restored');
  });

  ui.fullscreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.warn('Full screen is unavailable.', error);
      setStatus('Full screen unavailable');
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('visibilitychange', updateRenderLoop);
  motionPreference.addEventListener('change', (event) => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      motionPlaying = false;
      controls.autoRotate = false;
      if (mixer) mixer.timeScale = 0;
      resetCharacterPose();
      setStatus('Motion paused');
    }
    updateButtons();
  });

  ui.clipSelect.addEventListener('change', () => {
    const index = Number.parseInt(ui.clipSelect.value, 10);
    if (Number.isInteger(index)) playClip(index);
  });

  ui.retry.addEventListener('click', () => loadRobin().catch(showError));
  ui.canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    updateRenderLoop();
    setStatus('Graphics paused · restoring…');
  });
  ui.canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    updateRenderLoop();
    setStatus(modelRoot ? 'Robin ready' : 'Graphics restored');
  });
  controls.addEventListener('start', () => {
    if (!controls.autoRotate) return;
    controls.autoRotate = false;
    updateButtons();
    setStatus('Manual camera control');
  });
}

function render(timestamp) {
  const delta = previousFrameTime === null ? 0 : Math.min((timestamp - previousFrameTime) / 1000, 0.05);
  previousFrameTime = timestamp;

  if (mixer && motionPlaying) mixer.update(delta);

  if (modelRoot && motionPlaying) {
    motionElapsed += delta;
    const elapsed = motionElapsed;
    pointerMotion.lerp(pointerTarget, 1 - Math.exp(-delta * 4.5));
    const breath = Math.sin(elapsed * 1.7);
    characterStage.position.y = 0.009 + breath * 0.009;
    characterStage.rotation.x = pointerMotion.y * 0.012;
    characterStage.rotation.y = Math.sin(elapsed * 0.48) * 0.018 + pointerMotion.x * 0.045;
    characterStage.rotation.z = Math.sin(elapsed * 0.72) * 0.005 - pointerMotion.x * 0.006;
    characterStage.scale.set(
      presentationScale * (1 - breath * 0.0015),
      presentationScale * (1 + breath * 0.004),
      presentationScale * (1 - breath * 0.0015),
    );
  }

  if (modelRoot) heroHoldRemaining = Math.max(0, heroHoldRemaining - delta);
  const autoRotate = controls.autoRotate;
  if (!modelRoot || heroHoldRemaining > 0) controls.autoRotate = false;
  controls.dampingFactor = 1 - Math.pow(1 - 0.055, delta * 60);
  controls.update(delta);
  controls.autoRotate = autoRotate;
  if (postProcessingEnabled) composer.render(delta);
  else renderer.render(scene, camera);
}

async function start() {
  resize();
  buildLighting();
  buildStage();
  bindControls();
  updateButtons();
  updateFullscreenButton();
  updateRenderLoop();
  window.addEventListener('resize', resize);

  const panoramaTask = loadPanorama().catch((error) => {
    console.warn('The command-room panorama could not be loaded; using the scene fallback.', error);
  });

  try {
    await Promise.all([panoramaTask, loadRobin()]);
  } catch (error) {
    showError(error);
  }
}

start();
