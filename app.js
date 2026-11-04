(() => {
  const $ = (id) => document.getElementById(id);
  const intro = $('intro');
  const steps = $('steps');
  const form = $('intent-question');
  const acknowledgement = $('steps-read-confirmation');
  const go = $('go');
  const status = $('status');

  function show(isSteps, focus = true) {
    intro.hidden = isSteps;
    steps.hidden = !isSteps;
    const url = new URL(location.href);
    if (isSteps) url.searchParams.set('stage', 'steps');
    else url.searchParams.delete('stage');
    history.replaceState(null, '', url);
    if (focus) (isSteps ? $('steps-title') : $('next')).focus({ preventScroll: true });
  }

  function reset() {
    go.disabled = !acknowledgement.checked;
    $('go-label').textContent = 'Download Playful Rewards';
    status.textContent = '';
  }

  $('next').addEventListener('click', () => show(true));
  $('back').addEventListener('click', () => show(false));
  acknowledgement.addEventListener('change', reset);
  window.addEventListener('pageshow', reset);
  show(new URL(location.href).searchParams.get('stage') === 'steps', false);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (new URL(location.href).searchParams.get('qa') === 'receipt') {
      status.textContent = 'Test mode: download blocked.';
      return;
    }
    const destination = window.FUNNEL_CONFIG?.downloadUrl;
    if (!destination) {
      $('download-dialog').showModal();
      return;
    }
    try {
      const url = new URL(destination);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
      go.disabled = true;
      $('go-label').textContent = 'Opening Playful Rewards…';
      location.assign(url.href);
    } catch {
      status.textContent = 'The download link is unavailable. Please try again later.';
    }
  });
})();
