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
        "discovery_content": [
            "id",
            "title",
            "category",
            "mood",
            "caption",
            "video_url",
            "thumbnail_url",
            "duration",
            "engagement_score",
            "view_count",
            "tags",
            "source",
            "source_id",
            "photographer",
            "active",
            "created_by",
            "created_at",
            "updated_at",
        ],
        "group_chats": ["id", "name", "icon", "created_by", "member_ids", "members", "created_at", "updated_at", "icon_url"],
        "invite_codes": [
            "id",
            "code",
            "type",
            "max_uses",
            "uses_count",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "expires_at",
            "status",
            "metadata",
            "community_id",
            "community_name",
            "price_override",
            "entry_price",
        ],
        "invite_code_usage": ["id", "invite_code_id", "code", "used_by", "used_at", "ip_address", "user_agent"],
        "news_posts": [
            "id",
            "description",
            "category",
            "url_hash",
            "published_at",
            "created_at",
            "is_active",
            "views_count",
            "likes_count",
            "comments_count",
        ],
        "news_feed": ["id", "user_id", "news_id", "added_at"],
        "upload_rate_limits": ["id", "user_id", "upload_type", "upload_count", "window_start", "created_at"],
    },
    "wallet": {
        "profiles": ["id", "email", "username", "created_at"],
        "payment_products": [
            "id",
            "name",
            "description",
            "type",
            "tier",
            "amount_usd",
            "currency",
            "stripe_price_id",
            "paystack_plan_code",
            "interval",
            "is_active",
            "metadata",
            "created_at",
            "updated_at",
        ],
        "admin_revenue_summary": [
            "period_start",
            "period_end",
            "total_revenue",
            "stripe_revenue",
            "paystack_revenue",
            "web3_revenue",
            "transaction_count",
            "user_count",
            "activated_users",
            "created_at",
        ],
        "admin_user_stats": [
            "total_users",
            "active_users_today",
            "active_users_week",
            "total_transactions",
            "total_volume_usd",
            "activated_users",
            "updated_at",
        ],
        "liquidity_config": [
            "id",
            "chain",
            "min_liquidity",
            "target_liquidity",
            "current_liquidity",
            "is_enabled",
            "last_rebalanced_at",
            "created_at",
            "updated_at",
        ],
        "p2p_payment_methods": [
            "id",
            "user_id",
            "method_type",
            "provider",
            "account_identifier",
            "is_verified",
            "verified_at",
            "is_default",
            "created_at",
        ],
        "p2p_rate_limits": ["id", "user_id", "ip_address", "action_type", "action_count", "window_start", "created_at"],
        "p2p_reputation": [
            "id",
            "user_id",
            "total_transactions",
            "successful_transactions",
            "failed_transactions",
            "reputation_score",
            "is_flagged",
            "flag_reason",
            "flagged_at",
            "last_transaction_at",
            "created_at",
            "updated_at",
        ],
        "paywave_fee_config": [
            "id",
            "fee_type",
            "percentage",
            "fixed_amount",
            "min_amount",
            "max_amount",
            "is_active",
            "description",
            "created_at",
            "updated_at",
        ],
        "withdrawal_queue": [
            "id",
            "user_id",
            "wallet_id",
            "amount",
            "target_address",
            "chain",
            "status",
            "pin_verified",
            "requires_pin",
            "transaction_hash",
            "block_number",
            "fee_amount",
            "net_amount",
            "failure_reason",
            "attempted_at",
            "completed_at",
            "created_at",
            "updated_at",
        ],
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

FIELD_ALIASES = {
    "wallet": {
        "admin_revenue_summary": {
            "total_payments": "transaction_count",
            "total_revenue_usd": "total_revenue",
            "paystack_count": "transaction_count",
            "web3_count": "transaction_count",
            "paystack_usd": "paystack_revenue",
            "web3_usd": "web3_revenue",
            "paid_users": "user_count",
        },
        "admin_user_stats": {
            "total_active_accounts": "total_users",
        },
        "paywave_fee_config": {
            "transaction_type": "fee_type",
            "fee_percentage": "percentage",
        },
        "p2p_payment_methods": {
            "type": "method_type",
            "account_number": "account_identifier",
        },
        "p2p_rate_limits": {
            "action": "action_type",
            "count": "action_count",
        },
        "p2p_reputation": {
            "total_trades": "total_transactions",
            "completed_trades": "successful_transactions",
            "disputed_trades": "failed_transactions",
            "trust_score": "reputation_score",
        },
        "withdrawal_queue": {
            "ep_amount": "amount",
            "net_ep": "net_amount",
        },
    },
    "core": {
        "news_feed": {
            "id": "news_id",
        },
    },
}

REQUIRED_TABLE_COLUMNS = {
    "core": {
        "news_feed": ["user_id", "news_id"],
    },
    "wallet": {
        "liquidity_config": ["chain", "min_liquidity", "target_liquidity", "current_liquidity"],
        "p2p_payment_methods": ["user_id", "method_type", "account_identifier"],
        "p2p_rate_limits": ["user_id", "action_type", "action_count"],
        "p2p_reputation": ["user_id"],
        "withdrawal_queue": ["wallet_id", "amount", "target_address", "chain", "status"],
    },
}

GENERATED_COLUMNS_BY_TABLE = {
    "payments": {"net_cents"},
}



def table_priority(table_name: str) -> int:
    return PRIORITY_RANK.get(table_name, len(PRIORITY_TABLES))


def apply_boundary_row_defaults(boundary: str, table_name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    if boundary != "wallet":
        return row

    if table_name == "admin_revenue_summary":
        today = datetime.date.today().isoformat()
        row.setdefault("period_start", today)
        row.setdefault("period_end", today)

    return row


def trim_row_columns(boundary: str, table_name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    row = apply_boundary_row_defaults(boundary, table_name, row)

    table_columns = MINIMAL_TABLE_COLUMNS.get(boundary, {}).get(table_name)
    generated_columns = GENERATED_COLUMNS_BY_TABLE.get(table_name, set())
    aliases = FIELD_ALIASES.get(boundary, {}).get(table_name, {})

    if table_columns:
        cleaned: Dict[str, Any] = {}
        for key, value in row.items():
            mapped_key = aliases.get(key, key)
            if mapped_key in generated_columns:
                continue
            if mapped_key in table_columns and mapped_key not in cleaned:
                cleaned[mapped_key] = value
        return {key: cleaned[key] for key in table_columns if key in cleaned}

    return {key: value for key, value in row.items() if key not in generated_columns}


def has_required_columns(boundary: str, table_name: str, row: Dict[str, Any]) -> bool:
    required_columns = REQUIRED_TABLE_COLUMNS.get(boundary, {}).get(table_name, [])
    if not required_columns:
        return True

    for column_name in required_columns:
        value = row.get(column_name)
        if value in (None, "", [], {}):
            return False
    return True


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


def load_timestamp_columns_from_schema(export_dir: Path, boundary: str) -> Dict[str, Set[str]]:
    timestamp_columns_by_table: Dict[str, Set[str]] = {}
    sql_files = []

    boundary_apply_pattern = str(export_dir / f"{boundary}_apply*.sql")
    sql_files = sorted(Path(export_dir).glob(f"{boundary}_apply*.sql"))

    if not sql_files:
        sql_files = sorted(export_dir.glob("*.sql"))

    table_regex = re.compile(r"CREATE TABLE IF NOT EXISTS public\.([a-zA-Z0-9_]+)\s*\((.*?)\);", re.S | re.I)
    column_regex = re.compile(r"^\s*([a-zA-Z0-9_]+)\s+.*\bTIMESTAMP\b.*", re.I)

    for sql_file in sql_files:
        try:
            content = sql_file.read_text(encoding="utf-8")
        except Exception:
            continue

        for match in table_regex.finditer(content):
            table_name = match.group(1).strip().lower()
            body = match.group(2)
            for line in body.splitlines():
                line = line.strip()
                if not line or line.startswith("--"):
                    continue
                column_match = column_regex.match(line)
                if column_match:
                    column_name = column_match.group(1).strip().lower()
                    timestamp_columns_by_table.setdefault(table_name, set()).add(column_name)

    return timestamp_columns_by_table


def is_timestamp_field_name(field_name: str) -> bool:
    name = field_name.strip().lower()
    if not name:
        return False

    explicit_timestamp_fields = {
        "created_at",
        "updated_at",
        "deleted_at",
        "published_at",
        "added_at",
        "fetched_at",
        "sent_at",
        "verified_at",
        "started_at",
        "ended_at",
        "attempted_at",
        "completed_at",
        "closed_at",
        "resolved_at",
        "expires_at",
        "window_start",
        "window_end",
        "last_rebalanced_at",
        "last_transaction_at",
        "used_at",
        "joined_at",
        "created",
        "updated",
        "deleted",
        "published",
        "sent",
        "started",
        "ended",
        "joined",
    }
    if name in explicit_timestamp_fields:
        return True

    if name.endswith(("_at", "_date", "_time", "_on")):
        return True

    return False


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
    timestamp_columns_by_table: Dict[str, Set[str]],
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

            rows = []
            timestamp_columns = timestamp_columns_by_table.get(table_name, set())
            for row in read_ndjson_rows(ndjson_path):
                cleaned_row = trim_row_columns(boundary, table_name, row)
                if not cleaned_row:
                    continue
                if not has_required_columns(boundary, table_name, cleaned_row):
                    continue
                rows.append(normalize_timestamp_fields(table_name, cleaned_row, timestamp_columns))

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


def normalize_timestamp_fields(table_name: str, row: Dict[str, Any], timestamp_columns: Set[str]) -> Dict[str, Any]:
    """Normalize timestamp/date fields for a specific table row.

    - Converts ISO-like strings ending with 'Z' to '+00:00' and ensures a valid
      ISO format for Supabase REST ingestion.
    - Converts known invalid sentinel dates (e.g. '0000-00-00') to None.
    - Nulls values that cannot be parsed for columns typed as timestamps.
    """
    if not isinstance(row, dict):
        return row

    timestamp_columns = {key.strip().lower() for key in timestamp_columns}

    for key, val in list(row.items()):
        if val is None:
            continue

        normalized_key = key.strip().lower()
        if normalized_key not in timestamp_columns and not is_timestamp_field_name(normalized_key):
            continue

        if isinstance(val, str):
            s = val.strip()
            if not s:
                row[key] = None
                continue

            if s.startswith("0000") or s.startswith("0001-01-01") or s in ("0000-00-00", "0000-00-00 00:00:00"):
                row[key] = None
                continue

            if is_non_timestamp_string(s):
                row[key] = None
                continue

            try:
                if s.endswith("Z"):
                    s = s[:-1] + "+00:00"

                try:
                    dt = datetime.datetime.fromisoformat(s)
                    row[key] = dt.isoformat()
                    continue
                except Exception:
                    pass

                try:
                    dt = datetime.datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
                    row[key] = dt.isoformat()
                    continue
                except Exception:
                    pass

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
            continue

        if isinstance(val, (int, float)):
            try:
                ts = float(val)
                if ts > 1_000_000_000_000:
                    dt = datetime.datetime.fromtimestamp(ts / 1000.0, datetime.timezone.utc)
                else:
                    dt = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
                row[key] = dt.isoformat()
                continue
            except Exception:
                row[key] = None
                continue

        row[key] = None
    return row


def post_row(table_name: str, row: Dict[str, Any], endpoint: str, headers: Dict[str, str]) -> Dict[str, Any]:
    try:
        response = requests.post(endpoint, headers=headers, json=[row], timeout=120)
        retry_count = 0
        while response.status_code == 400 and retry_count < 3:
            try:
                body = response.json()
                if isinstance(body, dict) and body.get("code") == "PGRST204":
                    import time

                    retry_count += 1
                    time.sleep(2 * retry_count)
                    response = requests.post(endpoint, headers=headers, json=[row], timeout=120)
                    continue
            except Exception:
                break
            break

        response.raise_for_status()
        return {"ok": True, "skip": False, "error": None}
    except requests.exceptions.HTTPError as e:
        try:
            body = e.response.json()
            if isinstance(body, dict):
                if body.get("code") == "23505":
                    return {"ok": False, "skip": True, "error": "duplicate key"}
                if body.get("code") == "23503":
                    return {"ok": False, "skip": True, "error": "foreign key violation"}
                if body.get("code") == "22007":
                    return {"ok": False, "skip": True, "error": "invalid timestamp"}
                if body.get("code") == "23514":
                    return {"ok": False, "skip": True, "error": "check constraint failed"}
            return {"ok": False, "skip": False, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
        except Exception:
            return {"ok": False, "skip": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "skip": False, "error": str(e)}


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
        # Try row-by-row fallback for tables with a few invalid rows.
        try:
            body = e.response.json()
            if isinstance(body, dict) and body.get("code") in {"22007", "23514", "23503", "23505", "42703", "PGRST204"}:
                inserted = 0
                skipped = 0
                errors = []
                for row in rows:
                    row_result = post_row(table_name, row, endpoint, headers)
                    if row_result["ok"]:
                        inserted += 1
                    elif row_result["skip"]:
                        skipped += 1
                    else:
                        errors.append(row_result["error"])
                if inserted > 0:
                    status = "ok"
                    error_msg = "; ".join(errors[:3]) if errors else None
                    return {
                        "table": table_name,
                        "inserted": inserted,
                        "status": status,
                        "error": error_msg,
                        "rows": inserted,
                    }
                if skipped > 0 and not errors:
                    return {
                        "table": table_name,
                        "inserted": 0,
                        "status": "skipped",
                        "error": None,
                        "rows": 0,
                    }
        except Exception:
            pass

        try:
            body = e.response.json()
            if isinstance(body, dict) and body.get("code") == "23505":
                return {"table": table_name, "inserted": 0, "status": "skipped", "error": "duplicate key", "rows": 0}
            if isinstance(body, dict) and body.get("code") == "23503":
                return {"table": table_name, "inserted": 0, "status": "skipped", "error": "foreign key violation", "rows": 0}
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
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }

    print(f"\n{'='*70}")
    print(f"Importing {boundary} project: {target_url}")
    print(f"Tables to import: {len(tables_for_boundary)}")
    print(f"{'='*70}\n")

    endpoint_template = f"{target_url}/rest/v1/{{table_name}}"
    timestamp_columns_by_table = load_timestamp_columns_from_schema(export_dir, boundary)

    summary, total_rows, errors = import_tables_with_retries(
        boundary_manifest,
        export_dir,
        boundary,
        endpoint_template,
        headers,
        timestamp_columns_by_table=timestamp_columns_by_table,
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
