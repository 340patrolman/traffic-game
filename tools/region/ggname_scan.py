# 데이터 압축지도 v0.10.100 — OSM 에서 경기 역·시청·터미널·동네 이름 점을 뽑는다(부동산원 경기 상권 이름 → 대표 자리 · 다음 판).
import osmium, json
B = (126.5, 36.85, 127.9, 38.3)
WANT = {'station', 'halt', 'townhall', 'bus_station', 'neighbourhood', 'quarter', 'suburb', 'village', 'town', 'city'}
class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.o = []
    def put(s, t, lon, lat):
        n = t.get('name');
        if not n: return
        k = t.get('railway') or t.get('amenity') or t.get('place') or t.get('public_transport') or ''
        if k in WANT or t.get('railway') == 'station' or (t.get('office') == 'government'):
            s.o.append([n, k, round(lon, 6), round(lat, 6)])
    def node(s, n):
        if n.tags and B[0] < n.location.lon < B[2] and B[1] < n.location.lat < B[3]: s.put(n.tags, n.location.lon, n.location.lat)
    def area(s, a):
        t = a.tags
        if not t or not t.get('name') or not (t.get('amenity') in ('townhall', 'bus_station') or t.get('railway') == 'station'): return
        try:
            r = next(iter(a.outer_rings())); xs = [p.lon for p in r]; ys = [p.lat for p in r]
        except Exception: return
        lon, lat = sum(xs) / len(xs), sum(ys) / len(ys)
        if B[0] < lon < B[2] and B[1] < lat < B[3]: s.put(t, lon, lat)
h = H(); h.apply_file('kr.pbf', locations=True); print(len(h.o))
json.dump(h.o, open('ggnames.json', 'w', encoding='utf-8'), ensure_ascii=False)
