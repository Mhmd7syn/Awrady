/**
 * Awrady Dashboard - Progressive Web App (PWA) Service Worker
 * Provides offline caching, lightning-fast app shell loading, and network resilience.
 */

const CACHE_NAME = "awrady-pwa-v2";

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

// Install Event: Precache App Shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[ServiceWorker] Precaching App Shell assets...");
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn("[ServiceWorker] Non-critical precache error:", err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up outdated cache versions
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log("[ServiceWorker] Removing legacy cache:", name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Cache-first for static local assets, Network-first for Cloud/API
self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    // Bypass cache for Cloud API / Supabase requests or non-GET requests
    if (event.request.method !== "GET" || 
        requestUrl.pathname.includes("/rest/v1/") ||
        requestUrl.hostname.includes("supabase.co") ||
        requestUrl.pathname.endsWith("/api/storage")) {
        return; // Normal network fetch
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch in background to keep cache fresh (stale-while-revalidate)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // Offline fallback for navigation requests
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html");
                }
            });
        })
    );
});
