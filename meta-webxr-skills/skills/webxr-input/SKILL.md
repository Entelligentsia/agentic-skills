---
name: webxr-input
description: WebXR input sources on Meta Quest — controllers, hand tracking, input poses, gamepad buttons/axes, select/squeeze events, Three.js XRControllerModelFactory. Use when handling controller input, hand tracking, raycasting from controllers, or rendering controller models.
---

# WebXR Input

## Quick Start

```js
// Three.js — connect controllers
const controller0 = renderer.xr.getController(0);
const controller1 = renderer.xr.getController(1);
scene.add(controller0, controller1);

controller0.addEventListener('selectstart', onSelectStart);
controller0.addEventListener('selectend',   onSelectEnd);

// Per-frame: iterate input sources
renderer.setAnimationLoop((timestamp, frame) => {
  if (frame) {
    const session = renderer.xr.getSession();
    for (const source of session.inputSources) {
      processInput(source, frame);
    }
  }
  renderer.render(scene, camera);
});
```

## Core API

### XRInputSource Properties

```js
// Available on each source in session.inputSources
inputSource.handedness;     // 'left' | 'right' | 'none'
inputSource.targetRayMode;  // 'tracked-pointer' | 'gaze' | 'screen'
inputSource.targetRaySpace; // XRSpace — pointing ray origin+direction
inputSource.gripSpace;      // XRSpace | null — controller body orientation
inputSource.profiles;       // string[] — controller type IDs, most specific first
                            //   Quest 3: ['meta-quest-touch-plus', 'generic-trigger-squeeze-touchpad-thumbstick']
                            //   Quest 2: ['oculus-touch-v3', 'generic-trigger-squeeze-touchpad-thumbstick']
inputSource.gamepad;        // Gamepad | null — button/axis state
inputSource.hand;           // XRHand | null — only when hand tracking active
```

### Getting Poses Per Frame

```js
function processInput(source, frame) {
  const refSpace = renderer.xr.getReferenceSpace();

  // Target ray (pointing direction)
  const rayPose = frame.getPose(source.targetRaySpace, refSpace);
  if (rayPose) {
    // rayPose.transform.matrix — ray origin + direction in reference space
    // Use for raycasting / laser pointer
  }

  // Grip (controller body)
  if (source.gripSpace) {
    const gripPose = frame.getPose(source.gripSpace, refSpace);
    if (gripPose) {
      // gripPose.transform.matrix — controller held orientation
      // Attach controller model here
    }
  }
}
```

### Session Input Events

```js
// These fire on the XRSession object
session.addEventListener('selectstart', (event) => {
  const source = event.inputSource; // which controller/hand
  const frame  = event.frame;       // current XRFrame — get poses here
});
session.addEventListener('select',      handler); // trigger released after press
session.addEventListener('selectend',   handler); // trigger released

session.addEventListener('squeezestart', handler); // grip pressed
session.addEventListener('squeeze',      handler); // grip released
session.addEventListener('squeezeend',   handler); // grip released

// 'select' = primary button (trigger finger)
// 'squeeze' = grip button (middle finger)
```

### Gamepad (Raw Button/Axis Access)

```js
// Quest Touch controller button layout (Gamepad API)
const gp = inputSource.gamepad;
gp.buttons[0].pressed; // trigger (index finger)
gp.buttons[1].pressed; // grip
gp.buttons[3].pressed; // thumbstick press
gp.buttons[4].pressed; // A (right) / X (left)
gp.buttons[5].pressed; // B (right) / Y (left)

gp.buttons[0].value;   // trigger analog value 0.0–1.0
gp.buttons[1].value;   // grip analog value 0.0–1.0

gp.axes[0]; // thumbstick X (-1 left, +1 right)
gp.axes[1]; // thumbstick Y (-1 up, +1 down)

// Using gamepad-wrapper (from meta-quest/webxr-first-steps)
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';
const gpw = new GamepadWrapper(inputSource.gamepad);

gpw.getButtonClick(XR_BUTTONS.TRIGGER);   // true on press-down edge (one frame)
gpw.getButton(XR_BUTTONS.TRIGGER);        // true while held
gpw.getButtonValue(XR_BUTTONS.TRIGGER);   // 0.0–1.0 analog
gpw.getAxis(XR_BUTTONS.THUMBSTICK_X);     // -1 to +1
gpw.getHapticActuator(0).pulse(0.5, 100); // intensity, duration ms
```

### Hand Tracking

```js
// XRHand — available on inputSource.hand when hand tracking active
// Always null-check before using
if (inputSource.hand) {
  // 25 joints per hand
  for (const [jointName, jointSpace] of inputSource.hand) {
    const jointPose = frame.getJointPose(jointSpace, refSpace);
    if (jointPose) {
      jointPose.transform.position;  // joint position
      jointPose.transform.orientation; // joint orientation
      jointPose.radius;               // joint sphere radius (m)
    }
  }
}

// Joint names (XRHandJoint enum)
const joints = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];
```

### inputsourceschange Event

```js
session.addEventListener('inputsourceschange', (event) => {
  for (const source of event.added) {
    // New controller connected or hand detected
    setupInputSource(source);
  }
  for (const source of event.removed) {
    // Controller disconnected or hand lost
    teardownInputSource(source);
  }
});
```

## Three.js Integration

### Controller Setup

```js
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory }       from 'three/addons/webxr/XRHandModelFactory.js';

const controllerModelFactory = new XRControllerModelFactory();
const handModelFactory = new XRHandModelFactory();

for (let i = 0; i < 2; i++) {
  // Target ray space (for raycasting / laser pointer)
  const controller = renderer.xr.getController(i);
  scene.add(controller);

  // Grip space (for controller model attachment)
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  // Hand tracking
  const hand = renderer.xr.getHand(i);
  hand.add(handModelFactory.createHandModel(hand));
  scene.add(hand);

  // Events on the controller (target ray space)
  controller.addEventListener('selectstart', onSelectStart);
  controller.addEventListener('selectend',   onSelectEnd);
  controller.addEventListener('squeezestart', onSqueezeStart);
  controller.addEventListener('squeezeend',   onSqueezeEnd);

  // Connection metadata
  controller.addEventListener('connected', (event) => {
    controller.userData.inputSource = event.data; // XRInputSource
  });
  controller.addEventListener('disconnected', () => {
    controller.userData.inputSource = null;
  });
}
```

### Laser Pointer / Raycasting from Controller

```js
import * as THREE from 'three';

// Build a simple laser line
const geometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1),
]);
const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
line.scale.z = 5; // 5 metres

controller.add(line);

// Raycast against scene objects
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

function getIntersections(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  return raycaster.intersectObjects(interactables, true);
}
```

### Haptic Feedback

```js
// Via Three.js XRInputSource
function vibrate(controller, intensity = 0.5, duration = 100) {
  const source = controller.userData.inputSource;
  if (source?.gamepad?.hapticActuators?.length > 0) {
    source.gamepad.hapticActuators[0].pulse(intensity, duration);
  }
}

// Via gamepad-wrapper
gpWrapper.getHapticActuator(0).pulse(0.6, 100);
```

## Quest-Specific Gotchas

**`inputSource.hand` is null when hands not visible.** Quest switches between controller and hand tracking automatically. Always check `inputSource.hand !== null` before iterating joints — hands disappear when occluded.

**`inputSource.gamepad` snapshot.** The `Gamepad` object is a live snapshot — its `buttons` and `axes` arrays reflect state at the time of the last `requestAnimationFrame`. Only read it inside the XR frame callback.

**Controller profiles.** `inputSource.profiles[0]` gives the most specific profile string:
- Quest 3 Touch Plus: `'meta-quest-touch-plus'`
- Quest 2 Touch: `'oculus-touch-v3'`
- Quest Pro Touch Pro: `'meta-quest-touch-pro'`

**`select` fires on trigger release** (not press). Use `selectstart` for immediate response; `select` for confirmed click semantics.

**`targetRayMode: 'screen'`** — appears when using hand tracking on a handheld device (not Quest). On Quest it's always `'tracked-pointer'` for controllers and `'tracked-pointer'` for hands.

## Common Patterns

### Controller State Manager (per-frame with gamepad-wrapper)

```js
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';

const controllers = { left: null, right: null };

session.addEventListener('inputsourceschange', (event) => {
  for (const source of event.added) {
    if (source.handedness !== 'none' && source.gamepad) {
      controllers[source.handedness] = {
        source,
        gamepad: new GamepadWrapper(source.gamepad),
      };
    }
  }
  for (const source of event.removed) {
    controllers[source.handedness] = null;
  }
});

// In XR frame loop:
for (const hand of ['left', 'right']) {
  const ctrl = controllers[hand];
  if (!ctrl) continue;

  if (ctrl.gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
    onTriggerClick(ctrl.source, frame);
  }
  if (ctrl.gamepad.getButton(XR_BUTTONS.GRIP)) {
    onGripHeld(ctrl.source, frame);
  }
}
```

## See Also

- `webxr-session` — `inputsourceschange`, select events on session
- `webxr-rendering` — `frame.getPose()` for input space queries
- `webxr-anchors` — hit-test from input ray space
- `webxr-ratk` — `createHitTestTargetFromControllerSpace()`
