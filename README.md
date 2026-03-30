# Agentic Skills

Skill packs for Claude Code and other LLM agent systems, published by [Entelligentsia](https://github.com/Entelligentsia).

## Available Packages

| Package | Type | Description |
|---------|------|-------------|
| [forge](./forge/) | Meta-generator | Self-enhancing AI software development lifecycle — scans your codebase, generates project-specific workflows, personas, templates, and tools |
| [meta-webxr-skills](./meta-webxr-skills/) | Reference skills | Meta Quest PWA XR engineering (8 skills) |
| [threejs-skills](./threejs-skills/) | Reference skills | Three.js 3D development (10 skills) |

## Installation (Claude Code)

```bash
/plugin marketplace add Entelligentsia/agentic-skills
/plugin install forge@agentic-skills
/plugin install meta-webxr-skills@agentic-skills
/plugin install threejs-skills@agentic-skills
```

## Forge

Forge is different from the reference skill packages. Instead of loading knowledge into context, it **generates** a complete project-specific engineering practice: agent personas, workflows, templates, review checklists, and tools — all tailored to your stack.

```bash
/forge init          # Bootstrap SDLC into your project
/sprint-plan         # Start your first sprint (generated command)
/engineer ACME-S01-T01   # Plan a task (generated command)
```

See [forge/README.md](./forge/README.md) for the full vision and design.

## Skills Index

### meta-webxr-skills

| Skill | Trigger |
|-------|---------|
| `webxr-session` | WebXR session lifecycle, requestSession, feature flags |
| `webxr-rendering` | XR render loop, reference spaces, frame timing |
| `webxr-input` | Controller input, hand tracking, hit testing |
| `webxr-passthrough` | AR/MR passthrough, plane/mesh detection |
| `webxr-anchors` | Persistent spatial anchors |
| `webxr-layers` | WebXR Layers API, compositing |
| `webxr-ratk` | Reality Accelerator Toolkit (Three.js wrapper) |
| `webxr-pwa-quest` | PWA manifest, service worker, Meta Quest packaging |

### threejs-skills

| Skill | Trigger |
|-------|---------|
| `threejs-fundamentals` | Scene setup, cameras, renderer, Object3D hierarchy |
| `threejs-geometry` | Built-in shapes, BufferGeometry, custom geometry, instancing |
| `threejs-materials` | PBR materials, shader materials, material properties |
| `threejs-lighting` | Light types, shadows, environment lighting |
| `threejs-textures` | Texture types, UV mapping, environment maps |
| `threejs-animation` | Keyframe animation, skeletal animation, morph targets |
| `threejs-loaders` | GLTF loading, texture loading, async patterns |
| `threejs-shaders` | GLSL, ShaderMaterial, uniforms, custom effects |
| `threejs-postprocessing` | EffectComposer, bloom, DOF, screen effects |
| `threejs-interaction` | Raycasting, controls, mouse/touch input, object selection |

## Acknowledgements

- `threejs-skills` originally sourced from [pinkforest/threejs-playground](https://github.com/pinkforest/threejs-playground) (MIT)
