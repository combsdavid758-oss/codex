# Instant Form Deeplink Editor 1.1.0

1. Extract the ZIP. Open chrome://extensions, enable Developer mode, click Load unpacked and select the folder containing manifest.json.
2. Disable the old draft inspector to avoid competing request hooks. Reload Ads Manager after installing. Open a disposable duplicate Instant Form.
3. Make a small edit, then click Save, not Complete or Publish. Open this extension using Chrome’s Extensions menu. The detected form ID/title and existing final CTA links should appear.
4. Set the HTTPS fallback and deeplink, click Preview change, inspect the form ID and changes, then Apply to next Save.
5. Within two minutes, make another small edit in TikTok and click Save. Open the extension again to read the result. No need to delete the question.
6. Reopen the saved duplicate, make another harmless edit and Save with the extension unarmed. Check the detected scheme persisted. Test the CTA inside TikTok on your own device before using the form in an ad.

Only the exact existing-form POST /instant_page/api/v1/update/ endpoint is supported, and only a matching page_id is modified once. Creation requests are deliberately left unchanged. Unknown body formats are left unchanged. Only thanksPageFormCta.buttonsInfo.website.link.url and .scheme change; nested deeplink flags and all questions are preserved. No account cookies, headers, responses, or whole forms are exported or stored. No external service is contacted by this extension.

The hook is installed at document_start in the top Ads Manager frame. Reloading disarms it. Unsupported iframe/worker requests or different endpoints will not be edited. Changes last two minutes; Cancel disarms immediately. The extension never clicks Save, Complete or Publish, but cannot tell which UI button generated an update request. Use Save only while armed.

This is an experimental editor for the standalone scheme field observed in the supplied form source. Some newer TikTok runtimes ignore it. HTTP 200 is not proof the backend stored the value or that the native app supports the scheme. It does not enable automatic launching, background popups, or changing the native X action. Local browser tests verify request rewriting, not acceptance by TikTok.

Validation: mock-page Chromium tests passed for fetch, Request objects, XHR, JSON and form URL encoding, matching-page checks, one-shot consumption, create exclusion, and cancel. Full extension installation was blocked in the development browser by its administrator policy and remains to be checked in your Chrome.

Version 1.1 supports leadFormCTA and unique final website CTA nodes in other form layouts. It discovers editor frames and displays connected-frame/request counts when detection fails. Update the extension, then reload Ads Manager. Configure a website button in Final page before the detection save.

Version 1.2 fixes stale frame status selection, accepts the same update endpoint without a trailing slash, and adds a Copy diagnostic report button. Diagnostics include only request paths with long numeric IDs masked, field names, CTA node structure and frame messages. They exclude URLs in field values, account IDs, headers, cookies and full request bodies. This release does not claim to resolve an unknown endpoint or schema.
