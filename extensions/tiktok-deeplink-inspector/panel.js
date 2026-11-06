const $ = (id) => document.getElementById(id);
let capturing = false;
const records = [];
let candidate = null;
let observed = 0;
let writes = 0;
let isArmed = false;
const updateArm = () => { $('arm').disabled = !candidate || !$('duplicate-confirm').checked || isArmed; };
$('duplicate-confirm').onchange = updateArm;
$('arm').onclick = () => {
  if (!candidate || !$('duplicate-confirm').checked || isArmed) return;
  const code = '(' + installFormDraftTest.toString() + ')(' + JSON.stringify(candidate.endpoint) + ',' +
    JSON.stringify(candidate.method) + ',(' + createFormTest.toString() + '))';
  chrome.devtools.inspectedWindow.eval(code, (result, error) => {
    if (error) { $('test-status').textContent = 'Could not install the test. No request was changed. Reload the editor before retrying.'; return; }
    isArmed = true; updateArm(); $('test-status').textContent = result;
  });
};
$('disarm').onclick = () => {
  chrome.devtools.inspectedWindow.eval('globalThis.__ttDraftTest?.disarm()', (_result, error) => {
    $('test-status').textContent = error ? 'Could not disarm. Reload the editor to remove the hook.' : 'Disarmed. Reload the editor to reset.';
    isArmed = false; candidate = null; updateArm();
  });
};
$('check-test').onclick = () => {
  chrome.devtools.inspectedWindow.eval('globalThis.__ttDraftTest ? ({armed:globalThis.__ttDraftTest.armed,message:globalThis.__ttDraftTest.message,plan:globalThis.__ttDraftTest.plan}) : null', (result, error) => {
    $('test-status').textContent = error ? 'Cannot read test status.' : result ? JSON.stringify(result, null, 2) : 'No test installed on this page.';
    if (!error && !result) { isArmed = false; candidate = null; updateArm(); }
  });
};
$('generate').onclick = () => {
  try {
    const destination = new URL($('destination').value.trim());
    if (destination.protocol !== 'https:') throw Error('Use an HTTPS destination.');
    $('deeplink').value = 'snssdk1233://webview_popup?use_spark=1&use_forest=1&silent_load_type=1&popup_show_type=0&container_bg_color=00000000&loading_bg_color=00000000&hide_nav_bar=1&hide_more=1&url=' + encodeURIComponent(destination.href);
    $('status').textContent = 'Generated. TikTok support for this scheme is not guaranteed.';
  } catch { $('status').textContent = 'Enter a valid HTTPS destination.'; }
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('deeplink').value); $('status').textContent = 'Copied.'; }
  catch { $('deeplink').select(); $('status').textContent = 'Select the generated link and copy it manually.'; }
};
$('capture').onclick = () => {
  capturing = !capturing;
  $('capture').textContent = capturing ? 'Stop capture' : 'Start capture';
  $('status').textContent = capturing ? 'Capturing matching draft request fields locally.' : 'Capture stopped.';
};
$('clear').onclick = () => {
  records.length = 0; observed = 0; writes = 0; candidate = null;
  $('results').textContent = 'Cleared.'; $('capture-counts').textContent = '0 requests observed.';
  $('form-plan').textContent = 'Waiting for a recognized form save.'; updateArm();
};
chrome.devtools.network.onRequestFinished.addListener((entry) => {
  if (!capturing) return;
  try {
    const url = new URL(entry.request.url);
    if (!(url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com'))) return;
    observed++;
    $('capture-counts').textContent = observed + ' TikTok requests observed; ' + writes + ' write requests inspected.';
    if (!['POST', 'PUT', 'PATCH'].includes(entry.request.method)) return;
    writes++;
    $('capture-counts').textContent = observed + ' TikTok requests observed; ' + writes + ' write requests inspected.';
    // Recording and telemetry requests are never candidates for editing.
    if (/\/block\/append|\/monitor|\/collect|\/report|\/batch\/?$/i.test(url.pathname)) return;
    const post = entry.request.postData;
    const endpoint = url.origin + url.pathname;
    const info = { method: entry.request.method, endpoint, httpStatus: entry.response.status };
    if (post?.text && formTest.safeEndpoint(endpoint)) {
      try {
        const result = formTest.transform(post.text, post.mimeType || '');
        info.questionRemovalPlan = result.plan;
        if (!isArmed) {
          candidate = { endpoint, method: entry.request.method };
          $('form-plan').textContent = JSON.stringify({ ...candidate, ...result.plan }, null, 2);
          updateArm();
        }
      } catch (error) { info.formInspection = error.message; }
    }
    if (!post?.text || post.text.length > 4000000) {
      info.bodyFormat = 'Missing, binary, or oversized body; not editable.';
      records.push(info);
      if (records.length > 30) records.shift();
      $('results').textContent = JSON.stringify(records, null, 2); return;
    }
    let payload;
    try { payload = JSON.parse(post.text); }
    catch {
      if (!post.mimeType?.includes('application/x-www-form-urlencoded')) {
        info.bodyFormat = 'Unrecognized body format; not editable.';
        records.push(info);
        if (records.length > 30) records.shift();
        $('results').textContent = JSON.stringify(records, null, 2); return;
      }
      payload = Object.fromEntries(new URLSearchParams(post.text));
    }
    const fields = extractLinks(payload);
    if (fields.length) info.fields = fields;
    info.topLevelKeys = Object.keys(payload || {}).filter(key => !/token|cookie|authorization|password|secret|email|phone/i.test(key)).slice(0, 20);
    records.push(info);
    if (records.length > 30) records.shift();
    $('results').textContent = JSON.stringify(records, null, 2);
  } catch { $('status').textContent = 'A request could not be inspected; capture is still active.'; }
});
$('generate').click();
