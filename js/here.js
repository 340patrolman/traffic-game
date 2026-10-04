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
      var hereD = G.pop.dongHere ? G.pop.dongHere(p.x, p.z) : null;
      if (hereD && hereD.exact) rows.push({ k: '행정동', v: (hereD.outside ? '서초구 밖' + (hereD.near ? ' — ' + hereD.near : '') : hereD.name) + ' — 지금 선 자리 (통계청 행정동 경계 2026.7)' });
      var dong = G.pop.dongOf(nd);
      if (dong && dong.name) rows.push({ k: hereD && hereD.exact ? '교차로 동' : '행정동', v: (G.pop.dongLabel ? G.pop.dongLabel(nd) : dong.name) + (hereD && hereD.exact ? '' : ' (통계청 행정동 경계 2026.7 · 교차로 기준)') });
    }
    var szA = C.schoolZoneAt ? C.schoolZoneAt(p.x, p.z) : (C.inSchoolZone && C.inSchoolZone(p.x, p.z) ? {} : null);
    if (szA) rows.push({ k: '구역', v: '⚠ 어린이보호구역 — 제한 30km/h · 범칙금·벌점 2배(08~20시)' + (szA.note ? ' · ' + szA.note : '') });
    if (fr && fr.brt) rows.push({ k: '🚌 전용차로', v: fr.brt + ' — 1차로(청색 실선 안쪽)는 버스만 · 일반도로 전용차로 통행 위반(도로교통법 제15조 제3항)' });
    var onq = G.onto && G.onto.ok ? G.onto.near(p.x, p.z, 260) : null;   // 🧭 (v0.10.70) 정체 원인 온톨로지 — 현장 판단이 정답지
    if (onq && onq.cases.length) onq.cases.forEach(function (k) { rows.push({ k: '🧭 정체 원인', v: onq.ix.name + ' — ' + G.onto.caseLine(k) }); });
    if (G.onto && G.onto.queuesNear) G.onto.queuesNear(p.x, p.z, 320).forEach(function (sg) { var l = G.onto.queueLine(sg); if (l) rows.push({ k: '🚗 구간 대기열', v: l }); });   // (v0.10.75) 3단계 — 실측 교통량 · 편람 포화교통류율 · 실제 신호
    var bsq = G.brt && G.brt.on ? G.brt.stationNear(p.x, p.z, 320) : null;   // (v0.10.68) 가까운 중앙 정류장 — 실제로 서는 노선 수(서울시 버스도착정보)
    if (bsq) rows.push({ k: '🚏 중앙 정류장', v: bsq.st.name + ' · ' + dist(bsq.dist) + ' · 서는 노선 ' + bsq.st.routes + '(경기·광역·인천 ' + bsq.st.wide + ') · 하루 승하차 ' + (bsq.st.day || 0).toLocaleString() + '명' });
    if (bsq && bsq.st.h) {   // (v0.10.69) 이 시각 승하차(서울시 교통카드 2026.6 · 시간대별) · 가장 붐비는 시각 · 정류장 횡단보도
      var hN = G.brt.hourNow ? G.brt.hourNow() : new Date().getHours(), hA = bsq.st.h, pk = 0; for (var hk = 1; hk < 24; hk++) if (hA[hk] > hA[pk]) pk = hk;
      rows.push({ k: '🚶 이용객 동선', v: hN + '시 승하차 ' + (hA[hN] || 0).toLocaleString() + '명(하루 평균) · 가장 붐비는 때 ' + pk + '시 ' + hA[pk].toLocaleString() + '명 · 횡단보도 ' + (bsq.st.xwGuess ? '자리 근사' : (bsq.st.xwSig ? '신호 있음' : '신호 표시 없음(OSM)')) + (bsq.st.exits && bsq.st.exits.length ? ' · 지하철 출입구 ' + bsq.st.exits.length + '곳' : '') });
    }
    var szq = G.layers && G.layers.szNear ? G.layers.szNear(p.x, p.z, 400) : null;   // (v0.10.67) 실제 보호구역 시설(점) — 400m 안 가장 가까운 곳
    if (szq) rows.push({ k: '보호구역 시설', v: '🏫 ' + szq.name + (szq.kind === '초등학교' ? '초' : ' ' + szq.kind) + ' · ' + dist(szq.d) + ' (구역 경계선 자료 없음 — 표지로 확인)' });
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
    var nd = G.city.nearestNode(p.x, p.z), hd = P.dongHere ? P.dongHere(p.x, p.z) : null, dong = hd && hd.dong ? hd.dong : P.dongOf(nd);
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
    if (!exact) rows.push({ k: '⚠ 자리', v: (TG.warp && TG.warp.ok)
      ? '축약 지도다 — 실제 도로 중심선에 맞춰 늘이고 줄여(고무판 변환) **어느 도로 사이·어느 모퉁이인지는 실제와 같게** 두었다. 거리는 축약돼 있다(1:1 정밀 지도에서 실제 거리).'
      : '이 지도는 축약 지도라 국가유산 자리가 실제와 어긋난다(실측 150~580m). 있고 없음만 보고, 정확한 자리는 1:1 정밀 지도에서 본다.' });
    return { title: '🏛 역사 · 흥미', rows: rows, src: H.src() };
  }

  // 가장 가까운 도로(축·번호) — 교통량 지점을 같은 도로에서만 찾으려고
  function roadOf(p) {
    var C = G.city, i = C.nearestIdx(C.xs, p.x), j = C.nearestIdx(C.zs, p.z);
    return Math.abs(p.x - C.xs[i]) <= Math.abs(p.z - C.zs[j]) ? { axis: 'v', idx: i, name: (C.roadNamesV || [])[i] } : { axis: 'h', idx: j, name: (C.roadNamesH || [])[j] };
  }
  function toU(m) { var k = mpu(); return k ? m / k : m / 14.66; }   // 미터 → 이 지도 단위
  var DOW = ['일', '월', '화', '수', '목', '금', '토'], TYPE_KO = { wd: '평일', sat: '토요일', sun: '일요일' };

  // ⑧ 교통 — 서울시 교통량 조사(시간대별 실측) · 무인 단속 카메라(행안부 표준데이터) (v0.10.44)
  function secTraffic(p) {
    var D = G.citydata; if (!D || !D.ready()) return null;
    var rows = [], rd = roadOf(p), sp = D.volSpot(rd.axis, rd.idx, p.x, p.z), now = new Date();
    if (sp) {
      var v = D.volAt(sp, now);
      if (v) {
        rows.push({ k: '교통량 · 지금', v: (rd.name || '') + ' ' + TYPE_KO[v.type] + ' ' + now.getHours() + '시 — 시간당 ' + num(v.now) + '대(방향별 ' + num(v.dir[0]) + ' / ' + num(v.dir[1]) + ')' });
        rows.push({ k: '하루 · 가장 붐빌 때', v: num(v.day) + '대 · ' + v.peakH + '시 ' + num(v.peakV) + '대' });
        rows.push({ k: '조사 지점', v: sp.name + ' · 같은 도로의 가장 가까운 지점 — 이 자리에서 ' + dist(Math.hypot(G.city.nodes[sp.node[0]][sp.node[1]].x - p.x, G.city.nodes[sp.node[0]][sp.node[1]].z - p.z)) });
        ['wd', 'sat', 'sun'].forEach(function (t) {
          var a = sp[t]; if (!a) return;
          var hs = [7, 8, 9, 12, 15, 18, 19, 22].map(function (h) { return h + '시 ' + num(a[h][0] + a[h][1]); }).join(' · ');
          rows.push({ k: TYPE_KO[t] + ' 시간대', v: hs });
        });
      }
    } else if (rd.name) rows.push({ k: '교통량', v: rd.name + ' — 서울시 교통량 조사 지점이 이 도로에 없다(서초 쪽 조사 지점 7곳뿐) · 지어내지 않는다' });
    var cams = D.camerasNear(p.x, p.z, toU(500));
    rows.push({ k: '무인 단속 카메라', v: '반경 500m ' + cams.length + '대 · 서초구 전체 ' + D.cameraCount() + '대(기준일 ' + (D.cameraRef() || '?') + ')' });
    cams.slice(0, 6).forEach(function (c) {
      rows.push({ k: '· ' + dist(c.d), v: c.c.at + ' · ' + (c.c.road || '') + (c.c.lim ? ' · 제한 ' + c.c.lim + 'km/h' : '') + ' · 단속구분 코드 ' + c.c.se + (c.c.zone && c.c.zone !== '99' ? ' · 보호구역 코드 ' + c.c.zone : '') + (c.c.yr ? ' · ' + c.c.yr + '년 설치' : '') });
    });
    return rows.length ? { title: '🚗 교통 · 단속 장비', rows: rows, src: [D.src('vol'), D.src('cam')].filter(Boolean).join(' / ') } : null;
  }

  // ⑨ 행사·축제 · 집회·행진 — 서울시 문화행사 · 서울경찰청 오늘의 주요집회 (v0.10.44)
  function secEvents(p) {
    var D = G.citydata; if (!D || !D.ready()) return null;
    var rows = [], now = new Date(), R = toU(1200);
    var today = D.eventsNear(p.x, p.z, R, now, 0), soon = D.eventsNear(p.x, p.z, R, now, 30).filter(function (x) { return today.indexOf(x) < 0; });
    var fest = D.eventsOn(now).filter(function (x) { return D.isFestival(x.e); });
    rows.push({ k: '오늘 · 1.2km 안', v: today.length ? today.length + '건' : '없음' });
    today.slice(0, 8).forEach(function (x) { rows.push({ k: '· ' + (x.e.c || '행사'), v: x.e.t + '\n' + x.e.p + ' · ' + x.e.s + '~' + x.e.e + (x.e.hour ? ' · ' + x.e.hour : '') + (x.e.free ? ' · ' + x.e.free : '') }); });
    if (fest.length) rows.push({ k: '오늘 서초·한강 축제', v: fest.slice(0, 4).map(function (x) { return x.e.t + '(' + x.e.p + ')'; }).join('\n') + (fest.length > 4 ? '\n외 ' + (fest.length - 4) + '건' : '') });
    if (soon.length) {
      rows.push({ k: '30일 안 · 1.2km 안', v: soon.length + '건' });
      soon.slice(0, 6).forEach(function (x) { rows.push({ k: '· ' + x.e.s.slice(5), v: x.e.t + ' · ' + x.e.p }); });
    }
    var todayR = D.ralliesOn(now), near = todayR.filter(function (x) { return x.x != null && Math.hypot(x.x - p.x, x.z - p.z) <= R; });
    rows.push({ k: '🪧 오늘 집회·행진', v: todayR.length ? '서초 관내 ' + todayR.length + '건' + (near.length ? ' · 1.2km 안 ' + near.length + '건' : '') : (D.collected() && D.collected() < now.toISOString().slice(0, 10) ? '받은 날(' + D.collected() + ') 뒤라 모른다 — 아래는 지난 무늬' : '서초 관내 주요 집회 없음') });
    todayR.forEach(function (x) { rows.push({ k: '· ' + x.r.from + '~' + x.r.to, v: x.r.p + ' · 신고 ' + num(x.r.n) + '명' + (x.r.march ? ' · 행진' : '') + (x.r.approx ? ' · 위치 근사' : '') + (x.x == null ? ' · ' + x.r.note : '') }); });
    var pat = D.rallyPattern().filter(function (o) { return o.x != null && Math.hypot(o.x - p.x, o.z - p.z) <= R; }), rg = D.rallyRange();
    if (rg) rows.push({ k: '지난 무늬 · 1.2km 안', v: pat.length ? pat.map(function (o) { return o.place + ' ' + o.n + '회 · ' + Object.keys(o.dows).join('') + ' · 최대 신고 ' + num(o.max) + '명'; }).join('\n') : '없음' });
    if (rg) rows.push({ k: '집회 자료 기간', v: rg[0] + ' ~ ' + rg[1] + ' · 서초 관내 주요 집회 ' + rg[2] + '건(경찰청이 올린 「주요」 집회만 · 신고 인원은 신고값)' });
    return { title: '📅 행사 · 축제 · 집회', rows: rows, src: [D.src('ev'), D.src('rally')].filter(Boolean).join(' / ') };
  }

  // 📝 개요 — 여러 갈래에서 **이미 있는 값**만 골라 한 문단으로(출발 지역 고르기에서 쓴다)
  this.overview = function (p, name) {
    var C = G.city, nd = C.nearestNode(p.x, p.z), parts = [];
    var fr = C.frameAt(p.x, p.z, 0), rd = roadOf(p);
    parts.push((name || C.nodeName(nd)) + '은(는) ' + (fr && fr.name ? fr.name.replace(/\(.*$/, '') : (rd.name || '')) + ' 쪽' + (fr && fr.limit && fr.limit < 900 ? '(제한 ' + fr.limit + 'km/h)' : '') + '이다.');
    if (G.pop && G.pop.ready && G.pop.ready()) { var dg = G.pop.dongOf(nd); if (dg && dg.name) { var mx = G.pop.mix ? G.pop.mix(dg) : null; parts.push('행정동은 ' + dg.name + (dg.tot ? '(주민 ' + num(dg.tot) + '명' + (mx ? ' · 어린이 ' + Math.round(mx.kidShare * 100) + '% · 70세 이상 ' + Math.round(mx.seniorShare * 100) + '%' : '') + ')' : '') + '.'); } }
    var L = G.layers, st = L && L.nodeStat ? L.nodeStat(nd.i, nd.j) : null;
    if (st && st.total) { var all = L.realNodes ? L.realNodes().slice().sort(function (a, b) { return b.total - a.total; }) : []; var rank = 0; all.forEach(function (n, i) { if (n.key === nd.i + ',' + nd.j) rank = i + 1; }); parts.push('교차로 사고 ' + num(st.total) + '건(사망 ' + (st.death || 0) + ')' + (rank ? ' — 서초 교차로 ' + all.length + '곳 중 ' + rank + '위' : '') + '.'); }
    var D = G.citydata;
    if (D && D.ready()) {
      var sp = D.volSpot(rd.axis, rd.idx, p.x, p.z), v = sp ? D.volAt(sp, new Date()) : null;
      if (v) parts.push(TYPE_KO[v.type] + ' 하루 ' + num(v.day) + '대가 지나고 ' + v.peakH + '시가 가장 붐빈다(' + sp.name + ').');
      var cams = D.camerasNear(p.x, p.z, toU(500)); if (cams.length) parts.push('반경 500m 무인 단속 카메라 ' + cams.length + '대.');
      var ev = D.eventsNear(p.x, p.z, toU(1200), new Date(), 0); if (ev.length) parts.push('오늘 가까이 행사 ' + ev.length + '건(' + ev[0].e.t.slice(0, 24) + ' 등).');
      var pat = D.rallyPattern().filter(function (o) { return o.x != null && Math.hypot(o.x - p.x, o.z - p.z) <= toU(1200); });
      if (pat.length) parts.push('최근 두 달 주요 집회가 ' + pat.map(function (o) { return o.place.replace(/<.*?>/g, '').trim() + ' ' + o.n + '회'; }).join(', ') + ' 있었다.');
    }
    var sw = (C.subways || []).filter(function (s) { return Math.hypot(s.x - p.x, s.z - p.z) <= toU(600); }).map(function (s) { return s.name; });
    if (sw.length) parts.push('가까운 역: ' + sw.join(' · ') + '.');
    var RB = G.realBuild && G.realBuild.named ? G.realBuild.named() : [];
    var big = RB.filter(function (b) { return b.ar > 1500 && Math.hypot(b.x - p.x, b.z - p.z) <= toU(500); }).sort(function (a, b) { return b.ar - a.ar; }).map(function (b) { return b.name; }).filter(function (nm, k, arr) { var h = nm.split(' ')[0]; for (var q = 0; q < k; q++) if (arr[q].split(' ')[0] === h) return false; return true; }).slice(0, 4);   // 「법원종합청사 · 법원종합청사 4별관」 같은 겹침은 한 번만
    if (big.length) parts.push('주변 큰 건물: ' + big.join(' · ') + '.');
    return parts.join(' ');
  };

  // ── 모으기 ─────────────────────────────────────────────────────────────
  this.query = function (pos) {
    var p = pos || at(); if (!p) return null;
    var secs = [secWhere(p), secPlaces(p), secTraffic(p), secSafety(p), secEvents(p), secPeople(p), secSignal(p), secWork(p), secHeritage(p)].filter(Boolean);
    last = { at: p, secs: secs, when: new Date() };
    return last;
  };
  this.last = function () { return last; };

  // opts(v0.10.44): { at:{x,z}, title, overview:true, buttons:[{label, fn}] } — 출발 지역 고르기가 이 창을 그 자리 기준으로 연다
  this.open = function (opts) {
    opts = opts || {};
    var q = self.query(opts.at); if (!q) return false;
    var card = EL('hereCard'); if (!card) return false;
    var h = '<div class="hr-head"><b>' + esc(opts.title || '📍 이 자리') + '</b><button class="hr-x" id="hereClose">' + (opts.closeLabel || '닫기') + '</button></div>';
    if (opts.buttons && opts.buttons.length) h += '<div class="hr-btns">' + opts.buttons.map(function (b, i) { return '<button class="hr-b" data-hb="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div>';
    if (opts.overview) h += '<div class="hr-sec hr-ov"><div class="hr-t">📝 개요</div><div class="hr-ovt">' + esc(self.overview(q.at, opts.name)) + '</div></div>';
    if (!q.secs.length) {
      h += '<div class="hr-empty">이 자리에 대해 이 지도가 가진 자료가 없습니다.<br>자료를 넣으면 그날 바로 여기에 뜹니다.</div>';
    }
    // 갈래마다 앞 세 줄만 보이고 나머지는 「자세히」(소유자 「필요한 경우 아주 자세히」)
    q.secs.forEach(function (s, si) {
      var more = s.rows.length - 3;
      h += '<div class="hr-sec" data-hs="' + si + '"><div class="hr-t">' + esc(s.title) + '</div>';
      s.rows.forEach(function (r, ri) {
        h += '<div class="hr-r' + (ri >= 3 ? ' hr-more' : '') + '"><span class="hr-k">' + esc(r.k) + '</span><span class="hr-v">' + esc(r.v).replace(/\n/g, '<br>') + '</span></div>';
      });
      if (more > 0) h += '<button class="hr-det" data-det="' + si + '">자세히 ▼ (' + more + '줄 더)</button>';
      if (s.src) h += '<div class="hr-src">자료 · ' + esc(s.src) + '</div>';
      h += '</div>';
    });
    h += '<div class="hr-foot">이 지도가 품고 있는 자료를 그 자리 기준으로 모아 보인 것입니다. 없는 값은 지어내지 않습니다.</div>';
    card.innerHTML = h;
    card.className = 'on';
    open = true;
    document.body.classList.add('hereon');
    if (!opts.at) pulseAt(q.at);
    var x = EL('hereClose'); if (x) x.addEventListener('click', function (e) { e.stopPropagation(); self.close(); if (opts.onClose) opts.onClose(); });
    card.querySelectorAll('[data-det]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); var sec = b.parentNode, full = sec.classList.toggle('full'); b.textContent = full ? '접기 ▲' : b.textContent.replace('접기 ▲', '').replace(/^.*$/, '자세히 ▼'); }); });
    card.querySelectorAll('[data-hb]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); var f = opts.buttons[+b.getAttribute('data-hb')]; if (f && f.fn) f.fn(); }); });
    card.scrollTop = 0;
    if (TG.audio && TG.audio.ui) TG.audio.ui();
    return true;
  };
  // 📍 가까운 교차로 바닥에 번지는 고리(v0.10.58) — 창이 열려 있는 동안. 사고가 많을수록 붉게(교차로 집계가 있을 때).
  var ring = null, ringRaf = 0;
  function pulseAt(at) {
    stopPulse();
    if (!window.THREE || !G.scene || !G.city || !at || G.state !== 'play') return;
    var nd = G.city.nearestNode(at.x, at.z); if (!nd) return;
    var tot = 0; try { var rn = G.layers && G.layers.realNodes ? G.layers.realNodes() : null; (rn || []).forEach(function (r) { if (r.key === nd.i + "," + nd.j) tot = r.total || 0; }); } catch (e) {}
    var col = tot >= 200 ? 0xff2d2d : tot >= 80 ? 0xff7a1a : 0xffc21a;
    var geo = new THREE.RingGeometry(9, 12, 48); geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    ring = new THREE.Mesh(geo, mat); ring.renderOrder = 5;
    var y = G.terrain && G.terrain.groundAt ? G.terrain.groundAt(nd.x, nd.z) : 0; ring.position.set(nd.x, y + 0.35, nd.z); G.scene.add(ring);
    var t0 = performance.now();
    (function f() { if (!ring) return; var k = ((performance.now() - t0) / 1600) % 1; ring.scale.setScalar(0.5 + k * 1.6); mat.opacity = 0.75 * (1 - k); ringRaf = requestAnimationFrame(f); })();
  }
  function stopPulse() { if (ringRaf) cancelAnimationFrame(ringRaf); ringRaf = 0; if (ring) { G.scene && G.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); ring = null; } }
  this.close = function () {
    stopPulse();
    var card = EL('hereCard'); if (card) card.className = '';
    open = false; document.body.classList.remove('hereon');
  };
  this.toggle = function () { return open ? (self.close(), false) : self.open(); };
  this.isOpen = function () { return open; };
};
