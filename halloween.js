(function () {
  if (document.querySelector('.hw-decor')) return;

  function web(size, threads, rings) {
    const parts = [];
    for (let i = 0; i <= threads; i++) {
      const a = (Math.PI / 2) * (i / threads);
      parts.push(`M0 0 L${(Math.cos(a) * size).toFixed(1)} ${(Math.sin(a) * size).toFixed(1)}`);
    }
    for (let r = 1; r <= rings; r++) {
      const radius = (size / (rings + 0.4)) * r;
      let d = '';
      for (let i = 0; i < threads; i++) {
        const a1 = (Math.PI / 2) * (i / threads);
        const a2 = (Math.PI / 2) * ((i + 1) / threads);
        const x1 = Math.cos(a1) * radius, y1 = Math.sin(a1) * radius;
        const x2 = Math.cos(a2) * radius, y2 = Math.sin(a2) * radius;
        const mid = (a1 + a2) / 2;
        const cx = Math.cos(mid) * radius * 0.82, cy = Math.sin(mid) * radius * 0.82;
        if (i === 0) d += `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
        d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      parts.push(d);
    }
    return `<svg viewBox="0 0 ${size} ${size}" fill="none" stroke="var(--web)" stroke-width="1.1"
      stroke-linecap="round"><path d="${parts.join(' ')}"/></svg>`;
  }

  const spider = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--web-strong)" stroke-width="1.4"
      stroke-linecap="round">
      <ellipse cx="12" cy="13.5" rx="4.2" ry="4.8" fill="#140d1b" stroke="none"/>
      <circle cx="12" cy="8.4" r="2.5" fill="#140d1b" stroke="none"/>
      <circle cx="10.9" cy="8" r="0.7" fill="#ff7a1a" stroke="none"/>
      <circle cx="13.1" cy="8" r="0.7" fill="#ff7a1a" stroke="none"/>
      <path d="M8 10.5 3.5 7.5M8 12.5 2.8 12M8 14.5 3.4 17M8.6 16.4 5 20"/>
      <path d="M16 10.5 20.5 7.5M16 12.5 21.2 12M16 14.5 20.6 17M15.4 16.4 19 20"/>
    </svg>`;

  const layer = document.createElement('div');
  layer.className = 'hw-decor';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML =
    `<div class="hw-web hw-web--tl">${web(100, 7, 4)}</div>` +
    `<div class="hw-web hw-web--tr">${web(100, 7, 4)}</div>` +
    `<div class="hw-nav-web">${web(100, 5, 3)}</div>` +
    `<div class="hw-spider">${spider}</div>`;

  if (!document.getElementById('particles')) {
    for (let i = 0; i < 14; i++) {
      const e = document.createElement('span');
      e.className = 'hw-ember';
      e.style.left = (Math.random() * 100).toFixed(2) + '%';
      e.style.setProperty('--sway', (Math.random() * 90 - 45).toFixed(0) + 'px');
      e.style.animationDuration = (11 + Math.random() * 13).toFixed(1) + 's';
      e.style.animationDelay = (-Math.random() * 20).toFixed(1) + 's';
      e.style.opacity = (0.35 + Math.random() * 0.45).toFixed(2);
      layer.appendChild(e);
    }
  }

  (document.body || document.documentElement).appendChild(layer);
})();
