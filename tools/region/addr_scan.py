# 데이터 압축지도 v0.10.100 — OSM(Geofabrik south-korea pbf · ODbL)에서 도로명주소(addr:street+housenumber) 23만·이름에 경로당이 든 점을 뽑는다(경로당 주소 → 자리). pbf 는 C:/Users/knpth/osmwork/kr.pbf(libosmium 이 한글 경로를 못 연다).
import osmium, json, sys
B = (126.6, 36.9, 127.9, 38.3)
class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__(); s.kyr = []; s.addr = {}; s.na = 0
    def put(s, t, lon, lat):
        n = t.get('name', '')
        if any(w in n for w in ('경로당', '노인정', '경로회관')): s.kyr.append([n, round(lon, 6), round(lat, 6), t.get('addr:street', ''), t.get('addr:housenumber', '')])
        st, hn = t.get('addr:street'), t.get('addr:housenumber')
        if st and hn:
            s.na += 1; s.addr.setdefault(st + ' ' + hn, [round(lon, 6), round(lat, 6), t.get('addr:city', '') + ' ' + t.get('addr:district', '')])
    def node(s, n):
        if n.tags and n.location.valid() and B[0] < n.location.lon < B[2] and B[1] < n.location.lat < B[3]: s.put(n.tags, n.location.lon, n.location.lat)
    def area(s, a):
        if not a.tags: return
        try:
            r = next(iter(a.outer_rings())); xs = [p.lon for p in r]; ys = [p.lat for p in r]
        except Exception: return
        lon, lat = sum(xs) / len(xs), sum(ys) / len(ys)
        if B[0] < lon < B[2] and B[1] < lat < B[3]: s.put(a.tags, lon, lat)
h = H(); h.apply_file('kr.pbf', locations=True)
print('kyr', len(h.kyr), 'addr', h.na, len(h.addr))
json.dump({'kyr': h.kyr, 'addr': h.addr}, open('addr_scan.json', 'w', encoding='utf-8'), ensure_ascii=False)
