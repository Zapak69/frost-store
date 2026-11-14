(function () {
  const Store = window.FrostStore;
  const signinBtn = document.getElementById('liteSigninBtn');
  const accountText = document.getElementById('liteAccountText');
  const heroCta = document.getElementById('lpHeroCta');
  const heroMicro = document.getElementById('lpHeroMicro');
  const finalCta = document.getElementById('lpFinalCta');
  const heroTip = document.getElementById('lpHeroTip');
  const CANCEL_URL = 'https://frostclient.eu/lite/cancel';
  const DOWNLOAD_URL = 'https://frostclient.eu/?openDownload';

  function renderAccount(profile) {
    const loggedIn = !!(Store.loadToken() && profile && profile.user);
    const active = !!(profile && profile.liteActive);
    signinBtn.hidden = loggedIn;
    finalCta.hidden = active;
    if (active) {
      heroCta.textContent = 'Download the launcher';
      heroCta.href = DOWNLOAD_URL;
      heroMicro.innerHTML = '<a href="' + CANCEL_URL + '">Manage subscription</a>';
      heroTip.hidden = true;
    } else {
      heroCta.textContent = 'Try Lite free for 3 days';
      heroCta.href = '/cart';
      heroMicro.textContent = 'Free for 3 days, then €2.90 / month. Cancel anytime.';
      heroTip.hidden = false;
    }
    if (!loggedIn) {
      accountText.textContent = 'Sign in with Discord to check your subscription. Lite activates in the Frost Launcher, signed in with the same Discord account.';
      return;
    }
    const name = profile.user.name || profile.user.username || 'your account';
    accountText.textContent = active
      ? 'Lite is active on ' + name + '. Open the Frost Launcher, sign in with this Discord account and pick a Lite instance.'
      : 'Lite is not active on ' + name + ' yet. Start the free trial and it unlocks right after checkout.';
  }

  [heroCta, finalCta].forEach(function (el) {
    el.addEventListener('click', function () {
        if (el.getAttribute('href') === '/cart') Store.setLitePlan('monthly');
    });
  });
  const passBtn = document.getElementById('litePassBtn');
  if (passBtn) {
    passBtn.addEventListener('click', function () {
        Store.startPassCheckout(passBtn);
    });
  }
  const giftBtn = document.getElementById('liteGiftBtn');
  if (giftBtn) {
    giftBtn.addEventListener('click', function () {
        Store.startGiftCheckout([Store.giftLiteId], giftBtn);
    });
  }
  signinBtn.addEventListener('click', function () {
      Store.startLogin('store');
  });
  Store.onProfile(renderAccount);

  (function () {
    const deal = Store.liteSale('annual');
    const card = document.querySelector('.js-lite-plan[data-plan="annual"]');
    if (!deal || !card) return;
    const money = function (n) { return '€' + n.toFixed(2); };
    const plan = Store.litePlans.annual;
    const note = card.querySelector('.lp-plan-note');
    const amount = card.querySelector('.lp-plan-amount');
    const save = card.querySelector('.lp-plan-save');
    if (amount) amount.textContent = money(Math.floor(deal.price / 12 * 100) / 100);
    if (note) note.innerHTML = '<strong>' + money(deal.price) + '</strong> for the first year <s>' + money(plan.price) + '</s>';
    if (save) save.textContent = Store.sale.name + ' −' + deal.percent + '%';
    const bf = document.getElementById('lpBfNote');
    if (bf) {
      bf.textContent = Store.sale.name + ': ' + deal.percent + '% off the first year of the annual plan until 30 November, applied in the cart. Renews at ' + money(plan.price) + ' a year.';
      bf.hidden = false;
    }
  })();

  function parseStars(s) {
    const m = /(\d)/.exec(String(s || ''));
    return m ? Number(m[1]) : 0;
  }

  function hasFps(review) {
    const before = Number(review.fpsBefore);
    const after = Number(review.fpsAfter);
    return review.fpsBefore != null && review.fpsAfter != null
      && !isNaN(before) && !isNaN(after) && after > before;
  }

  function worseFps(review) {
    const before = Number(review.fpsBefore);
    const after = Number(review.fpsAfter);
    return review.fpsBefore != null && review.fpsAfter != null
      && !isNaN(before) && !isNaN(after) && after < before;
  }

  function timestampOf(review) {
    const t = new Date(review.submittedAt || review.updatedAt || 0).getTime();
    return isNaN(t) ? 0 : t;
  }

  function buildReview(review) {
    const card = document.createElement('article');
    card.className = 'lp-review';
    if (hasFps(review)) {
      const fps = document.createElement('div');
      fps.className = 'lp-review-fps';
      const before = document.createElement('span');
      before.textContent = Math.round(Number(review.fpsBefore)) + ' FPS';
      const after = document.createElement('strong');
      after.textContent = Math.round(Number(review.fpsAfter)) + ' FPS';
      fps.append(before, ' → ', after);
      card.appendChild(fps);
    }
    const text = document.createElement('p');
    text.className = 'lp-review-text';
    text.textContent = review.comment || '';
    card.appendChild(text);
    const head = document.createElement('div');
    head.className = 'lp-review-head';
    const anon = !review.username || !review.avatar;
    if (anon) {
      const av = document.createElement('span');
      av.className = 'lp-review-avatar lp-review-avatar--anon';
      av.textContent = 'A';
      head.appendChild(av);
    } else {
      const img = document.createElement('img');
      img.className = 'lp-review-avatar';
      img.src = review.avatar;
      img.alt = '';
      img.loading = 'lazy';
      head.appendChild(img);
    }
    const col = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'lp-review-name';
    name.textContent = anon ? 'Anonymous' : review.username;
    col.appendChild(name);
    const stars = document.createElement('div');
    stars.className = 'lp-review-stars';
    const n = parseStars(review.lite === true && review.liteStars ? review.liteStars : review.stars);
    stars.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    stars.setAttribute('aria-label', n + ' out of 5 stars');
    col.appendChild(stars);
    head.appendChild(col);
    card.appendChild(head);
    return card;
  }

  const section = document.getElementById('liteReviews');
  const grid = document.getElementById('liteReviewsGrid');
  fetch('https://api.frostclient.eu/reviews_export.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!Array.isArray(data)) return;
      const picked = data.filter(function (r) {
        const comment = String(r.comment || '').trim();
        return (r.booster === true || r.subscription === true) && comment.length >= 30
          && parseStars(r.lite === true && r.liteStars ? r.liteStars : r.stars) === 5
          && !worseFps(r) && !/(www\.|https?:|\.gg|\.com)/i.test(String(r.username || ''));
      }).sort(function (a, b) {
          return timestampOf(b) - timestampOf(a);
      }).slice(0, 4);
      if (!picked.length) return;
      picked.forEach(function (r) {
          grid.appendChild(buildReview(r));
      });
      section.hidden = false;
    })
    .catch(function () {
      section.hidden = true;
    });
})();
