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
