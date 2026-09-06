# 로컬 확인용 정적 서버(개발 보조, 빌드 도구 아님). 게임 폴더를 http://localhost:8765/ 로 서빙한다.
# 사용: 실행.bat 더블클릭, 또는 PowerShell 에서  powershell -ExecutionPolicy Bypass -File tools\serve.ps1
param([int]$Port = 8765)
$Root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "순찰길: $Root 를 http://localhost:$Port/ 로 서빙 중 (이 창을 닫으면 멈춥니다)"
$mime = @{ ".html" = "text/html; charset=utf-8"; ".js" = "application/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"; ".md" = "text/plain; charset=utf-8"; ".txt" = "text/plain; charset=utf-8" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path -eq "/") { $path = "/index.html" }
  $file = Join-Path $Root ($path -replace "/", "\")
  $res = $ctx.Response
  try {
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      if ($mime[$ext]) { $res.ContentType = $mime[$ext] } else { $res.ContentType = "application/octet-stream" }
      $res.Headers.Add("Cache-Control", "no-store")
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 500 }
  $res.Close()
}
