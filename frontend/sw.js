/*
 * MCQCampus does not currently provide an offline service-worker feature.
 * Do not import executable code from an unverified third-party host.
 * Existing registrations are retired on activation.
 */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.registration.unregister());
});
