param(
  [string]$BaseUrl = "http://192.168.1.210",
  [Parameter(Mandatory = $true)][string]$AdminUsername,
  [Parameter(Mandatory = $true)][string]$AdminPassword
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[hosted-workflow] $Message"
}

function Invoke-AppJson {
  param(
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [string]$Method,
    [string]$Path,
    [object]$Body
  )

  $request = @{
    Uri = ($script:BaseUrl.TrimEnd("/") + $Path)
    Method = $Method
    WebSession = $Session
    UseBasicParsing = $true
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

function Invoke-AppExpectFailure {
  param(
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [string]$Method,
    [string]$Path,
    [int]$ExpectedStatusCode,
    [object]$Body
  )

  try {
    $null = Invoke-AppJson -Session $Session -Method $Method -Path $Path -Body $Body
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -ne $ExpectedStatusCode) {
      throw "Expected HTTP $ExpectedStatusCode from $Path but got $status."
    }
    return
  }
  throw "Expected HTTP $ExpectedStatusCode from $Path but request succeeded."
}

function Login-AppSession {
  param([string]$Username, [string]$Password)
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-AppJson -Session $session -Method "POST" -Path "/api/auth/login" -Body @{
    username = $Username
    password = $Password
  }
  if (-not $login.user) {
    throw "Login for $Username did not return a user payload."
  }
  return @{
    Session = $session
    User = $login.user
  }
}

function Normalize-GradeTypesPayload {
  param([object[]]$GradeTypes)

  return @(
    @($GradeTypes | Where-Object { $_ }) | ForEach-Object {
      @{
        id = $_.id
        name = $_.name
        weight = $_.weight
      }
    }
  )
}

$script:BaseUrl = $BaseUrl
$runStamp = Get-Date -Format "yyyyMMddHHmmss"
$studentUserPassword = "TempStudent!20260330"
$originalGradeTypes = @()
$originalGradingCriteria = $null
$temporaryGradeTypesSeeded = $false

$created = [ordered]@{
  Test = $null
  InstructionActual = $null
  Attendance = $null
  Plan = $null
  DailyBreak = $null
  Holiday = $null
  Enrollment = $null
  Course = $null
  Subject = $null
  User = $null
  Student = $null
  SchoolYear = $null
}

$adminLogin = Login-AppSession -Username $AdminUsername -Password $AdminPassword
$adminSession = $adminLogin.Session

try {
  Write-Step "Checking admin session"
  $me = Invoke-AppJson -Session $adminSession -Method "GET" -Path "/api/me"
  if (-not $me.user) {
    throw "Admin session check did not return a user payload."
  }

  Write-Step "Loading current hosted data"
  $students = @(Invoke-AppJson -Session $adminSession -Method "GET" -Path "/api/students")
  $schoolYears = @(Invoke-AppJson -Session $adminSession -Method "GET" -Path "/api/school-years")
  $gradeTypes = @(Invoke-AppJson -Session $adminSession -Method "GET" -Path "/api/grade-types")
  $gradingCriteria = Invoke-AppJson -Session $adminSession -Method "GET" -Path "/api/grading-criteria"
  $originalGradeTypes = @(Normalize-GradeTypesPayload -GradeTypes $gradeTypes)
  $originalGradingCriteria = $gradingCriteria

  if (-not $schoolYears -or @($schoolYears | Where-Object { $_ }).Count -eq 0) {
    Write-Step "Creating temporary school year"
    $created.SchoolYear = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/school-years" -Body @{
      label = "Workflow Year $runStamp"
      startDate = "2026-08-10"
      endDate = "2027-05-20"
      requiredInstructionalDays = 180
      requiredInstructionalHours = 900
      isCurrent = $false
    }

    Write-Step "Creating temporary quarters"
    $null = Invoke-AppJson -Session $adminSession -Method "PUT" -Path "/api/school-years/$($created.SchoolYear.id)/quarters" -Body @{
      quarters = @(
        @{
          name = "Q1"
          startDate = "2026-08-10"
          endDate = "2026-10-16"
        },
        @{
          name = "Q2"
          startDate = "2026-10-19"
          endDate = "2026-12-18"
        },
        @{
          name = "Q3"
          startDate = "2027-01-04"
          endDate = "2027-03-12"
        },
        @{
          name = "Q4"
          startDate = "2027-03-15"
          endDate = "2027-05-20"
        }
      )
    }
    $schoolYear = $created.SchoolYear
  } else {
    $schoolYear = $schoolYears | Select-Object -First 1
  }

  if (-not $gradeTypes -or @($gradeTypes | Where-Object { $_ }).Count -eq 0) {
    Write-Step "Creating temporary grade type configuration"
    $gradeTypes = @(Invoke-AppJson -Session $adminSession -Method "PUT" -Path "/api/grade-types" -Body @{
      gradeTypes = @(
        @{
          name = "Workflow Quiz"
          weight = 100
        }
      )
    })
    $temporaryGradeTypesSeeded = $true
  }

  Write-Step "Creating temporary student"
  $created.Student = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/students" -Body @{
    firstName = "Workflow"
    lastName = "Validation $runStamp"
    birthdate = "2014-04-10"
    grade = "5"
    ageRecorded = 11
    createdAt = (Get-Date).ToString("yyyy-MM-dd")
  }

  Write-Step "Creating linked student user"
  $created.User = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/users" -Body @{
    username = "student_workflow_$runStamp"
    role = "student"
    studentId = $created.Student.id
    password = $studentUserPassword
    mustChangePassword = $false
  }

  Write-Step "Creating subject"
  $created.Subject = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/subjects" -Body @{
    name = "Workflow Subject $runStamp"
  }

  Write-Step "Creating course"
  $created.Course = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/courses" -Body @{
    name = "Workflow Course $runStamp"
    subjectId = $created.Subject.id
    hoursPerDay = 1.25
    exclusiveResource = $false
  }

  Write-Step "Creating enrollment"
  $created.Enrollment = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/enrollments" -Body @{
    studentId = $created.Student.id
    courseId = $created.Course.id
    scheduleOrder = 1
  }

  Write-Step "Creating holiday"
  $created.Holiday = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/holidays" -Body @{
    name = "Workflow Holiday $runStamp"
    type = "holiday"
    startDate = "2026-04-15"
    endDate = "2026-04-15"
  }

  Write-Step "Creating daily break"
  $created.DailyBreak = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/daily-breaks" -Body @{
    schoolYearId = $schoolYear.id
    studentIds = @($created.Student.id)
    type = "lunch"
    description = ""
    startTime = "12:00"
    durationMinutes = 30
    weekdays = @(1, 3, 5)
  }

  Write-Step "Creating weekly plan"
  $created.Plan = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/plans" -Body @{
    planType = "weekly"
    studentId = $created.Student.id
    courseId = $created.Course.id
    startDate = "2026-04-13"
    endDate = "2026-04-17"
    weekdays = @(1, 3, 5)
    quarterName = $null
  }

  Write-Step "Creating attendance record"
  $created.Attendance = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/attendance" -Body @{
    studentId = $created.Student.id
    date = "2026-04-13"
    present = $true
  }

  Write-Step "Creating actual instructional minutes override"
  $created.InstructionActual = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/instruction-actuals" -Body @{
    studentId = $created.Student.id
    courseId = $created.Course.id
    date = "2026-04-13"
    actualMinutes = 80
  }

  Write-Step "Creating test record"
  $gradeTypeName = if ($gradeTypes.Count) { $gradeTypes[0].name } else { "Quiz" }
  $created.Test = Invoke-AppJson -Session $adminSession -Method "POST" -Path "/api/tests" -Body @{
    date = "2026-04-14"
    studentId = $created.Student.id
    subjectId = $created.Subject.id
    courseId = $created.Course.id
    gradeType = $gradeTypeName
    testName = "Workflow Test $runStamp"
    score = 92
    maxScore = 100
  }

  Write-Step "Updating created records"
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/students/$($created.Student.id)" -Body @{
    firstName = "Workflow"
    lastName = "Validated $runStamp"
    birthdate = "2014-04-10"
    grade = "6"
    ageRecorded = 12
    createdAt = (Get-Date).ToString("yyyy-MM-dd")
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/subjects/$($created.Subject.id)" -Body @{
    name = "Workflow Subject Updated $runStamp"
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/courses/$($created.Course.id)" -Body @{
    name = "Workflow Course Updated $runStamp"
    subjectId = $created.Subject.id
    hoursPerDay = 1.5
    exclusiveResource = $true
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/enrollments/$($created.Enrollment.id)" -Body @{
    studentId = $created.Student.id
    courseId = $created.Course.id
    scheduleOrder = 2
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/holidays/$($created.Holiday.id)" -Body @{
    name = "Workflow Holiday Updated $runStamp"
    type = "holiday"
    startDate = "2026-04-15"
    endDate = "2026-04-16"
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/daily-breaks/$($created.DailyBreak.id)" -Body @{
    schoolYearId = $schoolYear.id
    studentIds = @($created.Student.id)
    type = "other"
    description = "Workflow break update"
    startTime = "12:15"
    durationMinutes = 35
    weekdays = @(2, 4)
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/plans/$($created.Plan.id)" -Body @{
    planType = "weekly"
    studentId = $created.Student.id
    courseId = $created.Course.id
    startDate = "2026-04-13"
    endDate = "2026-04-17"
    weekdays = @(2, 4)
    quarterName = $null
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/attendance/$($created.Attendance.id)" -Body @{
    studentId = $created.Student.id
    date = "2026-04-13"
    present = $false
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/instruction-actuals/$($created.InstructionActual.id)" -Body @{
    studentId = $created.Student.id
    courseId = $created.Course.id
    date = "2026-04-13"
    actualMinutes = 95
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PATCH" -Path "/api/tests/$($created.Test.id)" -Body @{
    date = "2026-04-14"
    studentId = $created.Student.id
    subjectId = $created.Subject.id
    courseId = $created.Course.id
    gradeType = $gradeTypeName
    testName = "Workflow Test Updated $runStamp"
    score = 95
    maxScore = 100
  }

  Write-Step "Validating grade-settings write path without changing live config"
  if (-not $temporaryGradeTypesSeeded) {
    $null = Invoke-AppJson -Session $adminSession -Method "PUT" -Path "/api/grade-types" -Body @{
      gradeTypes = @(Normalize-GradeTypesPayload -GradeTypes $gradeTypes)
    }
  }
  $null = Invoke-AppJson -Session $adminSession -Method "PUT" -Path "/api/grading-criteria" -Body $gradingCriteria

  Write-Step "Validating student session restrictions"
  $studentLogin = Login-AppSession -Username $created.User.username -Password $studentUserPassword
  $studentSession = $studentLogin.Session
  $studentMe = Invoke-AppJson -Session $studentSession -Method "GET" -Path "/api/me"
  if ($studentMe.user.role -ne "student") {
    throw "Expected student session role for linked student user."
  }
  $studentList = @(Invoke-AppJson -Session $studentSession -Method "GET" -Path "/api/students")
  if ($studentList.Count -ne 1 -or $studentList[0].id -ne $created.Student.id) {
    throw "Student session did not return only the linked student."
  }
  Invoke-AppExpectFailure -Session $studentSession -Method "POST" -Path "/api/subjects" -ExpectedStatusCode 403 -Body @{
    name = "Student Forbidden Subject"
  }

  $studentInstructionActuals = @(Invoke-AppJson -Session $studentSession -Method "GET" -Path "/api/instruction-actuals")
  if ($studentInstructionActuals.Count -ne 1 -or $studentInstructionActuals[0].id -ne $created.InstructionActual.id) {
    throw "Student session did not return only the linked student's actual instructional minute override."
  }

  Write-Step "Hosted workflow validation succeeded."
}
finally {
  Write-Step "Cleaning up temporary workflow records"
  foreach ($target in @(
    @{ Path = "/api/tests"; Record = $created.Test },
    @{ Path = "/api/instruction-actuals"; Record = $created.InstructionActual },
    @{ Path = "/api/attendance"; Record = $created.Attendance },
    @{ Path = "/api/plans"; Record = $created.Plan },
    @{ Path = "/api/daily-breaks"; Record = $created.DailyBreak },
    @{ Path = "/api/holidays"; Record = $created.Holiday },
    @{ Path = "/api/enrollments"; Record = $created.Enrollment },
    @{ Path = "/api/courses"; Record = $created.Course },
    @{ Path = "/api/subjects"; Record = $created.Subject },
    @{ Path = "/api/users"; Record = $created.User },
    @{ Path = "/api/students"; Record = $created.Student },
    @{ Path = "/api/school-years"; Record = $created.SchoolYear }
  )) {
    if ($target.Record -and $target.Record.id) {
      try {
        $null = Invoke-AppJson -Session $adminSession -Method "DELETE" -Path "$($target.Path)/$($target.Record.id)"
      } catch {
        Write-Warning "Cleanup failed for $($target.Path)/$($target.Record.id): $($_.Exception.Message)"
      }
    }
  }
  if ($temporaryGradeTypesSeeded) {
    try {
      $null = Invoke-AppJson -Session $adminSession -Method "PUT" -Path "/api/grade-types" -Body @{
        gradeTypes = @($originalGradeTypes)
      }
    } catch {
      Write-Warning "Cleanup failed while restoring grade types: $($_.Exception.Message)"
    }
  }
  if ($originalGradingCriteria) {
    try {
      $null = Invoke-AppJson -Session $adminSession -Method "PUT" -Path "/api/grading-criteria" -Body $originalGradingCriteria
    } catch {
      Write-Warning "Cleanup failed while restoring grading criteria: $($_.Exception.Message)"
    }
  }
}
