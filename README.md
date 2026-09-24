# Robin — Command Room Explorer

A playable Three.js character scene by **lio88 Archangel9**.

[Open the live experience](https://galaxykingdog.github.io/robin-command-room-3d/) · [Download the latest release](https://github.com/galaxykingdog/robin-command-room-3d/releases/latest)

Move Robin around a modeled command room using the on-screen joystick, WASD, or arrow keys. The character has a 13-bone skeleton with idle, short-stride walk, and greeting animations. Camera-relative movement, soft acceleration, a following camera, and simple obstacle collisions make the scene usable on touchscreens and desktops.

## Controls

| Action | Mobile / touch | Desktop |
| --- | --- | --- |
| Walk | Drag and hold the left joystick | WASD, arrow keys, or joystick |
| Choose speed | Move the thumb closer to or farther from the center | Joystick for analog speed |
| Look around | Drag the room outside the joystick | Drag the room |
| Zoom | Two-finger pinch | Mouse wheel |
| Greet | **Wave** | **Wave** |
| Pause everything / resume | **Pause / Resume** | **Pause / Resume** |
| Camera tour | **Orbit** | **Orbit** |
| Return to the entrance | **Reset** | **Reset** |
| Full screen | **Full screen**, where supported | **Full screen** |

Release the joystick to stop. Pointer cancellation, changing tabs, and losing focus clear held input. The joystick and camera can be used independently with separate fingers. Reduced-motion preferences stop passive idle motion; deliberate movement and greeting remain available.

## What changed in v2

- The same approved single-belt character now has a real skeleton and three animation clips. The face, black eyes, front textures, and lower belt are retained.
- Rear ears and cape hem are recolored consistently, and the unwanted fused rear square is softened.
- The visible room is now real geometry: floor, shell, ceiling panels, monitor bank, desk, and chair. It is an original modeled interpretation of the supplied room reference, not an imported Marble world mesh.
- The old Marble panorama is used only for environment reflections. It is not the visible background or a fake walkable floor.
- Movement stays inside the room and slides along the desk/chair collision shapes. The camera stays on the open entrance side and maintains clearance near walls.

## Asset previews

These are studio inspection renders, not browser screenshots. Runtime lighting differs.

| Front | Rear |
| --- | --- |
| ![Rigged Robin front](docs/images/robin-front.png) | ![Cleaned Robin rear](docs/images/robin-rear.png) |

![Modeled command-room inspection render](docs/images/command-room.png)

## Run locally

Node.js **22.12 or newer** and npm are required.

```sh
npm ci
npm run check
npm run dev
```

Open the URL printed by Vite. For the production build:

```sh
npm run build
npm run preview
```

Serve the generated `dist/` directory over HTTP or HTTPS; opening the HTML directly from disk does not work. A browser with WebGL is required. No API keys or generation-service login are needed to play.

## Architecture and verification

```text
src/main.js                      Rendering, animation blending, following camera
src/input.js                     Captured-pointer joystick and keyboard input
src/movement.js                  Camera-relative motion and collision resolution
public/assets/robin.glb           Rigged character with embedded textures/clips
public/assets/command-room.glb    Material-merged architectural environment
public/assets/room-layout.json    Spawn, walk bounds, and obstacle colliders
scripts/verify-assets.mjs         Binary asset, skeleton, clip, and checksum checks
scripts/test-movement.mjs         Movement, collision, release, camera-bound tests
tools/room/build_room.py          Original architectural geometry builder
docs/ASSETS.md                    Provenance, rig specifications, and limitations
```

`npm run check` validates GLB structure, finite geometry bounds, references, embedded images, reviewed asset hashes, 13 joints, and all three clips. Movement checks cover dead zones, normalized diagonals, rotated cameras, obstacle sliding, tunneling, frame-rate tolerance, release, and camera clearance at room edges. Negative-case GLB self-tests reject damaged data.

The rig was also checked through Blender export/reimport and 21 sampled poses per clip. The project was inspected in desktop, portrait, and landscape browser layouts. This is not a performance certification for every physical phone.

## Publishing

The live site serves prebuilt files from the `gh-pages` branch. Editable source lives on `main`. After checking and building, copy **the contents** of `dist/` into a checkout of `gh-pages`, retain `.nojekyll`, and commit/push that branch. Never overwrite `main` with build output.

An optional manually triggered Actions workflow is included for accounts with Actions available. Switch Pages to **GitHub Actions** before using that alternative. It is not the active publishing route for this release. Relative paths support both root-domain and project-path hosting.

The original [v1.0.0 release](https://github.com/galaxykingdog/robin-command-room-3d/releases/tag/v1.0.0) remains available.

## Scope and rights

The character is still a generated fused mesh with conservative skinning, not animation-ready retopology. Its walk is intentionally short-stride and the wave is a modest side-paw greeting. Small sleeve deformation and a rear-cape dimple remain. There is no facial rig, finger articulation, IK, cloth simulation, jumping, or multiplayer. The room uses simple ground-plane collision shapes rather than a physics simulation.

See [asset provenance](docs/ASSETS.md) and [third-party notices](docs/THIRD_PARTY.md). No project-wide license or separate unrestricted license to the character/reference artwork is asserted by publishing this repository.
