// Service Worker for POROMODO PWA
// Handles caching and offline functionality

const CACHE_NAME = 'poromodo-v1.0.0';
const STATIC_CACHE_NAME = 'poromodo-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'poromodo-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    // Add icon paths when available
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static files...');
                return cache.addAll(STATIC_FILES.map(url => {
                    return new Request(url, { cache: 'reload' });
                }));
            })
            .then(() => {
                console.log('Service Worker: Static files cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.log('Service Worker: Error caching static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip external URLs
    if (url.origin !== location.origin) {
        return;
    }
    
    // Handle static files
    if (STATIC_FILES.some(staticFile => url.pathname === staticFile || url.pathname === staticFile.substring(1))) {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) {
                        console.log('Service Worker: Serving from cache:', request.url);
                        return response;
                    }
                    
                    console.log('Service Worker: Fetching from network:', request.url);
                    return fetch(request)
                        .then(fetchResponse => {
                            // Cache successful responses
                            if (fetchResponse.status === 200) {
                                const responseClone = fetchResponse.clone();
                                caches.open(STATIC_CACHE_NAME)
                                    .then(cache => {
                                        cache.put(request, responseClone);
                                    });
                            }
                            return fetchResponse;
                        });
                })
                .catch(() => {
                    // If both cache and network fail, return offline page for HTML
                    if (request.headers.get('accept').includes('text/html')) {
                        return caches.match('/index.html');
                    }
                })
        );
        return;
    }
    
    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(request)
            .then(response => {
                if (response) {
                    console.log('Service Worker: Serving from cache:', request.url);
                    return response;
                }
                
                console.log('Service Worker: Fetching from network:', request.url);
                return fetch(request)
                    .then(fetchResponse => {
                        // Don't cache errors or non-successful responses
                        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                            return fetchResponse;
                        }
                        
                        // Cache dynamic content
                        const responseClone = fetchResponse.clone();
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseClone);
                            });
                        
                        return fetchResponse;
                    })
                    .catch(error => {
                        console.log('Service Worker: Network request failed:', error);
                        
                        // Return cached version if available
                        return caches.match(request);
                    });
            })
    );
});

// Handle background sync (if needed in future)
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Handle push notifications (if needed in future)
self.addEventListener('push', event => {
    console.log('Service Worker: Push received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'Time to take a break!',
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-192x192.svg',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open POROMODO',
                icon: '/icons/icon-192x192.svg'
            },
            {
                action: 'close',
                title: 'Close notification',
                icon: '/icons/icon-192x192.svg'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('POROMODO', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.matchAll()
                .then(clientList => {
                    for (const client of clientList) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    }
});

// Background sync function (placeholder for future features)
async function doBackgroundSync() {
    console.log('Service Worker: Performing background sync...');
    // This could sync session data to a server when online
    // For now, it's just a placeholder
    return Promise.resolve();
}

// Cache management utilities
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            })
        );
    }
});

console.log('Service Worker: Loaded successfully'); 