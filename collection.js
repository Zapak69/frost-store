(function () {
  const Store = window.FrostStore;
  const id = String(new URLSearchParams(window.location.search).get('id') || '').trim().toLowerCase();
  const page = document.getElementById('collectionPage');
  const notFound = document.getElementById('collectionNotfound');
  const hero = document.getElementById('collectionHero');
  const intro = document.getElementById('collectionIntro');
  const box = document.getElementById('bundleBox');
  const capesSection = document.getElementById('collectionCapesSection');
  const capesGrid = document.getElementById('collectionCapes');
  let col = null;
  let capes = [];

  function money(n) {
    return '€' + Number(n).toFixed(2);
  }

  function showNotFound() {
    page.hidden = true;
    notFound.hidden = false;
    document.title = 'Collection not found | Frost Store';
  }

  function renderHero() {
    hero.classList.remove('skeleton-shimmer');
    hero.innerHTML = '';
    const url = Store.collectionBannerUrl(col);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = col.name || col.id;
      img.addEventListener('error', function () {
        img.remove();
        hero.classList.add('is-empty');
      });
      hero.appendChild(img);
    } else {
      hero.classList.add('is-empty');
    }
    const ends = Store.collectionEnds(col);
    if (ends) {
      const lim = document.createElement('span');
      lim.className = 'collection-limited collection-limited--lg';
      lim.textContent = 'Limited · ' + ends.text;
      lim.title = 'Available until ' + new Date(ends.until).toLocaleString();
      hero.appendChild(lim);
    }
  }

  function renderIntro() {
    intro.innerHTML = '';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'store-eyebrow';
    eyebrow.textContent = 'Collection';
    intro.appendChild(eyebrow);
    const h1 = document.createElement('h1');
    h1.className = 'collection-title';
    h1.textContent = col.name || col.id;
    intro.appendChild(h1);
    if (col.description) {
      const p = document.createElement('p');
      p.className = 'collection-desc';
      p.textContent = col.description;
      intro.appendChild(p);
    }
  }

  function renderBox(profile) {
    const paid = capes.filter(Store.isCartable);
    const fullSum = paid.reduce(function (s, c) { return s + Number(c.store.price); }, 0);
    const rate = Store.bundleRate(col, fullSum);
    const missing = paid.filter(function (c) { return !Store.isOwned(c, profile); });
    const free = capes.filter(function (c) { return !Store.isCartable(c) && c.store && !c.store.subscription && Number(c.store.price) === 0 && !Store.isOwned(c, profile); });
    const ownedAll = capes.length > 0 && capes.every(function (c) { return Store.isOwned(c, profile); });
    box.innerHTML = '';
    box.hidden = false;
    const title = document.createElement('div');
    title.className = 'bundle-title';
    title.textContent = ownedAll ? 'You own this collection' : 'Get the collection';
    box.appendChild(title);
    if (ownedAll) {
      const note = document.createElement('p');
      note.className = 'bundle-note';
      note.textContent = 'Every cape in this collection is already yours. Equip them in the FrostClient launcher.';
      box.appendChild(note);
      return;
    }
    const sum = Math.round(missing.reduce(function (s, c) { return s + Number(c.store.price); }, 0) * 100) / 100;
    const applies = rate > 0 && missing.length >= 2 && paid.length >= 2;
    const total = applies ? Math.round((sum - Math.round(sum * rate * 100) / 100) * 100) / 100 : sum;
    if (missing.length) {
      const priceRow = document.createElement('div');
      priceRow.className = 'bundle-price';
      const now = document.createElement('span');
      now.className = 'bundle-price-now';
      now.textContent = money(total);
      priceRow.appendChild(now);
      if (applies) {
        const was = document.createElement('s');
        was.className = 'bundle-price-was';
        was.textContent = money(sum);
        priceRow.appendChild(was);
        const badge = document.createElement('span');
        badge.className = 'bundle-badge';
        badge.textContent = '−' + Math.round(rate * 100) + '%';
        priceRow.appendChild(badge);
      }
      box.appendChild(priceRow);
      const sub = document.createElement('p');
      sub.className = 'bundle-note';
      sub.textContent = missing.length + (missing.length === 1 ? ' cape' : ' capes') + (missing.length < paid.length ? ' you don’t own yet' : '') + (applies ? ' · you save ' + money(sum - total) : '') + (profile && profile.liteDiscountPercent ? ' · your Lite discount is added in the cart' : '');
      box.appendChild(sub);
      const allIn = Store.getCartBundles().some(function (b) {
          return b.id === col.id && missing.every(function (c) { return b.capes.indexOf(c.id) !== -1; });
      });
      const btn = document.createElement(allIn ? 'a' : 'button');
      btn.className = 'detail-cta cta-buy bundle-cta';
      if (allIn) {
        btn.href = '/cart';
        btn.textContent = 'View cart →';
      } else {
        btn.type = 'button';
        btn.textContent = missing.length === 1 ? 'Add to cart' : 'Add collection to cart';
        btn.addEventListener('click', function () {
          const ids = missing.map(function (c) { return c.id; });
          if (!Store.addBundleToCart(col.id, ids)) {
            Store.showToast('Your cart is full (' + Store.cartMax + ' items). Check out first, then add the collection.');
            return;
          }
          Store.showToast((col.name || col.id) + ' added to your cart');
          renderBox(Store.getProfile());
        });
      }
      box.appendChild(btn);
      if (rate > 0 && !applies) {
        const hint = document.createElement('p');
        hint.className = 'bundle-hint';
        hint.textContent = 'The bundle discount applies when at least two capes from the collection are left to buy.';
        box.appendChild(hint);
      }
    }
    if (free.length) {
      const freeNote = document.createElement('p');
      freeNote.className = 'bundle-hint';
      freeNote.textContent = free.length === 1 ? (free[0].name || free[0].id) + ' is free — claim it on its own page.' : free.length + ' capes in this collection are free — claim them on their own pages.';
      box.appendChild(freeNote);
    }
  }

  function renderCapes(profile) {
    capesGrid.innerHTML = '';
    capes.forEach(function (c) {
      const card = Store.buildCapeCard(c, profile);
      if (c.mature === true) {
        card.classList.add('cape-card--mature');
        const tag = document.createElement('span');
        tag.className = 'cape-mature-tag';
        tag.textContent = 'Mature';
        const wrap = card.querySelector('.cape-card-preview-wrap');
        if (wrap) wrap.appendChild(tag);
      }
      capesGrid.appendChild(card);
    });
    document.getElementById('collectionCapesTitle').textContent = capes.length === 1 ? '1 cape in this collection' : capes.length + ' capes in this collection';
    capesSection.hidden = false;
  }

  if (!id) return showNotFound();
  Promise.all([
    Store.loadCollections(),
    Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
  ]).then(function (res) {
    const catalog = Array.isArray(res[1]) ? res[1] : [];
    col = res[0].find(function (c) { return c.id === id; });
    if (!col || !Store.collectionActive(col)) return showNotFound();
    capes = col.capes.map(function (cid) { return catalog.find(function (c) { return c.id === cid && c.store; }); }).filter(Boolean);
    if (!capes.length) return showNotFound();
    document.title = (col.name || col.id) + ' | Frost Store';
    page.removeAttribute('aria-busy');
    renderHero();
    renderIntro();
    Store.onProfile(function (profile) {
      renderBox(profile);
      renderCapes(profile);
    });
    Store.onCart(function () {
        renderBox(Store.getProfile());
    });
  }).catch(showNotFound);
})();
