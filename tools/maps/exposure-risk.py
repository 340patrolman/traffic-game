# -*- coding: utf-8 -*-
"""노출 대비 사고(ROADMAP 「③ 지표 = 분자÷분모」 첫 판 · v0.10.131)

교차로마다 실제 사고(TAAS 2016~2025 · 둘레 150m · data/taas-time-seocho.json 의 tot)를
그 교차로의 노출(하루 교통량 조사 · 버스·지하철 승하차 · data/node-activity-seocho.json)로 설명되는 만큼과 견준다.

  log(사고+1) = b0 + b1·log(교통량+1) + b2·log(승하차+1)   (최소제곱 · 교통량 조사가 있는 교차로만)
  배수 = 실제 사고 ÷ 노출로 본 예상 사고 = exp(잔차)

배수가 1 보다 크면 「사람·차가 많아서」로는 설명이 안 되는 몫이 있다 — 도로 모양·신호·회전 동선 같은 다른 까닭을 볼 후보.
⚠ 18곳 남짓의 작은 표본 · 교통량은 가까운 조사 지점 값을 여러 교차로가 나눠 쓴다(근사) · 인과가 아니라 「어디를 먼저 볼까」의 순서다.
사고 자료는 시뮬 입력에 쓰지 않는다(교정의 답) — 이 파일은 화면 참고용이다.

출력: data/exposure-risk-seocho.json (schema tg-exposure-risk/1)
"""
import io, json, math, os, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def ols(X, y):
    n, k = len(y), len(X[0])
    M = [[sum(X[r][i] * X[r][j] for r in range(n)) for j in range(k)] + [sum(X[r][i] * y[r] for r in range(n))] for i in range(k)]
    for c in range(k):
        p = max(range(c, k), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(k):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [M[r][j] - f * M[c][j] for j in range(k + 1)]
    return [M[i][k] / M[i][i] for i in range(k)]


def main():
    act = json.load(io.open(os.path.join(ROOT, 'data', 'node-activity-seocho.json'), encoding='utf-8'))
    taas = json.load(io.open(os.path.join(ROOT, 'data', 'taas-time-seocho.json'), encoding='utf-8'))
    A = {(n['i'], n['j']): n for n in act['nodes']}
    rows, skip = [], []
    for t in taas['nodes']:
        a = A.get((t['i'], t['j']))
        if not a or a.get('met') is False:
            continue
        if a.get('veh') is None:
            skip.append(t['name'])
            continue
        rows.append({'i': t['i'], 'j': t['j'], 'name': t['name'], 'acc': t['tot'], 'ped': t.get('ped', 0),
                     'veh': a['veh'], 'people': (a.get('bus') or 0) + (a.get('sub') or 0)})
    X = [[1.0, math.log(r['veh'] + 1), math.log(r['people'] + 1)] for r in rows]
    y = [math.log(r['acc'] + 1) for r in rows]
    b = ols(X, y)
    pred = [sum(bi * xi for bi, xi in zip(b, x)) for x in X]
    res = [yi - pi for yi, pi in zip(y, pred)]
    my = statistics.mean(y)
    r2 = 1 - sum(r * r for r in res) / sum((v - my) ** 2 for v in y)
    for r, p, e in zip(rows, pred, res):
        r['expect'] = round(math.exp(p) - 1)
        r['x'] = round(math.exp(e), 2)
    rows.sort(key=lambda r: -r['x'])
    out = {
        'schema': 'tg-exposure-risk/1',
        'source': {'acc': taas.get('source'), 'years': taas.get('years'), 'exposure': act.get('source')},
        'method': 'log(사고+1) = b0 + b1·log(하루 교통량+1) + b2·log(하루 승하차+1) · 최소제곱 · 배수 = 실제 ÷ 노출로 본 예상',
        'coef': [round(v, 3) for v in b], 'r2': round(r2, 2), 'n': len(rows),
        'skip': skip,
        'note': '작은 표본(교통량 조사가 있는 교차로만) · 교통량은 가까운 조사 지점 값을 나눠 쓴 근사 · 인과가 아니라 먼저 볼 순서 · 사고 자료는 시뮬 입력에 쓰지 않는다',
        'nodes': rows,
    }
    p = os.path.join(ROOT, 'data', 'exposure-risk-seocho.json')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('n', len(rows), 'R2', out['r2'], 'coef', out['coef'], 'skip', skip)
    for r in rows[:5]:
        print(r['name'], r['acc'], r['expect'], r['x'])


if __name__ == '__main__':
    main()
