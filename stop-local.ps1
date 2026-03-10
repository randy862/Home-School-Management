$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $repoRoot ".runtime"

function Stop-ByPidFile {
  param(
    [string]$Name,
    [string]$PidFile
  )

  if (-not (Test-Path -LiteralPath $PidFile)) {
    Write-Host "$Name is not running (no pid file)."
    return
  }

  $procId = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $procId) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "$Name pid file was empty and has been removed."
    return
  }

  $proc = Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $proc.Id -Force
    Write-Host "Stopped $Name (PID $procId)."
  } else {
    Write-Host "$Name process not found for PID $procId."
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-ByPidFile -Name "API listener" -PidFile (Join-Path $runtimeDir "api.pid")
Stop-ByPidFile -Name "Web server" -PidFile (Join-Path $runtimeDir "web.pid")
