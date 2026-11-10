// 한글 문서 뷰어 서비스 워커: 오프라인 실행 + 공유받은 파일 전달
const CACHE = "hwpv-app-v1";
const SHARE = "hwpv-share";
const APP = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // 카카오톡 등에서 "공유"로 넘어온 파일
  if (e.request.method === "POST" && url.pathname.endsWith("/share")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get("file");
        if (file && file.size) {
          const c = await caches.open(SHARE);
          await c.put("shared-file", new Response(file, {
            headers: { "X-File-Name": encodeURIComponent(file.name || "공유받은 문서.hwp") }
          }));
        }
      } catch (err) { /* 페이지에서 안내 */ }
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // 앱 화면은 네트워크 우선(업데이트 반영), 실패하면 저장본
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html")))
  );
});
