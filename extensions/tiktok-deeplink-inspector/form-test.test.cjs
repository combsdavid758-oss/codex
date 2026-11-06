const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/form-test.js', 'utf8');
function fixture() {
  return { templateName: 'cardForm', data: {
    meta: { name: 'LpPage', children: ['virtualForm', 'welcomePageSubPage', 'questionCardSubPage', 'thanksSubPage'] },
    virtualForm: { name: 'LpForm', virtualChildren: ['welcome', 'q', 'name', 'submit'],
      firstCustomQuestion: 'q', customPrefillQuestionField: [{ label: 'LpFullNameField' }],
      logicData: {}, finalPageInfo: [{ brickIndex: 'thanksSubPage' }] },
    welcomePageSubPage: { name: 'LpSubpage', children: ['welcome'] },
    welcome: { name: 'LpCardWelcome', title: 'Keep this welcome' },
    questionCardSubPage: { name: 'LpSubpage', children: ['container', 'buttons'] },
    container: { name: 'LpCardContainer', children: ['card'] },
    card: { name: 'LpCard', children: ['q'] },
    q: { name: 'LpCardQuestionSet', questionSetType: 'contact_fields', children: ['name'] },
    name: { name: 'LpFullNameField', children: [] },
    buttons: { name: 'LpCardButtonContainer', children: ['submit'] },
    submit: { name: 'LpSubmit', children: [] },
    thanksSubPage: { name: 'LpSubpage', children: ['cta'] },
    cta: { name: 'LpFormCTA', url: 'https://example.com/keep-me' }
  }, pathList: [{ name: 'welcomePageSubPage' }, { name: 'questionCardSubPage', children: ['card'] }, { name: 'thanksSubPage' }] };
}
function context() {
  const calls = [];
  class XHR { open(...a) { calls.push(['open', ...a]); } send(body) { calls.push(['send', body]); }
    setRequestHeader(...a) { calls.push(['header', ...a]); } }
  const sandbox = { URL, URLSearchParams, Headers, Set, WeakMap, location: { href: 'https://ads.tiktok.com/editor' },
    XMLHttpRequest: XHR, fetch: (...args) => { calls.push(['fetch', ...args]); return Promise.resolve({ status: 200 }); } };
  sandbox.window = sandbox;
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  return { sandbox, calls, api: sandbox.formTest };
}
const { api } = context();
const original = fixture();
const body = JSON.stringify({ config: JSON.stringify(original), draft_name: 'Preserve me', account: { id: 123 } });
const result = api.transform(body);
const wrapper = JSON.parse(result.text), config = JSON.parse(wrapper.config);
assert.equal(wrapper.draft_name, 'Preserve me'); assert.deepEqual(wrapper.account, { id: 123 });
assert.equal(config.data.questionCardSubPage, undefined);
assert.equal(config.data.name, undefined);
assert.equal(config.data.virtualForm.firstCustomQuestion, '');
assert.deepEqual(config.data.virtualForm.virtualChildren, ['welcome']);
assert.deepEqual(config.data.cta, original.data.cta);
assert.deepEqual(config.data.welcome, original.data.welcome);
assert.equal(config.pathList.length, 2);
const encoded = new URLSearchParams([['config', JSON.stringify(original)], ['repeat', 'a'], ['repeat', 'b']]);
const params = new URLSearchParams(api.transform(encoded.toString(), 'application/x-www-form-urlencoded').text);
assert.deepEqual(params.getAll('repeat'), ['a', 'b']);
assert.equal(JSON.parse(params.get('config')).pathList.length, 2);
const custom = fixture(); custom.data.name.name = 'LpCustomQuestion';
assert.throws(() => api.transform(JSON.stringify(custom)), /Unrecognized/);
const conditional = fixture(); conditional.data.virtualForm.logicData = { active: true };
assert.throws(() => api.transform(JSON.stringify(conditional)), /Conditional/);
assert.throws(() => api.transform(JSON.stringify([fixture(), fixture()])), /exactly one/);
assert.throws(() => api.transform(JSON.stringify({ draft_name: 'Only a name' })), /exactly one/);
assert.equal(api.safeEndpoint('https://ads.tiktok.com/api/form/draft/save'), true);
assert.equal(api.safeEndpoint('https://ads.tiktok.com/instant_page/api/v1/create/'), true);
assert.equal(api.safeEndpoint('https://ads.tiktok.com/instant_page/api/v1/create/publish/'), false);
assert.equal(api.safeEndpoint('https://ads.tiktok.com/api/form/create/'), false);
for (const url of ['https://evil.test/api/form/draft/save', 'https://ads.tiktok.com.evil.test/form/draft',
  'https://ads.tiktok.com/api/form/publish', 'https://ads.tiktok.com/api/form/submit',
  'https://ads.tiktok.com/api/form/draft/publish', 'https://ads.tiktok.com/monitor/batch']) {
  assert.equal(api.safeEndpoint(url), false);
}
const c = context();
const endpoint = 'https://ads.tiktok.com/api/form/draft/save';
c.sandbox.installFormDraftTest(endpoint, 'POST', c.sandbox.createFormTest);
const init = { method: 'POST', body, headers: { 'content-type': 'application/json' }, credentials: 'include' };
c.sandbox.fetch('https://ads.tiktok.com/api/form/publish', init);
assert.equal(c.calls[0][2].body, body);
c.sandbox.fetch(endpoint, init);
assert.notEqual(c.calls[1][2].body, body);
assert.equal(c.calls[1][2].credentials, 'include');
assert.strictEqual(c.calls[1][2].headers, init.headers);
c.sandbox.fetch(endpoint, init); assert.equal(c.calls[2][2].body, body);
c.sandbox.__ttDraftTest.disarm(); assert.equal(c.sandbox.__ttDraftTest.armed, false);
const d = context(); d.sandbox.installFormDraftTest(endpoint, 'POST', d.sandbox.createFormTest);
const xhr = new d.sandbox.XMLHttpRequest(); xhr.open('POST', endpoint);
xhr.setRequestHeader('Content-Type', 'application/json'); xhr.send('{"different":"schema"}');
assert.equal(d.calls.at(-1)[1], '{"different":"schema"}');
assert.match(d.sandbox.__ttDraftTest.message, /left unchanged/);
const e = context(); e.sandbox.installFormDraftTest(endpoint, 'POST', e.sandbox.createFormTest);
const xhr2 = new e.sandbox.XMLHttpRequest(); xhr2.open('POST', endpoint);
xhr2.setRequestHeader('Content-Type', 'application/json'); xhr2.send(body);
assert.notEqual(e.calls.at(-1)[1], body);
// Match the observed form-save wrapper; preserve every field except its nested data string.
const observed = { account_id: 'test-account', title: 'Disposable duplicate', template_id: 'test-template',
  thumbnail_uri: 'test-thumbnail', data: JSON.stringify(original), account_type: 1 };
const real = context();
const createEndpoint = 'https://ads.tiktok.com/instant_page/api/v1/create/';
real.sandbox.installFormDraftTest(createEndpoint, 'POST', real.sandbox.createFormTest);
const observedBody = JSON.stringify(observed);
real.sandbox.fetch(createEndpoint, { method: 'POST', body: observedBody, headers: {'Content-Type': 'application/json'} });
const saved = JSON.parse(real.calls[0][2].body);
assert.equal(JSON.parse(saved.data).data.questionCardSubPage, undefined);
for (const key of Object.keys(observed).filter(key => key !== 'data')) assert.deepEqual(saved[key], observed[key]);
assert.equal(JSON.parse(saved.data).data.cta.url, 'https://example.com/keep-me');
real.sandbox.fetch(createEndpoint, { method: 'POST', body: observedBody });
assert.equal(real.calls[1][2].body, observedBody);
console.log('PASS: nested/URL-encoded removal; unrelated values preserved; unknown structures refused; endpoint checks; fetch/XHR one-shot interception; reset.');
