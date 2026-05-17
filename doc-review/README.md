# doc-review

In-browser annotation overlay for local documents, with a structured JSON
output and a browser-driven auto-apply loop that lets Claude Code edit the
source file as you click.

No external dependencies. Node standard library only. Binds to `127.0.0.1` only.

---

## What it is

- A local HTTP server that serves your document with an injected review sidebar.
- An annotation UI: select text, pick a severity, write a comment, save.
- A JSON review file persisted under `<project-root>/.doc-review/`.
- An **Apply** button per comment in the browser that queues an edit.
- A `/loop`-driven tick command (`/apply-review-tick`) that picks the queue up
  every ~60 seconds and applies edits to the source file via Claude Code.
- A batch `/apply-review` command for when you'd rather review the plan and
  approve everything in one pass instead of clicking Apply per comment.

---

## Quickstart

```text
/review-doc path/to/your/doc.md
```

That single command starts the server, opens the doc in your browser with the
overlay attached, and starts the `/loop` auto-apply tick. Then in the browser:

1. Click **+ New comment** (or select text first, then click).
2. Pick severity: **Typo** / **Edit** / **Rewrite**.
3. Write the comment. Paste a suggested replacement if you have one.
4. Save.
5. When you want the change applied to source: click **Apply** on the card.
   Claude Code picks it up within ~60s and edits the file in place.

When you're done:

```text
/review-doc-stop
```

This drops your session's reference. The server exits when its last reference
drops (which may be immediate if you were the only session). The auto-apply
loop terminates on its next health check when the server is gone.

---

## Supported formats

| Extension | Handling |
|---|---|
| `.html`, `.htm` | Served as-rendered; relative assets resolve via auto-detected serve root. |
| `.md`, `.markdown` | Rendered with a tiny built-in MD parser (headings, paragraphs, lists, **bold**, *em*, `code`, fenced blocks). Falls back to a `<pre>` shell on parse trouble. |
| `.txt`, `.rst` | Wrapped in a readable `<pre>` shell. |

For non-HTML docs, the body gets the class `dr-plain` and pagination is disabled - the overlay anchors comments by selected text + 30-char context only.

---

## Project-root JSON store

On startup the server walks up from the doc and picks the first match as project root:

1. `.git/`
2. `.doc-review/` (resume previous)
3. `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `.hg/`, `.svn/`

Override with `--project-root <path>`.

All state lives under `<project-root>/.doc-review/`:

```
.doc-review/
  <slug>.review.json         the comments
  <slug>.queue.json          IDs queued by the browser Apply button
  .servers/<slug>.json       per-doc server marker (pid, port, refs, heartbeat)
```

Per-session state lives under `$HOME/.cache/doc-review/sessions/<session_id>.json`
and lists the marker paths a session is holding open. The SessionEnd hook
removes it; `/review-doc-stop` removes it explicitly.

`slug` is the doc path relative to project root with `/` replaced by `--`.
Example: `docs/api/intro.md` -> `docs--api--intro.md`.

If a legacy `_review/<doc-basename>.review.json` is found next to the doc, the
server logs a stderr notice on startup. It does not auto-migrate.

---

## Browser-driven auto-apply (the loop)

```
[user clicks Apply]  ->  POST /__overlay/queue  ->  queue.json
[loop tick every 60s] -> /apply-review-tick --port N --session-id ID
   - touch $HOME/.cache/doc-review/sessions/ID.json  (heartbeat)
   - curl /__overlay/health  (silent exit if down)
   - loop: POST /__overlay/queue/claim  (atomic pop)
   - for each id: Edit source, PATCH status=applied
[overlay 5s poll]    ->  sees status:applied  ->  hides queued badge, reloads
```

`/review-doc-stop` drops only this session's reference. The server exits on
its own when its last reference drops or its heartbeat sweep finds no live
sessions. Other sessions are unaffected.

---

## Severity tiers

| Severity | Intent |
|---|---|
| `typo`     | Surface-level fix. Replace exactly. |
| `edit`     | Local rewrite within the anchor. |
| `rewrite`  | Larger substitution; reviewer expects judgment about phrasing. |

All three route to the same target: the file the user opened. There is no project-specific routing in this plugin - the source file IS the edit target.

---

## Comment JSON schema

```json
{
  "doc": "intro.md",
  "doc_path": "/abs/path/to/intro.md",
  "doc_relpath": "docs/api/intro.md",
  "project_root": "/abs/path/to/project",
  "started_at": "2026-05-16T04:17:48Z",
  "comments": [
    {
      "id": "c-b09f492c",
      "ts": "2026-05-16T04:26:57Z",
      "page": null,
      "page_label": null,
      "selector": null,
      "selected_text": "click here for more",
      "context_before": "...30 chars before...",
      "context_after": "...30 chars after...",
      "severity": "typo | edit | rewrite",
      "comment": "free-text review comment",
      "suggested": "see the API reference",
      "status": "open | applied | dismissed | reopened | deferred",
      "applied_at": "2026-05-16T09:57:52+05:30",
      "applied_note": "one-line summary"
    }
  ]
}
```

For HTML docs that use paged layout (a `<div class="page">` per page), `page`, `page_label`, and `selector` get populated by the overlay. For plain docs they remain `null`.

---

## Commands

| Command | Purpose |
|---|---|
| `/review-doc <file> [--port N]` | Start (or reuse) server, open browser, start auto-apply loop. |
| `/review-doc-stop` | Drop this session's references; servers exit when their last ref drops. |
| `/apply-review [<path>]` | Batch apply: read JSON, plan, approve, apply. |
| `/apply-review-tick --port N --session-id ID` | One tick of the auto-apply loop. Driven by `/loop`, not humans. |

---

## Endpoints (for reference)

```
GET    /                              redirect to docURL (or render plain doc inline)
GET    /__overlay/health              {ok:true, doc, project_root}
GET    /__overlay/meta                {doc, doc_slug, doc_path, doc_relpath, project_root, review_file, queue_file, plain}
GET    /__overlay/comments            full review JSON
POST   /__overlay/comments            append new comment
PATCH  /__overlay/comments/<id>       merge fields into a comment
DELETE /__overlay/comments/<id>       remove a comment
GET    /__overlay/queue               {ids: [...]} (debug)
POST   /__overlay/queue               body {id}; enqueue for auto-apply
POST   /__overlay/queue/claim         atomic pop -> {id} or {id: null}
DELETE /__overlay/queue/<id>          dequeue (legacy; claim preferred)
POST   /__overlay/refs                body {session_id}; register a session
DELETE /__overlay/refs/<session_id>   deregister; server exits if refs empty
GET    /__overlay/overlay.js          overlay script
GET    /__overlay/overlay.css         overlay styles
```

---

## Stopping a session

```
/review-doc-stop
```

This drops only your session's reference. If another session is still
reviewing the same doc, the server stays up for them. If yours was the last
reference, the server exits.

A SessionEnd hook does the same cleanup automatically when your Claude session
ends, so explicitly running `/review-doc-stop` is optional.

To force-kill a specific server regardless of refs:

```bash
lsof -i:7321 -t | xargs -r kill
```

---

## Limitations

- Single doc per server. Reviewing two docs at once needs two ports.
- 127.0.0.1 only. No auth. Single-user local machine.
- The MD renderer is intentionally tiny; complex Markdown (tables, images, footnotes) falls through to a `<pre>` shell.
- Anchor matching uses `context_before + selected_text + context_after`. Large structural edits between review and apply can break anchors - the tick command surfaces and skips rather than guessing.
- The 5-second overlay poll is unconditional. Fine for solo use.
