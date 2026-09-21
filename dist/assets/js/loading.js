/* One shared, background-free loading surface. Keep it outside #app. */
window.Loading = (() => {
  const script = document.currentScript;
  const tasks = new Map(), locks = new Map();
  let node, video, status, showTimer, serial = 0, mediaFailed = false;
  function mount() {
    if (node) return;
    node = document.createElement('div');
    node.id = 'global-loader'; node.hidden = true;
    node.setAttribute('popover', 'manual');
    node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
    video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('aria-hidden', 'true'); video.preload = 'auto';
    // This must be a genuine alpha export; never use an opaque MP4 fallback.
    video.src = new URL('../images/mcq-loader.webm', script.src).href;
    status = document.createElement('span'); status.className = 'visually-hidden';
    video.addEventListener('error', () => {
      mediaFailed = true; video.hidden = true; status.className = 'loader-fallback';
    });
    node.append(video, status); document.body.append(node);
  }
  function hide() {
    clearTimeout(showTimer); showTimer = null;
    if (!node) return;
    if (node.matches(':popover-open')) node.hidePopover();
    node.hidden = true; video.pause();
  }
  function show() {
    showTimer = null;
    if (!tasks.size) return;
    mount(); node.hidden = false;
    status.textContent = [...tasks.values()].at(-1).label;
    if (typeof node.showPopover === 'function' && !node.matches(':popover-open')) node.showPopover();
    if (!mediaFailed) video.play().catch(() => {
      // A first frame remains visible if autoplay is unavailable.
      status.className = 'loader-fallback';
    });
  }
  function begin(label = 'Loading…', timeout = 150000) {
    const id = ++serial;
    // Last-resort cleanup if application startup itself fails. Requests also abort.
    const watchdog = setTimeout(() => {
      end(); window.dispatchEvent(new CustomEvent('mcq:loading-timeout', {detail: {label}}));
    }, timeout);
    tasks.set(id, {label, watchdog});
    if (node && !node.hidden) status.textContent = label;
    else if (!showTimer) showTimer = setTimeout(show, 120);
    let ended = false;
    function end() {
      if (ended) return; ended = true;
      clearTimeout(watchdog); tasks.delete(id);
      if (!tasks.size) hide();
      else if (status) status.textContent = [...tasks.values()].at(-1).label;
    }
    return end;
  }
  function lock(key, button, label = 'Saving…') {
    if (locks.has(key)) return null;
    const previous = button && {html: button.innerHTML, disabled: button.disabled, busy: button.getAttribute('aria-busy')};
    if (button) {
      button.disabled = true; button.setAttribute('aria-busy', 'true');
      if (label) button.textContent = label;
    }
    let released = false;
    function release() {
      if (released) return; released = true; locks.delete(key);
      if (button) {
        button.innerHTML = previous.html; button.disabled = previous.disabled;
        if (previous.busy === null) button.removeAttribute('aria-busy');
        else button.setAttribute('aria-busy', previous.busy);
      }
    }
    locks.set(key, release); return release;
  }
  async function run(work, label) {
    const end = begin(label);
    try { return await work(); } finally { end(); }
  }
  function reset() {
    for (const task of tasks.values()) clearTimeout(task.watchdog);
    tasks.clear(); for (const release of [...locks.values()]) release(); hide();
  }
  window.addEventListener('pagehide', reset);
  // Do not clear concurrent requests on route changes or unrelated JS errors.
  const finishInitial = begin('Loading MCQ Campus…');
  return {begin, lock, run, reset, finishInitial, get pending() { return tasks.size; }};
})();
