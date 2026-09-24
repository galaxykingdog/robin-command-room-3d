# Robin — Command Room

An interactive Three.js presentation by **lio88 Archangel9**. Explore a textured 3D Robin character against a futuristic command-room panorama, with gentle idle motion, adjustable camera orbit, and a responsive interface.

The character features a green hat and cape, a red feather, and one lower brown belt with a centered gold buckle. A local material correction gives the rear of the head a gray finish and recolors unwanted rear markings. The scene includes directional lighting, a contact shadow, a solid display plinth with an illuminated ring, and restrained bloom on larger displays.

## Character preview

These studio renders show the exported model used by the application. Lighting in the interactive scene is different.

| Front | Rear |
| --- | --- |
| ![Robin viewed from the front](docs/images/robin-front.png) | ![Robin viewed from the rear](docs/images/robin-rear.png) |

## Run locally

Use Node.js **22.12 or newer** and npm. From the project directory:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The development server binds to `127.0.0.1` by default.

Create and inspect a production build:

```sh
npm run check
npm run build
npm run preview
```

The production files are written to `dist/`. Serve that directory over HTTP or HTTPS; opening `index.html` directly from disk will not load the application correctly. A browser with JavaScript and WebGL is required.

## Controls

| Action | Control |
| --- | --- |
| Look around Robin | Drag with a mouse or one finger |
| Zoom | Mouse wheel or two-finger pinch |
| Enable or pause camera rotation | **Auto orbit / Pause orbit** |
| Enable or pause character motion | **Play motion / Pause motion** |
| Return to the opening camera angle | **Reset view** |
| Enter or leave full screen | **Full screen**, where supported |

Dragging pauses automatic orbit. Character motion and camera orbit have separate controls. The presentation starts without automatic movement when the browser requests reduced motion, and uses lighter rendering settings on compact screens or data-saving connections.

## What is 3D

Robin is a textured GLB mesh that can be inspected from all sides. The environment in this application is a **360° panorama**, used as both the background and environmental lighting. It is not a reconstructed room with navigable geometry or collision. The interface links to the separately generated Marble world for that environment.

The included character is **not skeletally rigged**. Its idle motion is generated in JavaScript by gently moving, rotating, and scaling the whole model; it does not walk, speak, or articulate individual limbs. The viewer can play animation clips if a replacement GLB contains them, but the supplied model has no such clips.

The generated mesh and textures can retain small seams and shape inconsistencies. This is a presentation asset, not a claim of exact reproduction of the source artwork or a production-ready game character.

## Project structure

```text
index.html                         Interface and page metadata
src/main.js                        Three.js scene, loaders, motion, and controls
src/styles.css                     Responsive interface styling
public/assets/robin.glb             Character model with embedded textures
public/assets/command-room-pano.jpg Environment panorama
public/decoders/                    Local geometry and texture decoders
docs/ASSETS.md                     Asset provenance and usage notes
```

Built with Three.js and Vite. Assets and decoders are served locally with the application; no generation-service API key is required to run the viewer.

## Verification and deployment

`npm run check` verifies the approved model checksum, binary GLB structure, finite vertex bounds, valid indices, embedded textures, and local decoder assets. Negative-case tests check that damaged or externally linked models fail validation.

The GitHub Actions workflow validates and builds every pull request. Pushes to `main` also publish `dist/` to GitHub Pages. Enable **GitHub Actions** as the Pages source in repository settings. Relative asset paths support both domain-root and project-path hosting.

Third-party license notices are included in [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) and the deployed `THIRD_PARTY.md` file.

## Asset provenance and rights

Robin was generated with Hyper3D Rodin from a supplied character reference, then received a local rear-material correction. The environment panorama was generated with World Labs Marble from a supplied command-room reference. See [asset provenance and rights](docs/ASSETS.md) for details.

Publishing this repository does not grant a separate license to the character artwork, supplied references, generated assets, or project code. No project-wide license is declared. Third-party libraries and decoder components retain their own licenses.
