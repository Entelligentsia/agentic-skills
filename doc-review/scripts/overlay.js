// doc-review overlay - injected into doc HTML.
// Provides annotation sidebar, capture mode, and persistence via the local server.

(function () {
    'use strict';

    const API = {
        meta: () => fetch('/__overlay/meta').then(r => r.json()),
        list: () => fetch('/__overlay/comments').then(r => r.json()),
        add: (c) => fetch('/__overlay/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(c)
        }).then(r => r.json()),
        del: (id) => fetch('/__overlay/comments/' + id, { method: 'DELETE' }).then(r => r.json()),
        patch: (id, body) => fetch('/__overlay/comments/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(r => r.json()),
        enqueue: (id) => fetch('/__overlay/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        }).then(r => r.json()),
    };

    let state = {
        meta: null,
        comments: [],
        captureMode: false,
        pendingAnchor: null,
        editingId: null,
        paginated: true,
        currentPage: 1,
        totalPages: 0,
        showResolved: false,
        pollHandle: null,
        lastEtag: '',
        queuedIds: new Set(),
        plain: false,
    };

    function el(tag, attrs = {}, ...children) {
        const e = document.createElement(tag);
        for (const k in attrs) {
            if (k === 'class') e.className = attrs[k];
            else if (k === 'onclick') e.onclick = attrs[k];
            else if (k === 'html') e.innerHTML = attrs[k];
            else e.setAttribute(k, attrs[k]);
        }
        for (const c of children) {
            if (c == null) continue;
            if (typeof c === 'string') e.appendChild(document.createTextNode(c));
            else e.appendChild(c);
        }
        return e;
    }

    function truncMiddle(s, max) {
        if (!s) return '';
        if (s.length <= max) return s;
        const half = Math.floor((max - 3) / 2);
        return s.slice(0, half) + '...' + s.slice(-half);
    }

    function clearKids(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function buildOverlay() {
        const overlay = el('div', { id: 'dr-overlay' });
        const toggle = el('button', { class: 'dr-toggle', title: 'Collapse', onclick: toggleCollapsed }, '->');
        const rootChip = el('span', { class: 'dr-root-chip', id: 'dr-root-chip', title: '' }, '');
        const header = el('div', { class: 'dr-header' },
            el('span', { class: 'dr-title' }, 'Review'),
            rootChip,
            toggle
        );
        const main = el('div', { class: 'dr-main' });
        const meta = el('div', { class: 'dr-meta' });
        const actions = el('div', { class: 'dr-actions' },
            el('button', { class: 'dr-btn', id: 'dr-new', title: 'Select text first, then click - or click first and select after', onclick: startCapture }, '+ New comment'),
            el('button', { class: 'dr-btn ghost', onclick: refresh }, 'Refresh')
        );
        const filter = el('div', { class: 'dr-filter' });
        const filterLabel = el('label', {});
        const filterInput = el('input', { type: 'checkbox', id: 'dr-show-resolved' });
        filterInput.addEventListener('change', () => {
            state.showResolved = filterInput.checked;
            renderList();
            renderMeta();
        });
        filterLabel.appendChild(filterInput);
        filterLabel.appendChild(el('span', {}, 'Show applied / dismissed'));
        filter.appendChild(filterLabel);
        filter.appendChild(el('span', { class: 'dr-counts', id: 'dr-counts' }, ''));

        const list = el('div', { class: 'dr-list', id: 'dr-list' });
        main.appendChild(meta);
        main.appendChild(actions);
        main.appendChild(filter);
        main.appendChild(list);
        overlay.appendChild(header);
        overlay.appendChild(main);
        document.body.appendChild(overlay);
        document.body.classList.add('dr-overlay-active');
    }

    function toggleCollapsed() {
        const o = document.getElementById('dr-overlay');
        o.classList.toggle('collapsed');
        document.body.classList.toggle('dr-overlay-collapsed');
        o.querySelector('.dr-toggle').textContent = o.classList.contains('collapsed') ? '<-' : '->';
    }

    function isOpen(c) {
        const s = c.status || 'open';
        return s === 'open' || s === 'reopened';
    }

    function renderMeta() {
        const m = document.querySelector('#dr-overlay .dr-meta');
        if (!m || !state.meta) return;
        clearKids(m);
        m.appendChild(el('div', { class: 'dr-doc' }, state.meta.doc));
        const total = state.comments.length;
        const openN = state.comments.filter(isOpen).length;
        const applied = state.comments.filter(c => c.status === 'applied').length;
        const dismissed = state.comments.filter(c => c.status === 'dismissed').length;
        m.appendChild(el('div', {},
            `${openN} open` + (applied ? ` . ${applied} applied` : '') + (dismissed ? ` . ${dismissed} dismissed` : '')
        ));
        const counts = document.getElementById('dr-counts');
        if (counts) counts.textContent = `${total} total`;

        const chip = document.getElementById('dr-root-chip');
        if (chip && state.meta.project_root) {
            chip.textContent = truncMiddle(state.meta.project_root, 36);
            chip.title = state.meta.project_root;
        }
    }

    function lastTouchedAt(c) {
        const candidates = [c.ts, c.applied_at, c.dismissed_at, c.reopened_at].filter(Boolean);
        if (candidates.length === 0) return 0;
        return Math.max.apply(null, candidates.map(t => Date.parse(t) || 0));
    }

    function renderList() {
        const list = document.getElementById('dr-list');
        if (!list) return;
        clearKids(list);
        const visible = state.comments
            .filter(c => state.showResolved || isOpen(c))
            .slice()
            .sort((a, b) => lastTouchedAt(b) - lastTouchedAt(a));
        if (visible.length === 0) {
            const emptyMsg = state.comments.length === 0
                ? 'No comments yet. Select text in the document, then click "+ New comment" (or click first, then select).'
                : 'No open comments. Tick "Show applied / dismissed" to see resolved ones.';
            list.appendChild(el('div', { class: 'dr-empty' }, emptyMsg));
            return;
        }
        for (const c of visible) {
            list.appendChild(renderCard(c));
        }
    }

    function renderCard(c) {
        const status = c.status || 'open';
        const statusClass = (status === 'applied' || status === 'dismissed') ? ' status-' + status : '';
        const card = el('div', { class: 'dr-card ' + c.severity + statusClass, onclick: () => {
            if (c.page && !state.plain) goToPage(c.page);
        }});
        const anchorRow = el('div', { class: 'dr-anchor' });
        const anchorText = c.page_label
            ? `p${c.page || '?'} . ${c.page_label}`
            : (c.page ? `p${c.page}` : 'inline');
        anchorRow.appendChild(document.createTextNode(anchorText));
        if (status === 'applied') {
            anchorRow.appendChild(el('span', { class: 'dr-status-badge applied' }, 'applied'));
        } else if (status === 'dismissed') {
            anchorRow.appendChild(el('span', { class: 'dr-status-badge dismissed' }, 'dismissed'));
        } else if (status === 'reopened') {
            anchorRow.appendChild(el('span', { class: 'dr-status-badge reopened' }, 'reopened'));
        }
        card.appendChild(anchorRow);
        if (c.selected_text) {
            card.appendChild(el('span', { class: 'dr-quote' }, c.selected_text));
        }
        card.appendChild(el('div', { class: 'dr-comment' }, c.comment));
        if (c.suggested) {
            card.appendChild(el('div', { class: 'dr-suggested', html: '<b>suggested:</b> ' + escapeHtml(c.suggested) }));
        }
        if (c.applied_note) {
            card.appendChild(el('div', { class: 'dr-applied-note' }, c.applied_note));
        }
        const actions = el('div', { class: 'dr-card-actions' });

        if (status === 'open' || status === 'reopened') {
            const queued = state.queuedIds.has(c.id);
            const applyBtn = el('button', {
                class: 'dr-apply',
                title: 'Queue for auto-apply by Claude Code',
                onclick: async (e) => {
                    e.stopPropagation();
                    if (state.queuedIds.has(c.id)) return;
                    state.queuedIds.add(c.id);
                    try { await API.enqueue(c.id); } catch (err) { /* ignore */ }
                    renderList();
                }
            }, queued ? 'queued' : 'Apply');
            if (queued) applyBtn.setAttribute('disabled', 'disabled');
            actions.appendChild(applyBtn);
            if (queued) {
                actions.appendChild(el('span', { class: 'dr-queued-badge' }, 'queued for apply'));
            }
        }

        if (status === 'applied' || status === 'dismissed') {
            const reopen = el('button', {
                class: 'dr-reopen', title: 'Reopen and amend',
                onclick: (e) => {
                    e.stopPropagation();
                    reopenComment(c);
                }
            }, 'Reopen');
            actions.appendChild(reopen);
        }
        const del = el('button', {
            class: 'dr-del', title: 'Delete',
            onclick: async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this comment?')) return;
                await API.del(c.id);
                await refresh();
            }
        }, 'x');
        actions.appendChild(del);
        card.appendChild(actions);
        return card;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function hasUsableSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        const text = sel.toString().trim();
        if (!text) return false;
        const range = sel.getRangeAt(0);
        let node = range.startContainer;
        while (node && node.nodeType !== 1) node = node.parentNode;
        if (!node) return false;
        if (node.closest('#dr-overlay') || node.closest('#dr-form') || node.closest('#dr-capture-banner') || node.closest('#dr-nav')) {
            return false;
        }
        return true;
    }

    function startCapture() {
        if (hasUsableSelection()) {
            const anchor = captureSelection();
            if (anchor) {
                showForm(anchor);
                return;
            }
        }
        state.captureMode = true;
        document.body.classList.add('dr-capture-mode');
        const b = document.getElementById('dr-capture-banner');
        if (!b) {
            const banner = el('div', { id: 'dr-capture-banner' },
                'Capture mode: select text or click a paragraph to anchor. ',
                el('a', { href: '#', onclick: (e) => { e.preventDefault(); cancelCapture(); }, style: 'color:#f4a261; margin-left:8px;' }, 'cancel')
            );
            document.body.appendChild(banner);
        }
    }

    function cancelCapture() {
        state.captureMode = false;
        document.body.classList.remove('dr-capture-mode');
        const b = document.getElementById('dr-capture-banner');
        if (b) b.remove();
        const f = document.getElementById('dr-form');
        if (f) f.remove();
        state.pendingAnchor = null;
        state.editingId = null;
    }

    function reopenComment(c) {
        state.editingId = c.id;
        const anchor = {
            page: c.page,
            page_label: c.page_label,
            selector: c.selector,
            selected_text: c.selected_text,
            context_before: c.context_before,
            context_after: c.context_after,
            _existing: {
                severity: c.severity,
                comment: c.comment,
                suggested: c.suggested,
                status: c.status,
                applied_note: c.applied_note || null
            }
        };
        if (c.page && !state.plain) goToPage(c.page);
        showForm(anchor);
    }

    function findPageInfo(node) {
        let n = node;
        while (n && n.nodeType !== 1) n = n.parentNode;
        while (n && !(n.classList && n.classList.contains('page'))) {
            n = n.parentNode;
        }
        if (!n) return { page: null, label: null, selector: null };
        const allPages = Array.from(document.querySelectorAll('.page'));
        const idx = allPages.indexOf(n) + 1;
        const labelEl = n.querySelector('.page-label');
        const label = labelEl ? labelEl.textContent.trim() : null;
        const selector = '.page:nth-of-type(' + idx + ')';
        return { page: idx, label, selector };
    }

    function captureSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const text = sel.toString().trim();
        if (!text) return null;
        const range = sel.getRangeAt(0);
        const pageInfo = state.plain
            ? { page: null, label: null, selector: null }
            : findPageInfo(range.startContainer);
        let context_before = '';
        let context_after = '';
        try {
            const startNode = range.startContainer;
            if (startNode.nodeType === 3) {
                context_before = startNode.textContent.slice(Math.max(0, range.startOffset - 30), range.startOffset);
            }
            const endNode = range.endContainer;
            if (endNode.nodeType === 3) {
                context_after = endNode.textContent.slice(range.endOffset, range.endOffset + 30);
            }
        } catch (e) { /* ignore */ }
        sel.removeAllRanges();
        return {
            page: pageInfo.page,
            page_label: pageInfo.label,
            selector: pageInfo.selector,
            selected_text: text,
            context_before,
            context_after
        };
    }

    function captureClick(target) {
        let n = target;
        while (n && n.nodeType === 1) {
            const tag = n.tagName.toLowerCase();
            if (['p', 'h1', 'h2', 'h3', 'h4', 'li', 'figcaption', 'div'].includes(tag) && n.id !== 'dr-overlay' && !n.closest('#dr-overlay') && !n.closest('#dr-form') && !n.closest('#dr-capture-banner')) {
                const pageInfo = state.plain
                    ? { page: null, label: null, selector: null }
                    : findPageInfo(n);
                const snippet = (n.textContent || '').trim().slice(0, 80);
                return {
                    page: pageInfo.page,
                    page_label: pageInfo.label,
                    selector: pageInfo.selector ? (pageInfo.selector + ' > ' + tag) : null,
                    selected_text: snippet,
                    context_before: '',
                    context_after: ''
                };
            }
            n = n.parentNode;
        }
        return null;
    }

    function showForm(anchor) {
        state.pendingAnchor = anchor;
        const existing = document.getElementById('dr-form');
        if (existing) existing.remove();

        const isReopen = !!anchor._existing;
        const exist = anchor._existing || {};

        const form = el('div', { id: 'dr-form' });
        const header = isReopen ? 'Reopen and amend' : 'New comment';
        const sub = anchor.page
            ? `Anchor: p${anchor.page}${anchor.page_label ? ' . ' + anchor.page_label : ''}`
            : 'Anchor: inline';
        form.appendChild(el('h4', {}, `${header} - ${sub}`));

        const anchorBlock = el('div', { class: 'dr-form-anchor' });
        if (anchor.selected_text) {
            anchorBlock.appendChild(el('span', { class: 'dr-quote' }, anchor.selected_text.length > 200 ? anchor.selected_text.slice(0, 200) + '...' : anchor.selected_text));
        }
        if (isReopen && exist.applied_note) {
            anchorBlock.appendChild(el('div', {
                style: 'margin-top:6px; font-size:10.5px; color:#1a4d44; font-family:monospace; background:#eaf6f1; padding:4px 6px; border-left:2px solid #2a9d8f;'
            }, 'Previous apply: ' + exist.applied_note));
        }
        form.appendChild(anchorBlock);

        const sevRow = el('div', { class: 'dr-sev-row' });
        const sevOpts = [
            { v: 'typo', t: 'Typo' },
            { v: 'edit', t: 'Edit' },
            { v: 'rewrite', t: 'Rewrite' },
        ];
        const initialSev = exist.severity || 'edit';
        for (const { v, t } of sevOpts) {
            const lbl = el('label', {});
            const input = el('input', { type: 'radio', name: 'dr-sev', value: v });
            if (v === initialSev) input.checked = true;
            lbl.appendChild(input);
            lbl.appendChild(el('span', {}, t));
            sevRow.appendChild(lbl);
        }
        form.appendChild(sevRow);

        const commentArea = el('textarea', {
            placeholder: isReopen ? 'Amended comment (replaces previous)...' : 'Comment...',
            rows: 3
        });
        commentArea.id = 'dr-comment-text';
        if (isReopen && exist.comment) commentArea.value = exist.comment;
        form.appendChild(commentArea);

        const suggestArea = el('textarea', {
            placeholder: isReopen ? 'Amended suggested replacement (optional)' : 'Suggested replacement (optional)',
            rows: 2
        });
        suggestArea.id = 'dr-suggest-text';
        if (isReopen && exist.suggested) suggestArea.value = exist.suggested;
        form.appendChild(suggestArea);

        const actions = el('div', { class: 'dr-form-actions' },
            el('button', { class: 'cancel', onclick: cancelCapture }, 'Cancel'),
            el('button', { onclick: saveComment }, isReopen ? 'Reopen' : 'Save')
        );
        form.appendChild(actions);

        document.body.appendChild(form);
        commentArea.focus();
        if (isReopen) {
            const len = commentArea.value.length;
            commentArea.setSelectionRange(len, len);
        }
    }

    async function saveComment() {
        const anchor = state.pendingAnchor;
        if (!anchor) return;
        const sev = document.querySelector('input[name=dr-sev]:checked').value;
        const comment = document.getElementById('dr-comment-text').value.trim();
        const suggested = document.getElementById('dr-suggest-text').value.trim();
        if (!comment) {
            alert('Comment cannot be empty');
            return;
        }
        if (state.editingId) {
            await API.patch(state.editingId, {
                severity: sev,
                comment,
                suggested: suggested || null,
                status: 'reopened',
                reopened_at: new Date().toISOString()
            });
        } else {
            await API.add({
                ...anchor,
                severity: sev,
                comment,
                suggested: suggested || null
            });
        }
        cancelCapture();
        await refresh();
    }

    async function refresh() {
        const data = await API.list();
        state.comments = data.comments || [];
        renderMeta();
        renderList();
    }

    function statusSig(c) {
        return (c.status || 'open') + ':' + (c.applied_at || '') + ':' + (c.dismissed_at || '');
    }

    function hasStatusTransition(oldCs, newCs) {
        const oldMap = {};
        for (const c of oldCs) oldMap[c.id] = statusSig(c);
        for (const c of newCs) {
            if (oldMap[c.id] && oldMap[c.id] !== statusSig(c)) return true;
        }
        return false;
    }

    function startPolling() {
        if (state.pollHandle) return;
        function sigOf(cs) {
            return cs.map(c => c.id + ':' + statusSig(c)).join('|');
        }
        state.pollHandle = setInterval(async () => {
            try {
                const data = await API.list();
                const fresh = data.comments || [];
                const newSig = sigOf(fresh) + ':' + fresh.length;
                for (const c of fresh) {
                    if ((c.status === 'applied' || c.status === 'dismissed') && state.queuedIds.has(c.id)) {
                        state.queuedIds.delete(c.id);
                    }
                }
                if (newSig !== state.lastEtag) {
                    const prevComments = state.comments;
                    state.lastEtag = newSig;
                    state.comments = fresh;
                    renderMeta();
                    renderList();
                    if (hasStatusTransition(prevComments, fresh)) {
                        try { sessionStorage.setItem(pageStorageKey(), String(state.currentPage)); } catch (e) {}
                        location.reload();
                    }
                }
            } catch (e) { /* swallow */ }
        }, 5000);
    }

    function pageStorageKey() {
        const slug = (state.meta && state.meta.doc_slug) || location.pathname;
        return 'dr-current-page:' + slug;
    }

    document.addEventListener('mouseup', (e) => {
        if (!state.captureMode) return;
        if (e.target.closest('#dr-overlay') || e.target.closest('#dr-form') || e.target.closest('#dr-capture-banner')) return;
        const anchor = captureSelection();
        if (anchor) {
            showForm(anchor);
            return;
        }
    });

    document.addEventListener('click', (e) => {
        if (!state.captureMode) return;
        if (e.target.closest('#dr-overlay') || e.target.closest('#dr-form') || e.target.closest('#dr-capture-banner')) return;
        const sel = window.getSelection();
        if (sel && sel.toString().trim()) return;
        const anchor = captureClick(e.target);
        if (anchor) {
            e.preventDefault();
            e.stopPropagation();
            showForm(anchor);
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.captureMode) {
            cancelCapture();
            return;
        }
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        if (state.plain) return;

        if (e.key === 'PageDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            goToPage(state.currentPage + 1);
        } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPage(state.currentPage - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            goToPage(1);
        } else if (e.key === 'End') {
            e.preventDefault();
            goToPage(state.totalPages);
        }
    });

    function buildNav() {
        const pages = document.querySelectorAll('.page');
        state.totalPages = pages.length;
        if (state.totalPages === 0) return;

        const nav = el('div', { id: 'dr-nav' });
        const prev = el('button', { title: 'Previous page (PgUp / Left)', onclick: () => goToPage(state.currentPage - 1) }, '<');
        const next = el('button', { title: 'Next page (PgDn / Right)', onclick: () => goToPage(state.currentPage + 1) }, '>');
        const input = el('input', { class: 'dr-page-input', type: 'number', min: 1, max: state.totalPages, value: 1 });
        input.addEventListener('change', () => {
            const v = parseInt(input.value, 10);
            if (v) goToPage(v);
        });
        const of = el('span', { class: 'dr-page-of' }, '/ ' + state.totalPages);
        const label = el('span', { class: 'dr-page-label', id: 'dr-page-label' }, '');
        const modeToggle = el('span', { class: 'dr-mode-toggle', id: 'dr-mode-toggle', onclick: togglePaginated }, 'Paged');

        nav.appendChild(prev);
        nav.appendChild(input);
        nav.appendChild(of);
        nav.appendChild(next);
        nav.appendChild(label);
        nav.appendChild(modeToggle);
        document.body.appendChild(nav);

        state.navEls = { prev, next, input, label, modeToggle };
    }

    function goToPage(n) {
        if (!state.totalPages) return;
        n = Math.max(1, Math.min(state.totalPages, n));
        state.currentPage = n;
        const pages = document.querySelectorAll('.page');
        pages.forEach((p, i) => {
            if (i + 1 === n) p.classList.add('dr-current-page');
            else p.classList.remove('dr-current-page');
        });
        if (state.navEls) {
            state.navEls.input.value = n;
            state.navEls.prev.disabled = (n <= 1);
            state.navEls.next.disabled = (n >= state.totalPages);
            const current = pages[n - 1];
            const labelEl = current ? current.querySelector('.page-label') : null;
            state.navEls.label.textContent = labelEl ? labelEl.textContent.trim() : '';
        }
        if (state.paginated) {
            window.scrollTo(0, 0);
        } else {
            const target = pages[n - 1];
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function togglePaginated() {
        state.paginated = !state.paginated;
        document.body.classList.toggle('dr-paginated', state.paginated);
        if (state.navEls) {
            state.navEls.modeToggle.textContent = state.paginated ? 'Paged' : 'Scroll';
        }
        if (state.paginated) goToPage(state.currentPage);
    }

    async function init() {
        buildOverlay();
        state.meta = await API.meta();
        state.plain = !!state.meta.plain || document.body.classList.contains('dr-plain');
        if (!state.plain) {
            buildNav();
            document.body.classList.add('dr-paginated');
            let startPage = 1;
            try {
                const saved = sessionStorage.getItem(pageStorageKey());
                if (saved) {
                    const n = parseInt(saved, 10);
                    if (n >= 1 && n <= state.totalPages) startPage = n;
                    sessionStorage.removeItem(pageStorageKey());
                }
            } catch (e) {}
            goToPage(startPage);
        }
        await refresh();
        startPolling();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
