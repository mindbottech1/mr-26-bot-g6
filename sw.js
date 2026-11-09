// Keeps the page available when the phone is offline. Always tries the internet first, so a new version of
// the page is picked up as soon as it is uploaded. Google Sheet requests (other site) are never touched.
const CACHE = "mr-shell-v3";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(r, { cache: "no-cache" }).then(res => {          // always check GitHub for a newer file (skips the 10-minute browser cache)
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(r, copy));
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match("./")))
  );
});

/* ---------- Push notifications (sent from the Apps Script through Firebase Cloud Messaging) ----------
   The script sends "data only" messages, so this handler always shows the notification itself. */
self.addEventListener("push", e => {
  let d = {};
  try{
    const j = e.data ? e.data.json() : {};
    d = j.data || j.notification || j || {};
  }catch(err){}
  const opts = {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: d.url || "./" }
  };
  if (d.tag){ opts.tag = d.tag; opts.renotify = true; }      // a new reminder replaces the old one instead of piling up
  e.waitUntil(self.registration.showNotification(d.title || "Medical Record", opts));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list){ if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
