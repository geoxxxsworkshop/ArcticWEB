// sw.js - ArcticWEB Service Worker
self.addEventListener('install', (e) => {
  console.log('ArcticWEB Service Worker asennettu!');
});

self.addEventListener('fetch', (e) => {
  // Tähän voi myöhemmin lisätä välimuistitallennuksen (caching)
});
