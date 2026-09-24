# Robin — Command Room v1.0.0

Interactive 3D presentation by **lio88 Archangel9**.

- [Live presentation](https://galaxykingdog.github.io/robin-command-room-3d/)
- A textured, rotatable Robin GLB with one lower belt and rear-material corrections.
- Gentle idle motion, orbit/zoom controls, pause, reset, fullscreen, and responsive layouts.
- Futuristic command-room panorama, 3D display plinth, lighting, and contact shadows.
- Source, asset provenance, third-party notices, and reproducible build instructions.

## Downloads

- `robin.glb`: the exact model used in the viewer.
- `robin-command-room-web-v1.0.0.zip`: the built static website. Extract and serve over HTTP/HTTPS; do not open the HTML directly from disk.
- GitHub's source archives contain the editable application. Use Node 22.12+ and run `npm ci`, `npm run check`, and `npm run dev`.

The model is not skeletally rigged: motion is whole-model procedural idle. The room is a panoramic environment, not walkable geometry. Small generated-mesh seams remain. See `docs/ASSETS.md` for provenance and reuse limitations.

Validation: clean dependency installation, GLB checksum/structure/vertex checks and negative-case self-tests, production build, and desktop plus compact browser inspection. No known dependency vulnerabilities were reported by the npm audit performed for this release.
