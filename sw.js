// SEOUL PATROL 서비스워커: 앱 파일을 미리 저장해 두고(설치형·오프라인), 새 버전이 올라오면 다음 실행 때 바꿔 끼운다.
// 네트워크 요청은 같은 폴더의 자기 파일뿐이다. 서버·외부 통신 없음.
var CACHE = 'tg-v0.10.105';
var V = '?v=' + CACHE.slice(5);   // 미리 저장 목록의 판 번호는 CACHE 에서 뽑는다(전엔 0.9.7 에 멈춰 있어 옛 파일을 저장했다)
var FILES = [
  './', './index.html', './manifest.json', './css/style.css' + V, './data/laws.json', './lib/three.min.js' + V, './lib/GLTFLoader.js' + V,
  './data/units.js' + V, './js/config.js' + V, './js/rng.js' + V, './js/save.js' + V, './js/simmode.js' + V, './js/perf.js' + V, './js/emblem.js' + V, './js/humans-data.js' + V, './js/humans.js' + V, './js/textures.js' + V, './js/audio.js' + V, './js/city.js' + V, './js/world.js' + V,
  './js/terrain.js' + V, './js/envmap.js' + V, './js/weather.js' + V, './js/signals.js' + V, './js/vehmesh.js' + V, './js/patrolev.js' + V, './js/vehicle.js' + V, './js/traffic.js' + V, './js/peds.js' + V, './js/character.js' + V, './js/vfx.js' + V, './js/response.js' + V, './js/junction.js' + V, './js/chase.js' + V, './js/incident.js' + V, './js/dispatch.js' + V, './js/intro.js' + V, './js/walker.js' + V, './js/qr.js' + V, './promo.html' + V, './js/promo.js' + V, './js/rail.js' + V, './js/enforcement.js' + V, './js/study.js' + V, './js/drunkproc.js' + V, './js/kidcourse.js' + V, './js/tot.js' + V, './js/bike.js' + V, './js/career.js' + V, './js/praise.js' + V, './js/cinema.js' + V, './js/inspect.js' + V, './js/crazy.js' + V, './js/heritage.js' + V, './js/here.js' + V, './data/heritage-seocho.json', './js/realbuild.js' + V, './js/schooltime.js' + V, './js/pop.js' + V, './js/risk.js' + V, './js/demand.js' + V, './js/replay.js' + V, './js/stopcam.js' + V, './js/firstshift.js' + V, './js/crew.js' + V, './js/campaign.js' + V, './js/metrics.js' + V, './js/story.js' + V, './js/director.js' + V, './js/daily.js' + V, './js/bloom.js' + V, './js/hood.js' + V, './js/dex.js' + V, './js/sharecard.js' + V, './js/signaltod.js' + V, './js/facil.js' + V, './js/warp.js' + V, './js/citydata.js' + V, './js/ontology.js' + V, './data/ontology-seocho.json', './js/jampuzzle.js' + V, './data/events-seocho.json', './data/traffic-vol-seocho.json', './data/cameras-seocho.json', './js/layers.js' + V, './js/brt.js' + V, './data/taas.json', './data/signal-tod-seocho.json', './data/maps/index.json', './data/maps/seocho.json', './data/maps/seocho-twin.json', './data/maps/seocho-twin-roads.json', './data/maps/seocho-warp-roads.json', './data/maps/seocho-full.json', './data/maps/seocho-full-roads.json', './data/maps/seocho-full-buildings.json', './data/taas-nodes-seocho.json', './data/taas-fatal-seocho.json', './data/taas-vuln-seocho.json', './data/maps/seocho-1to1.json', './data/maps/yangjae-1to1.json', './data/maps/yangjae-1to1-roads.json', './data/maps/yangjae-1to1-buildings.json', './data/maps/seocho-1to1-buildings.json', './data/maps/seoul-districts.json', './data/pop-seocho.json', './data/dong-seocho.json', './data/dong-near.json', './data/intersections-seocho.json', './data/schoolzone-seocho.json', './map2d.html', './data/incidents-seocho.json', './data/schooltime.json',
  './js/hud.js' + V, './js/hudpos.js' + V, './js/minimap.js' + V, './js/input.js' + V, './js/main.js' + V, './icon-192.png', './icon-512.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k.indexOf('tg-v') === 0 && k !== CACHE; })   // v0.10.104 자기 판 저장소(tg-v…)만 지운다 — 같은 도메인의 T-Book(gtw-app-v2)·데이터 압축지도(dm-v…)·바탕 조각(tg-tiles) 저장소를 지우지 않게
    .map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// v0.10.90 데이터 압축지도 바탕 조각(data/base/t/) — 판과 상관없는 보관함 tg-tiles 에 두고 먼저 꺼낸다(주소의 ?b= 가 굽은 때라 내용이 바뀌면 주소도 바뀐다)
var TILES = 'tg-tiles';
// 네트워크 우선(새 버전 반영), 실패하면 캐시(오프라인)
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('/data/base/t/') >= 0) {
    e.respondWith(caches.open(TILES).then(function (c) { return c.match(e.request).then(function (hit) { return hit || fetch(e.request).then(function (res) { if (res.ok) c.put(e.request, res.clone()); return res; }); }); }));
    return;
  }
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (res) {
    var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return res;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
