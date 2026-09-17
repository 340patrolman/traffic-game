# 기준선·비교용 고정 장면 스크린샷(완성도 지시서 0절) — 크롬 DevTools 프로토콜로 **실제 화면 크기**를 흉내 내 찍는다.
#  헤드리스 --window-size 는 폭 500 아래로 줄지 않아(세로 390 이 잘렸다) CDP Emulation.setDeviceMetricsOverride 를 쓴다.
#  WebGL 은 swiftshader 로 그린다(--enable-unsafe-swiftshader — 없으면 3D 가 검게 나온다).
# 쓰는 법: powershell -File tools\shots\shoot.ps1 -Out tools\shots\baseline [-Base http://localhost:8765] [-Map seocho]
#  장면은 tools/shots/scene.js 가 ?shot=N 으로 만든다(같은 시드·같은 날씨·같은 시각). 끝나면 제목이 SHOT-READY 가 된다.
param([string]$Out = 'tools\shots\baseline', [string]$Base = 'http://localhost:8765', [string]$Map = 'seocho', [string]$Only = '', [switch]$Metrics)
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $root $Out }
New-Item -ItemType Directory -Force $outDir | Out-Null
$prof = Join-Path $env:TEMP ('tg_shots_' + [guid]::NewGuid().ToString('N'))
$port = 9333
$proc = Start-Process $chrome -ArgumentList '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio', '--hide-scrollbars',
  "--remote-debugging-port=$port", "--user-data-dir=$prof", '--window-size=900,900', 'about:blank' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
$tabs = $null
for ($i = 0; $i -lt 20 -and -not $tabs; $i++) { try { $tabs = Invoke-RestMethod "http://127.0.0.1:$port/json" } catch { Start-Sleep -Milliseconds 500 } }
$page = $tabs | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
$script:id = 0
function Cdp([string]$method, $params) {
  $script:id++
  $msg = @{ id = $script:id; method = $method; params = $(if ($params) { $params } else { @{} }) } | ConvertTo-Json -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, [Threading.CancellationToken]::None).Wait()
  $buf = New-Object byte[] 1048576
  while ($true) {
    $ms = New-Object IO.MemoryStream
    do { $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, [Threading.CancellationToken]::None); $r.Wait(); $ms.Write($buf, 0, $r.Result.Count) } while (-not $r.Result.EndOfMessage)
    $o = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
    if ($o.id -eq $script:id) { return $o }
  }
}
function Eval([string]$expr) { (Cdp 'Runtime.evaluate' @{ expression = $expr; returnByValue = $true }).result.result.value }

$SHOTS = @(
  @{ n = 1; name = 'title' }, @{ n = 2; name = 'patrol-start' }, @{ n = 3; name = 'red-wait' }, @{ n = 4; name = 'violation' },
  @{ n = 5; name = 'pullover' }, @{ n = 6; name = 'chase' }, @{ n = 7; name = 'result' }, @{ n = 8; name = 'kid-class' })
$SIZES = @(@{ tag = 'port'; w = 390; h = 844; mobile = $true }, @{ tag = 'land'; w = 844; h = 390; mobile = $true })
$perf = @()
Cdp 'Page.enable' | Out-Null
foreach ($sz in $SIZES) {
  Cdp 'Emulation.setDeviceMetricsOverride' @{ width = $sz.w; height = $sz.h; deviceScaleFactor = 1; mobile = $sz.mobile } | Out-Null
  Cdp 'Emulation.setTouchEmulationEnabled' @{ enabled = $true; maxTouchPoints = 5 } | Out-Null
  foreach ($s in $SHOTS) {
    if ($Only -and ($Only -split ',') -notcontains [string]$s.n) { continue }
    $url = "$Base/_shots.html?test=1&shot=$($s.n)&map=$Map&t=$([DateTime]::Now.Ticks)"
    Cdp 'Page.navigate' @{ url = $url } | Out-Null
    $ok = $false
    for ($k = 0; $k -lt 240; $k++) { Start-Sleep -Milliseconds 500; $t = Eval 'document.title'; if ($t -eq 'SHOT-READY' -or $t -like 'SHOT-FAIL*') { $ok = $t -eq 'SHOT-READY'; break } }
    Start-Sleep -Milliseconds 1200   # 등급 줄처럼 늦게 켜지는 화면 효과를 기다린다
    $shot = Cdp 'Page.captureScreenshot' @{ format = 'jpeg'; quality = 82 }
    $file = Join-Path $outDir ('{0}-{1}-{2}.jpg' -f $s.n, $s.name, $sz.tag)
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.result.data))
    $info = Eval 'JSON.stringify(window.__shotInfo || null)'
    $perf += [pscustomobject]@{ shot = $s.n; name = $s.name; size = $sz.tag; ok = $ok; info = $info }
    Write-Output ("{0} {1} {2} ok={3} {4}" -f $s.n, $s.name, $sz.tag, $ok, $info)
  }
}
$perf | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'shots.json')
if ($Metrics) {   # 순찰 근무 3판 자동 재생 → metrics.json (게임 시간 180초 × 3)
  Cdp 'Emulation.setDeviceMetricsOverride' @{ width = 390; height = 844; deviceScaleFactor = 1; mobile = $true } | Out-Null
  Cdp 'Page.navigate' @{ url = "$Base/_shots.html?test=1&shot=metrics&map=$Map&t=$([DateTime]::Now.Ticks)" } | Out-Null
  $mj = $null
  for ($k = 0; $k -lt 1200; $k++) { Start-Sleep -Seconds 1; $t = Eval 'document.title'; if ($t -eq 'SHOT-READY') { $mj = Eval "(document.getElementById('SOUT')||{}).textContent||''"; break }; if ($t -like 'SHOT-FAIL*') { Write-Output $t; break } }
  if ($mj) { [IO.File]::WriteAllText((Join-Path $outDir 'metrics.json'), $mj, (New-Object Text.UTF8Encoding $false)); Write-Output 'metrics.json saved' } else { Write-Output 'metrics: no result' }
}
try { $ws.Dispose() } catch {}
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
