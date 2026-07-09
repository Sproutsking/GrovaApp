#!/usr/bin/env bash
# archive_docs.sh — Package archived markdown files into a single tarball and remove loose copies.
# Usage: ./scripts/archive_docs.sh --dry-run

set -euo pipefail
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

TARBALL=docs/archived_docs.tar.gz
ARCHIVE_DIR=docs/archived_docs
mkdir -p "$(dirname "$TARBALL")"

mapfile -t files < <(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name '*.md' | sort)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No archived markdown files found in $ARCHIVE_DIR"
  exit 0
fi

if [[ "$DRY_RUN" = true ]]; then
  echo "DRY RUN: would create $TARBALL from ${#files[@]} markdown files and remove $ARCHIVE_DIR"
  exit 0
fi

mkdir -p "$ARCHIVE_DIR"
tar -czf "$TARBALL" -C docs archived_docs
rm -f "$ARCHIVE_DIR"/*.md
rmdir "$ARCHIVE_DIR" 2>/dev/null || true

echo "Created $TARBALL and removed the loose archived markdown files."