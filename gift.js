(function () {
  const Store = window.FrostStore;
  const BOT_BASE = 'https://bot.frostclient.eu';
  const SKIN_KEY = 'frostStoreSkin';
  const code = String(new URLSearchParams(window.location.search).get('c') || '').trim().toLowerCase();
  const layout = document.getElementById('detailLayout');
  const notFound = document.getElementById('detailNotfound');
  const info = document.getElementById('detailInfo');
  const previewPanel = document.getElementById('previewPanel');
  let gift = null;
  let claiming = false;
  let claimError = '';
  let justClaimed = false;
  let viewer = null;
  let viewerStarted = false;
  let staticCapeUrl = null;
  let animFrames = null;
  let animTimer = null;
  let animOn = true;

  const ERROR_TEXT = {
    not_signed_in: 'Your session expired. Sign in again to claim this gift.',
    already_owned: 'You already own this cape.',
    expired: 'This gift has expired.',
    full: 'All gifts from this link have already been claimed.',
    revoked: 'This gift is no longer available.',
    rate_limited: 'Too many attempts. Wait a minute and try again.',
    grant_failed: 'The cape could not be added to your account right now. Try again in a moment.',
    not_found: 'This gift link is invalid.'
  };

  function showNotFound() {
    layout.hidden = true;
    notFound.hidden = false;
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function claimsLabel() {
    if (gift.maxClaims == null) return gift.claims + ' claimed · unlimited';
    return gift.claims + ' / ' + gift.maxClaims + ' claimed';
  }

  function ownsCape(profile) {
    if (!gift || !gift.cape) return false;
    if (gift.claimed || justClaimed) return true;
    return !!(profile && profile.owned && profile.owned.indexOf(gift.cape.id) !== -1);
  }

  function note(text, isError) {
    const el = document.createElement('div');
    el.className = 'detail-cta-note' + (isError ? ' gift-cta-error' : '');
    el.textContent = text;
    return el;
  }

  function disabledButton(text) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-cta cta-disabled';
    btn.disabled = true;
    btn.textContent = text;
    return btn;
  }

  function buildCta(profile) {
    const wrap = document.createElement('div');
    wrap.className = 'detail-cta-wrap';
    const loggedIn = !!(profile && profile.user);
    if (!profile && Store.loadToken() && !Store.isAuthSettled()) {
      wrap.appendChild(disabledButton('· · ·'));
      return wrap;
    }
    if (loggedIn && ownsCape(profile)) {
      const btn = document.createElement('a');
      btn.className = 'detail-cta cta-buy';
      btn.href = 'frostclient://cape/' + encodeURIComponent(gift.cape.id);
      btn.textContent = 'Equip';
      wrap.appendChild(btn);
      wrap.appendChild(note(justClaimed || gift.claimed
        ? 'Gift claimed. The cape is now in your account and in the Frost Client Launcher.'
        : 'You already own this cape. Equip opens the Frost Client Launcher.'));
      return wrap;
    }
    if (gift.status === 'expired') {
      wrap.appendChild(disabledButton('Gift expired'));
      return wrap;
    }
    if (gift.status === 'full') {
      wrap.appendChild(disabledButton('All gifts claimed'));
      return wrap;
    }
    if (gift.status === 'revoked') {
      wrap.appendChild(disabledButton('Gift unavailable'));
      return wrap;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-cta cta-buy';
    if (!loggedIn) {
      btn.textContent = 'Sign in to claim';
      btn.addEventListener('click', function () {
          Store.startLogin('store', '.g.' + code);
      });
      wrap.appendChild(btn);
      wrap.appendChild(note('Sign in with Discord so the cape can be added to your account.'));
      return wrap;
    }
    btn.textContent = claiming ? 'Claiming…' : 'Claim Gift';
    btn.disabled = claiming;
    btn.addEventListener('click', claim);
    wrap.appendChild(btn);
    if (claimError) wrap.appendChild(note(claimError, true));
    else wrap.appendChild(note('The cape is added to your account right away.'));
    return wrap;
  }

  function metaRow(label, value) {
    const row = document.createElement('div');
    row.className = 'detail-meta-row';
    const l = document.createElement('span');
    l.className = 'detail-meta-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'detail-meta-value';
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function renderInfo(profile) {
    if (!gift) return;
    info.innerHTML = '';
    const name = document.createElement('h1');
    name.className = 'detail-name';
    name.textContent = gift.cape.name;
    info.appendChild(name);
    const priceRow = document.createElement('div');
    priceRow.className = 'detail-price-row';
    const pill = document.createElement('span');
    pill.className = 'cape-price-pill ' + (gift.status === 'active' ? 'pill-free' : 'pill-soon');
    pill.textContent = gift.status === 'active' ? 'FREE GIFT' : 'GIFT ENDED';
    priceRow.appendChild(pill);
    info.appendChild(priceRow);
    const meta = document.createElement('div');
    meta.className = 'detail-meta';
    meta.appendChild(metaRow(gift.status === 'expired' ? 'Ended' : 'Available until', formatDateTime(gift.expiresAt)));
    meta.appendChild(metaRow('Claims', claimsLabel()));
    meta.appendChild(metaRow('Animated', gift.cape.animated ? 'Yes' : 'No'));
    info.appendChild(meta);
    if (gift.cape.description) {
      const desc = document.createElement('p');
      desc.className = 'detail-desc';
      desc.textContent = gift.cape.description;
      info.appendChild(desc);
    }
    info.appendChild(buildCta(profile));
  }

  function applyGift(data) {
    gift = {
      status: data.status,
      maxClaims: data.maxClaims,
      claims: data.claims,
      expiresAt: data.expiresAt,
      claimed: !!data.claimed,
      cape: data.cape
    };
  }

  function claim() {
    if (claiming) return;
    const token = Store.loadToken();
    if (!token) {
      Store.startLogin('store', '.g.' + code);
      return;
    }
    claiming = true;
    claimError = '';
    renderInfo(Store.getProfile());
    fetch(BOT_BASE + '/cape-gift/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, token: token })
    })
      .then(function (r) {
          return r.json();
      })
      .then(function (data) {
        claiming = false;
        if (data && data.cape) applyGift(data);
        if (data && data.ok) {
          justClaimed = true;
          Store.refreshProfile();
        } else {
          claimError = ERROR_TEXT[data && data.error] || 'Something went wrong. Try again in a moment.';
          if (data && data.error === 'not_signed_in') Store.clearAuth();
        }
        renderInfo(Store.getProfile());
      })
      .catch(function () {
        claiming = false;
        claimError = 'Network error. Check your connection and try again.';
        renderInfo(Store.getProfile());
      });
  }

  function fetchObjectUrl(url) {
    return fetch(url, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.blob();
      })
      .then(function (blob) {
          return URL.createObjectURL(blob);
      });
  }

  function loadSavedSkin() {
    try {
        return JSON.parse(localStorage.getItem(SKIN_KEY) || 'null');
    } catch (e) {
        return null;
    }
  }

  function loadDefaultSkin(v) {
    return fetchObjectUrl('skin.png').then(function (url) {
        return v.loadSkin(url);
    });
  }

  function loadInitialSkin(v) {
    const saved = loadSavedSkin();
    if (!saved || !saved.skinUrl) return loadDefaultSkin(v);
    const model = saved.model === 'slim' ? 'slim' : (saved.model === 'default' ? 'default' : 'auto-detect');
    return Promise.resolve(v.loadSkin(saved.skinUrl, { model: model })).catch(function () {
        return loadDefaultSkin(v);
    });
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
      .catch(function () {
          return [];
      });
  }

  function stopCapeAnimation() {
    if (animTimer) clearTimeout(animTimer);
    animTimer = null;
  }

  function playCapeAnimation(v) {
    if (!animFrames || animFrames.length < 2 || animTimer || !v.capeCanvas) return;
    let index = 0;
    (function step() {
      const frame = animFrames[index];
      index = (index + 1) % animFrames.length;
      try {
        const ctx = v.capeCanvas.getContext('2d');
        ctx.clearRect(0, 0, v.capeCanvas.width, v.capeCanvas.height);
        ctx.drawImage(frame.canvas, 0, 0, v.capeCanvas.width, v.capeCanvas.height);
        if (v.capeTexture) v.capeTexture.needsUpdate = true;
      } catch (err) {}
      animTimer = setTimeout(step, frame.delay);
    })();
  }

  function buildAnimToggle(v) {
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
        playCapeAnimation(v);
      } else {
        stopCapeAnimation();
        if (staticCapeUrl) {
          const result = v.loadCape(staticCapeUrl);
          if (result && result.catch) result.catch(function () {});
        }
      }
    });
    previewPanel.appendChild(btn);
  }

  function startViewer() {
    if (viewerStarted || !gift || typeof skinview3d === 'undefined') return;
    viewerStarted = true;
    const canvas = document.createElement('canvas');
    previewPanel.appendChild(canvas);
    const size = Math.min(previewPanel.clientWidth || 460, 620);
    viewer = new skinview3d.SkinViewer({ canvas: canvas, width: size, height: size, zoom: 0.9 });
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = false;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;
    viewer.playerObject.rotation.y = Math.PI;
    viewer.controls.addEventListener('start', function () {
        viewer.autoRotate = false;
    });
    Promise.all([
      loadInitialSkin(viewer),
      fetchObjectUrl(Store.capesBase + encodeURIComponent(gift.cape.file)).then(function (url) {
        staticCapeUrl = url;
        return viewer.loadCape(url);
      })
    ]).then(function () {
      const skeleton = document.getElementById('previewSkeleton');
      if (skeleton) skeleton.remove();
      const hint = document.getElementById('previewHint');
      if (hint) hint.hidden = false;
      if (gift.cape.animated) {
        decodeGifFrames(Store.capesBase + encodeURIComponent(gift.cape.animated)).then(function (frames) {
          if (frames.length < 2) return;
          animFrames = frames;
          buildAnimToggle(viewer);
          if (animOn) playCapeAnimation(viewer);
        });
      }
    }).catch(function () {
      viewerStarted = false;
      viewer = null;
      canvas.remove();
      const skeleton = document.getElementById('previewSkeleton');
      if (skeleton) skeleton.classList.remove('skeleton-shimmer');
    });
    window.addEventListener('resize', function () {
      if (!viewer) return;
      const newSize = Math.min(previewPanel.clientWidth || 460, 620);
      viewer.setSize(newSize, newSize);
    });
  }

  function loadGift() {
    const token = Store.loadToken();
    const url = BOT_BASE + '/cape-gift/info?code=' + encodeURIComponent(code) + (token ? '&token=' + encodeURIComponent(token) : '');
    return fetch(url, { cache: 'no-store' }).then(function (r) {
        return r.json();
    });
  }

  if (!/^[a-z0-9]{4,32}$/.test(code)) {
    showNotFound();
    return;
  }

  loadGift()
    .then(function (data) {
      if (!data || !data.ok || !data.cape) {
        showNotFound();
        return;
      }
      applyGift(data);
      document.title = gift.cape.name + ' Gift | Frost Store';
      renderInfo(Store.getProfile());
      Store.onProfile(function (profile) {
          renderInfo(profile);
      });
      startViewer();
    })
    .catch(function () {
        showNotFound();
    });
})();
