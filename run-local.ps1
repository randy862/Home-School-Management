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
$webUrl = "http://127.0.0.1:$WebPort/web/"

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
  param(
    [string]$PidFile,
    [string]$ExpectedProcessName = ""
  )
  if (-not (Test-Path -LiteralPath $PidFile)) { return $false }
  $procId = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $procId) { return $false }
  $proc = Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  if ($ExpectedProcessName -and $proc.ProcessName -ne $ExpectedProcessName) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $false
  }
  return $true
}

function Format-Argument {
  param([string]$Value)
  if ($null -eq $Value) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + ($Value -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
}

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

function Test-WebServer {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Get-StartupHint {
  param(
    [string]$Name,
    [string]$Url,
    [string]$OutLogPath,
    [string]$ErrLogPath
  )

  return "$Name did not respond on $Url. Check logs: OUT=$OutLogPath ERR=$ErrLogPath"
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$Attempts = 10,
    [int]$DelayMs = 500
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    if (Test-WebServer -Url $Url) {
      return $true
    }
    Start-Sleep -Milliseconds $DelayMs
  }

  return $false
}

function Start-IfNeeded {
  param(
    [string]$Name,
    [string]$PidFile,
    [string]$ExpectedProcessName,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [string]$OutLogPath,
    [string]$ErrLogPath
  )

  if (Is-Running -PidFile $PidFile -ExpectedProcessName $ExpectedProcessName) {
    $runningPid = Get-Content -LiteralPath $PidFile | Select-Object -First 1
    Write-Host "$Name already running (PID $runningPid)"
    return
  }

  if (Test-Path -LiteralPath $OutLogPath) { Remove-Item -LiteralPath $OutLogPath -Force }
  if (Test-Path -LiteralPath $ErrLogPath) { Remove-Item -LiteralPath $ErrLogPath -Force }

  $argumentLine = ($Arguments | ForEach-Object { Format-Argument $_ }) -join " "
  $proc = Start-Process -FilePath $FilePath `
    -ArgumentList $argumentLine `
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
  -ExpectedProcessName "node" `
  -FilePath $nodeExe `
  -Arguments @("src\app.js") `
  -WorkingDirectory (Join-Path $repoRoot "server") `
  -OutLogPath $apiOutLog `
  -ErrLogPath $apiErrLog

if (Test-WebServer -Url $webUrl) {
  $existingWebPid = Get-ListeningPid -Port $WebPort
  if ($existingWebPid) {
    $existingWebPid | Set-Content -LiteralPath $webPidFile -Encoding ascii
    Write-Host "Web server already running (PID $existingWebPid)"
  } else {
    Write-Host "Web server already responding on $webUrl"
  }
} else {
  if (Test-Path -LiteralPath $webOutLog) { Remove-Item -LiteralPath $webOutLog -Force }
  if (Test-Path -LiteralPath $webErrLog) { Remove-Item -LiteralPath $webErrLog -Force }

  $launchCommand = 'start "" /min "{0}" scripts\static-web-server.js . {1} 1>>"{2}" 2>>"{3}"' -f $nodeExe, $WebPort, $webOutLog, $webErrLog
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c $launchCommand" `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden | Out-Null

  $webHealthy = Wait-ForUrl -Url $webUrl
  $listeningWebPid = if ($webHealthy) { Get-ListeningPid -Port $WebPort } else { $null }

  if ($listeningWebPid) {
    $listeningWebPid | Set-Content -LiteralPath $webPidFile -Encoding ascii
    Write-Host "Started Web server (PID $listeningWebPid)"
    Write-Host "Web health check passed on $webUrl"
  } elseif ($webHealthy) {
    Remove-Item -LiteralPath $webPidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Started Web server"
    Write-Host "Web health check passed on $webUrl"
  } else {
    Remove-Item -LiteralPath $webPidFile -Force -ErrorAction SilentlyContinue
    Write-Warning (Get-StartupHint -Name "Web server" -Url $webUrl -OutLogPath $webOutLog -ErrLogPath $webErrLog)
  }
}

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
    Write-Warning (Get-StartupHint -Name "API listener" -Url "http://127.0.0.1:$ApiPort/health" -OutLogPath $apiOutLog -ErrLogPath $apiErrLog)
  }
} catch {
  Write-Warning (Get-StartupHint -Name "API listener" -Url "http://127.0.0.1:$ApiPort/health" -OutLogPath $apiOutLog -ErrLogPath $apiErrLog)
}

$appUrl = $webUrl
Write-Host "App URL: $appUrl"
Write-Host "Logs:"
Write-Host "  API out: $apiOutLog"
Write-Host "  API err: $apiErrLog"
Write-Host "  Web out: $webOutLog"
Write-Host "  Web err: $webErrLog"

if (-not $NoBrowser) {
  Start-Process $appUrl | Out-Null
}
