/* Robotek Stock — service worker v34
 * SELF-DESTRUCT: wipes all caches, unregisters itself, force-reloads all tabs.
 * This guarantees every device gets fresh HTML from the network,
 * even if the previously cached page had a JS crash.
 */
var CACHE = "robotek-stock-v34";

self.addEventListener("install", function(e){
  self.skipWaiting();
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    // 1. Delete every cache entry
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return caches.delete(k); }));
    })
    // 2. Take control of all open tabs
    .then(function(){ return self.clients.claim(); })
    // 3. Force every open tab to navigate to a cache-busted URL
    //    The ?v=10 query param means the SW (if still active) won't find
    //    a cache match and must fetch fresh from the network.
    .then(function(){
      return self.clients.matchAll({type:"window", includeUncontrolled:true});
    })
    .then(function(clients){
      return Promise.all(clients.map(function(client){
        var url = client.url.split("?")[0] + "?v=23";
        return client.navigate(url);
      }));
    })
    // 4. Unregister this SW so future loads go straight to network — no more cache issues
    .then(function(){
      return self.registration.unregister();
    })
  );
});

// Fetch handler: pass everything through to the network — no caching at all
self.addEventListener("fetch", function(){ /* passthrough */ });
