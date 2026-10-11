(function () {
  const Store = window.FrostStore;
  const capeId = new URLSearchParams(window.location.search).get('id') || '';
  const layout = document.getElementById('detailLayout');
  const notFound = document.getElementById('detailNotfound');
  const info = document.getElementById('detailInfo');
  const previewPanel = document.getElementById('previewPanel');
  const BOT_BASE = 'https://bot.frostclient.eu';
  const SKIN_KEY = 'frostStoreSkin';
  let viewer = null;
  let mySkinInfo = null;
  let mySkinCheckedFor = null;
  let limitedClaiming = false;
  let limitedClaimError = '';
  let limitedClaimedFlash = false;
  let limitedJustClaimed = false;
  const LIMITED_ERROR_TEXT = {
    not_signed_in: 'Your session expired. Sign in again to claim this cape.',
    expired: 'This limited cape is no longer available.',
    rate_limited: 'Too many attempts. Wait a minute and try again.',
    grant_failed: 'The cape could not be added to your account right now. Try again in a moment.',
    not_found: 'This cape is not available to claim.'
  };
  const CLAIM_CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function loadSavedSkin() {
    try {
        return JSON.parse(localStorage.getItem(SKIN_KEY) || 'null');
    } catch (e) {
        return null;
    }
  }
  function saveSkin(skin) {
    try {
      if (skin) localStorage.setItem(SKIN_KEY, JSON.stringify(skin));
      else localStorage.removeItem(SKIN_KEY);
    } catch (e) {}
    updateSkinMenuState();
  }
  function loadDefaultSkin(v) {
    return fetchObjectUrl('skin.png').then(function (url) {
        return v.loadSkin(url);
    });
  }
  function applySkin(v, skin) {
    if (!skin || !skin.skinUrl) return loadDefaultSkin(v);
    const result = v.loadSkin(skin.skinUrl, { model: skin.model === 'slim' ? 'slim' : (skin.model === 'default' ? 'default' : 'auto-detect') });
    return Promise.resolve(result);
  }
  function loadInitialSkin(v) {
    const saved = loadSavedSkin();
    if (!saved || !saved.skinUrl) return loadDefaultSkin(v);
    return applySkin(v, saved).catch(function () {
      saveSkin(null);
      return loadDefaultSkin(v);
    });
  }

  const skinMenuWrap = document.getElementById('skinMenuWrap');
  const skinMenuBtn = document.getElementById('skinMenuBtn');
  const skinMenu = document.getElementById('skinMenu');
  const skinMenuMine = document.getElementById('skinMenuMine');
  const skinMenuByName = document.getElementById('skinMenuByName');
  const skinMenuDefault = document.getElementById('skinMenuDefault');
  const skinModal = document.getElementById('skinModal');
  const skinModalForm = document.getElementById('skinModalForm');
  const skinNameInput = document.getElementById('skinNameInput');
  const skinModalSubmit = document.getElementById('skinModalSubmit');
  const skinModalError = document.getElementById('skinModalError');

  function updateSkinMenuState() {
    const saved = loadSavedSkin();
    skinMenuDefault.hidden = !saved;
    skinMenuMine.classList.toggle('is-active', !!(saved && saved.source === 'mine'));
    skinMenuByName.classList.toggle('is-active', !!(saved && saved.source === 'name'));
  }
  function setSkinMenuOpen(open) {
    skinMenu.classList.toggle('open', open);
    skinMenuBtn.classList.toggle('open', open);
    skinMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function refreshMySkinItem() {
    const token = Store.loadToken();
    if (!token) {
      mySkinInfo = null;
      mySkinCheckedFor = null;
      skinMenuMine.hidden = true;
      return;
    }
    if (mySkinCheckedFor === token) return;
    mySkinCheckedFor = token;
    fetch(BOT_BASE + '/launcher/my-skin?token=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) {
          return r.json();
      })
      .then(function (data) {
        if (mySkinCheckedFor !== token) return;
        mySkinInfo = data && data.ok && data.linked && data.skinUrl ? data : null;
        skinMenuMine.hidden = !mySkinInfo;
      })
      .catch(function () {
        if (mySkinCheckedFor === token) mySkinCheckedFor = null;
      });
  }
  function showSkinError(msg) {
    skinModalError.textContent = msg;
    skinModalError.hidden = !msg;
  }
  function openSkinModal() {
    showSkinError('');
    skinModal.hidden = false;
    setTimeout(function () {
        skinNameInput.focus();
    }, 30);
  }
  function closeSkinModal() {
    skinModal.hidden = true;
    skinModalSubmit.classList.remove('is-loading');
  }

  skinMenuBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setSkinMenuOpen(!skinMenu.classList.contains('open'));
  });
  document.addEventListener('click', function (e) {
    if (!skinMenu.classList.contains('open')) return;
    if (skinMenuWrap.contains(e.target)) return;
    setSkinMenuOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    setSkinMenuOpen(false);
    if (!skinModal.hidden) closeSkinModal();
  });
  skinMenuByName.addEventListener('click', function () {
    setSkinMenuOpen(false);
    openSkinModal();
  });
  skinMenuMine.addEventListener('click', function () {
    setSkinMenuOpen(false);
    if (!viewer || !mySkinInfo) return;
    const skin = { source: 'mine', name: mySkinInfo.username || '', skinUrl: mySkinInfo.skinUrl, model: mySkinInfo.model || 'auto-detect' };
    applySkin(viewer, skin).then(function () {
        saveSkin(skin);
    }).catch(function () {});
  });
  skinMenuDefault.addEventListener('click', function () {
    setSkinMenuOpen(false);
    if (!viewer) return;
    loadDefaultSkin(viewer).then(function () {
        saveSkin(null);
    }).catch(function () {});
  });
  document.getElementById('skinModalClose').addEventListener('click', closeSkinModal);
  skinModal.addEventListener('click', function (e) {
      if (e.target === skinModal) closeSkinModal();
  });
  skinModalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = skinNameInput.value.trim();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
      showSkinError('Usernames are 1-16 letters, numbers or underscores.');
      return;
    }
    if (!viewer) return;
    showSkinError('');
    skinModalSubmit.classList.add('is-loading');
    fetch(BOT_BASE + '/launcher/skin-lookup?name=' + encodeURIComponent(name), { cache: 'no-store' })
      .then(function (r) {
          return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !data.skinUrl) {
          skinModalSubmit.classList.remove('is-loading');
          showSkinError(data && data.error === 'not_found' ? "That player doesn't exist or has no skin." : "Couldn't load that skin right now. Please try again.");
          return;
        }
        const skin = { source: 'name', name: data.name || name, skinUrl: data.skinUrl, model: data.model || 'auto-detect' };
        return applySkin(viewer, skin).then(function () {
          saveSkin(skin);
          closeSkinModal();
          skinNameInput.value = '';
        }).catch(function () {
          skinModalSubmit.classList.remove('is-loading');
          showSkinError("Couldn't load that skin texture. Please try again.");
        });
      })
      .catch(function () {
        skinModalSubmit.classList.remove('is-loading');
        showSkinError('Network error while looking up the player. Please try again.');
      });
  });
  Store.onProfile(function () {
      refreshMySkinItem();
  });
  updateSkinMenuState();
  let cape = null;
  let viewerStarted = false;

  function showNotFound() {
    layout.hidden = true;
    notFound.hidden = false;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function isOwned(profile) {
    if (!cape) return false;
    if (limitedJustClaimed && profile && profile.user) return true;
    return !!(profile && profile.owned && profile.owned.indexOf(cape.id) !== -1);
  }

  function formatDateTime(ms) {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function claimLimited() {
    if (limitedClaiming) return;
    const token = Store.loadToken();
    if (!token) {
      Store.startLogin('store', '.c.' + cape.id);
      return;
    }
    limitedClaiming = true;
    limitedClaimError = '';
    renderInfo(Store.getProfile());
    fetch(BOT_BASE + '/store/claim-limited', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capeId: cape.id, token: token })
    })
      .then(function (r) {
          return r.json();
      })
      .then(function (data) {
        limitedClaiming = false;
        if (data && data.ok) {
          limitedJustClaimed = true;
          limitedClaimedFlash = true;
          setTimeout(function () {
            limitedClaimedFlash = false;
            renderInfo(Store.getProfile());
          }, 2500);
          Store.refreshProfile();
        } else {
          limitedClaimError = LIMITED_ERROR_TEXT[data && data.error] || 'Something went wrong. Try again in a moment.';
          if (data && data.error === 'not_signed_in') Store.clearAuth();
        }
        renderInfo(Store.getProfile());
      })
      .catch(function () {
        limitedClaiming = false;
        limitedClaimError = 'Network error. Check your connection and try again.';
        renderInfo(Store.getProfile());
      });
  }

  function buildLimitedCta(wrap, profile, limited) {
    const note = function (text, isError) {
      const el = document.createElement('div');
      el.className = 'detail-cta-note' + (isError ? ' gift-cta-error' : '');
      el.textContent = text;
      wrap.appendChild(el);
    };
    if (limitedClaimedFlash) {
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'detail-cta gift-cta-claimed';
      done.disabled = true;
      done.innerHTML = CLAIM_CHECK_ICON + '<span>Claimed</span>';
      wrap.appendChild(done);
      note('Claimed. The cape is now in your account and in the Frost Client Launcher.');
      return wrap;
    }
    if (!limited.active) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'detail-cta cta-disabled';
      btn.disabled = true;
      btn.textContent = 'No longer available';
      wrap.appendChild(btn);
      note('This limited cape could be claimed until ' + formatDateTime(limited.until) + '.');
      return wrap;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-cta cta-buy';
    if (!(profile && profile.user)) {
      btn.textContent = 'Sign in to claim';
      btn.addEventListener('click', function () {
          Store.startLogin('store', '.c.' + cape.id);
      });
      wrap.appendChild(btn);
      note('Sign in with Discord so the cape can be added to your account.');
      return wrap;
    }
    if (limitedClaiming) {
      btn.classList.add('gift-cta-loading');
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="gift-cta-spinner" aria-hidden="true"></span><span>Claiming…</span>';
      btn.disabled = true;
    } else {
      btn.textContent = 'Claim';
      btn.addEventListener('click', claimLimited);
    }
    wrap.appendChild(btn);
    if (limitedClaimError) note(limitedClaimError, true);
    else note('Free for a limited time. Claim it before ' + formatDateTime(limited.until) + '.');
    return wrap;
  }

  function priceLabel() {
    const store = cape.store || {};
    if (store.subscription) return { text: store.subscription === 'annual' ? 'Annual Lite perk' : 'Lite perk', pill: store.subscription === 'annual' ? 'pill-annual' : 'pill-lite' };
    if (store.price === 0 || store.price === 'free') return { text: 'Free', pill: 'pill-free' };
    if (typeof store.price === 'number') {
      const sale = store.checkout ? Store.salePrice(cape) : null;
      return { text: '€' + store.price.toFixed(2), pill: null, original: sale ? '€' + sale.original.toFixed(2) : null, percent: sale ? sale.percent : 0 };
    }
    return { text: 'Coming soon', pill: 'pill-soon' };
  }

  const ICON_CART_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';
  const ICON_CART_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function buildAddToCart() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-cta cta-cart';
    const paint = function () {
      const added = Store.inCart(cape.id);
      btn.classList.toggle('is-added', added);
      const saved = added && !!Store.getLitePlan();
      btn.innerHTML = (added ? ICON_CART_DONE : ICON_CART_ADD) + '<span>' + (added ? (saved ? 'Saved for later' : 'In Cart') : 'Add to Cart') + '</span>';
    };
    paint();
    btn.addEventListener('click', function () {
      if (Store.inCart(cape.id)) {
        window.location.href = '/cart';
        return;
      }
      if (!Store.addToCart(cape.id)) {
        Store.showToast('Your cart is full (' + Store.cartMax + ' items). Check out first.');
        return;
      }
      if (Store.getLitePlan()) Store.showToast('Added to Saved for later. Capes are checked out separately from FrostClient Lite.');
      paint();
    });
    Store.onCart(paint);
    return btn;
  }

  function buildCta(profile) {
    const store = cape.store || {};
    const owned = isOwned(profile);
    const wrap = document.createElement('div');
    wrap.className = 'detail-cta-wrap';
    const limited = Store.limitedInfo(cape);
    if (limited && limited.free && limitedClaimedFlash) return buildLimitedCta(wrap, profile, limited);
    if (!profile && Store.loadToken() && !Store.isAuthSettled()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'detail-cta cta-buy';
      btn.disabled = true;
      btn.textContent = '· · ·';
      wrap.appendChild(btn);
      return wrap;
    }
    if (owned) {
      const btn = document.createElement('a');
      btn.className = 'detail-cta cta-buy';
      btn.href = 'frostclient://cape/' + encodeURIComponent(cape.id);
      btn.textContent = 'Equip';
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = 'Opens the Frost Client Launcher and equips this cape for you.';
      wrap.appendChild(note);
      return wrap;
    }
    if (limited && limited.free) return buildLimitedCta(wrap, profile, limited);
    if (store.subscription) {
      const isAnnual = store.subscription === 'annual';
      const btn = document.createElement('a');
      btn.className = 'detail-cta ' + (isAnnual ? 'cta-annual' : 'cta-lite');
      btn.href = 'https://frostclient.eu/lite' + (isAnnual ? '?billing=annual' : '');
      btn.textContent = isAnnual ? 'Subscribe to Annual Lite' : 'Subscribe to Lite';
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = isAnnual
        ? "This cape is exclusive to the Annual Lite plan — the monthly plan doesn't include it."
        : 'This cape is included with every FrostClient Lite subscription.';
      wrap.appendChild(note);
      return wrap;
    }
    if (store.price === 0 || store.price === 'free') {
      const btn = document.createElement('button');
      btn.className = 'detail-cta cta-disabled';
      btn.type = 'button';
      btn.disabled = true;
      btn.textContent = 'Free';
      wrap.appendChild(btn);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = 'Free cape — no purchase needed.';
      wrap.appendChild(note);
      return wrap;
    }
    if (store.checkout) {
      const loggedIn = !!(profile && profile.user);
      const row = document.createElement('div');
      row.className = 'detail-cta-row';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'detail-cta cta-buy';
      if (loggedIn) {
        btn.textContent = 'Buy Now';
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          btn.disabled = true;
          btn.classList.add('is-loading');
          Store.botPost('/store/cart-checkout', { capes: [cape.id], returnBase: window.location.origin }).then(function (data) {
            if (data && data.ok && data.checkoutUrl) {
              try {
                  localStorage.setItem('frostStorePendingCart', JSON.stringify({ cartId: data.cartId, capes: [cape.id], at: Date.now() }));
              } catch (e) {}
              window.location.href = data.checkoutUrl;
              return;
            }
            btn.disabled = false;
            btn.classList.remove('is-loading');
            if (data && data.error === 'token_expired') {
              Store.clearAuth();
              Store.startLogin('store');
              return;
            }
            Store.showToast(data && data.error === 'empty_cart' ? 'You already own this cape.' : "Checkout couldn't start. Please try again in a moment.");
          }).catch(function () {
            btn.disabled = false;
            btn.classList.remove('is-loading');
            Store.showToast('Network error. Please try again.');
          });
        });
      } else {
        btn.type = 'button';
        btn.textContent = 'Sign in to purchase';
        btn.addEventListener('click', function () {
            Store.startLogin('store');
        });
      }
      row.appendChild(btn);
      row.appendChild(buildAddToCart());
      wrap.appendChild(row);
      const note = document.createElement('div');
      note.className = 'detail-cta-note';
      note.textContent = loggedIn
        ? 'Checkout is handled securely by Whop. The cape unlocks right after your purchase.'
        : 'Sign in with Discord first so the cape can be linked to your account.';
      wrap.appendChild(note);
      return wrap;
    }
    const btn = document.createElement('button');
    btn.className = 'detail-cta cta-disabled';
    btn.type = 'button';
    btn.disabled = true;
    btn.textContent = 'Coming soon';
    wrap.appendChild(btn);
    return wrap;
  }

  function renderInfo(profile) {
    if (!cape) return;
    const store = cape.store || {};
    const owned = isOwned(profile);
    const price = priceLabel();
    info.innerHTML = '';
    const name = document.createElement('h1');
    name.className = 'detail-name';
    name.textContent = cape.name || cape.id;
    info.appendChild(name);
    const priceRow = document.createElement('div');
    priceRow.className = 'detail-price-row';
    if (owned) {
      const ownedText = document.createElement('span');
      ownedText.className = 'detail-price detail-price-owned';
      ownedText.textContent = 'OWNED';
      priceRow.appendChild(ownedText);
    } else if (price.pill) {
      const pill = document.createElement('span');
      pill.className = 'cape-price-pill ' + price.pill;
      pill.textContent = price.text.toUpperCase();
      priceRow.appendChild(pill);
    } else {
      const member = Store.memberPrice(cape, profile);
      const oldText = price.original || (member ? '€' + Number(store.price).toFixed(2) : '');
      if (oldText) {
        const old = document.createElement('s');
        old.className = 'detail-price-old';
        old.textContent = oldText;
        priceRow.appendChild(old);
      }
      const amount = document.createElement('span');
      amount.className = 'detail-price' + (member ? ' detail-price--member' : '');
      amount.textContent = member ? '€' + member.price.toFixed(2) : price.text;
      priceRow.appendChild(amount);
      if (member) {
        const tag = document.createElement('span');
        tag.className = 'detail-member-badge';
        tag.textContent = 'LITE -' + member.percent + '%';
        priceRow.appendChild(tag);
      }
      if (price.original) {
        const sale = document.createElement('span');
        sale.className = 'detail-sale-badge';
        sale.textContent = 'SALE -' + price.percent + '%';
        priceRow.appendChild(sale);
      }
    }
    if (Store.isPartnerCape(cape)) {
      const partner = document.createElement('span');
      partner.className = 'cape-partner-pill';
      partner.textContent = 'PARTNER';
      priceRow.appendChild(partner);
    }
    info.appendChild(priceRow);
    const variants = variantList();
    if (variants.length > 1) {
      const wrap = document.createElement('div');
      wrap.className = 'detail-variants';
      const label = document.createElement('div');
      label.className = 'detail-variants-label';
      label.textContent = 'Variants';
      if (cape.variantUnlock === true) {
        const note = document.createElement('span');
        note.className = 'detail-variants-note';
        note.textContent = 'Own one, unlock all';
        label.appendChild(note);
      }
      wrap.appendChild(label);
      const row = document.createElement('div');
      row.className = 'detail-variants-row';
      variants.forEach(function (v) {
        const a = document.createElement('a');
        a.className = 'detail-variant' + (v.id === cape.id ? ' is-current' : '');
        a.href = '/cape?id=' + encodeURIComponent(v.id);
        a.title = v.name || v.id;
        a.setAttribute('aria-label', (v.name || v.id) + (v.id === cape.id ? ' (selected)' : ''));
        if (v.id === cape.id) a.setAttribute('aria-current', 'page');
        const thumb = document.createElement('span');
        thumb.className = 'detail-variant-thumb';
        thumb.style.backgroundImage = 'url("' + Store.capesBase + String(v.file).split('/').map(encodeURIComponent).join('/') + '")';
        a.appendChild(thumb);
        const name = document.createElement('span');
        name.className = 'detail-variant-name';
        name.textContent = v.name || v.id;
        a.appendChild(name);
        row.appendChild(a);
      });
      wrap.appendChild(row);
      info.appendChild(wrap);
    }
    const col = (capeCollections || []).find(function (c) { return Store.collectionActive(c) && c.capes.indexOf(cape.id) !== -1; });
    if (col) {
      const link = document.createElement('a');
      link.className = 'detail-collection';
      link.href = 'collection?id=' + encodeURIComponent(col.id);
      const label = document.createElement('span');
      label.className = 'detail-collection-label';
      label.textContent = 'Part of a collection';
      const name = document.createElement('span');
      name.className = 'detail-collection-name';
      name.textContent = (col.name || col.id) + (Store.bundleLabel(col) ? ' · ' + Store.bundleLabel(col).toLowerCase() : '') + ' →';
      link.appendChild(label);
      link.appendChild(name);
      info.appendChild(link);
    }
    const meta = document.createElement('div');
    meta.className = 'detail-meta';
    const rows = [
      ['Release date', formatDate(store.releaseDate)],
      ['Animated', cape.animated ? 'Yes' : 'No']
    ];
    const limitedMeta = Store.limitedInfo(cape);
    if (limitedMeta) rows.push([limitedMeta.active ? 'Available until' : 'Ended', formatDateTime(limitedMeta.until)]);
    rows.forEach(function (pair) {
      const row = document.createElement('div');
      row.className = 'detail-meta-row';
      const label = document.createElement('span');
      label.className = 'detail-meta-label';
      label.textContent = pair[0];
      const value = document.createElement('span');
      value.className = 'detail-meta-value';
      value.textContent = pair[1];
      row.appendChild(label);
      row.appendChild(value);
      meta.appendChild(row);
    });
    info.appendChild(meta);
    if (store.description) {
      const desc = document.createElement('p');
      desc.className = 'detail-desc';
      desc.textContent = store.description;
      info.appendChild(desc);
    }
    info.appendChild(buildCta(profile));
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

  let animFrames = null;
  let animTimer = null;
  let animOn = true;
  let staticCapeUrl = null;

  function stopCapeAnimation() {
    if (animTimer) {
      clearTimeout(animTimer);
      animTimer = null;
    }
  }

  function applyCape(viewer, source) {
    try {
      const result = viewer.loadCape(source);
      if (result && result.catch) result.catch(function () {});
    } catch (err) {}
  }

  function playCapeAnimation(viewer) {
    if (!animFrames || animFrames.length < 2 || animTimer) return;
    let idx = 0;
    (function step() {
      const frame = animFrames[idx];
      idx = (idx + 1) % animFrames.length;
      // Redrawing straight into the viewer's own cape canvas (same approach as the launcher
      // wardrobe) - repeatedly calling viewer.loadCape(canvas) here silently stops updating
      // the rendered texture after the first frame, even though it doesn't throw.
      try {
        const ctx = viewer.capeCanvas.getContext('2d');
        ctx.clearRect(0, 0, viewer.capeCanvas.width, viewer.capeCanvas.height);
        ctx.drawImage(frame.canvas, 0, 0, viewer.capeCanvas.width, viewer.capeCanvas.height);
        if (viewer.capeTexture) viewer.capeTexture.needsUpdate = true;
      } catch (err) {}
      animTimer = setTimeout(step, frame.delay);
    })();
  }

  function buildAnimToggle(viewer) {
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
        playCapeAnimation(viewer);
      } else {
        stopCapeAnimation();
        if (staticCapeUrl) applyCape(viewer, staticCapeUrl);
      }
    });
    previewPanel.appendChild(btn);
  }

  function startCapeAnimation(viewer) {
    if (!cape.animated) return;
    decodeGifFrames(Store.capesBase + encodeURIComponent(cape.animated)).then(function (frames) {
      if (frames.length < 2) return;
      animFrames = frames;
      buildAnimToggle(viewer);
      if (animOn) playCapeAnimation(viewer);
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

  function startViewer() {
    if (viewerStarted || !cape || typeof skinview3d === 'undefined') return;
    viewerStarted = true;
    const canvas = document.createElement('canvas');
    previewPanel.appendChild(canvas);
    const size = Math.min(previewPanel.clientWidth || 460, 620);
    viewer = new skinview3d.SkinViewer({
      canvas: canvas,
      width: size,
      height: size,
      zoom: 0.9
    });
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
      fetchObjectUrl(Store.capesBase + encodeURIComponent(cape.file)).then(function (url) {
        staticCapeUrl = url;
        return viewer.loadCape(url);
      })
    ]).then(function () {
      const skeleton = document.getElementById('previewSkeleton');
      if (skeleton) skeleton.remove();
      const hint = document.getElementById('previewHint');
      if (hint) hint.hidden = false;
      skinMenuWrap.hidden = false;
      updateSkinMenuState();
      startCapeAnimation(viewer);
    }).catch(function () {
      viewerStarted = false;
      viewer = null;
      canvas.remove();
      const skeleton = document.getElementById('previewSkeleton');
      if (skeleton) skeleton.classList.remove('skeleton-shimmer');
    });
    window.addEventListener('resize', function () {
      const newSize = Math.min(previewPanel.clientWidth || 460, 620);
      viewer.setSize(newSize, newSize);
    });
  }

  if (!capeId) {
    showNotFound();
    return;
  }

  let catalogAll = [];
  let capeCollections = null;
  Store.loadCollections().then(function (list) {
    capeCollections = list;
    if (cape && document.getElementById('detailInfo')) renderInfo(Store.getProfile());
  });

  function storeVisible(c) {
    if (!c || !c.store || c.store.subscription || Store.isStoreHidden(c)) return false;
    const limited = Store.limitedInfo(c);
    return !(limited && !limited.active);
  }

  function variantList() {
    if (!cape || !cape.variantGroup) return [];
    return catalogAll.filter(function (c) {
        return c.variantGroup === cape.variantGroup && (c.id === cape.id || storeVisible(c));
    });
  }

  let similarCache = null;
  function findSimilar() {
    if (similarCache) return similarCache;
    const variantIds = variantList().map(function (v) { return v.id; });
    const pool = catalogAll.filter(function (c) {
      if (c.id === cape.id || variantIds.indexOf(c.id) !== -1 || !storeVisible(c)) return false;
      return cape.mature === true || c.mature !== true;
    });
    similarCache = Promise.all([Store.capeColors(cape)].concat(pool.map(function (c) { return Store.capeColors(c); }))).then(function (results) {
      const own = results[0] || [];
      return pool.map(function (c, i) {
        const colors = results[i + 1] || [];
        let score = 0;
        if (cape.mature === true && c.mature === true) score += 10;
        colors.forEach(function (col) {
            if (own.indexOf(col) === -1) return;
            const weight = ['black', 'gray', 'white'].indexOf(col) !== -1 ? 0.5 : 1;
            score += (own.indexOf(col) === 0 && colors.indexOf(col) === 0 ? 4 : 2) * weight;
        });
        if (score > 0 && Store.isPartnerCape(cape) && Store.isPartnerCape(c)) score += 1;
        if (score > 0 && !!cape.animated === !!c.animated) score += 0.5;
        return { cape: c, score: score, time: Store.releaseTime(c) || 0 };
      }).filter(function (x) { return x.score > 0; }).sort(function (a, b) {
          return b.score - a.score || b.time - a.time;
      }).slice(0, 6).map(function (x) { return x.cape; });
    });
    return similarCache;
  }

  function renderSimilar(profile) {
    findSimilar().then(function (list) {
      const section = document.getElementById('detailSimilar');
      const grid = document.getElementById('similarGrid');
      grid.innerHTML = '';
      list.forEach(function (c) {
          grid.appendChild(Store.buildCapeCard(c, profile));
      });
      section.hidden = list.length === 0;
    }).catch(function () {});
  }

  Store.fetchJsonWithRetry(Store.capesJsonUrl, { cache: 'no-store' }, 2)
    .then(function (data) {
      const catalog = Array.isArray(data) ? data : [];
      catalogAll = catalog;
      cape = catalog.find(function (c) {
          return c.id === capeId && c.store;
      }) || null;
      if (!cape) {
        showNotFound();
        return;
      }
      document.title = (cape.name || cape.id) + ' | Frost Store';
      renderInfo(Store.getProfile());
      Store.onProfile(function (profile) {
        renderInfo(profile);
        renderSimilar(profile);
      });
      startViewer();
    })
    .catch(function () {
        showNotFound();
    });
})();
