(function () {
  let hasAccess = false;
  try { hasAccess = localStorage.getItem('storeAccess') === 'true'; } catch (e) {}

  const onComingSoon = /(^|\/)coming-soon\.html$/.test(location.pathname);

  if (hasAccess && onComingSoon) {
    location.replace('index');
  } else if (!hasAccess && !onComingSoon) {
    location.replace('coming-soon');
  }
})();
