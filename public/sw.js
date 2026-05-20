// public/sw.js - Service Worker للإشعارات
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activated');
    event.waitUntil(clients.claim());
});

// استقبال إشعارات Push
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    
    const options = {
        body: data.body || 'لديك إشعار جديد',
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: '📱 فتح التطبيق' },
            { action: 'close', title: '❌ إغلاق' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'معهد رعاية الضبعية', options)
    );
});

// التعامل مع الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
