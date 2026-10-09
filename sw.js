// 서비스 워커 — 페이지는 항상 네트워크에서 새로 받고(데이터가 매일 바뀜), 연결이 끊겼을 때만 오프라인 안내를 보여준다.
const CACHE = "screener-offline-v1";
const OFFLINE_URL = new URL("offline.html", self.location).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// GitHub Pages 는 max-age=600 이라 그냥 fetch 하면 배포 뒤에도 10분까지 옛 화면이 나온다(앱에서 특히 눈에 띔).
// 그래서 페이지와 화면 이동용 데이터(.txt, RSC)는 서버에 매번 바뀌었는지 확인한다(no-cache = 재검증, 안 바뀌었으면 304).
const fresh = (req) => fetch(req.url, { cache: "no-cache", credentials: "same-origin", headers: req.headers });

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // /picks → /picks/ 같은 리디렉션 응답은 페이지 이동에 그대로 못 쓰므로 주소를 바꿔 다시 이동시킨다
    const page = fresh(req).then((res) => (res.redirected ? Response.redirect(res.url, 302) : res));
    event.respondWith(page.catch(() => caches.match(OFFLINE_URL)));
  } else if (req.headers.get("RSC") || new URL(req.url).pathname.endsWith(".txt")) {
    event.respondWith(fresh(req).catch(() => fetch(req)));
  }
});
