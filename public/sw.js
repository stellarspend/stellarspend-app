// Name of this cache. Change the version (e.g. v2) whenever you want to force
// users to drop old cached files, the activate step below deletes any other name.
const CACHE_NAME = 'stellarspend-v1';

// Files saved to the cache as soon as the service worker installs,
// so the basic app shell can load even when the user is offline.
const ASSETS_TO_CACHE = [
    '/',             // the home page
    '/favicon.ico',  // site icon
    '/globals.css',  // global styles
    '/vercel.svg',   // static image
];

// Install event: Precache static assets
// Runs once when a new version of the service worker is first installed
self.addEventListener('install', (event) => {
    // waitUntil keeps the worker in the "installing" state until caching finishes
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Precaching app shell');
            // addAll fetches every file in the list and stores it; if one fails, the whole install fails
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    // Force the waiting service worker to become the active service worker
    // (skips the usual wait until all old tabs are closed)
    self.skipWaiting();
});

// Activate event: Clean up old caches
// Runs when this version takes over from the previous one
self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Get the names of every cache this site has created
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete any cache that isn't the current version
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all open pages immediately
    // (otherwise pages already open would keep using the old worker until reloaded)
    self.clients.claim();
});

// Fetch event: Stale-While-Revalidate strategy
// Runs for every network request the page makes.
// Idea: show the cached copy instantly (fast), and quietly update the cache in the background.
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    // (POST/PUT/DELETE change data on the server and must never be served from cache)
    if (event.request.method !== 'GET') return;

    // respondWith lets us decide what response the page receives
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            // Look for a saved copy of this request
            return cache.match(event.request).then((cachedResponse) => {
                // Always start a network request in parallel to get a fresh copy
                const fetchedResponse = fetch(event.request)
                    .then((networkResponse) => {
                        // Update the cache with the fresh response
                        // (status 200 only, so error pages aren't saved)
                        if (networkResponse.status === 200) {
                            // clone() is needed because a response body can only be read once:
                            // one copy goes to the cache, the original goes to the page
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // If network fails, the cached response (if any) will be returned
                        console.log('[Service Worker] Network failed, serving from cache');
                    });

                // Return the cached copy right away if there is one;
                // otherwise wait for the network response
                return cachedResponse || fetchedResponse;
            });
        })
    );
});