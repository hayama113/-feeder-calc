const CACHE_NAME = 'asr-pwa-prototype-v0.1.0';
const ASSETS = ['./','./index.html','./css/style.css','./js/main.js','./js/data.js','./js/storage.js','./js/i18n.js','./js/sound.js','./js/tyres.js','./js/qualifying.js','./js/race.js','./js/awards.js','./js/ranking.js','./manifest.webmanifest','./assets/icons/asr-icon-192.png','./assets/icons/asr-icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', event => { if(event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
