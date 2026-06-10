/* Robotek Stock — service worker (offline app shell, always-fresh stock) */
var CACHE = "robotek-stock-v8";
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
    }).then(function(){
      return self.clients.claim();
    }).then(function(){
      // Tell all open tabs to reload so they get the new cached version immediately.
      // This is the key fix for "stuck on loading after deploy".
      return self.clients.matchAll({type:"window"}).then(function(clients){
        clients.forEach(function(client){ client.postMessage({type:"SW_UPDATED"}); });
      });
    })
  );
});

self.addEventListener("fetch", function(e){
  var url = e.request.url;
  // Never cache the live stock data or order logging — always go to network.
  if(url.indexOf("docs.google.com") !== -1 || url.indexOf("script.google.com") !== -1) return;
  // Same-origin app shell: network-first for HTML (so updates deploy instantly),
  // cache-first for other assets (JS, CSS, images).
  if(e.request.method === "GET" && url.indexOf(self.location.origin) === 0){
    var isHtml = url.endsWith("/") || url.endsWith(".html") || url.indexOf("/stock") !== -1 && !url.match(/\.(png|jpg|svg|webmanifest|js|css)$/);
    if(isHtml){
      // Network-first for HTML — always try to get latest, fall back to cache
      e.respondWith(
        fetch(e.request).then(function(res){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
          return res;
        }).catch(function(){
          return caches.match(e.request) || caches.match("./index.html");
        })
      );
    } else {
      // Cache-first for assets
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
  }
});
