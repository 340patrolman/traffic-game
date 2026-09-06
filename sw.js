// 순찰길 서비스워커: 앱 파일을 미리 저장해 두고(설치형·오프라인), 새 버전이 올라오면 다음 실행 때 바꿔 끼운다.
// 네트워크 요청은 같은 폴더의 자기 파일뿐이다. 서버·외부 통신 없음.
var CACHE = 'tg-v0.4.0';
var FILES = [
  './', './index.html', './manifest.json', './css/style.css', './data/laws.json', './lib/three.min.js',
  './js/config.js', './js/rng.js', './js/save.js', './js/perf.js', './js/textures.js', './js/audio.js', './js/city.js', './js/world.js',
  './js/terrain.js', './js/signals.js', './js/vehmesh.js', './js/vehicle.js', './js/traffic.js', './js/peds.js', './js/enforcement.js',
  './js/hud.js', './js/minimap.js', './js/input.js', './js/main.js', './icon-192.png', './icon-512.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// 네트워크 우선(새 버전 반영), 실패하면 캐시(오프라인)
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
