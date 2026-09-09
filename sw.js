// SEOUL PATROL 서비스워커: 앱 파일을 미리 저장해 두고(설치형·오프라인), 새 버전이 올라오면 다음 실행 때 바꿔 끼운다.
// 네트워크 요청은 같은 폴더의 자기 파일뿐이다. 서버·외부 통신 없음.
var CACHE = 'tg-v0.8.6';
var FILES = [
  './', './index.html', './manifest.json', './css/style.css?v=0.8.6', './data/laws.json', './lib/three.min.js?v=0.8.6',
  './js/config.js?v=0.8.6', './js/rng.js?v=0.8.6', './js/save.js?v=0.8.6', './js/perf.js?v=0.8.6', './js/textures.js?v=0.8.6', './js/audio.js?v=0.8.6', './js/city.js?v=0.8.6', './js/world.js?v=0.8.6',
  './js/terrain.js?v=0.8.6', './js/weather.js?v=0.8.6', './js/signals.js?v=0.8.6', './js/vehmesh.js?v=0.8.6', './js/vehicle.js?v=0.8.6', './js/traffic.js?v=0.8.6', './js/peds.js?v=0.8.6', './js/character.js?v=0.8.6', './js/vfx.js?v=0.8.6', './js/response.js?v=0.8.6', './js/junction.js?v=0.8.6', './js/chase.js?v=0.8.6', './js/walker.js?v=0.8.6', './js/qr.js?v=0.8.6', './promo.html?v=0.8.6', './js/promo.js?v=0.8.6', './js/rail.js?v=0.8.6', './js/enforcement.js?v=0.8.6', './js/study.js?v=0.8.6',
  './js/hud.js?v=0.8.6', './js/minimap.js?v=0.8.6', './js/input.js?v=0.8.6', './js/main.js?v=0.8.6', './icon-192.png', './icon-512.png'
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
