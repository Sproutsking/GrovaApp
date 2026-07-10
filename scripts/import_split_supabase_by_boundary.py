#!/usr/bin/env python3
"""
Import Supabase data by boundary (identity, core, or wallet).
Reads from the exported old project and imports only tables for the specified boundary.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

import requests


def load_manifest(export_dir: Path) -> List[Dict[str, Any]]:
    manifest_path = export_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Missing manifest: {manifest_path}")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def load_boundary_map(export_dir: Path) -> Dict[str, List[str]]:
    boundary_path = export_dir / "boundary_map.json"
    if not boundary_path.exists():
        raise FileNotFoundError(f"Missing boundary map: {boundary_path}")
    return json.loads(boundary_path.read_text(encoding="utf-8"))


def read_ndjson_rows(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def post_rows(table_name: str, rows: List[Dict[str, Any]], endpoint: str, headers: Dict[str, str]) -> Dict[str, Any]:
    if not rows:
        return {"table": table_name, "inserted": 0, "status": "skipped", "rows": 0}

    payload = rows
    try:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        return {"table": table_name, "inserted": len(rows), "status": "ok", "rows": len(rows)}
    except requests.exceptions.HTTPError as e:
        return {
            "table": table_name,
            "inserted": 0,
            "status": "error",
            "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            "rows": 0,
        }
    except Exception as e:
        return {"table": table_name, "inserted": 0, "status": "error", "error": str(e), "rows": 0}


def main() -> None:
    export_dir = Path(os.environ.get("EXPORT_DIR", "exports/old_project"))
    boundary = os.environ.get("BOUNDARY", "").strip().lower()
    target_url = os.environ.get("TARGET_SUPABASE_URL", "").rstrip("/")
    target_key = os.environ.get("TARGET_SUPABASE_SERVICE_ROLE_KEY", "")

    if not boundary or boundary not in ["identity", "core", "wallet"]:
        print("Set BOUNDARY to 'identity', 'core', or 'wallet'.", file=sys.stderr)
        sys.exit(2)

    if not target_url or not target_key:
        print(f"Set TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY for boundary '{boundary}'.", file=sys.stderr)
        sys.exit(2)

    # Load boundary map and manifest
    boundary_map = load_boundary_map(export_dir)
    tables_for_boundary: Set[str] = set(boundary_map.get(boundary, []))

    if not tables_for_boundary:
        print(f"No tables found for boundary '{boundary}'.", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest(export_dir)
    headers = {
        "apikey": target_key,
        "Authorization": f"Bearer {target_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    summary = []
    total_rows = 0
    errors = 0

    print(f"\n{'='*70}")
    print(f"Importing {boundary} project: {target_url}")
    print(f"Tables to import: {len(tables_for_boundary)}")
    print(f"{'='*70}\n")

    for item in manifest:
        table_name = item["table"]

        # Only import if this table is in the current boundary
        if table_name not in tables_for_boundary:
            continue

        rows = read_ndjson_rows(export_dir / item["file"])
        endpoint = f"{target_url}/rest/v1/{table_name}"

        result = post_rows(table_name, rows, endpoint, headers)
        summary.append(result)

        # Print progress
        status_emoji = "✓" if result["status"] == "ok" else "✗" if result["status"] == "error" else "⊘"
        print(f"{status_emoji} {table_name:40} {result['rows']:6} rows - {result['status']}")

        if result["status"] == "error":
            print(f"  → {result.get('error', 'Unknown error')}")
            errors += 1

        total_rows += result["rows"]

    print(f"\n{'='*70}")
    print(f"Import Summary for {boundary}")
    print(f"Total rows inserted: {total_rows}")
    print(f"Tables processed: {len(summary)}")
    print(f"Errors: {errors}")
    print(f"{'='*70}\n")

    # Print JSON summary for logging
    summary_output = {
        "boundary": boundary,
        "target_url": target_url,
        "total_rows_inserted": total_rows,
        "total_tables": len(summary),
        "errors": errors,
        "tables": summary,
    }
    print(json.dumps(summary_output, indent=2))

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
