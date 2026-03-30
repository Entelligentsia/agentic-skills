# Agentic Skills

Skill packs for Claude Code and other LLM agent systems, published by [Entelligentsia](https://github.com/Entelligentsia).

## Available Skills

| Package | Description | Skills |
|---------|-------------|--------|
| [meta-webxr-skills](./meta-webxr-skills/) | Meta Quest PWA XR engineering | 8 skills |

## Installation (Claude Code)

```bash
/plugin marketplace add Entelligentsia/agentic-skills
/plugin install meta-webxr-skills@agentic-skills
```

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
