param(
  [string]$BaseUrl = "http://192.168.1.210",
  [string]$Username,
  [string]$Password,
  [string[]]$Endpoints = @(
    "/api/me",
    "/api/subjects",
    "/api/courses",
    "/api/enrollments",
    "/api/school-years",
    "/api/quarters",
    "/api/holidays",
    "/api/daily-breaks",
    "/api/plans",
    "/api/grade-types",
    "/api/grading-criteria",
    "/api/attendance",
    "/api/tests"
  )
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Username)) {
  $Username = $env:HSM_HOSTED_SMOKE_USERNAME
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = $env:HSM_HOSTED_SMOKE_PASSWORD
}

if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
  throw "Hosted smoke credentials are required. Pass -Username/-Password or set HSM_HOSTED_SMOKE_USERNAME and HSM_HOSTED_SMOKE_PASSWORD."
}

function Write-Step {
  param([string]$Message)
  Write-Host "[hosted-smoke] $Message"
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body
  )

  $request = @{
    Uri = $Url
    Method = $Method
    WebSession = $Session
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $request.ContentType = "application/json"
    $request.Body = $Body | ConvertTo-Json -Compress
  }
  $response = Invoke-WebRequest @request
  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }
  return $response.Content | ConvertFrom-Json
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Step "Logging in to $BaseUrl as $Username"
$loginResponse = Invoke-JsonRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Session $session -Body @{
  username = $Username
  password = $Password
}

if (-not $loginResponse.user) {
  throw "Login response did not include a user payload."
}

Write-Step "Login succeeded for $($loginResponse.user.username)"

foreach ($endpoint in $Endpoints) {
  Write-Step "Checking $endpoint"
  $null = Invoke-JsonRequest -Method "GET" -Url ($BaseUrl.TrimEnd("/") + $endpoint) -Session $session
}

Write-Step "Hosted smoke pass succeeded."
