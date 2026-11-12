const CACHE_NAME = "youssef-nafea-shell-v2";
const APP_SCOPE = "/youssef-nafea/";
const FALLBACK_URL = APP_SCOPE + "dashboard.html";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("youssef-nafea-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});


/*
 * Conservative cache policy:
 * - HTML navigations: network-first, with a cached offline fallback.
 * - Same-origin static assets: stale-while-revalidate.
 * - Supabase/API, cross-origin requests, POSTs and non-GET requests: never cached.
 */
const STATIC_ASSET = /\.(?:css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf)$/i;
const MAX_STATIC_ENTRIES = 100;

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_STATIC_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_STATIC_ENTRIES).map(key => cache.delete(key)));
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return;
  if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/auth/v1/") ||
      url.pathname.includes("/storage/v1/") || url.pathname.includes("/functions/v1/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic" &&
            !/\bno-store\b/i.test(response.headers.get("Cache-Control") || "")) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return (await cache.match(request)) ||
          (await cache.match(FALLBACK_URL)) ||
          Response.error();
      }
    })());
    return;
  }

  if (!STATIC_ASSET.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const refresh = fetch(request).then(async response => {
      if (response && response.ok && response.type === "basic" &&
          !/\bno-store\b/i.test(response.headers.get("Cache-Control") || "")) {
        await cache.put(request, response.clone());
        await trimStaticCache(cache);
      }
      return response;
    }).catch(() => null);
    return cached || (await refresh) || Response.error();
  })());
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: "منصة د. يوسف نافع", body: event.data ? event.data.text() : "لديك إشعار جديد." }; }

  const title = String(data.title || "إشعار جديد من منصة د. يوسف نافع").slice(0, 160);
  const options = {
    body: String(data.body || "اضغط لعرض التفاصيل.").slice(0, 240),
    icon: APP_SCOPE + "android-chrome-192x192.png",
    badge: APP_SCOPE + "favicon-32x32.png",
    tag: String(data.tag || "youssef-nafea-notification"),
    renotify: false,
    data: { url: data.url || FALLBACK_URL, notificationId: data.notificationId || null },
    dir: "rtl",
    lang: "ar",
    timestamp: Date.now(),
    vibrate: [120, 60, 120],
    actions: [{ action: "open", title: "عرض التفاصيل" }]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const rawUrl = event.notification.data && event.notification.data.url;
  let target = FALLBACK_URL;
  try {
    const parsed = new URL(rawUrl || FALLBACK_URL, self.location.origin);
    if (parsed.origin === self.location.origin && parsed.pathname.startsWith(APP_SCOPE)) target = parsed.href;
  } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin + APP_SCOPE) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

self.addEventListener("notificationclose", event => {
  // Reserved for optional notification analytics; no student data is collected here.
});
