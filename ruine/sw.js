var CACHE='ruine-v1';
var FILES=[
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/canvas.js',
  './js/globals.js',
  './js/init.js',
  './js/placement.js',
  './js/combat.js',
  './js/shop.js',
  './js/world.js',
  './js/ai.js',
  './js/render.js',
  './js/game.js',
  './images/desert1.jpg',
  './images/desert2.jpg',
  './images/grass1.jpg',
  './images/grass2.jpg',
  './images/stone.jpg'
];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES);}));
  self.skipWaiting();
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }));
  self.clients.claim();
});

self.addEventListener('fetch',function(e){
  e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request);}));
});
