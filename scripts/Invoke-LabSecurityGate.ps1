param(
  [string]$TenantBaseUrl = "http://192.168.1.210",
  [string]$ControlBaseUrl = "http://192.168.1.210/control-api",
  [Parameter(Mandatory = $true)][string]$TenantAdminUsername,
  [Parameter(Mandatory = $true)][string]$TenantAdminPassword,
  [Parameter(Mandatory = $true)][string]$TenantStudentUsername,
  [Parameter(Mandatory = $true)][string]$TenantStudentPassword,
  [string]$ControlUsername,
  [string]$ControlPassword,
  [string]$LimitedControlUsername,
  [string]$LimitedControlPassword,
  [string]$RejectedOrigin,
  [switch]$AllowInsecureTls
)

$ErrorActionPreference = "Stop"

if ($AllowInsecureTls) {
  Write-Warning "AllowInsecureTls is enabled. Use only for lab certificates that are not trusted by this workstation."
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
  [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
}

function Write-Step {
  param([string]$Message)
  Write-Host "[lab-security-gate] $Message"
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body,
    [hashtable]$Headers = @{}
  )

  $request = @{
    Uri = $Url
    Method = $Method
    UseBasicParsing = $true
    Headers = $Headers
  }
  if ($Session) {
    $request.WebSession = $Session
  }
  if ($PSBoundParameters.ContainsKey("Body")) {
    $request.ContentType = "application/json"
    $request.Body = $Body | ConvertTo-Json -Depth 8 -Compress
  }
  $response = Invoke-WebRequest @request
  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }
  return $response.Content | ConvertFrom-Json
}

function Invoke-ExpectStatus {
  param(
    [string]$Method,
    [string]$Url,
    [int]$ExpectedStatusCode,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body,
    [hashtable]$Headers = @{}
  )

  try {
    $null = Invoke-JsonRequest -Method $Method -Url $Url -Session $Session -Body $Body -Headers $Headers
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -ne $ExpectedStatusCode) {
      throw "Expected HTTP $ExpectedStatusCode from $Url but got $status."
    }
    return
  }
  throw "Expected HTTP $ExpectedStatusCode from $Url but request succeeded."
}

function Login-Tenant {
  param([string]$Username, [string]$Password)
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-JsonRequest -Method "POST" -Url "$($TenantBaseUrl.TrimEnd('/'))/api/auth/login" -Session $session -Body @{
    username = $Username
    password = $Password
  }
  if (-not $login.user) {
    throw "Tenant login for $Username did not return a user payload."
  }
  return @{
    Session = $session
    User = $login.user
  }
}

function Login-Control {
  param([string]$Username, [string]$Password)
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-JsonRequest -Method "POST" -Url "$($ControlBaseUrl.TrimEnd('/'))/api/operator/auth/login" -Session $session -Body @{
    username = $Username
    password = $Password
  }
  if (-not $login.user) {
    throw "Control login for $Username did not return a user payload."
  }
  return @{
    Session = $session
    User = $login.user
  }
}

Write-Step "Checking tenant API health"
$null = Invoke-JsonRequest -Method "GET" -Url "$($TenantBaseUrl.TrimEnd('/'))/health"

Write-Step "Checking tenant admin login"
$adminLogin = Login-Tenant -Username $TenantAdminUsername -Password $TenantAdminPassword
if ($adminLogin.User.role -ne "admin") {
  throw "Expected tenant admin role for $TenantAdminUsername."
}

Write-Step "Checking tenant student login"
$studentLogin = Login-Tenant -Username $TenantStudentUsername -Password $TenantStudentPassword
if ($studentLogin.User.role -ne "student") {
  throw "Expected tenant student role for $TenantStudentUsername."
}

Write-Step "Checking student account privacy"
$studentAccount = Invoke-JsonRequest -Method "GET" -Url "$($TenantBaseUrl.TrimEnd('/'))/api/account" -Session $studentLogin.Session
if ($studentAccount.permissions.canManageSubscription) {
  throw "Student account unexpectedly has subscription management permission."
}
if ($studentAccount.subscription -ne $null) {
  throw "Student account unexpectedly received subscription details."
}
if (@($studentAccount.upgradeOptions).Count -ne 0) {
  throw "Student account unexpectedly received upgrade options."
}
if (@($studentAccount.activity.billingEvents).Count -ne 0 -or @($studentAccount.activity.exportRequests).Count -ne 0) {
  throw "Student account unexpectedly received billing or export activity."
}

Write-Step "Checking student-scoped reads"
$students = @(Invoke-JsonRequest -Method "GET" -Url "$($TenantBaseUrl.TrimEnd('/'))/api/students" -Session $studentLogin.Session)
if ($students.Count -gt 1) {
  throw "Student session received more than one student record."
}

Write-Step "Checking student admin-write denial"
Invoke-ExpectStatus -Method "POST" -Url "$($TenantBaseUrl.TrimEnd('/'))/api/subjects" -ExpectedStatusCode 403 -Session $studentLogin.Session -Body @{
  name = "Forbidden Student Subject"
}

Write-Step "Checking legacy state sync is disabled"
Invoke-ExpectStatus -Method "GET" -Url "$($TenantBaseUrl.TrimEnd('/'))/api/state" -ExpectedStatusCode 410 -Session $adminLogin.Session

if ($RejectedOrigin) {
  Write-Step "Checking tenant CORS rejects unlisted origin"
  Invoke-ExpectStatus -Method "GET" -Url "$($TenantBaseUrl.TrimEnd('/'))/health" -ExpectedStatusCode 403 -Headers @{
    Origin = $RejectedOrigin
  }
}

if ($ControlUsername -and $ControlPassword) {
  Write-Step "Checking control API health"
  $null = Invoke-JsonRequest -Method "GET" -Url "$($ControlBaseUrl.TrimEnd('/'))/health"

  Write-Step "Checking control operator login"
  $controlLogin = Login-Control -Username $ControlUsername -Password $ControlPassword
  $controlMe = Invoke-JsonRequest -Method "GET" -Url "$($ControlBaseUrl.TrimEnd('/'))/api/operator/me" -Session $controlLogin.Session
  if (-not $controlMe.user) {
    throw "Control session read did not return a user payload."
  }
}

if ($LimitedControlUsername -and $LimitedControlPassword) {
  Write-Step "Checking under-permissioned control operator denial"
  $limitedControlLogin = Login-Control -Username $LimitedControlUsername -Password $LimitedControlPassword
  Invoke-ExpectStatus -Method "POST" -Url "$($ControlBaseUrl.TrimEnd('/'))/api/control/jobs/job-lab-security-gate/retry" -ExpectedStatusCode 403 -Session $limitedControlLogin.Session -Body @{
    idempotencyKey = "lab-security-gate"
  }
}

Write-Step "Lab security gate succeeded."
