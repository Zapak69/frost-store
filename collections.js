(function () {
  const Store = window.FrostStore;
  const grid = document.getElementById('collectionGrid');
  Promise.all([
    Store.loadCollections(),
    Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2).catch(function () { return []; })
  ]).then(function (res) {
    const catalog = Array.isArray(res[1]) ? res[1] : [];
    const list = res[0].filter(Store.collectionActive).sort(function (a, b) {
      const ta = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const tb = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return tb - ta || res[0].indexOf(b) - res[0].indexOf(a);
    });
    Store.onProfile(function (profile) {
      grid.innerHTML = '';
      if (!list.length) {
        grid.innerHTML = '<div class="store-empty">No collections right now. Check back soon.</div>';
        return;
      }
      list.forEach(function (col) {
          grid.appendChild(Store.buildCollectionCard(col, catalog, profile));
      });
    });
  });
})();
