const CACHE_NAME = "youssef-nafea-shell-v1";
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
