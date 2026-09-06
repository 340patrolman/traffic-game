(function () {
  var R = [];
  function out(k, v) { R.push(k + ' = ' + (typeof v === 'string' ? v : JSON.stringify(v))); }
  function done() { var pre = document.createElement('pre'); pre.id = 'VOUT'; pre.textContent = R.join('\n'); document.body.appendChild(pre); document.title = 'PROBE-DONE'; }
  function run() {
    try {
      var T = TG.test, G = T.game, ter = T.terrain, city = T.city; G.timeLeft = 99999;
      T.start('sedan'); T.step(0.3); T.setSpawning(false); T.clearTraffic(); T.clearPeds(); G.timeLeft = 99999;
      function probe(name, x, z, h) {
        T.setPlayer(x, z, h, 10); T.override({ throttle: 0.6, brake: 0, steer: 0, reverse: 0 }); T.step(4);
        var s = T.state(), p = s.player, ty = ter.heightAt(p.x, p.z);
        var rec = { end: name, x: Math.round(p.x), z: Math.round(p.z), y: Math.round(p.y * 10) / 10, kmh: Math.round(p.kmh), offroad: p.offroad, slope: Math.round(p.slope * 100) / 100, frame: s.frame.kind + '/' + s.frame.name, water: ter.isWater(p.x, p.z) };
        // 돌아오기 시도: 반대로 돌아 8초 가속
        T.setPlayer(p.x, p.z, h + Math.PI, 0); T.override({ throttle: 1, brake: 0, steer: 0 }); T.step(8);
        var s2 = T.state(); rec.back = { x: Math.round(s2.player.x), z: Math.round(s2.player.z), y: Math.round(s2.player.y * 10) / 10, kmh: Math.round(s2.player.kmh), onRoad: s2.frame.onRoad, slope: Math.round(s2.player.slope * 100) / 100 };
        out('probe', rec);
      }
      // 링크 끝(램프·연결로): 양 끝에서 바깥으로
      for (var k = 0; k < ter.links.length; k++) {
        var L = ter.links[k]; if (L.closed) continue;
        var A = L.P(0), B = L.P(1), h0 = Math.atan2(A.x - B.x, A.z - B.z);
        probe(L.id + ' start-out', B.x + B.rx * 2, B.z + B.rz * 2, h0);
        var C = L.P(L.N - 1), D = L.P(L.N - 2), h1 = Math.atan2(C.x - D.x, C.z - D.z);
        probe(L.id + ' end-out', D.x + D.rx * 2, D.z + D.rz * 2, h1);
        out('link', { id: L.id, N: L.N, oneWay: !!L.oneWay, start: [Math.round(A.x), Math.round(A.z), Math.round(A.y * 10) / 10], end: [Math.round(C.x), Math.round(C.z), Math.round(C.y * 10) / 10] });
      }
      // 격자 도로 끝 10곳
      var xs = city.xs, zs = city.zs, EXT = city.EXT;
      for (var i = 0; i < xs.length; i++) { probe('v' + i + ' south', xs[i] - 2, zs[zs.length - 1] + EXT - 8, 0); probe('v' + i + ' north', xs[i] + 2, zs[0] - EXT + 8, Math.PI); }
      for (var j = 0; j < zs.length; j++) { probe('h' + j + ' east', xs[xs.length - 1] + EXT - 8, zs[j] + 2, Math.PI / 2); probe('h' + j + ' west', xs[0] - EXT + 8, zs[j] - 2, -Math.PI / 2); }
      done();
    } catch (e) { out('ERR', e.message + '\n' + e.stack); done(); }
  }
  window.addEventListener('load', function () { setTimeout(run, 2500); });
})();
