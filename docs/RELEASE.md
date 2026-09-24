# Robin — Signal Lost v3.0.0

Playable Three.js micro-adventure by **lio88 Archangel9**.

[Open the live experience](https://galaxykingdog.github.io/robin-command-room-3d/)

- A skippable 4.5-second introduction and three ordered systems to restore: Navigation on the left, Power on the right, then the central Uplink.
- Numbered beacons, proximity guidance, and a 1.6-second connection action. Tap the objective button or press **E** nearby, then remain beside the beacon.
- Progressive room lighting, a wireframe globe, Robin's greeting, and a completion screen with replay/free-exploration choices.
- **Watch demo**: a guided run through the same collisions and mission rules. Movement or **Take control** returns control to the player.
- Opt-in synthesized sound cues. No music downloads, microphone access, or sign-in are required.
- Existing touch joystick, WASD/arrows, Wave, Pause/Resume, Orbit, Reset, zoom, fullscreen where supported, and reduced-motion support are retained.

The approved v2 character, 13-bone rig, three animation clips, and room GLBs are unchanged. The face, eyes, one lower belt, and rear cleanup are retained. This release adds the interactive mission around those assets, rather than regenerating them.

## Downloads and source

Serve the extracted contents of `robin-command-room-web-v3.0.0.zip` over HTTP/HTTPS; opening the HTML directly from disk is unsupported. Application source is available in the repository/source archives. Use Node 22.12+ and run `npm ci`, `npm run check`, and `npm run dev`.

The unchanged `robin-v2-editable-source.zip` remains available in [v2.0.0](https://github.com/galaxykingdog/robin-command-room-3d/releases/tag/v2.0.0), with packed editable Blender files and relative-path rebuild/verification scripts. No new character-source ZIP is introduced in v3. The room builder remains in `tools/room/`. Previous v1 and v2 releases are preserved for rollback.

## Verification and scope

Automated checks pass for binary assets, movement/collisions, mission state transitions, and full guided traversal across frame rates. The production build was checked in the browser, including a full guided mission, manual joystick/proximity activation, pause during charging, sound toggle, replay, and free exploration. Layouts were inspected at 1440×900, 390×844, and 667×375. Reduced-motion branches were reviewed and module-tested. The unchanged rig retains its v2 export/reimport and sampled-pose checks. No physical-phone performance certification is claimed.

The character uses conservative fused-mesh skinning: walking is short-stride, the wave is restrained, and minor sleeve deformation plus a small rear-cape dimple remain. There is no facial rig, IK, cloth simulation, jumping, or multiplayer. The room is an authored interpretation, not the original Marble world geometry. See [asset provenance and rights](https://github.com/galaxykingdog/robin-command-room-3d/blob/v3.0.0/docs/ASSETS.md) and [third-party notices](https://github.com/galaxykingdog/robin-command-room-3d/blob/v3.0.0/docs/THIRD_PARTY.md); publication does not grant unrestricted rights to the reference artwork or character.
