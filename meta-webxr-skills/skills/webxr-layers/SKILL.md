---
name: webxr-layers
description: WebXR Layers API — XRWebGLBinding, Projection, Quad, Cylinder, Cube, and Equirect layers on Meta Quest. Use when adding compositor-native UI panels, 360 backgrounds, or curved screens in WebXR, or when sharp text/image quality is needed without reprojection distortion.
---

# WebXR Layers API

## Why Use Layers

| Concern | XRWebGLLayer (classic) | WebXR Layers |
|---------|------------------------|--------------|
| Quality | Virtual content is reprojected by compositor | Layers composited natively — no reprojection distortion |
| Text sharpness | Blurry (reprojection artifact) | Sharp — compositor samples texture directly |
| 360 content | Rendered in 3D scene (reprojected) | Equirect layer: perfect quality |
| UI panels | Rendered in scene (distortion at edges) | Quad layer: flat, undistorted |
| Static content | Re-rendered every frame | `isStatic: true` — only redrawn on `needsRedraw` |
| Latency | Reprojected after render | Composited at display time — lower latency |

## Quick Start — Projection + Quad Layer

```js
// Requires WebGL2 and 'layers' feature
navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['layers'],
}).then(async (session) => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { xrCompatible: true });

  const xrBinding = new XRWebGLBinding(session, gl);
  const refSpace  = await session.requestReferenceSpace('local-floor');

  // Projection layer (main 3D scene)
  const projLayer = xrBinding.createProjectionLayer({
    textureType: 'texture',
    space: refSpace,
    stencil: false,
  });

  // Quad layer (UI panel — sharp text)
  const quadLayer = xrBinding.createQuadLayer({
    space: refSpace,
    viewPixelWidth:  512,
    viewPixelHeight: 256,
    layout: 'mono',
  });
  quadLayer.width     = 1.0;   // 1 metre wide
  quadLayer.height    = 0.5;   // 0.5 metres tall
  quadLayer.transform = new XRRigidTransform(
    { x: 0, y: 1.5, z: -1.5 },  // 1.5m in front, eye height
    { x: 0, y: 0, z: 0, w: 1 },
  );

  // Stack layers: back to front
  session.updateRenderState({ layers: [quadLayer, projLayer] });

  session.requestAnimationFrame(onXRFrame);

  function onXRFrame(time, frame) {
    session.requestAnimationFrame(onXRFrame);

    // Draw quad layer texture when needed
    if (quadLayer.needsRedraw) {
      const subImg = xrBinding.getSubImage(quadLayer, frame);
      gl.bindTexture(gl.TEXTURE_2D, subImg.colorTexture);
      drawUIToTexture(gl, subImg);
    }

    // Draw 3D scene to projection layer
    const pose = frame.getViewerPose(refSpace);
    if (pose) {
      for (const view of pose.views) {
        const subImg  = xrBinding.getViewSubImage(projLayer, view);
        const vp      = subImg.viewport;
        gl.bindFramebuffer(gl.FRAMEBUFFER, xrFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, subImg.colorTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,  gl.TEXTURE_2D, subImg.depthStencilTexture, 0);
        gl.viewport(vp.x, vp.y, vp.width, vp.height);
        drawScene(view);
      }
    }
  }
});
```

## XRWebGLBinding

Replaces `XRWebGLLayer` when using the Layers API. Requires **WebGL2**.

```js
// Create after session start, before requestAnimationFrame
const xrBinding = new XRWebGLBinding(session, gl);
// gl must be WebGL2: canvas.getContext('webgl2', { xrCompatible: true })
```

## Layer Types

### XRProjectionLayer — Main 3D Scene

```js
const projLayer = xrBinding.createProjectionLayer({
  textureType: 'texture',         // 'texture' | 'texture-array' (multiview)
  colorFormat: gl.RGBA8,          // optional
  depthFormat: gl.DEPTH_COMPONENT24, // optional
  scaleFactor: 1.0,               // resolution multiplier
  space: refSpace,
  stencil: false,
  alpha: false,                   // true for AR
});

// Per-view rendering (manual framebuffer setup)
for (const view of pose.views) {
  const subImg = xrBinding.getViewSubImage(projLayer, view);
  // subImg.colorTexture        — WebGLTexture
  // subImg.depthStencilTexture — WebGLTexture
  // subImg.viewport            — { x, y, width, height }

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, subImg.colorTexture, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,  gl.TEXTURE_2D, subImg.depthStencilTexture, 0);
  gl.viewport(subImg.viewport.x, subImg.viewport.y, subImg.viewport.width, subImg.viewport.height);
}
```

### XRQuadLayer — Flat Rectangular Panel

Best for: UI panels, images, video, sharp text.

```js
const quadLayer = xrBinding.createQuadLayer({
  space: refSpace,
  viewPixelWidth: 1024,   // texture resolution
  viewPixelHeight: 512,
  layout: 'mono',         // 'mono' | 'stereo' | 'stereo-top-bottom' | 'stereo-left-right'
  isStatic: false,        // true = only redraw on needsRedraw (for static images)
});

// Physical dimensions and world position
quadLayer.width     = 2.0;   // metres
quadLayer.height    = 1.0;
quadLayer.transform = new XRRigidTransform(position, orientation);

// Write texture
if (quadLayer.needsRedraw) {
  const subImg = xrBinding.getSubImage(quadLayer, frame);
  // For 'mono' layout — no eye parameter
  gl.bindTexture(gl.TEXTURE_2D, subImg.colorTexture);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageSource);

  // Or use a canvas:
  const imgData = canvasCtx.getImageData(0, 0, 1024, 512);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 512, gl.RGBA, gl.UNSIGNED_BYTE, imgData.data);
}
```

### XRCylinderLayer — Curved Panel

Best for: wide panoramic UI, curved screens.

```js
const cylLayer = xrBinding.createCylinderLayer({
  space: refSpace,
  viewPixelWidth: 2048,
  viewPixelHeight: 1024,
  layout: 'mono',
});

cylLayer.centralAngle = Math.PI / 2;  // radians — arc width
cylLayer.aspectRatio  = 2.0;          // width/height
cylLayer.radius       = 2.0;          // metres from viewer
cylLayer.transform    = new XRRigidTransform({ x: 0, y: 1.5, z: 0 }, { x:0,y:0,z:0,w:1 });
```

### XREquirectLayer — 360° Background

Best for: 360 photos, 360 video, skyboxes.

```js
const equirectLayer = xrBinding.createEquirectLayer({
  space: refSpace,
  viewPixelWidth:  4096,
  viewPixelHeight: 2048,
  layout: 'mono',         // or 'stereo-top-bottom' for stereoscopic 360
  isStatic: true,         // 360 photos don't change
});

// Write once (isStatic → needsRedraw fires once)
if (equirectLayer.needsRedraw) {
  const subImg = xrBinding.getSubImage(equirectLayer, frame);
  gl.bindTexture(gl.TEXTURE_2D, subImg.colorTexture);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, panoImage);
}
```

### XRCubeLayer — Cubemap Background

Best for: HDR environment maps, static skyboxes.

```js
const cubeLayer = xrBinding.createCubeLayer({
  space: refSpace,
  viewPixelWidth:  1024,  // size per face
  viewPixelHeight: 1024,
  layout: 'mono',
  isStatic: true,
});

if (cubeLayer.needsRedraw) {
  // Write each of 6 faces
  for (const eye of ['none']) { // 'none' for mono, or iterate left/right for stereo
    const subImg = xrBinding.getSubImage(cubeLayer, frame); // no eye for mono
    copyCubeFacesToTexture(gl, subImg.colorTexture);
  }
}
```

## Layer Stack (Compositing Order)

```js
// Layers are drawn back-to-front — index 0 = background
session.updateRenderState({
  layers: [
    equirectLayer,  // 0: 360 background (furthest back)
    projLayer,      // 1: 3D scene
    quadLayer,      // 2: UI panel (on top of everything)
  ],
});

// Update the stack dynamically
session.updateRenderState({ layers: [projLayer] }); // remove quad layer
```

## Quest Layer Support

| Layer Type | Quest 2 | Quest Pro | Quest 3 |
|------------|---------|-----------|---------|
| Projection | Yes | Yes | Yes |
| Quad | Yes | Yes | Yes |
| Cylinder | Yes | Yes | Yes |
| Equirect | Yes | Yes | Yes |
| Cube | Yes | Yes | Yes |
| Depth | Limited | Yes | Yes |

## getSubImage vs getViewSubImage

```js
// For non-projection layers (Quad, Cylinder, Equirect, Cube)
const subImg = xrBinding.getSubImage(layer, frame);
const subImg = xrBinding.getSubImage(layer, frame, 'left');  // stereo

// For projection layer (one call per XRView)
for (const view of pose.views) {
  const subImg = xrBinding.getViewSubImage(projLayer, view);
}

// Both return XRWebGLSubImage:
subImg.colorTexture;         // WebGLTexture
subImg.depthStencilTexture;  // WebGLTexture | null
subImg.viewport;             // XRViewport {x, y, width, height}
subImg.imageIndex;           // for texture-array
```

## Quest-Specific Gotchas

**WebGL2 is required.** `XRWebGLBinding` only works with a WebGL2 rendering context. Get it with `canvas.getContext('webgl2', { xrCompatible: true })`.

**`layers` and `baseLayer` are mutually exclusive.** Setting `session.updateRenderState({ layers: [...] })` and `baseLayer` at the same time throws. Use one or the other.

**Projection layer needs no `layers` feature if used alone.** A single `XRProjectionLayer` can be used without requesting `'layers'` in the session. All other layer types require `'layers'` in `requiredFeatures`.

**`needsRedraw` is the draw signal.** For `isStatic` layers, `needsRedraw` is true on creation and whenever the layer needs to be redrawn (e.g. texture lost). Do not write to layer textures every frame unless the content changes.

**Three.js has no built-in Layers API support.** Using `XRWebGLBinding` with Three.js requires managing the framebuffer and textures manually for each layer. The projection layer must match Three.js's internal framebuffer setup exactly — either render to a texture manually or use a helper library.

**Quad layer position is in reference space.** Set `quadLayer.transform` after creation; it must be an `XRRigidTransform` relative to the layer's `space` (the `space` passed to `createQuadLayer`).

## Common Patterns

### Sharp Text UI with Canvas 2D → Quad Layer

```js
// Create canvas for UI rendering
const uiCanvas = document.createElement('canvas');
uiCanvas.width  = 1024;
uiCanvas.height = 256;
const ctx = uiCanvas.getContext('2d');

function renderUI(text) {
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.roundRect(0, 0, 1024, 256, 20);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = '48px Arial';
  ctx.fillText(text, 40, 140);
}

// Write to quad layer texture
if (quadLayer.needsRedraw) {
  renderUI('Score: 42');
  const subImg = xrBinding.getSubImage(quadLayer, frame);
  gl.bindTexture(gl.TEXTURE_2D, subImg.colorTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, uiCanvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}
```

## See Also

- `webxr-session` — `'layers'` feature flag
- `webxr-rendering` — classic `XRWebGLLayer` (without Layers API)
- `webxr-ratk` — `ARButton` with optional `'layers'` feature
