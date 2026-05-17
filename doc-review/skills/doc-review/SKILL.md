---
name: doc-review
description: In-browser annotation overlay for HTML, Markdown, and plain-text documents. Use when a user wants to annotate a document, run a structured review pass with severities (typo / edit / rewrite), or apply review comments back into source files via Claude Code.
---

# doc-review

## Action

This skill is a delegator. When invoked, immediately route to the right slash
command based on user intent:

- File argument present (e.g. `@README.md` or a path to `.html` / `.md` /
  `.markdown` / `.txt` / `.rst`) AND user wants to start or resume an
  annotation session → invoke `/doc-review:review-doc <file>` (pass through
  any `--port N`).
- User says "apply review" / "apply comments" / mentions a `.review.json` →
  invoke `/doc-review:apply-review [<json-path>]`.
- User says "stop" / "kill review" → invoke `/doc-review:review-doc-stop`.
- User mentions polling, cron tick, internal loop → these run automatically;
  do not invoke `/doc-review:apply-review-tick` manually.

Do NOT print the documentation below as the response. Print at most a one-line
confirmation of what command you are routing to, then invoke it.

## Reference (for Claude's own context)

Workflow summary:

- A Node HTTP server serves the document in a browser with an injected
  sidebar.
- A reviewer adds anchored comments (selected text + 30-char context).
- Each comment carries a severity: `typo`, `edit`, or `rewrite`.
- Clicking **Apply** on a comment in the browser queues it; Claude Code,
  driven by a `/loop` tick command, picks it up within ~60 seconds and
  edits the source file in place.
- The server is multi-session aware: two Claude sessions reviewing the same
  doc share one server; a server stays up while at least one session holds a
  reference, and self-terminates when the last reference drops.

Commands:

- `/doc-review:review-doc <file> [--port N]`
- `/doc-review:review-doc-stop`
- `/doc-review:apply-review [<path-to-review.json>]`
- `/doc-review:apply-review-tick --port <N> --session-id <id>` (loop-only)

Storage layout:

- Per-project: `<project-root>/.doc-review/<slug>.review.json`,
  `.../<slug>.queue.json`, `.../.servers/<slug>.json`.
- Per-session: `$HOME/.cache/doc-review/sessions/<session_id>.json`.

Project root detected by walking up from the doc for `.git/`, `.doc-review/`,
`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `.hg/`, or `.svn/`.
Override with `--project-root`.
