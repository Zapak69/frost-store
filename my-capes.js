(function () {
  const grid = document.getElementById('ownedGrid');
  if (!grid) return;
  const Store = window.FrostStore;
  let catalog = null;

  function renderSignInPrompt() {
    grid.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'store-empty';
    const text = document.createElement('p');
    text.textContent = 'Sign in with Discord to see the capes linked to your account.';
    wrap.appendChild(text);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-cta cta-buy';
    btn.style.marginTop = '18px';
    btn.textContent = 'Sign in with Discord';
    btn.addEventListener('click', function () { Store.startLogin('store'); });
    wrap.appendChild(btn);
    grid.appendChild(wrap);
  }

  function render() {
    const profile = Store.getProfile();
    const loggedIn = !!(Store.loadToken() && profile);
    if (!loggedIn) {
      if (Store.isAuthSettled()) renderSignInPrompt();
      return;
    }
    if (!catalog) return;
    const owned = catalog.filter(function (cape) {
      return cape.store && Store.isOwned(cape, profile);
    });
    grid.innerHTML = '';
    if (owned.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'store-empty';
      const text = document.createElement('p');
      text.textContent = "You don't own any capes yet.";
      empty.appendChild(text);
      const link = document.createElement('a');
      link.className = 'detail-cta cta-buy';
      link.style.marginTop = '18px';
      link.style.display = 'inline-flex';
      link.href = '.';
      link.textContent = 'Browse the catalog';
      empty.appendChild(link);
      grid.appendChild(empty);
      return;
    }
    owned.forEach(function (cape) {
      grid.appendChild(Store.buildCapeCard(cape, profile));
    });
  }

  Store.onProfile(function () { render(); });

  Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
    .then(function (data) {
      catalog = Array.isArray(data) ? data : [];
      render();
    })
    .catch(function () {
      catalog = [];
      grid.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'store-error';
      err.textContent = "Couldn't load your capes. Please try again later.";
      grid.appendChild(err);
    });
})();
