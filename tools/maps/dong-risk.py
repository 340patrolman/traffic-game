# -*- coding: utf-8 -*-
"""동네(행정동)별 사고율(ROADMAP 「③ 지표 = 분자÷분모」 둘째 판 · v0.10.132)

분자: TAAS 2016~2025 서초 사고 100m 칸(../datamap/data/taas10-seocho.json) — 칸 가운데가 든 행정동에 더한다(경계 칸은 근사).
분모: 주민(행안부 주민등록 · data/pop-seocho.json) · 생활인구 하루 평균(서울시 생활인구 · ../datamap/data/pubdata-seocho.json livepop — 평일 5 + 주말 2 가중) · 넓이(km²).
나오는 값: 한 해 평균 사고 · 1만 명당(주민 · 생활인구) · 보행자 사고 1만 명당 · km² 당 · 사망자 · 해마다 건수.

⚠ 생활인구는 「그 동에 머문 사람」(통신 기반 추정)이지 도로를 지난 사람 수가 아니다 · 간선도로 사고는 길 양쪽 동 중 칸 가운데가 든 쪽 하나에만 들어간다 · 인과가 아니라 「어디를 먼저 볼까」.
사고 자료는 시뮬 입력에 쓰지 않는다(교정의 답).

출력: data/dong-risk-seocho.json (schema tg-dong-risk/1)
"""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DM = os.path.join(os.path.dirname(ROOT), 'datamap', 'data')
LAT0 = 37.49


def inside(x, y, ring):
    c = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def in_poly(x, y, polys):
    for poly in polys:            # poly = [바깥 고리, 구멍…]
        if inside(x, y, poly[0]) and not any(inside(x, y, h) for h in poly[1:]):
            return True
    return False


def ring_area(ring):
    kx = 88800.0; ky = 111000.0
    s = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % len(ring)]
        s += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky)
    return abs(s) / 2.0


def main():
    dongs = json.load(io.open(os.path.join(ROOT, 'data', 'dong-seocho.json'), encoding='utf-8'))['dong']
    pop = {d['name']: d for d in json.load(io.open(os.path.join(ROOT, 'data', 'pop-seocho.json'), encoding='utf-8'))['dong']}
    pub = json.load(io.open(os.path.join(DM, 'pubdata-seocho.json'), encoding='utf-8'))['livepop']
    t10 = json.load(io.open(os.path.join(DM, 'taas10-seocho.json'), encoding='utf-8'))
    years = list(range(2016, 2026))
    out = []
    for d in dongs:
        area = sum(ring_area(p[0]) - sum(ring_area(h) for h in p[1:]) for p in d['polys']) / 1e6
        lp = pub['dong'].get(d['name'])
        live = None
        if lp:
            live = round((5 * sum(lp['wd']) / 24.0 + 2 * sum(lp['we']) / 24.0) / 7.0)
        out.append({'name': d['name'], 'code': d['code'], 'km2': round(area, 2), 'res': pop.get(d['name'], {}).get('tot'),
                    'live': live, 'acc': 0, 'y': [0] * 10, 'dead': 0, 'sev': 0, 'ped': 0, 'bike': 0, 'pm': 0, 'moto': 0, 'night': 0,
                    'fatal': 0, '_p': d['polys']})
    miss = 0
    for c in t10['cells']:
        lat, lon = c[0], c[1]
        hit = None
        for o in out:
            if in_poly(lon, lat, o['_p']):
                hit = o; break
        if not hit:
            miss += sum(c[2:12]); continue
        n = sum(c[2:12])
        hit['acc'] += n
        for k in range(10): hit['y'][k] += c[2 + k]
        hit['dead'] += c[12]; hit['sev'] += c[13]; hit['ped'] += c[14]; hit['bike'] += c[15]; hit['pm'] += c[16]; hit['moto'] += c[17]; hit['night'] += c[18]
    fmiss = 0
    for f in t10['fatal']:
        lat, lon = f[16], f[17]
        for o in out:
            if in_poly(lon, lat, o['_p']):
                o['fatal'] += 1; break
        else:
            fmiss += 1
    for o in out:
        del o['_p']
        yr = o['acc'] / 10.0
        o['perYr'] = round(yr, 1)
        o['perRes'] = round(yr / o['res'] * 1e4, 1) if o['res'] else None
        o['perLive'] = round(yr / o['live'] * 1e4, 1) if o['live'] else None
        o['pedPerLive'] = round(o['ped'] / 10.0 / o['live'] * 1e4, 2) if o['live'] else None
        o['perKm2'] = round(yr / o['km2'], 1) if o['km2'] else None
    out.sort(key=lambda o: -(o['perLive'] or 0))
    res = {
        'schema': 'tg-dong-risk/1',
        'source': {
            'acc': t10['source'] + ' · 100m 칸 가운데가 든 동에 더함',
            'res': '행정안전부 주민등록 인구통계 행정동별(2026년 8월 · data/pop-seocho.json)',
            'live': (pub.get('source') or '서울시 생활인구(행정동)') + ' · ' + str(pub.get('month') or '') + ' · 시간대 평균을 평일 5 + 주말 2 로 가중한 하루 평균',
            'area': '통계청 SGIS 행정동 경계(vuski/admdongkor 20260701) 넓이 — 평면 근사',
        },
        'years': '2016~2025', 'yearList': years,
        'method': '한 해 평균 사고(10년 ÷ 10) ÷ 분모 × 1만 · 보행자 = 보행자 피해 사고',
        'note': '생활인구는 그 동에 머문 사람(추정)이지 도로를 지난 사람이 아니다 · 경계·간선 사고는 칸 가운데가 든 동 하나에만 · 인과가 아니라 먼저 볼 순서 · 사고 자료는 시뮬 입력에 쓰지 않는다',
        'unassigned': miss, 'fatalUnassigned': fmiss,
        'dong': out,
    }
    io.open(os.path.join(ROOT, 'data', 'dong-risk-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(res, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('dongs', len(out), 'assigned', sum(o['acc'] for o in out), 'miss', miss, 'fatal miss', fmiss)
    for o in out:
        print(o['name'], o['acc'], o['res'], o['live'], o['perRes'], o['perLive'], o['pedPerLive'], o['perKm2'], o['fatal'])


if __name__ == '__main__':
    main()
