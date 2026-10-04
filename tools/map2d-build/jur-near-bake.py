# -*- coding: utf-8 -*-
# 이웃 경찰서 관할(v0.10.89) — 용산·동작·관악·강남·수서·송파·과천·성남수정서
# 원자료: 13_관할경계(별표2 → 행정동 라벨 labmap.tsv · 관서 번호 = ps_pts.csv 순서 · 경계 = SGIS 행정동 hjd20260701.geojson)
# 서초·방배 두 존(반포 현장 기준 · jur-bake.py)은 그대로 두고 그 뒤에 이웃 존을 붙인다(다시 돌리면 이웃 존만 갈아 끼운다)
import csv, json, os
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
KB = r'C:\Users\knpth\Desktop\지식베이스'
J = os.path.join(KB, '13_관할경계')
OUT = os.path.join(KB, 'traffic-game', 'data', 'jur-seocho.json')
WANT = {5: 'yongsan', 11: 'dongjak', 18: 'gwanak', 17: 'gangnam', 29: 'suseo', 25: 'songpa', 53: 'gwacheon', 37: 'sujeong', 15: 'geumcheon'}
ps = list(csv.DictReader(open(os.path.join(J, '원자료', 'ps_pts.csv'), encoding='utf-8-sig')))
labels = [l.strip() for l in open(os.path.join(J, '결과', 'labels.txt'), encoding='utf-8')]
lab = {}
for l in open(os.path.join(J, '결과', 'labmap.tsv'), encoding='utf-8'):
    a, b = l.rstrip('\n').split('\t'); lab[a] = b
feats = {}
for l in open(os.path.join(J, '원자료', 'hjd20260701.geojson'), encoding='utf-8'):
    if '"adm_cd2"' not in l: continue
    l = l.strip().rstrip(',')
    try: f = json.loads(l)
    except Exception: continue
    feats[f['properties']['adm_cd2'][:10] if len(f['properties']['adm_cd2']) > 10 else f['properties']['adm_cd2']] = f
    feats[f['properties']['adm_cd']] = f
groups = {k: [] for k in WANT}; mixed = {k: [] for k in WANT}
for cd, li in lab.items():
    # 라벨 = 「기본 관서들(쉼표 = 어느 서인지 못 가림) ~ 번지로 섞인 관서들」(match.ps1)
    L = labels[int(li)] if li.isdigit() and int(li) < len(labels) else ''
    dft, _, exc = L.partition('~')
    sts = [int(x) for x in dft.split(',') if x != '']
    ex = [int(x) for x in exc.split(',') if x != '']
    f = feats.get(cd)
    if not f or not sts: continue
    for k0 in sts:
        if k0 not in WANT: continue
        groups[k0].append(f)
        oth = [i for i in sts if i != k0] + ex
        if oth: mixed[k0].append((f['properties']['adm_nm'].split()[-1], [ps[i]['nm'] for i in oth]))
def ring_list(geom):
    gs = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
    out = []
    for g in sorted(gs, key=lambda g: -g.area):
        if g.area < 2e-7: continue
        out.append([[round(x, 6), round(y, 6)] for x, y in g.simplify(0.00006).exterior.coords])
    return out
d = json.load(open(OUT, encoding='utf-8'))
d['zones'] = [z for z in d['zones'] if z['id'] in ('seocho', 'bangbae', 'banpo')]
d['stations'] = [s for s in d['stations'] if s['name'] in ('서울서초경찰서', '서울방배경찰서')]
for k, zid in WANT.items():
    fs = groups[k]
    if not fs: print('no dongs', ps[k]['nm']); continue
    geom = unary_union([shape(f['geometry']).buffer(0) for f in fs]).buffer(0)
    dongs = sorted(f['properties']['adm_nm'].split()[-1] for f in fs)
    note = '별표2 → 행정동(라벨) 기준 · 동 ' + str(len(dongs)) + '곳'
    if mixed[k]: note += ' · 번지로 다른 서와 섞인 동: ' + ', '.join(n + '(' + '·'.join(m) + ')' for n, m in mixed[k])
    d['zones'].append({'id': zid, 'name': ps[k]['nm'], 'dongs': dongs, 'note': note, 'rings': ring_list(geom), 'near': True})
    d['stations'].append({'name': ps[k]['nm'], 'lat': float(ps[k]['la']), 'lon': float(ps[k]['lo']), 'addr': '', 'tel': ps[k]['tel'], 'gu': ps[k]['gu'], 'near': True})
    print(ps[k]['nm'], len(dongs), 'mixed', len(mixed[k]))
d['area'] = '서울 서초경찰서·방배경찰서(현장 기준) + 이웃 경찰서 관할(용산·동작·관악·금천·강남·수서·송파·과천·성남수정 — 별표2 행정동 근사)'
s = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w', encoding='utf-8', newline='\n').write(s)
print('bytes', len(s.encode()))
