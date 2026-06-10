/* Robotek Stock — service worker v9
 *
 * Key fix: on every new SW activation, calls client.navigate(url) on all
 * open tabs. This forces a hard reload FROM THE SW SIDE — it works even
 * when the old page has no JS listener for it. So any device running a
 * stale cached version will automatically get the new files the moment
 * the new SW activates, with zero action required from the user.
 */
var CACHE = "robotek-stock-v9";
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
    // 1. Delete all old caches
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
    })
    // 2. Take control of all open tabs immediately
    .then(function(){ return self.clients.claim(); })
    // 3. Force-reload every open tab so they get fresh HTML — works on ALL
    //    existing pages regardless of what JS version they're running.
    .then(function(){
      return self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(clients){
        return Promise.all(clients.map(function(client){
          return client.navigate(client.url);
        }));
      });
    })
  );
});

self.addEventListener("fetch", function(e){
  var url = e.request.url;
  // Never intercept Google Sheets or Apps Script calls — always network.
  if(url.indexOf("docs.google.com") !== -1 || url.indexOf("script.google.com") !== -1) return;

  if(e.request.method === "GET" && url.indexOf(self.location.origin) === 0){
    // HTML pages: network-first so new deploys reach users instantly.
    var isHtml = !url.match(/\.(png|jpg|jpeg|svg|webp|webmanifest|js|css|ico|woff2?)(\?|$)/);
    if(isHtml){
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
      // Static assets: cache-first (fast), falls back to network.
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
