param(
  [int]$ApiPort = 3000,
  [int]$WebPort = 5500,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $repoRoot ".runtime"
$apiPidFile = Join-Path $runtimeDir "api.pid"
$webPidFile = Join-Path $runtimeDir "web.pid"
$apiLog = Join-Path $runtimeDir "api.log"
$webLog = Join-Path $runtimeDir "web.log"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".env"))) {
  if (Test-Path -LiteralPath (Join-Path $repoRoot ".env.example")) {
    Copy-Item -LiteralPath (Join-Path $repoRoot ".env.example") -Destination (Join-Path $repoRoot ".env")
    Write-Host "Created .env from .env.example. Update SQL settings in .env if needed."
  }
}

function Resolve-CommandPath {
  param(
    [string]$CommandName,
    [string]$FallbackPath = ""
  )
  $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  if ($FallbackPath -and (Test-Path -LiteralPath $FallbackPath)) { return $FallbackPath }
  throw "Required command not found: $CommandName"
}

function Is-Running {
  param([string]$PidFile)
  if (-not (Test-Path -LiteralPath $PidFile)) { return $false }
  $pid = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pid) { return $false }
  $proc = Get-Process -Id ([int]$pid) -ErrorAction SilentlyContinue
  return [bool]$proc
}

function Start-IfNeeded {
  param(
    [string]$Name,
    [string]$PidFile,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [string]$LogPath
  )

  if (Is-Running -PidFile $PidFile) {
    $runningPid = Get-Content -LiteralPath $PidFile | Select-Object -First 1
    Write-Host "$Name already running (PID $runningPid)"
    return
  }

  if (Test-Path -LiteralPath $LogPath) { Remove-Item -LiteralPath $LogPath -Force }

  $proc = Start-Process -FilePath $FilePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $LogPath `
    -RedirectStandardError $LogPath `
    -PassThru

  $proc.Id | Set-Content -LiteralPath $PidFile -Encoding ascii
  Write-Host "Started $Name (PID $($proc.Id))"
}

$nodeExe = Resolve-CommandPath -CommandName "node" -FallbackPath "C:\Program Files\nodejs\node.exe"
$npmCmd = Resolve-CommandPath -CommandName "npm.cmd" -FallbackPath "C:\Program Files\nodejs\npm.cmd"

Start-IfNeeded `
  -Name "API listener" `
  -PidFile $apiPidFile `
  -FilePath $npmCmd `
  -Arguments @("start") `
  -WorkingDirectory (Join-Path $repoRoot "server") `
  -LogPath $apiLog

Start-IfNeeded `
  -Name "Web server" `
  -PidFile $webPidFile `
  -FilePath $nodeExe `
  -Arguments @((Join-Path $repoRoot "scripts\static-web-server.js"), $repoRoot, [string]$WebPort) `
  -WorkingDirectory $repoRoot `
  -LogPath $webLog

Start-Sleep -Seconds 2

try {
  $health = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/health" -f $ApiPort) -Method Get -TimeoutSec 5
  if ($health.ok -eq $true) {
    Write-Host "API health check passed on http://127.0.0.1:$ApiPort/health"
  }
} catch {
  Write-Warning "API health check failed. See $apiLog"
}

$appUrl = "http://127.0.0.1:$WebPort/web/"
Write-Host "App URL: $appUrl"
Write-Host "Logs:"
Write-Host "  API: $apiLog"
Write-Host "  Web: $webLog"

if (-not $NoBrowser) {
  Start-Process $appUrl | Out-Null
}
