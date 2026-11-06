// This function is shared by the panel and the inspected page, without external dependencies.
function createFormTest() {
  const allowed = new Set(['LpSubpage', 'LpCardContainer', 'LpCard',
    'LpCardQuestionSet', 'LpFullNameField', 'LpPhoneField', 'LpEmailField',
    'LpAgreement', 'LpCardButtonContainer', 'LpCardBackButton', 'LpNextButton', 'LpSubmit']);
  function patchConfig(config) {
    const data = config?.data;
    if (config?.templateName !== 'cardForm' || data?.meta?.name !== 'LpPage' ||
        data?.virtualForm?.name !== 'LpForm' || !Array.isArray(config.pathList)) return null;
    const form = data.virtualForm;
    if ((form.logicData && Object.keys(form.logicData).length) ||
        (form.leadFilter && form.leadFilter.length)) throw Error('Conditional forms are not supported.');
    const question = data.questionCardSubPage;
    if (question?.name !== 'LpSubpage') throw Error('No recognized question-card section.');
    if (!config.pathList.some(p => p.name === 'thanksSubPage') ||
        !data.thanksSubPage || !data.welcomePageSubPage) throw Error('Expected welcome and final pages are missing.');
    const removed = new Set();
    const fields = [];
    function visit(key) {
      if (removed.has(key)) return;
      const node = data[key];
      if (!node || !allowed.has(node.name)) throw Error('Unrecognized question structure; left unchanged.');
      if (node.name === 'LpCardQuestionSet' && node.questionSetType !== 'contact_fields') {
        throw Error('Only contact-information questions are supported.');
      }
      removed.add(key);
      if (['LpFullNameField', 'LpPhoneField', 'LpEmailField'].includes(node.name)) fields.push(node.name);
      for (const child of node.children || []) visit(child);
    }
    visit('questionCardSubPage');
    if (!fields.length) throw Error('No contact fields found.');
    for (const key of removed) delete data[key];
    for (const node of Object.values(data)) {
      for (const key of ['children', 'virtualChildren']) {
        if (Array.isArray(node[key])) node[key] = node[key].filter(id => !removed.has(id));
      }
    }
    if (removed.has(form.firstCustomQuestion)) form.firstCustomQuestion = '';
    form.customPrefillQuestionField = [];
    config.pathList = config.pathList.filter(p => !removed.has(p.name));
    return { removedNodes: removed.size, removedFields: fields,
      remainingRoutes: config.pathList.map(p => p.name) };
  }
  function transform(body, mime = '') {
    if (typeof body !== 'string' || body.length > 4000000) throw Error('Unsupported request body.');
    let parsed, encoding = 'json';
    try { parsed = JSON.parse(body); }
    catch {
      if (!mime.includes('application/x-www-form-urlencoded')) throw Error('Request is not JSON or URL-encoded JSON.');
      parsed = [...new URLSearchParams(body).entries()]; encoding = 'form';
    }
    const plans = [];
    let visited = 0;
    function walk(value, depth = 0) {
      if (++visited > 50000 || depth > 24) throw Error('Structure exceeds inspection limits.');
      if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
        let decoded;
        try { decoded = JSON.parse(value); } catch { return value; }
        const before = plans.length;
        const result = walk(decoded, depth + 1);
        return plans.length > before ? JSON.stringify(result) : value;
      }
      if (!value || typeof value !== 'object') return value;
      const plan = patchConfig(value);
      if (plan) { plans.push(plan); return value; }
      for (const key of Object.keys(value)) value[key] = walk(value[key], depth + 1);
      return value;
    }
    walk(parsed);
    if (plans.length !== 1) throw Error('Expected exactly one recognizable cardForm configuration.');
    const text = encoding === 'form' ? new URLSearchParams(parsed).toString() : JSON.stringify(parsed);
    return { text, plan: plans[0] };
  }
  function safeEndpoint(raw) {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      (url.hostname === 'ads.tiktok.com' || url.hostname.endsWith('.tiktok.com')) &&
      /draft|form|landing.?page|lead.?page/i.test(url.pathname) &&
      /save|update|edit|draft/i.test(url.pathname) &&
      !/publish|launch|submit|complete|delete|remove/i.test(url.pathname);
  }
  return { transform, safeEndpoint };
}
globalThis.formTest = createFormTest();

// Installed only after the user explicitly arms a recognized, exact endpoint.
function installFormDraftTest(endpoint, method, factory) {
  if (globalThis.__ttDraftTest) throw Error('A test hook is already installed. Reload the editor to reset it.');
  const api = factory();
  if (!api.safeEndpoint(endpoint) || !['POST', 'PUT', 'PATCH'].includes(method)) throw Error('Not a supported draft endpoint.');
  const endpointOf = raw => { const u = new URL(raw, location.href); return u.origin + u.pathname; };
  const state = { armed: true, message: 'Armed for one matching draft request. Save the duplicate draft manually.' };
  globalThis.__ttDraftTest = state;
  const matches = (url, verb) => endpointOf(url) === endpoint && verb.toUpperCase() === method;
  const change = (body, mime) => {
    if (!state.armed) return body;
    state.armed = false;
    try {
      const result = api.transform(body, mime);
      state.message = 'Modified one request. Backend acceptance and persistence are NOT confirmed.';
      state.plan = result.plan;
      return result.text;
    } catch (error) {
      state.message = 'Request left unchanged: ' + error.message;
      return body;
    }
  };
  const originalFetch = window.fetch;
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open, originalSend = proto.send, originalHeader = proto.setRequestHeader;
  const requests = new WeakMap();
  window.fetch = function(input, init) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const verb = init?.method || input?.method || 'GET';
    if (!state.armed || !matches(url, verb)) return originalFetch.apply(this, arguments);
    // Never consume a Request stream or alter a body format we do not recognize.
    if (typeof init?.body !== 'string') {
      state.armed = false; state.message = 'Request left unchanged: unsupported fetch body. Reload editor to reset.';
      return originalFetch.apply(this, arguments);
    }
    const mime = new Headers(init.headers || input?.headers).get('content-type') || '';
    const body = change(init.body, mime);
    return originalFetch.call(this, input, { ...init, body });
  };
  proto.open = function(verb, url) {
    requests.set(this, { verb: String(verb), url: String(url), mime: '' });
    return originalOpen.apply(this, arguments);
  };
  proto.setRequestHeader = function(key, value) {
    const request = requests.get(this);
    if (request && String(key).toLowerCase() === 'content-type') request.mime = String(value);
    return originalHeader.apply(this, arguments);
  };
  proto.send = function(body) {
    const request = requests.get(this);
    if (state.armed && request && matches(request.url, request.verb)) body = change(body, request.mime);
    return originalSend.call(this, body);
  };
  state.disarm = () => {
    state.armed = false;
    window.fetch = originalFetch;
    proto.open = originalOpen; proto.send = originalSend; proto.setRequestHeader = originalHeader;
    state.message = 'Disarmed. Reload the editor before another test.';
  };
  return state.message;
}
