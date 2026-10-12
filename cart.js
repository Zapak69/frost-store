(function () {
  const Store = window.FrostStore;
  const itemsEl = document.getElementById('cartItems');
  const summaryEl = document.getElementById('cartSummary');
  const promoInput = document.getElementById('cartPromo');
  const promoBtn = document.getElementById('cartPromoBtn');
  const promoMsg = document.getElementById('cartPromoMsg');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  const checkoutNote = document.getElementById('cartCheckoutNote');
  const PENDING_KEY = 'frostStorePendingCart';
  const PROMO_KEY = 'frostStoreCartPromo';
  const ERRORS = {
    empty_cart: 'Your cart is empty.',
    too_many_items: 'Too many capes in one order. Remove a few and try again.',
    invalid_promo: "That discount code isn't valid.",
    invalid_total: "This order can't be checked out. Remove the discount code or add another cape.",
    whop_error: "Whop couldn't start the checkout. Please try again in a moment.",
    token_expired: 'Your session expired. Please sign in again.'
  };
  let catalog = null;
  let collections = [];
  let quote = null;
  let busy = false;

  function money(n) {
      return '€' + (Number(n) || 0).toFixed(2);
  }

  function savedPromo() {
    try {
        return sessionStorage.getItem(PROMO_KEY) || '';
    } catch (e) {
        return '';
    }
  }

  function setSavedPromo(code) {
    try {
      if (code) sessionStorage.setItem(PROMO_KEY, code);
      else sessionStorage.removeItem(PROMO_KEY);
    } catch (e) {}
  }

  function purchasable(cape) {
    const store = cape && cape.store;
    if (!store || store.subscription || !store.checkout) return false;
    const price = Number(store.price);
    if (!isFinite(price) || price <= 0) return false;
    const limited = Store.limitedInfo(cape);
    return !(limited && !limited.active);
  }

  function cartCapes() {
    const ids = Store.getCart();
    const profile = Store.getProfile();
    const out = [];
    const drop = [];
    ids.forEach(function (id) {
      const cape = catalog.find(function (c) { return c.id === id; });
      if (!cape || !purchasable(cape) || Store.isOwned(cape, profile)) drop.push(id);
      else out.push(cape);
    });
    if (drop.length) Store.removeFromCart(drop);
    return out;
  }

  function thumb(cape) {
    const el = document.createElement('div');
    el.className = 'cart-item-thumb';
    el.style.backgroundImage = 'url("' + Store.capesBase + String(cape.file).split('/').map(encodeURIComponent).join('/') + '")';
    return el;
  }

  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function currentLite() {
    const key = Store.getLitePlan();
    if (!key) return null;
    const profile = Store.getProfile();
    const purchased = !!(profile && profile.liteActive && (profile.litePlan === 'monthly' || profile.litePlan === 'annual'));
    if (purchased) {
      Store.setLitePlan(null);
      Store.showToast('You already have a FrostClient Lite subscription, so it was removed from your cart.');
      return null;
    }
    return Store.litePlans[key];
  }

  function capeDisplayName(cape) {
    const baseName = String(cape.name || cape.id);
    return /\bcape$/i.test(baseName) ? baseName : baseName + ' - Cape';
  }

  function buildRow(opts) {
    const row = document.createElement('div');
    row.className = 'cart-item' + (opts.cls ? ' ' + opts.cls : '');
    const main = document.createElement(opts.href ? 'a' : 'div');
    main.className = 'cart-item-main';
    if (opts.href) main.href = opts.href;
    main.appendChild(opts.thumb);
    const info = document.createElement('div');
    info.className = 'cart-item-info';
    const name = document.createElement('div');
    name.className = 'cart-item-name';
    name.textContent = opts.name;
    info.appendChild(name);
    const price = document.createElement('div');
    price.className = 'cart-item-price' + (opts.priceCls ? ' ' + opts.priceCls : '');
    price.textContent = opts.price;
    if (opts.oldPrice) {
      const old = document.createElement('s');
      old.textContent = opts.oldPrice;
      price.appendChild(document.createTextNode(' '));
      price.appendChild(old);
    }
    info.appendChild(price);
    if (opts.sub) {
      const sub = document.createElement('div');
      sub.className = 'cart-item-sub';
      sub.textContent = opts.sub;
      info.insertBefore(sub, price);
    }
    main.appendChild(info);
    row.appendChild(main);
    (opts.actions || []).forEach(function (el) {
        row.appendChild(el);
    });
    return row;
  }

  function removeButton(label, onClick) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cart-item-remove';
    remove.setAttribute('aria-label', label);
    remove.innerHTML = ICON_X;
    remove.addEventListener('click', onClick);
    return remove;
  }

  function renderLiteRows(plan) {
    const other = plan.key === 'monthly' ? Store.litePlans.annual : Store.litePlans.monthly;
    const swap = document.createElement('button');
    swap.type = 'button';
    swap.className = 'cart-lite-swap';
    swap.textContent = other.key === 'annual' ? 'Switch to annual' : 'Switch to monthly';
    swap.addEventListener('click', function () {
        Store.setLitePlan(other.key);
    });
    const banner = document.createElement('div');
    banner.className = 'cart-lite-banner cart-lite-banner--' + plan.key;
    const info = document.createElement('div');
    info.className = 'cart-item-info';
    const title = document.createElement('div');
    title.className = 'cart-lite-title';
    title.textContent = 'FrostClient Lite - ' + plan.name;
    info.appendChild(title);
    const price = document.createElement('div');
    price.className = 'cart-lite-price';
    price.textContent = money(plan.price) + ' ' + plan.period + (plan.key === 'monthly' ? ' · ' + plan.note : '');
    info.appendChild(price);
    banner.appendChild(info);
    banner.appendChild(swap);
    banner.appendChild(removeButton('Remove FrostClient Lite', function () { Store.setLitePlan(null); }));
    itemsEl.appendChild(banner);
    plan.capes.forEach(function (id) {
      const cape = catalog.find(function (c) { return c.id === id; });
      if (!cape) return;
      itemsEl.appendChild(buildRow({
        thumb: thumb(cape),
        name: capeDisplayName(cape),
        price: 'Free',
        priceCls: 'cart-item-price--free',
        href: '/cape?id=' + encodeURIComponent(cape.id)
      }));
    });
  }

  function capeRow(cape, saved) {
    const sale = Store.salePrice(cape);
    return buildRow({
      cls: saved ? 'cart-item--saved' : '',
      thumb: thumb(cape),
      name: capeDisplayName(cape),
      price: money(Store.memberPrice(cape) ? Store.memberPrice(cape).price : cape.store.price),
      oldPrice: sale ? money(sale.original) : (Store.memberPrice(cape) ? money(cape.store.price) : ''),
      href: '/cape?id=' + encodeURIComponent(cape.id),
      actions: [removeButton('Remove ' + (cape.name || cape.id), function () {
        Store.removeFromCart(cape.id);
        quote = null;
        render();
        refreshQuote();
      })]
    });
  }

  function bundleThumb(col, capes) {
    const el = document.createElement('div');
    el.className = 'cart-bundle-thumb is-stack';
    Store.bundlePicks(col.id, capes, 3).forEach(function (cape) {
        el.appendChild(thumb(cape));
    });
    return el;
  }

  function localBundleDiscount(col, capes) {
    const sum = capes.reduce(function (t, c) { return t + Number(c.store.price); }, 0);
    const fullSum = col.capes.map(function (id) { return catalog.find(function (c) { return c.id === id; }); })
      .filter(purchasable).reduce(function (t, c) { return t + Number(c.store.price); }, 0);
    const paidCount = col.capes.map(function (id) { return catalog.find(function (c) { return c.id === id; }); }).filter(purchasable).length;
    const rate = capes.length >= 1 && paidCount >= 2 && Store.collectionActive(col) ? Store.bundleRate(col, fullSum) : 0;
    return Math.round(sum * rate * 100) / 100;
  }

  function cartGroups(capes) {
    const used = {};
    const groups = [];
    Store.getCartBundles().forEach(function (b) {
      const col = collections.find(function (c) { return c.id === b.id; });
      if (!col) return;
      const group = b.capes.map(function (id) { return capes.find(function (c) { return c.id === id; }); });
      if (group.some(function (c) { return !c || used[c.id]; })) return;
      group.forEach(function (c) { used[c.id] = true; });
      groups.push({ col: col, capes: group });
    });
    return { groups: groups, used: used };
  }

  function bundleRow(col, capes, saved) {
    const sum = Math.round(capes.reduce(function (t, c) { return t + Number(c.store.price); }, 0) * 100) / 100;
    const live = !saved && quote && Array.isArray(quote.bundles) ? quote.bundles.find(function (b) { return b.id === col.id; }) : null;
    const off = live ? Number(live.discount || 0) : (quote && !saved ? 0 : localBundleDiscount(col, capes));
    const price = Math.round((sum - off) * 100) / 100;
    return buildRow({
      cls: 'cart-item--bundle' + (saved ? ' cart-item--saved' : ''),
      thumb: bundleThumb(col, capes),
      name: (col.name || col.id) + ' - Collection',
      sub: capes.length + (capes.length === 1 ? ' cape: ' : ' capes: ') + capes.slice(0, 4).map(function (c) { return c.name || c.id; }).join(', ') + (capes.length > 4 ? ' +' + (capes.length - 4) + ' more' : ''),
      price: money(price),
      oldPrice: price < sum ? money(sum) : '',
      href: '/collection?id=' + encodeURIComponent(col.id),
      actions: [removeButton('Remove the ' + (col.name || col.id) + ' collection', function () {
        Store.removeBundleFromCart(col.id);
        quote = null;
        render();
        refreshQuote();
      })]
    });
  }

  function renderCapeList(container, capes, saved) {
    const grouped = cartGroups(capes);
    const used = grouped.used;
    grouped.groups.forEach(function (g) {
        container.appendChild(bundleRow(g.col, g.capes, saved));
    });
    capes.forEach(function (cape) {
        if (!used[cape.id]) container.appendChild(capeRow(cape, saved));
    });
  }

  function render() {
    if (!catalog) return;
    const capes = cartCapes();
    const lite = currentLite();
    itemsEl.innerHTML = '';
    if (lite) {
      renderLiteRows(lite);
      if (capes.length) {
        const saved = document.createElement('div');
        saved.className = 'cart-saved';
        const note = document.createElement('div');
        note.className = 'cart-saved-note';
        note.textContent = 'Saved for later · capes can\'t be bought together with Lite. They come back once you check out or remove Lite.';
        saved.appendChild(note);
        renderCapeList(saved, capes, true);
        itemsEl.appendChild(saved);
      }
      summaryEl.hidden = false;
      renderTotals([], lite);
      return;
    }
    if (!capes.length) {
      summaryEl.hidden = true;
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      empty.innerHTML = '<p>Your cart is empty.</p><a class="detail-cta cta-buy" href="/capes">Browse capes</a>';
      itemsEl.appendChild(empty);
      return;
    }
    renderCapeList(itemsEl, capes, false);
    summaryEl.hidden = false;
    renderTotals(capes, lite);
  }

  function renderTotals(capes, lite) {
    const local = capes.reduce(function (sum, c) { return sum + Number(c.store.price); }, 0);
    const subtotal = capes.length ? (quote ? quote.subtotal : local) : 0;
    const litePromo = lite && quote && quote.discountPercent ? quote.discountPercent : 0;
    const pct = (capes.length || lite) && quote && quote.discountPercent ? quote.discountPercent : 0;
    const localGroups = !quote && capes.length ? cartGroups(capes).groups : [];
    const localBundleOff = Math.round(localGroups.reduce(function (t, g) { return t + localBundleDiscount(g.col, g.capes); }, 0) * 100) / 100;
    const capesTotal = capes.length ? (quote ? quote.total : Math.round((local - localBundleOff) * 100) / 100) : 0;
    const round2 = function (n) { return Math.round(n * 100) / 100; };
    const liteToday = lite ? round2(lite.dueNow * (1 - litePromo / 100)) : 0;
    const total = capesTotal + liteToday;
    document.getElementById('cartLiteRow').hidden = !lite;
    if (lite) {
      document.getElementById('cartLiteLabel').textContent = 'FrostClient Lite - ' + lite.name;
      document.getElementById('cartLitePrice').textContent = lite.dueNow ? money(lite.dueNow) : 'Free trial';
    }
    document.getElementById('cartSubtotalRow').hidden = !capes.length;
    document.getElementById('cartSubtotal').textContent = money(subtotal);
    const bundles = capes.length && quote && Array.isArray(quote.bundles) ? quote.bundles
      : localGroups.filter(function (g) { return localBundleDiscount(g.col, g.capes) > 0; }).map(function (g) {
          const fullSum = g.col.capes.map(function (id) { return catalog.find(function (c) { return c.id === id; }); }).filter(purchasable).reduce(function (t, c) { return t + Number(c.store.price); }, 0);
          return { id: g.col.id, name: g.col.name || g.col.id, percent: Math.round(Store.bundleRate(g.col, fullSum) * 100) };
        });
    const bundleOff = quote ? (bundles.length ? Number(quote.bundleDiscount) || 0 : 0) : localBundleOff;
    document.getElementById('cartBundleRow').hidden = !bundleOff;
    if (bundleOff) {
      document.getElementById('cartBundleLabel').textContent = bundles.length === 1 ? bundles[0].name + ' bundle (' + bundles[0].percent + '%)' : 'Bundle discounts';
      document.getElementById('cartBundle').textContent = '−' + money(bundleOff);
    }
    const litePct = capes.length && quote && quote.liteDiscountPercent ? quote.liteDiscountPercent : 0;
    const liteOff = litePct ? Number(quote.liteDiscount) || 0 : 0;
    const liteBase = lite ? (lite.dueNow || lite.price) : 0;
    const promoOff = lite ? round2(liteBase - round2(liteBase * (1 - litePromo / 100))) : (pct ? Number(quote.promoDiscount) || 0 : 0);
    document.getElementById('cartLiteDiscRow').hidden = !litePct;
    if (litePct) {
      document.getElementById('cartLiteDiscLabel').textContent = 'Lite member discount (' + litePct + '%)';
      document.getElementById('cartLiteDisc').textContent = '−' + money(liteOff);
    }
    const ignored = !lite && capes.length && quote && quote.promoIgnored ? quote.promoIgnored : '';
    document.getElementById('cartDiscountRow').hidden = !pct && !ignored;
    document.getElementById('cartDiscountNote').hidden = !ignored;
    if (pct) {
      document.getElementById('cartDiscountLabel').textContent = quote.promoCode + ' – ' + pct + '%';
      document.getElementById('cartDiscount').textContent = '−' + money(promoOff);
    } else if (ignored) {
      document.getElementById('cartDiscountLabel').textContent = ignored + ' – 0%';
      document.getElementById('cartDiscount').textContent = '−' + money(0);
    }
    const minApplied = !!(capes.length && quote && quote.minimumApplied);
    document.getElementById('cartMinRow').hidden = !minApplied;
    if (minApplied) {
      const discounted = Math.round((subtotal - bundleOff - liteOff - promoOff) * 100) / 100;
      document.getElementById('cartMinAdd').textContent = '+' + money(capesTotal - discounted);
    }
    document.getElementById('cartTotalLabel').textContent = lite ? 'Due today' : 'Total';
    const trial = !!(lite && !lite.dueNow);
    document.getElementById('cartTomorrowRow').hidden = !trial;
    if (trial) document.getElementById('cartTomorrow').textContent = money(round2(lite.price * (1 - litePromo / 100)));
    const promoWrap = promoInput.closest('.cart-promo');
    promoWrap.hidden = false;
    document.getElementById('cartPromoLite').hidden = true;
    if (lite) promoMsg.hidden = true;
    document.getElementById('cartTotal').textContent = money(total);
    const loggedIn = !!Store.loadToken();
    if (!busy) checkoutBtn.textContent = lite ? 'Checkout' : (loggedIn ? 'Checkout' : 'Sign in to check out');
    if (!loggedIn && !lite) checkoutNote.textContent = 'Sign in with Discord so your purchase can be linked to your account.';
    else if (lite) checkoutNote.textContent = trial
      ? 'Nothing is charged today. Your free trial ends tomorrow, then Lite renews at ' + money(lite.price) + ' / month until you cancel.'
      : 'Checkout is handled securely by Whop. Lite unlocks in the Frost Launcher right after you subscribe.';
    else if (quote && quote.promoIgnored) checkoutNote.textContent = 'Code ' + quote.promoIgnored + ' is added on the Whop checkout page. With a collection in your cart, you pay the total shown here.';
    else if (quote && quote.promoCode) checkoutNote.textContent = 'Code ' + quote.promoCode + ' is applied on the Whop checkout page. Your capes unlock right after payment.';
    else checkoutNote.textContent = 'Checkout is handled securely by Whop. Your capes unlock right after payment.';
  }

  function showPromoMsg(text, ok) {
    promoMsg.textContent = text;
    promoMsg.classList.toggle('is-ok', !!ok);
    promoMsg.hidden = !text;
  }

  function refreshQuote() {
    if (!catalog || !Store.loadToken()) return Promise.resolve(null);
    const liteInCart = !!Store.getLitePlan();
    const ids = liteInCart ? [] : Store.getCart();
    const promo = savedPromo();
    if (!ids.length && !(liteInCart && promo)) {
      if (liteInCart) {
        quote = null;
        render();
      }
      return Promise.resolve(null);
    }
    return Store.botPost('/store/cart-quote', { capes: ids, promo: promo }).then(function (data) {
      if (!data || !data.ok) {
        if (data && data.error === 'token_expired') Store.clearAuth();
        return null;
      }
      if (data.removed && data.removed.length) {
        Store.removeFromCart(data.removed.map(function (r) { return r.id; }));
        if (data.removed.some(function (r) { return r.reason === 'owned'; })) Store.showToast('Capes you already own were removed from your cart.');
      }
      quote = data;
      if (promo && !data.promoValid) {
        setSavedPromo('');
        showPromoMsg("That discount code isn't valid.", false);
      } else if (data.promoCode || data.promoIgnored) {
        showPromoMsg('', false);
        promoInput.value = '';
      }
      render();
      return data;
    }).catch(function () {
        return null;
    });
  }

  promoBtn.addEventListener('click', function () {
    const code = promoInput.value.trim().toUpperCase();
    if (!code) {
      promoInput.focus();
      return;
    }
    if (!Store.loadToken()) {
      setSavedPromo(code);
      Store.startLogin('store', '.k');
      return;
    }
    promoBtn.classList.add('is-loading');
    promoBtn.disabled = true;
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add('is-waiting');
    setSavedPromo(code);
    refreshQuote().then(function () {
      promoBtn.classList.remove('is-loading');
      promoBtn.disabled = false;
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove('is-waiting');
    });
  });

  promoInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') promoBtn.click();
  });

  checkoutBtn.addEventListener('click', function () {
    if (busy) return;
    const litePlan = currentLite();
    if (litePlan) {
      const code = quote && quote.promoCode && quote.discountPercent ? quote.promoCode : '';
      Store.setLitePlan(null);
      window.location.href = litePlan.checkout + (code ? '/?promoCode=' + encodeURIComponent(code) : '');
      return;
    }
    if (!Store.loadToken()) {
      Store.startLogin('store', '.k');
      return;
    }
    const ids = Store.getCart();
    if (!ids.length) return;
    busy = true;
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add('is-loading');
    checkoutBtn.setAttribute('aria-busy', 'true');
    Store.botPost('/store/cart-checkout', { capes: ids, promo: savedPromo(), returnBase: window.location.origin }).then(function (data) {
      if (data && data.ok && data.free) {
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify({ cartId: data.cartId, capes: ids, at: Date.now() }));
        } catch (e) {}
        window.location.href = '/thank-you?cart=' + encodeURIComponent(data.cartId);
        return;
      }
      if (data && data.ok && data.checkoutUrl) {
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify({ cartId: data.cartId, capes: ids, at: Date.now() }));
        } catch (e) {}
        window.location.href = data.checkoutUrl;
        return;
      }
      busy = false;
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove('is-loading');
      checkoutBtn.removeAttribute('aria-busy');
      if (data && data.error === 'token_expired') Store.clearAuth();
      if (data && data.error === 'invalid_promo') setSavedPromo('');
      Store.showToast(ERRORS[data && data.error] || 'Something went wrong. Please try again.');
      refreshQuote();
      render();
    }).catch(function () {
      busy = false;
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove('is-loading');
      checkoutBtn.removeAttribute('aria-busy');
      Store.showToast('Network error. Please try again.');
      render();
    });
  });

  Store.onCart(function () {
    quote = null;
    render();
    refreshQuote();
  });

  let quoted = false;
  Store.onProfile(function () {
    render();
    if (!quoted && Store.isAuthSettled() && Store.getProfile()) {
      quoted = true;
      refreshQuote();
    }
  });

  document.getElementById('cartPromoRemove').addEventListener('click', function () {
    setSavedPromo('');
    showPromoMsg('', false);
    quote = null;
    render();
    refreshQuote();
  });
  Promise.all([
    Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2),
    Store.loadCollections()
  ])
    .then(function (res) {
      const data = res[0];
      collections = res[1] || [];
      catalog = Array.isArray(data) ? data : [];
      render();
      if (Store.isAuthSettled() && Store.getProfile()) {
        quoted = true;
        refreshQuote();
      }
    })
    .catch(function () {
        itemsEl.innerHTML = '<div class="cart-empty">Couldn\'t load the cape catalog. Please try again later.</div>';
    });
})();
