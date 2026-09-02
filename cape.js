(function () {
  const Store = window.FrostStore;
  const capeId = new URLSearchParams(window.location.search).get('id') || '';
  const layout = document.getElementById('detailLayout');
  const notFound = document.getElementById('detailNotfound');
  const info = document.getElementById('detailInfo');
  const previewPanel = document.getElementById('previewPanel');
  let cape = null;
  let viewerStarted = false;

  function showNotFound() {
    layout.hidden = true;
    notFound.hidden = false;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function isOwned(profile) {
    if (!cape) return false;
    return !!(profile && profile.owned && profile.owned.indexOf(cape.id) !== -1);
  }

  function priceLabel() {
    const store = cape.store || {};
    if (store.subscription) return { text: store.subscription === 'annual' ? 'Annual Lite perk' : 'Lite perk', pill: store.subscription === 'annual' ? 'pill-annual' : 'pill-lite' };
    if (store.price === 0 || store.price === 'free') return { text: 'Free', pill: 'pill-free' };
    if (typeof store.price === 'number') {
      return { text: '€' + store.price.toFixed(2), pill: null };
    }
    return { text: 'Coming soon', pill: 'pill-soon' };
  }

  function buildCta(profile) {
    const store = cape.store || {};
    const owned = isOwned(profile);
    const wrap = document.createElement('div');
    wrap.className = 'detail-cta-wrap';
    if (!profile && Store.loadToken() && !Store.isAuthSettled()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'detail-cta cta-buy';
      btn.disabled = true;
      btn.textContent = '· · ·';
      wrap.appendChild(btn);
      return wrap;
    }
    if (owned) {
      const btn = document.createElement('span');
      btn.className = 'detail-cta cta-owned';
      btn.textContent = 'Owned';
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = 'Equip it in the launcher wardrobe.';
      wrap.appendChild(note);
      return wrap;
    }
    if (store.subscription) {
      const isAnnual = store.subscription === 'annual';
      const btn = document.createElement('a');
      btn.className = 'detail-cta ' + (isAnnual ? 'cta-annual' : 'cta-lite');
      btn.href = 'https://frostclient.eu/lite' + (isAnnual ? '?billing=annual' : '');
      btn.textContent = isAnnual ? 'Subscribe to Annual Lite' : 'Subscribe to Lite';
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = isAnnual
        ? "This cape is exclusive to the Annual Lite plan — the monthly plan doesn't include it."
        : 'This cape is included with every FrostClient Lite subscription.';
      wrap.appendChild(note);
      return wrap;
    }
    if (store.price === 0 || store.price === 'free') {
      const btn = document.createElement('button');
      btn.className = 'detail-cta cta-disabled';
      btn.type = 'button';
      btn.disabled = true;
      btn.textContent = 'Free';
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = 'Free cape — no purchase needed.';
      wrap.appendChild(note);
      return wrap;
    }
    if (store.checkout) {
      const loggedIn = !!(profile && profile.user);
      const btn = document.createElement(loggedIn ? 'a' : 'button');
      btn.className = 'detail-cta cta-buy';
      if (loggedIn) {
        btn.href = store.checkout;
        btn.textContent = 'Purchase';
      } else {
        btn.type = 'button';
        btn.textContent = 'Sign in to purchase';
        btn.addEventListener('click', function () { Store.startLogin('store'); });
      }
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = loggedIn
        ? 'Checkout is handled securely by Whop. The cape unlocks right after your purchase.'
        : 'Sign in with Discord first so the cape can be linked to your account.';
      wrap.appendChild(note);
      return wrap;
    }
    const btn = document.createElement('button');
    btn.className = 'detail-cta cta-disabled';
    btn.type = 'button';
    btn.disabled = true;
    btn.textContent = 'Coming soon';
    wrap.appendChild(btn);
    return wrap;
  }

  function renderInfo(profile) {
    if (!cape) return;
    const store = cape.store || {};
    const price = priceLabel();
    info.innerHTML = '';
    const name = document.createElement('h1');
    name.className = 'detail-name';
    name.textContent = cape.name || cape.id;
    info.appendChild(name);
    const priceRow = document.createElement('div');
    priceRow.className = 'detail-price-row';
    if (price.pill) {
      const pill = document.createElement('span');
      pill.className = 'cape-price-pill ' + price.pill;
      pill.textContent = price.text.toUpperCase();
      priceRow.appendChild(pill);
    } else {
      const amount = document.createElement('span');
      amount.className = 'detail-price';
      amount.textContent = price.text;
      priceRow.appendChild(amount);
    }
    info.appendChild(priceRow);
    const meta = document.createElement('div');
    meta.className = 'detail-meta';
    const rows = [
      ['Release date', formatDate(store.releaseDate)],
      ['Animated', cape.animated ? 'Yes' : 'No']
    ];
    rows.forEach(function (pair) {
      const row = document.createElement('div');
      row.className = 'detail-meta-row';
      const label = document.createElement('span');
      label.className = 'detail-meta-label';
      label.textContent = pair[0];
      const value = document.createElement('span');
      value.className = 'detail-meta-value';
      value.textContent = pair[1];
      row.appendChild(label);
      row.appendChild(value);
      meta.appendChild(row);
    });
    info.appendChild(meta);
    if (store.description) {
      const desc = document.createElement('p');
      desc.className = 'detail-desc';
      desc.textContent = store.description;
      info.appendChild(desc);
    }
    info.appendChild(buildCta(profile));
  }

  function decodeGifFrames(url) {
    if (typeof ImageDecoder === 'undefined') return Promise.resolve([]);
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.arrayBuffer();
      })
      .then(function (buffer) {
        const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });
        return decoder.tracks.ready.then(function () {
          const track = decoder.tracks.selectedTrack;
          const count = track ? track.frameCount : 0;
          const frames = [];
          let chain = Promise.resolve();
          for (let i = 0; i < count; i++) {
            (function (idx) {
              chain = chain.then(function () {
                return decoder.decode({ frameIndex: idx }).then(function (result) {
                  const image = result.image;
                  const c = document.createElement('canvas');
                  c.width = image.displayWidth;
                  c.height = image.displayHeight;
                  c.getContext('2d').drawImage(image, 0, 0);
                  frames.push({ canvas: c, delay: image.duration ? Math.max(30, image.duration / 1000) : 100 });
                  image.close();
                });
              });
            })(i);
          }
          return chain.then(function () {
            decoder.close();
            return frames;
          });
        });
      })
      .catch(function () { return []; });
  }

  let animFrames = null;
  let animTimer = null;
  let animOn = true;
  let staticCapeUrl = null;

  function stopCapeAnimation() {
    if (animTimer) {
      clearTimeout(animTimer);
      animTimer = null;
    }
  }

  function applyCape(viewer, source) {
    try {
      const result = viewer.loadCape(source);
      if (result && result.catch) result.catch(function () {});
    } catch (err) {}
  }

  function playCapeAnimation(viewer) {
    if (!animFrames || animFrames.length < 2 || animTimer) return;
    let idx = 0;
    (function step() {
      const frame = animFrames[idx];
      idx = (idx + 1) % animFrames.length;
      // Redrawing straight into the viewer's own cape canvas (same approach as the launcher
      // wardrobe) - repeatedly calling viewer.loadCape(canvas) here silently stops updating
      // the rendered texture after the first frame, even though it doesn't throw.
      try {
        const ctx = viewer.capeCanvas.getContext('2d');
        ctx.clearRect(0, 0, viewer.capeCanvas.width, viewer.capeCanvas.height);
        ctx.drawImage(frame.canvas, 0, 0, viewer.capeCanvas.width, viewer.capeCanvas.height);
        if (viewer.capeTexture) viewer.capeTexture.needsUpdate = true;
      } catch (err) {}
      animTimer = setTimeout(step, frame.delay);
    })();
  }

  function buildAnimToggle(viewer) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preview-anim-toggle' + (animOn ? ' on' : '');
    const label = document.createElement('span');
    label.textContent = 'Animated';
    const sw = document.createElement('span');
    sw.className = 'preview-anim-switch';
    btn.appendChild(label);
    btn.appendChild(sw);
    btn.addEventListener('click', function () {
      animOn = !animOn;
      btn.classList.toggle('on', animOn);
      if (animOn) {
        playCapeAnimation(viewer);
      } else {
        stopCapeAnimation();
        if (staticCapeUrl) applyCape(viewer, staticCapeUrl);
      }
    });
    previewPanel.appendChild(btn);
  }

  function startCapeAnimation(viewer) {
    if (!cape.animated) return;
    decodeGifFrames(Store.capesBase + encodeURIComponent(cape.animated)).then(function (frames) {
      if (frames.length < 2) return;
      animFrames = frames;
      buildAnimToggle(viewer);
      if (animOn) playCapeAnimation(viewer);
    });
  }

  function fetchObjectUrl(url) {
    return fetch(url, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.blob();
      })
      .then(function (blob) { return URL.createObjectURL(blob); });
  }

  function startViewer() {
    if (viewerStarted || !cape || typeof skinview3d === 'undefined') return;
    viewerStarted = true;
    const canvas = document.createElement('canvas');
    previewPanel.appendChild(canvas);
    const size = Math.min(previewPanel.clientWidth || 460, 620);
    const viewer = new skinview3d.SkinViewer({
      canvas: canvas,
      width: size,
      height: size,
      zoom: 0.9
    });
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = false;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;
    viewer.playerObject.rotation.y = Math.PI;
    viewer.controls.addEventListener('start', function () { viewer.autoRotate = false; });
    Promise.all([
      fetchObjectUrl('skin.png').then(function (url) { return viewer.loadSkin(url); }),
      fetchObjectUrl(Store.capesBase + encodeURIComponent(cape.file)).then(function (url) {
        staticCapeUrl = url;
        return viewer.loadCape(url);
      })
    ]).then(function () {
      const skeleton = document.getElementById('previewSkeleton');
      if (skeleton) skeleton.remove();
      const hint = document.getElementById('previewHint');
      if (hint) hint.hidden = false;
      startCapeAnimation(viewer);
    }).catch(function () {
      viewerStarted = false;
      canvas.remove();
      const skeleton = document.getElementById('previewSkeleton');
      if (skeleton) skeleton.classList.remove('skeleton-shimmer');
    });
    window.addEventListener('resize', function () {
      const newSize = Math.min(previewPanel.clientWidth || 460, 620);
      viewer.setSize(newSize, newSize);
    });
  }

  if (!capeId) {
    showNotFound();
    return;
  }

  Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
    .then(function (data) {
      const catalog = Array.isArray(data) ? data : [];
      cape = catalog.find(function (c) { return c.id === capeId && c.store; }) || null;
      if (!cape) {
        showNotFound();
        return;
      }
      document.title = (cape.name || cape.id) + ' | Frost Store';
      renderInfo(Store.getProfile());
      Store.onProfile(function (profile) { renderInfo(profile); });
      startViewer();
    })
    .catch(function () { showNotFound(); });
})();
