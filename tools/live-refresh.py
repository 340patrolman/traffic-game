# -*- coding: utf-8 -*-
# 실시간 한 장 다시 굽기 + 올리기(소유자 허락 2026-10-04 「권고대로 모두 진행」) — Windows 작업 스케줄러가 정해진 시각에 부른다.
#   data/live-seocho.json 하나만 커밋한다(작업 중인 다른 파일은 건드리지 않는다). 올리기가 막히면(앞서 간 커밋 등) 이번 판은 건너뛴다.
import os, sys, subprocess, time, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREA = os.path.join(os.path.dirname(ROOT), '07_API키', 'out', 'seoul_places_121', '서울시 주요 121장소 영역')
LOG = os.path.join(os.path.dirname(ROOT), '07_API키', 'out', 'live-refresh.log')
def log(m):
    with open(LOG, 'a', encoding='utf-8') as f: f.write(time.strftime('%Y-%m-%d %H:%M ') + m + '\n')
def git(*a):
    r = subprocess.run(['git'] + list(a), cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return r.returncode, (r.stdout + r.stderr).strip()
try:
    spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
    fb.bake_live(AREA)
    c, o = git('diff', '--quiet', '--', 'data/live-seocho.json')
    if c == 0: log('바뀐 것 없음'); sys.exit(0)
    c, o = git('commit', '-m', 'live: 실시간 도시데이터 다시 받음 ' + time.strftime('%m-%d %H:%M') + '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>', '--', 'data/live-seocho.json')
    if c: log('커밋 실패 ' + o[-200:]); sys.exit(1)
    c, o = git('push', '-q', 'origin', 'main')
    log('올림' if c == 0 else '올리기 실패(다음 판에 같이 올라간다) ' + o[-200:])
except Exception as e:
    log('오류 ' + repr(e)[:300]); sys.exit(1)
