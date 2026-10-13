// Minimal service worker so the app can be installed to the home screen.
// Push alerts will be added here later.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* network as normal */ });
