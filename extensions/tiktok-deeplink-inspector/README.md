# Draft form experiment — version 0.2.0

The TikTok Links DevTools panel can inspect requests and optionally modify ONE
recognized draft save to remove a contact-information card. TikTok backend
acceptance, saved-form rendering, and delivery are unverified. Removing a question
does not remove the newer runtime's automatic-link limits.

## Install/update

Extract the GitHub ZIP. In desktop Chrome, open chrome://extensions, enable
Developer mode, and Load unpacked from extensions/tiktok-deeplink-inspector.
When updating, replace the old folder, Reload the extension, and close/reopen
DevTools. Verify extension version 0.2.0.

## Test a disposable duplicate

1. Open the DUPLICATE FORM editor, not an ad editor. Open DevTools > TikTok Links.
2. Start capture. Change a draft label and click TikTok's Save control.
   If the UI only offers Complete, stop: this experiment is for draft saves.
3. A compatible save produces a plan with the endpoint and removed field types.
   The test stays disabled if the body or endpoint is not recognized. Request
   summaries and counts help diagnose missing/incompatible capture.
4. Review the plan, confirm the disposable-duplicate checkbox, and select
   Test removal on next matching save. This arms an in-page hook.
5. Change the duplicate's label again and click Save. The hook modifies at most
   one request to that exact host/path and method. It never clicks anything,
   submits lead information, or calls a publishing endpoint on its own.
6. Click Check test status. Check TikTok's own error/success message. Reload the
   saved duplicate and check whether the contact question remains removed.
   A modified request or HTTP 200 is NOT proof of acceptance or persistence.
7. Disarm and reload the editor to remove hooks. No request bodies, credentials,
   candidate endpoints, or enabled tests are stored on disk.

## Limits

Only a single cardForm containing a data map and pathList as seen in the supplied
source is supported. The contact section, descendants and references are removed;
welcome/final pages and unrelated wrapper settings are preserved. Custom or
conditional questions, unknown nodes, multiple configs, binary bodies and fetch
Request streams are not modified. The real Save payload may differ: no working
TikTok request schema has been observed. Use only a disposable duplicate.

Capture observes TikTok hostnames, omits obvious recording/telemetry paths and
shows request summaries even without matching link fields. It does not read
headers, cookies or response bodies. Query values in links are redacted. Endpoint
paths and field names can contain identifiers: review before sharing.

No host access permissions, browser-wide interception, network uploads or ad
publication are used. Other scripts or navigation may replace/reset the hook.
Reload is the reliable reset. The live website is not changed by this extension.
