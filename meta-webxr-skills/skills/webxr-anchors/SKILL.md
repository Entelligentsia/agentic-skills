---
name: webxr-anchors
description: WebXR spatial anchors, hit-testing, anchor creation and persistence on Meta Quest. Use when placing virtual objects on real-world surfaces, persisting object positions across sessions, or implementing hit-testing for object placement.
---

# WebXR Anchors & Hit-Testing

## Quick Start

```js
// Hit-test to place object, then anchor it
let hitTestSource = null;

// Session setup — request hit-test + anchors features
navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['local-floor', 'hit-test', 'anchors'],
});

// After session starts:
const viewerSpace = await session.requestReferenceSpace('viewer');
hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

// On select (trigger) — place and anchor
session.addEventListener('select', async (event) => {
  const frame = event.frame;
  const results = frame.getHitTestResults(hitTestSource);
  if (results.length > 0) {
    const anchor = await results[0].createAnchor();
    addObjectToAnchor(anchor, frame);
  }
});

// Per frame — update anchored objects
function onXRFrame(timestamp, frame) {
  session.requestAnimationFrame(onXRFrame);

  // Hit-test reticle
  if (hitTestSource) {
    const results = frame.getHitTestResults(hitTestSource);
    reticle.visible = results.length > 0;
    if (results.length > 0) {
      const pose = results[0].getPose(refSpace);
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    }
  }

  // Update anchor positions
  if (frame.trackedAnchors) {
    frame.trackedAnchors.forEach((anchor) => {
      const anchorPose = frame.getPose(anchor.anchorSpace, refSpace);
      if (anchorPose && anchor.userData?.object3D) {
        anchor.userData.object3D.matrix.fromArray(anchorPose.transform.matrix);
      }
    });
  }
}

// Cleanup
session.addEventListener('end', () => {
  hitTestSource?.cancel();
  hitTestSource = null;
});
```

## Hit-Testing API

### Creating a Hit Test Source

```js
// From viewer space (centre of view — for gaze-based placement)
const viewerSpace = await session.requestReferenceSpace('viewer');
const viewerHitTestSource = await session.requestHitTestSource({
  space: viewerSpace,
});

// From controller target ray space (for pointer-based placement)
// Must be done in inputsourceschange or selectstart (input source must exist)
const controllerHitTestSource = await session.requestHitTestSource({
  space: inputSource.targetRaySpace,
});

// With an offset ray direction
const viewerHitTestSource = await session.requestHitTestSource({
  space: viewerSpace,
  offsetRay: new XRRay(
    { x: 0, y: 0, z: 0 },       // origin offset
    { x: 0, y: -0.3, z: -1 },   // direction (angled down slightly)
  ),
});
```

### Getting Hit Test Results Per Frame

```js
function onXRFrame(timestamp, frame) {
  session.requestAnimationFrame(onXRFrame);

  const results = frame.getHitTestResults(hitTestSource); // XRHitTestResult[]

  if (results.length > 0) {
    const hit = results[0]; // closest hit

    // Get hit pose in reference space
    const pose = hit.getPose(refSpace); // XRPose | null
    if (pose) {
      // pose.transform.position  — hit point position
      // pose.transform.orientation — surface normal orientation
      // pose.transform.matrix    — 4x4 Float32Array
    }

    // Create anchor at hit point (in select handler)
    // hit.createAnchor() — Promise<XRAnchor>
  }
}
```

### Cancelling Hit Test Source

```js
// Always cancel on session end
session.addEventListener('end', () => {
  hitTestSource?.cancel();
  hitTestSource = null;
});

// Also cancel if no longer needed mid-session
hitTestSource.cancel();
```

## Anchor API

### Creating Anchors

```js
// Method 1: From a hit test result (most common for MR placement)
session.addEventListener('select', async (event) => {
  const results = frame.getHitTestResults(hitTestSource);
  if (results.length > 0) {
    const anchor = await results[0].createAnchor(); // XRAnchor
    setupAnchoredObject(anchor);
  }
});

// Method 2: From an arbitrary pose + space
const pose = new XRRigidTransform(
  { x: 1, y: 0, z: -2 },       // position
  { x: 0, y: 0, z: 0, w: 1 }   // quaternion (identity)
);
const anchor = await frame.createAnchor(pose, refSpace); // XRAnchor

// Method 3: At input source position
session.addEventListener('select', async (event) => {
  const frame = event.frame;
  const inputPose = frame.getPose(event.inputSource.targetRaySpace, refSpace);
  if (inputPose) {
    const anchor = await frame.createAnchor(inputPose.transform, refSpace);
  }
});
```

### Tracking Anchors Per Frame

```js
// Track all active anchors
let previousAnchors = new Set();

function onXRFrame(timestamp, frame) {
  session.requestAnimationFrame(onXRFrame);

  const trackedAnchors = frame.trackedAnchors; // XRAnchorSet | undefined

  if (trackedAnchors) {
    // Detect dropped anchors
    previousAnchors.forEach((anchor) => {
      if (!trackedAnchors.has(anchor)) {
        onAnchorLost(anchor);
      }
    });

    // Update positions of tracked anchors
    trackedAnchors.forEach((anchor) => {
      const anchorPose = frame.getPose(anchor.anchorSpace, refSpace);
      if (anchorPose && anchor.userData?.object3D) {
        anchor.userData.object3D.matrixAutoUpdate = false;
        anchor.userData.object3D.matrix.fromArray(anchorPose.transform.matrix);
      }
    });

    previousAnchors = new Set(trackedAnchors);
  }
}
```

### Deleting Anchors

```js
// Delete a specific anchor
anchor.delete(); // synchronous — removes from tracking immediately
```

### Anchor Persistence (Quest Extension)

Persist anchors across sessions using UUIDs:

```js
// Save anchor (call once per anchor you want to persist)
const uuid = await anchor.requestPersistentHandle(); // returns UUID string
localStorage.setItem('myAnchorUUID', uuid);

// Session list of all persisted anchors for this app
session.persistentAnchors; // string[] — array of UUID strings

// Restore on next session start
const savedUUIDs = JSON.parse(localStorage.getItem('anchorUUIDs') || '[]');
for (const uuid of savedUUIDs) {
  try {
    const anchor = await session.restorePersistentAnchor(uuid); // XRAnchor
    setupAnchoredObject(anchor);
  } catch (e) {
    // Anchor no longer exists (room moved, etc.)
    console.warn('Could not restore anchor', uuid, e);
  }
}

// Delete a persisted anchor permanently
await session.deletePersistentAnchor(uuid);
```

## XRAnchor Interface

```ts
interface XRAnchor {
  anchorSpace: XRSpace;                          // query pose with frame.getPose()
  requestPersistentHandle(): Promise<string>;    // returns UUID
  delete(): void;                                // release anchor
}

// Attach app data via a side-channel (spec has no .context property)
anchor.userData = { object3D: myMesh, id: 'chair-1' };
```

## Three.js Integration with RATK

RATK wraps the raw anchor API — use it unless you need low-level control:

```js
import { RealityAccelerator } from 'ratk';
const ratk = new RealityAccelerator(renderer.xr);

// Create anchor (position + quaternion in world space)
const anchor = await ratk.createAnchor(
  new THREE.Vector3(1, 0, -2),
  new THREE.Quaternion(),
  false, // persistent?
);
anchor.add(new THREE.Mesh(geometry, material));

// Make persistent
await anchor.makePersistent();
console.log(anchor.anchorID); // UUID

// Restore across sessions
await ratk.restorePersistentAnchors();
ratk.anchors.forEach((anchor) => {
  attachContentToAnchor(anchor, anchor.anchorID);
});

// Delete
await ratk.deleteAnchor(anchor);
```

For RATK hit-testing:

```js
// From right controller
const hitTarget = await ratk.createHitTestTargetFromControllerSpace('right');
hitTarget.add(reticle); // reticle moves to hit point automatically

// hitTarget.hitTestResultValid — true when pointing at a surface
// hitTarget.hitTestResults     — XRHitTestResult[]
```

## Quest-Specific Gotchas

**`requestPersistentHandle()` throws `NotSupportedError`** if the session was not started with the `'anchors'` feature. Always list `'anchors'` in `requiredFeatures` or `optionalFeatures`.

**`frame.trackedAnchors` may be `undefined`** (not an empty Set) when the API is not supported. Always check: `if (frame.trackedAnchors) { ... }`.

**Anchor positions drift if the room mapping changes.** If the user moves to a new location or room boundaries change, persistent anchors may appear in incorrect positions. Handle `anchorPose === null` gracefully.

**Cancel hit test source on session end.** Failing to call `hitTestSource.cancel()` causes a resource leak. Use the `session.addEventListener('end', ...)` pattern consistently.

**`createAnchor` is async inside a synchronous frame.** The `Promise<XRAnchor>` resolves asynchronously — you cannot use the anchor in the same frame. Attach your content in `.then()`.

**`anchor.delete()` is synchronous** and removes the anchor immediately from `frame.trackedAnchors` in the next frame.

## Common Patterns

### Placement Reticle + Anchor on Select

```js
// Reticle mesh (ring on the floor)
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.05, 0.08, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
);
reticle.rotation.x = -Math.PI / 2;
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// Per frame
const results = frame.getHitTestResults(hitTestSource);
if (results.length > 0) {
  const pose = results[0].getPose(refSpace);
  if (pose) {
    reticle.visible = true;
    reticle.matrix.fromArray(pose.transform.matrix);
  }
} else {
  reticle.visible = false;
}

// On select
session.addEventListener('select', async (event) => {
  if (!reticle.visible) return;
  const results = frame.getHitTestResults(hitTestSource);
  if (results.length > 0) {
    const anchor = await results[0].createAnchor();
    const object = createMyObject();
    object.matrixAutoUpdate = false;
    anchor.userData = { object3D: object };
    scene.add(object);
  }
});
```

## See Also

- `webxr-session` — `'hit-test'`, `'anchors'` feature flags
- `webxr-rendering` — `frame.getPose()`, `XRFrame` usage
- `webxr-passthrough` — AR session for surface detection
- `webxr-ratk` — `ratk.createAnchor()`, `ratk.createHitTestTargetFromControllerSpace()`
