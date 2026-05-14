importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyByyB0GONVamoWipDhSesfszfUwULMbJaY",
  authDomain: "beatcave-studio-f3c64.firebaseapp.com",
  projectId: "beatcave-studio-f3c64",
  storageBucket: "beatcave-studio-f3c64.firebasestorage.app",
  messagingSenderId: "82492460432",
  appId: "1:82492460432:web:4d02045a03cfb5c4f2b715"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
  });
});
