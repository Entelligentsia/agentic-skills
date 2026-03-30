---
name: webxr-session
description: WebXR session lifecycle on Meta Quest — requestSession, session modes, feature flags, session events, cleanup. Use when starting/ending XR sessions, checking device support, or requesting WebXR features.
---

# WebXR Session Lifecycle

## Quick Start

```js
// 1. Check support
const supported = await navigator.xr.isSessionSupported('immersive-vr');
if (!supported) return;

// 2. Request session SYNCHRONOUSLY inside a user gesture
button.addEventListener('click', () => {
  navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking', 'hit-test', 'anchors'],
  }).then(onSessionStarted);
});

// 3. Start session
async function onSessionStarted(session) {
  session.addEventListener('end', onSessionEnded);

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { xrCompatible: true });
  await gl.makeXRCompatible();

  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  });

  const refSpace = await session.requestReferenceSpace('local-floor');
  session.requestAnimationFrame(onXRFrame);
}

// 4. Clean up
function onSessionEnded() {
  xrSession = null;
}
```

## Core API

### Check Support

```js
// Returns Promise<boolean>
navigator.xr.isSessionSupported('immersive-vr').then((supported) => { ... });
navigator.xr.isSessionSupported('immersive-ar').then((supported) => { ... });

// Detect device change (hotplug)
navigator.xr.addEventListener('devicechange', checkSupportedState);

// Security: WebXR requires a secure context
if (!window.isSecureContext) { /* WebXR unavailable */ }
```

### Session Modes

| Mode | Description | Quest Support |
|------|-------------|---------------|
| `'immersive-vr'` | Full VR — opaque display | Yes |
| `'immersive-ar'` | AR/MR — passthrough (alpha-blend) | Quest 2+ (grayscale), Quest Pro (color) |
| `'inline'` | Non-immersive in-page preview | Yes |

### requestSession

```js
navigator.xr.requestSession(mode, {
  requiredFeatures: string[],   // session fails if any unsupported
  optionalFeatures: string[],   // silently ignored if unsupported
  domOverlay: { root: HTMLElement },  // for 'immersive-ar' + 'dom-overlay'
})
```

### Feature Strings

| Feature | Description | Required by |
|---------|-------------|-------------|
| `'local'` | Session-origin reference space | — |
| `'local-floor'` | Floor-level reference space | Standing VR experiences |
| `'bounded-floor'` | Guardian boundary space | Room-scale |
| `'hand-tracking'` | `XRHand` joint data | Hand interaction |
| `'hit-test'` | `frame.getHitTestResults()` | Object placement |
| `'anchors'` | `frame.createAnchor()` | Persistent objects |
| `'plane-detection'` | `frame.detectedPlanes` | Room understanding |
| `'mesh-detection'` | `frame.detectedMeshes` | Room geometry |
| `'depth-sensing'` | `XRDepthInformation` | Occlusion |
| `'layers'` | `XRWebGLBinding` layer types | Quad/Cylinder/Cube layers |
| `'dom-overlay'` | HTML overlay on AR | AR UI panels |

### Session Events

```js
session.addEventListener('end', (event) => { /* session ended */ });
session.addEventListener('visibilitychange', (event) => {
  // event.session.visibilityState: 'visible' | 'visible-blurred' | 'hidden'
  // 'visible-blurred' = system overlay active (e.g. Quest menu)
});
session.addEventListener('inputsourceschange', (event) => {
  event.added;    // XRInputSource[] newly connected
  event.removed;  // XRInputSource[] disconnected
});

// Input events on the session object (not on input sources)
session.addEventListener('selectstart', onSelectStart);
session.addEventListener('select',      onSelect);       // primary action
session.addEventListener('selectend',   onSelectEnd);
session.addEventListener('squeezestart', onSqueezeStart);
session.addEventListener('squeeze',      onSqueeze);     // grip action
session.addEventListener('squeezeend',   onSqueezeEnd);
// event.inputSource — which XRInputSource triggered it
// event.frame — current XRFrame (use to get poses)
```

### updateRenderState

```js
session.updateRenderState({
  baseLayer: new XRWebGLLayer(session, gl),   // mutually exclusive with 'layers'
  depthFar: 1000,
  depthNear: 0.1,
  inlineVerticalFieldOfView: Math.PI / 2,     // inline sessions only
});

// When using the Layers API instead of baseLayer:
session.updateRenderState({
  layers: [projLayer, quadLayer],  // back to front; requires 'layers' feature
});
```

### Ending a Session

```js
// Programmatic end
session.end();   // triggers 'end' event

// Always clean up hit test sources before ending
xrHitTestSource?.cancel();
xrHitTestSource = null;
```

### Three.js Integration

```js
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
// Or use RATK's ARButton/VRButton for Quest-specific feature requests

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.xr.enabled = true;

document.body.appendChild(VRButton.createButton(renderer));
// Or manually:
document.body.appendChild(ARButton.createButton(renderer, {
  requiredFeatures: ['hit-test', 'plane-detection'],
  optionalFeatures: ['anchors', 'layers'],
}));

renderer.xr.addEventListener('sessionstart', () => { /* session active */ });
renderer.xr.addEventListener('sessionend',   () => { /* session ended */ });

// Access current session
const session = renderer.xr.getSession();
```

## Quest-Specific Gotchas

**requestSession timing is critical.** Quest Browser enforces that `requestSession` must be called synchronously within a user gesture handler. Even a microtask gap breaks it:

```js
// WRONG — async gap causes Quest Browser to block the request
button.addEventListener('click', async () => {
  await someSetup();
  navigator.xr.requestSession('immersive-vr', ...);  // BLOCKED on Quest
});

// WRONG — promise chain gap
button.addEventListener('click', () => {
  Promise.resolve().then(() => {
    navigator.xr.requestSession('immersive-vr', ...);  // BLOCKED on Quest
  });
});

// CORRECT — synchronous call in the gesture handler
button.addEventListener('click', () => {
  navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
  }).then(onSessionStarted);
});
```

**`sessiongranted` event.** When a user launches a PWA directly into XR from the Horizon OS shell, `navigator.xr` fires `sessiongranted` before any user gesture. RATK's `VRButton` handles this automatically.

```js
navigator.xr.addEventListener('sessiongranted', () => {
  // Session was pre-granted by the OS — call requestSession immediately
  navigator.xr.requestSession('immersive-vr', sessionInit).then(onSessionStarted);
});
```

**WebGL context must be `xrCompatible`.** Either pass `{ xrCompatible: true }` to `getContext()` or call `gl.makeXRCompatible()` before creating `XRWebGLLayer`.

## Common Patterns

### Feature Detection Before Request

```js
async function startXR() {
  const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
  const arSupported = await navigator.xr.isSessionSupported('immersive-ar');

  // Prefer AR if available
  const mode = arSupported ? 'immersive-ar' : 'immersive-vr';
  const features = arSupported
    ? { requiredFeatures: ['local-floor', 'hit-test'], optionalFeatures: ['plane-detection', 'anchors'] }
    : { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] };

  return navigator.xr.requestSession(mode, features);
}
```

### Session State Guard

```js
let xrSession = null;

button.addEventListener('click', () => {
  if (xrSession) {
    xrSession.end();
  } else {
    navigator.xr.requestSession('immersive-vr', sessionInit)
      .then((session) => {
        xrSession = session;
        session.addEventListener('end', () => { xrSession = null; });
        onSessionStarted(session);
      });
  }
});
```

## See Also

- `webxr-rendering` — XR frame loop, reference spaces, XRFrame
- `webxr-input` — input sources, controllers, hand tracking
- `webxr-pwa-quest` — PWA manifest for launching directly into XR
- `webxr-ratk` — `ARButton`/`VRButton` with Quest feature presets
