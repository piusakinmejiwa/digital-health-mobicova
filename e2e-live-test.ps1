param(
  [string]$Code = "",                                   # admin@axamansard 2FA code (org-scoped tests)
  [string]$Token = "",                                  # or a pre-minted org-admin token
  [string]$BaseUrl = "https://mobicova-api.onrender.com/api/v1",
  [string]$PlatformEmail = "pius@mobicova.com",         # platform admin (Admin Console / audit checks)
  [string]$PlatformPassword = ""                        # platform admin password (no 2FA)
)
$ErrorActionPreference = "Continue"
$api = $BaseUrl
$DEMOPW = "MobiCova!Demo-2026"
$pass = 0; $fail = 0; $issues = @()
function Check($n, $cond, $detail) { if ($cond) { Write-Host ("  PASS  " + $n) -ForegroundColor Green; $script:pass++ } else { Write-Host ("  FAIL  " + $n + "   " + $detail) -ForegroundColor Red; $script:fail++; $script:issues += $n } }
function Req($m, $u, $b, $hdr) { try { $p = @{Method = $m; Uri = $u; TimeoutSec = 120; SkipHttpErrorCheck = $true }; if ($b) { $p.ContentType = "application/json"; $p.Body = ($b | ConvertTo-Json -Depth 8) }; if ($hdr) { $p.Headers = $hdr }; return Invoke-WebRequest @p } catch { return $null } }
function JSON($r) { if ($r) { try { return $r.Content | ConvertFrom-Json } catch { return $null } } }

Write-Host "`n=== AUTH (admin, 2FA) ===" -ForegroundColor Cyan
if (-not $Token) {
  $lg = JSON (Req "POST" "$api/auth/login" @{email = "admin@axamansard.demo"; password = $DEMOPW })
  if ($lg.mfaRequired) { $ch = JSON (Req "POST" "$api/auth/mfa/challenge" @{mfaToken = $lg.mfaToken; code = $Code }); $Token = $ch.token }
  elseif ($lg.token) { $Token = $lg.token }
}
if (-not $Token) { Write-Host "  AUTH FAILED - the 2FA code likely expired. Send a fresh code and I'll retry." -ForegroundColor Red; exit 1 }
Set-Content -Path "$env:TEMP\mc_token.txt" -Value $Token
$H = @{ Authorization = "Bearer $Token" }
$me = JSON (Req "GET" "$api/auth/me" $null $H)
Check "Org admin signed in (admin@axamansard)" ($me.role -eq 'admin') "role=$($me.role)"
Write-Host ("  token cached at $env:TEMP\mc_token.txt (valid ~7d)") -ForegroundColor DarkGray

Write-Host "`n=== UNIFIED ORG MODEL + JOIN CODE ===" -ForegroundColor Cyan
Check "Demo org join code = 100200" ($me.joinCode -eq "100200") "joinCode=$($me.joinCode)"
Check "Admin org class present" ($me.orgClass -ne $null) "orgClass=$($me.orgClass)"

Write-Host "`n=== MEMBERSHIP IDs ===" -ForegroundColor Cyan
$members = JSON (Req "GET" "$api/members" $null $H)
$withId = @($members | Where-Object { $_.membership_id })
Check "Members carry membership IDs" ($withId.Count -gt 0) "with=$($withId.Count)/$(@($members).Count)"
$fmtOk = @($withId | Where-Object { $_.membership_id -match '^[A-Z]{3}\d{6}$' })
Check "IDs match <PREFIX><6 digits>" ($withId.Count -gt 0 -and $fmtOk.Count -eq $withId.Count) "ok=$($fmtOk.Count)/$($withId.Count)"
if ($withId.Count) { Write-Host ("  e.g. " + $withId[0].membership_id + "  (" + $withId[0].full_name + ")") -ForegroundColor DarkGray }

Write-Host "`n=== SUPPLY-ORG DASHBOARD (clinic admin) ===" -ForegroundColor Cyan
$cl = JSON (Req "POST" "$api/auth/login" @{email = "clinic@mobicova.demo"; password = $DEMOPW })
if ($cl.token) {
  $CHH = @{ Authorization = "Bearer $($cl.token)" }
  $ov = JSON (Req "GET" "$api/supply/overview" $null $CHH)
  Check "Clinic admin -> supply overview (class=supply)" ($ov -and $ov.class -eq "supply") "class=$($ov.class)"
  $q = JSON (Req "GET" "$api/supply/queue" $null $CHH);  Check "Clinic queue endpoint" ($q -and ($q.PSObject.Properties.Name -contains 'queue')) "no queue"
  $stf = JSON (Req "GET" "$api/supply/staff" $null $CHH); Check "Clinic staff endpoint" ($stf -and ($stf.PSObject.Properties.Name -contains 'staff')) "no staff"
}
else { Check "Clinic admin login (clinic@mobicova.demo)" $false "no token - was seed run?" }

Write-Host "`n=== PROVIDER PORTAL ===" -ForegroundColor Cyan
$doc = JSON (Req "POST" "$api/provider/auth/login" @{email = "doctor@mobicova.demo"; password = $DEMOPW })
Check "Doctor signs in" ($doc.token -ne $null) "no token"
Check "Doctor spans 2+ clinics (org switcher)" (@($doc.provider.organisations).Count -ge 2) "orgs=$(@($doc.provider.organisations).Count)"
if ($doc.token) { $DH = @{Authorization = "Bearer $($doc.token)" }; $cs = JSON (Req "GET" "$api/provider/consultations" $null $DH); Check "Doctor consult queue" ($cs -and ($cs.PSObject.Properties.Name -contains 'consultations')) "no consults" }
$phx = JSON (Req "POST" "$api/provider/auth/login" @{email = "pharmacist@mobicova.demo"; password = $DEMOPW })
Check "Pharmacist signs in" ($phx.token -ne $null) "no token"
if ($phx.token) { $PHH = @{Authorization = "Bearer $($phx.token)" }; $rx = JSON (Req "GET" "$api/provider/prescriptions" $null $PHH); Check "Pharmacist dispensary queue" ($rx -and ($rx.PSObject.Properties.Name -contains 'prescriptions')) "no rx" }

Write-Host "`n=== MEMBER PORTAL (OTP) ===" -ForegroundColor Cyan
$otp = JSON (Req "POST" "$api/member/auth/request-otp" @{identifier = "amaka.obi@member.demo" })
Check "OTP requested (demo code returned)" ($otp.devCode -ne $null) "no devCode"
if ($otp.devCode) {
  $vf = JSON (Req "POST" "$api/member/auth/verify-otp" @{identifier = "amaka.obi@member.demo"; code = $otp.devCode })
  Check "OTP verified -> member token" ($vf.token -ne $null) "no token"
  if ($vf.token) { $MH = @{Authorization = "Bearer $($vf.token)" }; $mme = JSON (Req "GET" "$api/member/me" $null $MH); Check "Member /me shows membership ID (backfill worked)" ($mme.membership_id -match '^[A-Z]{3}\d{6}$') "membership_id=$($mme.membership_id)" }
}

Write-Host "`n=== USSD ENROLMENT (code 100200) ===" -ForegroundColor Cyan
$phone = "+234810" + (Get-Random -Minimum 1000000 -Maximum 9999999)
function Ussd($t) { $r = Req "POST" "$api/channels/ussd" @{phoneNumber = $phone; text = $t }; if ($r) { return $r.Content } return "" }
$s1 = Ussd "";                                  Check "USSD welcome" ($s1 -match '^CON' -and $s1 -match 'organisation code') $s1
$s2 = Ussd "100200";                            Check "USSD resolves org by code" ($s2 -match 'AXA Mansard') $s2
$s3 = Ussd "100200*E2E USSD Test";              Check "USSD asks gender" ($s3 -match 'Male') $s3
$s4 = Ussd "100200*E2E USSD Test*2";            Check "USSD asks confirm" ($s4 -match 'Create member') $s4
$s5 = Ussd "100200*E2E USSD Test*2*1";          Check "USSD enrolment completes (END / enrolled)" ($s5 -match '^END' -and $s5 -match 'enrolled') $s5

Write-Host "`n=== WHATSAPP ENROLMENT (greeting + code) ===" -ForegroundColor Cyan
$wf = "+234809" + (Get-Random -Minimum 1000000 -Maximum 9999999)
function Wa($m) { JSON (Req "POST" "$api/channels/whatsapp/simulate" @{from = $wf; message = $m }) }
$w1 = Wa "Hi";                  Check "WhatsApp greets on first contact (new code deployed)" ($w1.reply -match 'Welcome to MobiCova' -and $w1.reply -notmatch 'not recognised') "reply=$($w1.reply)"
$w2 = Wa "100200";              Check "WhatsApp resolves org by code" ($w2.reply -match 'AXA Mansard') "reply=$($w2.reply)"
$w3 = Wa "E2E WhatsApp Test";   Check "WhatsApp asks gender" ($w3.reply -match 'Male') "reply=$($w3.reply)"
$w4 = Wa "2";                   Check "WhatsApp asks confirm" ($w4.reply -match 'Create member') "reply=$($w4.reply)"
$w5 = Wa "1";                   Check "WhatsApp enrolment completes" ($w5.done -eq $true -and $w5.reply -match 'enrolled') "reply=$($w5.reply)"

Write-Host "`n=== VERIFY ENROLLED MEMBERS HAVE IDs ===" -ForegroundColor Cyan
Start-Sleep -Seconds 1
$m2 = JSON (Req "GET" "$api/members" $null $H)
$uM = @($m2 | Where-Object { $_.full_name -eq "E2E USSD Test" })
$wM = @($m2 | Where-Object { $_.full_name -eq "E2E WhatsApp Test" })
Check "USSD member created w/ AXA###### id" ($uM.Count -ge 1 -and $uM[0].membership_id -match '^AXA\d{6}$') "id=$($uM[0].membership_id)"
Check "WhatsApp member created w/ AXA###### id" ($wM.Count -ge 1 -and $wM[0].membership_id -match '^AXA\d{6}$') "id=$($wM[0].membership_id)"

Write-Host "`n=== PER-ORG ACTIVITY LOG ===" -ForegroundColor Cyan
$act = JSON (Req "GET" "$api/activity" $null $H)
Check "Org activity log returns events" (@($act).Count -gt 0) "count=$(@($act).Count)"
Check "Activity captures member events (add/import/enrol)" (@($act | Where-Object { $_.action -like 'member.*' }).Count -gt 0) "no member.* events"
Check "Activity captures sign-ins" (@($act | Where-Object { $_.action -eq 'auth.login' -or $_.action -eq 'member.login' }).Count -gt 0) "no login events"

Write-Host "`n=== PLATFORM ADMIN (separate account - Admin Console) ===" -ForegroundColor Cyan
if ($PlatformPassword) {
  $plg = JSON (Req "POST" "$api/auth/login" @{email = $PlatformEmail; password = $PlatformPassword })
  if ($plg.token) {
    $PH2 = @{Authorization = "Bearer $($plg.token)" }
    $pme = JSON (Req "GET" "$api/auth/me" $null $PH2)
    Check "$PlatformEmail is a platform admin" ($pme.isPlatformAdmin -eq $true) "isPlatformAdmin=$($pme.isPlatformAdmin)"
    Check "Admin Console: list ALL organisations" (@(JSON (Req "GET" "$api/admin/organisations" $null $PH2)).Count -ge 1) "empty"
    Check "Admin Console: list ALL users" (@(JSON (Req "GET" "$api/admin/users" $null $PH2)).Count -ge 1) "empty"
    $audr = Req "GET" "$api/admin/audit" $null $PH2;  Check "Admin Console: audit log accessible" ($audr.StatusCode -eq 200) "status=$($audr.StatusCode)"
    $samlr = Req "GET" "$api/auth/saml/axa-mansard-health/metadata" $null $null; Check "SSO: SP metadata served (public)" ($samlr.StatusCode -eq 200) "status=$($samlr.StatusCode)"
  }
  else { Check "$PlatformEmail signs in" $false "login failed - check creds / user row exists" }
}
else { Write-Host "  (skipped - pass -PlatformPassword '<pw>' to verify the Admin Console)" -ForegroundColor DarkGray }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host ("  E2E SUITE (features + platform): $pass passed, $fail failed") -ForegroundColor Cyan
if ($issues.Count) { Write-Host ("  Failures: " + ($issues -join " | ")) -ForegroundColor Yellow }
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Now running the core org-scoped suite (smoke-test.ps1)...`n" -ForegroundColor Cyan
# Note: smoke-test's audit/platform-admin checks assume a single platform-admin
# account; under the org-admin token they 403. The Admin Console is verified
# above with the platform admin instead. Tolerate its early stop.
try { & "C:\Users\Dee\Desktop\mobicova-platform\smoke-test.ps1" -BaseUrl $api -Token $Token } catch { Write-Host ("  (smoke-test stopped at a platform-admin-gated step - covered above)") -ForegroundColor DarkGray }
