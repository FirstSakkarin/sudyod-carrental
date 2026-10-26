// PWA: register the service worker and show an "ติดตั้งแอป" button when Android offers install.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  let deferred = null;
  const buttons = () => document.querySelectorAll('.pwa-install-btn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    buttons().forEach(b => (b.style.display = ''));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    buttons().forEach(b => (b.style.display = 'none'));
  });
  window.installPwa = async function () {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    buttons().forEach(b => (b.style.display = 'none'));
  };
})();
