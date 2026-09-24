import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This checks the released, uncompressed GLB. It is not a general glTF validator
// or a substitute for reviewing the character visually in the browser.
const publicRoot = new URL('../public/', import.meta.url);
const approvedModelSha256 = '8397a2deb1b03f61b05d2521d42d51efd11467d6ab31f59f517d8b97cb00db99';
const requiredFiles = [
  'assets/robin.glb',
  'assets/command-room-pano.jpg',
  'favicon.svg',
  'decoders/draco/draco_decoder.js',
  'decoders/draco/draco_decoder.wasm',
  'decoders/draco/draco_wasm_wrapper.js',
  'decoders/basis/basis_transcoder.js',
  'decoders/basis/basis_transcoder.wasm',
];
const componentSizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const typeWidths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function integer(value, label, minimum = 0) {
  assert(Number.isSafeInteger(value) && value >= minimum, `${label} must be an integer >= ${minimum}`);
}

function reference(array, index, label) {
  integer(index, label);
  assert(Array.isArray(array) && index < array.length, `${label} references a missing entry`);
  return array[index];
}

function noExternalUris(value, label = 'glTF') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'uri') {
      assert(typeof child === 'string' && child.startsWith('data:'), `${label}.uri must be embedded, not remote or file-backed`);
    } else noExternalUris(child, `${label}.${key}`);
  }
}

export function inspectGlb(bytes) {
  assert(bytes.length >= 28, 'GLB is truncated');
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic is invalid');
  assert.equal(bytes.readUInt32LE(4), 2, 'Only GLB version 2 is supported');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB declared length does not match file length');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    assert(offset + 8 <= bytes.length, 'GLB chunk header is truncated');
    const length = bytes.readUInt32LE(offset);
    assert.equal(length % 4, 0, 'GLB chunk must be 4-byte aligned');
    assert(offset + 8 + length <= bytes.length, 'GLB chunk exceeds file boundary');
    chunks.push({ type: bytes.readUInt32LE(offset + 4), bytes: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  assert.equal(chunks.length, 2, 'Release GLB must have exactly JSON and BIN chunks');
  assert.equal(chunks[0].type, 0x4e4f534a, 'First GLB chunk must be JSON');
  assert.equal(chunks[1].type, 0x004e4942, 'Second GLB chunk must be BIN');
  const gltf = JSON.parse(chunks[0].bytes.toString('utf8'));
  const binary = chunks[1].bytes;
  assert.equal(gltf.asset?.version, '2.0', 'glTF asset version must be 2.0');
  noExternalUris(gltf);
  assert.equal(gltf.buffers?.length, 1, 'Release model must use one embedded buffer');
  assert.equal(gltf.buffers[0].uri, undefined, 'GLB buffer must use its BIN chunk');
  integer(gltf.buffers[0].byteLength, 'Buffer byteLength', 1);
  assert(binary.length >= gltf.buffers[0].byteLength && binary.length - gltf.buffers[0].byteLength <= 3, 'BIN size does not match buffer plus allowed padding');
  assert(!(gltf.extensionsRequired?.length), 'Release check requires an uncompressed model without required extensions');

  for (const [index, view] of (gltf.bufferViews ?? []).entries()) {
    assert.equal(view.buffer, 0, `bufferView ${index} must reference the embedded buffer`);
    integer(view.byteOffset ?? 0, `bufferView ${index} offset`);
    integer(view.byteLength, `bufferView ${index} length`, 1);
    assert((view.byteOffset ?? 0) + view.byteLength <= gltf.buffers[0].byteLength, `bufferView ${index} exceeds buffer`);
  }
  for (const [index, accessor] of (gltf.accessors ?? []).entries()) {
    const view = reference(gltf.bufferViews, accessor.bufferView, `accessor ${index} bufferView`);
    assert(!accessor.sparse, `Sparse accessor ${index} is not supported by this release check`);
    const size = componentSizes[accessor.componentType];
    const width = typeWidths[accessor.type];
    assert(size && width, `Accessor ${index} has an unsupported component or type`);
    integer(accessor.count, `accessor ${index} count`, 1);
    integer(accessor.byteOffset ?? 0, `accessor ${index} offset`);
    const stride = view.byteStride ?? size * width;
    integer(stride, `accessor ${index} stride`, size * width);
    assert.equal(stride % size, 0, `Accessor ${index} stride has invalid alignment`);
    assert.equal(((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)) % size, 0, `Accessor ${index} is misaligned`);
    assert((accessor.byteOffset ?? 0) + (accessor.count - 1) * stride + size * width <= view.byteLength, `Accessor ${index} exceeds bufferView`);
  }

  assert(gltf.meshes?.length > 0, 'GLB contains no meshes');
  let primitiveCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  const checkedPositions = new Set();
  for (const [meshIndex, mesh] of gltf.meshes.entries()) {
    assert(mesh.primitives?.length > 0, `Mesh ${meshIndex} has no primitives`);
    for (const primitive of mesh.primitives) {
      primitiveCount++;
      assert.equal(primitive.mode ?? 4, 4, 'Release mesh must contain triangles');
      const positionIndex = primitive.attributes?.POSITION;
      const position = reference(gltf.accessors, positionIndex, 'POSITION accessor');
      assert.equal(position.type, 'VEC3', 'POSITION must be VEC3');
      assert.equal(position.componentType, 5126, 'Release POSITION must be float32');
      for (const [semantic, index] of Object.entries(primitive.attributes)) {
        const attribute = reference(gltf.accessors, index, `${semantic} accessor`);
        assert.equal(attribute.count, position.count, `${semantic} vertex count differs from POSITION`);
      }
      if (primitive.material !== undefined) reference(gltf.materials, primitive.material, 'Primitive material');
      for (const bound of ['min', 'max']) {
        assert(Array.isArray(position[bound]) && position[bound].length === 3 && position[bound].every(Number.isFinite), `POSITION ${bound} must contain three finite values`);
      }
      assert(position.min.every((n, axis) => n <= position.max[axis]), 'POSITION bounds are reversed');
      if (!checkedPositions.has(positionIndex)) {
        checkedPositions.add(positionIndex);
        vertexCount += position.count;
        const view = gltf.bufferViews[position.bufferView];
        const start = (view.byteOffset ?? 0) + (position.byteOffset ?? 0);
        const stride = view.byteStride ?? 12;
        const actualMin = [Infinity, Infinity, Infinity];
        const actualMax = [-Infinity, -Infinity, -Infinity];
        for (let vertex = 0; vertex < position.count; vertex++) {
          for (let axis = 0; axis < 3; axis++) {
            const value = binary.readFloatLE(start + vertex * stride + axis * 4);
            assert(Number.isFinite(value), `POSITION ${positionIndex} contains a non-finite coordinate`);
            actualMin[axis] = Math.min(actualMin[axis], value);
            actualMax[axis] = Math.max(actualMax[axis], value);
          }
        }
        for (let axis = 0; axis < 3; axis++) {
          const tolerance = Math.max(1, Math.abs(actualMin[axis]), Math.abs(actualMax[axis])) * 1e-6;
          assert(Math.abs(actualMin[axis] - position.min[axis]) <= tolerance && Math.abs(actualMax[axis] - position.max[axis]) <= tolerance, `POSITION ${positionIndex} bounds differ from vertex data`);
        }
      }
      if (primitive.indices !== undefined) {
        const indices = reference(gltf.accessors, primitive.indices, 'Indices accessor');
        assert.equal(indices.type, 'SCALAR', 'Indices must be SCALAR');
        assert([5121, 5123, 5125].includes(indices.componentType), 'Indices must be unsigned integers');
        assert.equal(indices.count % 3, 0, 'Triangle index count must be divisible by three');
        const view = gltf.bufferViews[indices.bufferView];
        const size = componentSizes[indices.componentType];
        const start = (view.byteOffset ?? 0) + (indices.byteOffset ?? 0);
        for (let index = 0; index < indices.count; index++) {
          assert(binary.readUIntLE(start + index * (view.byteStride ?? size), size) < position.count, 'Mesh index exceeds POSITION vertex count');
        }
        triangleCount += indices.count / 3;
      } else {
        assert.equal(position.count % 3, 0, 'Unindexed triangle count must be divisible by three');
        triangleCount += position.count / 3;
      }
    }
  }
  for (const [index, image] of (gltf.images ?? []).entries()) {
    assert.equal(image.uri, undefined, `Image ${index} must be embedded in a bufferView`);
    const view = reference(gltf.bufferViews, image.bufferView, `Image ${index} bufferView`);
    const data = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.equal(image.mimeType, 'image/jpeg', `Release image ${index} must be JPEG`);
    assert(data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff, `Image ${index} JPEG signature is invalid`);
  }
  for (const texture of gltf.textures ?? []) {
    reference(gltf.images, texture.source, 'Texture image');
    if (texture.sampler !== undefined) reference(gltf.samplers, texture.sampler, 'Texture sampler');
  }
  function checkMaterialTextures(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith('Texture')) reference(gltf.textures, child.index, `${key} texture`);
      else checkMaterialTextures(child);
    }
  }
  for (const material of gltf.materials ?? []) checkMaterialTextures(material);
  for (const node of gltf.nodes ?? []) {
    if (node.mesh !== undefined) reference(gltf.meshes, node.mesh, 'Node mesh');
    for (const child of node.children ?? []) reference(gltf.nodes, child, 'Node child');
    for (const key of ['matrix', 'translation', 'rotation', 'scale']) {
      if (node[key]) assert(node[key].every(Number.isFinite), `Node ${key} contains non-finite values`);
    }
  }
  const scene = reference(gltf.scenes, gltf.scene ?? 0, 'Default scene');
  assert(scene.nodes?.length, 'Default scene must have nodes');
  for (const node of scene.nodes) reference(gltf.nodes, node, 'Scene node');
  return { meshes: gltf.meshes.length, primitives: primitiveCount, vertices: vertexCount, triangles: triangleCount, embeddedImages: gltf.images?.length ?? 0 };
}

function selfTest(bytes) {
  const brokenMagic = Buffer.from(bytes);
  brokenMagic.writeUInt32LE(0, 0);
  assert.throws(() => inspectGlb(brokenMagic), /magic/);
  assert.throws(() => inspectGlb(bytes.subarray(0, bytes.length - 4)), /length/);
  const brokenChunk = Buffer.from(bytes);
  brokenChunk.writeUInt32LE(bytes.length, 12);
  assert.throws(() => inspectGlb(brokenChunk), /boundary/);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const position = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  const positionOffset = 20 + jsonLength + 8 + (gltf.bufferViews[position.bufferView].byteOffset ?? 0) + (position.byteOffset ?? 0);
  const brokenPosition = Buffer.from(bytes);
  brokenPosition.writeFloatLE(NaN, positionOffset);
  assert.throws(() => inspectGlb(brokenPosition), /non-finite/);
  assert.throws(() => noExternalUris({ images: [{ uri: 'https://example.invalid/texture.jpg' }] }), /embedded/);
  console.log('Validator self-tests passed (bad magic, truncation, oversized chunk, NaN position, external URI).');
}

async function main() {
  const assets = new Map();
  for (const path of requiredFiles) {
    const bytes = await readFile(new URL(path, publicRoot));
    assert(bytes.length > 0, `Required asset is empty: ${path}`);
    if (path.endsWith('.wasm')) assert.equal(bytes.readUInt32LE(0), 0x6d736100, `Invalid WASM header: ${path}`);
    if (path.endsWith('.jpg')) assert(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, `Invalid JPEG signature: ${path}`);
    assets.set(path, bytes);
  }
  const model = assets.get('assets/robin.glb');
  const summary = inspectGlb(model);
  const sha256 = createHash('sha256').update(model).digest('hex');
  assert.equal(sha256, approvedModelSha256, 'Robin differs from the approved release asset; review it visually before deliberately updating the pinned hash');
  if (process.argv.includes('--self-test')) selfTest(model);
  console.log(`Verified ${assets.size} local assets; ${JSON.stringify(summary)}.`);
  console.log(`Robin SHA-256: ${sha256}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Asset verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
