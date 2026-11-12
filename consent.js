// Small first-party opt-in. Marketing consent is never inferred from navigation.
(() => {
  if (window.FunnelConsent) return;
  const storageKey = 'glusus.marketing-consent.v1';
  const maxAge = 180 * 24 * 60 * 60 * 1000;
  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      const age = Date.now() - value?.updatedAt;
      return typeof value?.granted === 'boolean' && Number.isFinite(age) && age >= 0 && age < maxAge ? value.granted : null;
    } catch { return null; }
  }
  let choice = readChoice();
  let panel;
  let returnFocus;
  const listeners = new Set();
  function update(value, persist) {
    const previous = choice === true;
    choice = value;
    if (persist) {
      try { localStorage.setItem(storageKey, JSON.stringify({ granted: value, updatedAt: Date.now() })); }
      catch { /* A blocked store must not prevent a visitor from choosing. */ }
    }
    if (panel) panel.hidden = choice !== null;
    if (previous !== (choice === true)) listeners.forEach(callback => callback(choice === true));
  }
  window.FunnelConsent = Object.freeze({
    isMarketingGranted: () => choice === true,
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    setMarketingConsent(value) {
      update(value === true, true);
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) update(readChoice(), false);
  });

  function mount() {
    panel = document.createElement('section');
    panel.className = 'consent-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', 'marketing-consent-title');
    panel.hidden = choice !== null;
    panel.innerHTML = '<button type="button" class="consent-dismiss" aria-label="Close privacy notice">×</button>' +
      '<h2 id="marketing-consent-title">Advertising privacy</h2>' +
      '<p>Allow TikTok tracking to measure visits and offer-button clicks? You can reject it and still use this site. Change your choice anytime in Privacy settings.</p>' +
      '<div class="consent-actions"><button type="button" data-consent-choice="reject">Reject tracking</button>' +
      '<button type="button" data-consent-choice="accept">Accept tracking</button></div>';
    panel.querySelector('.consent-dismiss').addEventListener('click', () => {
      panel.hidden = true;
      returnFocus?.focus({ preventScroll: true });
    });
    panel.querySelectorAll('[data-consent-choice]').forEach(button => {
      button.addEventListener('click', () => {
        window.FunnelConsent.setMarketingConsent(button.dataset.consentChoice === 'accept');
        returnFocus?.focus({ preventScroll: true });
      });
    });
    document.body.appendChild(panel);
    const footers = [...document.querySelectorAll('.footer')];
    if (!footers.length && document.querySelector('.card')) document.body.classList.add('consent-card-page');
    const hosts = footers.length ? footers : [document.querySelector('.card') || document.body];
    hosts.forEach(host => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'consent-settings';
      button.textContent = 'Privacy settings';
      button.addEventListener('click', () => {
        returnFocus = button;
        panel.hidden = false;
        panel.querySelector('[data-consent-choice="reject"]').focus({ preventScroll: true });
      });
      host.appendChild(button);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
