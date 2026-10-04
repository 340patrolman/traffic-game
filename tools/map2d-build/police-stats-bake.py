# -*- coding: utf-8 -*-
# 경찰서 통계(v0.10.89) — 서울 31개 서: 현장 단속 기록 5개 해 · 112 출동 2011~2025 · 5대 범죄 2025 · 지구대·파출소·치안센터 수 / 경기남부: 5대 범죄 2022(과천·성남수정)
# 원자료(07_API키/단속통계_20260929/seoul_years · 공공데이터포털 · 전부 이용허락범위 제한 없음):
#   15097296 서울청 경찰서별 교통법규 위반 단속 수(2016·2021~2024 · 단속 한 건씩 위반법조항·차종·용도·장소 → agg.json 으로 집계)
#   15114082 경찰서별 112신고출동 현황(2011~2025) · 15054738 경찰서별 5대범죄 발생 검거 현황(2025) · 15114084 경찰서별 지역경찰 관서 현황(2018~2025)
#   15126908 경기도남부경찰청 5대범죄 발생검거 건수(2022) · 조문 제목 = 도로교통법 원문(국가법령정보 DRF MST 281875)
import csv, io, json, os, re
D = r'C:\Users\knpth\Desktop\지식베이스\07_API키\단속통계_20260929\seoul_years'
def rd(fn):
    b = open(os.path.join(D, fn), 'rb').read()
    for e in ('utf-8-sig', 'cp949'):
        try: return list(csv.reader(io.StringIO(b.decode(e))))
        except Exception: pass
agg = json.load(open(os.path.join(D, 'agg.json'), encoding='utf-8'))
titles = json.load(open(os.path.join(D, 'law_titles.json'), encoding='utf-8'))
used = set()
enf = {}
for st, ys in agg.items():
    enf[st] = {}
    for y, v in ys.items():
        enf[st][y] = {'n': v['n'], 'art': v['full'][:8], 'veh': v['veh'][:6], 'pl': v['pl'][:5]}   # 조항은 항·호까지(예: 제50조4항)
        for a, _ in v['full'][:8]:
            m = re.match(r'제?(\d+)조(의\d+)?', a)
            if m: used.add(m.group(1) + (m.group(2) or ''))
call = {}; rows = rd('call.bin'); cy = rows[0][1:]
for r in rows[1:]:
    if r and r[0]: call[r[0].strip()] = [int(x) if x.strip().isdigit() else None for x in r[1:]]
crime = {}
for r in rd('crime2025.bin')[1:]:
    if len(r) < 4: continue
    st, kind, ab, n = r[0].strip(), r[1].strip().replace(',', '·'), r[2].strip(), r[3].strip()
    kind = '강간·추행' if kind.startswith('강간') else kind
    crime.setdefault(st, {}).setdefault(kind, [0, 0])[0 if ab == '발생' else 1] = int(n) if n.isdigit() else 0
box = {}; rows = rd('box.bin'); bh = rows[0][1:]
for r in rows[1:]:
    if r and r[0]: box[r[0].strip()] = [int(x) if x.strip().isdigit() else 0 for x in r[1:]]
gn = {}; rows = rd('gn_crime2022.bin'); gh = rows[0]
for r in rows[1:]:
    if not r or not r[0]: continue
    st = r[0].strip(); vals = [int(x.strip()) if x.strip().isdigit() else 0 for x in r[1:]]
    gn[st] = {'살인': vals[0:2], '강도': vals[2:4], '강간·추행': vals[4:6], '절도': vals[6:8], '폭력': vals[8:10]}
out = {'schema': 'tg-police-stats/1',
  'source': {'enf': '경찰청 서울특별시경찰청_경찰서별 교통법규 위반 단속 수(공공데이터포털 15097296 · 2016·2021~2024 파일 · 단속 한 건씩 기록 → 이 앱이 셈) — 경찰관 현장 단속 기록이다(무인 장비 단속은 들어 있지 않다). 2017~2020 파일은 공개되어 있지 않다',
             'call': '경찰청 서울특별시경찰청_경찰서별 112신고출동 현황(15114082 · 2011~2025)',
             'crime': '경찰청 서울특별시경찰청_경찰서별 5대범죄 발생 검거 현황(15054738 · 2025)',
             'box': '경찰청 서울특별시경찰청_경찰서별 지역경찰 관서 현황(15114084 · 2018~2025)',
             'gn': '경찰청 경기도남부경찰청_5대범죄 발생검거 건수(15126908 · 2022 — 공개된 마지막 해)',
             'titles': '조문 제목 = 도로교통법(국가법령정보센터 원문 · MST 281875)'},
  'license': '모두 이용허락범위 제한 없음',
  'titles': {a: titles.get(a, '') for a in sorted(used, key=lambda x: (len(x), x)) if a},
  'enf': enf, 'callYears': cy, 'call': call, 'crimeYear': 2025, 'crime': crime, 'boxCols': bh, 'box': box, 'gnYear': 2022, 'gn': gn}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(r'C:\Users\knpth\Desktop\지식베이스\traffic-game\data\police-stats.json', 'w', encoding='utf-8', newline='\n').write(s)
print('bytes', len(s.encode()), 'enf', len(enf), 'call', len(call), 'crime', len(crime), 'box', len(box), 'gn', list(gn)[:6])
