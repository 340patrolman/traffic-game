// SEOUL PATROL 서비스워커: 앱 파일을 미리 저장해 두고(설치형·오프라인), 새 버전이 올라오면 다음 실행 때 바꿔 끼운다.
// 네트워크 요청은 같은 폴더의 자기 파일뿐이다. 서버·외부 통신 없음.
var CACHE = 'tg-v0.9.66';
var V = '?v=' + CACHE.slice(5);   // 미리 저장 목록의 판 번호는 CACHE 에서 뽑는다(전엔 0.9.7 에 멈춰 있어 옛 파일을 저장했다)
var FILES = [
  './', './index.html', './manifest.json', './css/style.css' + V, './data/laws.json', './lib/three.min.js' + V,
  './js/config.js' + V, './js/rng.js' + V, './js/save.js' + V, './js/perf.js' + V, './js/emblem.js' + V, './js/textures.js' + V, './js/audio.js' + V, './js/city.js' + V, './js/world.js' + V,
  './js/terrain.js' + V, './js/weather.js' + V, './js/signals.js' + V, './js/vehmesh.js' + V, './js/vehicle.js' + V, './js/traffic.js' + V, './js/peds.js' + V, './js/character.js' + V, './js/vfx.js' + V, './js/response.js' + V, './js/junction.js' + V, './js/chase.js' + V, './js/incident.js' + V, './js/dispatch.js' + V, './js/intro.js' + V, './js/walker.js' + V, './js/qr.js' + V, './promo.html' + V, './js/promo.js' + V, './js/rail.js' + V, './js/enforcement.js' + V, './js/study.js' + V, './js/drunkproc.js' + V, './js/kidcourse.js' + V, './js/career.js' + V, './js/signaltod.js' + V, './js/facil.js' + V, './js/layers.js' + V, './data/taas.json', './data/signal-tod-seocho.json', './data/maps/index.json', './data/maps/seocho.json', './data/maps/seocho-twin.json', './data/taas-nodes-seocho.json', './data/taas-fatal-seocho.json', './data/taas-vuln-seocho.json',
  './js/hud.js' + V, './js/hudpos.js' + V, './js/minimap.js' + V, './js/input.js' + V, './js/main.js' + V, './icon-192.png', './icon-512.png'
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
