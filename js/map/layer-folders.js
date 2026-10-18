/* Groups the rows in #layersList into folders:
   names mentioning Ukraine/Ukrainian -> Ukraine
   names mentioning Russia/Russian      -> Russia
   everything else                    -> Miscellaneous
   If a name mentions both, the word that appears first wins.
   Works on whatever layers.js renders, and regroups after every re-render. */
(function () {
  const list = document.getElementById('layersList');
  if (!list) return;

  const FOLDERS = [
    { key: 'ukraine', title: 'Ukraine' },
    { key: 'russia', title: 'Russia' },
    { key: 'misc', title: 'Miscellaneous' }
  ];
  const UA = /ukrain/i;
  const RU = /russia/i;
  const STORE_KEY = 'layerFoldersCollapsed';

  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { collapsed = {}; }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(collapsed)); } catch (e) { /* ignore */ }
  }

  const folders = {};

  function classify(item) {
    const nameEl = item.querySelector('.layer-name');
    const name = nameEl ? nameEl.textContent : item.textContent;
    const u = name.search(UA);
    const r = name.search(RU);
    if (u >= 0 && (r < 0 || u < r)) return 'ukraine';
    if (r >= 0) return 'russia';
    return 'misc';
  }

  function createFolder(def) {
    const el = document.createElement('section');
    el.className = 'layer-folder';
    el.dataset.folder = def.key;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'layer-folder-header';

    const arrow = document.createElement('span');
    arrow.className = 'layer-folder-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'layer-folder-name';
    name.textContent = def.title;
    const count = document.createElement('span');
    count.className = 'layer-folder-count';
    header.append(arrow, name, count);

    const body = document.createElement('div');
    body.className = 'layer-folder-body';

    function applyState() {
      const isCollapsed = !!collapsed[def.key];
      el.classList.toggle('is-collapsed', isCollapsed);
      header.setAttribute('aria-expanded', String(!isCollapsed));
    }
    header.addEventListener('click', () => {
      collapsed[def.key] = !collapsed[def.key];
      saveState();
      applyState();
    });
    applyState();

    el.append(header, body);
    return { el, body, count };
  }

  function getFolder(def) {
    const f = folders[def.key];
    if (f && f.el.isConnected) return f;
    folders[def.key] = createFolder(def);
    return folders[def.key];
  }

  function regroup() {
    const loose = Array.from(list.children).filter((el) => el.classList.contains('layer-item'));
    if (!loose.length) return;

    observer.disconnect();
    loose.forEach((item) => {
      const def = FOLDERS.find((d) => d.key === classify(item));
      const f = getFolder(def);
      if (!f.el.parentNode) list.appendChild(f.el);
      f.body.appendChild(item);
    });

    // Fixed order, hide empty folders, refresh counts
    FOLDERS.forEach((def) => {
      const f = folders[def.key];
      if (!f || !f.el.isConnected) return;
      const n = f.body.children.length;
      f.count.textContent = String(n);
      f.el.hidden = n === 0;
      list.appendChild(f.el);
    });
    observer.observe(list, { childList: true });
  }

  const observer = new MutationObserver(regroup);
  observer.observe(list, { childList: true });
  regroup();
})();