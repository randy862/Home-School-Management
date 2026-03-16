$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $repoRoot ".runtime"

function Get-ListeningPid {
  param([int]$Port)
  $lines = netstat -ano -p TCP 2>$null
  foreach ($line in $lines) {
    if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
      return [int]$matches[1]
    }
  }
  return $null
}

function Stop-ByPidFile {
  param(
    [string]$Name,
    [string]$PidFile,
    [int]$Port = 0
  )

  if (-not (Test-Path -LiteralPath $PidFile)) {
    if ($Port -gt 0) {
      $listeningPid = Get-ListeningPid -Port $Port
      if ($listeningPid) {
        Stop-Process -Id $listeningPid -Force
        Write-Host "Stopped $Name listening on port $Port (PID $listeningPid)."
        return
      }
    }
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
    if ($Port -gt 0) {
      $listeningPid = Get-ListeningPid -Port $Port
      if ($listeningPid) {
        Stop-Process -Id $listeningPid -Force
        Write-Host "Stopped $Name listening on port $Port (PID $listeningPid)."
      } else {
        Write-Host "$Name process not found for PID $procId."
      }
    } else {
      Write-Host "$Name process not found for PID $procId."
    }
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-ByPidFile -Name "API listener" -PidFile (Join-Path $runtimeDir "api.pid") -Port 3000
Stop-ByPidFile -Name "Web server" -PidFile (Join-Path $runtimeDir "web.pid") -Port 5500
