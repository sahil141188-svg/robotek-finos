/* Robotek Stock — service worker (offline app shell, always-fresh stock) */
var CACHE = "robotek-stock-v6";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var url = e.request.url;
  // Never cache the live stock data or order logging — always go to network.
  if(url.indexOf("docs.google.com") !== -1 || url.indexOf("script.google.com") !== -1) return;
  // Same-origin app shell: cache-first, fall back to network.
  if(e.request.method === "GET" && url.indexOf(self.location.origin) === 0){
    e.respondWith(
      caches.match(e.request).then(function(hit){
        return hit || fetch(e.request).then(function(res){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
          return res;
        }).catch(function(){ return caches.match("./index.html"); });
      })
    );
  }
});
