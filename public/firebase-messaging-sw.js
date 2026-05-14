/* eslint-disable no-undef */

// Import Firebase compat (service worker richiede compat)
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Config Firebase (PUBBLICA - è corretto così)
firebase.initializeApp({
  apiKey: "AIzaSyByyB0GONVamoWipDhSesfszfUwULMbJaY",
  authDomain: "beatcave-studio-f3c64.firebaseapp.com",
  projectId: "beatcave-studio-f3c64",
  storageBucket: "beatcave-studio-f3c64.firebasestorage.app",
  messagingSenderId: "82492460432",
  appId: "1:82492460432:web:4d02045a03cfb5c4f2b715"
});

const messaging = firebase.messaging();

// Gestione notifiche in background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload?.notification?.title || "Nuova notifica";
  const notificationOptions = {
    body: payload?.notification?.body || "",
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload?.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click sulla notifica (apre app)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
