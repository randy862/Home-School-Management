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
$apiOutLog = Join-Path $runtimeDir "api.out.log"
$apiErrLog = Join-Path $runtimeDir "api.err.log"
$webOutLog = Join-Path $runtimeDir "web.out.log"
$webErrLog = Join-Path $runtimeDir "web.err.log"

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
  $procId = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $procId) { return $false }
  $proc = Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue
  return [bool]$proc
}

function Start-IfNeeded {
  param(
    [string]$Name,
    [string]$PidFile,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [string]$OutLogPath,
    [string]$ErrLogPath
  )

  if (Is-Running -PidFile $PidFile) {
    $runningPid = Get-Content -LiteralPath $PidFile | Select-Object -First 1
    Write-Host "$Name already running (PID $runningPid)"
    return
  }

  if (Test-Path -LiteralPath $OutLogPath) { Remove-Item -LiteralPath $OutLogPath -Force }
  if (Test-Path -LiteralPath $ErrLogPath) { Remove-Item -LiteralPath $ErrLogPath -Force }

  $proc = Start-Process -FilePath $FilePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $OutLogPath `
    -RedirectStandardError $ErrLogPath `
    -PassThru

  $proc.Id | Set-Content -LiteralPath $PidFile -Encoding ascii
  Write-Host "Started $Name (PID $($proc.Id))"
}

$nodeExe = Resolve-CommandPath -CommandName "node" -FallbackPath "C:\Program Files\nodejs\node.exe"
Start-IfNeeded `
  -Name "API listener" `
  -PidFile $apiPidFile `
  -FilePath $nodeExe `
  -Arguments @("`"$(Join-Path $repoRoot "server\src\app.js")`"") `
  -WorkingDirectory (Join-Path $repoRoot "server") `
  -OutLogPath $apiOutLog `
  -ErrLogPath $apiErrLog

Start-IfNeeded `
  -Name "Web server" `
  -PidFile $webPidFile `
  -FilePath $nodeExe `
  -Arguments @("`"$(Join-Path $repoRoot "scripts\static-web-server.js")`"", "`"$repoRoot`"", [string]$WebPort) `
  -WorkingDirectory $repoRoot `
  -OutLogPath $webOutLog `
  -ErrLogPath $webErrLog

try {
  $healthy = $false
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    try {
      $health = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/health" -f $ApiPort) -Method Get -TimeoutSec 3
      if ($health.ok -eq $true) {
        $healthy = $true
        break
      }
    } catch {
      # Keep retrying while API boots.
    }
  }
  if ($healthy) {
    Write-Host "API health check passed on http://127.0.0.1:$ApiPort/health"
  } else {
    Write-Warning "API health check failed. See $apiOutLog and $apiErrLog"
  }
} catch {
  Write-Warning "API health check failed. See $apiOutLog and $apiErrLog"
}

$appUrl = "http://127.0.0.1:$WebPort/web/"
Write-Host "App URL: $appUrl"
Write-Host "Logs:"
Write-Host "  API out: $apiOutLog"
Write-Host "  API err: $apiErrLog"
Write-Host "  Web out: $webOutLog"
Write-Host "  Web err: $webErrLog"

if (-not $NoBrowser) {
  Start-Process $appUrl | Out-Null
}
