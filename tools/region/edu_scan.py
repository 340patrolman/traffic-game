# 데이터 압축지도 v0.10.102 — OSM(Geofabrik pbf · ODbL)에서 학교·대학·유치원·어린이집·경로당 점(서울·경기 상자)
import osmium, json
B = (126.5, 36.85, 127.9, 38.3)
class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.o = []
    def put(s, t, lon, lat):
        n = t.get('name') or ''; a = t.get('amenity') or ''
        if a in ('school', 'university', 'college', 'kindergarten', 'childcare') or any(w in n for w in ('경로당', '노인정', '경로회관')):
            if n: s.o.append([n, a, round(lon, 6), round(lat, 6), t.get('isced:level', '') or t.get('school:level', '')])
    def node(s, n):
        if n.tags and B[0] < n.location.lon < B[2] and B[1] < n.location.lat < B[3]: s.put(n.tags, n.location.lon, n.location.lat)
    def area(s, a):
        t = a.tags
        if not t or not t.get('name'): return
        if not (t.get('amenity') in ('school', 'university', 'college', 'kindergarten', 'childcare') or any(w in t.get('name') for w in ('경로당', '노인정', '경로회관'))): return
        try:
            r = next(iter(a.outer_rings())); xs = [p.lon for p in r]; ys = [p.lat for p in r]
        except Exception: return
        lon, lat = sum(xs) / len(xs), sum(ys) / len(ys)
        if B[0] < lon < B[2] and B[1] < lat < B[3]: s.put(t, lon, lat)
h = H(); h.apply_file('kr.pbf', locations=True); print(len(h.o))
json.dump(h.o, open('edu_scan.json', 'w', encoding='utf-8'), ensure_ascii=False)
