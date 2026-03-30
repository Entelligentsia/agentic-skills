---
name: webxr-passthrough
description: Meta Quest mixed reality passthrough, plane detection, mesh detection, environment blend modes, transparent renderer setup. Use when building AR/MR experiences on Quest, working with real-world planes or room meshes, or enabling passthrough.
---

# WebXR Passthrough & Mixed Reality

## Quick Start

```js
import * as THREE from 'three';
import { ARButton, RealityAccelerator } from 'ratk';

// 1. Alpha-transparent renderer (required for passthrough)
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.xr.enabled = true;
renderer.setClearColor(0x000000, 0);
scene.background = null;

// 2. AR button with MR features
ARButton.convertToARButton(document.getElementById('ar-btn'), renderer, {
  requiredFeatures: ['local-floor', 'hit-test', 'plane-detection'],
  optionalFeatures: ['anchors', 'mesh-detection', 'layers'],
});

// 3. RATK for planes + meshes
const ratk = new RealityAccelerator(renderer.xr);
scene.add(ratk.root);

ratk.onPlaneAdded = (plane) => {
  if (plane.semanticLabel === 'floor') {
    plane.visible = false; // hide RATK mesh; use for physics/raycasting
  }
};

// 4. Prompt room setup if no planes found
renderer.xr.addEventListener('sessionstart', () => {
  setTimeout(() => {
    if (ratk.planes.size === 0) {
      renderer.xr.getSession().initiateRoomCapture();
    }
  }, 5000);
});

// 5. Render loop
renderer.setAnimationLoop(() => {
  ratk.update();
  renderer.render(scene, camera);
});
```

## Core API

### Environment Blend Mode

```js
// Check blend mode after session starts
session.environmentBlendMode;
// 'opaque'      — VR, fully opaque (immersive-vr)
// 'alpha-blend' — passthrough composited with virtual content (Quest AR)
// 'additive'    — additive light display

// In Three.js, check via:
renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  if (session.environmentBlendMode === 'alpha-blend') {
    // MR/passthrough mode
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
  }
});
```

### Session Modes for Passthrough

```js
// Explicit AR (immersive-ar) — preferred for MR
navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['plane-detection', 'mesh-detection', 'hit-test', 'anchors'],
});

// VR with passthrough (immersive-vr) — for apps that can be both VR and MR
// Quest reports environmentBlendMode = 'alpha-blend' in this mode when passthrough is active
navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['plane-detection'],
});
```

### Three.js Renderer for Passthrough

```js
const renderer = new THREE.WebGLRenderer({
  alpha: true,           // REQUIRED — renders transparent pixels for passthrough
  antialias: true,
  multiviewStereo: true, // Quest stereo optimisation
});

renderer.setClearColor(0x000000, 0); // alpha=0 → passthrough shows through
scene.background = null;             // no skybox/background

// Optional: adjust foveation for MR quality
renderer.xr.setFoveation(0); // 0 = no foveation (max quality for passthrough edges)

// Optional: target frame rate
renderer.xr.addEventListener('sessionstart', () => {
  renderer.xr.getSession().updateTargetFrameRate(72);
});
```

### Plane Detection (Raw WebXR API)

```js
// Requires 'plane-detection' feature

function onXRFrame(timestamp, frame) {
  session.requestAnimationFrame(onXRFrame);

  const detectedPlanes = frame.detectedPlanes; // XRPlaneSet | undefined
  if (!detectedPlanes) return;

  detectedPlanes.forEach((plane) => {
    plane.orientation;      // 'horizontal' | 'vertical'
    plane.planeSpace;       // XRSpace — get pose with frame.getPose()
    plane.polygon;          // DOMPointReadOnly[] — contour in planeSpace coords
    plane.lastChangedTime;  // DOMHighResTimeStamp
    plane.semanticLabel;    // string (Meta extension) — see labels below

    const planePose = frame.getPose(plane.planeSpace, refSpace);
    if (planePose) {
      // planePose.transform.position — plane center in world space
      // planePose.transform.orientation — plane orientation
    }
  });
}
```

**Semantic Labels (Quest-specific, non-standard):**
`'floor'`, `'ceiling'`, `'wall'`, `'table'`, `'couch'`, `'door'`, `'window'`, `'wall art'`, `'other'`

### Mesh Detection (Raw WebXR API)

```js
// Requires 'mesh-detection' feature

const detectedMeshes = frame.detectedMeshes; // XRMeshSet | undefined
if (detectedMeshes) {
  detectedMeshes.forEach((mesh) => {
    mesh.meshSpace;       // XRSpace
    mesh.vertices;        // Float32Array — [x0,y0,z0, x1,y1,z1, ...] in meshSpace
    mesh.indices;         // Uint32Array  — triangle indices
    mesh.lastChangedTime; // DOMHighResTimeStamp
    mesh.semanticLabel;   // string (Quest extension) — same labels as planes
  });
}
```

### `session.initiateRoomCapture()`

Non-standard Meta extension. Triggers the system room-setup scan flow if the user hasn't set up their room yet.

```js
// Only call if no planes are detected after session start
renderer.xr.addEventListener('sessionstart', () => {
  setTimeout(() => {
    if (ratk.planes.size === 0) {
      const session = renderer.xr.getSession();
      if (typeof session.initiateRoomCapture === 'function') {
        session.initiateRoomCapture();
      }
    }
  }, 5000); // give the system 5s to report existing planes first
});
```

### XRInteractionMode

```js
session.interactionMode;
// 'world-space'  — head-worn AR, controllers in 3D space (Quest)
// 'screen-space' — handheld AR, touchscreen interaction
```

## RATK Integration

See `webxr-ratk` for full API. Quick reference for passthrough-specific usage:

```js
import { RealityAccelerator } from 'ratk';
const ratk = new RealityAccelerator(renderer.xr);
scene.add(ratk.root); // RATK adds plane/mesh/anchor objects as children

// Planes
ratk.onPlaneAdded   = (plane) => { /* plane extends Object3D; plane.planeMesh */ };
ratk.onPlaneDeleted = (plane) => { };
ratk.planes; // Set<Plane>

// Per-plane properties
plane.orientation;             // 'horizontal' | 'vertical'
plane.semanticLabel;           // 'floor' | 'wall' | etc.
plane.planeMesh;               // THREE.Mesh with ShapeGeometry
plane.boundingRectangleWidth;  // metres
plane.boundingRectangleHeight; // metres

// Meshes
ratk.onMeshAdded   = (rmesh) => { /* rmesh.meshMesh — THREE.Mesh with BufferGeometry */ };
ratk.onMeshDeleted = (rmesh) => { };
ratk.meshes; // Set<RMesh>

// Per-mesh properties
rmesh.meshMesh;       // THREE.Mesh with reconstructed geometry
rmesh.semanticLabel;  // same as plane labels

// Passthrough toggle (for apps that switch between VR and MR)
ratk.setPassthroughEnabled(true);

// ALWAYS call inside XR animation loop
renderer.setAnimationLoop(() => {
  ratk.update(); // must be here
  renderer.render(scene, camera);
});
```

## Quest-Specific Gotchas

**`alpha: true` on renderer is mandatory.** Without it, passthrough is blocked by an opaque framebuffer — the user sees only the virtual scene on a black background.

**`scene.background = null`.** Any `scene.background` value (color, texture, cubemap) overrides transparency. Set to `null` for passthrough; restore for VR mode.

**Quest 2 passthrough is grayscale.** Only Quest Pro and Quest 3 have color passthrough. Quest 2 shows the real world in grayscale. Design your MR experience to work with both.

**Plane detection requires room setup.** If the user hasn't done Meta Quest room setup (Settings > Boundary > Mixed Reality), `frame.detectedPlanes` returns an empty set. Use `initiateRoomCapture()` to trigger setup.

**Plane semanticLabel is a non-standard extension.** It may be `undefined` if the plane has no semantic classification. Always null-check: `plane.semanticLabel ?? 'unknown'`.

**Mesh detection vs plane detection.** Planes are simpler shapes (quads); meshes are full triangle geometry of the room. Use planes for physics colliders (lightweight); use meshes for accurate room geometry occlusion (expensive).

**`foveation(0)` for MR.** In VR, foveation = 1 saves GPU. In passthrough MR, the user's peripheral vision sees the real world sharply — high foveation at edges looks jarring. Use `foveation(0)` for MR sessions.

## Common Patterns

### Floor Detection + Shadow Plane

```js
ratk.onPlaneAdded = (plane) => {
  if (plane.semanticLabel === 'floor') {
    plane.visible = false; // hide RATK mesh

    // Create shadow-receiving plane at floor height
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.copy(plane.position);
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
  }
};
```

### Wall Colliders with Rapier Physics

```js
ratk.onPlaneAdded = (plane) => {
  plane.visible = false;

  if (plane.orientation === 'vertical') {
    const colliderDesc = RAPIER.ColliderDesc
      .cuboid(plane.boundingRectangleWidth / 2, 0.01, plane.boundingRectangleHeight / 2)
      .setTranslation(...plane.position.toArray())
      .setRotation(plane.quaternion);
    rapierWorld.createCollider(colliderDesc);
  }
};
```

### Suppress RATK Visuals (Data Only)

```js
// Use RATK's spatial data without rendering its auto-generated meshes
ratk.onPlaneAdded = (plane) => { plane.visible = false; };
ratk.onMeshAdded  = (mesh)  => { mesh.visible  = false; };
```

## See Also

- `webxr-session` — `immersive-ar` session, feature flags
- `webxr-rendering` — transparent renderer setup
- `webxr-anchors` — place objects anchored to real-world surfaces
- `webxr-ratk` — full RATK API reference
