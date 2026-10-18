/* Adds an SVG icon and a hover name to each sidebar tab.
   Icons are 24x24 line icons; colour and thickness come from tabs.css.
   To use your own icon, replace the shapes for that tab id below. */
(function () {
  const ICONS = {
    // Legend: stacked layers
    legendTabBtn:
      '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    // Casualties: bar chart
    casualtiesTabBtn:
      '<path d="M4 20h16"/><path d="M7 20v-7"/><path d="M12 20V6"/><path d="M17 20v-10"/>',
    // Advances: double arrow forward
    advancesTabBtn:
      '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
    // Frontline: jagged line with end points
    frontlineTabBtn:
      '<path d="M3 17l4-6 4 4 4-7 6 5"/><circle cx="3" cy="17" r="1" fill="currentColor"/><circle cx="21" cy="12" r="1" fill="currentColor"/>',
    // Geolocations: map pin
    geolocationsTabBtn:
      '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    // News: newspaper
    newsTabBtn:
      '<path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2V4z"/><path d="M18 8h2v10a2 2 0 01-2 2"/><path d="M8 8h7M8 12h7M8 16h4"/>',
    // Contact: speech bubble
    contactTabBtn:
      '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8M8 12h5"/>'
  };

  document.querySelectorAll('#sidebarTabs .sidebar-tab').forEach((btn) => {
    if (btn.querySelector(':scope > svg')) return;
    const markup = ICONS[btn.id];
    if (!markup) return;

    // Move the visible text into a visually hidden label (kept for screen readers)
    const text = Array.from(btn.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(' ');
    Array.from(btn.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) n.remove();
    });
    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = text;
    btn.insertBefore(label, btn.firstChild);

    // Name shown on hover / keyboard focus (styled in tabs.css)
    btn.setAttribute('data-tip', text);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = markup;
    btn.insertBefore(svg, btn.firstChild);
  });
})();