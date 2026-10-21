/* ===== MCQCAMPUS MODULE: carousel.js ===== */
/* One cancellable countdown. Renders retain the deadline; interaction resets it. */
window.McqCarousel = {
  create({advance, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout}) {
    const delay = 10000;
    let timer = null, current = null, deadline = 0;
    function clear() {
      if (timer !== null) cancel(timer);
      timer = null;
    }
    function stop() {
      clear();
      current = null;
      deadline = 0;
    }
    function sync(key) {
      if (key == null) { stop(); return; }
      if (key !== current) {
        current = key;
        deadline = now() + delay;
      }
      clear();
      timer = schedule(() => {
        timer = null;
        current = null;
        deadline = 0;
        advance();
      }, Math.max(0, deadline - now()));
    }
    return {sync, stop, restart(key) { stop(); sync(key); }};
  }
};

/* ===== END MODULE: carousel.js ===== */

;
