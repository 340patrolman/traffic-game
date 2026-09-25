// 🚓 순찰차 제원·물리 — **단일 원천**(ROADMAP B1). 게임 물리(vehicle.js)와 화면 제원(차량 선택 카드)이 모두 이 파일만 읽는다.
//  JSON 이 아니라 스크립트인 까닭: file:// 로 열면 브라우저가 fetch 를 막는다(laws.json 은 그래서 「확인 중」이 된다) — 물리값은 빠지면 안 된다.
//  js/config.js 보다 **먼저** 불러야 한다(TG.CONFIG.CARS 가 여기서 온다).
//  값마다 출처를 적는다: verified:true = 1차 출처와 대조함 · false = 게임 설계값이거나 1차 출처 대조 전.
//  실존 차명은 2026-09-25 소유자 지시로 쓸 수 있다. 대신 **사실과 상상을 구분**한다 — real:true 는 실제로 순찰차로 운용 중인 차종,
//  real:false 는 게임이 상상으로 올린 등급이다. 제조사 로고·엠블럼은 여전히 그리지 않고, 제원은 대조 전이면 그렇게 적는다.
window.TG = window.TG || {};
TG.UNITS = (function () {
  var UNITS = [
    {
      id: 'sedan', name: '쏘나타 순찰차(중형)', powertrain: 'ice', desc: '내연기관 · 낮은 무게중심 · 코너 한계 높음 · 가장 흔한 순찰차', unlock: 0, real: true,
      // 게임 물리(단위 m, m/s, m/s²). latMax: 교차로 우회전(R≈8m)이 30km/h 는 여유, 40km/h 는 아슬아슬하도록 잡은 아케이드 튜닝
      phys: { w: 1.85, l: 4.7, maxSpeed: 36, sportMax: 42, accel: 7.0, brake: 8.5, latMax: 10.5, steerMax: 0.62, wheelbase: 2.75, grip: 12, revMax: 4.5 },
      spec: [
        { k: '최고속도(노멀/스포츠)', v: '130 / 151 km/h', source: '게임 설계값', verified: false },
        { k: '구동', v: '내연기관', source: '게임 설계값', verified: false }
      ]
    },
    {
      id: 'hsuv', name: '넥쏘 순찰차(수소 SUV)', powertrain: 'ev', desc: '수소 연료전지 · 조용하고 꾸준한 힘 · 무게가 있어 제동거리가 길다', unlock: 1, real: true,
      // 수소 연료전지는 전기 구동이라 물리는 ev 곡선을 쓴다. 배터리 전기차보다 순간 가속이 덜하고 무게가 있다(게임 설계값).
      phys: { w: 1.87, l: 4.67, maxSpeed: 41, sportMax: 47, evKnee: 11, accel: 7.2, brake: 7.9, latMax: 9.2, steerMax: 0.58, wheelbase: 2.79, grip: 11, revMax: 4.5 },
      spec: [
        { k: '최고속도(노멀/스포츠)', v: '148 / 169 km/h', source: '게임 설계값', verified: false },
        { k: '구동', v: '수소 연료전지(전기 구동)', source: '게임 설계값', verified: false },
        { k: '특징', v: '조용함 — 접근을 덜 들킨다(연출)', source: '게임 설계값', verified: false }
      ]
    },
    {
      id: 'suv', name: '아이오닉 5 순찰차(전기 SUV)', powertrain: 'ev', desc: '전기차 · 순간 가속이 빠름 · 무게중심 높아 코너에서 일찍 한계', unlock: 2, real: true,
      // evKnee: 이 속도까지 최대 가속(순간 토크) → 그 뒤 출력 일정. sportMax 51.4 m/s = 185 km/h
      phys: { w: 1.95, l: 4.9, maxSpeed: 44, sportMax: 51.4, evKnee: 14, accel: 8.0, brake: 8.2, latMax: 8.8, steerMax: 0.58, wheelbase: 2.95, grip: 10.5, revMax: 4.5 },
      spec: [
        { k: '최고속도(스포츠)', v: '185 km/h', source: '실차 공개 제원(백과사전 기재) — 제조사 원문 대조 전', verified: false },
        { k: '최고속도(노멀)', v: '158 km/h', source: '게임 설계값', verified: false },
        { k: '0→100 km/h', v: '노멀 5.1초 · 스포츠 3.8초(게임 실측)', source: '게임 설계 곡선 — 실차 시간 아님', verified: false },
        { k: '구동', v: '전기(출발부터 최대 가속)', source: '게임 설계값', verified: false }
      ]
    },
    {
      id: 'gsedan', name: '그랜저(준대형 세단)', powertrain: 'ice', desc: '내연기관 · 긴 보닛 · 고속에서 안정 · 실내가 넓다', unlock: 3, real: false,
      phys: { w: 1.89, l: 4.99, maxSpeed: 38.5, sportMax: 44.5, accel: 7.3, brake: 8.6, latMax: 10.4, steerMax: 0.61, wheelbase: 2.9, grip: 12, revMax: 4.5 },
      spec: [
        { k: '최고속도(노멀/스포츠)', v: '139 / 160 km/h', source: '게임 설계값', verified: false },
        { k: '구동', v: '내연기관', source: '게임 설계값', verified: false }
      ]
    },
    {
      id: 'flag', name: '제네시스(대형 세단)', powertrain: 'ice', desc: '내연기관 · 긴 축거로 안정 · 고속 순항이 편하다', unlock: 4, real: false,
      phys: { w: 1.92, l: 5.05, maxSpeed: 40, sportMax: 46, accel: 7.6, brake: 8.8, latMax: 10.2, steerMax: 0.60, wheelbase: 3.05, grip: 12, revMax: 4.5 },
      spec: [
        { k: '최고속도(노멀/스포츠)', v: '144 / 166 km/h', source: '게임 설계값', verified: false },
        { k: '구동', v: '내연기관', source: '게임 설계값', verified: false }
      ]
    }
  ];
  function byId(id) { for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) return UNITS[i]; return null; }
  // 🚓 승급 사다리(v0.10.18) — unlock 은 **계급 단계**(0 순경 · 1 경장 · 2 경사 · 3 경위 · 4 경감)다.
  //  실존 차명은 쓰지 않는다(CLAUDE.md) — 차급으로 부른다. 성능은 전부 게임 설계값이고 실차 수치가 아니다.
  function unlockOf(id) { var u = byId(id); return u ? (u.unlock || 0) : 0; }
  // vehicle.js 가 읽는 모양(종전 TG.CONFIG.CARS 와 같다)
  function cars() {
    var out = {};
    UNITS.forEach(function (u) {
      var c = { id: u.id, name: u.name, powertrain: u.powertrain, desc: u.desc };
      Object.keys(u.phys).forEach(function (k) { c[k] = u.phys[k]; });
      out[u.id] = c;
    });
    return out;
  }
  return { list: UNITS, byId: byId, cars: cars, unlockOf: unlockOf };
})();
