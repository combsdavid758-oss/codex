const $ = (id) => document.getElementById(id);
let capturing = false;
const records = [];
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
$('clear').onclick = () => { records.length = 0; $('results').textContent = 'Cleared.'; };
chrome.devtools.network.onRequestFinished.addListener((entry) => {
  if (!capturing) return;
  try {
    const url = new URL(entry.request.url);
    if (!(url.hostname === 'ads.tiktok.com' || url.hostname.endsWith('.ads.tiktok.com'))) return;
    if (!['POST', 'PUT', 'PATCH'].includes(entry.request.method)) return;
    const post = entry.request.postData;
    if (!post?.text || post.text.length > 2000000) return;
    let payload;
    try { payload = JSON.parse(post.text); }
    catch {
      if (!post.mimeType?.includes('application/x-www-form-urlencoded')) return;
      payload = Object.fromEntries(new URLSearchParams(post.text));
    }
    const fields = extractLinks(payload);
    if (!fields.length) return;
    records.push({ method: entry.request.method, endpoint: url.origin + url.pathname, httpStatus: entry.response.status, fields });
    if (records.length > 20) records.shift();
    $('results').textContent = JSON.stringify(records, null, 2);
  } catch { $('status').textContent = 'A request could not be inspected; capture is still active.'; }
});
$('generate').click();
