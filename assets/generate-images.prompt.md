# Skillforge Image Generation Agent Prompt

You are an image generation agent working inside the skillforge repository at `/home/boni/src/skillforge`. You have full read access to the repo. Your task is to generate a complete set of banner and thumbnail images, save them to the correct locations, and update README files to reference them.

---

## Visual Style

All images must follow the style established in `/home/boni/src/forge/assets/`. Read those reference images before generating anything. The defining characteristics are:

- **Medium**: Graphite pencil sketch on warm cream/parchment paper (`#F5F0E8` approximate background tone)
- **Technique**: Fine cross-hatching and hatching for shadow and depth; clean, deliberate linework; no fills, no color, no gradients beyond the paper tone
- **Composition**: Single central subject with generous negative space; soft vignette at edges fading into the paper
- **Aesthetic**: Japanese / Zen influences — serenity, restraint, craftsmanship. Subjects are metaphorical and thematic, never literal (no screenshots, no UI, no code text)
- **Mood**: Still, considered, authoritative — like illustrations from a technical treatise

Each image is purely pencil sketch: black graphite on cream, nothing else.

---

## Images to Generate

### 1. Top-level Banner — `skillforge-banner.png`

- **Path**: `/home/boni/src/skillforge/assets/skillforge-banner.png`
- **Size**: 1280 × 400 px
- **Subject**: A Japanese *torii* gate whose pillars are shaped from bundled scrolls and tools. Beyond the gate, smaller torii recede into mist — suggesting a curated path through a marketplace of knowledge. Wide, cinematic composition. The gate dominates the left two-thirds; negative space and mist fill the right.
- **Represents**: The skillforge marketplace — a gateway to curated skill packs

---

### 2. Top-level Social Thumbnail — `skillforge-social.png`

- **Path**: `/home/boni/src/skillforge/assets/skillforge-social.png`
- **Size**: 1280 × 640 px (GitHub social preview ratio)
- **Subject**: Same torii gate concept as the banner but recomposed for a square-ish ratio. The gate is centered. Foreground: a stone path leading to it. Background: scrolls and tools arranged as offerings on either side. Text space intentionally left clear in the lower third.
- **Represents**: GitHub social preview card for `Entelligentsia/skillforge`

---

### 3. security-watchdog Banner — `security-watchdog/assets/banner.png`

- **Path**: `/home/boni/src/skillforge/security-watchdog/assets/banner.png`
- **Size**: 1280 × 400 px
- **Subject**: A *komainu* (stone guardian lion-dog) seated at alert before a shrine gate. Its gaze is direct, watchful. One paw rests on a scroll. Fine detail in the fur and stone texture. The shrine gate behind it is slightly blurred into mist.
- **Represents**: The security watchdog — vigilant, protective, automated guardian of the plugin ecosystem

---

### 4. design-patterns Banner — `design-patterns/assets/banner.png`

- **Path**: `/home/boni/src/skillforge/design-patterns/assets/banner.png`
- **Size**: 1280 × 400 px
- **Subject**: A five-storey *pagoda* rendered with architectural precision. Each storey's eave is slightly different — suggesting layered abstraction. The base is grounded stone; the top dissolves into cloud. Scaffolding lines suggest construction and structure. A single craftsman's compass rests at the base.
- **Represents**: Design patterns — structured, hierarchical, time-tested architectural knowledge (GoF, Fowler, Evans)

---

### 5. llm-patterns Banner — `llm-patterns/assets/banner.png`

- **Path**: `/home/boni/src/skillforge/llm-patterns/assets/banner.png`
- **Size**: 1280 × 400 px
- **Subject**: A wide river with stepping stones crossing it. The water is rendered with flowing, gestural lines suggesting movement and uncertainty. The stepping stones are solid, deliberate, evenly spaced — a safe path across. On the far bank, dense forest. On the near bank, open space.
- **Represents**: LLM patterns — proven stepping stones across the turbulent uncertainty of production AI integration

---

### 6. meta-webxr-skills Banner — `meta-webxr-skills/assets/banner.png`

- **Path**: `/home/boni/src/skillforge/meta-webxr-skills/assets/banner.png`
- **Size**: 1280 × 400 px
- **Subject**: A lone *torii* gate at the edge of a cliff, overlooking a vast, empty horizon of mist and sky. The gate casts a shadow behind it into the physical world, but in front of it the mist suggests infinite, unbounded space. Fine detail on the gate posts; the horizon is minimal hatching fading to nothing.
- **Represents**: WebXR — the threshold between physical and virtual reality; the Meta Quest portal

---

### 7. threejs-skills Banner — `threejs-skills/assets/banner.png`

- **Path**: `/home/boni/src/skillforge/threejs-skills/assets/banner.png`
- **Size**: 1280 × 400 px
- **Subject**: A craftsman's hand holding a fine brush/pen, in the act of drawing. From the tip of the pen, geometric wireframe forms emerge and lift off the paper — a sphere, a cube, a torus — rendered in the same pencil style but with the suggestion of dimensionality through careful hatching. The hand is detailed; the background is minimal.
- **Represents**: Three.js — the act of conjuring 3D geometry through code and craft

---

## File System Operations

Before generating, create the assets directories that do not yet exist:

```
/home/boni/src/skillforge/assets/
/home/boni/src/skillforge/security-watchdog/assets/
/home/boni/src/skillforge/design-patterns/assets/
/home/boni/src/skillforge/llm-patterns/assets/
/home/boni/src/skillforge/meta-webxr-skills/assets/
/home/boni/src/skillforge/threejs-skills/assets/
```

Save each image as PNG. Do not add any watermarks, borders, or UI chrome.

---

## README Updates

After saving all images, update each README to display the banner at the top, immediately after the `# Title` line and before any other content:

### Top-level `README.md` — `/home/boni/src/skillforge/README.md`

Insert after `# Skillforge`:

```markdown
<img src="./assets/skillforge-banner.png" alt="Skillforge — skill packs for Claude Code" width="100%" />
```

### `security-watchdog/README.md`

Insert after `# security-watchdog`:

```markdown
<img src="./assets/banner.png" alt="security-watchdog — automatic Claude Code plugin scanner" width="100%" />
```

### `design-patterns/README.md`

Insert after `# design-patterns`:

```markdown
<img src="./assets/banner.png" alt="design-patterns — GoF, enterprise, and DDD patterns for Claude Code" width="100%" />
```

### `llm-patterns/README.md`

Insert after `# llm-patterns`:

```markdown
<img src="./assets/banner.png" alt="llm-patterns — production LLM integration patterns for Claude Code" width="100%" />
```

### `meta-webxr-skills/README.md`

Insert after `# Meta WebXR Skills for Claude Code`:

```markdown
<img src="./assets/banner.png" alt="meta-webxr-skills — WebXR PWA skills for Meta Quest" width="100%" />
```

### `threejs-skills/README.md`

Insert after `# Three.js Skills for Claude Code`:

```markdown
<img src="./assets/banner.png" alt="threejs-skills — Three.js 3D development skills for Claude Code" width="100%" />
```

---

## Social Preview Note

The `skillforge-social.png` (1280×640) is for the GitHub repository social preview. This cannot be set programmatically — it must be uploaded manually:

> **GitHub → Entelligentsia/skillforge → Settings → Social preview → Edit → Upload image**
> Upload: `/home/boni/src/skillforge/assets/skillforge-social.png`

Flag this step to the user when you are done.

---

## Execution Order

1. Read all reference images from `/home/boni/src/forge/assets/` to internalise the style
2. Read the top-level `README.md` and each sub-package `README.md` to understand each skill pack's essence
3. Create missing `assets/` directories
4. Generate and save images in this order: `skillforge-banner.png`, `skillforge-social.png`, then each sub-package banner
5. Update all README files with the `<img>` tags
6. Report: list each saved path, confirm README updates, and remind the user to upload `skillforge-social.png` to GitHub Settings
