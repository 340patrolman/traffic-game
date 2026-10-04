# 데이터 압축지도 v0.10.103 — OSM(Geofabrik pbf · ODbL)에서 관공서 점(서울·경기 상자) — 이름·amenity·office 로 갈래
import osmium, json
B = (126.5, 36.85, 127.9, 38.3)
KEYW = ('주민센터', '행정복지센터', '동사무소', '세무서', '등기소', '법원', '경찰서', '지구대', '파출소', '치안센터', '교육청', '교육지원청', '구청', '시청', '군청', '도청', '검찰청', '지검', '지청', '소방서', '119안전센터', '보건소', '보건지소', '우체국', '출입국', '병무청', '고용센터', '고용노동', '선거관리위원회', '구의회', '시의회', '도의회', '읍사무소', '면사무소', '세관', '국민연금', '건강보험공단', '근로복지공단', '보훈청', '보훈지청', '관세청', '국세청', '정부청사', '헌법재판소', '감사원')
AM = ('townhall', 'courthouse', 'police', 'fire_station', 'post_office')
class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.o = []
    def put(s, t, lon, lat):
        n = t.get('name') or ''
        if not n: return
        a = t.get('amenity') or ''; of = t.get('office') or ''
        if a in AM or of in ('government', 'tax_advisor_gov') or any(w in n for w in KEYW):
            s.o.append([n, a or of, round(lon, 6), round(lat, 6), t.get('addr:street', ''), t.get('addr:housenumber', ''), t.get('phone', '')])
    def node(s, n):
        if n.tags and B[0] < n.location.lon < B[2] and B[1] < n.location.lat < B[3]: s.put(n.tags, n.location.lon, n.location.lat)
    def area(s, a):
        t = a.tags
        if not t or not t.get('name'): return
        try:
            r = next(iter(a.outer_rings())); xs = [p.lon for p in r]; ys = [p.lat for p in r]
        except Exception: return
        lon, lat = sum(xs) / len(xs), sum(ys) / len(ys)
        if B[0] < lon < B[2] and B[1] < lat < B[3]: s.put(t, lon, lat)
h = H(); h.apply_file('kr.pbf', locations=True); print(len(h.o))
json.dump(h.o, open('gov_scan.json', 'w', encoding='utf-8'), ensure_ascii=False)
