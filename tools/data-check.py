# -*- coding: utf-8 -*-
# v0.10.104 데이터 압축지도는 별도 저장소(340patrolman/datamap · 이 PC 의 ../datamap)로 옮겼다.
# 지식베이스 SessionStart 훅이 이 경로를 부르므로 길잡이로 남긴다 — 진짜 점검은 datamap/tools/data-check.py.
import os, runpy, sys
D = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'datamap', 'tools', 'data-check.py')
if os.path.exists(D): runpy.run_path(D, run_name='__main__')
else: print('📋 데이터 압축지도 자료 점검 — ../datamap 저장소가 이 PC 에 없다(git clone https://github.com/340patrolman/datamap.git)')
