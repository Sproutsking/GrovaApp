#!/usr/bin/env python3
"""
Import Supabase data by boundary (identity, core, or wallet).
Reads from the exported old project and imports only tables for the specified boundary.
"""

import json
import os
import re
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Set

import requests
import datetime


def load_manifest(export_dir: Path) -> List[Dict[str, Any]]:
    manifest_path = export_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Missing manifest: {manifest_path}")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def load_boundary_map(export_dir: Path, filename: str = "boundary_map.json") -> Dict[str, List[str]]:
    boundary_path = export_dir / filename
    if not boundary_path.exists():
        fallback_path = export_dir / "boundary_map_complete.json"
        if fallback_path.exists():
            print(
                f"Warning: boundary map {boundary_path} not found, using fallback {fallback_path}",
                file=sys.stderr,
            )
            boundary_path = fallback_path
        else:
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


PRIORITY_TABLES = [
    "profiles",
    "payment_products",
    "payments",
    "ambassador_profiles",
    "live_sessions",
    "wallets",
    "wallet_addresses",
    "posts",
    "reels",
    "stories",
    "comments",
    "messages",
    "conversations",
    "communities",
]

PRIORITY_RANK = {table: index for index, table in enumerate(PRIORITY_TABLES)}

BOUNDARY_DEPENDENCY_TABLES = {
    "core": ["profiles", "ambassador_profiles", "live_sessions"],
    "wallet": ["profiles"],
}

MINIMAL_TABLE_COLUMNS = {
    "core": {
        "profiles": ["id", "email", "username", "created_at"],
        "payments": ["id", "created_at"],
        "live_sessions": ["id", "started_at", "ended_at"],
        "ambassador_profiles": ["id", "user_id", "approved_by", "created_at"],
    },
    "wallet": {
        "profiles": ["id", "email", "username", "created_at"],
    },
    "identity": {
        "profiles": ["id", "email", "username", "created_at"],
        "ambassador_profiles": ["id", "user_id", "created_at"],
        "live_sessions": ["id", "started_at", "ended_at", "created_at"],
        "profile_access_summary": ["id", "email", "username", "created_at"],
        # avoid sending potentially malformed sent_at values; let DB default/null
        "push_notifications": ["id", "title", "body", "target_type", "target_ids", "type", "sent_by", "sent_by_name", "reach"],
        "notifications": ["id", "recipient_user_id", "actor_user_id", "type", "created_at"],
    },
}

GENERATED_COLUMNS_BY_TABLE = {
    "payments": {"net_cents"},
}

MISLABELED_TIMESTAMP_COLUMNS = {
    "name",
    "code",
    "caption",
    "title",
    "post_content",
    "content",
    "image_url",
    "source_name",
    "asset_tag",
    "error_message",
    "category",
    "text",
    "preview",
    "full_content",
    "subject",
    "description",
    "address",
    "withdrawal_pin_hash",
    "recovery_phrase_encrypted",
    "recovery_phrase_hash",
}


def table_priority(table_name: str) -> int:
    return PRIORITY_RANK.get(table_name, len(PRIORITY_TABLES))


def trim_row_columns(boundary: str, table_name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    table_columns = MINIMAL_TABLE_COLUMNS.get(boundary, {}).get(table_name)
    generated_columns = GENERATED_COLUMNS_BY_TABLE.get(table_name, set())
    if table_columns:
        return {key: value for key, value in row.items() if key in table_columns and key not in generated_columns}
    return {key: value for key, value in row.items() if key not in generated_columns}


def looks_like_timestamp_string(value: str) -> bool:
    s = value.strip()
    if not s:
        return False

    patterns = [
        r"^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)?)?$",
        r"^\d{10}$",
        r"^\d{13}$",
    ]
    return any(re.match(pattern, s) for pattern in patterns)


def is_non_timestamp_string(value: str) -> bool:
    if not value:
        return False
    text = value.strip()
    if text.startswith(("0x", "0X")):
        return True
    if not looks_like_timestamp_string(text):
        return True
    return False


def import_tables_with_retries(
    items: List[Dict[str, Any]],
    export_dir: Path,
    boundary: str,
    endpoint_template: str,
    headers: Dict[str, str],
    max_passes: int = 4,
) -> (List[Dict[str, Any]], int, int):
    pending = items[:]
    completed: List[Dict[str, Any]] = []
    total_rows = 0
    errors = 0

    for attempt in range(1, max_passes + 1):
        if not pending:
            break

        if attempt > 1:
            print(f"\nRetry pass {attempt} for {len(pending)} failed table(s)")

        next_pending: List[Dict[str, Any]] = []

        for item in pending:
            table_name = item["table"]
            ndjson_path = export_dir / item["file"]
            if not ndjson_path.exists():
                result = {
                    "table": table_name,
                    "inserted": 0,
                    "status": "error",
                    "error": f"NDJSON file missing: {ndjson_path}",
                    "rows": 0,
                }
                completed.append(result)
                errors += 1
                continue

            rows = [trim_row_columns(boundary, table_name, row) for row in read_ndjson_rows(ndjson_path)]
            # Normalize timestamp-like fields to avoid REST rejections for bad strings
            rows = [normalize_timestamp_fields(r) for r in rows]
            endpoint = endpoint_template.format(table_name=table_name)
            result = post_rows(table_name, rows, endpoint, headers)

            if result["status"] in ["ok", "skipped"]:
                completed.append(result)
                total_rows += result["rows"]
            else:
                if attempt == max_passes:
                    completed.append(result)
                    errors += 1
                else:
                    next_pending.append(item)

            status_emoji = "✓" if result["status"] == "ok" else "✗" if result["status"] == "error" else "⊘"
            print(f"{status_emoji} {table_name:40} {result['rows']:6} rows - {result['status']}")
            if result["status"] == "error":
                print(f"  → {result.get('error', 'Unknown error')}")

        if not next_pending:
            break
        if len(next_pending) == len(pending):
            print("\nNo additional progress could be made during retry pass. Stopping retries.")
            for item in next_pending:
                table_name = item["table"]
                result = {
                    "table": table_name,
                    "inserted": 0,
                    "status": "error",
                    "error": "No progress made after retry pass",
                    "rows": 0,
                }
                completed.append(result)
                errors += 1
            break
        pending = next_pending

    return completed, total_rows, errors


def is_placeholder_key(value: str) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return (
        "<copy" in lowered
        or "your_" in lowered
        or "<your" in lowered
        or "placeholder" in lowered
        or "<identity_db_password" in lowered
        or "<core_db_password" in lowered
        or "<wallet_db_password" in lowered
    )


def normalize_timestamp_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize common timestamp/date string fields in a row.

    - Converts ISO-like strings ending with 'Z' to '+00:00' and ensures a valid
      ISO format for Supabase REST ingestion.
    - Converts known invalid sentinel dates (e.g. '0000-00-00') to None.
    - Nulls misdeclared timestamp columns when values clearly are not dates.
    """
    if not isinstance(row, dict):
        return row

    for key, val in list(row.items()):
        if val is None:
            continue
        if isinstance(val, str) and val:
            lk = key.lower()
            timestamp_like = any(
                substr in lk
                for substr in ("_at", "date", "joined", "started", "ended", "last_", "created", "updated", "sent")
            )
            if not timestamp_like and key not in MISLABELED_TIMESTAMP_COLUMNS:
                continue

            s = val.strip()
            # handle common invalid sentinels
            if s.startswith("0000") or s.startswith("0001-01-01") or s in ("0000-00-00", "0000-00-00 00:00:00"):
                row[key] = None
                continue

            if is_non_timestamp_string(s):
                row[key] = None
                continue

            try:
                if s.endswith("Z"):
                    s = s[:-1] + "+00:00"
                # Try fromisoformat first
                try:
                    dt = datetime.datetime.fromisoformat(s)
                    row[key] = dt.isoformat()
                    continue
                except Exception:
                    pass

                # Try common SQL datetime format
                try:
                    dt = datetime.datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
                    row[key] = dt.isoformat()
                    continue
                except Exception:
                    pass

                # As a last resort, if it's numeric epoch seconds/millis
                if s.isdigit():
                    ts = int(s)
                    if ts > 1_000_000_000_000:
                        dt = datetime.datetime.fromtimestamp(ts / 1000.0, datetime.timezone.utc)
                    else:
                        dt = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
                    row[key] = dt.isoformat()
                    continue

            except Exception:
                pass

            row[key] = None
    return row


def post_rows(table_name: str, rows: List[Dict[str, Any]], endpoint: str, headers: Dict[str, str]) -> Dict[str, Any]:
    if not rows:
        return {"table": table_name, "inserted": 0, "status": "skipped", "rows": 0}

    payload = rows
    try:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=120)
        # Handle PostgREST schema cache missing column errors by retrying briefly
        retry_count = 0
        while response.status_code == 400 and retry_count < 3:
            try:
                body = response.json()
                if isinstance(body, dict) and body.get("code") == "PGRST204":
                    import time

                    retry_count += 1
                    time.sleep(2 * retry_count)
                    response = requests.post(endpoint, headers=headers, json=payload, timeout=120)
                    continue
            except Exception:
                break
            break

        response.raise_for_status()
        return {"table": table_name, "inserted": len(rows), "status": "ok", "rows": len(rows)}
    except requests.exceptions.HTTPError as e:
        # Treat duplicate key errors as non-fatal (skip)
        try:
            body = e.response.json()
            if isinstance(body, dict) and body.get("code") == "23505":
                return {"table": table_name, "inserted": 0, "status": "skipped", "error": "duplicate key", "rows": 0}
        except Exception:
            pass
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

    if is_placeholder_key(target_key):
        print(
            "Invalid TARGET_SUPABASE_SERVICE_ROLE_KEY: it looks like a placeholder. Replace it with the actual service role key from Supabase.",
            file=sys.stderr,
        )
        sys.exit(2)

    boundary_file = os.environ.get("BOUNDARY_MAP_FILE", "boundary_map.json")

    # Load boundary map and manifest
    boundary_map = load_boundary_map(export_dir, boundary_file)
    tables_for_boundary: Set[str] = set(boundary_map.get(boundary, []))

    if not tables_for_boundary:
        print(f"No tables found for boundary '{boundary}' in {boundary_file}.", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest(export_dir)
    # Deduplicate manifest entries while preserving order
    unique_manifest: List[Dict[str, Any]] = []
    seen_tables: Set[str] = set()
    for item in manifest:
        if item["table"] not in seen_tables:
            unique_manifest.append(item)
            seen_tables.add(item["table"])
        else:
            print(f"Warning: duplicate manifest entry removed for table '{item['table']}'", file=sys.stderr)

    manifest = unique_manifest
    manifest_table_names = {item["table"] for item in manifest}
    boundary_table_names = {table for tables in boundary_map.values() for table in tables}
    extra_tables = sorted(boundary_table_names - manifest_table_names)
    if extra_tables:
        print(
            f"Warning: boundary map {boundary_file} contains {len(extra_tables)} table(s) not present in manifest: {extra_tables}",
            file=sys.stderr,
        )

    additional_tables = [
        extra for extra in BOUNDARY_DEPENDENCY_TABLES.get(boundary, []) if extra not in tables_for_boundary
    ]
    if additional_tables:
        print(
            f"Note: adding dependency table(s) to {boundary} import: {additional_tables}",
            file=sys.stderr,
        )
        tables_for_boundary.update(additional_tables)

    missing_dependency_tables = [
        extra for extra in BOUNDARY_DEPENDENCY_TABLES.get(boundary, []) if extra not in manifest_table_names
    ]
    if missing_dependency_tables:
        print(
            f"Error: required dependency table(s) for {boundary} import are missing from manifest: {missing_dependency_tables}",
            file=sys.stderr,
        )
        sys.exit(1)

    boundary_manifest = [item for item in manifest if item["table"] in tables_for_boundary]
    boundary_manifest.sort(key=lambda item: table_priority(item["table"]))

    headers = {
        "apikey": target_key,
        "Authorization": f"Bearer {target_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    print(f"\n{'='*70}")
    print(f"Importing {boundary} project: {target_url}")
    print(f"Tables to import: {len(tables_for_boundary)}")
    print(f"{'='*70}\n")

    endpoint_template = f"{target_url}/rest/v1/{{table_name}}"
    summary, total_rows, errors = import_tables_with_retries(
        boundary_manifest,
        export_dir,
        boundary,
        endpoint_template,
        headers,
    )

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
