/* News tab: realtime feed in Firestore at mapState/news/posts
   Supports simple formatting (**bold**, *italic*, # headings, [links](https://...))
   and up to 3 photos per post (compressed in the browser, stored in the post). */
(function () {
  const tabBtn = document.getElementById('newsTabBtn');
  const view = document.getElementById('newsView');
  if (!tabBtn || !view) return;

  const form = document.getElementById('newsForm');
  const titleInput = document.getElementById('newsTitleInput');
  const bodyInput = document.getElementById('newsBodyInput');
  const sourceInput = document.getElementById('newsSourceInput');
  const statusEl = document.getElementById('newsStatus');
  const publishBtn = document.getElementById('newsPublishBtn');
  const listEl = document.getElementById('newsList');
  const toolbar = document.getElementById('newsToolbar');
  const imageInput = document.getElementById('newsImageInput');
  const previewEl = document.getElementById('newsImagePreview');

  const MAX_IMAGES = 3;
  const MAX_TOTAL_CHARS = 850000; // Firestore documents are limited to 1 MB
  let pendingImages = [];

  const postsRef = (typeof db !== 'undefined' && db)
    ? db.collection('mapState').doc('news').collection('posts')
    : null;

  let unsubscribe = null;

  /* ---------- tab switching ---------- */
  function activate() {
    document.querySelectorAll('#sidebarTabs .sidebar-tab').forEach((b) => {
      b.setAttribute('aria-selected', String(b === tabBtn));
    });
    document.querySelectorAll('#sidebarViews .sidebar-view').forEach((v) => {
      const on = v === view;
      v.classList.toggle('is-active', on);
      v.hidden = !on;
    });
    const eyebrow = document.getElementById('sidebarEyebrow');
    if (eyebrow) eyebrow.textContent = 'News';
    subscribe();
  }
  function deactivate() {
    view.classList.remove('is-active');
    view.hidden = true;
  }
  tabBtn.addEventListener('click', activate);
  document.querySelectorAll('#sidebarTabs .sidebar-tab').forEach((b) => {
    if (b !== tabBtn) b.addEventListener('click', deactivate);
  });

  /* ---------- helpers ---------- */
  function safeUrl(raw) {
    try {
      const u = new URL(String(raw).trim());
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
    } catch (e) { return null; }
  }
  function setStatus(msg, isError) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', !!isError);
  }
  function formatDate(ts) {
    if (!ts || !ts.toDate) return 'Just now';
    return ts.toDate().toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* ---------- formatting (built with DOM nodes, never innerHTML) ---------- */
  const INLINE_RE = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

  function renderInline(text, parent) {
    let last = 0;
    text.replace(INLINE_RE, (match, _g, offset) => {
      if (offset > last) parent.appendChild(document.createTextNode(text.slice(last, offset)));
      if (match.startsWith('***')) {
        const s = document.createElement('strong');
        const e = document.createElement('em');
        e.textContent = match.slice(3, -3);
        s.appendChild(e);
        parent.appendChild(s);
      } else if (match.startsWith('**')) {
        const s = document.createElement('strong');
        renderInline(match.slice(2, -2), s);
        parent.appendChild(s);
      } else if (match.startsWith('*')) {
        const e = document.createElement('em');
        e.textContent = match.slice(1, -1);
        parent.appendChild(e);
      } else {
        const m = match.match(/^\[([^\]]+)\]\((.+)\)$/);
        const href = m && safeUrl(m[2]);
        if (href) {
          const a = document.createElement('a');
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = m[1];
          parent.appendChild(a);
        } else {
          parent.appendChild(document.createTextNode(match));
        }
      }
      last = offset + match.length;
      return match;
    });
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function renderFormatted(text, container) {
    let para = [];
    function flush() {
      if (!para.length) return;
      const p = document.createElement('p');
      para.forEach((line, i) => {
        if (i) p.appendChild(document.createElement('br'));
        renderInline(line, p);
      });
      container.appendChild(p);
      para = [];
    }
    String(text).split(/\r?\n/).forEach((line) => {
      const h = line.match(/^(#{1,3})\s+(.+)$/);
      if (h) {
        flush();
        const el = document.createElement('div');
        el.className = 'news-h news-h' + h[1].length;
        renderInline(h[2], el);
        container.appendChild(el);
      } else if (!line.trim()) {
        flush();
      } else {
        para.push(line);
      }
    });
    flush();
  }

  /* ---------- lightbox ---------- */
  function openLightbox(src) {
    const overlay = document.createElement('div');
    overlay.className = 'news-lightbox';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'News photo';
    overlay.appendChild(img);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }

  /* ---------- feed ---------- */
  function render(snapshot) {
    listEl.textContent = '';
    if (snapshot.empty) {
      const empty = document.createElement('div');
      empty.className = 'news-empty';
      empty.textContent = 'No news posted yet.';
      listEl.appendChild(empty);
      return;
    }
    snapshot.forEach((doc) => {
      const d = doc.data();
      const item = document.createElement('article');
      item.className = 'news-item';

      const meta = document.createElement('div');
      meta.className = 'news-meta';
      const time = document.createElement('span');
      time.textContent = formatDate(d.createdAt);
      meta.appendChild(time);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'news-delete-btn admin-only';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (!confirm('Delete this post?')) return;
        postsRef.doc(doc.id).delete().catch((err) => alert('Could not delete: ' + err.message));
      });
      meta.appendChild(del);
      item.appendChild(meta);

      if (d.title) {
        const h = document.createElement('h3');
        h.className = 'news-title';
        h.textContent = d.title;
        item.appendChild(h);
      }

      const body = document.createElement('div');
      body.className = 'news-body';
      renderFormatted(d.body || '', body);
      item.appendChild(body);

      if (Array.isArray(d.images) && d.images.length) {
        const gallery = document.createElement('div');
        gallery.className = 'news-images';
        d.images.forEach((src) => {
          if (typeof src !== 'string' || !src.startsWith('data:image/')) return;
          const img = document.createElement('img');
          img.src = src;
          img.alt = 'News photo';
          img.loading = 'lazy';
          img.addEventListener('click', () => openLightbox(src));
          gallery.appendChild(img);
        });
        item.appendChild(gallery);
      }

      const href = d.source ? safeUrl(d.source) : null;
      if (href) {
        const a = document.createElement('a');
        a.className = 'news-source';
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Source: ' + new URL(href).hostname.replace(/^www\./, '');
        item.appendChild(a);
      } else if (d.source) {
        const s = document.createElement('div');
        s.className = 'news-source';
        s.style.textDecoration = 'none';
        s.textContent = 'Source: ' + d.source;
        item.appendChild(s);
      }

      listEl.appendChild(item);
    });
  }

  function subscribe() {
    if (!postsRef) {
      listEl.textContent = 'News is unavailable (database not connected).';
      return;
    }
    if (unsubscribe) return;
    unsubscribe = postsRef
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(render, (err) => {
        listEl.textContent = 'Could not load news: ' + err.message;
        unsubscribe = null;
      });
  }

  /* ---------- composer: formatting toolbar ---------- */
  function wrapSelection(before, after, placeholder) {
    const s = bodyInput.selectionStart;
    const e = bodyInput.selectionEnd;
    const sel = bodyInput.value.slice(s, e) || placeholder;
    bodyInput.setRangeText(before + sel + after, s, e, 'select');
    bodyInput.focus();
  }
  function prefixLine(prefix) {
    const v = bodyInput.value;
    const s = bodyInput.selectionStart;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    bodyInput.setRangeText(prefix, lineStart, lineStart, 'end');
    bodyInput.focus();
  }
  if (toolbar && bodyInput) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fmt]');
      if (!btn) return;
      const f = btn.dataset.fmt;
      if (f === 'bold') wrapSelection('**', '**', 'bold text');
      else if (f === 'italic') wrapSelection('*', '*', 'italic text');
      else if (f === 'heading') prefixLine('## ');
      else if (f === 'link') {
        const url = prompt('Link address (https://…)');
        if (url) wrapSelection('[', '](' + url.trim() + ')', 'link text');
      }
    });
  }

  /* ---------- composer: images ---------- */
  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image.'));
      };
      img.src = url;
    });
  }

  function renderPreview() {
    if (!previewEl) return;
    previewEl.textContent = '';
    pendingImages.forEach((src, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'news-thumb';
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Selected photo ' + (i + 1);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove photo');
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        pendingImages.splice(i, 1);
        renderPreview();
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      previewEl.appendChild(wrap);
    });
  }

  async function addFiles(files) {
    setStatus('');
    for (const f of files) {
      if (pendingImages.length >= MAX_IMAGES) {
        setStatus('Up to ' + MAX_IMAGES + ' photos per post.', true);
        break;
      }
      if (!f.type.startsWith('image/')) continue;
      try {
        let data = await compressImage(f, 1100, 0.7);
        if (data.length > 250000) data = await compressImage(f, 800, 0.6);
        pendingImages.push(data);
      } catch (err) {
        setStatus(err.message, true);
      }
    }
    renderPreview();
  }

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      addFiles(Array.from(imageInput.files));
      imageInput.value = '';
    });
  }

  /* ---------- composer: publish ---------- */
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!postsRef) return setStatus('Database not connected.', true);

      const body = bodyInput.value.trim();
      const title = titleInput.value.trim();
      const source = sourceInput.value.trim();
      if (!body) return setStatus('Write the news text first.', true);

      const total = pendingImages.reduce((n, s) => n + s.length, 0);
      if (total > MAX_TOTAL_CHARS) {
        return setStatus('Photos are too large together. Remove one or use smaller photos.', true);
      }

      publishBtn.disabled = true;
      setStatus('Publishing…');
      const user = firebase.auth().currentUser;

      postsRef.add({
        title,
        body,
        source,
        images: pendingImages.slice(),
        authorUid: user ? user.uid : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        form.reset();
        pendingImages = [];
        renderPreview();
        setStatus('Published.');
      }).catch((err) => {
        setStatus(err.code === 'permission-denied'
          ? 'Not allowed. Check you are logged in as admin with a verified email.'
          : 'Could not publish: ' + err.message, true);
      }).finally(() => {
        publishBtn.disabled = false;
      });
    });
  }
})();