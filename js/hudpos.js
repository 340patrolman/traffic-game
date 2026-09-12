// 화면 배치 — 도구·단추·칸을 **길게 눌러** 끌어 옮긴다.
//
// 소유자: 「도구와 단추들이 움직여질 수 있으면 좋겠어. 화면을 최대한 가리지 않게 배치할 수 있어야 하거든.」
// 그리고 「여기서 보이는 모든 버튼들과 화면에서 움직일 수 있게 해줘. 화면배치 완료·처음배치로 단추는
// 작동하지도 않고 저 자체가 필요없어.」 → **배치 모드와 안내 띠를 없앴다.** 폰에서 앱 아이콘을 옮기는 것과 같은 방식,
// 즉 **0.42초 길게 누르면 집히고**, 손을 떼면 그 자리에 놓인다. 톡 누르면 단추는 제 일을 한다(아래 되쏘기).
//
// 규칙 ① 자리는 픽셀이 아니라 **남는 공간의 비율**(0~1) — 기종·화면 크기가 바뀌어도 화면 밖으로 나가지 않는다.
//      ② 세로·가로 화면은 크기가 달라서(css) 자리도 **따로** 기억한다. ③ 저장은 이 기기에만(`tg_hudPos`).
TG.hudpos = (function () {
  var POS = TG.save.get('hudPos', {}) || {}, items = [], HOLD = 420, MOVE = 12, held = null;
  function orient() { return document.body.classList.contains('portrait') ? 'port' : 'land'; }
  function key(el) { return el.id + ':' + orient(); }
  function freeW(el) { return Math.max(0, window.innerWidth - (el.offsetWidth || 40)); }
  function freeH(el) { return Math.max(0, window.innerHeight - (el.offsetHeight || 40)); }
  function apply(el) {
    var p = POS[key(el)];
    if (!p) { el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; el.classList.remove('moved'); return; }
    el.classList.add('moved');   // position:fixed · margin 0 (css) — 줄에서 빠져나와 제 자리에 선다
    el.style.left = Math.round(TG.clamp(p.fx, 0, 1) * freeW(el)) + 'px';
    el.style.top = Math.round(TG.clamp(p.fy, 0, 1) * freeH(el)) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
  }
  function applyAll() { for (var i = 0; i < items.length; i++) apply(items[i]); }
  // 톡 누른 것으로 판명되면 **원래 기능을 다시 쏜다** — 아래로 내려보내지 않고 잡아 두었기 때문이다.
  // (input.bindTap 은 pointerdown 에서 바로 실행한다. 길게 누를지 톡 누를지는 그때 알 수 없다.)
  function refire(el, x, y) {
    if (!window.PointerEvent) return;
    ['pointerdown', 'pointerup'].forEach(function (t) {
      var ev = new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 91, clientX: x, clientY: y });
      ev.tgPass = true; el.dispatchEvent(ev);
    });
  }
  function register(id) {
    var el = document.getElementById(id); if (!el || items.indexOf(el) >= 0) return null;
    items.push(el);
    el.addEventListener('pointerdown', function (e) {
      if (e.tgPass) return;                                   // 내가 되쏜 탭 — 그대로 지나간다
      if (!window.PointerEvent) return;                        // 구형 브라우저: 옮기기를 포기하고 단추 기능만 남긴다
      e.preventDefault(); e.stopPropagation();
      var r = el.getBoundingClientRect();
      var st = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, hold: false, off: false };
      st.timer = setTimeout(function () {
        if (st.off) return;
        st.hold = true; held = el; el.classList.add('dragging');
        if (!el.classList.contains('moved')) { el.classList.add('moved'); el.style.left = Math.round(r.left) + 'px'; el.style.top = Math.round(r.top) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; }
        if (TG.game && TG.game.buzz) TG.game.buzz(25);          // 「집혔다」는 손끝 신호
        if (TG.hud && TG.hud.hint) TG.hud.hint('끌어서 원하는 자리에 놓으세요 · 처음 자리로는 메뉴에서');
      }, HOLD);
      try { el.setPointerCapture(e.pointerId); } catch (x) { }
      function move(ev) {
        if (ev.pointerId !== st.id) return;
        ev.preventDefault();
        if (!st.hold) {
          if (Math.abs(ev.clientX - st.sx) > MOVE || Math.abs(ev.clientY - st.sy) > MOVE) { st.off = true; clearTimeout(st.timer); }   // 손가락이 미끄러졌다 — 단추도 옮기기도 아니다
          return;
        }
        el.style.left = Math.round(TG.clamp(ev.clientX - st.ox, 0, freeW(el))) + 'px';
        el.style.top = Math.round(TG.clamp(ev.clientY - st.oy, 0, freeH(el))) + 'px';
      }
      function up(ev) {
        if (ev.pointerId !== st.id) return;
        clearTimeout(st.timer);
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (st.hold) {
          el.classList.remove('dragging'); held = null;
          POS[key(el)] = { fx: (parseFloat(el.style.left) || 0) / Math.max(1, freeW(el)), fy: (parseFloat(el.style.top) || 0) / Math.max(1, freeH(el)) };
          TG.save.set('hudPos', POS);
        } else if (!st.off) refire(el, ev.clientX, ev.clientY);   // 톡 누름 = 제 기능
      }
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }, true);   // 캡처 단계 — 단추의 제 기능(bindTap)보다 먼저 잡는다
    apply(el);
    return el;
  }
  // body.portrait 는 main 의 resize() 가 바꾼다 — 그 뒤(다음 틱)에 다시 잡는다
  window.addEventListener('resize', function () { setTimeout(applyAll, 0); });
  return {
    register: function (ids) { for (var i = 0; i < ids.length; i++) register(ids[i]); return items.length; },
    apply: applyAll,
    holding: function () { return !!held; },
    moved: function () { for (var k in POS) if (POS.hasOwnProperty(k)) return true; return false; },
    reset: function () { POS = {}; TG.save.set('hudPos', POS); applyAll(); },
    items: function () { return items.slice(); },
  };
})();
