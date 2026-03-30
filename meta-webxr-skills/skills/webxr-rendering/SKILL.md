---
name: webxr-rendering
description: WebXR render loop, reference spaces, XRFrame, XRView, framebuffer, Three.js WebXRManager. Use when setting up the XR animation loop, working with stereo views, reference spaces, or integrating Three.js with WebXR.
---

# WebXR Rendering

## Quick Start

```js
// Raw WebGL render loop
function onXRFrame(timestamp, frame) {
  const session = frame.session;
  session.requestAnimationFrame(onXRFrame);  // schedule next frame first

  const pose = frame.getViewerPose(xrRefSpace);
  if (!pose) return;

  const glLayer = session.renderState.baseLayer;
  gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (const view of pose.views) {
    const viewport = glLayer.getViewport(view);
    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    drawScene(view.projectionMatrix, view.transform.inverse.matrix);
  }
}

// Three.js — just enable XR; Three handles the rest
renderer.xr.enabled = true;
renderer.setAnimationLoop(function (timestamp, frame) {
  ratk?.update();        // RATK must be inside XR loop
  renderer.render(scene, camera);
});
```

## Core API

### XRFrame

```js
// Callback signature: (DOMHighResTimeStamp, XRFrame)
session.requestAnimationFrame((timestamp, frame) => {
  // frame is only valid within this callback — do not store it
  const session = frame.session;

  // Viewer pose
  const pose = frame.getViewerPose(refSpace);   // XRViewerPose | null

  // Arbitrary space pose
  const inputPose = frame.getPose(inputSource.targetRaySpace, refSpace); // XRPose | null

  // AR/MR features
  const hitResults = frame.getHitTestResults(hitTestSource); // XRHitTestResult[]
  const planes     = frame.detectedPlanes;   // XRPlaneSet | undefined
  const meshes     = frame.detectedMeshes;   // XRMeshSet | undefined
  const anchors    = frame.trackedAnchors;   // XRAnchorSet | undefined
});
```

### Reference Spaces

| Type | Origin | Quest VR | Quest AR |
|------|--------|----------|----------|
| `'viewer'` | Head/camera | Yes | Yes |
| `'local'` | Session start position | Yes | Yes |
| `'local-floor'` | Floor below head at start | Yes | Yes |
| `'bounded-floor'` | Guardian boundary center | Yes | Yes |
| `'unbounded'` | World-scale (GPS-level) | **No** | Limited |

```js
// Request during session setup (returns Promise)
const refSpace = await session.requestReferenceSpace('local-floor');

// Offset a reference space (e.g. teleport)
const teleportedSpace = refSpace.getOffsetReferenceSpace(
  new XRRigidTransform(
    { x: 2, y: 0, z: -3 },    // position offset
    { x: 0, y: 0, z: 0, w: 1 } // quaternion (identity)
  )
);
```

### XRViewerPose

```js
const pose = frame.getViewerPose(refSpace);
if (!pose) return; // tracking lost — skip frame

pose.transform;        // XRRigidTransform — viewer position/orientation
pose.transform.position;    // DOMPointReadOnly {x, y, z, w}
pose.transform.orientation; // DOMPointReadOnly quaternion {x, y, z, w}
pose.transform.matrix;      // Float32Array 4x4 column-major
pose.transform.inverse;     // XRRigidTransform — view matrix

pose.views;           // XRView[] — one per eye (two for stereo VR)
pose.linearVelocity;  // DOMPointReadOnly | null (m/s)
pose.angularVelocity; // DOMPointReadOnly | null (rad/s)
```

### XRView

```js
for (const view of pose.views) {
  view.eye;               // 'left' | 'right' | 'none'
  view.projectionMatrix;  // Float32Array 4x4 — GL projection matrix
  view.transform;         // XRRigidTransform — camera-to-world
  view.transform.inverse.matrix; // world-to-camera (view matrix for GL)
  view.recommendedViewportScale; // null or 0..1 — dynamic foveation hint
}
```

### XRWebGLLayer (classic — no Layers API)

```js
const glLayer = new XRWebGLLayer(session, gl, {
  antialias: true,
  depth: true,
  stencil: false,
  alpha: false,           // true for AR passthrough
  framebufferScaleFactor: 1.0,  // 0.5–2.0; higher = sharper but slower
});
session.updateRenderState({ baseLayer: glLayer });

// Per frame:
gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
// ONE clear covers both eyes — do not clear per-view
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

for (const view of pose.views) {
  const vp = glLayer.getViewport(view);
  gl.viewport(vp.x, vp.y, vp.width, vp.height);
  // render for this eye
}
```

### Fixed Foveation (Quest Performance)

```js
// XRWebGLLayer — set after creation
const glLayer = new XRWebGLLayer(session, gl);
glLayer.fixedFoveation = 1.0;  // 0.0 = off, 1.0 = max (blurry periphery)
session.updateRenderState({ baseLayer: glLayer });

// Three.js WebXRManager
renderer.xr.setFoveation(1);   // same scale, 0–1
```

### Target Frame Rate

```js
// Query supported rates
console.log(session.supportedFrameRates); // Float32Array e.g. [72, 80, 90, 120]

// Request specific rate (async)
await session.updateTargetFrameRate(90);
```

## Three.js WebXRManager

```js
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,          // required for AR passthrough
});
renderer.xr.enabled = true;

// Framebuffer scale (resolution multiplier)
renderer.xr.setFramebufferScaleFactor(1.0);

// Foveation (0 = quality, 1 = performance)
renderer.xr.setFoveation(0);

// Animation loop — replaces window.requestAnimationFrame
renderer.setAnimationLoop((timestamp, frame) => {
  // 'frame' is the current XRFrame when in XR; null otherwise
  // All RATK/WebXR frame work here
  renderer.render(scene, camera);
});

// Access internals
renderer.xr.getSession();          // XRSession | null
renderer.xr.getReferenceSpace();   // XRReferenceSpace
renderer.xr.getFrame();            // XRFrame (inside loop only)
renderer.xr.getCamera();           // THREE.ArrayCamera (XR stereo camera)
renderer.xr.isPresenting;          // boolean

// Session events
renderer.xr.addEventListener('sessionstart', () => { ... });
renderer.xr.addEventListener('sessionend',   () => { ... });
```

### Three.js XR Camera

Inside the XR loop, `renderer.xr.getCamera()` returns an `ArrayCamera` with two sub-cameras:

```js
const xrCamera = renderer.xr.getCamera();

// Sub-cameras (one per eye)
xrCamera.cameras[0]; // left eye — PerspectiveCamera
xrCamera.cameras[1]; // right eye — PerspectiveCamera

// Each sub-camera has:
xrCamera.cameras[0].projectionMatrix; // from XRView.projectionMatrix
xrCamera.cameras[0].matrixWorld;      // from XRView.transform.matrix
xrCamera.cameras[0].viewport;         // THREE.Vector4

// Viewer position (centroid between eyes):
xrCamera.position;     // world position
xrCamera.quaternion;   // world orientation
```

### Renderer Setup for AR/MR

```js
const renderer = new THREE.WebGLRenderer({
  alpha: true,           // REQUIRED — transparent background for passthrough
  antialias: true,
  multiviewStereo: true, // Quest stereo optimization (reduces draw calls)
});
renderer.setClearColor(0x000000, 0); // transparent clear
scene.background = null;             // no skybox — passthrough shows through
```

## Quest-Specific Gotchas

**Use `session.requestAnimationFrame`, not `window.requestAnimationFrame`.** The XR loop runs at the headset's display rate (72–120Hz on Quest). `window.requestAnimationFrame` is decoupled from the XR compositor and will cause judder.

**Do not clear per-eye.** With `XRWebGLLayer`, bind the framebuffer once and clear once before iterating views. Clearing inside the view loop overwrites the first eye.

**`XRFrame` is ephemeral.** The frame object passed to `requestAnimationFrame` is only valid synchronously within that callback. Do not store it or use it in async callbacks.

**`local-floor` for standing experiences.** Request `local-floor` (not `local`) so the origin is at floor level. Quest will prompt for floor calibration if not already set.

**`unbounded` not supported in Quest VR.** Only use it for AR sessions, and list it as `optionalFeatures`, never `requiredFeatures`.

## Common Patterns

### Smooth delta time

```js
let lastTimestamp = 0;

function onXRFrame(timestamp, frame) {
  const delta = (timestamp - lastTimestamp) / 1000; // seconds
  lastTimestamp = timestamp;
  session.requestAnimationFrame(onXRFrame);
  // use delta for physics, animation
}
```

### Headset position in Three.js

```js
renderer.setAnimationLoop((timestamp, frame) => {
  if (frame) {
    const pose = frame.getViewerPose(renderer.xr.getReferenceSpace());
    if (pose) {
      const p = pose.transform.position;
      // p.x, p.y, p.z — head position in reference space
    }
  }
  renderer.render(scene, camera);
});
```

## See Also

- `webxr-session` — session setup, feature flags
- `webxr-input` — input sources per frame
- `webxr-passthrough` — AR transparent renderer setup
- `webxr-layers` — `XRWebGLBinding` and layer types
- `webxr-ratk` — `ratk.update()` placement in loop
