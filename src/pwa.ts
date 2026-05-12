import { registerSW } from 'virtual:pwa-register';

function shouldDisableServiceWorker(): boolean {
  return new URLSearchParams(window.location.search).get('nosw') === '1';
}

async function unregisterServiceWorker(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  } catch (error) {
    console.warn('[pwa] Failed to unregister service worker', error);
  }
}

if (shouldDisableServiceWorker()) {
  void unregisterServiceWorker();
} else {
  // Register immediately so first-session reloads are SW-controlled without
  // requiring a manual second navigation.
  registerSW({ immediate: true });
}
