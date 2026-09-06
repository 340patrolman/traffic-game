// 순찰길 — 모든 튜닝 수치는 여기. 단위: 미터, 초, m/s. 법령 수치는 절대 여기 두지 않는다(data/laws.json).
window.TG = window.TG || {};
TG.VERSION = '0.1.0';
TG.CONFIG = {
  SEED: 340,

  // --- 도로망 ---
  ROAD_XS: [0, 80, 160, 240, 320],   // 남북 방향 도로(x 고정)의 x 좌표
  ROAD_ZS: [0, 80, 160, 240, 320],   // 동서 방향 도로(z 고정)의 z 좌표
  ROAD_HALF: 6,        // 왕복 2차로 반폭(중앙선에서 연석까지)
  ROAD_HALF4: 10,      // 왕복 4차로(간선) 반폭: 차로 2개(0.3~3.7, 3.7~7.2) + 갓길(7.2~10)
  AVENUE_V: [0, 1, 2, 3, 4], AVENUE_H: [0, 1, 2, 3, 4],   // 강남·서초 도로는 전부 왕복 4차로 이상(소유자 요청). 인덱스가 빠진 도로는 왕복 2차로가 된다
  LANE_OFF: 2.0,       // 1차로 중심: 중앙선에서 우측으로
  LANE2_OFF: 5.5,      // 4차로 도로의 2차로(바깥) 중심
  SHOULDER_OFF: 4.6,   // 2차로 도로 갓길(정차 유도 위치) 중심
  SHOULDER4_OFF: 8.6,  // 4차로 도로 갓길 중심
  SIDEWALK_W: 3,       // 보도 폭
  STOP_GAP: 4.8,       // 교차로 상자 끝 → 횡단보도(0.5~4.0) → 정지선(4.8)
  WORLD_MARGIN: 40,    // 바깥 여백(잔디)

  // --- 교외·고속도로(스플라인 도로) ---
  LINK_STEP: 4,                // 도로 샘플 간격(m)
  HW_LANES: [2.0, 5.5, 9.0],   // 고속도로 차로 중심(중앙선에서 우측). 0번 = 버스전용차로(1차로)
  HW_HALF: 13.5,               // 고속도로 반폭(갓길 포함)
  HW_SHOULDER: 12.1,           // 고속도로 갓길 중심
  SUB_LIMIT_KMH: 60, HW_LIMIT_KMH: 100,
  AI_CRUISE_SUB: 15, AI_CRUISE_HW: 26, AI_CRUISE_BUS: 22,
  BUSLANE_VIOLATOR_RATE: 0.35, // 고속도로 승용차 중 버스전용차로로 달리는 비율
  BUSLANE_WITNESS_SEC: 1.5,

  // --- 신호 ---
  SIG_GREEN: 11, SIG_YELLOW: 3, SIG_ALLRED: 1,
  PED_WALK: 7,         // 보행 신호: 직각 방향 차량 녹색 시작 후 n초 동안

  // --- 카메라 ---
  CAM_BACK: 6.2, CAM_UP: 2.9, CAM_BACK_PER_MS: 0.11, CAM_LERP: 6,

  // --- 플레이어 차량 ---
  // latMax: 교차로 우회전(R≈8m)이 30km/h 는 여유, 40km/h 는 아슬아슬하도록 잡은 값(실차 감각보다 조금 관대한 아케이드 튜닝)
  CARS: {
    sedan: { id: 'sedan', name: '순찰 세단(중형)', w: 1.85, l: 4.7, maxSpeed: 36, accel: 7.0, brake: 8.5, latMax: 10.5,
             steerMax: 0.62, wheelbase: 2.75, grip: 12, revMax: 4.5, powertrain: 'ice', desc: '내연기관 · 낮은 무게중심 · 코너 한계 높음' },
    suv:   { id: 'suv', name: '순찰 전기 SUV',  w: 1.95, l: 4.9, maxSpeed: 33, accel: 8.0, brake: 8.2, latMax: 8.8,
             steerMax: 0.58, wheelbase: 2.95,  grip: 10.5, revMax: 4.5, powertrain: 'ev', desc: '전기차 · 가속 빠름 · 무게중심 높아 코너에서 일찍 한계' },
    flag:  { id: 'flag', name: '순찰 대형 세단(플래그십)', w: 1.92, l: 5.05, maxSpeed: 40, accel: 7.6, brake: 8.8, latMax: 10.2,
             steerMax: 0.60, wheelbase: 3.05, grip: 12, revMax: 4.5, powertrain: 'ice', desc: '내연기관 · 고해상도 차체 · 긴 축거로 안정' },
  },
  CAM_COCKPIT: { x: 0.38, y: 1.34, z: -0.02, fov: 96, lookDown: 0.06, lookMax: 1.75 },   // 넓은 시야 + 좌우 둘러보기(드래그·Q/E) 최대 ±100°   // 실차 눈높이(≈1.3m). 계기판·핸들 윗부분이 시야 아래쪽에 들어온다   // 넓은 시야(양쪽 사이드미러·룸미러가 화면 안에 들어온다)   // 운전석(좌측 +x) 눈 위치 — 대시보드 위로 도로가 넓게 보이는 높이
  ROAD_LIMIT_KMH: 50,          // 시내 제한속도
  SPEED_TOLERANCE_KMH: 11,     // 이 초과부터 과속 감점

  // --- AI 교통 ---
  TRAFFIC_MAX: 18,
  AI_CRUISE: 11.5,             // ≈ 41 km/h
  AI_CRUISE_VAR: 1.5,
  AI_TURN_SPEED: 4.5,
  AI_DECEL: 4.5,               // 평상시 감속
  AI_EMERGENCY: 10,            // 급제동(사람·급정차)
  AI_ACCEL: 3.2,
  AI_FOLLOW_SEC: 1.8,
  SPAWN_MIN: 45, SPAWN_MAX: 130, DESPAWN: 170,
  VIOLATOR_RATE: 0.30,         // 스폰 시 "신호를 무시할 성향" 부여 비율
  VIOLATOR_COOLDOWN: 45,       // 한 번 위반 후 다음 위반까지
  WITNESS_DIST: 55,            // 목격 거리
  WITNESS_FOV: 75,             // 목격 시야 반각(도)
  VIOLATION_MEMORY: 45,        // 목격 표시 유지(초)

  // --- 행인 ---
  PED_MAX: 22,
  PED_SPAWN_MIN: 30, PED_SPAWN_MAX: 95, PED_DESPAWN: 130,

  // --- 단속 ---
  PULL_RANGE: 22,              // 경광등 켜고 뒤에 붙는 거리
  PULL_HOLD: 1.2,              // 붙어 있어야 하는 시간
  STOP_BEHIND_MIN: 3.0, STOP_BEHIND_MAX: 15,
  STOP_SHOULDER_MIN: 2.6,      // 플레이어 정차 시 중앙선에서 우측 최소 이탈(차로 밖)
  TICKET_SECONDS: 10,

  // --- 근무·점수 ---
  SHIFT_SECONDS: 360,
  SCORE: { correct: 30, wrongChoice: 10, noViolation: -5, redLight: -10, speeding: -5, centerline: -5,
           crash: -8, pedestrian: -100, cornerFail: -2, nosignal: -3, solidline: -5 },
};
