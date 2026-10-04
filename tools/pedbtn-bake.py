# -*- coding: utf-8 -*-
# 보행자작동신호기(v0.10.85) — 서울시 교통안전시설물 보행자작동신호기(OA-15545 · API trafficSafetyA077PInfo · 교통운영과 · EPSG:5186 m)
# 받은 원자료 07_API키/out/season/ped_button.json(서울 전체) → 지도 범위만 · 30m 안 버튼을 한 자리로 묶는다(횡단보도 양쪽 버튼)
import json, math, os
from pyproj import Transformer
KB = r'C:\Users\knpth\Desktop\지식베이스'
def P(lon, lat): return ((lon - 127.01) * 88800, -(lat - 37.49) * 111000)
tr = Transformer.from_crs(5186, 4326, always_xy=True)
rows = json.load(open(os.path.join(KB, '07_API키', 'out', 'season', 'ped_button.json'), encoding='utf-8'))
pts = []
for r in rows:
    try: x, y = float(r['XCRD']), float(r['YCRD'])
    except Exception: continue
    lon, lat = tr.transform(x, y)
    if not (126.935 <= lon <= 127.135 and 37.395 <= lat <= 37.535): continue
    gx, gz = P(lon, lat)
    pts.append([gx, gz, (r.get('PDSN_OPER_SGNM_MNG_NO2') or r.get('PDSN_OPER_SGNM_MNG_NO1') or '').strip(), (r.get('INSTL_YMD') or '').strip(), (r.get('STTS_CD') or '').strip()])
G = []
for p in pts:
    for g in G:
        if math.hypot(g['x'] / g['n'] - p[0], g['z'] / g['n'] - p[1]) < 30: g['x'] += p[0]; g['z'] += p[1]; g['n'] += 1; g['ids'].append(p[2]); g['y'] = g['y'] or p[3]; break
    else: G.append({'x': p[0], 'z': p[1], 'n': 1, 'ids': [p[2]], 'y': p[3]})
items = [[round(g['x'] / g['n']), round(g['z'] / g['n']), g['n'], ' · '.join(i for i in g['ids'] if i)[:80], g['y']] for g in G]
out = {'schema': 'tg-pedbtn/1', 'source': '서울시 보행자작동신호기 관련 정보(OA-15545 · 서울특별시 교통실 교통운영과 · 공공누리 1유형 · 2026-10-04 받음) — 30m 안 버튼을 한 자리로 묶음',
       'cols': ['x', 'z', '버튼 수', '관리번호', '설치일'], 'items': items, 'raw': len(pts), 'seoul': len(rows)}
open(os.path.join(KB, 'traffic-game', 'data', 'pedbtn-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('seoul', len(rows), 'in map', len(pts), 'spots', len(items))
