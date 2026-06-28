self.addEventListener('push', (event) => {
  const fallbackPayload = {
    title: 'Amor Amar',
    body: 'You have a new notification.',
    icon: '/icons/Logo-black.png',
    badge: '/icons/Logo-black.png',
    url: '/dashboard',
  };

  const payload = event.data ? { ...fallbackPayload, ...event.data.json() } : fallbackPayload;
  const { title, ...options } = payload;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationUrl = event.notification.data?.url || event.notification.data?.path || event.notification.url || '/dashboard';
  const targetUrl = new URL(notificationUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url === targetUrl) {
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
