(function () {
  'use strict';

  const LABEL = 'Copy link';
  const LABEL_DONE = 'Copied!';

  // The link to the website itself (no hash or query string)
  function siteUrl() {
    return window.location.origin + window.location.pathname;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for browsers without the Clipboard API
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('Copy failed');
  }

  document.querySelectorAll('.share-website-btn').forEach((btn) => {
    btn.textContent = LABEL;
    const status = btn.parentElement
      ? btn.parentElement.querySelector('.share-website-status')
      : null;
    let timer = null;

    btn.addEventListener('click', async () => {
      let message = 'Link copied';
      let label = LABEL_DONE;
      try {
        await copyText(siteUrl());
      } catch (error) {
        message = 'Could not copy the link';
        label = LABEL;
      }
      btn.textContent = label;
      if (status) status.textContent = message;
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = LABEL;
        if (status) status.textContent = '';
      }, 2000);
    });
  });
})();