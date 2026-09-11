// 화면 배치 — 도구·단추를 끌어 옮긴다.
//
// 소유자: 「도구와 단추들이 움직여질 수 있으면 좋겠어. 화면을 최대한 가리지 않게 배치할 수 있어야 하거든.
// 미니맵도 움직이고 경광등 단속 앰프 블랙박스 무전 모두.」
// 폰은 기종마다 화면 비율·노치·손 위치가 달라서, 어느 한 배치를 옳다고 정할 수가 없다 —
// 그러니 **쓰는 사람이 정한다.** 자리는 기기에만 저장한다(tg_hudPos).
//
// 규칙 세 가지.
// ① 평소에는 끌리지 않는다. 운전 중에 단추가 따라 움직이면 그게 더 큰 사고다 —
//    **배치 모드**(일시정지 › 🧩 화면 배치)에서만 끌린다. 그 동안 단추의 원래 기능은 눌리지 않는다.
// ② 자리는 픽셀이 아니라 **남는 공간의 비율**(0~1)로 저장한다. 기종·화면 크기가 바뀌어도 화면 밖으로 나가지 않는다.
// ③ 세로·가로 화면은 단추 크기가 달라서(css) 자리도 **따로** 기억한다.
TG.hudpos = (function () {
  var POS = TG.save.get('hudPos', {}) || {}, items = [], editing = false, onEditEnd = null;
  function orient() { return document.body.classList.contains('portrait') ? 'port' : 'land'; }
  function key(el) { return el.id + ':' + orient(); }
  function freeW(el) { return Math.max(0, window.innerWidth - (el.offsetWidth || 40)); }
  function freeH(el) { return Math.max(0, window.innerHeight - (el.offsetHeight || 40)); }
  function apply(el) {
    var p = POS[key(el)];
    if (!p) { el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; el.classList.remove('moved'); return; }
    el.classList.add('moved');   // position:fixed · margin 0 (css) — flex 줄에서 빠져나와 제 자리에 선다
    el.style.left = Math.round(TG.clamp(p.fx, 0, 1) * freeW(el)) + 'px';
    el.style.top = Math.round(TG.clamp(p.fy, 0, 1) * freeH(el)) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
  }
  function applyAll() { for (var i = 0; i < items.length; i++) apply(items[i]); }
  function register(id) {
    var el = document.getElementById(id); if (!el || items.indexOf(el) >= 0) return null;
    items.push(el);
    el.addEventListener('pointerdown', function (e) {
      if (!editing) return;                       // 평소에는 아무 것도 하지 않는다(단추는 제 일을 한다)
      e.preventDefault(); e.stopPropagation();
      var r = el.getBoundingClientRect();
      if (!el.classList.contains('moved')) { el.classList.add('moved'); el.style.left = Math.round(r.left) + 'px'; el.style.top = Math.round(r.top) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; }
      var drag = { ox: e.clientX - r.left, oy: e.clientY - r.top };
      el.classList.add('dragging');
      try { el.setPointerCapture(e.pointerId); } catch (x) { }
      function move(ev) {
        if (ev.pointerId !== e.pointerId) return;
        ev.preventDefault();
        el.style.left = Math.round(TG.clamp(ev.clientX - drag.ox, 0, freeW(el))) + 'px';
        el.style.top = Math.round(TG.clamp(ev.clientY - drag.oy, 0, freeH(el))) + 'px';
      }
      function up(ev) {
        if (ev.pointerId !== e.pointerId) return;
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        POS[key(el)] = { fx: (parseFloat(el.style.left) || 0) / Math.max(1, freeW(el)), fy: (parseFloat(el.style.top) || 0) / Math.max(1, freeH(el)) };
        TG.save.set('hudPos', POS);
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
    edit: function (on, done) {
      editing = !!on; onEditEnd = done || onEditEnd;
      document.body.classList.toggle('layout-edit', editing);
      if (!editing && onEditEnd) { var f = onEditEnd; onEditEnd = null; f(); }
      return editing;
    },
    editing: function () { return editing; },
    moved: function () { for (var k in POS) if (POS.hasOwnProperty(k)) return true; return false; },
    reset: function () { POS = {}; TG.save.set('hudPos', POS); applyAll(); },
    items: function () { return items.slice(); },
  };
})();
