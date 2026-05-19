param(
  [string]$PublicBaseUrl = "http://192.168.1.210",
  [string]$ControlBaseUrl = "http://192.168.1.210/control-api",
  [string]$AppHost = "debian@192.168.1.200",
  [int]$AppPort = 3000,
  [string]$HostedUsername,
  [string]$HostedPassword,
  [switch]$IncludeControlPlane,
  [string]$ControlUsername,
  [string]$ControlPassword
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($HostedUsername)) {
  $HostedUsername = $env:HSM_HOSTED_SMOKE_USERNAME
}

if ([string]::IsNullOrWhiteSpace($HostedPassword)) {
  $HostedPassword = $env:HSM_HOSTED_SMOKE_PASSWORD
}

if ([string]::IsNullOrWhiteSpace($ControlUsername)) {
  $ControlUsername = $env:HSM_CONTROL_SMOKE_USERNAME
}

if ([string]::IsNullOrWhiteSpace($ControlPassword)) {
  $ControlPassword = $env:HSM_CONTROL_SMOKE_PASSWORD
}

if ([string]::IsNullOrWhiteSpace($HostedUsername) -or [string]::IsNullOrWhiteSpace($HostedPassword)) {
  throw "Hosted release gate credentials are required. Pass -HostedUsername/-HostedPassword or set HSM_HOSTED_SMOKE_USERNAME and HSM_HOSTED_SMOKE_PASSWORD."
}

function Write-Step {
  param([string]$Message)
  Write-Host "[release-gate] $Message"
}

function Assert-CommandSucceeded {
  param([string]$Description)
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed."
  }
}

function Test-Http200 {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get
  }
  catch {
    throw "Request to $Url failed: $($_.Exception.Message)"
  }
  if ($response.StatusCode -ne 200) {
    throw "Expected HTTP 200 from $Url but got: $($response.StatusCode)"
  }
}

Write-Step "Checking APP001 local app health through SSH"
$null = & ssh $AppHost "curl -sS http://127.0.0.1:$AppPort/health"
Assert-CommandSucceeded "APP001 local health check"

Write-Step "Checking public hosted health"
Test-Http200 -Url "$($PublicBaseUrl.TrimEnd('/'))/health"

Write-Step "Checking public legal pages"
Test-Http200 -Url "$($PublicBaseUrl.TrimEnd('/'))/terms"
Test-Http200 -Url "$($PublicBaseUrl.TrimEnd('/'))/privacy"

if ($IncludeControlPlane) {
  Write-Step "Checking public control-api health"
  Test-Http200 -Url "$($ControlBaseUrl.TrimEnd('/'))/health"
}

Write-Step "Running hosted tenant-app smoke pass"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Test-HostedSmoke.ps1") `
  -BaseUrl $PublicBaseUrl `
  -Username $HostedUsername `
  -Password $HostedPassword
Assert-CommandSucceeded "Hosted smoke pass"

if ($IncludeControlPlane) {
  if (-not $ControlUsername -or -not $ControlPassword) {
    throw "IncludeControlPlane was specified, but control-plane credentials were not provided. Pass -ControlUsername/-ControlPassword or set HSM_CONTROL_SMOKE_USERNAME and HSM_CONTROL_SMOKE_PASSWORD."
  }

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  Write-Step "Checking control-plane operator login"
  $loginResponse = Invoke-WebRequest -UseBasicParsing -WebSession $session `
    -Uri "$($ControlBaseUrl.TrimEnd('/'))/api/operator/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body (@{ username = $ControlUsername; password = $ControlPassword } | ConvertTo-Json -Compress)
  $loginBody = $loginResponse.Content | ConvertFrom-Json
  if (-not $loginBody.user) {
    throw "Control-plane login did not return a user payload."
  }

  Write-Step "Checking control-plane session"
  $meResponse = Invoke-WebRequest -UseBasicParsing -WebSession $session `
    -Uri "$($ControlBaseUrl.TrimEnd('/'))/api/operator/me" `
    -Method Get
  $meBody = $meResponse.Content | ConvertFrom-Json
  if (-not $meBody.user) {
    throw "Control-plane session read did not return a user payload."
  }
}

Write-Step "Release gate succeeded."
