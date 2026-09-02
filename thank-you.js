(function () {
  const Store = window.FrostStore;
  const PAYMENT_ID_KEY = 'frostStorePaymentId';
  const states = ['stateVerifying', 'stateLogin', 'stateSuccess', 'stateNoPayment', 'stateError'];

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
    try { return sessionStorage.getItem(PAYMENT_ID_KEY) || ''; } catch (e) { return ''; }
  }

  function claim(paymentId) {
    const token = Store.loadToken();
    if (!token) {
      show('stateLogin');
      return;
    }
    show('stateVerifying');
    Store.fetchJsonWithRetry(Store.apiUrl + '?action=capeClaim&token=' + encodeURIComponent(token)
      + '&payment_id=' + encodeURIComponent(paymentId), { cache: 'no-store' }, 2)
      .then(function (data) {
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
            unknown_product: "This purchase doesn't match any cape in the store. Please contact support.",
            already_claimed: 'This purchase was already claimed by a different Discord account.',
            whop_error: 'Whop could not be reached. Please try again.'
          };
          showError(messages[data && data.error] || 'Something went wrong verifying your purchase.', data && data.detail);
          return;
        }
        try { sessionStorage.removeItem(PAYMENT_ID_KEY); } catch (e) {}
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
      .catch(function () { showError('Network error while contacting the server. Please try again.'); });
  }

  document.getElementById('claimLoginBtn').addEventListener('click', function () {
    const paymentId = storedPaymentId();
    if (!paymentId) {
      show('stateNoPayment');
      return;
    }
    Store.startLogin('ty', '.p.' + paymentId);
  });

  document.getElementById('retryBtn').addEventListener('click', function () {
    const paymentId = storedPaymentId();
    if (!paymentId) {
      show('stateNoPayment');
      return;
    }
    claim(paymentId);
  });

  (function init() {
    const params = new URLSearchParams(window.location.search);

    const incomingPaymentId = params.get('payment_id') || params.get('receipt_id') || '';
    if (incomingPaymentId) {
      try { sessionStorage.setItem(PAYMENT_ID_KEY, incomingPaymentId); } catch (e) {}
      const cleanUrl = new URL(window.location.href);
      ['receipt_id', 'payment_id', 'checkout_status', 'status', 'state_id', 'cape'].forEach(function (k) {
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
      if (!paymentId) {
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
          claim(paymentId);
        })
        .catch(function () { showError('Network error during sign-in. Please try again.'); });
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
