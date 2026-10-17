(function () {
  const Store = window.FrostStore;
  const id = String(new URLSearchParams(window.location.search).get('id') || '').trim().toLowerCase();
  const page = document.getElementById('collectionPage');
  const notFound = document.getElementById('collectionNotfound');
  const hero = document.getElementById('collectionHero');
  let badgeRow = null;
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

  function badgeHost() {
    return hero.hidden && badgeRow ? badgeRow : hero;
  }

  function hideHero() {
    hero.hidden = true;
    if (!badgeRow) return;
    hero.querySelectorAll('.collection-limited, .collection-owned').forEach(function (el) { badgeRow.appendChild(el); });
  }

  function renderHero() {
    hero.classList.remove('skeleton-shimmer');
    hero.innerHTML = '';
    hero.hidden = false;
    const url = Store.collectionBannerUrl(col);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = col.name || col.id;
      img.addEventListener('error', hideHero);
      hero.appendChild(img);
    } else {
      hero.hidden = true;
    }
    const ends = Store.collectionEnds(col);
    if (ends) {
      const lim = document.createElement('span');
      lim.className = 'collection-limited collection-limited--lg';
      lim.textContent = 'Limited · ' + ends.text;
      lim.title = 'Available until ' + new Date(ends.until).toLocaleString();
      badgeHost().appendChild(lim);
    }
  }

  function renderIntro() {
    intro.innerHTML = '';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'store-eyebrow';
    eyebrow.textContent = 'Collection';
    intro.appendChild(eyebrow);
    badgeRow = document.createElement('div');
    badgeRow.className = 'collection-badges';
    intro.appendChild(badgeRow);
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
    box.hidden = ownedAll;
    box.parentElement.classList.toggle('is-owned', ownedAll);
    const oldBadge = document.querySelector('#collectionPage .collection-owned');
    if (oldBadge) oldBadge.remove();
    if (ownedAll) {
      const badge = document.createElement('span');
      badge.className = 'collection-owned';
      badge.textContent = 'Owned';
      badgeHost().appendChild(badge);
      return;
    }
    const title = document.createElement('div');
    title.className = 'bundle-title';
    title.textContent = 'Get the collection';
    box.appendChild(title);
    const sum = Math.round(missing.reduce(function (s, c) { return s + Number(c.store.price); }, 0) * 100) / 100;
    const applies = rate > 0 && missing.length >= 1 && paid.length >= 2;
    const ownedPaid = paid.length - missing.length;
    const afterBundle = applies ? Math.round((sum - Math.round(sum * rate * 100) / 100) * 100) / 100 : sum;
    const litePct = profile && profile.liteActive ? Number(profile.liteDiscountPercent) || 0 : 0;
    const total = litePct ? Math.round(afterBundle * (1 - litePct / 100) * 100) / 100 : afterBundle;
    const liteCls = litePct >= 10 ? ' bundle-badge--annual' : ' bundle-badge--lite';
    if (missing.length) {
      const priceRow = document.createElement('div');
      priceRow.className = 'bundle-price';
      const now = document.createElement('span');
      now.className = 'bundle-price-now';
      now.textContent = money(total);
      priceRow.appendChild(now);
      if (applies || litePct) {
        const was = document.createElement('s');
        was.className = 'bundle-price-was';
        was.textContent = money(sum);
        priceRow.appendChild(was);
        const badge = document.createElement('span');
        badge.className = 'bundle-badge' + (litePct ? liteCls : '');
        badge.textContent = '−' + ((applies ? Math.round(rate * 100) : 0) + litePct) + '%' + (litePct ? ' Lite' : '');
        badge.title = litePct ? 'Your FrostClient Lite discount is already included' : '';
        priceRow.appendChild(badge);
      }
      box.appendChild(priceRow);
      const sub = document.createElement('p');
      sub.className = 'bundle-note';
      sub.textContent = (ownedPaid > 0 ? 'You own ' + ownedPaid + ' of ' + paid.length + ' · ' + missing.length + (missing.length === 1 ? ' cloak' : ' cloaks') + ' left' : missing.length + (missing.length === 1 ? ' cloak' : ' cloaks')) + (total < sum ? ' · you save ' + money(sum - total) : '');
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
        btn.textContent = ownedPaid > 0 ? 'Complete the collection' : 'Add collection to cart';
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
      const codeNote = document.createElement('p');
      codeNote.className = 'bundle-hint';
      codeNote.textContent = 'Discount codes don\u2019t apply to collections.';
      box.appendChild(codeNote);
    }
    if (free.length) {
      const freeNote = document.createElement('p');
      freeNote.className = 'bundle-hint';
      freeNote.textContent = free.length === 1 ? (free[0].name || free[0].id) + ' is free — claim it on its own page.' : free.length + ' cloaks in this collection are free — claim them on their own pages.';
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
    document.getElementById('collectionCapesTitle').textContent = capes.length === 1 ? '1 cloak in this collection' : capes.length + ' cloaks in this collection';
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
    renderIntro();
    renderHero();
    Store.onProfile(function (profile) {
      renderBox(profile);
      renderCapes(profile);
    });
    Store.onCart(function () {
        renderBox(Store.getProfile());
    });
  }).catch(showNotFound);
})();
