#!/usr/bin/env node
// doc-review local server.
// Usage:
//   node server.cjs <doc-abs-path> [--port N] [--project-root <path>]
//                                  [--marker <path>] [--session-id <id>]
// Supports .html, .md, .markdown, .txt, .rst documents.
// Persists review JSON under <project-root>/.doc-review/<slug>.review.json.
// Multi-session aware: writes a per-doc marker file at
//   <project-root>/.doc-review/.servers/<slug>.json
// listing the PID, port, doc, refs (session IDs holding this server open),
// started_at, and heartbeat.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const url = require('url');

const argv = process.argv.slice(2);
if (argv.length < 1) {
    console.error('Usage: node server.cjs <doc-abs-path> [--port N] [--project-root <path>] [--marker <path>] [--session-id <id>]');
    process.exit(1);
}

const docPath = path.resolve(argv[0]);
const ALLOWED_EXT = ['.html', '.htm', '.md', '.markdown', '.txt', '.rst'];
const ext = path.extname(docPath).toLowerCase();
if (!fs.existsSync(docPath) || !ALLOWED_EXT.includes(ext)) {
    console.error(`Not a readable supported document: ${docPath} (allowed: ${ALLOWED_EXT.join(', ')})`);
    process.exit(1);
}
const isHtml = (ext === '.html' || ext === '.htm');

const docDir = path.dirname(docPath);
const docBasename = path.basename(docPath);
const docSlug = docBasename;

function argValue(name) {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
}

const portArg = argValue('--port');
const requestedPort = portArg !== null ? parseInt(portArg, 10) : null;

function findProjectRoot(startDir) {
    let dir = startDir;
    const root = path.parse(dir).root;
    while (true) {
        if (fs.existsSync(path.join(dir, '.git'))) return dir;
        if (fs.existsSync(path.join(dir, '.doc-review'))) return dir;
        for (const marker of ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', '.hg', '.svn']) {
            if (fs.existsSync(path.join(dir, marker))) return dir;
        }
        if (dir === root) break;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    console.error(`[doc-review] WARNING: no project root marker found; falling back to doc dir: ${startDir}`);
    return startDir;
}

const projectRootArg = argValue('--project-root');
const projectRoot = projectRootArg ? path.resolve(projectRootArg) : findProjectRoot(docDir);

const docRelpath = path.relative(projectRoot, docPath).split(path.sep).join('/');
const slugFromRel = docRelpath.replace(/\//g, '--');

const reviewDir = path.join(projectRoot, '.doc-review');
if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });
const serversDir = path.join(reviewDir, '.servers');
if (!fs.existsSync(serversDir)) fs.mkdirSync(serversDir, { recursive: true });

const markerArg = argValue('--marker');
const markerFile = markerArg ? path.resolve(markerArg) : path.join(serversDir, `${slugFromRel}.json`);
fs.mkdirSync(path.dirname(markerFile), { recursive: true });

const initialSessionId = argValue('--session-id') || `sess-${Date.now()}-${process.pid}`;

const reviewFile = path.join(reviewDir, `${slugFromRel}.review.json`);
const queueFile = path.join(reviewDir, `${slugFromRel}.queue.json`);

// Legacy notice (do not auto-migrate).
const legacyDir = path.join(docDir, '_review');
const legacyFile = path.join(legacyDir, `${docBasename.replace(/\.[^.]+$/, '')}.review.json`);
if (fs.existsSync(legacyFile)) {
    console.error(`[doc-review] NOTE: legacy review file present at ${legacyFile} (not auto-migrated).`);
}

if (!fs.existsSync(reviewFile)) {
    fs.writeFileSync(reviewFile, JSON.stringify({
        doc: docBasename,
        doc_path: docPath,
        doc_relpath: docRelpath,
        project_root: projectRoot,
        started_at: new Date().toISOString(),
        comments: []
    }, null, 2));
}
if (!fs.existsSync(queueFile)) {
    fs.writeFileSync(queueFile, JSON.stringify({ ids: [] }, null, 2));
}

const SCRIPTS_DIR = __dirname;

// Per-session registry dir (touched to indicate liveness).
const sessionRegistryDir = path.join(os.homedir(), '.cache', 'doc-review', 'sessions');

function readMarker() {
    try { return JSON.parse(fs.readFileSync(markerFile, 'utf-8')); }
    catch (e) { return null; }
}
function writeMarker(m) {
    fs.writeFileSync(markerFile, JSON.stringify(m, null, 2));
}

// Compute serveRoot for HTML docs that reference relative assets via ../
function computeServeRoot(p, dir) {
    if (!isHtml) return { serveRoot: dir, levelsUp: 0 };
    const html = fs.readFileSync(p, 'utf-8');
    const matches = html.matchAll(/(?:href|src)\s*=\s*["']((?:\.\.\/)+[^"']*)["']/g);
    let maxLevels = 0;
    for (const m of matches) {
        const u = m[1];
        const segs = u.split('/');
        let levels = 0;
        for (const s of segs) {
            if (s === '..') levels++;
            else break;
        }
        if (levels > maxLevels) maxLevels = levels;
    }
    let r = dir;
    for (let i = 0; i < maxLevels; i++) r = path.dirname(r);
    return { serveRoot: r, levelsUp: maxLevels };
}

const { serveRoot, levelsUp } = computeServeRoot(docPath, docDir);
const docURL = '/' + path.relative(serveRoot, docPath).split(path.sep).join('/');

function readReview() { return JSON.parse(fs.readFileSync(reviewFile, 'utf-8')); }
function writeReview(d) { fs.writeFileSync(reviewFile, JSON.stringify(d, null, 2)); }
function readQueue() {
    try { return JSON.parse(fs.readFileSync(queueFile, 'utf-8')); }
    catch (e) { return { ids: [] }; }
}
function writeQueue(q) { fs.writeFileSync(queueFile, JSON.stringify(q, null, 2)); }

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Prefer vendored marked.js (proper CommonMark + GFM). Fall back to micro-parser.
let _marked = null;
try {
    _marked = require(path.join(__dirname, 'vendor', 'marked.min.js'));
} catch (e) { _marked = null; }

function mdToHtml(src) {
    if (_marked && typeof _marked.parse === 'function') {
        try { return _marked.parse(src, { gfm: true, breaks: false }); }
        catch (e) { /* fall through to micro-parser */ }
    }
    return mdToHtmlMicro(src);
}

// Tiny markdown to HTML fallback. Headings 1-4, paragraphs, **bold**, *em*, `code`,
// fenced code blocks, unordered (- *) and ordered (1.) lists.
function mdToHtmlMicro(src) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    function inlineFmt(s) {
        let t = escapeHtml(s);
        t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        return t;
    }
    while (i < lines.length) {
        const line = lines[i];
        if (/^```/.test(line)) {
            const buf = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
            i++;
            out.push('<pre><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
            continue;
        }
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) { out.push(`<h${h[1].length}>${inlineFmt(h[2])}</h${h[1].length}>`); i++; continue; }
        if (/^\s*[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                items.push('<li>' + inlineFmt(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
                i++;
            }
            out.push('<ul>' + items.join('') + '</ul>');
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push('<li>' + inlineFmt(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>');
                i++;
            }
            out.push('<ol>' + items.join('') + '</ol>');
            continue;
        }
        if (line.trim() === '') { i++; continue; }
        const para = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
            para.push(lines[i]); i++;
        }
        out.push('<p>' + inlineFmt(para.join(' ')) + '</p>');
    }
    return out.join('\n');
}

function plainShellHtml(title, bodyHtml, plainClass) {
    const styles = `
      body { font-family: -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
             max-width: 820px; margin: 2em auto; padding: 0 1.2em;
             line-height: 1.6; color: #24292f; background: #fff; }
      h1,h2,h3,h4,h5,h6 { line-height: 1.25; margin: 1.4em 0 0.6em; font-weight: 600; }
      h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
      h3 { font-size: 1.25em; }
      h4 { font-size: 1em; }
      p  { margin: 0.6em 0; }
      a  { color: #0969da; text-decoration: none; }
      a:hover { text-decoration: underline; }
      pre  { background: #f6f8fa; padding: 1em; overflow-x: auto; border-radius: 6px;
             font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 90%; }
      pre code { background: transparent; padding: 0; border-radius: 0; font-size: 100%; }
      code { background: rgba(175,184,193,0.2); padding: 0.15em 0.35em; border-radius: 4px;
             font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 90%; }
      blockquote { margin: 0.8em 0; padding: 0 1em; color: #57606a;
                   border-left: 0.25em solid #d0d7de; }
      ul, ol { padding-left: 2em; margin: 0.6em 0; }
      li { margin: 0.2em 0; }
      table { border-collapse: collapse; margin: 1em 0; display: block; max-width: 100%; overflow: auto; }
      th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
      th { background: #f6f8fa; font-weight: 600; }
      tr:nth-child(2n) td { background: #f6f8fa; }
      hr { border: 0; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
      img { max-width: 100%; }
      .dr-plain { padding-right: 360px; }
    `;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
        `<style>${styles}</style></head><body class="${plainClass}">${bodyHtml}</body></html>`;
}

function renderNonHtml(absPath) {
    const raw = fs.readFileSync(absPath, 'utf-8');
    const e = path.extname(absPath).toLowerCase();
    if (e === '.md' || e === '.markdown') {
        try {
            const body = mdToHtml(raw);
            return plainShellHtml(path.basename(absPath), body, 'dr-plain');
        } catch (err) {
            return plainShellHtml(path.basename(absPath), '<pre>' + escapeHtml(raw) + '</pre>', 'dr-plain');
        }
    }
    return plainShellHtml(path.basename(absPath), '<pre>' + escapeHtml(raw) + '</pre>', 'dr-plain');
}

// Render a directory's index file (read-only context navigation, no overlay).
function findDirIndex(dirAbs) {
    for (const c of ['README.md', 'README.markdown', 'index.md', 'index.html', 'README.html']) {
        const p = path.join(dirAbs, c);
        try { if (fs.statSync(p).isFile()) return p; } catch (e) { /* skip */ }
    }
    return null;
}

function renderDirIndex(dirAbs, requestedPath) {
    const inner = findDirIndex(dirAbs);
    if (!inner) return null;
    const ext = path.extname(inner).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
        return { html: fs.readFileSync(inner, 'utf-8'), inner };
    }
    const banner = `<div style="background:#fff8c5; border:1px solid #d4a72c; padding:8px 12px; margin:0 0 1em; font-size:13px; color:#572e00;">Read-only context view: <code>${escapeHtml(requestedPath)}</code> (annotation overlay disabled for navigated docs).</div>`;
    const raw = fs.readFileSync(inner, 'utf-8');
    let body;
    if (ext === '.md' || ext === '.markdown') {
        try { body = mdToHtml(raw); }
        catch (e) { body = '<pre>' + escapeHtml(raw) + '</pre>'; }
    } else {
        body = '<pre>' + escapeHtml(raw) + '</pre>';
    }
    return { html: plainShellHtml(path.basename(inner), banner + body, 'dr-plain dr-readonly'), inner };
}

function injectOverlay(html) {
    const tags = `\n<link rel="stylesheet" href="/__overlay/overlay.css">\n<script src="/__overlay/overlay.js" defer></script>\n`;
    if (html.includes('</body>')) return html.replace('</body>', `${tags}</body>`);
    return html + tags;
}

function contentTypeFor(p) {
    const ex = path.extname(p).toLowerCase();
    return {
        '.html': 'text/html; charset=utf-8',
        '.htm': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.pdf': 'application/pdf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
    }[ex] || 'application/octet-stream';
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => data += c);
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsed.pathname);

    try {
        if (pathname === '/__overlay/overlay.js' || pathname === '/__overlay/overlay.css') {
            const file = path.join(SCRIPTS_DIR, pathname.replace('/__overlay/', ''));
            res.writeHead(200, { 'Content-Type': contentTypeFor(file) });
            res.end(fs.readFileSync(file));
            return;
        }

        if (pathname === '/__overlay/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, doc: docBasename, project_root: projectRoot }));
            return;
        }

        if (pathname === '/__overlay/meta') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                doc: docBasename,
                doc_slug: docSlug,
                doc_path: docPath,
                doc_relpath: docRelpath,
                project_root: projectRoot,
                review_file: reviewFile,
                queue_file: queueFile,
                marker_file: markerFile,
                plain: !isHtml
            }));
            return;
        }

        if (pathname === '/__overlay/comments' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readReview()));
            return;
        }

        if (pathname === '/__overlay/comments' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const data = readReview();
            const id = 'c-' + crypto.randomBytes(4).toString('hex');
            const comment = {
                id,
                ts: new Date().toISOString(),
                page: body.page || null,
                page_label: body.page_label || null,
                selector: body.selector || null,
                selected_text: body.selected_text || null,
                context_before: body.context_before || null,
                context_after: body.context_after || null,
                severity: body.severity || 'edit',
                comment: body.comment || '',
                suggested: body.suggested || null,
                status: 'open'
            };
            data.comments.push(comment);
            writeReview(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(comment));
            return;
        }

        const idMatch = pathname.match(/^\/__overlay\/comments\/(c-[0-9a-f]+)$/);
        if (idMatch && req.method === 'DELETE') {
            const id = idMatch[1];
            const data = readReview();
            data.comments = data.comments.filter(c => c.id !== id);
            writeReview(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        if (idMatch && req.method === 'PATCH') {
            const id = idMatch[1];
            const body = JSON.parse(await readBody(req));
            const data = readReview();
            const idx = data.comments.findIndex(c => c.id === id);
            if (idx >= 0) {
                data.comments[idx] = { ...data.comments[idx], ...body };
                writeReview(data);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data.comments[idx] || null));
            return;
        }

        // Queue endpoints
        if (pathname === '/__overlay/queue' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readQueue()));
            return;
        }
        if (pathname === '/__overlay/queue' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const q = readQueue();
            if (body.id && !q.ids.includes(body.id)) q.ids.push(body.id);
            writeQueue(q);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(q));
            return;
        }
        if (pathname === '/__overlay/queue/claim' && req.method === 'POST') {
            const q = readQueue();
            const id = q.ids.length ? q.ids.shift() : null;
            writeQueue(q);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id }));
            return;
        }
        const qDelMatch = pathname.match(/^\/__overlay\/queue\/(c-[0-9a-f]+)$/);
        if (qDelMatch && req.method === 'DELETE') {
            const id = qDelMatch[1];
            const q = readQueue();
            q.ids = q.ids.filter(x => x !== id);
            writeQueue(q);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // Refs (per-session) endpoints
        if (pathname === '/__overlay/refs' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const sid = body.session_id;
            if (!sid) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'session_id required' }));
                return;
            }
            const m = readMarker() || {};
            m.refs = Array.isArray(m.refs) ? m.refs : [];
            if (!m.refs.includes(sid)) m.refs.push(sid);
            m.heartbeat = new Date().toISOString();
            writeMarker(m);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, refs: m.refs }));
            return;
        }
        const refDelMatch = pathname.match(/^\/__overlay\/refs\/([^\/]+)$/);
        if (refDelMatch && req.method === 'DELETE') {
            const sid = decodeURIComponent(refDelMatch[1]);
            const m = readMarker() || {};
            m.refs = (Array.isArray(m.refs) ? m.refs : []).filter(x => x !== sid);
            m.heartbeat = new Date().toISOString();
            writeMarker(m);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, refs: m.refs }));
            if (m.refs.length === 0) {
                // No more sessions: shut down after the response flushes.
                setImmediate(() => shutdown(0, /*deleteMarker=*/true));
            }
            return;
        }

        // Root: route to doc.
        if (pathname === '/') {
            if (isHtml) {
                res.writeHead(302, { Location: docURL });
                res.end();
                return;
            }
            const html = injectOverlay(renderNonHtml(docPath));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        if (!isHtml && pathname === docURL) {
            const html = injectOverlay(renderNonHtml(docPath));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        const requested = pathname;
        let target = path.resolve(serveRoot, '.' + requested);
        if (!target.startsWith(serveRoot)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        if (!fs.existsSync(target)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found: ' + requested);
            return;
        }

        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
            // Force trailing slash so relative links resolve against the dir, not its parent.
            if (!pathname.endsWith('/')) {
                res.writeHead(301, { Location: pathname + '/' });
                res.end();
                return;
            }
            const rendered = renderDirIndex(target, requested);
            if (rendered) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(rendered.html);
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No README/index in directory: ' + requested);
            return;
        }

        if (target === docPath && !isHtml) {
            const html = injectOverlay(renderNonHtml(docPath));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        if (target.endsWith('.html') || target.endsWith('.htm')) {
            const html = injectOverlay(fs.readFileSync(target, 'utf-8'));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        const buf = fs.readFileSync(target);
        res.writeHead(200, { 'Content-Type': contentTypeFor(target) });
        res.end(buf);
    } catch (err) {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error: ' + err.message);
        } else {
            try { res.end(); } catch (e) {}
        }
    }
});

process.on('uncaughtException', (err) => {
    console.error('[doc-review] uncaughtException:', err && err.stack || err);
});
process.on('unhandledRejection', (err) => {
    console.error('[doc-review] unhandledRejection:', err && err.stack || err);
});

function tryListen(p) {
    return new Promise((resolve, reject) => {
        const onError = (err) => { server.removeListener('listening', onListening); reject(err); };
        const onListening = () => { server.removeListener('error', onError); resolve(p); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(p, '127.0.0.1');
    });
}

async function bind() {
    if (requestedPort !== null) {
        try { return await tryListen(requestedPort); }
        catch (e) {
            console.error(`[doc-review] port ${requestedPort} unavailable: ${e.code || e.message}`);
            process.exit(1);
        }
    }
    for (let p = 7321; p <= 7340; p++) {
        try { return await tryListen(p); }
        catch (e) {
            if (e && e.code === 'EADDRINUSE') continue;
            console.error(`[doc-review] listen error on ${p}: ${e.code || e.message}`);
            process.exit(1);
        }
    }
    console.error('[doc-review] no free port in 7321-7340');
    process.exit(1);
}

let heartbeatTimer = null;
let shuttingDown = false;
function shutdown(code, deleteMarker) {
    if (shuttingDown) return;
    shuttingDown = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (deleteMarker) {
        try { fs.unlinkSync(markerFile); } catch (e) { /* ignore */ }
    }
    try { server.close(); } catch (e) { /* ignore */ }
    process.exit(code || 0);
}

function sessionAlive(sid) {
    const f = path.join(sessionRegistryDir, `${sid}.json`);
    try {
        const st = fs.statSync(f);
        const ageMs = Date.now() - st.mtimeMs;
        return ageMs < 5 * 60 * 1000;
    } catch (e) { return false; }
}

function heartbeatTick() {
    const m = readMarker();
    if (!m) return;
    const before = Array.isArray(m.refs) ? m.refs.slice() : [];
    const alive = before.filter(sessionAlive);
    m.refs = alive;
    m.heartbeat = new Date().toISOString();
    writeMarker(m);
    if (alive.length === 0) {
        shutdown(0, /*deleteMarker=*/true);
    }
}

(async () => {
    const port = await bind();
    // Write initial marker.
    const marker = {
        pid: process.pid,
        port,
        doc: docPath,
        doc_relpath: docRelpath,
        project_root: projectRoot,
        refs: [initialSessionId],
        started_at: new Date().toISOString(),
        heartbeat: new Date().toISOString()
    };
    writeMarker(marker);

    heartbeatTimer = setInterval(heartbeatTick, 30 * 1000);

    process.on('SIGTERM', () => shutdown(0, true));
    process.on('SIGINT', () => shutdown(0, true));

    console.log(JSON.stringify({
        status: 'listening',
        url: `http://127.0.0.1:${port}/`,
        doc_url: `http://127.0.0.1:${port}${docURL}`,
        doc: docPath,
        doc_relpath: docRelpath,
        project_root: projectRoot,
        serve_root: serveRoot,
        levels_up: levelsUp,
        review_file: reviewFile,
        queue_file: queueFile,
        marker_file: markerFile,
        session_id: initialSessionId,
        pid: process.pid,
        port
    }));
})();
