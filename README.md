# Screentime to Cash

A responsive recreation of the supplied two-screen reward funnel. Plain HTML,
CSS, and JavaScript; no dependency installation or build is required.

Run `npm start` from this directory to serve on port 3000. Run `npm run check`
to check JavaScript syntax.

The introduction, guide, back navigation, checkbox gating, stage query parameter,
and `?qa=receipt` test mode work locally. The partner icon is stored in `assets/`.
System fonts replace the reference's externally hosted font.

Set `downloadUrl` in `config.js` to an approved HTTPS partner destination to
enable the final redirect. Until configured, the button displays an explanatory
dialog. No original tracking scripts, signed flow tokens, or remote form
submissions are included. Reward copy is reproduced from the reference and
should be verified with the partner before public use.

## TikTok browser pixel

`config.js` contains `tiktokPixel.id` (currently `DBQPS3JC77U2EVIR1DHG`), an enabled
switch, an SDK readiness timeout and a navigation grace period. Both index.html
and popup.html load the same unobfuscated helper. It initializes the pixel and
queues `ttq.page()` once per document, after marketing consent. The popup's
Continue button is not a conversion. Only the final partner-download CTA calls
`ttq.track('CompleteRegistration')`, after URL/checkbox validation and outside QA
mode. No Events API, server-side forwarding, console suppression or extra event
transport is used.

### Existing consent-manager integration (pending)

No existing consent manager or Cloudflare source was present in this checkout.
The integration deliberately stays inactive until the existing manager reports
explicit marketing consent through this bridge:

```js
// Call from the real CMP's initial-state callback and its consent-change handler.
window.FunnelConsent.setMarketingConsent(marketingConsent === true);
```

`marketingConsent` above means the boolean supplied by the real consent manager;
it is not a variable the funnel currently defines. The manager's name/callback
must be supplied to complete this wiring. No new banner was added. Unknown or
denied consent causes no SDK load or events and does not delay navigation.
Revocation calls `ttq.revokeConsent()` and removes this helper's own unsent queue
entries. Consent on each new document must be read from the actual manager; the
bridge does not infer consent from the URL or store a separate consent decision.
If an existing site integration already exposes a compatible `FunnelConsent`
interface, the bridge preserves it.

### Navigation and delivery

The final CTA disables duplicate submissions, waits up to 1500 ms for SDK
readiness, calls track, then keeps the document open for another 600 ms. Both
waits are configurable and bounded. Blocked/failed tracking never blocks the
offer. If readiness times out, the event can remain queued and may be lost on
navigation. TikTok's track call provides no delivery acknowledgement: the grace
period improves dispatch opportunity but is not guaranteed event receipt.

The helper emits local `funnel:pixel-status` events with states such as
`sdk-ready`, `page-queued`, `registration-queued`, and `sdk-load-failed`. These
mean local readiness/queueing, not TikTok server receipt.

### Verification

Run `npm ci`, `npm run check`, then `npm test`. Tests require Chromium at
`/usr/bin/chromium`, or set `CHROMIUM_PATH` to an installed browser. Playwright is
a pinned development dependency; the deployed static site has no runtime npm
dependencies or build step.

Browser tests substitute a simulated SDK and simulate delayed network responses.
They verify consent gating/revocation, one initialization/PageView per document,
conversion-before-navigation, duplicate prevention, QA/invalid destinations, and
continued navigation when the SDK is blocked. They emit no production events.

Real SDK/event delivery has NOT been verified: the execution environment denies
analytics.tiktok.com with a proxy CONNECT 403. After the real CMP is connected,
use TikTok Events Manager's Test Events workflow and browser Network tools to
confirm the SDK loads, PageView appears after consent, and exactly one
CompleteRegistration arrives from the final CTA. Check receipt while navigating,
with slow networking, and in TikTok's in-app browser. Also check that rejecting
or revoking marketing consent suppresses tracking. A queued call or a successful
script load alone does not establish event delivery. If your hosting setup has
a CSP, its script/connect policies must allow the actual TikTok SDK and event
destinations seen during this check; no CSP was present in the repository.
