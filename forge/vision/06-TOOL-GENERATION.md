# 06 — Tool Generation

Forge ships algorithms, not code. The LLM generates tool implementations in the project's native language.

---

## The Problem

The AI-SDLC needs deterministic tools — collation (JSON → markdown views), store validation, store seeding. These are mechanical transformations that should run fast and produce consistent output.

Shipping these as Node.js scripts (as WalkInto does) creates a runtime dependency. A Python project shouldn't need Node.js to regenerate its index files.

## The Solution: Spec → Generate → Own

```
Plugin ships:     tool-specs/collate.spec.md     (language-agnostic algorithm)
/forge init:      reads sdlc-config.json          (project language, paths, prefix)
LLM generates:    engineering/tools/collate.py    (project-native implementation)
```

The generated tool is a **first-class project artifact**: version-controlled, editable, debuggable, in the team's language.

---

## What a Tool Spec Contains

A tool spec defines **what** the tool does, not **how** in any particular language.

### Structure

```markdown
# Tool Spec: collate

## Purpose
Regenerate markdown views from the JSON store. Deterministic — no AI needed.

## Inputs
- sdlc-config.json — project prefix, paths, description
- .store/sprints/*.json, .store/tasks/*.json, .store/bugs/*.json
- .store/events/{SPRINT_ID}/*.json
- Existing MASTER_INDEX.md (to preserve static sections)

## Outputs
1. MASTER_INDEX.md
2. TIMESHEET.md (per sprint)
3. TIMESHEET.md (bugs)
4. INDEX.md (per sprint, task, bug directory)
5. COLLATION_STATE.json

## CLI Interface
- <tool> collate              all sprints
- <tool> collate S01          single sprint + master index
- <tool> collate --dry-run    preview only
- Exit 0 on success, 1 on validation error

## Algorithm
1. Read sdlc-config.json for prefix, paths, project description
2. Validate store: tasks/ has JSON files, required fields present
3. Load all sprint JSON, sort by sprint number ascending
4. Load all task JSON, group by sprintId
5. Load all bug JSON, sort by bug number
6. Read existing MASTER_INDEX.md, extract preserved sections by ## heading
7. Build Sprint Registry: table with progress (completed/total)
8. Build Task Registry: grouped by sprint (most recent first)
9. Build Bug Registry: open first (asc), then resolved (desc)
10. Write MASTER_INDEX.md: config header → preserved → generated
11. For each sprint: events → estimates table + activity log → TIMESHEET.md
12. For each directory: discover artifacts → INDEX.md navigation hub
13. Write COLLATION_STATE.json

## Formatting Rules
- Markdown pipe tables
- Timestamps truncated to minutes
- Duration: <60m → "Nm", >=60m → "Nh Mm"
- IDs hyperlink to INDEX.md via relative paths
- Generated files start with <!-- GENERATED --> comment

## Store Schema (reference)
[task, sprint, bug, event field definitions]
```

### What a Spec Does NOT Define

- Language or runtime
- Import paths or library choices
- Variable naming conventions
- Error message wording
- Logging format

These are left to the LLM to generate idiomatically for the target language.

---

## Tool Specs Shipped with Forge

| Spec | Purpose | Complexity |
|------|---------|------------|
| `collate.spec.md` | JSON store → markdown views (indexes, timesheets, navigation hubs) | High — multiple output files, preserved sections, hyperlinks |
| `seed-store.spec.md` | Bootstrap store JSON from existing engineering/ directory structure | Medium — directory scanning, JSON creation |
| `validate-store.spec.md` | Check store integrity (required fields, referential integrity, orphans) | Medium — validation rules, error reporting |

---

## What Gets Generated

### Python Project (Django)

```python
#!/usr/bin/env python3
"""collate.py — regenerate markdown views from the JSON store."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG = json.loads((ROOT / 'sdlc-config.json').read_text())
STORE = ROOT / CONFIG['paths']['store']
# ...
```

### Node.js Project (Express)

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'sdlc-config.json'), 'utf8'));
const STORE = path.join(ROOT, CONFIG.paths.store);
// ...
```

### Go Project

```go
package main

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "sort"
)

func main() {
    root := findProjectRoot()
    config := loadConfig(root)
    store := filepath.Join(root, config.Paths.Store)
    // ...
}
```

### Shell (fallback, uses jq)

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="$ROOT/sdlc-config.json"
STORE="$ROOT/$(jq -r '.paths.store' "$CONFIG")"
# ...
```

---

## Tool Lifecycle

### Day 1: Generated

```
/forge init Phase 8
  → reads collate.spec.md
  → reads sdlc-config.json (language: python)
  → generates engineering/tools/collate.py
  → records in config: "collate": "python engineering/tools/collate.py"
```

### Sprint N: Maintained by the Team

The tool is a project file. The team can:
- Fix bugs in it
- Add features (e.g., "include root cause category in bug timesheet")
- Optimise performance
- Add flags

### Plugin Update: Spec Revised

When Forge ships an updated `collate.spec.md` (e.g., adding a new output file):

```
/forge update-tools
  → reads current collate.spec.md (from plugin)
  → reads previous collate.spec.md (cached during last init/update)
  → diffs the two → shows user what changed
  → offers to regenerate engineering/tools/collate.py
  → does NOT auto-overwrite (team may have customised)
```

### Fallback: LLM-Driven Collation

If the tool doesn't exist or fails, the workflow falls back to LLM-driven collation:

```markdown
# In /collate command:

PREFERRED: Run the generated collation tool:
  python engineering/tools/collate.py

FALLBACK: If the tool is unavailable, follow the manual collation workflow
in .agent/workflows/collator_agent.md.
```

The LLM fallback is slower (30-60s vs <1s) and non-deterministic, but it works with zero dependencies.

---

## The Pattern Generalises

Any deterministic operation the SDLC needs follows the same model:

| Operation | AI Needed? | Approach |
|-----------|-----------|----------|
| Collation (JSON → markdown) | No | Spec → generated tool |
| Store validation | No | Spec → generated tool |
| Store seeding | No | Spec → generated tool |
| Knowledge base discovery | Yes | Pure LLM (Claude Code tools) |
| Code review | Yes | LLM workflow |
| Knowledge writeback | Yes | LLM workflow |
| Trend interpretation | Partial | Generated tool extracts data, LLM interprets |

**Rule**: if it's mechanical, generate a tool. If it requires judgement, let the LLM do it.

---

**Next**: [07-PLUGIN-STRUCTURE.md](07-PLUGIN-STRUCTURE.md) — What ships in the package
