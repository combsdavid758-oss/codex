// Bridge for the site's existing consent manager. No banner or consent inference.
// Call setMarketingConsent with an explicit boolean from that manager's initial
// state and whenever its marketing/advertising category changes.
(() => {
  if (window.FunnelConsent) return;
  let granted = false;
  const listeners = new Set();
  window.FunnelConsent = Object.freeze({
    isMarketingGranted: () => granted,
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    setMarketingConsent(value) {
      const next = value === true;
      if (next === granted) return;
      granted = next;
      listeners.forEach(callback => callback(granted));
    }
  });
})();
