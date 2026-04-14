self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
});

self.addEventListener('fetch', (event) => {
  // Necessário para o navegador considerar o PWA válido
  event.respondWith(fetch(event.request));
});