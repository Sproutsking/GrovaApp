#!/usr/bin/env bash
# archive_docs.sh — Move markdown files marked ARCHIVE in docs/MD_INVENTORY.md
# Usage: ./scripts/archive_docs.sh --dry-run

set -euo pipefail
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

INVENTORY=docs/MD_INVENTORY.md
ARCHIVE_DIR=docs/archived_docs
mkdir -p "$ARCHIVE_DIR"

# Extract filenames marked ARCHIVE
FILES=$(awk '/Action: ARCHIVE/ { getline; next } { if ($0 ~ /Action: ARCHIVE/) print NR ":" $0 }' "$INVENTORY" || true)
# Alternate simpler approach: fixed list known from inventory
# Hardcode file list extracted manually for reliability
FILES_TO_MOVE=(
  "APP_INVESTIGATION_REPORT.md"
  "WEB3_PHASE_1C_COMPLETION.md"
  "HANDOFF_PHASE_1D.md"
  "MASSIVE_FEATURES_COMPLETED.md"
  "BOTTOM_NAV_PAYWAVE_DOM_APPROACH.md"
  "PR_CHECKLIST_PAYWAVE.md"
)

for f in "${FILES_TO_MOVE[@]}"; do
  if [[ -f "$f" ]]; then
    if [[ "$DRY_RUN" = true ]]; then
      echo "DRY RUN: would move $f -> $ARCHIVE_DIR/"
    else
      echo "Moving $f -> $ARCHIVE_DIR/"
      git mv "$f" "$ARCHIVE_DIR/"
    fi
  else
    echo "Warning: $f not found, skipping"
  fi
done

echo "Done. Review changes, then commit."