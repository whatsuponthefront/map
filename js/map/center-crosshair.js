(function () {
  'use strict';

  // false = the crosshair is always at the true center of the map
  // true  = it follows the middle of the part not covered by the sidebar
  const FOLLOW_SIDEBAR = false;

  const sidebar = document.getElementById('sidebar');
  const mapEl = map.getContainer();

  // --- crosshair ---
  const cross = document.createElement('img');
  cross.id = 'centerCrosshair';
  cross.src = 'img/crosshair.svg';
  cross.alt = '';
  cross.draggable = false;
  cross.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cross);

  // --- coordinates badge ---
  const badge = document.createElement('div');
  badge.id = 'centerCoords';
  badge.innerHTML =
    '<span class="xh-text">—</span>' +
    '<button type="button" class="xh-copy" title="Copy coordinates">Copy</button>' +
    '<button type="button" class="xh-toggle" aria-pressed="true" title="Show/hide the crosshair">⌖</button>';
  document.body.appendChild(badge);

  const textEl = badge.querySelector('.xh-text');
  const copyBtn = badge.querySelector('.xh-copy');
  const toggleBtn = badge.querySelector('.xh-toggle');
  let current = '';

  // --- the point the crosshair marks ---
  function visibleCenter() {
    const m = mapEl.getBoundingClientRect();
    let left = m.left, right = m.right, top = m.top, bottom = m.bottom;

    if (FOLLOW_SIDEBAR && sidebar) {
      const s = sidebar.getBoundingClientRect();
      const cs = getComputedStyle(sidebar);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && s.width > 1 && s.height > 1) {
        const overlapX = Math.min(right, s.right) - Math.max(left, s.left);
        const overlapY = Math.min(bottom, s.bottom) - Math.max(top, s.top);
        if (overlapX > 1 && overlapY > 1) {
          const coversHeight = overlapY >= (bottom - top) - 2;
          const coversWidth = overlapX >= (right - left) - 2;
          if (coversHeight && !coversWidth) {
            // side panel
            if (s.left + s.width / 2 < (left + right) / 2) left = Math.max(left, s.right);
            else right = Math.min(right, s.left);
          } else if (coversWidth && !coversHeight) {
            // bottom or top sheet (mobile layout)
            if (s.top + s.height / 2 > (top + bottom) / 2) bottom = Math.min(bottom, s.top);
            else top = Math.max(top, s.bottom);
          }
        }
      }
    }
    return { x: (left + right) / 2, y: (top + bottom) / 2, mapRect: m };
  }

  function update() {
    const c = visibleCenter();
    cross.style.left = c.x + 'px';
    cross.style.top = c.y + 'px';
    const ll = map.unproject([c.x - c.mapRect.left, c.y - c.mapRect.top]).wrap();
    current = ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6);
    textEl.textContent = current;
  }

  let raf = 0;
  function schedule() {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
  }

  // Follow the sidebar's open/close animation frame by frame.
  function track(ms) {
    const end = performance.now() + ms;
    (function loop() {
      update();
      if (performance.now() < end) requestAnimationFrame(loop);
    })();
  }

  map.on('move', schedule);
  map.on('resize', schedule);
  window.addEventListener('resize', schedule);

  if (FOLLOW_SIDEBAR && sidebar) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(sidebar);
    new MutationObserver(() => track(700)).observe(sidebar, {
      attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
    sidebar.addEventListener('transitionend', schedule);
    new MutationObserver(() => track(700)).observe(document.body, {
      attributes: true, attributeFilter: ['class']
    });
    ['sidebarToggleBtn', 'mapOnlyToggleBtn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => track(700));
    });
  }

  // --- copy ---
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(current);
      copyBtn.textContent = 'Copied';
    } catch (error) {
      copyBtn.textContent = 'Unavailable';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
  });

  // --- show/hide the crosshair (remembered) ---
  let showCross = true;
  try { showCross = localStorage.getItem('showCrosshair') !== '0'; } catch (error) {}
  function applyCross() {
    cross.hidden = !showCross;
    toggleBtn.setAttribute('aria-pressed', String(showCross));
  }
  toggleBtn.addEventListener('click', () => {
    showCross = !showCross;
    try { localStorage.setItem('showCrosshair', showCross ? '1' : '0'); } catch (error) {}
    applyCross();
  });
  applyCross();

  track(400);
})();