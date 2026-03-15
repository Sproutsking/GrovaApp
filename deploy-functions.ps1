# deploy-functions.ps1
# ============================================================
# Deploy Supabase Edge Functions WITHOUT Docker Desktop
# Run from: C:\Users\infinite sprouts\My react projects\grova-app
# Usage: .\deploy-functions.ps1
# ============================================================

$PROJECT_REF = "rxtijxlvacqjiocdwzrh"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Xeevia Edge Function Deployer" -ForegroundColor Cyan
Write-Host " No Docker required" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check CLI version ────────────────────────────────────────
Write-Host "Checking Supabase CLI version..." -ForegroundColor Yellow
$version = supabase --version 2>&1
Write-Host "  CLI version: $version" -ForegroundColor Gray
Write-Host ""

# ── Functions to deploy ──────────────────────────────────────
$functions = @(
    "paystack-create-transaction",
    "paystack-webhook",
    "activate-free-code",
    "web3-verify-payment"
)

$failed = @()
$succeeded = @()

foreach ($fn in $functions) {
    Write-Host "Deploying: $fn ..." -ForegroundColor Yellow

    # Try --use-api first (no Docker, remote bundling via Supabase API)
    $result = supabase functions deploy $fn `
        --project-ref $PROJECT_REF `
        --use-api 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: $fn deployed" -ForegroundColor Green
        $succeeded += $fn
    } else {
        Write-Host "  --use-api failed, trying --no-verify-jwt..." -ForegroundColor DarkYellow
        
        # Fallback: try without Docker flag
        $result2 = supabase functions deploy $fn `
            --project-ref $PROJECT_REF `
            --no-verify-jwt 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK: $fn deployed (no-verify-jwt)" -ForegroundColor Green
            $succeeded += $fn
        } else {
            Write-Host "  FAILED: $fn" -ForegroundColor Red
            Write-Host "  Error: $result2" -ForegroundColor DarkRed
            $failed += $fn
        }
    }
    Write-Host ""
}

# ── Summary ──────────────────────────────────────────────────
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($succeeded.Count -gt 0) {
    Write-Host "Deployed ($($succeeded.Count)):" -ForegroundColor Green
    $succeeded | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed ($($failed.Count)) — see MANUAL DEPLOY below:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "MANUAL DEPLOY via Supabase Dashboard" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If CLI keeps failing due to Docker, deploy via the Dashboard:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/functions" -ForegroundColor Cyan
    Write-Host "2. Click 'Deploy a new function'" -ForegroundColor White
    Write-Host "3. Paste the code from each file in supabase/functions/<name>/index.ts" -ForegroundColor White
    Write-Host ""
    Write-Host "Files to deploy manually:" -ForegroundColor White
    $failed | ForEach-Object {
        Write-Host "  supabase/functions/$_/index.ts" -ForegroundColor Gray
    }
}

Write-Host ""