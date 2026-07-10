#!/bin/bash

# =============================================================================
# PRODUCTION DATA IMPORT FOR SPLIT SUPABASE PROJECTS
# =============================================================================
# This script safely imports data from NDJSON export files into three
# separate Supabase projects (Identity, Core, Wallet).
#
# REQUIREMENTS:
#   - .env file with all 3 project credentials configured
#   - python3 and pip with requests module
#   - Data already exported to exports/old_project/*.ndjson
#
# USAGE:
#   bash scripts/import_all_production.sh
#
# =============================================================================

set -e  # Exit on any error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="$PROJECT_ROOT/exports/old_project"
ENV_FILE="$PROJECT_ROOT/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# FUNCTIONS
# ============================================================================

log_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Validate requirements
validate_requirements() {
    log_header "VALIDATING REQUIREMENTS"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "python3 not found. Please install Python 3."
        exit 1
    fi
    log_success "Python 3 found"
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        log_error "pip3 not found. Please install pip3."
        exit 1
    fi
    log_success "pip3 found"
    
    # Install requests if needed
    if ! python3 -c "import requests" 2>/dev/null; then
        log_warning "Installing requests..."
        pip3 install requests -q
        log_success "requests installed"
    else
        log_success "requests already installed"
    fi
    
    # Check .env file
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env file not found at $ENV_FILE"
        exit 1
    fi
    log_success ".env file found"
    
    # Check export directory
    if [ ! -d "$EXPORT_DIR" ]; then
        log_error "Export directory not found at $EXPORT_DIR"
        exit 1
    fi
    log_success "Export directory found"
    
    # Check if any NDJSON files exist
    if [ -z "$(find $EXPORT_DIR -maxdepth 1 -name '*.ndjson')" ]; then
        log_error "No NDJSON files found in $EXPORT_DIR"
        log_info "Run: export OLD_SUPABASE_SERVICE_ROLE_KEY=<key> && python3 scripts/export_supabase_old_project.py"
        exit 1
    fi
    log_success "NDJSON export files found"
    
    echo ""
}

# Load environment variables
load_env() {
    log_header "LOADING ENVIRONMENT VARIABLES"
    
    # Source .env file
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi
    
    # Validate Identity project credentials
    if [ -z "$IDENTITY_SUPABASE_URL" ] || [ -z "$IDENTITY_SUPABASE_SERVICE_ROLE_KEY" ]; then
        log_error "Missing IDENTITY_SUPABASE_URL or IDENTITY_SUPABASE_SERVICE_ROLE_KEY in .env"
        exit 1
    fi
    log_success "Identity credentials loaded"
    
    # Validate Core project credentials
    if [ -z "$CORE_SUPABASE_URL" ] || [ -z "$CORE_SUPABASE_SERVICE_ROLE_KEY" ]; then
        log_error "Missing CORE_SUPABASE_URL or CORE_SUPABASE_SERVICE_ROLE_KEY in .env"
        exit 1
    fi
    log_success "Core credentials loaded"
    
    # Validate Wallet project credentials
    if [ -z "$WALLET_SUPABASE_URL" ] || [ -z "$WALLET_SUPABASE_SERVICE_ROLE_KEY" ]; then
        log_error "Missing WALLET_SUPABASE_URL or WALLET_SUPABASE_SERVICE_ROLE_KEY in .env"
        exit 1
    fi
    log_success "Wallet credentials loaded"
    
    echo ""
}

# Import data to a project
import_boundary() {
    local boundary=$1
    local url=$2
    local key=$3
    
    log_header "IMPORTING $boundary"
    
    export BOUNDARY="$boundary"
    export TARGET_SUPABASE_URL="$url"
    export TARGET_SUPABASE_SERVICE_ROLE_KEY="$key"
    
    if python3 "$PROJECT_ROOT/scripts/import_split_supabase_by_boundary.py"; then
        log_success "$boundary import completed"
    else
        log_error "$boundary import FAILED"
        return 1
    fi
    
    echo ""
}

# Count rows before/after
count_data() {
    local boundary=$1
    local url=$2
    local key=$3
    
    log_info "Counting data in $boundary project..."
    
    # This is a simplified count - in production you'd query each table
    log_info "Note: Run Supabase SQL query to verify: SELECT table_name, count(*) FROM information_schema.tables WHERE table_schema='public'"
    
    echo ""
}

# Main execution
main() {
    log_header "SUPABASE SPLIT MIGRATION - PRODUCTION IMPORT"
    echo "Starting data import to three split projects..."
    echo ""
    
    # Validate environment
    validate_requirements
    load_env
    
    # Track success/failure
    FAILED_BOUNDARIES=()
    
    # Import each boundary
    log_info "Importing data to Identity project..."
    if ! import_boundary "identity" "$IDENTITY_SUPABASE_URL" "$IDENTITY_SUPABASE_SERVICE_ROLE_KEY"; then
        FAILED_BOUNDARIES+=("identity")
    fi
    
    log_info "Importing data to Core project..."
    if ! import_boundary "core" "$CORE_SUPABASE_URL" "$CORE_SUPABASE_SERVICE_ROLE_KEY"; then
        FAILED_BOUNDARIES+=("core")
    fi
    
    log_info "Importing data to Wallet project..."
    if ! import_boundary "wallet" "$WALLET_SUPABASE_URL" "$WALLET_SUPABASE_SERVICE_ROLE_KEY"; then
        FAILED_BOUNDARIES+=("wallet")
    fi
    
    # Summary
    log_header "MIGRATION SUMMARY"
    
    if [ ${#FAILED_BOUNDARIES[@]} -eq 0 ]; then
        log_success "All imports completed successfully!"
        echo ""
        echo "NEXT STEPS:"
        echo "  1. Verify data in each project:"
        echo "     - Identity: https://app.supabase.com/project/pevhyriszemvnrwvfshm/editor"
        echo "     - Core: https://app.supabase.com/project/hhqohlzzpzgkfdeanudw/editor"
        echo "     - Wallet: https://app.supabase.com/project/wyqtcjqbdniwebvrwdnk/editor"
        echo ""
        echo "  2. Build and test the app:"
        echo "     npm run build && npm start"
        echo ""
        echo "  3. Smoke test:"
        echo "     - Login with existing user"
        echo "     - Load feed"
        echo "     - Check wallet balance"
        echo ""
        exit 0
    else
        log_error "Import failed for: ${FAILED_BOUNDARIES[@]}"
        echo ""
        echo "TROUBLESHOOTING:"
        echo "  - Check error messages above"
        echo "  - Verify credentials in .env"
        echo "  - Ensure schemas were created successfully"
        echo "  - Retry with: bash scripts/import_all_production.sh"
        echo ""
        exit 1
    fi
}

# Run main
main "$@"
