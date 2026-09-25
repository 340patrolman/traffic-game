// 📍 이 자리 — 종합 데이터 지도의 조회 창구(v0.10.32)
//  소유자 지시(2026-09-25): 「공공데이터를 통한 지도 위에 여지껏 파악한 모든 데이터를 쌓아서 그 자체로 훌륭한 종합 데이터 지도가
//  되어야 하고, 경찰이 게임도 하고 그 지역을 다니면서 알고 싶을 경우 필요한 만큼의 데이터를 보여줄 수 있어야 한다.
//  필요한 통계·역사적 의미·흥미를 끌 만한 것·업무상 필요한 것도 디지털 트윈 지도가 품고 있다가 보여줄 수 있어야 한다.」
//
//  ⚠ **이 파일은 자료를 만들지 않는다.** 이미 저장소에 있는 파일(TAAS·행안부 인구·경찰청 신호·NEIS 학사·국가유산청)을
//     **지금 서 있는 자리 기준으로 모아 보여 줄 뿐**이다. 없는 값은 「자료 없음」이라고 적는다 — 지어내지 않는다.
//  ⚠ 출처는 갈래마다 그대로 붙인다(출처 표기 의무가 있는 자료가 섞여 있다).
TG.Here = function (game) {
  var self = this, G = game;
  var open = false, last = null;
  function EL(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function num(n) { return (n == null || !isFinite(n)) ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // ⚠ **게임 단위를 미터라고 적으면 안 된다.** 축약 지도는 도로 간격을 눌러 담아 1 unit 이 약 14.7m 다
  //  (실측: 트윈 지도에서 「34m」로 적힌 것이 실제로는 약 500m 였다). 지도의 wgs84 변환에서 배율을 꺼내 환산한다.
  //  변환이 없는 지도는 **미터로 적지 않고** 게임 거리로만 적는다 — 모르는 값을 아는 척하지 않는다.
  function mpu() {
    var W = TG.MAP && TG.MAP.wgs84;
    if (!W || !W.x || !W.x[0]) return null;
    return 88800 / Math.abs(W.x[0]);            // 서울 위도에서 경도 1도 ≈ 88,800m
  }
  function dist(u) {
    var m = mpu();
    if (m == null) return Math.round(u) + ' (게임 거리)';
    var v = u * m;
    return (v >= 1000) ? (Math.round(v / 100) / 10) + 'km' : Math.round(v) + 'm';
  }
  // 국가유산청 설명에는 엔티티가 그대로 들어 있다 — 한 번 풀고 나서 화면용으로 다시 escape 한다
  function unent(s) {
    return String(s == null ? '' : s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }
  // 지금 조회 기준 자리 — 차 안이면 차, 내려 있으면 사람
  function at() {
    var a = (G.actor ? G.actor() : null) || G.player;
    if (!a || !a.pos) return null;
    return { x: a.pos.x, z: a.pos.z };
  }

  // ── 갈래별로 모은다. 각 갈래는 { title, rows:[{k,v}], src } 또는 null ──────────────

  // ① 자리 — 도로·교차로·행정동·자치구
  function secWhere(p) {
    var C = G.city, rows = [];
    var fr = C.frameAt(p.x, p.z, 0);
    var nd = C.nearestNode(p.x, p.z);
    var d = Math.hypot(nd.x - p.x, nd.z - p.z);
    if (fr && fr.name) rows.push({ k: '도로', v: fr.name + (fr.limit ? ' · 제한 ' + fr.limit + 'km/h' : '') });
    if (nd) rows.push({ k: '가까운 교차로', v: C.nodeName(nd) + ' · ' + dist(d) });
    if (G.pop && G.pop.ready() && G.pop.dongOf) {
      var dong = G.pop.dongOf(nd);
      if (dong && dong.name) rows.push({ k: '행정동', v: dong.name });
    }
    if (C.inSchoolZone && C.inSchoolZone(p.x, p.z)) rows.push({ k: '구역', v: '⚠ 어린이보호구역 — 제한 30km/h · 범칙금·벌점 2배(08~20시)' });
    rows.push({ k: '지도 좌표', v: Math.round(p.x) + ', ' + Math.round(p.z) + (TG.MAP && TG.MAP.scale1to1 ? ' (1 unit = 1 m)' : '') });
    return rows.length ? { title: '📍 자리', rows: rows, src: '' } : null;
  }

  // ② 안전 — TAAS 사고(교차로 집계 · 다발지 · 사망 · 취약계층) + 이 시간대 분포
  function secSafety(p) {
    var L = G.layers; if (!L) return null;
    var C = G.city, nd = C.nearestNode(p.x, p.z), rows = [], src = '';
    var st = L.nodeStat ? L.nodeStat(nd.i, nd.j) : null;
    if (st) {
      rows.push({ k: '이 교차로 사고', v: num(st.total) + '건 · 사망 ' + num(st.death) + ' · 중상 ' + num(st.serious) + ' (' + (L.realYears() || '') + ')' });
      var why = (st.byViolation || st.violations || null);
      if (why && why.length) rows.push({ k: '주된 경위', v: why.slice(0, 2).map(function (w) { return (w.name || w[0]) + ' ' + (w.n || w[1]); }).join(' · ') });
    }
    var hits = L.allAt ? L.allAt(p.x, p.z, 70) : [];
    var shown = 0;
    hits.forEach(function (h) {
      if (shown >= 4) return;
      if (h.layer === 'taasNode') return;                 // 위에서 이미 보였다
      var it = h.it, label = h.layerName + (h.example ? ' (예시)' : '');
      var v = (it.spot || it.name || '') + (it.total || it.occrrnc ? ' · ' + num(it.total || it.occrrnc) + '건' : '') +
              (it.death ? ' · 사망 ' + it.death : '') + (it.approx ? ' · 위치 근사' : '');
      rows.push({ k: label, v: (v.trim() || '해당') + ' · ' + dist(h.dist) });
      shown++;
    });
    if (L.hourBrief) {
      var b = L.hourBrief(new Date().getHours());
      if (b && b.rows && b.rows.length) {
        var top = b.rows.slice().sort(function (a, c) { return c.n - a.n; })[0];
        if (top && top.n) rows.push({ k: '이 시간대(서초 전역)', v: top.name + ' ' + num(top.n) + '건 · 이 시간 비중 ' + Math.round(top.share * 100) + '%' });
      }
    }
    var rk = L.riskAt ? L.riskAt(nd) : null;
    if (rk && rk.total) rows.push({ k: '시뮬 위험도(이 기기)', v: num(rk.total) + '점 — 급제동·보행자 근접·신호위반을 쌓은 값이다(게임 설계값)' });
    if (!rows.length) return null;
    var note = L.nodesNote ? L.nodesNote() : null;
    src = (note && (note.attribution || note.source)) || '도로교통공단 교통사고분석시스템(TAAS)';
    return { title: '⚠ 안전 · 사고', rows: rows, src: src };
  }

  // ③ 사람 — 그 동의 거주인구·연령 구성(행정안전부)
  function secPeople(p) {
    var P = G.pop; if (!P || !P.ready()) return null;
    var nd = G.city.nearestNode(p.x, p.z), dong = P.dongOf(nd);
    if (!dong || !dong.name) return null;
    var mix = P.mix(dong) || {};
    var rows = [{ k: dong.name + ' 인구', v: num(dong.tot) + '명' }];
    if (mix.kidShare != null) rows.push({ k: '19세 이하', v: Math.round(mix.kidShare * 100) + '%' });
    if (mix.seniorShare != null) rows.push({ k: '70세 이상', v: Math.round(mix.seniorShare * 100) + '%' });
    rows.push({ k: '쓰임', v: '이 동네의 나이 구성이 그대로 게임 행인에 들어간다 · 동 경계는 교차로 이름으로 붙인 근사다' });
    return { title: '👥 사람 · 인구', rows: rows, src: P.src() || '행정안전부 주민등록 인구통계' };
  }

  // ④ 신호 — 이 교차로의 실측 주기·시간대 계획(경찰청)
  function secSignal(p) {
    var S = G.signals, nd = G.city.nearestNode(p.x, p.z), rows = [];
    if (!S) return null;
    if (Math.hypot(nd.x - p.x, nd.z - p.z) > 120) return null;      // 교차로에서 멀면 신호 이야기를 하지 않는다
    var cyc = S.cycleOf ? S.cycleOf(nd) : null;
    if (cyc) rows.push({ k: '지금 주기', v: Math.round(cyc) + '초' });
    if (S.hasLeft && S.hasLeft(nd)) rows.push({ k: '좌회전', v: '보호 좌회전 현시가 있다' });
    var tod = G.signalTod, nm = G.city.nodeName(nd);
    if (tod && tod.ready && tod.spot) {
      var sp = tod.spot(nm);
      if (sp) {
        var inf = tod.info ? tod.info(nm, new Date()) : null;
        if (inf) rows.push({ k: '실측 계획(지금)', v: inf.cycle + '초 · 옵셋 ' + inf.offset + ' · ' + (inf.phases || '?') + '현시' });
        rows.push({ k: '자료', v: '이 교차로는 경찰청 공개 목록에 있다 — 🚦 신호 근무표에서 오늘 시간표를 본다' });
      } else {
        rows.push({ k: '자료', v: '경찰청 공개 목록(서울 388곳)에 이 교차로는 없다 — 주기는 추정값이다' });
      }
    }
    if (!rows.length) return null;
    return { title: '🚦 신호', rows: rows, src: '경찰청 교차로계획정보서비스 · 공공데이터포털' };
  }

  // ⑤ 업무 — 지금 때(학사일정·시간대)와 이 자리의 근무 단서
  function secWork(p) {
    var rows = [], srcs = [];
    if (G.school && G.school.ready()) {
      var ln = G.school.line(new Date());
      if (ln) { rows.push({ k: '학사·시간', v: ln }); srcs.push('교육부 나이스(NEIS) 학사일정'); }
    }
    if (G.risk && G.risk.ready && G.risk.ready()) {
      var rl = G.risk.line(new Date(), G.weather ? G.weather.kind : null);
      if (rl) { rows.push({ k: '이때 잦은 신고', v: rl }); srcs.push('경찰청 범죄 시간대·요일'); }
    }
    var F = G.facil;
    if (F && F.list) {
      var nd = G.city.nearestNode(p.x, p.z);
      var cams = F.list().filter(function (c) { return c.i === nd.i && c.j === nd.j; });
      if (cams.length) rows.push({ k: '무인 단속 장비', v: cams.length + '대 설치(이 게임 안에서 내가 설치한 것)' });
    }
    if (!rows.length) return null;
    return { title: '👮 업무', rows: rows, src: srcs.join(' · ') };
  }

  // ⑤-b 주변 — 랜드마크 · 지하철 출입구 · 이름 있는 실제 건물(두 지도 모두)
  //  소유자 2026-09-25: 「현재 지도나 만들고 있는 지도나 도로 표시·주변 건물이나 랜드마크 등도 알 수 있게 해 줘.」
  var LM_KO = { terminal: '고속버스터미널', hospital: '서울성모병원', library: '국립중앙도서관', arts: '예술의전당',
                court: '법원·검찰청', gu: '서초구청', stadium: '반포종합운동장', trade: '업무타워', twin: '아파트 타워' };
  function secPlaces(p) {
    var C = G.city, rows = [], got = [];
    // 랜드마크 블록 — 그 안에 있는지, 아니면 얼마나 가까운지
    (C.landmarks || []).forEach(function (L) {
      var cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
      var inside = p.x >= L.x0 && p.x <= L.x1 && p.z >= L.z0 && p.z <= L.z1;
      var d = Math.round(Math.hypot(cx - p.x, cz - p.z));
      if (inside || d <= 180) got.push({ t: 0, k: '랜드마크', v: (LM_KO[L.kind] || L.kind) + (inside ? ' · 이 블록 안' : ' · ' + dist(d)), d: inside ? 0 : d });
    });
    // 지하철 출입구
    (C.subways || []).forEach(function (S) {
      var d = Math.round(Math.hypot(S.x - p.x, S.z - p.z));
      // ⚠ S.name 에 이미 「역」이 들어 있다(고속터미널역) — 또 붙이면 「고속터미널역역」이 된다
      if (d <= 160) got.push({ t: 1, k: '지하철', v: S.name + ' ' + (S.lines || []).join('·') + '호선 출입구 · ' + dist(d), d: d });
    });
    // 기념물(노거수 등)
    (C.monuments || []).forEach(function (M) {
      var d = Math.round(Math.hypot(M.x - p.x, M.z - p.z));
      if (d <= 160) got.push({ t: 2, k: '기념물', v: (M.label || M.name || '기념물') + (M.sub ? ' · ' + M.sub : '') + ' · ' + dist(d), d: d });
    });
    // 이름 있는 실제 건물(1:1 지도에만 있다 — OSM name)
    if (G.realBuild && G.realBuild.near) {
      G.realBuild.near(p.x, p.z, 130).slice(0, 4).forEach(function (b) {
        got.push({ t: 3, k: '건물', v: b.name + (b.lv ? ' · ' + b.lv + '층' : '') + ' · ' + dist(b.dist), d: b.dist });
      });
    }
    got.sort(function (a, b) { return a.d - b.d; });
    got.slice(0, 7).forEach(function (g) { rows.push({ k: g.k, v: g.v }); });
    if (!rows.length) return null;
    var src = (G.realBuild && G.realBuild.info && G.realBuild.info().count) ? 'OpenStreetMap contributors (ODbL) · 그 밖은 이 지도 파일' : '이 지도 파일(랜드마크·지하철역)';
    return { title: '🏢 주변', rows: rows, src: src };
  }

  // ⑥ 역사·흥미 — 국가유산청 국가유산(이 자리 가까운 것)
  function secHeritage(p) {
    var H = G.heritage;
    if (!H || !H.ready()) return null;
    // ⚠ **축약 지도에 실제 위경도를 얹으면 자리가 어긋난다**(v0.9.70 에서 150~580m 로 실측했다).
    //  축약 지도는 「어느 도로와 어느 도로가 만나는가」를 담은 것이지 실제 위치가 아니기 때문이다.
    //  1:1 정밀 지도에서만 자리를 믿을 수 있다 — 그 밖에서는 **「위치 근사」라고 적는다.**
    var exact = !!(TG.MAP && TG.MAP.scale1to1);
    var m = mpu() || 1, near = H.near(p.x, p.z, 400 / m);   // 실제 400m 안
    if (!near.length) return null;
    var rows = near.slice(0, 3).map(function (h) {
      return { k: (h.kind || '국가유산') + ' · ' + dist(h.dist), v: unent(h.name) + (h.era ? ' · ' + h.era : '') + (h.desc ? '\n' + unent(h.desc) : '') };
    });
    if (!exact) rows.push({ k: '⚠ 자리', v: '이 지도는 축약 지도라 국가유산 자리가 실제와 어긋난다(실측 150~580m). 있고 없음만 보고, 정확한 자리는 1:1 정밀 지도에서 본다.' });
    return { title: '🏛 역사 · 흥미', rows: rows, src: H.src() };
  }

  // ── 모으기 ─────────────────────────────────────────────────────────────
  this.query = function (pos) {
    var p = pos || at(); if (!p) return null;
    var secs = [secWhere(p), secPlaces(p), secSafety(p), secPeople(p), secSignal(p), secWork(p), secHeritage(p)].filter(Boolean);
    last = { at: p, secs: secs, when: new Date() };
    return last;
  };
  this.last = function () { return last; };

  this.open = function () {
    var q = self.query(); if (!q) return false;
    var card = EL('hereCard'); if (!card) return false;
    var h = '<div class="hr-head"><b>📍 이 자리</b><button class="hr-x" id="hereClose">닫기</button></div>';
    if (!q.secs.length) {
      h += '<div class="hr-empty">이 자리에 대해 이 지도가 가진 자료가 없습니다.<br>자료를 넣으면 그날 바로 여기에 뜹니다.</div>';
    }
    q.secs.forEach(function (s) {
      h += '<div class="hr-sec"><div class="hr-t">' + esc(s.title) + '</div>';
      s.rows.forEach(function (r) {
        h += '<div class="hr-r"><span class="hr-k">' + esc(r.k) + '</span><span class="hr-v">' + esc(r.v).replace(/\n/g, '<br>') + '</span></div>';
      });
      if (s.src) h += '<div class="hr-src">자료 · ' + esc(s.src) + '</div>';
      h += '</div>';
    });
    h += '<div class="hr-foot">이 지도가 품고 있는 자료를 그 자리 기준으로 모아 보인 것입니다. 없는 값은 지어내지 않습니다.</div>';
    card.innerHTML = h;
    card.className = 'on';
    open = true;
    document.body.classList.add('hereon');
    var x = EL('hereClose'); if (x) x.addEventListener('click', function (e) { e.stopPropagation(); self.close(); });
    if (TG.audio && TG.audio.ui) TG.audio.ui();
    return true;
  };
  this.close = function () {
    var card = EL('hereCard'); if (card) card.className = '';
    open = false; document.body.classList.remove('hereon');
  };
  this.toggle = function () { return open ? (self.close(), false) : self.open(); };
  this.isOpen = function () { return open; };
};
