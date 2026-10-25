(function () {
  const Store = window.FrostStore;
  const PAYMENT_ID_KEY = 'frostStorePaymentId';
  const CART_ID_KEY = 'frostStoreCartId';
  const PENDING_CART_KEY = 'frostStorePendingCart';
  const CART_POLL_TRIES = 10;
  const CART_POLL_MS = 3000;

  function storedCartId() {
    try {
        return sessionStorage.getItem(CART_ID_KEY) || '';
    } catch (e) {
        return '';
    }
  }

  function clearPurchasedFromCart(capes) {
    let pending = null;
    try {
        pending = JSON.parse(localStorage.getItem(PENDING_CART_KEY) || 'null');
        localStorage.removeItem(PENDING_CART_KEY);
    } catch (e) {
        pending = null;
    }
    const ids = (capes || []).map(function (c) { return c.id; }).concat(pending && Array.isArray(pending.capes) ? pending.capes : []);
    if (ids.length) Store.removeFromCart(ids);
    try {
      sessionStorage.removeItem(CART_ID_KEY);
      sessionStorage.removeItem(PAYMENT_ID_KEY);
    } catch (e) {}
  }

  function showCartSuccess(capes) {
    clearPurchasedFromCart(capes);
    Store.refreshProfile();
    const names = capes.map(function (c) { return c.name; });
    document.getElementById('successTitle').textContent = names.length === 1 ? names[0] + ' unlocked!' : names.length + ' cloaks unlocked!';
    const list = document.getElementById('successCapeList');
    if (list && names.length > 1) {
      list.textContent = names.join(', ');
      list.hidden = false;
    }
    const first = capes[0];
    if (first && (first.preview || first.file)) {
      const preview = document.getElementById('successCapePreview');
      if (first.preview) preview.classList.add('has-image');
      preview.style.backgroundImage = 'url(' + Store.capesBase + String(first.preview || first.file).split('/').map(encodeURIComponent).join('/') + ')';
      preview.hidden = false;
    }
    show('stateSuccess');
  }

  function pollCart(cartId, tries) {
    const token = Store.loadToken();
    if (!token) {
      show('stateLogin');
      return;
    }
    show('stateVerifying');
    Store.botPost('/store/cart-claim', { cartId: cartId, paymentId: storedPaymentId() })
      .then(function (data) {
        if (data && data.ok && data.status === 'fulfilled') {
          showCartSuccess(data.capes || []);
          return;
        }
        if (data && data.error === 'token_expired') {
          Store.clearAuth();
          show('stateLogin');
          return;
        }
        if (tries > 1) {
          setTimeout(function () {
              pollCart(cartId, tries - 1);
          }, CART_POLL_MS);
          return;
        }
        showError("We haven't received the payment from Whop yet. Give it a minute and try again — your cloaks unlock automatically once it arrives.");
      })
      .catch(function () {
          showError('Network error while contacting the server. Please try again.');
      });
  }
  const states = ['stateVerifying', 'stateLogin', 'stateSuccess', 'stateLite', 'stateLiteJoin', 'stateNoPayment', 'stateError'];

  function show(id) {
    states.forEach(function (s) {
      document.getElementById(s).classList.toggle('active', s === id);
    });
  }

  function showError(msg, detail) {
    document.getElementById('errorText').textContent = msg || "We couldn't verify your purchase. Please try again.";
    const detailEl = document.getElementById('errorDetail');
    detailEl.textContent = detail || '';
    show('stateError');
  }

  function storedPaymentId() {
    try {
        return sessionStorage.getItem(PAYMENT_ID_KEY) || '';
    } catch (e) {
        return '';
    }
  }
  const CLAIM_TRANSIENT = { busy: 1, rate_limited: 1, network_error: 1, upstream_error: 1, payment_not_paid: 1, whop_error: 1 };
  const CLAIM_RETRIES = 3;
  function claim(paymentId, attempt) {
    attempt = attempt || 0;
    const token = Store.loadToken();
    if (!token) {
      show('stateLogin');
      return;
    }
    show('stateVerifying');
    Store.fetchJsonWithRetry(Store.apiUrl + '?action=capeClaim&token=' + encodeURIComponent(token)
      + '&payment_id=' + encodeURIComponent(paymentId), { cache: 'no-store' }, 2)
      .then(function (data) {
        if (data && !data.ok && CLAIM_TRANSIENT[data.error] && attempt < CLAIM_RETRIES) {
          setTimeout(function () {
              claim(paymentId, attempt + 1);
          }, 2500 * (attempt + 1));
          return;
        }
        if (data && data.error === 'lite_purchase') {
          claimLite(paymentId, 0);
          return;
        }
        if (!data || !data.ok) {
          if (data && data.error === 'token_expired') {
            Store.clearAuth();
            show('stateLogin');
            return;
          }
          const messages = {
            store_not_configured: 'The store is not accepting purchases yet. Please contact support on Discord.',
            payment_not_found: "We couldn't find that purchase. Please try again or contact support.",
            payment_not_paid: 'This purchase is not marked as paid yet. Try again in a minute.',
            unknown_product: "This purchase doesn't match any cloak in the store. Please contact support.",
            already_claimed: 'This purchase was already claimed by a different Discord account.',
            whop_error: 'Whop could not be reached. Please try again.',
            not_lite_purchase: "This payment isn't a Frost Lite purchase.",
            subscription_inactive: "This subscription isn't active right now. If you just paid, wait a minute and try again.",
            busy: 'Our server is busy right now. Please try again in a minute.'
          };
          const trialUsed = data && data.error === 'subscription_inactive' && /trial_already_used/.test(String(data.detail || ''));
          showError(trialUsed ? 'A free trial was already used on this Discord account.' : (messages[data && data.error] || 'Something went wrong verifying your purchase.'), trialUsed ? '' : data && data.detail);
          return;
        }
        try {
            sessionStorage.removeItem(PAYMENT_ID_KEY);
        } catch (e) {}
        if (data.cart) {
          showCartSuccess(data.capes || []);
          return;
        }
        Store.refreshProfile();
        if (data.capeName) {
          document.getElementById('successTitle').textContent = data.capeName + ' unlocked!';
        }
        if (data.capePreview) {
          const preview = document.getElementById('successCapePreview');
          preview.classList.add('has-image');
          preview.style.backgroundImage = 'url(' + Store.capesBase + String(data.capePreview).split('/').map(encodeURIComponent).join('/') + ')';
          preview.hidden = false;
        } else if (data.capeFile) {
          const preview = document.getElementById('successCapePreview');
          preview.style.backgroundImage = 'url(' + Store.capesBase + encodeURIComponent(data.capeFile) + ')';
          preview.hidden = false;
        }
        show('stateSuccess');
      })
      .catch(function () {
          showError('Network error while contacting the server. Please try again.');
      });
  }

  function claimLite(paymentId, attempt) {
    const token = Store.loadToken();
    if (!token) {
      show('stateLogin');
      return;
    }
    show('stateVerifying');
    Store.fetchJsonWithRetry(Store.apiUrl + '?action=liteClaim&token=' + encodeURIComponent(token)
      + '&payment_id=' + encodeURIComponent(paymentId), { cache: 'no-store' }, 2)
      .then(function (data) {
        if (data && !data.ok && CLAIM_TRANSIENT[data.error] && attempt < CLAIM_RETRIES) {
          setTimeout(function () {
              claimLite(paymentId, attempt + 1);
          }, 2500 * (attempt + 1));
          return;
        }
        if (data && data.ok) {
          try {
              sessionStorage.removeItem(PAYMENT_ID_KEY);
          } catch (e) {}
          Store.refreshProfile();
          const annual = data.plan === 'annual';
          document.getElementById('liteLauncherBtn').className = 'detail-cta ' + (annual ? 'cta-annual' : 'cta-lite');
          document.getElementById('liteYearNote').hidden = !annual;
          document.getElementById('liteWelcome').classList.toggle('is-annual', annual);
          show('stateLite');
          return;
        }
        if (data && data.error === 'needs_guild_join') {
          show('stateLiteJoin');
          return;
        }
        if (data && data.error === 'token_expired') {
          Store.clearAuth();
          show('stateLogin');
          return;
        }
        const messages = {
          already_claimed_by_other: 'This purchase was already claimed by a different Discord account.',
          payment_not_found: "We couldn't find that purchase. Please try again or contact support.",
          payment_not_paid: 'This purchase is not marked as paid yet. Try again in a minute.',
          no_whop_user: "We couldn't find an account tied to this purchase.",
          role_grant_failed: "Discord wouldn't let us activate Lite. Please contact support.",
          whop_error: 'Whop could not be reached. Please try again.',
          subscription_inactive: "This subscription isn't active right now. If you just paid, wait a minute and try again.",
          busy: 'Our server is busy right now. Please try again in a minute.'
        };
        const trialUsed = data && data.error === 'subscription_inactive' && /trial_already_used/.test(String(data.detail || ''));
        showError(trialUsed ? 'A free trial was already used on this Discord account.' : (messages[data && data.error] || 'Something went wrong activating Lite.'), trialUsed || (data && data.error === 'busy') ? '' : data && data.detail);
      })
      .catch(function () {
          showError('Network error while contacting the server. Please try again.');
      });
  }

  document.getElementById('liteJoinBtn').addEventListener('click', function () {
    const paymentId = storedPaymentId();
    if (!paymentId) {
      show('stateNoPayment');
      return;
    }
    Store.startLogin('ty', '.p.' + paymentId, true);
  });

  document.getElementById('claimLoginBtn').addEventListener('click', function () {
    const paymentId = storedPaymentId();
    if (storedCartId()) {
      Store.startLogin('ty', '.k');
      return;
    }
    if (!paymentId) {
      show('stateNoPayment');
      return;
    }
    Store.startLogin('ty', '.p.' + paymentId, true);
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    const paymentId = storedPaymentId();
    if (storedCartId()) {
      pollCart(storedCartId(), CART_POLL_TRIES);
      return;
    }
    if (!paymentId) {
      show('stateNoPayment');
      return;
    }
    claim(paymentId);
  });

  (function init() {
    const params = new URLSearchParams(window.location.search);

    const incomingPaymentId = params.get('payment_id') || params.get('receipt_id') || '';
    const incomingCartId = /^[a-f0-9]{16}$/.test(params.get('cart') || '') ? params.get('cart') : '';
    if (incomingCartId) {
      try {
        sessionStorage.setItem(CART_ID_KEY, incomingCartId);
        if (incomingPaymentId) sessionStorage.setItem(PAYMENT_ID_KEY, incomingPaymentId);
      } catch (e) {}
      const cleanCartUrl = new URL(window.location.href);
      ['cart', 'receipt_id', 'payment_id', 'checkout_status', 'status', 'state_id'].forEach(function (k) {
          cleanCartUrl.searchParams.delete(k);
      });
      window.history.replaceState(null, '', cleanCartUrl.pathname + cleanCartUrl.search + cleanCartUrl.hash);
      pollCart(incomingCartId, CART_POLL_TRIES);
      return;
    }
    if (incomingPaymentId) {
      try {
          sessionStorage.setItem(PAYMENT_ID_KEY, incomingPaymentId);
      } catch (e) {}
      const cleanUrl = new URL(window.location.href);
      ['receipt_id', 'payment_id', 'checkout_status', 'status', 'state_id', 'cape', 'cart'].forEach(function (k) {
        cleanUrl.searchParams.delete(k);
      });
      window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      claim(incomingPaymentId);
      return;
    }

    const oauthReturn = Store.consumeOauthReturn();
    if (oauthReturn) {
      let paymentId = '';
      const pIdx = oauthReturn.state.indexOf('.p.');
      if (pIdx !== -1) paymentId = oauthReturn.state.slice(pIdx + 3);
      if (!paymentId) paymentId = storedPaymentId();
      const cartOnly = !!storedCartId();
      if (!paymentId && !cartOnly) {
        show('stateNoPayment');
        return;
      }
      show('stateVerifying');
      Store.exchangeCode(oauthReturn.code, 'ty')
        .then(function (data) {
          if (!data || !data.ok) {
            showError('Discord sign-in failed. Please try again.', data && data.detail);
            return;
          }
          if (storedCartId()) pollCart(storedCartId(), CART_POLL_TRIES);
          else claim(paymentId);
        })
        .catch(function () {
            showError('Network error during sign-in. Please try again.');
        });
      return;
    }

    if (storedCartId()) {
      pollCart(storedCartId(), CART_POLL_TRIES);
      return;
    }
    const cached = storedPaymentId();
    if (cached) {
      claim(cached);
      return;
    }
    show('stateNoPayment');
  })();
})();
