$ErrorActionPreference = "Stop"
$root = "e:\agt\111\skills\moxing-dialectical-trading\site"
$port = 8765
$listener = New-Object System.Net.HttpListener
# 绑定所有网卡, 手机同 WiFi 可访问 (需管理员权限运行)
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()

# 显示访问地址
Write-Host "=============================================="
Write-Host " 辩证法交易 站点已启动"
Write-Host " 本机访问:   http://localhost:$port/"
try {
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match "^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)" } |
    ForEach-Object { Write-Host (" 手机访问:   http://" + $_.IPAddress + ":$port/") }
} catch { }
Write-Host " Ctrl+C 停止"
Write-Host "=============================================="

function Get-Mime($file) {
  switch -Wildcard ($file) {
    "*.html" { "text/html; charset=utf-8" }
    "*.css"  { "text/css; charset=utf-8" }
    "*.js"   { "application/javascript; charset=utf-8" }
    "*.json" { "application/json; charset=utf-8" }
    "*.png"  { "image/png" }
    "*.svg"  { "image/svg+xml" }
    "*.ico"  { "image/x-icon" }
    default  { "application/octet-stream" }
  }
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $url = $ctx.Request.Url.AbsolutePath
      if ($url -eq "/") { $url = "/index.html" }
      $file = Join-Path $root $url.TrimStart("/")
      if (Test-Path $file -PathType Leaf) {
        # 防目录穿越 (忽略大小写)
        $parent = (Resolve-Path -LiteralPath (Split-Path $file)).Path
        if (-not ($parent.ToLower().StartsWith($root.ToLower()))) {
          $ctx.Response.StatusCode = 403
        } else {
          $bytes = [System.IO.File]::ReadAllBytes($file)
          $ctx.Response.ContentType = Get-Mime $file
          $ctx.Response.ContentLength64 = $bytes.Length
          # 数据文件不缓存, 保证手机端刷新即见最新存档
          $ctx.Response.Headers["Cache-Control"] = "no-cache"
          $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
      } else {
        $ctx.Response.StatusCode = 404
      }
    } catch {
      try { $ctx.Response.StatusCode = 500 } catch { }
    }
    try { $ctx.Response.Close() } catch { }
  }
} finally {
  $listener.Stop()
}
