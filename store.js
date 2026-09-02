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

  function updateNav() {
    const signinBtn = document.getElementById('navSigninBtn');
    const userChip = document.getElementById('navUser');
    const token = loadToken();
    const user = (profileCache && profileCache.user) || (token ? loadCachedUser() : null);
    const loggedIn = !!(token && user);
    if (signinBtn && userChip) {
      if (loggedIn) {
        signinBtn.style.display = 'none';
        userChip.classList.add('visible');
        document.getElementById('navUserAvatar').src = avatarUrl(user);
        document.getElementById('navUserName').textContent = user.name || user.username || 'Account';
      } else {
        signinBtn.style.display = '';
        userChip.classList.remove('visible');
      }
      userChip.classList.toggle('lite', !!(profileCache && profileCache.liteActive));
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
    buildCapeCard: buildCapeCard
  };

  function priceValue(cape) {
    const store = cape.store || {};
    return typeof store.price === 'number' ? store.price : Infinity;
  }

  function pricePill(cape) {
    const store = cape.store || {};
    if (store.subscription) return { text: store.subscription === 'annual' ? 'ANNUAL LITE' : 'LITE', cls: store.subscription === 'annual' ? 'pill-annual' : 'pill-lite' };
    if (store.price === 0 || store.price === 'free') return { text: 'FREE', cls: 'pill-free' };
    if (typeof store.price === 'number') {
      return { text: '€' + store.price.toFixed(2), cls: store.checkout ? '' : 'pill-soon' };
    }
    return { text: 'COMING SOON', cls: 'pill-soon' };
  }

  function isOwned(cape, profile) {
    return !!(profile && profile.owned && profile.owned.indexOf(cape.id) !== -1);
  }

  function buildCapeCard(cape, profile) {
    const card = document.createElement('a');
    card.className = 'cape-card';
    card.href = 'cape?id=' + encodeURIComponent(cape.id);
    const previewWrap = document.createElement('div');
    previewWrap.className = 'cape-card-preview-wrap';
    if (cape.store && cape.store.preview) {
      const img = document.createElement('img');
      img.className = 'cape-card-preview-img';
      img.src = CAPES_BASE + cape.store.preview.split('/').map(encodeURIComponent).join('/');
      img.alt = '';
      img.loading = 'lazy';
      previewWrap.appendChild(img);
    } else {
      const preview = document.createElement('div');
      preview.className = 'cape-card-preview';
      preview.style.backgroundImage = 'url(' + CAPES_BASE + encodeURIComponent(cape.file) + ')';
      previewWrap.appendChild(preview);
    }
    card.appendChild(previewWrap);
    const name = document.createElement('div');
    name.className = 'cape-card-name';
    name.textContent = cape.name || cape.id;
    card.appendChild(name);
    const pill = pricePill(cape);
    const pillEl = document.createElement('span');
    pillEl.className = 'cape-price-pill' + (pill.cls ? ' ' + pill.cls : '');
    pillEl.textContent = pill.text;
    card.appendChild(pillEl);
    if (cape.animated) {
      const anim = document.createElement('span');
      anim.className = 'cape-animated-badge';
      anim.textContent = 'ANIMATED';
      card.appendChild(anim);
    }
    if (isOwned(cape, profile)) {
      const owned = document.createElement('span');
      owned.className = 'cape-owned-badge';
      owned.textContent = 'OWNED';
      card.appendChild(owned);
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
    const logoutBtn = document.getElementById('navLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      clearAuth();
      updateNav();
    });
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
