/**
 * Awrady Dashboard - Progressive Web App (PWA) Service Worker
 * Provides offline caching, lightning-fast app shell loading, and network resilience.
 */

const CACHE_NAME = "awrady-pwa-v7";

const PRECACHE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./manifest.json",
    "./app-icon.ico",
    "./js/config/constants.js",
    "./js/config/default-data.js",
    "./js/utils/debounce.js",
    "./js/utils/date-utils.js",
    "./js/core/cloud-adapter.js",
    "./js/core/storage-engine.js",
    "./js/core/state-manager.js",
    "./js/core/schedule-migration.js",
    "./js/core/schedule-engine.js",
    "./js/core/scoring-engine.js",
    "./js/components/pomodoro.js",
    "./js/components/nawafel-toast.js",
    "./js/components/weekly-modal.js",
    "./js/components/daily-view.js",
    "./js/components/task-manager.js",
    "./js/components/category-manager.js",
    "./js/components/analytics-view.js",
    "./js/components/data-manager.js",
    "./js/components/security-lock.js",
    "./js/app.js"
];

// Install Event: Precache App Shell and activate immediately
self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[ServiceWorker] Precaching fresh assets for", CACHE_NAME);
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn("[ServiceWorker] Precache warning:", err);
            });
        })
    );
});

// Activate Event: Purge ALL older cache versions immediately
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log("[ServiceWorker] Purging outdated cache:", name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Network-first for HTML & dynamic scripts, Cache-fallback for offline
self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    // Bypass cache for Cloud API / Supabase requests or non-GET requests
    if (event.request.method !== "GET" || 
        requestUrl.pathname.includes("/rest/v1/") ||
        requestUrl.hostname.includes("supabase.co") ||
        requestUrl.pathname.endsWith("/api/storage")) {
        return; // Normal network fetch
    }

    // Network-first for navigation (index.html) and scripts to avoid stale deployments
    if (event.request.mode === "navigate" || requestUrl.pathname.endsWith(".html") || requestUrl.pathname.endsWith(".js") || requestUrl.search.includes("?v=")) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                });
            })
        );
        return;
    }

    // Cache-first for images, fonts, icons, sound effects
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});
