# Asset provenance

Project author: **lio88 Archangel9**.

This document records how the presentation assets were obtained and edited. It does not establish ownership of supplied references or grant additional rights to any artwork.

| File | Source and treatment | Role |
| --- | --- | --- |
| `public/assets/robin.glb` | Hyper3D Rodin generation based on a user-supplied Robin character reference. The selected mesh received local material corrections focused on the rear head, cape, and feet. The rear head's large light patch was recolored gray; unwanted rear cape markings were recolored green. | Interactive character mesh with embedded textures. |
| `public/assets/command-room-pano.jpg` | World Labs Marble generation based on a user-supplied futuristic command-room reference. | Equirectangular background and environmental lighting. |
| `docs/images/robin-front.png` | Studio render of the exported character, copied from the final export QA output. | Front preview in the README. |
| `docs/images/robin-rear.png` | Studio render of the exported character, copied from the final export QA output. | Rear preview in the README. |

## Character notes

The selected design has one lower belt with a centered gold buckle. The material correction was intended to preserve the selected front appearance while reducing the prominent rear texture artifacts. It did not replace the character with a new generation, add a skeleton, or create walking animation.

The model is generated geometry, and small texture seams or surface irregularities can remain. Rear recoloring changes the surface appearance; it does not necessarily remove a protruding feature from the mesh. Preview renders and the live viewer use different lighting and may show different color and brightness.

## Environment notes

The application uses a flat panoramic image mapped around the viewer, not the full Marble world geometry. Camera rotation changes the visible portion of that panorama, but the background does not provide positional parallax or a walkable floor. The character, lights, contact-shadow plane, and decorative floor ring are real scene objects.

The separately hosted [Marble world](https://marble.worldlabs.ai/world/c80ef9e3-eef2-43ed-a914-ac0e3a64c1f6) is linked from the presentation. Its continued availability and access conditions are controlled by that service.

## Third-party components

- Three.js supplies rendering, camera controls, asset loaders, and post-processing.
- Vite supplies development tooling and production bundling.
- `public/decoders/` contains Draco and Basis decoder components distributed for local loading by the Three.js loaders.

Third-party components retain their upstream copyright and license terms. Consult the dependency packages and any included notices before redistribution.

## Rights and reuse

The original reference images are not included in this repository. Their presence in the production workflow does not establish that they are public domain or freely licensed.

No separate license grant for the character design, source references, generated model, panorama, preview renders, or project code is asserted here. A public repository permits viewing its contents; it should not be interpreted as permission for unrestricted reuse, redistribution, or commercial use. Obtain the relevant permissions and check the generation services' applicable terms before reusing these assets.
