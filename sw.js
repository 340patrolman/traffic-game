// SEOUL PATROL 서비스워커: 앱 파일을 미리 저장해 두고(설치형·오프라인), 새 버전이 올라오면 다음 실행 때 바꿔 끼운다.
// 네트워크 요청은 같은 폴더의 자기 파일뿐이다. 서버·외부 통신 없음.
var CACHE = 'tg-v0.8.2';
var FILES = [
  './', './index.html', './manifest.json', './css/style.css?v=0.8.2', './data/laws.json', './lib/three.min.js?v=0.8.2',
  './js/config.js?v=0.8.2', './js/rng.js?v=0.8.2', './js/save.js?v=0.8.2', './js/perf.js?v=0.8.2', './js/textures.js?v=0.8.2', './js/audio.js?v=0.8.2', './js/city.js?v=0.8.2', './js/world.js?v=0.8.2',
  './js/terrain.js?v=0.8.2', './js/weather.js?v=0.8.2', './js/signals.js?v=0.8.2', './js/vehmesh.js?v=0.8.2', './js/vehicle.js?v=0.8.2', './js/traffic.js?v=0.8.2', './js/peds.js?v=0.8.2', './js/character.js?v=0.8.2', './js/vfx.js?v=0.8.2', './js/response.js?v=0.8.2', './js/junction.js?v=0.8.2', './js/walker.js?v=0.8.2', './js/qr.js?v=0.8.2', './promo.html?v=0.8.2', './js/promo.js?v=0.8.2', './js/rail.js?v=0.8.2', './js/enforcement.js?v=0.8.2', './js/study.js?v=0.8.2',
  './js/hud.js?v=0.8.2', './js/minimap.js?v=0.8.2', './js/input.js?v=0.8.2', './js/main.js?v=0.8.2', './icon-192.png', './icon-512.png'
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
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (res) {
    var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
