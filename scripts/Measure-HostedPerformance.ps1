param(
  [string]$BaseUrl = "https://mitchell.navigrader.com",
  [string]$Username,
  [string]$Password,
  [int]$Iterations = 1,
  [string]$OutputJsonPath,
  [string[]]$Endpoints = @(
    "/api/me",
    "/api/account",
    "/api/admin/workspace-config",
    "/api/students",
    "/api/instructors",
    "/api/subjects",
    "/api/courses",
    "/api/course-sections",
    "/api/enrollments",
    "/api/section-enrollments",
    "/api/schedule-blocks",
    "/api/student-schedule-blocks",
    "/api/school-years",
    "/api/quarters",
    "/api/attendance",
    "/api/instruction-actuals",
    "/api/flex-blocks",
    "/api/daily-breaks",
    "/api/holidays",
    "/api/plans",
    "/api/grade-types",
    "/api/grading-criteria",
    "/api/tests"
  )
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Username)) {
  $Username = $env:HSM_PERF_USERNAME
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = $env:HSM_PERF_PASSWORD
}

if ([string]::IsNullOrWhiteSpace($Username)) {
  $Username = $env:HSM_HOSTED_SMOKE_USERNAME
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = $env:HSM_HOSTED_SMOKE_PASSWORD
}

if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
  throw "Hosted performance credentials are required. Pass -Username/-Password, set HSM_PERF_USERNAME/HSM_PERF_PASSWORD, or set HSM_HOSTED_SMOKE_USERNAME/HSM_HOSTED_SMOKE_PASSWORD."
}

if ($Iterations -lt 1) {
  throw "Iterations must be 1 or greater."
}

function Write-Step {
  param([string]$Message)
  Write-Host "[hosted-perf] $Message"
}

function Get-ContentByteCount {
  param([string]$Content)
  if ([string]::IsNullOrEmpty($Content)) {
    return 0
  }
  return [System.Text.Encoding]::UTF8.GetByteCount($Content)
}

function Get-JsonRowCount {
  param([string]$Content)
  if ([string]::IsNullOrWhiteSpace($Content)) {
    return $null
  }

  try {
    $parsed = $Content | ConvertFrom-Json -ErrorAction Stop
  }
  catch {
    return $null
  }

  if ($parsed -is [array]) {
    return $parsed.Count
  }

  foreach ($propertyName in @("rows", "items", "data", "records")) {
    $property = $parsed.PSObject.Properties[$propertyName]
    if ($property -and $null -ne $property.Value) {
      if ($property.Value -is [array]) {
        return $property.Value.Count
      }
      return @($property.Value).Count
    }
  }

  return $null
}

function Invoke-MeasuredJsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body,
    [string]$Endpoint,
    [int]$Iteration
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

  $statusCode = $null
  $content = ""
  $errorMessage = $null
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $response = Invoke-WebRequest @request
    $statusCode = [int]$response.StatusCode
    $content = [string]$response.Content
  }
  catch {
    $errorMessage = $_.Exception.Message
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($_.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
      $content = [string]$_.ErrorDetails.Message
    }
  }
  finally {
    $stopwatch.Stop()
  }

  $payloadBytes = Get-ContentByteCount -Content $content
  $rowCount = Get-JsonRowCount -Content $content

  return [PSCustomObject]@{
    Iteration = $Iteration
    Endpoint = $Endpoint
    Method = $Method
    StatusCode = $statusCode
    ElapsedMs = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 1)
    PayloadBytes = $payloadBytes
    PayloadKb = [math]::Round($payloadBytes / 1KB, 1)
    RowCount = $rowCount
    Error = $errorMessage
  }
}

$base = $BaseUrl.TrimEnd("/")
$allResults = @()
$loginResults = @()

for ($iteration = 1; $iteration -le $Iterations; $iteration++) {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

  Write-Step "Iteration $iteration of ${Iterations}: logging in to $base as $Username"
  $loginResult = Invoke-MeasuredJsonRequest `
    -Method "POST" `
    -Url "$base/api/auth/login" `
    -Session $session `
    -Body @{ username = $Username; password = $Password } `
    -Endpoint "/api/auth/login" `
    -Iteration $iteration

  $loginResults += $loginResult
  if ($loginResult.StatusCode -lt 200 -or $loginResult.StatusCode -ge 300) {
    throw "Login failed with status $($loginResult.StatusCode): $($loginResult.Error)"
  }

  Write-Step "Login completed in $($loginResult.ElapsedMs) ms with $($loginResult.PayloadKb) KB returned"

  foreach ($endpoint in $Endpoints) {
    $result = Invoke-MeasuredJsonRequest `
      -Method "GET" `
      -Url "$base$endpoint" `
      -Session $session `
      -Endpoint $endpoint `
      -Iteration $iteration
    $allResults += $result

    $rowSummary = if ($null -ne $result.RowCount) { ", rows $($result.RowCount)" } else { "" }
    $statusSummary = if ($result.StatusCode) { $result.StatusCode } else { "failed" }
    Write-Step "$endpoint -> $statusSummary in $($result.ElapsedMs) ms, $($result.PayloadKb) KB$rowSummary"
  }
}

$totalEndpointMs = [math]::Round((($allResults | Measure-Object -Property ElapsedMs -Sum).Sum), 1)
$totalPayloadBytes = (($allResults | Measure-Object -Property PayloadBytes -Sum).Sum)
$totalPayloadKb = [math]::Round($totalPayloadBytes / 1KB, 1)
$slowest = $allResults | Sort-Object -Property ElapsedMs -Descending | Select-Object -First 10

Write-Host ""
Write-Step "Slowest endpoints"
$slowest | Format-Table -AutoSize Iteration, Endpoint, StatusCode, ElapsedMs, PayloadKb, RowCount

Write-Step "Measured endpoint total: $totalEndpointMs ms across $($allResults.Count) calls"
Write-Step "Measured endpoint payload total: $totalPayloadKb KB"

if (-not [string]::IsNullOrWhiteSpace($OutputJsonPath)) {
  $report = [PSCustomObject]@{
    BaseUrl = $base
    StartedAt = (Get-Date).ToUniversalTime().ToString("o")
    Iterations = $Iterations
    LoginResults = $loginResults
    EndpointResults = $allResults
    TotalEndpointMs = $totalEndpointMs
    TotalEndpointPayloadBytes = $totalPayloadBytes
  }

  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputJsonPath -Encoding UTF8
  Write-Step "Wrote JSON report to $OutputJsonPath"
}
