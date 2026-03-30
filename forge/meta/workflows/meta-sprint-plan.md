# Meta-Workflow: Sprint Plan

## Purpose

The Architect initialises a new sprint with tasks, estimates, dependencies,
and a dependency graph.

## Algorithm

### Step 1 — Load Context
- Read MASTER_INDEX.md for project state
- Read the previous sprint's retrospective (if exists)
- Read any task prompts or feature requests for this sprint

### Step 2 — Define Tasks
For each task:
- Title and description
- Estimated complexity (S/M/L/XL)
- Dependencies on other tasks
- Relevant entities and architecture areas

### Step 3 — Build Dependency Graph
- Define task dependencies as edges
- Validate: no circular dependencies
- Compute wave structure for parallel execution

### Step 4 — Create Sprint Manifest
- Write sprint JSON to .forge/store/sprints/
- Write task JSONs to .forge/store/tasks/
- Create task artifact directories in engineering/sprints/{SPRINT_ID}/

### Step 5 — Generate Task Prompts
- Write a task prompt file for each task using the task prompt template

### Step 6 — Collate
- Run collation to update MASTER_INDEX.md and sprint INDEX.md

## Generation Instructions
- Use the project's ID format and prefix
- Reference the project's entity model for task scoping
- Include the project's operational impact categories
- Reference the sprint manifest template
