# Robin — Command Room Explorer v2.0.0

Playable Three.js scene by **lio88 Archangel9**.

[Open the live experience](https://galaxykingdog.github.io/robin-command-room-3d/)

- Mobile analog joystick; WASD and arrow-key movement on desktop.
- Real 13-bone Robin rig with Idle, Walk, and Wave clips, retaining the approved face and one lower belt.
- Cleaned rear ears/cape hem and softened rear-square artifact.
- Actual modeled command room with following camera, floor shadows, and desk/chair collision boundaries.
- Pause/resume, reset, limited camera tour, zoom, fullscreen where supported, and reduced-motion support.

Downloads include the rigged `robin.glb`, architectural `command-room.glb`, room collision layout, and a static website ZIP. Serve extracted website files over HTTP/HTTPS. Source archives contain the editable application; use Node 22.12+ and run `npm ci`, `npm run check`, and `npm run dev`.

The separate `robin-v2-editable-source.zip` contains packed, editable Blender files and relative-path rebuild/verification scripts. The room builder is included in the application source under `tools/room/`.

Validated: binary asset checks, rig/export round-trip, sampled animation poses, input cancellation and movement/collision tests, production build, and desktop/phone-size browser inspection. The rig uses conservative fused-mesh weights; short-stride walking, minor sleeve deformation, and a small rear cape dimple remain. The room is an authored interpretation, not the original Marble world geometry. Asset rights and full limitations are documented in `docs/ASSETS.md`.

The previous v1.0.0 release is retained for rollback.
