#!/usr/bin/env python3
"""
Export ALL data from old Supabase project to NDJSON files.
Uses the service role key to access all tables.

PRODUCTION-SAFE: Comprehensive data export for migration.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

def fetch_table_data(table_name: str, supabase_url: str, service_role_key: str, limit: int = 10000) -> List[Dict[str, Any]]:
    """Fetch all rows from a table using the REST API."""
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    
    endpoint = f"{supabase_url}/rest/v1/{table_name}"
    all_rows = []
    offset = 0
    
    try:
        while True:
            response = requests.get(
                endpoint,
                headers=headers,
                params={"offset": offset, "limit": limit},
                timeout=30
            )
            response.raise_for_status()
            
            rows = response.json()
            if not rows:
                break
            
            all_rows.extend(rows)
            offset += limit
            
            if len(rows) < limit:
                break
        
        return all_rows
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return []  # Table doesn't exist, that's OK
        raise
    except Exception as e:
        print(f"Error fetching {table_name}: {e}")
        return []

def save_ndjson(data: List[Dict[str, Any]], filepath: Path) -> int:
    """Save data as NDJSON (one JSON object per line)."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    with filepath.open("w", encoding="utf-8") as f:
        for row in data:
            f.write(json.dumps(row, default=str) + "\n")
    
    return len(data)

def main() -> None:
    old_url = os.environ.get("OLD_SUPABASE_URL", "https://rxtijxlvacqjiocdwzrh.supabase.co").rstrip("/")
    old_key = os.environ.get("OLD_SUPABASE_SERVICE_ROLE_KEY", "")
    export_dir = Path("exports/old_project")
    
    if not old_key:
        print("❌ Set OLD_SUPABASE_SERVICE_ROLE_KEY first!")
        sys.exit(2)
    
    export_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 70)
    print("SUPABASE FULL DATA EXPORT (PRODUCTION)")
    print(f"Source: {old_url}")
    print(f"Export directory: {export_dir.absolute()}")
    print("=" * 70)
    print()
    
    # Hardcoded comprehensive table list
    tables = [
        "profiles", "wallets", "posts", "posts_backup", "comments", "comment_likes",
        "post_likes", "reels", "reel_likes", "stories", "story_likes", "messages",
        "conversations", "message_reads", "deleted_messages", "group_messages",
        "communities", "community_channels", "community_members", "community_roles",
        "community_messages", "community_invites", "user_sessions", "user_recovery_phrases",
        "two_factor_auth", "device_fingerprints", "trusted_devices", "security_events",
        "verification_codes", "notification_badge_state", "notification_dedup",
        "notification_preferences", "audit_logs", "drafts", "saved_content",
        "follows", "news_posts", "news_feed", "news_fetch_log", "discovery_content",
        "sounds", "support_tickets", "support_messages", "status_updates", "status_likes",
        "live_sessions", "call_logs", "active_calls", "card_posts", "transactions",
        "wallet_history", "wallet_addresses", "payment_products", "payment_intents",
        "payments", "webhook_events", "subscriptions", "ep_dashboard", "ep_transactions",
        "ep_treasury", "ep_treasury_config", "withdrawal_queue", "p2p_payment_methods",
        "p2p_rate_limits", "p2p_reputation", "paywave_fee_config", "platform_settings",
        "platform_freeze", "liquidity_config", "boost_ep_prices", "admin_revenue_summary",
        "admin_team", "admin_user_stats", "audit_log", "ambassador_profiles",
    ]
    
    print(f"Exporting {len(tables)} tables...")
    print()
    
    manifest = []
    total_rows = 0
    failed_tables = []
    
    for i, table_name in enumerate(sorted(tables), 1):
        try:
            print(f"[{i:3d}/{len(tables)}] Exporting {table_name:40s} ", end="", flush=True)
            
            # Fetch data
            rows = fetch_table_data(table_name, old_url, old_key)
            
            # Save to NDJSON
            filepath = export_dir / f"{table_name}.ndjson"
            row_count = save_ndjson(rows, filepath)
            
            print(f"✓ {row_count:6d} rows")
            total_rows += row_count
            
            # Add to manifest
            manifest.append({
                "table": table_name,
                "rows": row_count,
                "file": f"{table_name}.ndjson"
            })
        
        except Exception as e:
            print(f"✗ ERROR: {str(e)[:50]}")
            failed_tables.append((table_name, str(e)))
    
    # Save manifest
    manifest_path = export_dir / "manifest.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    
    # Print summary
    print()
    print("=" * 70)
    print(f"Export Complete!")
    print(f"  Total tables:  {len(manifest)}")
    print(f"  Total rows:    {total_rows:,}")
    print(f"  Failed:        {len(failed_tables)}")
    print(f"  Manifest:      {manifest_path}")
    print("=" * 70)
    
    if failed_tables:
        print("\n⚠️  Failed tables:")
        for table, error in failed_tables:
            print(f"  - {table}: {error[:60]}")
        sys.exit(1)
    else:
        print("\n✅ Export successful! All data ready for import.")
        sys.exit(0)

if __name__ == "__main__":
    main()
