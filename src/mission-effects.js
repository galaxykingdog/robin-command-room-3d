import * as THREE from 'three';

const TAU = Math.PI * 2;
const COMPLETE_COLOR = 0x71f2c4;
const QUIET_COLOR = 0x7b9cb3;
const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// Stroked numerals keep the in-world signage crisp without a texture or font request.
const DIGITS = {
  1: [[-0.03, 0.044, 0, 0.07], [0, 0.07, 0, -0.07], [-0.035, -0.07, 0.035, -0.07]],
  2: [[-0.04, 0.05, -0.02, 0.07], [-0.02, 0.07, 0.025, 0.07], [0.025, 0.07, 0.04, 0.05],
    [0.04, 0.05, 0.04, 0.015], [0.04, 0.015, -0.04, -0.05], [-0.04, -0.05, -0.04, -0.07],
    [-0.04, -0.07, 0.045, -0.07]],
  3: [[-0.04, 0.07, 0.03, 0.07], [0.03, 0.07, 0.045, 0.05], [0.045, 0.05, 0.045, 0.025],
    [0.045, 0.025, 0.01, 0], [0.01, 0, -0.02, 0], [0.01, 0, 0.045, -0.025],
    [0.045, -0.025, 0.045, -0.05], [0.045, -0.05, 0.03, -0.07], [0.03, -0.07, -0.04, -0.07]],
};

function lineGeometry(segments) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return geometry;
}

function makeGlobeLines() {
  const segments = [];
  const point = (latitude, longitude) => [
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.cos(longitude),
  ];
  for (let meridian = 0; meridian < 8; meridian += 1) {
    const longitude = meridian * TAU / 8;
    for (let step = 0; step < 36; step += 1) {
      segments.push(...point(-Math.PI / 2 + step * Math.PI / 36, longitude),
        ...point(-Math.PI / 2 + (step + 1) * Math.PI / 36, longitude));
    }
  }
  for (let band = 1; band < 6; band += 1) {
    const latitude = -Math.PI / 2 + band * Math.PI / 6;
    for (let step = 0; step < 64; step += 1) {
      segments.push(...point(latitude, step * TAU / 64), ...point(latitude, (step + 1) * TAU / 64));
    }
  }
  return lineGeometry(segments);
}

function makeGlobePoints() {
  // A deterministic Fibonacci distribution; no random frame-to-frame sparkle.
  const positions = [];
  for (let index = 0; index < 72; index += 1) {
    const y = 1 - (index + 0.5) / 36;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    positions.push(radius * Math.cos(angle), y, radius * Math.sin(angle));
  }
  return lineGeometry(positions);
}

/** Geometry-only mission signage. Does not own a render loop, camera, or lights. */
export function createMissionEffects(scene, stations) {
  const root = new THREE.Group();
  root.name = 'SignalLostEffects';
  scene.add(root);
  const geometries = new Set();
  const materials = new Set();
  const ownGeometry = (geometry) => { geometries.add(geometry); return geometry; };
  const ownMaterial = (material) => { materials.add(material); return material; };
  const meshMaterial = (color, opacity = 1) => ownMaterial(new THREE.MeshBasicMaterial({
    color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    toneMapped: false,
  }));
  const lineMaterial = (color, opacity = 1) => ownMaterial(new THREE.LineBasicMaterial({
    color, opacity, transparent: true, depthWrite: false, toneMapped: false,
  }));
  const ringGeometry = ownGeometry(new THREE.RingGeometry(0.56, 0.59, 80));
  const haloGeometry = ownGeometry(new THREE.RingGeometry(0.60, 0.69, 80));
  const badgeShape = new THREE.Shape();
  badgeShape.moveTo(-0.12, -0.15);
  badgeShape.lineTo(0.08, -0.15);
  badgeShape.lineTo(0.15, -0.08);
  badgeShape.lineTo(0.15, 0.15);
  badgeShape.lineTo(-0.08, 0.15);
  badgeShape.lineTo(-0.15, 0.08);
  badgeShape.closePath();
  const badgeGeometry = ownGeometry(new THREE.ShapeGeometry(badgeShape));
  const badgeOutline = ownGeometry(lineGeometry([
    -0.12, -0.15, 0, 0.08, -0.15, 0, 0.08, -0.15, 0, 0.15, -0.08, 0,
    0.15, -0.08, 0, 0.15, 0.15, 0, 0.15, 0.15, 0, -0.08, 0.15, 0,
    -0.08, 0.15, 0, -0.15, 0.08, 0, -0.15, 0.08, 0, -0.15, -0.12, 0,
    -0.15, -0.12, 0, -0.12, -0.15, 0,
  ]));
  const markers = stations.map((station, index) => {
    const marker = new THREE.Group();
    marker.name = `SignalStation_${station.id ?? index}`;
    marker.position.set(station.position.x, 0, station.position.z);
    root.add(marker);
    const color = new THREE.Color(station.color ?? 0x7adeff);
    const ring = new THREE.Mesh(ringGeometry, meshMaterial(color, 0.75));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.024;
    marker.add(ring);
    const halo = new THREE.Mesh(haloGeometry, meshMaterial(color, 0.09));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.021;
    marker.add(halo);
    const badge = new THREE.Group();
    badge.position.y = 1.05;
    marker.add(badge);
    const face = new THREE.Mesh(badgeGeometry, meshMaterial(0x0b2332, 0.7));
    const outline = new THREE.LineSegments(badgeOutline, lineMaterial(color, 0.8));
    outline.position.z = 0.001;
    const strokes = DIGITS[index + 1] ?? [[-0.035, 0, 0.035, 0], [0, -0.035, 0, 0.035]];
    const numeral = new THREE.LineSegments(ownGeometry(lineGeometry(strokes.flatMap(([x1, y1, x2, y2]) =>
      [x1, y1, 0.003, x2, y2, 0.003]))), lineMaterial(0xe9fbff));
    badge.add(face, outline, numeral);
    return { marker, color, ring, halo, badge, face, outline, numeral };
  });

  // One shared focus indicator follows the active landing pad.
  const focus = new THREE.Group();
  focus.name = 'ActiveSignalFocus';
  root.add(focus);
  const focusLine = new THREE.LineSegments(ownGeometry(lineGeometry([
    0, 0.055, 0, 0, 0.82, 0,
    -0.065, 0.07, 0, 0.065, 0.07, 0,
  ])), lineMaterial(0x83e8ff, 0.48));
  const chargeGeometry = ownGeometry(new THREE.RingGeometry(0.63, 0.669, 96, 1, Math.PI / 2));
  const chargeArc = new THREE.Mesh(chargeGeometry, meshMaterial(0xe0fff5, 0.95));
  chargeArc.rotation.x = -Math.PI / 2;
  chargeArc.position.y = 0.031;
  focus.add(focusLine, chargeArc);

  const hologram = new THREE.Group();
  hologram.name = 'RestoredSignalGlobe';
  hologram.position.set(0, 2.5, -2.65);
  hologram.visible = false;
  root.add(hologram);
  const globe = new THREE.Group();
  globe.scale.setScalar(0.62);
  globe.rotation.z = 0.17;
  hologram.add(globe);
  const globeWire = new THREE.LineSegments(ownGeometry(makeGlobeLines()), lineMaterial(0x56d5ef, 0.48));
  const pointMaterial = ownMaterial(new THREE.PointsMaterial({
    color: 0xb4ffdd, size: 0.026, sizeAttenuation: true,
    transparent: true, opacity: 0.76, depthWrite: false, toneMapped: false,
  }));
  const globePoints = new THREE.Points(ownGeometry(makeGlobePoints()), pointMaterial);
  globe.add(globeWire, globePoints);
  const orbitGeometry = ownGeometry(new THREE.RingGeometry(0.795, 0.805, 96));
  const orbitA = new THREE.Mesh(orbitGeometry, meshMaterial(0x6ff8c7, 0.62));
  const orbitB = new THREE.Mesh(orbitGeometry, meshMaterial(0x77cfff, 0.32));
  orbitA.rotation.set(Math.PI / 2, 0.18, 0.35);
  orbitB.rotation.set(0.65, 0.75, 0);
  orbitB.scale.setScalar(1.11);
  hologram.add(orbitA, orbitB);
  const projectionGeometry = ownGeometry(new THREE.RingGeometry(0.31, 0.325, 64));
  const projection = new THREE.Mesh(projectionGeometry, meshMaterial(0x7df9d6, 0.42));
  projection.rotation.x = -Math.PI / 2;
  projection.position.y = -0.86;
  hologram.add(projection);
  let reveal = 0;
  let disposed = false;

  const update = ({ dt = 0, time = 0, activeIndex = -1, completedCount = 0,
    charge = 0, phase = 'briefing', reducedMotion = false, playerPosition } = {}) => {
    if (disposed) return;
    const elapsed = Number.isFinite(time) ? time : 0;
    const delta = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
    const completed = Math.min(markers.length, Math.max(0, Math.floor(completedCount) || 0));
    const hasActive = (phase === 'active' || phase === 'charging') && Number.isInteger(activeIndex)
      && activeIndex >= completed && activeIndex >= 0 && activeIndex < markers.length;
    const showMarkers = phase !== 'free' && phase !== 'complete';
    markers.forEach((item, index) => {
      item.marker.visible = showMarkers;
      const isComplete = index < completed;
      const isActive = hasActive && index === activeIndex;
      const opacity = isComplete ? 0.48 : isActive ? 0.92 : 0.25;
      const signalColor = isComplete ? COMPLETE_COLOR : isActive ? item.color : QUIET_COLOR;
      item.ring.material.color.set(signalColor);
      item.ring.material.opacity = opacity;
      item.halo.material.color.set(signalColor);
      item.halo.material.opacity = isActive ? 0.105 : isComplete ? 0.045 : 0.02;
      const pulse = reducedMotion || !isActive ? 1 : 1 + Math.sin(elapsed * 2.8) * 0.026;
      item.halo.scale.setScalar(pulse);
      item.outline.material.color.set(signalColor);
      let badgeOpacity = isActive ? 0.9 : isComplete ? 0.52 : 0.33;
      if (playerPosition && Number.isFinite(playerPosition.x) && Number.isFinite(playerPosition.z)) {
        const distance = Math.hypot(item.marker.position.x - playerPosition.x, item.marker.position.z - playerPosition.z);
        // The small sign fades as Robin occupies the pad, preserving her silhouette.
        badgeOpacity *= 0.15 + 0.85 * clamp01((distance - 0.3) / 0.65);
      }
      item.outline.material.opacity = badgeOpacity;
      item.numeral.material.opacity = badgeOpacity;
      item.face.material.opacity = badgeOpacity * 0.8;
      item.badge.position.y = 1.05 + (reducedMotion || !isActive ? 0 : Math.sin(elapsed * 2) * 0.025);
    });
    focus.visible = hasActive && showMarkers;
    if (hasActive) {
      const item = markers[activeIndex];
      focus.position.copy(item.marker.position);
      focusLine.material.color.copy(item.color);
      focusLine.material.opacity = phase === 'charging' ? 0.12 : 0.42;
      const fraction = clamp01(charge);
      chargeArc.visible = fraction > 0;
      chargeGeometry.setDrawRange(0, Math.floor(fraction * 96) * 6);
    }
    const isRestored = phase === 'complete' || (markers.length > 0 && completed === markers.length);
    reveal = reducedMotion ? Number(isRestored)
      : THREE.MathUtils.damp(reveal, Number(isRestored), 3.8, delta);
    hologram.visible = reveal > 0.002;
    hologram.scale.setScalar(Math.max(0.001, reducedMotion ? reveal : 0.88 + reveal * 0.12));
    globeWire.material.opacity = 0.48 * reveal;
    pointMaterial.opacity = 0.76 * reveal;
    orbitA.material.opacity = 0.62 * reveal;
    orbitB.material.opacity = 0.32 * reveal;
    projection.material.opacity = 0.42 * reveal;
    globe.rotation.y = reducedMotion ? 0 : elapsed * 0.11;
    orbitA.rotation.z = reducedMotion ? 0.35 : 0.35 + elapsed * 0.07;
    orbitB.rotation.z = reducedMotion ? 0 : -elapsed * 0.035;
    projection.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(elapsed * 1.7) * 0.035);
  };
  update();

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      root.clear();
    },
  };
}
