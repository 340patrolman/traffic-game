@echo off
rem 순찰길 로컬 실행: 작은 정적 서버를 띄우고 브라우저를 연다(빌드 없음). 이 창을 닫으면 서버가 멈춘다.
cd /d "%~dp0"
start "" "http://localhost:8765/"
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1"
