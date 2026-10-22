(function () {
  const grid = document.getElementById('capeGrid');
  if (!grid) return;
  const Store = window.FrostStore;
  const POPULARITY_URL = 'https://bot.frostclient.eu/store/cape-popularity';
  const SORT_KEY = 'frostStoreSort';
  const PANEL_KEY = 'frostStoreFiltersHidden';
  const FILTERS_KEY = 'frostStoreFilters';
  const COLOR_CACHE_KEY = 'frostStoreCapeColors.v1';
  const svg = function (paths) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  };
  const SORTS = [
    { key: 'popular', label: 'Most used', icon: svg('<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5Z"/>') },
    { key: 'name-asc', label: 'Name (A-Z)', icon: svg('<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/>') },
    { key: 'name-desc', label: 'Name (Z-A)', icon: svg('<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/>') },
    { key: 'price-asc', label: 'Price (Low to High)', icon: svg('<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h4"/><path d="M11 8h7"/><path d="M11 12h10"/>') },
    { key: 'price-desc', label: 'Price (High to Low)', icon: svg('<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/>') },
    { key: 'newest', label: 'Newest', icon: svg('<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4Z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>') },
    { key: 'oldest', label: 'Oldest', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') }
  ];
  const COLORS = [
    { key: 'red', label: 'Red', hex: '#ff453a' },
    { key: 'orange', label: 'Orange', hex: '#ff9f0a' },
    { key: 'yellow', label: 'Yellow', hex: '#ffd60a' },
    { key: 'green', label: 'Green', hex: '#32d74b' },
    { key: 'blue', label: 'Blue', hex: '#a855f7' },
    { key: 'purple', label: 'Purple', hex: '#bf5af2' },
    { key: 'pink', label: 'Pink', hex: '#ff73fa' },
    { key: 'brown', label: 'Brown', hex: '#a2845e' },
    { key: 'black', label: 'Black', hex: '#17101f' },
    { key: 'gray', label: 'Gray', hex: '#9a8fa6' },
    { key: 'white', label: 'White', hex: '#f5f5f7' }
  ];

  let catalog = null;
  let popularity = {};
  let colorsById = {};
  let sortMode = readLocal(SORT_KEY) || 'newest';
  if (!SORTS.some(function (s) { return s.key === sortMode; })) sortMode = 'newest';
  const filters = { colors: [], type: [], avail: [], hideOwned: true, query: '' };
  (function restoreFilters() {
    let saved = null;
    try {
        saved = JSON.parse(readLocal(FILTERS_KEY) || 'null');
    } catch (e) {
        saved = null;
    }
    if (!saved || typeof saved !== 'object') return;
    ['colors', 'type', 'avail'].forEach(function (k) {
        if (Array.isArray(saved[k])) filters[k] = saved[k].filter(function (v) { return typeof v === 'string'; });
    });
    if (typeof saved.hideOwned === 'boolean') filters.hideOwned = saved.hideOwned;
  })();

  function saveFilters() {
      writeLocal(FILTERS_KEY, JSON.stringify({ colors: filters.colors, type: filters.type, avail: filters.avail, hideOwned: filters.hideOwned }));
  }

  function readLocal(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
  }

  function writeLocal(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {}
  }

  function storeCapes() {
    return (catalog || []).filter(function (cape) {
      if (!cape.store || cape.store.subscription || Store.isStoreHidden(cape)) return false;
      const limited = Store.limitedInfo(cape);
      return !(limited && !limited.active);
    });
  }

  function isFree(cape) {
    return cape.store && (cape.store.price === 0 || cape.store.price === 'free');
  }

  function matches(cape, profile) {
    if (filters.query && String(cape.name || cape.id).toLowerCase().indexOf(filters.query) === -1) return false;
    if (filters.colors.length) {
      const own = colorsById[cape.id] || [];
      if (!filters.colors.some(function (c) { return own.indexOf(c) !== -1; })) return false;
    }
    if (filters.type.length) {
      const types = [cape.animated ? 'animated' : 'static'];
      if (cape.mature === true) types.push('mature');
      if (Store.isPartnerCape(cape)) types.push('partner');
      if (!filters.type.some(function (t) { return types.indexOf(t) !== -1; })) return false;
    }
    if (filters.avail.length) {
      const limited = Store.limitedInfo(cape);
      const tags = [];
      if (Store.salePrice(cape)) tags.push('sale');
      if (limited && limited.active) tags.push('limited');
      if (isFree(cape)) tags.push('free');
      if (!filters.avail.some(function (a) { return tags.indexOf(a) !== -1; })) return false;
    }
    if (filters.hideOwned && Store.isOwned(cape, profile)) return false;
    return true;
  }

  function sortList(list) {
    const order = {};
    (catalog || []).forEach(function (cape, i) {
        order[cape.id] = i;
    });
    const byNewest = function (a, b) {
      const ta = Store.releaseTime(a);
      const tb = Store.releaseTime(b);
      if (ta === null && tb !== null) return 1;
      if (tb === null && ta !== null) return -1;
      if (ta !== tb) return tb - ta;
      return order[b.id] - order[a.id];
    };
    const name = function (c) {
        return String(c.name || c.id);
    };
    const price = function (c) {
        return Store.priceValue(c);
    };
    const cmp = {
      popular: function (a, b) {
          return (popularity[b.id] || 0) - (popularity[a.id] || 0) || byNewest(a, b);
      },
      'name-asc': function (a, b) {
          return name(a).localeCompare(name(b), undefined, { sensitivity: 'base' });
      },
      'name-desc': function (a, b) {
          return name(b).localeCompare(name(a), undefined, { sensitivity: 'base' });
      },
      'price-asc': function (a, b) {
          return price(a) - price(b) || byNewest(a, b);
      },
      'price-desc': function (a, b) {
        const pa = price(a) === Infinity ? -Infinity : price(a);
        const pb = price(b) === Infinity ? -Infinity : price(b);
        return pb - pa || byNewest(a, b);
      },
      newest: byNewest,
      oldest: function (a, b) {
          return byNewest(b, a);
      }
    }[sortMode];
    return list.slice().sort(cmp);
  }

  function activeFilterCount() {
    return filters.colors.length + filters.type.length + filters.avail.length + (filters.hideOwned ? 0 : 1);
  }

  function render() {
    saveFilters();
    if (!catalog) return;
    const profile = Store.getProfile();
    const all = storeCapes();
    const visible = sortList(all.filter(function (cape) { return matches(cape, profile); }));
    grid.innerHTML = '';
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'store-empty';
      empty.textContent = filters.query || activeFilterCount() ? 'No cloaks match these filters.' : 'No cloaks available right now.';
      grid.appendChild(empty);
    }
    grid.classList.toggle('show-mature', filters.type.indexOf('mature') !== -1);
    visible.forEach(function (cape) {
      const card = Store.buildCapeCard(cape, profile);
      if (cape.mature === true) {
        card.classList.add('cape-card--mature');
        const tag = document.createElement('span');
        tag.className = 'cape-mature-tag';
        tag.textContent = 'Mature';
        const wrap = card.querySelector('.cape-card-preview-wrap');
        if (wrap) wrap.appendChild(tag);
      }
      grid.appendChild(card);
    });
    document.getElementById('catalogCount').textContent = visible.length === all.length
      ? all.length + ' cloaks'
      : visible.length + ' of ' + all.length + ' cloaks';
    const n = activeFilterCount();
    const countEl = document.getElementById('filterCount');
    countEl.textContent = String(n);
    countEl.hidden = n === 0;
    document.getElementById('filterClear').hidden = n === 0 && !filters.query;
    document.getElementById('ownedFilterGroup').hidden = !(profile && profile.user);
  }

  function renderTeaser() {
    const teaser = document.getElementById('liteTeaser');
    const teaserGrid = document.getElementById('liteTeaserGrid');
    if (!teaser || !catalog) return;
    const profile = Store.getProfile();
    const liteActive = !!(profile && profile.liteActive);
    const picks = liteActive ? [] : ['lite_year', 'lite'].map(function (id) {
        return catalog.find(function (c) { return c.id === id; });
    }).filter(Boolean);
    teaserGrid.innerHTML = '';
    picks.forEach(function (cape) {
        teaserGrid.appendChild(Store.buildCapeCard(cape, null));
    });
    teaser.hidden = picks.length === 0;
  }

  const sortBtn = document.getElementById('sortBtn');
  const sortListEl = document.getElementById('sortList');

  function paintSort() {
    const current = SORTS.find(function (s) { return s.key === sortMode; });
    document.getElementById('sortIcon').innerHTML = current.icon;
    document.getElementById('sortLabel').textContent = current.label;
    sortListEl.innerHTML = '';
    SORTS.forEach(function (s) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', s.key === sortMode ? 'true' : 'false');
      li.tabIndex = -1;
      li.dataset.key = s.key;
      li.className = 'sort-option' + (s.key === sortMode ? ' is-active' : '');
      li.innerHTML = '<span class="sort-option-icon">' + s.icon + '</span><span>' + s.label + '</span>';
      li.addEventListener('click', function () {
          chooseSort(s.key);
      });
      sortListEl.appendChild(li);
    });
  }

  function openSort(open) {
    sortListEl.hidden = !open;
    sortBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      const active = sortListEl.querySelector('.is-active') || sortListEl.firstChild;
      if (active) active.focus();
    }
  }

  function chooseSort(key) {
    sortMode = key;
    writeLocal(SORT_KEY, key);
    paintSort();
    openSort(false);
    sortBtn.focus();
    render();
  }

  sortBtn.addEventListener('click', function () {
      openSort(sortListEl.hidden);
  });
  sortListEl.addEventListener('keydown', function (e) {
    const items = Array.prototype.slice.call(sortListEl.children);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(0, i - 1)].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (i !== -1) chooseSort(items[i].dataset.key);
    } else if (e.key === 'Escape') {
      openSort(false);
      sortBtn.focus();
    }
  });
  document.addEventListener('click', function (e) {
      if (!sortListEl.hidden && !document.getElementById('sortMenu').contains(e.target)) openSort(false);
  });

  const layout = document.getElementById('catalogLayout');
  const toggle = document.getElementById('filterToggle');
  function setPanelHidden(hidden) {
    layout.classList.toggle('filters-hidden', hidden);
    document.getElementById('filterPanel').hidden = hidden;
    toggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    toggle.setAttribute('aria-label', hidden ? 'Show filters' : 'Hide filters');
    toggle.classList.toggle('is-off', hidden);
  }
  toggle.addEventListener('click', function () {
    const hidden = !layout.classList.contains('filters-hidden');
    setPanelHidden(hidden);
    writeLocal(PANEL_KEY, hidden ? '1' : '0');
  });
  setPanelHidden(readLocal(PANEL_KEY) === '1');

  document.getElementById('storeSearch').addEventListener('input', function (e) {
    filters.query = e.target.value.trim().toLowerCase();
    render();
  });
  document.querySelectorAll('[data-filter]').forEach(function (input) {
    input.checked = (filters[input.dataset.filter] || []).indexOf(input.value) !== -1;
  });
  document.getElementById('hideOwned').checked = filters.hideOwned;
  document.querySelectorAll('[data-filter]').forEach(function (input) {
    input.addEventListener('change', function () {
      const list = filters[input.dataset.filter];
      const i = list.indexOf(input.value);
      if (input.checked && i === -1) list.push(input.value);
      if (!input.checked && i !== -1) list.splice(i, 1);
      render();
    });
  });
  document.getElementById('hideOwned').addEventListener('change', function (e) {
    filters.hideOwned = e.target.checked;
    render();
  });
  document.getElementById('filterClear').addEventListener('click', function () {
    filters.colors = [];
    filters.type = [];
    filters.avail = [];
    filters.hideOwned = true;
    filters.query = '';
    document.getElementById('storeSearch').value = '';
    document.querySelectorAll('[data-filter]').forEach(function (input) {
        input.checked = false;
    });
    document.getElementById('hideOwned').checked = true;
    document.querySelectorAll('.color-swatch').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
    });
    render();
  });

  function renderSwatches() {
    const wrap = document.getElementById('colorFilters');
    const present = {};
    Object.keys(colorsById).forEach(function (id) {
      colorsById[id].forEach(function (c) {
          present[c] = true;
      });
    });
    wrap.innerHTML = '';
    const before = filters.colors.length;
    filters.colors = filters.colors.filter(function (k) { return present[k]; });
    if (filters.colors.length !== before) render();
    COLORS.filter(function (c) { return present[c.key]; }).forEach(function (c) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch';
      btn.style.setProperty('--swatch', c.hex);
      btn.title = c.label;
      btn.setAttribute('aria-label', c.label);
      btn.setAttribute('aria-pressed', filters.colors.indexOf(c.key) !== -1 ? 'true' : 'false');
      btn.addEventListener('click', function () {
        const i = filters.colors.indexOf(c.key);
        if (i === -1) filters.colors.push(c.key);
        else filters.colors.splice(i, 1);
        btn.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
        render();
      });
      wrap.appendChild(btn);
    });
    if (!wrap.children.length) wrap.innerHTML = '<span class="filter-hint">No color data yet.</span>';
  }

  function loadColors() {
    let cache = {};
    try {
        cache = JSON.parse(sessionStorage.getItem(COLOR_CACHE_KEY) || '{}') || {};
    } catch (e) {
        cache = {};
    }
    const capes = storeCapes();
    let pending = capes.length;
    if (!pending) {
      renderSwatches();
      return;
    }
    capes.forEach(function (cape) {
      const key = cape.id + '|' + cape.file;
      const done = function (list) {
        colorsById[cape.id] = list;
        cache[key] = list;
        pending--;
        if (pending === 0) {
          try {
              sessionStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(cache));
          } catch (e) {}
          renderSwatches();
          if (filters.colors.length) render();
        }
      };
      if (cache[key] && !(cape.store && Array.isArray(cape.store.colors))) done(cache[key]);
      else Store.capeColors(cape).then(done);
    });
  }

  paintSort();
  Store.onProfile(function () {
    render();
    renderTeaser();
  });

  fetch(POPULARITY_URL, { cache: 'no-store' })
    .then(function (r) {
        return r.ok ? r.json() : null;
    })
    .then(function (data) {
      popularity = data && data.ok && data.counts ? data.counts : {};
      if (sortMode === 'popular') render();
    })
    .catch(function () {
        popularity = {};
    });

  Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
    .then(function (data) {
      catalog = Array.isArray(data) ? data : [];
      render();
      renderTeaser();
      loadColors();
    })
    .catch(function () {
      grid.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'store-error';
      err.textContent = "Couldn't load the cloak catalog. Please try again later.";
      grid.appendChild(err);
    });
})();
