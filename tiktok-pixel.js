(() => {
  // Script reinsertion must not initialize, subscribe or send PageView twice.
  if (window.FunnelPixel) return;
  const config = window.FUNNEL_CONFIG?.tiktokPixel || {};
  const pixelId = String(config.id || '').trim();
  const enabled = config.enabled === true && /^[a-z0-9]{20}$/i.test(pixelId);
  const consent = window.FunnelConsent;
  const hasConsent = () => consent?.isMarketingGranted() === true;
  const bounded = (value, fallback, max) => Number.isFinite(value)
    ? Math.min(max, Math.max(0, value)) : fallback;
  const readyTimeout = bounded(config.sdkReadyTimeoutMs, 1500, 5000);
  const navigationDelay = bounded(config.navigationDelayMs, 600, 2000);
  let initialized = false;
  let pageQueued = false;
  let registrationQueued = false;
  let failed = false;
  const pendingOwnEvents = new Map();
  let settleReady;
  const sdkReady = new Promise(resolve => { settleReady = resolve; });
  const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  function announce(state) {
    // Local diagnostic signal only; no additional network tracking or identifiers.
    window.dispatchEvent(new CustomEvent('funnel:pixel-status', { detail: { state } }));
  }

  function queueEvent(method, ...args) {
    const ttq = window.ttq;
    const before = Array.isArray(ttq) ? ttq.length : -1;
    ttq[method](...args);
    if (before >= 0 && Array.isArray(ttq[before]) && ttq[before][0] === method) {
      pendingOwnEvents.set(ttq[before], method);
    }
  }

  function discardPendingEvents() {
    const ttq = window.ttq;
    if (!Array.isArray(ttq)) return;
    for (const [entry, method] of pendingOwnEvents) {
      const index = ttq.indexOf(entry);
      if (index < 0) continue;
      ttq.splice(index, 1);
      if (method === 'page') pageQueued = false;
      if (method === 'track') registrationQueued = false;
    }
    pendingOwnEvents.clear();
  }

  function initialize() {
    if (!enabled || !hasConsent() || initialized) return;
    initialized = true;
    try {
      window.TiktokAnalyticsObject = window.TiktokAnalyticsObject || 'ttq';
      const ttq = window.ttq = window.ttq || [];
      // TikTok's documented queue pattern, written without obfuscation.
      const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
        'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
        'holdConsent', 'revokeConsent', 'grantConsent'];
      const defer = (target, name) => {
        if (typeof target[name] !== 'function') {
          target[name] = (...args) => target.push([name, ...args]);
        }
      };
      ttq.methods = ttq.methods || methods;
      ttq.setAndDefer = ttq.setAndDefer || defer;
      methods.forEach(name => defer(ttq, name));
      ttq.instance = ttq.instance || (id => {
        const instance = (ttq._i || {})[id] || [];
        methods.forEach(name => defer(instance, name));
        return instance;
      });
      ttq.load = ttq.load || ((id, options = {}) => {
        ttq._i = ttq._i || {};
        if (ttq._i[id]) return;
        ttq._i[id] = [];
        ttq._i[id]._u = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._t = ttq._t || {};
        ttq._t[id] = Date.now();
        ttq._o = ttq._o || {};
        ttq._o[id] = options;
        const script = document.createElement('script');
        script.async = true;
        script.src = ttq._i[id]._u + '?sdkid=' + encodeURIComponent(id) + '&lib=ttq';
        script.dataset.funnelTiktokPixel = id;
        script.onerror = () => {
          failed = true;
          settleReady(false);
          announce('sdk-load-failed');
        };
        document.head.appendChild(script);
      });
      if (!ttq._i?.[pixelId]) ttq.load(pixelId);
      ttq.ready(() => { settleReady(true); announce('sdk-ready'); });
      ttq.grantConsent();
      if (!pageQueued) {
        queueEvent('page');
        pageQueued = true;
        announce('page-queued');
      }
    } catch {
      failed = true;
      settleReady(false);
      announce('initialization-failed');
    }
  }

  const api = Object.freeze({
    async trackRegistration() {
      if (!enabled || !hasConsent() || registrationQueued) return false;
      initialize();
      if (failed) return false;
      // Wait for SDK readiness before tracking when a user clicks during loading.
      // TikTok track() has no delivery acknowledgement; this wait is best effort.
      await Promise.race([sdkReady, delay(readyTimeout)]);
      if (failed || !hasConsent() || registrationQueued) return false;
      try {
        queueEvent('track', 'CompleteRegistration');
        registrationQueued = true;
        announce('registration-queued');
      } catch {
        announce('registration-failed');
        return false;
      }
      // Keep the document alive briefly so the SDK can start its browser request.
      // This is not a guarantee of receipt; verify in TikTok Events Manager.
      await delay(navigationDelay);
      return true;
    }
  });
  window.FunnelPixel = api;
  consent?.subscribe(granted => {
    if (granted === true) {
      if (!initialized) initialize();
      else if (!failed) {
        window.ttq?.grantConsent();
        if (!pageQueued) {
          queueEvent('page'); pageQueued = true; announce('page-queued');
        }
      }
    } else if (initialized) {
      discardPendingEvents();
      window.ttq?.revokeConsent();
      announce('consent-revoked');
    }
  });
  initialize();
})();
