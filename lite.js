(function () {
  const Store = window.FrostStore;
  const signinBtn = document.getElementById('liteSigninBtn');
  const accountText = document.getElementById('liteAccountText');

  function renderAccount(profile) {
    const loggedIn = !!(Store.loadToken() && profile && profile.user);
    signinBtn.hidden = loggedIn;
    if (!loggedIn) {
      accountText.textContent = 'Sign in with Discord to check your subscription. Lite activates in the Frost Launcher, signed in with the same Discord account.';
      return;
    }
    const name = profile.user.name || profile.user.username || 'your account';
    accountText.textContent = profile.liteActive
      ? 'Lite is active on ' + name + '. Open the Frost Launcher, sign in with this Discord account and pick a Lite instance.'
      : 'Lite is not active on ' + name + ' yet. Pick a plan above and it unlocks right after checkout.';
  }

  signinBtn.addEventListener('click', function () {
      Store.startLogin('store');
  });
  Store.onProfile(renderAccount);

  function parseStars(s) {
    const m = /(\d)/.exec(String(s || ''));
    return m ? Number(m[1]) : 0;
  }

  function timestampOf(review) {
    const t = new Date(review.submittedAt || review.updatedAt || 0).getTime();
    return isNaN(t) ? 0 : t;
  }

  function buildReview(review) {
    const card = document.createElement('article');
    card.className = 'lite-review';
    const head = document.createElement('div');
    head.className = 'lite-review-head';
    const anon = !review.username || !review.avatar;
    if (anon) {
      const av = document.createElement('span');
      av.className = 'lite-review-avatar lite-review-avatar--anon';
      av.textContent = 'A';
      head.appendChild(av);
    } else {
      const img = document.createElement('img');
      img.className = 'lite-review-avatar';
      img.src = review.avatar;
      img.alt = '';
      img.loading = 'lazy';
      head.appendChild(img);
    }
    const col = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'lite-review-name';
    name.textContent = anon ? 'Anonymous' : review.username;
    col.appendChild(name);
    const stars = document.createElement('div');
    stars.className = 'lite-review-stars';
    const n = parseStars(review.lite === true && review.liteStars ? review.liteStars : review.stars);
    stars.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    stars.setAttribute('aria-label', n + ' out of 5 stars');
    col.appendChild(stars);
    head.appendChild(col);
    card.appendChild(head);
    const text = document.createElement('p');
    text.className = 'lite-review-text';
    text.textContent = review.comment || '';
    card.appendChild(text);
    return card;
  }

  const section = document.getElementById('liteReviews');
  const grid = document.getElementById('liteReviewsGrid');
  fetch('https://bot.frostclient.eu/reviews_export.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!Array.isArray(data)) return;
      const picked = data.filter(function (r) {
        return (r.booster === true || r.subscription === true) && r.comment
          && parseStars(r.lite === true && r.liteStars ? r.liteStars : r.stars) >= 3;
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
