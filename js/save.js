// localStorage — 키는 반드시 tg_ 접두사. tb_ 키는 읽지도 쓰지도 않는다(같은 origin에 다른 앱이 있다).
TG.save = (function () {
  var PREFIX = 'tg_';
  function key(k) {
    if (k.indexOf('tb_') === 0) throw new Error('[TG] tb_ 키 접근 금지: ' + k);
    return k.indexOf(PREFIX) === 0 ? k : PREFIX + k;
  }
  function get(k, def) {
    try {
      var raw = localStorage.getItem(key(k));
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }
  function set(k, v) {
    try { localStorage.setItem(key(k), JSON.stringify(v)); } catch (e) { /* 프라이빗 모드 등: 저장 없이 진행 */ }
  }
  function keys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) {}
    return out;
  }
  return { get: get, set: set, keys: keys, PREFIX: PREFIX };
})();
