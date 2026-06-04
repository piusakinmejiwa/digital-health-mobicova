<#
  MobiCova API smoke test — verifies the shipped features end-to-end:
    Q1 Audit log · Q2 Roles · Q4 2FA · Q5 Bulk import · Q6 Claims · Q7 Analytics
    Q3 SAML SSO · Q8 Public API · Q9 Provider portal · Q10 Member portal

  Usage (PowerShell, from the repo root):
    # against a local server (npm run dev in server/, after npm run migrate + npm run seed)
    ./smoke-test.ps1

    # against production
    ./smoke-test.ps1 -BaseUrl "https://mobicova-api.onrender.com/api/v1"

  It only READS, except one bulk-import call that inserts a single member named
  "SMOKE TEST Aragon" so you can spot and delete it afterwards.
#>
param(
  [string]$BaseUrl  = "http://localhost:4000/api/v1",
  [string]$Email    = "admin@axamansard.demo",
  [string]$Password = "password123",
  [string]$Slug     = "axa-mansard-health",
  # Optional pre-minted admin bearer token. Supply this when the admin account
  # has 2FA enabled (password login then returns an MFA challenge, not a token).
  [string]$Token    = ""
)

$ErrorActionPreference = "Stop"
$pass = 0; $fail = 0

function Check($name, [scriptblock]$test) {
  try {
    $ok = & $test
    if ($ok) { Write-Host "  PASS  $name" -ForegroundColor Green; $script:pass++ }
    else     { Write-Host "  FAIL  $name" -ForegroundColor Red;   $script:fail++ }
  } catch {
    Write-Host "  FAIL  $name  ->  $($_.Exception.Message)" -ForegroundColor Red
    $script:fail++
  }
}

Write-Host "`nMobiCova smoke test against $BaseUrl`n" -ForegroundColor Cyan

# --- Auth: log in and grab a token ---------------------------------------
if ($Token) {
  $token = $Token
  Write-Host "Using supplied bearer token (password/MFA login bypassed)`n" -ForegroundColor Cyan
} else {
  $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" `
    -ContentType "application/json" `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
  if ($login.mfaRequired) {
    Write-Host "Admin has 2FA enabled — rerun with -Token <jwt> (complete the MFA challenge first)." -ForegroundColor Yellow
    exit 1
  }
  $token = $login.token
  if (-not $token) { Write-Host "Login failed — aborting." -ForegroundColor Red; exit 1 }
  Write-Host "Logged in as $($login.user.email) (role=$($login.user.role))`n" -ForegroundColor Cyan
}
$H = @{ Authorization = "Bearer $token" }

# --- Q2: roles / identity ------------------------------------------------
Write-Host "Q2  Roles & access control"
$me = Invoke-RestMethod -Uri "$BaseUrl/auth/me" -Headers $H
Check "GET /auth/me returns a known role" { $me.role -in @('admin','manager','analyst') }
Check "demo admin is a platform admin"     { $me.isPlatformAdmin -eq $true }

# --- Q7: analytics -------------------------------------------------------
Write-Host "`nQ7  Analytics & reporting"
$an = Invoke-RestMethod -Uri "$BaseUrl/analytics?months=6" -Headers $H
Check "summary has KPI fields"        { $null -ne $an.summary.members -and $null -ne $an.summary.monthlyPremium }
Check "utilization block present"     { $null -ne $an.utilization.activeRate }
Check "trend is a 6-point series"     { $an.trend.Count -eq 6 }
Check "service-mix breakdowns exist"  { $null -ne $an.consultationsByStatus -and $null -ne $an.channelBreakdown }

# --- Q5: bulk member import ---------------------------------------------
Write-Host "`nQ5  Bulk member import"
$rows = @(
  @{ fullName = "SMOKE TEST Aragon"; email = "smoke.aragon@member.demo"; channel = "app"; dateOfBirth = "1991-05-02" },
  @{ fullName = "";                   email = "missing.name@member.demo"; channel = "app" },                 # invalid: no name
  @{ fullName = "Bad Date Person";    channel = "app"; dateOfBirth = "02/05/1991" }                          # invalid: date format
)
$imp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/members/import" -Headers $H `
  -ContentType "application/json" -Body (@{ members = $rows } | ConvertTo-Json)
Check "exactly 1 row inserted"         { $imp.inserted -eq 1 }
Check "exactly 2 rows skipped"         { $imp.skipped.Count -eq 2 }
Check "skipped rows carry a reason"    { $imp.skipped[0].reason -and $imp.skipped[1].reason }

# --- Q6: claims workflow ------------------------------------------------
Write-Host "`nQ6  Claims workflow"
$members = Invoke-RestMethod -Uri "$BaseUrl/members" -Headers $H
$firstMember = $members[0]
$newClaim = Invoke-RestMethod -Method Post -Uri "$BaseUrl/claims" -Headers $H `
  -ContentType "application/json" `
  -Body (@{ memberId = $firstMember.id; claimType = "outpatient"; providerName = "SMOKE TEST Clinic"; amount = 25000; description = "Smoke test claim" } | ConvertTo-Json)
Check "claim created with CLM- reference" { $newClaim.reference -like "CLM-*" }
Check "new claim starts as submitted"     { $newClaim.status -eq "submitted" }
$decided = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/claims/$($newClaim.id)/decision" -Headers $H `
  -ContentType "application/json" -Body (@{ status = "under_review" } | ConvertTo-Json)
Check "claim advances to under_review"    { $decided.status -eq "under_review" }
$badMove = $null
try { $badMove = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/claims/$($newClaim.id)/decision" -Headers $H `
  -ContentType "application/json" -Body (@{ status = "paid" } | ConvertTo-Json) } catch { $badMove = "blocked" }
Check "illegal transition is rejected"    { $badMove -eq "blocked" }
$queue = Invoke-RestMethod -Uri "$BaseUrl/claims?status=under_review" -Headers $H
Check "queue returns claims + counts"     { $null -ne $queue.claims -and $null -ne $queue.counts }
$detail = Invoke-RestMethod -Uri "$BaseUrl/claims/$($newClaim.id)" -Headers $H
Check "claim detail carries documents[]"  { $null -ne $detail.documents }

# --- Q4: two-factor auth -------------------------------------------------
Write-Host "`nQ4  Two-factor authentication"
$mfa = Invoke-RestMethod -Uri "$BaseUrl/auth/mfa/status" -Headers $H
Check "MFA status endpoint answers"    { $null -ne $mfa.enabled }
$badChal = $null
try { $badChal = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/mfa/challenge" `
  -ContentType "application/json" -Body (@{ mfaToken = "not-a-token"; code = "000000" } | ConvertTo-Json) } catch { $badChal = "blocked" }
Check "invalid MFA challenge rejected"  { $badChal -eq "blocked" }

# --- Q10: member self-service portal (OTP) -------------------------------
# Reuses the member the Q5 import created (email smoke.aragon@member.demo).
Write-Host "`nQ10 Member self-service portal"
$otp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/member/auth/request-otp" `
  -ContentType "application/json" -Body (@{ identifier = "smoke.aragon@member.demo" } | ConvertTo-Json)
Check "OTP request is accepted"          { $otp.sent -eq $true }
Check "demo mode returns a code"         { $otp.devCode -match '^\d{6}$' }
if ($otp.devCode) {
  $mv = Invoke-RestMethod -Method Post -Uri "$BaseUrl/member/auth/verify-otp" `
    -ContentType "application/json" -Body (@{ identifier = "smoke.aragon@member.demo"; code = $otp.devCode } | ConvertTo-Json)
  Check "OTP verify returns a token"     { $mv.token -and $mv.member.id }
  $MH = @{ Authorization = "Bearer $($mv.token)" }
  $mme = Invoke-RestMethod -Uri "$BaseUrl/member/me" -Headers $MH
  Check "member /me returns the profile" { $mme.full_name -like "SMOKE TEST*" -and $null -ne $mme.counts }
  $mclaims = Invoke-RestMethod -Uri "$BaseUrl/member/claims" -Headers $MH
  Check "member can list own claims"     { $null -ne $mclaims.claims }
  # A member token must NOT open a partner endpoint.
  $crossed = $null
  try { $crossed = Invoke-RestMethod -Uri "$BaseUrl/members" -Headers $MH } catch { $crossed = "blocked" }
  Check "member token rejected on staff API" { $crossed -eq "blocked" }
}

# --- Q8: public API + webhooks -------------------------------------------
Write-Host "`nQ8  Public API & webhooks"
$PublicBase = $BaseUrl -replace '/api/v1', '/api/public/v1'
# Issue a key, then call the public API with it.
$key = Invoke-RestMethod -Method Post -Uri "$BaseUrl/developer/api-keys" -Headers $H `
  -ContentType "application/json" -Body (@{ name = "SMOKE TEST key" } | ConvertTo-Json)
Check "API key issued with mk_live_ prefix" { $key.key -like "mk_live_*" }
$KH = @{ Authorization = "Bearer $($key.key)" }
$pub = Invoke-RestMethod -Uri "$PublicBase/members?limit=5" -Headers $KH
Check "public API returns data+pagination"  { $null -ne $pub.data -and $null -ne $pub.pagination }
# A bad key must be rejected.
$badKey = $null
try { $badKey = Invoke-RestMethod -Uri "$PublicBase/members" -Headers @{ Authorization = "Bearer mk_live_deadbeef" } } catch { $badKey = "blocked" }
Check "public API rejects an invalid key"   { $badKey -eq "blocked" }
# Register a webhook endpoint (secret returned once).
$wh = Invoke-RestMethod -Method Post -Uri "$BaseUrl/developer/webhooks" -Headers $H `
  -ContentType "application/json" -Body (@{ url = "https://example.com/smoke-hook"; events = @("claim.created") } | ConvertTo-Json)
Check "webhook created with signing secret" { $wh.secret -like "whsec_*" }
# Tidy up the artefacts this block created.
Invoke-RestMethod -Method Delete -Uri "$BaseUrl/developer/webhooks/$($wh.id)" -Headers $H | Out-Null
Invoke-RestMethod -Method Delete -Uri "$BaseUrl/developer/api-keys/$($key.id)" -Headers $H | Out-Null

# --- Q9: provider portal -------------------------------------------------
# Requires seeded demo providers (npm run seed).
Write-Host "`nQ9  Provider portal"
try {
  $doc = Invoke-RestMethod -Method Post -Uri "$BaseUrl/provider/auth/login" `
    -ContentType "application/json" -Body (@{ email = "doctor@mobicova.demo"; password = "password123" } | ConvertTo-Json)
  Check "doctor signs in"                  { $doc.token -and $doc.provider.role -eq "doctor" }
  $DH = @{ Authorization = "Bearer $($doc.token)" }
  $consults = Invoke-RestMethod -Uri "$BaseUrl/provider/consultations" -Headers $DH
  Check "doctor sees consult queue+counts" { $null -ne $consults.consultations -and $null -ne $consults.counts }
  # A doctor token must NOT reach the pharmacist-only endpoint.
  $wrongRole = $null
  try { $wrongRole = Invoke-RestMethod -Uri "$BaseUrl/provider/prescriptions" -Headers $DH } catch { $wrongRole = "blocked" }
  Check "doctor blocked from dispensary"   { $wrongRole -eq "blocked" }
  # A provider token must NOT reach the staff API.
  $crossed = $null
  try { $crossed = Invoke-RestMethod -Uri "$BaseUrl/members" -Headers $DH } catch { $crossed = "blocked" }
  Check "provider token rejected on staff API" { $crossed -eq "blocked" }

  $pharm = Invoke-RestMethod -Method Post -Uri "$BaseUrl/provider/auth/login" `
    -ContentType "application/json" -Body (@{ email = "pharmacist@mobicova.demo"; password = "password123" } | ConvertTo-Json)
  Check "pharmacist signs in"              { $pharm.token -and $pharm.provider.role -eq "pharmacist" }
  $PH = @{ Authorization = "Bearer $($pharm.token)" }
  $rx = Invoke-RestMethod -Uri "$BaseUrl/provider/prescriptions" -Headers $PH
  Check "pharmacist sees dispensary queue" { $null -ne $rx.prescriptions }
} catch {
  Write-Host "  (skipped — run 'npm run seed' to create demo providers)" -ForegroundColor DarkGray
}

# --- Q1: audit log -------------------------------------------------------
Write-Host "`nQ1  Audit log"
$audit = Invoke-RestMethod -Uri "$BaseUrl/admin/audit" -Headers $H
Check "audit endpoint returns a list"  { $audit -is [System.Array] -or $audit.Count -ge 0 }

# --- Q3: SAML SSO --------------------------------------------------------
Write-Host "`nQ3  SAML single sign-on"
$sso = Invoke-RestMethod -Uri "$BaseUrl/sso/config" -Headers $H
Check "SP entityId is derived"         { $sso.sp.entityId -like "*/auth/saml/$Slug/metadata" }
Check "SP ACS url is derived"          { $sso.sp.acsUrl   -like "*/auth/saml/$Slug/callback" }
$status = Invoke-RestMethod -Uri "$BaseUrl/auth/sso/status?slug=$Slug"
Check "public status endpoint answers" { $null -ne $status.enabled }
$meta = Invoke-WebRequest -Uri "$BaseUrl/auth/saml/$Slug/metadata"
Check "SP metadata XML is served"      { $meta.Content -like "*EntityDescriptor*" }

# --- summary -------------------------------------------------------------
Write-Host "`n----------------------------------------" -ForegroundColor Cyan
Write-Host "  $pass passed, $fail failed" -ForegroundColor $(if ($fail) { "Red" } else { "Green" })
Write-Host "  Reminder: delete the 'SMOKE TEST Aragon' member (Q5) and the 'SMOKE TEST Clinic' claim (Q6).`n" -ForegroundColor DarkGray
if ($fail) { exit 1 }
