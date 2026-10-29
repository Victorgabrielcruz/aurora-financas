/* Only static UI assets belong in Cache Storage. Authenticated API data uses owner-scoped IndexedDB. */
const CACHE='aurora-shell-__AURORA_BUILD__';
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const response=await fetch('/offline-assets.json',{cache:'no-store'});if(!response.ok)throw new Error('Offline assets unavailable');
 const manifest=await response.json();const cache=await caches.open(CACHE);
 await cache.addAll(['/','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/icon-maskable.png',...manifest.assets]);
 await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=(await caches.keys()).filter(key=>key.startsWith('aurora-shell-'));const keep=new Set([CACHE,...keys.filter(key=>key!==CACHE).slice(-1)]);await Promise.all(keys.filter(key=>!keep.has(key)).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api')||event.request.method!=='GET')return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>response.ok?response:caches.match('/')).catch(()=>caches.match('/')));return;}
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icon'))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}return response;})));
});
