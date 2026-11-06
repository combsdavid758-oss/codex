(() => {
  const sensitive = /token|cookie|authorization|password|secret|email|phone/i;
  const linkKey = /^(?:url|scheme|deeplink|deep_link|deeplink_url|deep_link_url|website_url|destination_url|landing_page_url|redirect_url|redirectUrl|fallback_url|linkType|enable_deeplink)$/i;
  function cleanUrl(value) {
    if (!/^(?:https?:|snssdk\d+:|aweme:)/i.test(value)) return null;
    try {
      const url = new URL(value);
      url.username = ''; url.password = '';
      for (const key of [...url.searchParams.keys()]) {
        // Redact all query values rather than guessing which identifiers are private.
        url.searchParams.set(key, '[redacted]');
      }
      url.hash = '';
      return url.href;
    } catch { return null; }
  }
  function extractLinks(value) {
    const found = [];
    function walk(node, path, depth, parentIsLink = false) {
      if (depth > 18 || found.length >= 100) return;
      if (typeof node === 'string' && node.length < 500000 && /^[\[{]/.test(node.trim())) {
        try { walk(JSON.parse(node), path + ' (JSON)', depth + 1, parentIsLink); } catch {}
        return;
      }
      if (!node || typeof node !== 'object') return;
      for (const [key, item] of Object.entries(node)) {
        if (sensitive.test(key)) continue;
        const next = path + '.' + key;
        const isLink = /link|destination|website/i.test(key);
        if (typeof item === 'string' && linkKey.test(key)) {
          const cleaned = cleanUrl(item);
          if (cleaned) found.push({ path: next, value: cleaned });
          else if (/scheme|deeplink|deep_link/i.test(key) && item === '') found.push({ path: next, value: '' });
          else if (key === 'linkType') found.push({ path: next, value: item.slice(0, 40) });
        } else if (typeof item === 'boolean' && (linkKey.test(key) || (key === 'enable' && parentIsLink))) {
          found.push({ path: next, value: item });
        } else if (typeof item === 'object' || typeof item === 'string') {
          walk(item, next, depth + 1, isLink || parentIsLink);
        }
        if (found.length >= 100) break;
      }
    }
    walk(value, '$', 0);
    return found;
  }
  globalThis.extractLinks = extractLinks;
})();
