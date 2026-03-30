---
name: webxr-ratk
description: Meta Reality Accelerator Toolkit (RATK) — Three.js abstractions over Quest WebXR APIs for planes, meshes, anchors, hit-testing, and passthrough. Use when building Quest MR experiences with Three.js, working with detected planes/meshes, spatial anchors, or hit-testing in Three.js.
---

# Reality Accelerator Toolkit (RATK)

RATK bridges low-level WebXR APIs to Three.js `Object3D` instances. It manages detected planes, room meshes, anchors, and hit-test targets, translating XR data into scene objects automatically.

**Package:** `ratk` on npm (not `reality-accelerator-toolkit`)

## Quick Start

```js
import * as THREE from 'three';
import { ARButton, RealityAccelerator } from 'ratk';

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.xr.enabled = true;

const scene = new THREE.Scene();
scene.background = null; // passthrough

// 1. Create RATK
const ratk = new RealityAccelerator(renderer.xr);
scene.add(ratk.root); // all RATK objects are children of ratk.root

// 2. AR button with feature presets
ARButton.convertToARButton(document.getElementById('ar-btn'), renderer, {
  requiredFeatures: ['hit-test', 'plane-detection', 'anchors'],
  optionalFeatures: ['mesh-detection', 'local-floor', 'layers'],
});

// 3. Plane callback
ratk.onPlaneAdded = (plane) => {
  plane.planeMesh.material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
};

// 4. CRITICAL — call ratk.update() inside the XR animation loop
renderer.setAnimationLoop((timestamp, frame) => {
  ratk.update(); // must be here — not window.requestAnimationFrame
  renderer.render(scene, camera);
});
```

## Installation

```bash
npm install ratk
# peer dependency: three
```

## RealityAccelerator

```ts
class RealityAccelerator {
  constructor(xrManager: THREE.WebXRManager)

  // Root group — all RATK-managed objects are children
  readonly root: THREE.Group

  // Collections (live Sets, updated by ratk.update())
  readonly planes: Set<Plane>
  readonly meshes: Set<RMesh>
  readonly anchors: Set<Anchor>
  readonly persistentAnchors: Set<Anchor> // anchors with anchorID set
  readonly hitTestTargets: Set<HitTestTarget>

  // Lifecycle callbacks
  onPlaneAdded?:   (plane: Plane) => void
  onPlaneDeleted?: (plane: Plane) => void
  onMeshAdded?:    (mesh: RMesh)  => void
  onMeshDeleted?:  (mesh: RMesh)  => void

  // Must call every XR frame
  update(): void

  // Anchors
  createAnchor(position: Vector3, quaternion: Quaternion, persistent?: boolean): Promise<Anchor>
  deleteAnchor(anchor: Anchor): Promise<void>
  restorePersistentAnchors(): Promise<void>

  // Hit testing
  createHitTestTargetFromViewerSpace(offsetOrigin?: Vector3, offsetDirection?: Vector3): Promise<HitTestTarget>
  createHitTestTargetFromControllerSpace(handedness: XRHandedness, offsetOrigin?: Vector3, offsetDirection?: Vector3): Promise<HitTestTarget>
  createHitTestTargetFromSpace(space: XRSpace, offsetOrigin?: Vector3, offsetDirection?: Vector3): Promise<HitTestTarget>
  deleteHitTestTarget(target: HitTestTarget): void
}
```

### `ratk.update()` — placement rule

```js
// CORRECT — inside XR animation loop
renderer.setAnimationLoop((timestamp, frame) => {
  ratk.update();
  renderer.render(scene, camera);
});

// WRONG — window.requestAnimationFrame is not the XR loop
window.requestAnimationFrame(() => {
  ratk.update(); // XRFrame not available — plane/mesh data stale
});
```

## Plane (extends THREE.Group)

```ts
class Plane extends THREE.Group {
  // From XRPlane
  readonly xrPlane: XRPlane
  readonly orientation: 'horizontal' | 'vertical'
  readonly semanticLabel: string    // 'floor'|'ceiling'|'wall'|'table'|'couch'|'door'|'window'|'wall art'|'other'
  readonly lastUpdated: number      // DOMHighResTimeStamp

  // Three.js geometry (auto-generated from XRPlane.polygon)
  planeMesh?: THREE.Mesh            // ShapeGeometry lying flat
  boundingRectangleWidth:  number   // metres
  boundingRectangleHeight: number   // metres

  // Inherited from Object3D (auto-updated by ratk.update())
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}
```

```js
// Usage
ratk.onPlaneAdded = (plane) => {
  console.log(plane.semanticLabel);            // 'floor'
  console.log(plane.orientation);              // 'horizontal'
  console.log(plane.boundingRectangleWidth);   // e.g. 2.4 (metres)

  // Style the auto-mesh
  plane.planeMesh.material = new THREE.MeshStandardMaterial({ color: 0x888888 });

  // Or hide it and use for physics/raycasting only
  plane.visible = false;
};

// Iterate existing planes
ratk.planes.forEach((plane) => { ... });
```

## RMesh (extends THREE.Group)

Room mesh from full 3D scan — more detailed than planes.

```ts
class RMesh extends THREE.Group {
  readonly xrMesh: XRMesh
  readonly semanticLabel: string
  readonly lastUpdated: number

  // Three.js geometry (auto-generated from XRMesh.vertices + XRMesh.indices)
  meshMesh?: THREE.Mesh   // BufferGeometry with full triangle mesh

  position: THREE.Vector3
  quaternion: THREE.Quaternion
}
```

```js
ratk.onMeshAdded = (rmesh) => {
  console.log(rmesh.semanticLabel);         // 'table', 'floor', etc.
  rmesh.meshMesh.material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });

  // Compute bounding box for label placement
  rmesh.meshMesh.geometry.computeBoundingBox();
  const topY = rmesh.meshMesh.geometry.boundingBox.max.y;
};
```

## Anchor (extends THREE.Group)

```ts
class Anchor extends THREE.Group {
  readonly xrAnchor: XRAnchor
  readonly isPersistent: boolean  // true if anchorID is set
  anchorID?: string               // UUID for persistent anchors

  makePersistent(): Promise<void>   // calls xrAnchor.requestPersistentHandle()
  makeNonPersistent(): Promise<void>

  // Position/quaternion auto-updated by ratk.update() each frame
}
```

```js
// Create a new anchor
const pos = new THREE.Vector3(1, 0, -2);
const quat = new THREE.Quaternion();
const anchor = await ratk.createAnchor(pos, quat, false); // false = not persistent
anchor.add(new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.1, 0.1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 }),
));

// Make it persistent across sessions
await anchor.makePersistent();
console.log(anchor.anchorID); // UUID string

// Restore on next session
await ratk.restorePersistentAnchors();
ratk.anchors.forEach((anchor) => {
  // anchor.anchorID tells you which saved anchor this is
  anchor.add(myObjectForAnchor(anchor.anchorID));
});

// Delete
await ratk.deleteAnchor(anchor);
```

## HitTestTarget (extends THREE.Group)

```ts
class HitTestTarget extends THREE.Group {
  readonly xrHitTestSource: XRHitTestSource
  hitTestResultValid: boolean   // true if a hit was found last frame
  hitTestResults: XRHitTestResult[]

  // Position/quaternion set to hit point by ratk.update()
}
```

```js
// Create hit test target from right controller
renderer.xr.addEventListener('sessionstart', async () => {
  const hitTarget = await ratk.createHitTestTargetFromControllerSpace('right');

  // Add a reticle at the hit point
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.08, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  );
  reticle.rotation.x = -Math.PI / 2;
  hitTarget.add(reticle);

  // hitTarget.hitTestResultValid is true when pointing at a surface
  renderer.setAnimationLoop(() => {
    ratk.update();
    reticle.visible = hitTarget.hitTestResultValid;
    renderer.render(scene, camera);
  });
});

// Delete when no longer needed
ratk.deleteHitTestTarget(hitTarget); // cancels the XRHitTestSource
```

## ARButton / VRButton

RATK exports its own button helpers with Quest-specific defaults:

```js
import { ARButton, VRButton } from 'ratk';

// AR button (immersive-ar)
ARButton.convertToARButton(buttonEl, renderer, {
  sessionInit: {
    requiredFeatures: ['hit-test', 'plane-detection', 'mesh-detection', 'anchors'],
    optionalFeatures: ['local-floor', 'layers'],
  },
  onSessionStarted: (session) => { },
  onSessionEnded:   (session) => { },
  onSupported:    () => { },
  onUnsupported:  () => { },
  onNotAllowed:   (err) => { },
  ENTER_XR_TEXT:  'Enter AR',
  LEAVE_XR_TEXT:  'Exit AR',
});

// VR button (immersive-vr)
// Automatically handles the 'sessiongranted' event for Horizon OS direct launch
VRButton.convertToVRButton(buttonEl, renderer, { ... });

// Create and return button element instead
const btn = ARButton.createButton(renderer, { ... });
document.body.appendChild(btn);
```

**`VRButton` registers `sessiongranted`** at module load — required for Horizon Store apps that launch directly into VR from the OS shell.

## Quest-Specific Gotchas

**`ratk.update()` must be inside `renderer.setAnimationLoop`** — not `window.requestAnimationFrame`. RATK reads `XRFrame` data from the WebXR manager; that data is only valid inside the XR animation callback.

**`ratk.root` must be added to the scene.** `scene.add(ratk.root)` is required — all RATK objects (planes, meshes, anchors) are parented to `ratk.root`.

**`restorePersistentAnchors()` throws `NotSupportedError`** if `session.persistentAnchors` is not available (requires `anchors` feature in session). Wrap in try/catch.

**Session change clears state.** RATK automatically clears `anchors` and `hitTestTargets` when the XR session changes. Planes and meshes persist across sessions via the Quest system.

**`onPlaneAdded` fires once on discovery.** Plane updates (geometry changes) do not re-fire `onPlaneAdded`. Check `plane.lastUpdated` in the render loop if you need to respond to plane changes.

**`initiateRoomCapture()` trigger pattern:**

```js
renderer.xr.addEventListener('sessionstart', () => {
  setTimeout(() => {
    if (ratk.planes.size === 0) {
      renderer.xr.getSession().initiateRoomCapture?.();
    }
  }, 5000);
});
```

## See Also

- `webxr-session` — session setup, `requiredFeatures`
- `webxr-passthrough` — transparent renderer, passthrough setup
- `webxr-anchors` — raw anchor API (without RATK)
- `webxr-input` — controller setup for hit-test targets
