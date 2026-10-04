# -*- coding: utf-8 -*-
# v0.10.104 실시간 인파·카드 다시 굽기는 데이터 압축지도 저장소(../datamap)로 옮겼다.
# Windows 작업 스케줄러 「SEOUL-PATROL 실시간 지도 갱신」이 이 경로를 부르므로 길잡이로 남긴다 — 진짜는 datamap/tools/live-refresh.py(그 저장소에 커밋·푸시).
import os, runpy
D = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'datamap', 'tools', 'live-refresh.py')
if os.path.exists(D): runpy.run_path(D, run_name='__main__')
