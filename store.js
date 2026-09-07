(function () {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  function resizeCanvas() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  for (let i = 0; i < 70; i++) particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.5 + 0.5,
    speed: Math.random() * 0.4 + 0.1,
    drift: (Math.random() - 0.5) * 0.3,
    opacity: Math.random() * 0.4 + 0.1
  });
  (function animateParticles() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168,230,248,${p.opacity})`;
      ctx.fill();
      p.y += p.speed; p.x += p.drift;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      if (p.x > W + 10) p.x = -10;
      if (p.x < -10) p.x = W + 10;
    }
    requestAnimationFrame(animateParticles);
  })();
})();

(function () {
  const STORE_API_URL = 'https://script.google.com/macros/s/AKfycbxF57u1UNBsonktp5_2EseJtFkBZR0-CCxyazOGVUmEBrcwjU1-t6Us41gcrRqCsGcR/exec';
  const CAPES_JSON_URL = 'https://bot.frostclient.eu/launcher/capes/capes.json';
  const CAPES_BASE = 'https://bot.frostclient.eu/launcher/capes/';
  const DISCORD_CLIENT_ID = '1512834635640475898';
  const REDIRECT_URI_STORE = 'https://store.frostclient.eu';
  const TOKEN_KEY = 'frostToken';
  const USER_KEY = 'frostStoreUser';
  const PROFILE_KEY = 'frostStoreProfile';
  const OAUTH_STATE_KEY = 'frostStoreOauthState';

  function loadToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function saveToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }
  function clearAuth() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch (e) {}
    profileCache = null;
    notifyProfile();
  }
  function loadCachedUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveCachedUser(user) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (e) {}
  }
  function loadCachedProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveCachedProfile(profile) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {}
  }

  function fetchJsonWithRetry(url, options, retries) {
    return fetch(url, options)
      .then(function (r) { return r.json(); })
      .catch(function (err) {
        if (retries > 0) {
          return new Promise(function (resolve) { setTimeout(resolve, 1200); })
            .then(function () { return fetchJsonWithRetry(url, options, retries - 1); });
        }
        throw err;
      });
  }

  function startLogin(redirectKind, extraState) {
    let csrfState = '';
    try {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      csrfState = Array.from(buf).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      sessionStorage.setItem(OAUTH_STATE_KEY, csrfState);
    } catch (e) {}
    const redirectUri = redirectKind === 'ty' ? 'https://store.frostclient.eu/thank-you' : REDIRECT_URI_STORE;
    const state = csrfState + (extraState || '');
    window.location.href = 'https://discord.com/oauth2/authorize'
      + '?client_id=' + encodeURIComponent(DISCORD_CLIENT_ID)
      + '&response_type=code'
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&scope=identify'
      + '&state=' + state;
  }

  function consumeOauthReturn() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('code') && !params.has('error')) return null;
    const code = params.get('code');
    const returnedState = params.get('state') || '';
    let storedState = '';
    try { storedState = sessionStorage.getItem(OAUTH_STATE_KEY) || ''; } catch (e) {}
    try { sessionStorage.removeItem(OAUTH_STATE_KEY); } catch (e) {}
    const cleanUrl = new URL(window.location.href);
    ['code', 'state', 'error', 'error_description'].forEach(function (k) { cleanUrl.searchParams.delete(k); });
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    if (!code) return null;
    if (storedState && !returnedState.startsWith(storedState)) return null;
    return { code: code, state: returnedState.slice(storedState.length) };
  }

  let profileCache = null;
  let authSettled = false;
  let profileListeners = [];
  function notifyProfile() {
    profileListeners.forEach(function (fn) {
      try { fn(profileCache); } catch (e) {}
    });
  }

  function applyProfile(data) {
    if (!data || !data.ok) return false;
    profileCache = {
      user: data.user || loadCachedUser(),
      liteActive: !!data.liteActive,
      owned: Array.isArray(data.owned) ? data.owned : [],
      token: data.token || loadToken()
    };
    if (data.token) saveToken(data.token);
    if (data.user) saveCachedUser(data.user);
    saveCachedProfile({ user: profileCache.user, liteActive: profileCache.liteActive, owned: profileCache.owned });
    notifyProfile();
    return true;
  }

  function exchangeCode(code, redirectKind) {
    return fetchJsonWithRetry(STORE_API_URL + '?action=storeAuth&code=' + encodeURIComponent(code)
      + '&rd=' + encodeURIComponent(redirectKind || 'store'), { cache: 'no-store' }, 2)
      .then(function (data) {
        if (data && data.ok) applyProfile(data);
        return data;
      });
  }

  function refreshProfile() {
    const token = loadToken();
    if (!token) return Promise.resolve(null);
    return fetchJsonWithRetry(STORE_API_URL + '?action=storeProfile&token=' + encodeURIComponent(token), { cache: 'no-store' }, 2)
      .then(function (data) {
        if (data && data.ok) {
          applyProfile(data);
          return profileCache;
        }
        if (data && data.error === 'token_expired') clearAuth();
        return null;
      })
      .catch(function () { return null; });
  }

  let toastEl = null;
  let toastTimer = null;
  function showStoreToast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'store-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('visible'); }, 7000);
  }

  function avatarUrl(user) {
    if (user && user.avatar) {
      return 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=64';
    }
    let idx = 0;
    try { idx = Number((BigInt((user && user.id) || '0') >> 22n) % 6n); } catch (e) {}
    return 'https://cdn.discordapp.com/embed/avatars/' + idx + '.png';
  }

  const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const ICON_CAPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>';
  const ICON_LOGOUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>';
  const MANAGE_URL = 'https://frostclient.eu/#account';
  let navMenu = null;

  function positionNavMenu() {
    const btn = document.getElementById('navUserBtn');
    if (!navMenu || !btn) return;
    const r = btn.getBoundingClientRect();
    navMenu.style.top = Math.round(r.bottom + 8) + 'px';
    navMenu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
  }
  function ensureNavMenu() {
    if (navMenu) return navMenu;
    navMenu = document.createElement('div');
    navMenu.className = 'frost-nav-menu';
    navMenu.setAttribute('role', 'menu');
    navMenu.innerHTML =
      '<a class="frost-nav-menu-item frost-nav-manage" role="menuitem" href="' + MANAGE_URL + '">' + ICON_USER + 'Manage</a>' +
      '<a class="frost-nav-menu-item frost-nav-capes" role="menuitem" href="my-capes">' + ICON_CAPE + 'My Capes</a>' +
      '<button type="button" class="frost-nav-menu-item is-danger frost-nav-signout" role="menuitem">' + ICON_LOGOUT + 'Sign Out</button>';
    navMenu.querySelector('.frost-nav-manage').addEventListener('click', closeNavMenu);
    navMenu.querySelector('.frost-nav-capes').addEventListener('click', closeNavMenu);
    navMenu.querySelector('.frost-nav-signout').addEventListener('click', function () {
      closeNavMenu();
      clearAuth();
      updateNav();
    });
    document.body.appendChild(navMenu);
    return navMenu;
  }
  function closeNavMenu() {
    if (!navMenu) return;
    navMenu.classList.remove('open');
    const btn = document.getElementById('navUserBtn');
    if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  }
  function toggleNavMenu() {
    const btn = document.getElementById('navUserBtn');
    const menu = ensureNavMenu();
    const open = !menu.classList.contains('open');
    if (open) positionNavMenu();
    menu.classList.toggle('open', open);
    if (btn) { btn.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  }
  document.addEventListener('click', function (e) {
    if (!navMenu || !navMenu.classList.contains('open')) return;
    const btn = document.getElementById('navUserBtn');
    if ((btn && btn.contains(e.target)) || navMenu.contains(e.target)) return;
    closeNavMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNavMenu(); });
  window.addEventListener('resize', function () { if (navMenu && navMenu.classList.contains('open')) positionNavMenu(); });

  function updateNav() {
    const signinBtn = document.getElementById('navSigninBtn');
    const userBtn = document.getElementById('navUserBtn');
    const token = loadToken();
    const user = (profileCache && profileCache.user) || (token ? loadCachedUser() : null);
    const loggedIn = !!(token && user);
    if (signinBtn && userBtn) {
      signinBtn.hidden = loggedIn;
      userBtn.hidden = !loggedIn;
      if (loggedIn) {
        const avatar = document.getElementById('navUserAvatar');
        avatar.style.display = '';
        avatar.src = avatarUrl(user);
        document.getElementById('navUserName').textContent = user.name || user.username || 'Account';
      } else {
        closeNavMenu();
      }
      const cachedProfile = loadCachedProfile();
      userBtn.classList.toggle('is-lite', loggedIn && !!((profileCache && profileCache.liteActive) || (!profileCache && cachedProfile && cachedProfile.liteActive)));
    }
    const footerBtn = document.getElementById('footerSigninBtn');
    if (footerBtn) footerBtn.textContent = loggedIn ? 'Logout' : 'Sign in';
  }

  window.FrostStore = {
    apiUrl: STORE_API_URL,
    capesJsonUrl: CAPES_JSON_URL,
    capesBase: CAPES_BASE,
    loadToken: loadToken,
    clearAuth: clearAuth,
    startLogin: startLogin,
    consumeOauthReturn: consumeOauthReturn,
    exchangeCode: exchangeCode,
    refreshProfile: refreshProfile,
    getProfile: function () { return profileCache; },
    isAuthSettled: function () { return authSettled; },
    onProfile: function (fn) {
      profileListeners.push(fn);
      fn(profileCache);
    },
    updateNav: updateNav,
    fetchJsonWithRetry: fetchJsonWithRetry,
    priceValue: priceValue,
    pricePill: pricePill,
    isOwned: isOwned,
    salePrice: salePrice,
    buildCapeCard: buildCapeCard
  };

  function priceValue(cape) {
    const store = cape.store || {};
    return typeof store.price === 'number' ? store.price : Infinity;
  }

  function salePrice(cape) {
    const store = cape.store || {};
    if (typeof store.price !== 'number' || typeof store.originalPrice !== 'number' || store.originalPrice <= store.price) return null;
    return { original: store.originalPrice, percent: Math.round((1 - store.price / store.originalPrice) * 100) };
  }

  function pricePill(cape) {
    const store = cape.store || {};
    if (store.subscription) return { text: store.subscription === 'annual' ? 'ANNUAL LITE' : 'LITE', cls: store.subscription === 'annual' ? 'pill-annual' : 'pill-lite' };
    if (store.price === 0 || store.price === 'free') return { text: 'FREE', cls: 'pill-free' };
    if (typeof store.price === 'number') {
      const sale = salePrice(cape);
      return { text: '€' + store.price.toFixed(2), cls: store.checkout ? (sale ? 'pill-sale' : '') : 'pill-soon', original: sale && store.checkout ? '€' + sale.original.toFixed(2) : null, percent: sale ? sale.percent : 0 };
    }
    return { text: 'COMING SOON', cls: 'pill-soon' };
  }

  function isOwned(cape, profile) {
    return !!(profile && profile.owned && profile.owned.indexOf(cape.id) !== -1);
  }

  const PREVIEW_W = 260;
  const PREVIEW_H = 392;
  const PREVIEW_CAMERA_DISTANCE = 24;
  const PREVIEW_CAMERA_Y = 9;
  const PREVIEW_TARGET_Y = -0.5;
  const PREVIEW_YAW = 0.5;
  let previewViewer = null;
  let previewQueue = Promise.resolve();
  const previewCache = {};

  function getPreviewViewer() {
    if (previewViewer) return previewViewer;
    if (typeof skinview3d === 'undefined') return null;
    try {
      const viewer = new skinview3d.SkinViewer({
        canvas: document.createElement('canvas'),
        width: PREVIEW_W,
        height: PREVIEW_H,
        renderPaused: true,
        preserveDrawingBuffer: true
      });
      viewer.controls.enabled = false;
      viewer.autoRotate = false;
      viewer.playerObject.rotation.y = Math.PI + PREVIEW_YAW;
      viewer.playerObject.skin.visible = false;
      viewer.controls.target.set(0, PREVIEW_TARGET_Y, 0);
      viewer.camera.position.set(0, PREVIEW_CAMERA_Y, PREVIEW_CAMERA_DISTANCE);
      viewer.camera.lookAt(0, PREVIEW_TARGET_Y, 0);
      previewViewer = viewer;
    } catch (err) {
      previewViewer = null;
    }
    return previewViewer;
  }

  function fetchCapeObjectUrl(file) {
    return fetch(CAPES_BASE + encodeURIComponent(file), { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.blob();
      })
      .then(function (blob) { return URL.createObjectURL(blob); });
  }

  function renderCapePreview(cape) {
    const key = cape.file;
    if (previewCache[key]) return previewCache[key];
    const viewer = getPreviewViewer();
    if (!viewer) return Promise.reject(new Error('no_viewer'));
    const job = previewQueue.catch(function () {}).then(function () {
      return fetchCapeObjectUrl(cape.file).then(function (url) {
        return viewer.loadCape(url).then(function () {
          URL.revokeObjectURL(url);
          viewer.playerObject.skin.visible = false;
          viewer.playerObject.cape.visible = true;
          viewer.controls.update();
          viewer.render();
          return viewer.canvas.toDataURL('image/png');
        });
      });
    });
    previewQueue = job;
    previewCache[key] = job;
    job.catch(function () { delete previewCache[key]; });
    return job;
  }

  function buildCapePreview(cape) {
    const previewWrap = document.createElement('div');
    previewWrap.className = 'cape-card-preview-wrap';
    const flat = document.createElement('div');
    flat.className = 'cape-card-preview';
    flat.style.backgroundImage = 'url(' + CAPES_BASE + encodeURIComponent(cape.file) + ')';
    previewWrap.appendChild(flat);
    renderCapePreview(cape).then(function (dataUrl) {
      const img = document.createElement('img');
      img.className = 'cape-card-preview-img is-3d';
      img.alt = '';
      img.src = dataUrl;
      img.addEventListener('load', function () { img.classList.add('ready'); });
      previewWrap.replaceChild(img, flat);
    }).catch(function () {
      if (cape.store && cape.store.preview) {
        const img = document.createElement('img');
        img.className = 'cape-card-preview-img';
        img.src = CAPES_BASE + cape.store.preview.split('/').map(encodeURIComponent).join('/');
        img.alt = '';
        img.loading = 'lazy';
        previewWrap.replaceChild(img, flat);
      }
    });
    return previewWrap;
  }

  function buildCapeCard(cape, profile) {
    const card = document.createElement('a');
    card.className = 'cape-card';
    card.href = 'cape?id=' + encodeURIComponent(cape.id);
    card.appendChild(buildCapePreview(cape));
    const name = document.createElement('div');
    name.className = 'cape-card-name';
    name.textContent = cape.name || cape.id;
    card.appendChild(name);
    const owned = isOwned(cape, profile);
    const pill = owned ? { text: 'OWNED', cls: 'pill-owned' } : pricePill(cape);
    const pillEl = document.createElement('span');
    pillEl.className = 'cape-price-pill' + (pill.cls ? ' ' + pill.cls : '');
    if (pill.original) {
      const old = document.createElement('s');
      old.className = 'cape-price-old';
      old.textContent = pill.original;
      pillEl.appendChild(old);
      pillEl.appendChild(document.createTextNode(pill.text));
      const sale = document.createElement('span');
      sale.className = 'cape-sale-badge';
      sale.textContent = '-' + pill.percent + '%';
      card.appendChild(sale);
    } else {
      pillEl.textContent = pill.text;
    }
    card.appendChild(pillEl);
    if (cape.animated) {
      const anim = document.createElement('span');
      anim.className = 'cape-animated-badge';
      anim.textContent = 'ANIMATED';
      card.appendChild(anim);
    }
    return card;
  }

  function bindAuthButtons() {
    const signinBtn = document.getElementById('navSigninBtn');
    if (signinBtn) signinBtn.addEventListener('click', function () { startLogin('store'); });
    const footerBtn = document.getElementById('footerSigninBtn');
    if (footerBtn) footerBtn.addEventListener('click', function () {
      if (loadToken()) clearAuth();
      else startLogin('store');
    });
    const userBtn = document.getElementById('navUserBtn');
    if (userBtn) userBtn.addEventListener('click', toggleNavMenu);
    const avatar = document.getElementById('navUserAvatar');
    if (avatar) avatar.addEventListener('error', function () { avatar.style.display = 'none'; });
  }

  function init() {
    if (loadToken()) {
      const cached = loadCachedProfile();
      if (cached) {
        profileCache = {
          user: cached.user || loadCachedUser(),
          liteActive: !!cached.liteActive,
          owned: Array.isArray(cached.owned) ? cached.owned : [],
          token: loadToken()
        };
      }
    }
    bindAuthButtons();
    updateNav();
    profileListeners.push(updateNav);
    const oauthReturn = document.body.dataset.storeAuthPage === 'ty' ? null : consumeOauthReturn();
    const authFlow = oauthReturn
      ? exchangeCode(oauthReturn.code, 'store').then(function (data) {
          if (!data || !data.ok) {
            console.error('Store sign-in failed:', data);
            showStoreToast('Sign-in failed' + (data && data.error ? ' (' + data.error + ')' : '') + '. Please try again.');
          }
          return profileCache;
        }).catch(function () {
          showStoreToast('Network error during sign-in. Please try again.');
          return null;
        })
      : refreshProfile();
    authFlow.then(function () {
      authSettled = true;
      notifyProfile();
      updateNav();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
  const grid = document.getElementById('capeGrid');
  if (!grid) return;
  const Store = window.FrostStore;
  let catalog = null;
  let searchQuery = '';
  let sortMode = 'default';

  function render() {
    if (!catalog) return;
    const profile = Store.getProfile();
    const visible = catalog.filter(function (cape) {
      if (!cape.store || cape.store.subscription) return false;
      if (searchQuery && String(cape.name || cape.id).toLowerCase().indexOf(searchQuery) === -1) return false;
      return true;
    });
    if (sortMode === 'price-asc') {
      visible.sort(function (a, b) { return Store.priceValue(a) - Store.priceValue(b); });
    } else if (sortMode === 'price-desc') {
      const pv = function (c) { const v = Store.priceValue(c); return v === Infinity ? -Infinity : v; };
      visible.sort(function (a, b) { return pv(b) - pv(a); });
    }
    grid.innerHTML = '';
    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'store-empty';
      empty.textContent = searchQuery ? 'No capes match your search.' : 'No capes available right now.';
      grid.appendChild(empty);
      return;
    }
    visible.forEach(function (cape) {
      grid.appendChild(Store.buildCapeCard(cape, profile));
    });
  }

  const searchInput = document.getElementById('storeSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value.trim().toLowerCase();
      render();
    });
  }
  const sortSelect = document.getElementById('storeSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      sortMode = sortSelect.value;
      render();
    });
  }

  const teaser = document.getElementById('liteTeaser');
  const teaserGrid = document.getElementById('liteTeaserGrid');
  function renderTeaser() {
    if (!teaser || !teaserGrid || !catalog) return;
    const profile = Store.getProfile();
    const hasToken = !!Store.loadToken();
    if (hasToken && !Store.isAuthSettled()) return;
    const annual = catalog.find(function (c) { return c.id === 'lite_year'; });
    const lite = catalog.find(function (c) { return c.id === 'lite'; });
    const showAnnual = annual && !Store.isOwned(annual, profile);
    const showLite = lite && !Store.isOwned(lite, profile);
    if (!showAnnual && !showLite) {
      teaser.hidden = true;
      return;
    }
    teaserGrid.innerHTML = '';
    if (showAnnual) teaserGrid.appendChild(Store.buildCapeCard(annual, profile));
    if (showLite) teaserGrid.appendChild(Store.buildCapeCard(lite, profile));
    teaser.hidden = false;
  }

  Store.onProfile(function () { render(); renderTeaser(); });

  Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
    .then(function (data) {
      catalog = Array.isArray(data) ? data : [];
      render();
      renderTeaser();
    })
    .catch(function () {
      grid.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'store-error';
      err.textContent = "Couldn't load the cape catalog. Please try again later.";
      grid.appendChild(err);
    });
})();

(function () {
  const navEl = document.querySelector('nav');
  if (!navEl) return;
  function onScroll() {
    navEl.classList.toggle('nav-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
