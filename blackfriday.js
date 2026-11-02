(function () {
  const UNTIL = Date.parse('2026-12-01T00:00:00+01:00');
  if (!(Date.now() < UNTIL)) return;
  document.documentElement.classList.add('bf');

  function left() {
    const ms = Math.max(0, UNTIL - Date.now());
    const d = Math.floor(ms / 86400000);
    const h = Math.floor(ms / 3600000) % 24;
    const m = Math.floor(ms / 60000) % 60;
    return { d: d, h: h, m: m };
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function tick() {
    if (!(Date.now() < UNTIL)) {
      location.reload();
      return;
    }
    const t = left();
    const set = function (sel, v) { const el = document.querySelector(sel); if (el) el.textContent = pad(v); };
    set('.bf-c-d', t.d);
    set('.bf-c-h', t.h);
    set('.bf-c-m', t.m);
  }

  setInterval(tick, 20000);
})();
