param(
  [string]$ServerInstance = "localhost\SQLEXPRESS",
  [string]$Database = "HomeSchoolManagement",
  [string]$Username = "HSMS",
  [string]$Password = "",
  [string]$InputFile = "..\NOTES\local-state-export.json"
)

$ErrorActionPreference = "Stop"

function As-Array {
  param([object]$Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Array]) { return $Value }
  return @($Value)
}

function Unique-ById {
  param([object[]]$Items)
  $map = @{}
  foreach ($item in As-Array $Items) {
    if ($null -eq $item) { continue }
    $id = [string]$item.id
    if ([string]::IsNullOrWhiteSpace($id)) { continue }
    $map[$id] = $item
  }
  return @($map.Values)
}

function DbNull {
  param([object]$Value)
  if ($null -eq $Value) { return [DBNull]::Value }
  if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) { return [DBNull]::Value }
  return $Value
}

function Exec-NonQuery {
  param(
    [System.Data.SqlClient.SqlConnection]$Connection,
    [System.Data.SqlClient.SqlTransaction]$Transaction,
    [string]$SqlText,
    [hashtable]$Params
  )
  $cmd = $Connection.CreateCommand()
  $cmd.Transaction = $Transaction
  $cmd.CommandText = $SqlText
  foreach ($k in $Params.Keys) {
    [void]$cmd.Parameters.AddWithValue("@$k", (DbNull $Params[$k]))
  }
  [void]$cmd.ExecuteNonQuery()
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$resolvedInput = if ([System.IO.Path]::IsPathRooted($InputFile)) {
  $InputFile
} else {
  Join-Path $repoRoot $InputFile
}

if (-not (Test-Path -LiteralPath $resolvedInput)) {
  throw "Input file not found: $resolvedInput"
}

$state = Get-Content -LiteralPath $resolvedInput -Raw | ConvertFrom-Json
$settings = $state.settings

$connectionString = "Server=$ServerInstance;Database=$Database;User ID=$Username;Password=$Password;Encrypt=False;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$conn.Open()
$tx = $conn.BeginTransaction()

try {
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.tests" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.attendance" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.plans" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.enrollments" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.courses" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.subjects" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.students" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.holidays" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.quarters" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.school_years" -Params @{}
  Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "DELETE FROM dbo.grade_types" -Params @{}

  $students = Unique-ById (As-Array $state.students)
  foreach ($row in $students) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.students (id, first_name, last_name, birthdate, grade, age_recorded, created_at)
VALUES (@id, @first_name, @last_name, @birthdate, @grade, @age_recorded, @created_at)
"@ -Params @{
      id = [string]$row.id
      first_name = [string]$row.firstName
      last_name = [string]$row.lastName
      birthdate = [string]$row.birthdate
      grade = [string]$row.grade
      age_recorded = if ($null -eq $row.ageRecorded) { $null } else { [int]$row.ageRecorded }
      created_at = [string]$row.createdAt
    }
  }

  $subjects = Unique-ById (As-Array $state.subjects)
  foreach ($row in $subjects) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText "INSERT INTO dbo.subjects (id, name) VALUES (@id, @name)" -Params @{
      id = [string]$row.id
      name = [string]$row.name
    }
  }

  $courses = Unique-ById (As-Array $state.courses)
  foreach ($row in $courses) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.courses (id, name, subject_id, hours_per_day)
VALUES (@id, @name, @subject_id, @hours_per_day)
"@ -Params @{
      id = [string]$row.id
      name = [string]$row.name
      subject_id = [string]$row.subjectId
      hours_per_day = [decimal]$row.hoursPerDay
    }
  }

  $enrollments = Unique-ById (As-Array $state.enrollments)
  foreach ($row in $enrollments) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.enrollments (id, student_id, course_id)
VALUES (@id, @student_id, @course_id)
"@ -Params @{
      id = [string]$row.id
      student_id = [string]$row.studentId
      course_id = [string]$row.courseId
    }
  }

  $schoolYears = Unique-ById (As-Array $settings.schoolYears)
  foreach ($row in $schoolYears) {
    $isCurrent = if ([string]$row.id -eq [string]$settings.currentSchoolYearId) { 1 } else { 0 }
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.school_years (id, label, start_date, end_date, is_current)
VALUES (@id, @label, @start_date, @end_date, @is_current)
"@ -Params @{
      id = [string]$row.id
      label = [string]$row.label
      start_date = [string]$row.startDate
      end_date = [string]$row.endDate
      is_current = $isCurrent
    }
  }

  $quartersSource = if ($null -ne $settings.allQuarters) { $settings.allQuarters } else { $settings.quarters }
  $quarters = Unique-ById (As-Array $quartersSource)
  foreach ($row in $quarters) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.quarters (id, school_year_id, name, start_date, end_date)
VALUES (@id, @school_year_id, @name, @start_date, @end_date)
"@ -Params @{
      id = [string]$row.id
      school_year_id = [string]$row.schoolYearId
      name = [string]$row.name
      start_date = [string]$row.startDate
      end_date = [string]$row.endDate
    }
  }

  $holidays = Unique-ById (As-Array $settings.holidays)
  foreach ($row in $holidays) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.holidays (id, name, holiday_type, start_date, end_date)
VALUES (@id, @name, @holiday_type, @start_date, @end_date)
"@ -Params @{
      id = [string]$row.id
      name = [string]$row.name
      holiday_type = [string]$row.type
      start_date = [string]$row.startDate
      end_date = [string]$row.endDate
    }
  }

  $gradeTypes = Unique-ById (As-Array $settings.gradeTypes)
  foreach ($row in $gradeTypes) {
    $weight = if ($null -eq $row.weight -or [string]$row.weight -eq "") { $null } else { [decimal]$row.weight }
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.grade_types (id, name, weight)
VALUES (@id, @name, @weight)
"@ -Params @{
      id = [string]$row.id
      name = [string]$row.name
      weight = $weight
    }
  }

  $plans = Unique-ById (As-Array $state.plans)
  foreach ($row in $plans) {
    $weekdaysJson = ConvertTo-Json (As-Array $row.weekdays) -Compress
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.plans (id, plan_type, student_id, course_id, start_date, end_date, weekdays_json, quarter_name)
VALUES (@id, @plan_type, @student_id, @course_id, @start_date, @end_date, @weekdays_json, @quarter_name)
"@ -Params @{
      id = [string]$row.id
      plan_type = [string]$row.planType
      student_id = [string]$row.studentId
      course_id = [string]$row.courseId
      start_date = [string]$row.startDate
      end_date = [string]$row.endDate
      weekdays_json = [string]$weekdaysJson
      quarter_name = if ($null -eq $row.quarterName) { $null } else { [string]$row.quarterName }
    }
  }

  $attendance = Unique-ById (As-Array $state.attendance)
  foreach ($row in $attendance) {
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.attendance (id, student_id, attendance_date, present)
VALUES (@id, @student_id, @attendance_date, @present)
"@ -Params @{
      id = [string]$row.id
      student_id = [string]$row.studentId
      attendance_date = [string]$row.date
      present = if ($row.present) { 1 } else { 0 }
    }
  }

  $tests = Unique-ById (As-Array $state.tests)
  foreach ($row in $tests) {
    $gradeType = if ([string]::IsNullOrWhiteSpace([string]$row.gradeType)) { [string]$row.testName } else { [string]$row.gradeType }
    if ([string]::IsNullOrWhiteSpace($gradeType)) { $gradeType = "Test" }
    $testName = if ([string]::IsNullOrWhiteSpace([string]$row.testName)) { $gradeType } else { [string]$row.testName }
    Exec-NonQuery -Connection $conn -Transaction $tx -SqlText @"
INSERT INTO dbo.tests (id, test_date, student_id, subject_id, course_id, grade_type, test_name, score, max_score)
VALUES (@id, @test_date, @student_id, @subject_id, @course_id, @grade_type, @test_name, @score, @max_score)
"@ -Params @{
      id = [string]$row.id
      test_date = [string]$row.date
      student_id = [string]$row.studentId
      subject_id = [string]$row.subjectId
      course_id = [string]$row.courseId
      grade_type = $gradeType
      test_name = $testName
      score = [decimal]$row.score
      max_score = [decimal]$row.maxScore
    }
  }

  $tx.Commit()

  $summary = [ordered]@{
    students = $students.Count
    subjects = $subjects.Count
    courses = $courses.Count
    enrollments = $enrollments.Count
    schoolYears = $schoolYears.Count
    quarters = $quarters.Count
    holidays = $holidays.Count
    gradeTypes = $gradeTypes.Count
    plans = $plans.Count
    attendance = $attendance.Count
    tests = $tests.Count
  }
  Write-Output ("Import completed: " + ($summary | ConvertTo-Json -Compress))
}
catch {
  try { $tx.Rollback() } catch {}
  throw
}
finally {
  $conn.Close()
}
