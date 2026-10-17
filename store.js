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
      if (p.y > H + 10) {
          p.y = -10;
          p.x = Math.random() * W;
      }
      if (p.x > W + 10) p.x = -10;
      if (p.x < -10) p.x = W + 10;
    }
    requestAnimationFrame(animateParticles);
  })();
})();

(function () {
  const STORE_API_URL = 'https://bot.frostclient.eu/sheets';
  const CAPES_JSON_URL = 'https://bot.frostclient.eu/launcher/capes/capes.json';
  const COLLECTIONS_JSON_URL = 'https://bot.frostclient.eu/launcher/capes/collections.json';
  const CAPES_BASE = 'https://bot.frostclient.eu/launcher/capes/';
  const DISCORD_CLIENT_ID = '1512834635640475898';
  const REDIRECT_URI_STORE = 'https://store.frostclient.eu';
  const TOKEN_KEY = 'frostToken';
  const USER_KEY = 'frostStoreUser';
  const PROFILE_KEY = 'frostStoreProfile';
  const OAUTH_STATE_KEY = 'frostStoreOauthState';

  function loadToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
        return '';
    }
  }
  function saveToken(token) {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
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
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
        return null;
    }
  }
  function saveCachedUser(user) {
    try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {}
  }
  function loadCachedProfile() {
    try {
        return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch (e) {
        return null;
    }
  }
  function saveCachedProfile(profile) {
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }

  function fetchJsonWithRetry(url, options, retries) {
    return fetch(url, options)
      .then(function (r) {
          return r.json();
      })
      .catch(function (err) {
        if (retries > 0) {
          return new Promise(function (resolve) {
              setTimeout(resolve, 1200);
          })
            .then(function () {
                return fetchJsonWithRetry(url, options, retries - 1);
            });
        }
        throw err;
      });
  }

  let authPending = false;
  function setAuthPending(pending) {
    authPending = pending;
    const signinBtn = document.getElementById('navSigninBtn');
    if (signinBtn) {
      signinBtn.classList.toggle('is-loading', pending);
      signinBtn.disabled = pending;
      const label = signinBtn.querySelector('span');
      if (label) label.textContent = pending ? 'Signing in…' : 'Sign in';
    }
    const footerBtn = document.getElementById('footerSigninBtn');
    if (footerBtn) {
      footerBtn.disabled = pending;
      if (pending) footerBtn.textContent = 'Signing in…';
    }
  }
  window.addEventListener('pageshow', function (e) {
      if (e.persisted && authPending) {
          setAuthPending(false);
          updateNav();
      }
  });

  function startLogin(redirectKind, extraState) {
    setAuthPending(true);
    let csrfState = '';
    try {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      csrfState = Array.from(buf).map(function (b) {
          return b.toString(16).padStart(2, '0');
      }).join('');
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
    try {
        storedState = sessionStorage.getItem(OAUTH_STATE_KEY) || '';
    } catch (e) {}
    try {
        sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch (e) {}
    const cleanUrl = new URL(window.location.href);
    ['code', 'state', 'error', 'error_description'].forEach(function (k) {
        cleanUrl.searchParams.delete(k);
    });
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    if (!code) {
      showStoreToast(params.get('error') === 'access_denied' ? 'Sign-in was cancelled.' : 'Discord sign-in failed. Please try again.');
      return null;
    }
    if (storedState) {
      if (!returnedState.startsWith(storedState)) {
        showStoreToast('Sign-in session mismatch. Please try signing in again.');
        return null;
      }
      return { code: code, state: returnedState.slice(storedState.length) };
    }
    return { code: code, state: returnedState.replace(/^[a-f0-9]{32}/, '') };
  }

  let profileCache = null;
  let authSettled = false;
  let profileListeners = [];
  function notifyProfile() {
    profileListeners.forEach(function (fn) {
      try {
          fn(profileCache);
      } catch (e) {}
    });
  }

  function applyProfile(data) {
    if (!data || !data.ok) return false;
    const previous = profileCache || loadCachedProfile() || {};
    profileCache = {
      user: data.user || loadCachedUser(),
      liteActive: !!data.liteActive,
      litePlan: data.litePlan || null,
      liteDiscountPercent: Number(data.liteDiscountPercent) || 0,
      giftExpiresAt: data.giftExpiresAt || null,
      owned: Array.isArray(data.owned) ? data.owned : (Array.isArray(previous.owned) ? previous.owned : []),
      token: data.token || loadToken()
    };
    if (data.token) saveToken(data.token);
    if (data.user) saveCachedUser(data.user);
    saveCachedProfile({ user: profileCache.user, liteActive: profileCache.liteActive, litePlan: profileCache.litePlan, liteDiscountPercent: profileCache.liteDiscountPercent, giftExpiresAt: profileCache.giftExpiresAt, owned: profileCache.owned });
    notifyProfile();
    return true;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
  }

  function exchangeCode(code, redirectKind) {
    const url = STORE_API_URL + '?action=storeAuth&code=' + encodeURIComponent(code) + '&rd=' + encodeURIComponent(redirectKind || 'store');
    let sawNetworkError = false;
    function attempt(n) {
      return fetch(url, { cache: 'no-store' }).then(function (r) {
        return r.json().catch(function () {
            return { ok: false, error: 'bad_response', detail: 'HTTP ' + r.status };
        }).then(function (data) {
          if (data && !data.ok && (data.error === 'busy' || data.error === 'rate_limited') && n < 3) {
            return delay(1500 * (n + 1)).then(function () {
                return attempt(n + 1);
            });
          }
          if (data && !data.ok && data.error === 'auth_failed' && sawNetworkError) throw new TypeError('network_error');
          return data;
        });
      }, function (err) {
        if (n >= 2) throw err;
        sawNetworkError = true;
        return delay(1000 * (n + 1)).then(function () {
            return attempt(n + 1);
        });
      });
    }
    return attempt(0).then(function (data) {
        if (data && data.ok) applyProfile(data);
        return data;
    });
  }

  function refreshProfile() {
    const token = loadToken();
    if (!token) return Promise.resolve(null);
    return botPost('/store/profile', {})
      .then(function (data) {
        if (data && data.ok) {
          applyProfile(data);
          return profileCache;
        }
        if (data && data.error === 'token_expired') clearAuth();
        return null;
      })
      .catch(function () {
          return null;
      });
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
    toastTimer = setTimeout(function () {
        toastEl.classList.remove('visible');
    }, 7000);
  }

  function avatarUrl(user) {
    if (user && user.avatar) {
      return 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=64';
    }
    let idx = 0;
    try {
        idx = Number((BigInt((user && user.id) || '0') >> 22n) % 6n);
    } catch (e) {}
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
      '<a class="frost-nav-menu-item frost-nav-capes" role="menuitem" href="my-cloaks">' + ICON_CAPE + 'My Cloaks</a>' +
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
    if (btn) {
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
    }
  }
  function toggleNavMenu() {
    const btn = document.getElementById('navUserBtn');
    const menu = ensureNavMenu();
    const open = !menu.classList.contains('open');
    if (open) positionNavMenu();
    menu.classList.toggle('open', open);
    if (btn) {
        btn.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }
  document.addEventListener('click', function (e) {
    if (!navMenu || !navMenu.classList.contains('open')) return;
    const btn = document.getElementById('navUserBtn');
    if ((btn && btn.contains(e.target)) || navMenu.contains(e.target)) return;
    closeNavMenu();
  });
  document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNavMenu();
  });
  window.addEventListener('resize', function () {
      if (navMenu && navMenu.classList.contains('open')) positionNavMenu();
  });

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
    if (footerBtn) footerBtn.textContent = loggedIn ? 'Logout' : (authPending ? 'Signing in…' : 'Sign in');
  }

  const CART_KEY = 'frostStoreCart';
  const CART_LITE_KEY = 'frostStoreCartLite';
  const LITE_PLANS = {
    monthly: { key: 'monthly', name: 'Monthly', price: 2.90, period: '/ month', checkout: 'https://whop.com/checkout/plan_oKGeLuyTvJb5u', note: '1-day free trial', dueNow: 0, capes: ['lite'] },
    annual: { key: 'annual', name: 'Annual', price: 29.90, period: '/ year', checkout: 'https://whop.com/checkout/plan_YDenpzviXSDXW', note: '', dueNow: 29.90, capes: ['lite', 'lite_year'] }
  };

  function loadLitePlan() {
    try {
        const v = localStorage.getItem(CART_LITE_KEY);
        return LITE_PLANS[v] ? v : null;
    } catch (e) {
        return null;
    }
  }

  function setLitePlan(plan) {
    try {
      if (plan && LITE_PLANS[plan]) localStorage.setItem(CART_LITE_KEY, plan);
      else localStorage.removeItem(CART_LITE_KEY);
    } catch (e) {}
    updateCartBadge();
    const list = loadCart();
    cartListeners.forEach(function (fn) {
      try {
          fn(list);
      } catch (e) {}
    });
  }
  const CART_MAX_ITEMS = 20;
  const CART_MAX_CAPES = 100;
  const cartListeners = [];
  const ICON_CART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';

  function loadCart() {
    try {
        const list = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(list) ? list.filter(function (id, i) { return typeof id === 'string' && id && list.indexOf(id) === i; }).slice(0, CART_MAX_CAPES) : [];
    } catch (e) {
        return [];
    }
  }

  function saveCart(list) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(list));
    } catch (e) {}
    updateCartBadge();
    cartListeners.forEach(function (fn) {
      try {
          fn(list);
      } catch (e) {}
    });
  }

  function cartItemCount(list) {
    const grouped = loadCartBundles().reduce(function (t, b) { return t + b.capes.length - 1; }, 0);
    return (list || loadCart()).length - grouped;
  }

  function addToCart(id) {
    const list = loadCart();
    if (list.indexOf(id) !== -1) return true;
    if (cartItemCount(list) >= CART_MAX_ITEMS || list.length >= CART_MAX_CAPES) return false;
    list.push(id);
    saveCart(list);
    return true;
  }

  function removeFromCart(ids) {
    const drop = Array.isArray(ids) ? ids : [ids];
    saveCart(loadCart().filter(function (id) { return drop.indexOf(id) === -1; }));
  }

  const CART_BUNDLES_KEY = 'frostStoreCartBundles';

  function loadCartBundles() {
    let list;
    try {
        list = JSON.parse(localStorage.getItem(CART_BUNDLES_KEY) || '[]');
    } catch (e) {
        list = [];
    }
    if (!Array.isArray(list)) return [];
    const cart = loadCart();
    return list.filter(function (b) {
      return b && typeof b.id === 'string' && Array.isArray(b.capes) && b.capes.length > 0 && b.capes.every(function (id) { return cart.indexOf(id) !== -1; });
    });
  }

  function saveCartBundles(list) {
    try {
        localStorage.setItem(CART_BUNDLES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function addBundleToCart(collectionId, capeIds) {
    const list = loadCart();
    const missing = capeIds.filter(function (id) { return list.indexOf(id) === -1; });
    if (cartItemCount(list) >= CART_MAX_ITEMS || list.length + missing.length > CART_MAX_CAPES) return false;
    const bundles = loadCartBundles().filter(function (b) {
        return b.id !== collectionId && !b.capes.some(function (id) { return capeIds.indexOf(id) !== -1; });
    });
    bundles.push({ id: collectionId, capes: capeIds.slice() });
    saveCartBundles(bundles);
    saveCart(list.concat(missing));
    return true;
  }

  function removeBundleFromCart(collectionId) {
    const bundle = loadCartBundles().find(function (b) { return b.id === collectionId; });
    saveCartBundles(loadCartBundles().filter(function (b) { return b.id !== collectionId; }));
    if (bundle) removeFromCart(bundle.capes);
  }

  function ensureCartButton() {
    if (document.getElementById('navCartBtn')) return;
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;
    const btn = document.createElement('a');
    btn.id = 'navCartBtn';
    btn.className = 'nav-cart-btn' + (document.body.dataset.page === 'cart' ? ' active' : '');
    btn.href = '/cart';
    btn.setAttribute('aria-label', 'Cart');
    btn.innerHTML = ICON_CART + '<span class="nav-cart-count" id="navCartCount" hidden></span>';
    actions.insertBefore(btn, actions.firstChild);
    bindCartPop(btn);
  }

  const ICON_POP_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  let cartPop = null;
  let cartPopTimer = 0;
  let cartPopCatalog = null;
  let cartPopCatalogPromise = null;
  let cartPopCollections = null;
  function bundlePicks(colId, capes, n) {
    let h = 2166136261;
    const seedText = String(colId);
    for (let k = 0; k < seedText.length; k++) {
      h ^= seedText.charCodeAt(k);
      h = Math.imul(h, 16777619);
    }
    const rand = function () {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
    const pool = capes.slice().sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    return pool.slice(0, n);
  }

  function popMoney(n) {
      return '€' + (Number(n) || 0).toFixed(2);
  }

  function cartPopLoadCatalog() {
    if (!cartPopCatalogPromise) {
      cartPopCatalogPromise = Promise.all([fetchJsonWithRetry(CAPES_JSON_URL, { cache: 'no-store' }, 1), loadCollections()])
        .then(function (res) {
          const list = res[0];
          cartPopCollections = res[1] || [];
          cartPopCatalog = Array.isArray(list) ? list : [];
          if (cartPop && cartPop.classList.contains('open')) renderCartPop();
        })
        .catch(function () {
          cartPopCatalogPromise = null;
        });
    }
    return cartPopCatalogPromise;
  }

  function cartPopRow(opts) {
    const row = document.createElement('div');
    row.className = 'cart-pop-row' + (opts.cls ? ' ' + opts.cls : '');
    const main = document.createElement(opts.href ? 'a' : 'div');
    main.className = 'cart-pop-main';
    if (opts.href) main.href = opts.href;
    main.appendChild(opts.thumb);
    const info = document.createElement('div');
    info.className = 'cart-pop-info';
    const name = document.createElement('div');
    name.className = 'cart-pop-name';
    name.textContent = opts.name;
    const price = document.createElement('div');
    price.className = 'cart-pop-price' + (opts.priceCls ? ' ' + opts.priceCls : '');
    price.textContent = opts.price;
    if (opts.oldPrice) {
      const old = document.createElement('s');
      old.textContent = opts.oldPrice;
      price.appendChild(document.createTextNode(' '));
      price.appendChild(old);
    }
    info.appendChild(name);
    info.appendChild(price);
    main.appendChild(info);
    row.appendChild(main);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cart-pop-remove';
    remove.setAttribute('aria-label', 'Remove ' + opts.name);
    remove.innerHTML = ICON_POP_X;
    remove.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      opts.onRemove();
    });
    row.appendChild(remove);
    return row;
  }

  function cartPopThumb(cape) {
    const el = document.createElement('div');
    el.className = 'cart-pop-thumb';
    el.style.backgroundImage = 'url("' + CAPES_BASE + String(cape.file).split('/').map(encodeURIComponent).join('/') + '")';
    return el;
  }

  function renderCartPop() {
    if (!cartPop) return;
    const body = cartPop.querySelector('.cart-pop-body');
    const foot = cartPop.querySelector('.cart-pop-foot');
    const count = cartPop.querySelector('.cart-pop-count');
    body.innerHTML = '';
    const liteKey = loadLitePlan();
    const lite = liteKey ? LITE_PLANS[liteKey] : null;
    const ids = loadCart();
    const n = cartItemCount(ids) + (lite ? 1 : 0);
    count.textContent = n ? String(n) : '';
    count.hidden = !n;
    foot.hidden = !n;
    if (!n) {
      const empty = document.createElement('div');
      empty.className = 'cart-pop-empty';
      const text = document.createElement('p');
      text.textContent = 'Your cart is empty.';
      const browse = document.createElement('a');
      browse.href = '/cloaks';
      browse.textContent = 'Browse cloaks';
      empty.appendChild(text);
      empty.appendChild(browse);
      body.appendChild(empty);
      return;
    }
    let total = 0;
    if (lite) {
      const tile = document.createElement('div');
      tile.className = 'cart-pop-thumb cart-pop-thumb--lite cart-pop-thumb--' + lite.key;
      tile.textContent = 'LITE';
      body.appendChild(cartPopRow({
        cls: 'cart-pop-row--lite',
        thumb: tile,
        href: '/lite',
        name: 'FrostClient Lite - ' + lite.name,
        price: popMoney(lite.price) + ' ' + lite.period,
        onRemove: function () { setLitePlan(null); }
      }));
      total += lite.dueNow;
    }
    if (!cartPopCatalog) {
      if (ids.length) {
        const loading = document.createElement('div');
        loading.className = 'cart-pop-loading';
        loading.textContent = 'Loading…';
        body.appendChild(loading);
      }
      cartPopLoadCatalog();
    } else {
      const grouped = {};
      loadCartBundles().forEach(function (b) {
        const col = (cartPopCollections || []).find(function (c) { return c.id === b.id; });
        if (!col) return;
        const capes = b.capes.map(function (id) { return cartPopCatalog.find(function (c) { return c && c.id === id; }); })
          .filter(function (c) { return c && !isOwned(c, profileCache); });
        if (!capes.length) return;
        b.capes.forEach(function (id) { grouped[id] = true; });
        const base = capes.reduce(function (t, c) { return t + (Number(c.store && c.store.price) || 0); }, 0);
        const memberSum = capes.reduce(function (t, c) {
          const m = memberPrice(c);
          return t + (m ? m.price : (Number(c.store && c.store.price) || 0));
        }, 0);
        const fullSum = col.capes.map(function (id) { return cartPopCatalog.find(function (c) { return c && c.id === id; }); })
          .filter(isCartable).reduce(function (t, c) { return t + Number(c.store.price); }, 0);
        const paidCount = col.capes.map(function (id) { return cartPopCatalog.find(function (c) { return c && c.id === id; }); }).filter(isCartable).length;
        const rate = capes.length >= 1 && paidCount >= 2 && collectionActive(col) ? bundleRate(col, fullSum) : 0;
        const price = Math.round(memberSum * (1 - rate) * 100) / 100;
        const tile = document.createElement('div');
        tile.className = 'cart-pop-thumb cart-pop-thumb--bundle';
        bundlePicks(col.id, capes, 3).forEach(function (c) {
            tile.appendChild(cartPopThumb(c));
        });
        const opts = {
          thumb: tile,
          href: 'collection?id=' + encodeURIComponent(col.id),
          name: col.name || col.id,
          price: popMoney(price),
          oldPrice: price < base ? popMoney(base) : '',
          priceCls: rate > 0 ? 'is-bundle' : '',
          onRemove: function () { removeBundleFromCart(col.id); }
        };
        if (lite) {
          opts.cls = 'cart-pop-row--saved';
          opts.price = 'Saved for later';
          opts.oldPrice = '';
          opts.priceCls = '';
        } else {
          total += price;
        }
        body.appendChild(cartPopRow(opts));
      });
      ids.forEach(function (id) {
        if (grouped[id]) return;
        const cape = cartPopCatalog.find(function (c) { return c && c.id === id; });
        if (!cape || isOwned(cape, profileCache)) return;
        const baseName = String(cape.name || cape.id);
        const name = /\b(cape|cloak)$/i.test(baseName) ? baseName : baseName + ' - Cloak';
        const base = Number(cape.store && cape.store.price) || 0;
        const member = memberPrice(cape);
        const opts = {
          thumb: cartPopThumb(cape),
          href: 'cloak?id=' + encodeURIComponent(cape.id),
          name: name,
          price: popMoney(member ? member.price : base),
          oldPrice: member ? popMoney(base) : '',
          priceCls: member ? 'is-member' : '',
          onRemove: function () { removeFromCart(id); }
        };
        if (lite) {
          opts.cls = 'cart-pop-row--saved';
          opts.price = 'Saved for later';
          opts.oldPrice = '';
          opts.priceCls = '';
        } else {
          total += member ? member.price : base;
        }
        body.appendChild(cartPopRow(opts));
      });
    }
    cartPop.querySelector('.cart-pop-total-label').textContent = lite ? 'Due today' : 'Subtotal';
    cartPop.querySelector('.cart-pop-total').textContent = popMoney(Math.round(total * 100) / 100);
  }

  function ensureCartPop() {
    if (cartPop) return cartPop;
    cartPop = document.createElement('div');
    cartPop.className = 'cart-pop';
    cartPop.setAttribute('role', 'dialog');
    cartPop.setAttribute('aria-label', 'Cart preview');
    cartPop.innerHTML =
      '<div class="cart-pop-head"><span>Your cart</span><span class="cart-pop-count" hidden></span></div>' +
      '<div class="cart-pop-body"></div>' +
      '<div class="cart-pop-foot" hidden>' +
        '<div class="cart-pop-total-row"><span class="cart-pop-total-label">Subtotal</span><span class="cart-pop-total"></span></div>' +
        '<a class="cart-pop-cta" href="/cart">View cart</a>' +
      '</div>';
    cartPop.addEventListener('mouseenter', openCartPop);
    cartPop.addEventListener('mouseleave', scheduleCloseCartPop);
    cartPop.addEventListener('focusout', function (e) {
      if (!cartPop.contains(e.relatedTarget)) scheduleCloseCartPop();
    });
    document.body.appendChild(cartPop);
    cartListeners.push(function () {
      if (cartPop.classList.contains('open')) renderCartPop();
    });
    profileListeners.push(function () {
      if (cartPop.classList.contains('open')) renderCartPop();
    });
    return cartPop;
  }

  function positionCartPop() {
    const btn = document.getElementById('navCartBtn');
    if (!cartPop || !btn) return;
    const r = btn.getBoundingClientRect();
    cartPop.style.top = Math.round(r.bottom + 10) + 'px';
    cartPop.style.right = Math.max(8, Math.round(window.innerWidth - r.right - 12)) + 'px';
  }

  function openCartPop() {
    clearTimeout(cartPopTimer);
    const pop = ensureCartPop();
    if (pop.classList.contains('open')) return;
    closeNavMenu();
    renderCartPop();
    positionCartPop();
    pop.classList.add('open');
  }

  function scheduleCloseCartPop() {
    clearTimeout(cartPopTimer);
    cartPopTimer = setTimeout(function () {
      if (cartPop) cartPop.classList.remove('open');
    }, 180);
  }

  function bindCartPop(btn) {
    if (document.body.dataset.page === 'cart') return;
    let canHover = true;
    try {
        canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (e) {}
    if (!canHover) return;
    btn.addEventListener('mouseenter', function () {
      cartPopLoadCatalog();
      openCartPop();
    });
    btn.addEventListener('mouseleave', scheduleCloseCartPop);
    btn.addEventListener('focus', openCartPop);
    btn.addEventListener('blur', function (e) {
      if (!cartPop || !cartPop.contains(e.relatedTarget)) scheduleCloseCartPop();
    });
    window.addEventListener('resize', function () {
      if (cartPop && cartPop.classList.contains('open')) positionCartPop();
    });
    window.addEventListener('scroll', function () {
      if (cartPop && cartPop.classList.contains('open')) positionCartPop();
    }, { passive: true });
  }

  function updateCartBadge() {
    ensureCartButton();
    const count = document.getElementById('navCartCount');
    if (!count) return;
    const n = cartItemCount() + (loadLitePlan() ? 1 : 0);
    count.textContent = String(n);
    count.hidden = n === 0;
    const btn = document.getElementById('navCartBtn');
    if (btn) btn.setAttribute('aria-label', n ? 'Cart, ' + n + ' item' + (n === 1 ? '' : 's') : 'Cart');
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== CART_KEY && e.key !== CART_LITE_KEY) return;
    updateCartBadge();
    const list = loadCart();
    cartListeners.forEach(function (fn) {
      try {
          fn(list);
      } catch (err) {}
    });
  });

  function classify(r, g, b) {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (l < 0.13) return 'black';
    if (s < 0.18) return l > 0.82 ? 'white' : (l < 0.25 ? 'black' : 'gray');
    let h;
    const rn = r / 255, gn = g / 255, bn = b / 255;
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h < 15 || h >= 345) return 'red';
    if (h < 42) return l < 0.38 ? 'brown' : 'orange';
    if (h < 68) return l < 0.3 ? 'brown' : 'yellow';
    if (h < 165) return 'green';
    if (h < 255) return 'blue';
    if (h < 290) return 'purple';
    return 'pink';
  }

  function analyzeCapeColors(cape) {
    const override = cape.store && Array.isArray(cape.store.colors) ? cape.store.colors.map(String) : null;
    if (override && override.length) return Promise.resolve(override);
    const url = CAPES_BASE + String(cape.file).split('/').map(encodeURIComponent).join('/');
    return fetch(url, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.blob();
      })
      .then(function (blob) {
          return createImageBitmap(blob);
      })
      .then(function (bmp) {
        const w = bmp.width;
        const h = bmp.height;
        const x0 = Math.round(w / 64);
        const y0 = Math.round(h / 32);
        const fw = Math.max(1, Math.round(w * 10 / 64));
        const fh = Math.max(1, Math.round(h * 16 / 32));
        const canvas = document.createElement('canvas');
        canvas.width = fw;
        canvas.height = fh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bmp, x0, y0, fw, fh, 0, 0, fw, fh);
        const data = ctx.getImageData(0, 0, fw, fh).data;
        const counts = {};
        let total = 0;
        const step = Math.max(1, Math.floor((fw * fh) / 4000));
        for (let i = 0; i < data.length; i += 4 * step) {
          if (data[i + 3] < 128) continue;
          const c = classify(data[i], data[i + 1], data[i + 2]);
          counts[c] = (counts[c] || 0) + 1;
          total++;
        }
        if (!total) return [];
        const ranked = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
        return ranked.filter(function (c, i) { return i === 0 || counts[c] / total >= 0.2; }).slice(0, 3);
      })
      .catch(function () {
          return [];
      });
  }

  const capeColorMemo = {};
  function capeColors(cape) {
    if (!cape || !cape.file) return Promise.resolve([]);
    if (cape.store && Array.isArray(cape.store.colors) && cape.store.colors.length) return Promise.resolve(cape.store.colors.map(String));
    const key = cape.id + '|' + cape.file;
    if (capeColorMemo[key]) return capeColorMemo[key];
    let cached = null;
    try {
        cached = (JSON.parse(sessionStorage.getItem('frostStoreCapeColors.v1') || '{}') || {})[key] || null;
    } catch (e) {
        cached = null;
    }
    capeColorMemo[key] = cached ? Promise.resolve(cached) : analyzeCapeColors(cape).then(function (list) {
      try {
        const all = JSON.parse(sessionStorage.getItem('frostStoreCapeColors.v1') || '{}') || {};
        all[key] = list;
        sessionStorage.setItem('frostStoreCapeColors.v1', JSON.stringify(all));
      } catch (e) {}
      return list;
    });
    return capeColorMemo[key];
  }

  const BOT_API_URL = 'https://bot.frostclient.eu';

  function botPost(path, body) {
    return fetch(BOT_API_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ token: loadToken() }, body || {})),
      cache: 'no-store'
    }).then(function (r) {
        return r.json();
    });
  }

  window.FrostStore = {
    botPost: botPost,
    capeColors: capeColors,
    memberPrice: memberPrice,
    getCart: loadCart,
    getLitePlan: loadLitePlan,
    setLitePlan: setLitePlan,
    litePlans: LITE_PLANS,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    getCartBundles: loadCartBundles,
    bundlePicks: bundlePicks,
    addBundleToCart: addBundleToCart,
    removeBundleFromCart: removeBundleFromCart,
    inCart: function (id) {
        return loadCart().indexOf(id) !== -1;
    },
    onCart: function (fn) {
        cartListeners.push(fn);
    },
    cartMax: CART_MAX_ITEMS,
    showToast: function (message) {
        showStoreToast(message);
    },
    apiUrl: STORE_API_URL,
    capesJsonUrl: CAPES_JSON_URL,
    capesBase: CAPES_BASE,
    loadToken: loadToken,
    clearAuth: clearAuth,
    startLogin: startLogin,
    consumeOauthReturn: consumeOauthReturn,
    exchangeCode: exchangeCode,
    refreshProfile: refreshProfile,
    getProfile: function () {
        return profileCache;
    },
    isAuthSettled: function () {
        return authSettled;
    },
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
    buildCapeCard: buildCapeCard,
    limitedInfo: limitedInfo,
    isPartnerCape: isPartnerCape,
    releaseTime: releaseTime,
    isCartable: isCartable,
    isStoreHidden: isStoreHidden,
    loadCollections: loadCollections,
    collectionActive: collectionActive,
    collectionEnds: collectionEnds,
    collectionBannerUrl: collectionBannerUrl,
    bundleLabel: bundleLabel,
    bundleRate: bundleRate,
    buildCollectionCard: buildCollectionCard,
    collectionCapes: collectionCapes,
    buildCollectionShowcase: buildCollectionShowcase
  };

  function isStoreHidden(cape) {
    return !!(cape && cape.store && cape.store.hidden === true);
  }

  let collectionsPromise = null;
  function loadCollections() {
    if (!collectionsPromise) {
      collectionsPromise = fetchJsonWithRetry(COLLECTIONS_JSON_URL, { cache: 'no-store' }, 2)
        .then(function (data) { return Array.isArray(data) ? data : []; })
        .catch(function () { return []; });
    }
    return collectionsPromise;
  }

  function collectionActive(col) {
    if (!col || !col.id || col.hidden === true || !Array.isArray(col.capes) || !col.capes.length) return false;
    const now = Date.now();
    if (col.limitedUntil && !(new Date(col.limitedUntil).getTime() > now)) return false;
    if (col.releaseDate && new Date(col.releaseDate).getTime() > now) return false;
    return true;
  }

  function collectionEnds(col) {
    if (!col || !col.limitedUntil) return null;
    const until = new Date(col.limitedUntil).getTime();
    if (!isFinite(until) || until <= Date.now()) return null;
    const days = Math.ceil((until - Date.now()) / 86400000);
    let text;
    if (days <= 1) {
      const hours = Math.max(1, Math.ceil((until - Date.now()) / 3600000));
      text = 'Ends in ' + hours + (hours === 1 ? ' hour' : ' hours');
    } else if (days <= 14) {
      text = 'Ends in ' + days + ' days';
    } else {
      text = 'Until ' + new Date(until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return { until: until, text: text };
  }

  function bundleRate(col, fullSum) {
    const fixed = Number(col && col.bundlePrice);
    if (isFinite(fixed) && fixed > 0) return fullSum > fixed ? (fullSum - fixed) / fullSum : 0;
    return Math.max(0, Math.min(90, Math.round(Number(col && col.bundleDiscount) || 0))) / 100;
  }

  function bundleLabel(col) {
    if (col && Number(col.bundlePrice) > 0) return 'Bundle €' + Number(col.bundlePrice).toFixed(2);
    if (col && Number(col.bundleDiscount) > 0) return 'Bundle −' + Math.round(Number(col.bundleDiscount)) + '%';
    return '';
  }

  function collectionBannerUrl(col) {
    return col && col.banner ? CAPES_BASE + String(col.banner).split('/').map(encodeURIComponent).join('/') : null;
  }

  function collectionCapes(col, catalog) {
    return (col.capes || []).map(function (id) { return (catalog || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
  }

  function buildCollectionShowcase(capes) {
    const row = document.createElement('div');
    row.className = 'collection-card-showcase';
    capes.slice(0, 6).forEach(function (c) {
      const t = document.createElement('span');
      t.className = 'collection-showcase-cape';
      if (c.mature !== true) t.style.backgroundImage = 'url("' + CAPES_BASE + String(c.file).split('/').map(encodeURIComponent).join('/') + '")';
      row.appendChild(t);
    });
    return row;
  }

  function buildCollectionCard(col, catalog, profile) {
    const card = document.createElement('a');
    card.className = 'collection-card';
    card.href = 'collection?id=' + encodeURIComponent(col.id);
    const capes = collectionCapes(col, catalog);
    const banner = document.createElement('div');
    banner.className = 'collection-card-banner';
    const showcase = function () {
      card.classList.add('collection-card--no-banner');
      banner.insertBefore(buildCollectionShowcase(capes), banner.firstChild);
    };
    const url = collectionBannerUrl(col);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        img.remove();
        showcase();
      });
      banner.appendChild(img);
    } else {
      showcase();
    }
    const ends = collectionEnds(col);
    if (ends) {
      const lim = document.createElement('span');
      lim.className = 'collection-limited';
      lim.textContent = 'Limited · ' + ends.text;
      banner.appendChild(lim);
    }
    card.appendChild(banner);
    const body = document.createElement('div');
    body.className = 'collection-card-body';
    const text = document.createElement('div');
    text.className = 'collection-card-text';
    const name = document.createElement('div');
    name.className = 'collection-card-name';
    name.textContent = col.name || col.id;
    text.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'collection-card-meta';
    const paid = capes.filter(isCartable);
    const left = paid.filter(function (c) { return !isOwned(c, profile); });
    const ownedPaid = paid.length - left.length;
    if (profile && capes.length && capes.every(function (c) { return isOwned(c, profile); })) {
      meta.textContent = capes.length + (capes.length === 1 ? ' cloak' : ' cloaks') + ' · ';
      const owned = document.createElement('span');
      owned.className = 'collection-card-owned';
      owned.textContent = 'Owned';
      meta.appendChild(owned);
    } else if (profile && ownedPaid > 0 && left.length > 0) {
      const fullSum = paid.reduce(function (t, c) { return t + Number(c.store.price); }, 0);
      const leftSum = left.reduce(function (t, c) { return t + Number(c.store.price); }, 0);
      const rate = paid.length >= 2 ? bundleRate(col, fullSum) : 0;
      const price = Math.round((leftSum - Math.round(leftSum * rate * 100) / 100) * 100) / 100;
      meta.textContent = 'You own ' + ownedPaid + ' of ' + paid.length + ' · complete for €' + price.toFixed(2);
    } else {
      meta.textContent = capes.length + (capes.length === 1 ? ' cloak' : ' cloaks') + (bundleLabel(col) ? ' · ' + bundleLabel(col) : '');
    }
    text.appendChild(meta);
    body.appendChild(text);
    const thumbs = document.createElement('div');
    thumbs.className = 'collection-card-thumbs';
    capes.slice(0, 5).forEach(function (c) {
      const t = document.createElement('span');
      t.className = 'collection-thumb';
      if (c.mature !== true) t.style.backgroundImage = 'url("' + CAPES_BASE + String(c.file).split('/').map(encodeURIComponent).join('/') + '")';
      thumbs.appendChild(t);
    });
    body.appendChild(thumbs);
    card.appendChild(body);
    return card;
  }

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
    if (store.subscription) return { text: store.subscription === 'annual' ? 'Annual Lite' : 'Lite', cls: store.subscription === 'annual' ? 'pill-annual' : 'pill-lite' };
    if (store.price === 0 || store.price === 'free') return { text: 'Free', cls: 'pill-free' };
    if (typeof store.price === 'number') {
      const sale = salePrice(cape);
      return { text: '€' + store.price.toFixed(2), cls: store.checkout ? (sale ? 'pill-sale' : '') : 'pill-soon', original: sale && store.checkout ? '€' + sale.original.toFixed(2) : null, percent: sale ? sale.percent : 0 };
    }
    return { text: 'Coming soon', cls: 'pill-soon' };
  }

  function limitedInfo(cape) {
    const store = (cape && cape.store) || {};
    if (!store.limitedUntil) return null;
    const until = new Date(store.limitedUntil).getTime();
    if (!isFinite(until)) return null;
    return { until: until, active: until > Date.now(), free: store.price === 0 || store.price === 'free' };
  }

  function isPartnerCape(cape) {
    const v = cape && cape.partner;
    return v === true || (typeof v === 'string' && v.trim() !== '') || (typeof v === 'number' && v > 0);
  }

  function releaseTime(cape) {
    const store = (cape && cape.store) || {};
    const t = store.releaseDate ? new Date(store.releaseDate).getTime() : NaN;
    return isFinite(t) ? t : null;
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
      .then(function (blob) {
          return URL.createObjectURL(blob);
      });
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
    job.catch(function () {
        delete previewCache[key];
    });
    return job;
  }

  const CSS_CAPE_FACES = [
    ['front', 1, 1, 10, 16],
    ['back', 12, 1, 10, 16],
    ['left', 0, 1, 1, 16],
    ['right', 11, 1, 1, 16],
    ['top', 1, 0, 10, 1],
    ['bottom', 11, 0, 10, 1]
  ];
  let animatedObserver = null;

  function observeAnimatedCape(el, url) {
    const start = function () {
      el.querySelectorAll('.cape-3d-face img').forEach(function (img) {
          img.src = url;
      });
    };
    if (typeof IntersectionObserver === 'undefined') return start();
    if (!animatedObserver) {
      animatedObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animatedObserver.unobserve(entry.target);
          if (entry.target._startAnimation) entry.target._startAnimation();
        });
      }, { rootMargin: '200px' });
    }
    el._startAnimation = start;
    animatedObserver.observe(el);
  }

  function buildAnimatedCapePreview(cape) {
    const previewWrap = document.createElement('div');
    previewWrap.className = 'cape-card-preview-wrap';
    const stage = document.createElement('div');
    stage.className = 'cape-3d';
    const body = document.createElement('div');
    body.className = 'cape-3d-body';
    CSS_CAPE_FACES.forEach(function (f) {
      const face = document.createElement('div');
      face.className = 'cape-3d-face cape-3d-' + f[0];
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.style.left = 'calc(var(--u) * ' + (-f[1]) + ')';
      img.style.top = 'calc(var(--u) * ' + (-f[2]) + ')';
      face.appendChild(img);
      body.appendChild(face);
    });
    stage.appendChild(body);
    previewWrap.appendChild(stage);
    observeAnimatedCape(previewWrap, CAPES_BASE + String(cape.animated).split('/').map(encodeURIComponent).join('/'));
    return previewWrap;
  }

  function buildCapePreview(cape) {
    if (cape.animated) return buildAnimatedCapePreview(cape);
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
      img.addEventListener('load', function () {
          img.classList.add('ready');
      });
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
    card.href = 'cloak?id=' + encodeURIComponent(cape.id);
    card.appendChild(buildCapePreview(cape));
    const name = document.createElement('div');
    name.className = 'cape-card-name';
    name.textContent = cape.name || cape.id;
    card.appendChild(name);
    const tags = document.createElement('div');
    tags.className = 'cape-card-tags';
    const addTag = function (text, cls) {
      const tag = document.createElement('span');
      tag.className = 'cape-card-tag ' + cls;
      tag.textContent = text;
      tags.appendChild(tag);
    };
    const owned = isOwned(cape, profile);
    const limited = limitedInfo(cape);
    if (limited && limited.active) addTag('Limited', 'tag-limited');
    if (isPartnerCape(cape)) addTag('Partner', 'tag-partner');
    if (cape.animated) addTag('Animated', 'tag-animated');
    else addTag('Static', 'tag-static');
    card.appendChild(tags);
    const pill = owned ? { text: 'Owned', cls: 'pill-owned' } : pricePill(cape);
    const member = owned ? null : memberPrice(cape, profile);
    if (member) {
      pill.original = pill.original || ('€' + Number(cape.store.price).toFixed(2));
      pill.text = '€' + member.price.toFixed(2);
      pill.cls = (pill.cls ? pill.cls + ' ' : '') + 'pill-member';
      pill.percent = pill.percent || 0;
    }
    const pillEl = document.createElement('span');
    pillEl.className = 'cape-price-pill' + (pill.cls ? ' ' + pill.cls : '');
    if (pill.original) {
      const old = document.createElement('s');
      old.className = 'cape-price-old';
      old.textContent = pill.original;
      pillEl.appendChild(old);
      pillEl.appendChild(document.createTextNode(pill.text));
      if (pill.percent) {
        const sale = document.createElement('span');
        sale.className = 'cape-sale-badge';
        sale.textContent = '-' + pill.percent + '%';
        card.appendChild(sale);
      }
    } else {
      pillEl.textContent = pill.text;
    }
    card.appendChild(pillEl);
    if (!owned && isCartable(cape)) card.appendChild(buildQuickAdd(cape));
    return card;
  }

  function isCartable(cape) {
    const store = cape && cape.store;
    if (!store || store.subscription || !store.checkout) return false;
    const price = Number(store.price);
    if (!isFinite(price) || price <= 0) return false;
    const limited = limitedInfo(cape);
    return !(limited && !limited.active);
  }

  const ICON_CART_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';
  const ICON_CART_CHECK = '<svg class="qa-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><svg class="qa-remove" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function buildQuickAdd(cape) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cape-quick-add';
    const paint = function () {
      const added = loadCart().indexOf(cape.id) !== -1;
      btn.classList.toggle('is-added', added);
      btn.innerHTML = added ? ICON_CART_CHECK : ICON_CART_PLUS;
      const label = added ? 'Remove ' + (cape.name || cape.id) + ' from cart' : 'Add ' + (cape.name || cape.id) + ' to cart';
      btn.setAttribute('aria-label', label);
      btn.title = added ? 'Remove from cart' : 'Add to cart';
    };
    paint();
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (loadCart().indexOf(cape.id) !== -1) {
        removeFromCart(cape.id);
        paint();
        return;
      }
      if (!addToCart(cape.id)) {
        showStoreToast('Your cart is full (' + CART_MAX_ITEMS + ' items). Check out first.');
        return;
      }
      if (loadLitePlan()) showStoreToast('Added to Saved for later. Cloaks are checked out separately from FrostClient Lite.');
      paint();
      btn.classList.add('hold');
      btn.classList.add('just-added');
      setTimeout(function () {
          btn.classList.remove('just-added');
      }, 600);
    });
    btn.addEventListener('mouseleave', function () {
        btn.classList.remove('hold');
    });
    cartListeners.push(paint);
    return btn;
  }

  function bindAuthButtons() {
    const signinBtn = document.getElementById('navSigninBtn');
    if (signinBtn) signinBtn.addEventListener('click', function () {
        startLogin('store');
    });
    const footerBtn = document.getElementById('footerSigninBtn');
    if (footerBtn) footerBtn.addEventListener('click', function () {
      if (loadToken()) clearAuth();
      else startLogin('store');
    });
    const userBtn = document.getElementById('navUserBtn');
    if (userBtn) userBtn.addEventListener('click', toggleNavMenu);
    const avatar = document.getElementById('navUserAvatar');
    if (avatar) avatar.addEventListener('error', function () {
        avatar.style.display = 'none';
    });
  }

  if (loadToken()) {
    const cachedProfile = loadCachedProfile();
    if (cachedProfile) {
      profileCache = {
        user: cachedProfile.user || loadCachedUser(),
        liteActive: !!cachedProfile.liteActive,
        litePlan: cachedProfile.litePlan || null,
        liteDiscountPercent: Number(cachedProfile.liteDiscountPercent) || 0,
        giftExpiresAt: cachedProfile.giftExpiresAt || null,
        owned: Array.isArray(cachedProfile.owned) ? cachedProfile.owned : [],
        token: loadToken()
      };
    }
  }

  function memberPrice(cape, profile) {
    const p = profile === undefined ? profileCache : profile;
    const pct = p && p.liteDiscountPercent ? p.liteDiscountPercent : 0;
    const base = Number(cape && cape.store && cape.store.price);
    if (!pct || !isFinite(base) || base <= 0 || !(cape.store && cape.store.checkout) || cape.store.subscription) return null;
    return { price: Math.round(base * (1 - pct / 100) * 100) / 100, percent: pct };
  }

  function init() {
    bindAuthButtons();
    updateCartBadge();
    updateNav();
    profileListeners.push(updateNav);
    const oauthReturn = document.body.dataset.storeAuthPage === 'ty' ? null : consumeOauthReturn();
    if (oauthReturn) setAuthPending(true);
    let signInOk = false;
    const authFlow = oauthReturn
      ? exchangeCode(oauthReturn.code, 'store').then(function (data) {
          if (!data || !data.ok) {
            console.error('Store sign-in failed:', data);
            showStoreToast('Sign-in failed' + (data && data.error ? ' (' + data.error + ')' : '') + '. Please try again.');
          } else {
            signInOk = true;
          }
          return profileCache;
        }).catch(function () {
          showStoreToast('Network error during sign-in. Please try again.');
          return null;
        })
      : refreshProfile();
    const giftReturn = oauthReturn ? /\.g\.([a-z0-9]{4,32})$/.exec(oauthReturn.state || '') : null;
    const capeReturn = oauthReturn ? /\.c\.([a-z0-9_-]{1,64})$/.exec(oauthReturn.state || '') : null;
    const cartReturn = oauthReturn ? /\.k$/.test(oauthReturn.state || '') : false;
    authFlow.then(function () {
      if (signInOk && giftReturn) {
        window.location.replace('/gift?c=' + encodeURIComponent(giftReturn[1]));
        return;
      }
      if (signInOk && capeReturn) {
        window.location.replace('/cloak?id=' + encodeURIComponent(capeReturn[1]));
        return;
      }
      if (signInOk && cartReturn) {
        window.location.replace('/cart');
        return;
      }
      authSettled = true;
      setAuthPending(false);
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
  const grid = document.getElementById('homeCapeGrid');
  if (!grid) return;
  const Store = window.FrostStore;
  const HOME_CAPES = 12;
  let catalog = null;
  function render() {
    if (!catalog) return;
    const profile = Store.getProfile();
    const list = catalog.filter(function (cape) {
      if (!cape.store || cape.store.subscription || cape.mature === true || Store.isStoreHidden(cape)) return false;
      if (Store.isOwned(cape, profile)) return false;
      const limited = Store.limitedInfo(cape);
      return !(limited && !limited.active);
    }).sort(function (a, b) {
      const ta = Store.releaseTime(a);
      const tb = Store.releaseTime(b);
      if (ta === null && tb !== null) return 1;
      if (tb === null && ta !== null) return -1;
      if (ta !== tb) return tb - ta;
      return catalog.indexOf(b) - catalog.indexOf(a);
    }).slice(0, HOME_CAPES);
    grid.innerHTML = '';
    list.forEach(function (cape) {
        grid.appendChild(Store.buildCapeCard(cape, profile));
    });
  }
  Store.onProfile(render);
  Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
    .then(function (data) {
      catalog = Array.isArray(data) ? data : [];
      render();
    })
    .catch(function () {
      grid.innerHTML = '<div class="store-error">Couldn\'t load cloaks. Please try again later.</div>';
    });
})();

(function () {
  const section = document.getElementById('homeCollection');
  if (!section) return;
  const Store = window.FrostStore;
  const SLIDE_MS = 7000;
  const MOVE_MS = 1100;
  const LITE_ITEM = {
    lite: true,
    href: '/lite',
    name: 'FrostClient Lite',
    deal: 'Up to 10% off the store',
    cta: 'Learn more →'
  };
  const track = section.querySelector('.featured-track');
  const viewport = section.querySelector('.featured-viewport');
  const line = section.querySelector('.featured-line-fill');
  const lineWrap = section.querySelector('.featured-line');
  const dotsWrap = section.querySelector('.featured-dots');
  const prevBtn = section.querySelector('.featured-arrow--prev');
  const nextBtn = section.querySelector('.featured-arrow--next');
  const panel = section.querySelector('.featured-panel');
  const panelInfo = panel.querySelector('.featured-panel-info');
  const panelName = panel.querySelector('.home-collection-name');
  const panelDeal = panel.querySelector('.home-collection-deal');
  const panelCta = panel.querySelector('.home-collection-cta');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let collections = null;
  let catalog = [];
  let built = false;
  let items = [];
  let slides = [];
  let dots = [];
  let index = 0;
  let elapsed = 0;
  let last = null;
  let paused = false;
  let moving = false;
  let queued = null;
  let fadeTimer = null;
  let running = false;

  function itemFromCollection(col) {
    return {
      href: 'collection?id=' + encodeURIComponent(col.id),
      name: col.name || col.id,
      deal: Store.bundleLabel(col),
      cta: 'View collection →',
      col: col
    };
  }

  function buildLiteBanner() {
    const banner = document.createElement('div');
    banner.className = 'featured-banner featured-banner--lite';
    const rain = document.createElement('span');
    rain.className = 'featured-lite-rain';
    rain.setAttribute('aria-hidden', 'true');
    const BOLT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
    for (let n = 0; n < 18; n++) {
      const bolt = document.createElement('span');
      bolt.className = 'featured-lite-bolt';
      const size = 12 + Math.round(Math.random() * 16);
      bolt.style.left = (2 + Math.random() * 96).toFixed(1) + '%';
      bolt.style.width = size + 'px';
      bolt.style.height = size + 'px';
      bolt.style.opacity = (0.08 + Math.random() * 0.12).toFixed(2);
      bolt.style.animationDuration = (5 + Math.random() * 5).toFixed(2) + 's';
      bolt.style.animationDelay = (-Math.random() * 10).toFixed(2) + 's';
      bolt.style.setProperty('--tilt', (Math.random() * 30 - 15).toFixed(0) + 'deg');
      bolt.innerHTML = BOLT;
      rain.appendChild(bolt);
    }
    banner.innerHTML = '<span class="featured-lite-glow" aria-hidden="true"></span>'
      + '<span class="featured-lite-text"><span class="featured-lite-eyebrow">FrostClient Lite</span>'
      + '<span class="featured-lite-title">More FPS. Exclusive perks.</span>'
      + '<span class="featured-lite-desc">Up to +400 FPS over regular Frost, exclusive Lite cloaks, priority support and up to 10% off everything in the store.</span></span>';
    banner.insertBefore(rain, banner.firstChild);
    return banner;
  }

  function buildCollectionBanner(col) {
    const banner = document.createElement('div');
    banner.className = 'featured-banner';
    const fallback = function () {
      const capes = Store.collectionCapes(col, catalog);
      if (capes.length) {
        banner.classList.add('has-showcase');
        banner.insertBefore(Store.buildCollectionShowcase(capes), banner.firstChild);
        return;
      }
      banner.classList.add('is-empty');
      const title = document.createElement('span');
      title.className = 'featured-fallback-title';
      title.textContent = col.name || col.id;
      banner.appendChild(title);
    };
    const url = Store.collectionBannerUrl(col);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.addEventListener('error', function () {
        img.remove();
        fallback();
      });
      banner.appendChild(img);
    } else {
      fallback();
    }
    const ends = Store.collectionEnds(col);
    if (ends) {
      const lim = document.createElement('span');
      lim.className = 'collection-limited collection-limited--lg';
      lim.textContent = 'Limited · ' + ends.text;
      lim.title = 'Available until ' + new Date(ends.until).toLocaleString();
      banner.appendChild(lim);
    }
    return banner;
  }

  function fillPanel(item) {
    panel.href = item.href;
    panel.classList.toggle('is-lite', !!item.lite);
    panel.setAttribute('aria-label', item.lite ? 'Learn more about FrostClient Lite' : 'View the ' + item.name + ' collection');
    panelName.textContent = item.name;
    panelDeal.textContent = item.deal || '';
    panelDeal.hidden = !item.deal;
    panelCta.textContent = item.cta;
  }

  function showPanel(item) {
    clearTimeout(fadeTimer);
    panelInfo.classList.add('is-fading');
    panelCta.classList.add('is-fading');
    fadeTimer = setTimeout(function () {
      fillPanel(item);
      panelInfo.classList.remove('is-fading');
      panelCta.classList.remove('is-fading');
    }, 260);
  }

  function paint() {
    slides.forEach(function (slide, i) {
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      slide.tabIndex = i === index ? 0 : -1;
    });
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    line.style.transform = 'scaleX(0)';
  }

  function go(i) {
    if (slides.length < 2) return;
    const target = (i + slides.length) % slides.length;
    if (moving) {
      queued = target;
      return;
    }
    if (target === index) return;
    const from = slides[index];
    const to = slides[target];
    index = target;
    elapsed = 0;
    paint();
    showPanel(items[target]);
    if (reduceMotion) {
      track.insertBefore(to, track.firstChild);
      return;
    }
    moving = true;
    track.insertBefore(to, from.nextSibling);
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    void track.offsetWidth;
    track.style.transition = 'transform ' + MOVE_MS + 'ms cubic-bezier(0.65, 0, 0.35, 1)';
    track.style.transform = 'translateX(-100%)';
    setTimeout(function () {
      track.style.transition = 'none';
      track.appendChild(from);
      track.style.transform = 'translateX(0)';
      void track.offsetWidth;
      track.style.transition = '';
      moving = false;
      if (queued !== null) {
        const next = queued;
        queued = null;
        go(next);
      }
    }, MOVE_MS + 30);
  }

  function frame(now) {
    if (last === null) last = now;
    const dt = now - last;
    last = now;
    if (slides.length > 1 && !paused && !moving && !document.hidden) {
      elapsed += dt;
      line.style.transform = 'scaleX(' + Math.min(1, elapsed / SLIDE_MS) + ')';
      if (elapsed >= SLIDE_MS) go(index + 1);
    }
    requestAnimationFrame(frame);
  }

  function build() {
    if (!collections) return;
    if (built) return;
    built = true;
    items = [LITE_ITEM].concat(collections.map(itemFromCollection));
    track.innerHTML = '';
    dotsWrap.innerHTML = '';
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    index = 0;
    elapsed = 0;
    queued = null;
    moving = false;
    slides = items.map(function (item) {
      const slide = document.createElement('a');
      slide.className = 'featured-slide';
      slide.href = item.href;
      slide.setAttribute('aria-label', item.lite ? 'FrostClient Lite' : item.name + ' collection');
      slide.appendChild(item.lite ? buildLiteBanner() : buildCollectionBanner(item.col));
      track.appendChild(slide);
      return slide;
    });
    dots = slides.length > 1 ? items.map(function (item, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'featured-dot';
      btn.setAttribute('aria-label', 'Show ' + item.name);
      btn.addEventListener('click', function () {
          go(i);
      });
      dotsWrap.appendChild(btn);
      return btn;
    }) : [];
    dotsWrap.hidden = slides.length < 2;
    if (prevBtn) prevBtn.hidden = slides.length < 2;
    if (nextBtn) nextBtn.hidden = slides.length < 2;
    lineWrap.hidden = slides.length < 2;
    section.hidden = !slides.length;
    if (!slides.length) return;
    fillPanel(items[0]);
    paint();
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });
  viewport.addEventListener('mouseenter', function () { paused = true; });
  viewport.addEventListener('mouseleave', function () { paused = false; });
  section.addEventListener('focusin', function () { paused = true; });
  section.addEventListener('focusout', function () { paused = false; });
  let touchX = null;
  viewport.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  });

  Promise.all([
    Store.loadCollections(),
    Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2).catch(function () { return []; })
  ]).then(function (res) {
    const list = res[0];
    catalog = Array.isArray(res[1]) ? res[1] : [];
    collections = list.filter(function (col) { return Store.collectionActive(col) && col.featured === true; }).sort(function (a, b) {
      const la = a.limitedUntil ? new Date(a.limitedUntil).getTime() : 0;
      const lb = b.limitedUntil ? new Date(b.limitedUntil).getTime() : 0;
      if (!!la !== !!lb) return la ? -1 : 1;
      if (la && lb && la !== lb) return la - lb;
      const ta = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const tb = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return tb - ta || list.indexOf(b) - list.indexOf(a);
    });
    build();
  });
  Store.onProfile(build);
})();

(function () {
  const cards = document.querySelectorAll('.js-lite-plan');
  if (!cards.length) return;
  const Store = window.FrostStore;
  const CANCEL_URL = 'https://frostclient.eu/lite/cancel';
  function giftDate(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function render(profile) {
    const active = !!(profile && profile.liteActive);
    const plan = active ? (profile.litePlan || 'monthly') : null;
    const purchased = plan === 'monthly' || plan === 'annual';
    cards.forEach(function (card) {
      const cardPlan = card.dataset.plan;
      const mine = purchased && plan === cardPlan;
      const gifted = (plan === 'gifted' || plan === 'boost') && cardPlan === 'monthly';
      card.classList.toggle('is-current', mine);
      card.classList.toggle('is-gifted', gifted);
      const cta = card.querySelector('.js-lite-cta');
      const badge = card.querySelector('.js-lite-current');
      if (badge) {
        badge.hidden = !(mine || gifted);
        badge.textContent = gifted ? (plan === 'boost' ? 'Boost' : 'Gifted') : 'Your plan';
        badge.classList.toggle('lite-plan-current--gifted', gifted);
      }
      if (!cta) return;
      if (mine) {
        cta.textContent = 'Manage subscription';
        cta.href = CANCEL_URL;
      } else if (purchased) {
        cta.textContent = cardPlan === 'annual' ? 'Switch to annual' : 'Switch to monthly';
        cta.href = cta.dataset.checkout;
      } else {
        cta.textContent = cta.dataset.label;
        cta.href = '/cart';
      }
    });
    document.querySelectorAll('.js-lite-status').forEach(function (el) {
      el.hidden = !active;
      const text = el.querySelector('.js-lite-status-text');
      if (!text || !active) return;
      if (plan === 'gifted') {
        const until = profile.giftExpiresAt ? giftDate(profile.giftExpiresAt) : '';
        text.textContent = 'You have FrostClient Lite as a gift' + (until ? ' until ' + until : '') + '. Subscribe below to keep it after the gift ends.';
      } else if (plan === 'boost') {
        text.textContent = 'You have FrostClient Lite for boosting our Discord server. It stays active while you keep boosting.';
      } else {
        text.textContent = 'Your Lite subscription is active. Sign in to the Frost Launcher with this Discord account to use it.';
      }
    });
  }
  cards.forEach(function (card) {
    const cta = card.querySelector('.js-lite-cta');
    if (!cta) return;
    cta.dataset.label = cta.textContent;
    cta.dataset.checkout = cta.getAttribute('href');
    cta.addEventListener('click', function () {
        if (cta.getAttribute('href') === '/cart') Store.setLitePlan(card.dataset.plan);
    });
  });
  Store.onProfile(render);
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
