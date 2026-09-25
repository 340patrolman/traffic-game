// 📻 사수·동기 무전(재미 설계서 7절 2단계 #9) — 혼자 도는 근무가 「팀」이 된다.
//  사수(20년차 경위 · 말수 적고 정확) · 동기(같은 날 배치된 순경 · 추격을 좋아함 · 원칙의 반면교사이자 함께 크는 사람) · 상황실.
//  전부 **가상 인물**이다(실존 인물 금지). 말은 짧게 — 게임을 가리지 않게 한 번에 한 줄, 같은 말은 오래 쉬었다가.
//  규칙: 가르치는 말은 사수, 들뜬 말은 동기. **과속·충돌을 칭찬하지 않는다.**
TG.Crew = function (game) {
  var self = this, cd = {}, gap = 0, idleT = 60, queue = null, last = {};
  var WHO = {
    sasu: { tag: '📻 사수', kind: 'pa', pitch: 0.86, rate: 0.94 },
    peer: { tag: '📻 동기', kind: 'officer', pitch: 1.1, rate: 1.08 },
    hq:   { tag: '📻 상황실', kind: 'narrator' }
  };
  var LINES = {
    start: [['sasu', '오늘도 안전이 먼저다. 급할수록 안전거리.'], ['sasu', '천천히 돌자. 보이는 것부터 정확하게.'], ['peer', '나는 남쪽 돈다. 뭐 나오면 불러!']],
    stopPerfect: [['sasu', '교본대로다. 그렇게만 해.'], ['peer', '와, 깔끔하다. 나도 그렇게 세워야지.']],
    stopOk: [['sasu', '세운 건 좋다. 오른쪽 깜빡이까지 켜면 뒤차가 먼저 안다.'], ['sasu', '다음엔 대상 뒤 5에서 10미터, 나란히.']],
    crash: [['sasu', '괜찮나. 속도 줄이고 간격 둬라.'], ['peer', '조심해! 순찰차가 사고 나면 다 곤란해.']],
    speeding: [['sasu', '제한속도 넘었다. 경찰이 먼저 지킨다.']],
    chase: [['peer', '앞쪽은 내가 막아 볼게! 너무 붙지 마!'], ['sasu', '무리하지 마라. 사람이 먼저다.']],
    incident: [['sasu', '현장이다. 경광등, 뒤에 방패, 라바콘 순서.']],
    dispatch: [['sasu', '사거리에선 서행. 사이렌 켰다고 다 비켜 주지 않는다.']],
    wrong: [['sasu', '틀려도 된다. 조문 한 번 보고 가자.']],
    idle: [['peer', '오늘 조용하네. 이런 날이 제일 좋은 날이야.'], ['sasu', '위반은 서두르지 않는 눈에 보인다.'], ['peer', '편의점 앞 킥보드 두 명, 자주 보여. 조심해.'], ['sasu', '신호 앞에서 멈춘 차들 좀 봐라. 저게 우리가 지키는 거다.']],
    end: [['sasu', '수고했다. 오늘 한 것 한 번 돌아봐라.'], ['peer', '오늘도 무사히! 내일 또 보자.']]
  };
  var MODES = { patrol: 1, chase: 1, duty: 1, free: 1 };
  function on() { return !game.crewOff && !(TG.mode && TG.mode.sim) && !!MODES[game.mode]; }   // 검사 모드는 기본으로 끈다(안내문을 읽는 검사를 흔들지 않게)
  function now() { return game.traffic ? game.traffic.time : 0; }
  function pick(key) {
    var L = LINES[key]; if (!L || !L.length) return null;
    var i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === last[key]) i = (i + 1) % L.length;
    last[key] = i; return L[i];
  }
  this.lines = LINES;
  this.said = [];               // 검증이 읽는다
  this.reset = function () { cd = {}; gap = 0; idleT = 70; queue = null; self.said = []; };
  // key: 위 LINES 열쇠 · wait: 몇 초 뒤에(기본 0) · cool: 같은 열쇠를 다시 말하기까지(기본 25초)
  this.say = function (key, wait, cool) {
    if (!on()) return false;
    if ((cd[key] || -1e9) > now()) return false;
    cd[key] = now() + (cool === undefined ? 25 : cool);
    queue = { key: key, t: now() + (wait || 0) };
    return true;
  };
  function speak(key) {
    var ln = pick(key); if (!ln) return;
    // 🏫 v0.10.24 — 근무를 여는 인사와 한가할 때는 **오늘이 개학인지 방학인지, 지금이 등교·하교인지**를 보고 말한다.
    //  날짜는 NEIS 학사일정(서초구 학교 실제 값)에서 오고, 시각 구간은 게임 설계값이다(data/schooltime.json 에 그렇게 적었다).
    if ((key === 'start' || key === 'idle') && game.school && game.school.ready()) {
      var sl = game.school.line();
      if (sl) ln = ['sasu', sl];
    }
    var w = WHO[ln[0]];
    game.hud.notice(w.tag + ' — ' + ln[1], 'info', 3800);
    if (TG.audio.squelch) TG.audio.squelch();
    TG.audio.say(ln[1], { kind: w.kind, pitch: w.pitch, rate: w.rate, queue: true });
    self.said.push({ key: key, who: ln[0], text: ln[1] });
    if (game.metrics) game.metrics.ev('radio');
    gap = 6; idleT = 80 + Math.random() * 40;
  }
  this.now = function (key) { if (on()) speak(key); };   // 근무 끝처럼 기다릴 수 없을 때
  this.update = function (dt) {
    if (!on() || game.state !== 'play') return;
    if (gap > 0) gap -= dt;
    if (game.first && game.first.on()) return;                 // 첫 출근 동안은 사수가 따로 이끈다
    if (queue && now() >= queue.t && gap <= 0 && (!game.hud.noticeLeft || game.hud.noticeLeft() < 0.3)) { var k = queue.key; queue = null; speak(k); return; }
    idleT -= dt;
    if (idleT <= 0 && !queue) { idleT = 90; self.say('idle', 0, 60); }
  };
};
