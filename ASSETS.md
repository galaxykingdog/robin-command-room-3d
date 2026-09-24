# Asset provenance — v2

Project author: **lio88 Archangel9**.

| Asset | Source and treatment |
| --- | --- |
| `public/assets/robin.glb` | The approved Hyper3D Rodin single-belt Robin, locally repaired and rigged in Blender. The front is retained. Rear ear/hem material artifacts are cleaned and the fused cape square is softened. Embedded textures, one 13-joint skin. |
| `public/assets/command-room.glb` | Original architectural modeling based on the user-supplied futuristic-room reference. Real geometry with 10 material groups; no third-party meshes or raster textures. Not an export of the Marble world. |
| `public/assets/room-layout.json` | Authored walk bounds, spawn, and simplified desk/chair collision shapes for the modeled room. |
| `public/assets/command-room-pano.jpg` | World Labs Marble panorama generated earlier from the supplied reference. Used only for environment reflections in v2. |
| `docs/images/*` | Studio inspection renders of the final character and room. Not browser screenshots. |

## Character contract

glTF is Y-up, front -Z. Rest height is 1.893728 model units; the viewer scales it to 2.18 units and adds 0.012 units of ground clearance. There are 23,619 exported vertices, 39,402 triangles, three material primitives, two embedded JPEG images, and 13 joints.

| Clip | Duration | Playback |
| --- | --- | --- |
| Idle | 4 seconds | Loop |
| Walk | 1 second | In-place loop; player controller supplies translation |
| Wave | 2.6 seconds | Once, then blend back |

The rest front differed from the v1 source in 95 of 589,824 comparison pixels above 3/255, predominantly silhouette shading. Export/reimport comparison of the new rest front had zero pixels above that threshold. These checks do not imply identical animated poses.

Sampled deformation checks used 21 times per clip. The worst sampled foot dip was 0.005315 source-model units. The 99th-percentile edge-stretch maximum was approximately 1.123 for Walk and 1.360 for Wave. Local sleeve deformation remains because the cape and arms are fused. The rig is deliberately restrained, with no facial/finger controls, IK, or cloth simulation. The rear cape retains a slight dimple.

Reviewed GLB SHA-256: `f33d94668a80f6bf51582a1339abca7d1fe17984bbebb8c78fb5c4bb9d2de740`.

## Room contract

Y-up, floor at y=0, open entrance at +Z. Approximately 12 by 10 meters, with a 5.73-meter maximum height. The runtime must not normalize the room as it does the character. The GLB has 58,979 vertices and 95,096 triangles in 10 merged material meshes, no textures, and no exported cameras or lights. Runtime lights illuminate the room; emissive surfaces are decorative in raster rendering.

Reviewed GLB SHA-256: `3eb654f7a3361fc7bb1e0779bfa8f2b1c5266318f5ad53818c59db4ea96cd3a8`.

The camera is constrained toward the open entrance; the rear service gap is not a traversal route. Ground-plane collision rectangles/circles are a simplified gameplay approximation, not mesh-accurate physics. This room is a modeled interpretation, not an exact reconstruction of the reference.

The separate [original Marble world](https://marble.worldlabs.ai/world/c80ef9e3-eef2-43ed-a914-ac0e3a64c1f6) is linked from the application.

## Rights

The original reference images are not included. Their use does not establish ownership, public-domain status, or unrestricted commercial reuse rights. No separate license grant to the character design, references, generated model, panorama, renders, or project code is asserted. Check applicable permissions and generation-service terms before reuse. Third-party software retains its own licenses; see [THIRD_PARTY.md](THIRD_PARTY.md).
