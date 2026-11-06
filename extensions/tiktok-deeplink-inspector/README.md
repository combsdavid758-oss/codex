# Draft deeplink inspector

This is a diagnostic Chrome extension, not a working bypass of TikTok destination
restrictions. It adds a TikTok Links tab to desktop Chrome DevTools, generates the
popup scheme, and shows selected link configuration from draft save requests.
It never modifies requests or submits/publishes ads. A successful HTTP response
does not prove a field was saved, accepted or delivered to viewers.

## Install and use

1. Download and extract the extension ZIP. Keep all files in one folder.
2. In desktop Chrome, open `chrome://extensions` and turn on Developer mode.
3. Choose Load unpacked and select the extracted folder containing manifest.json.
4. Open TikTok Ads Manager, then open DevTools (F12 or Ctrl+Shift+I;
   on Mac Cmd+Option+I). Select TikTok Links, possibly under the overflow menu.
5. Click Start capture and save a draft manually, then click Stop capture.
6. Compare the captured fields with a draft using a native supported deeplink
   field, if available. Reloading and inspecting the saved draft is needed to
   establish persistence; live delivery is a separate capability.

Only ads.tiktok.com and its subdomains are observed. Other API hosts, multipart
or binary requests, and unrecognized field names will not appear. No output is
not proof of unsupported configuration. Query values are redacted. Review link
paths and identifiers before sharing output. No network uploads, host access
permissions, content scripts, or browser-wide request modification are used.
