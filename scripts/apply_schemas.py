#!/usr/bin/env python3
"""
Apply Supabase schema SQL files to target projects.
This script attempts to connect directly to the PostgreSQL databases.
"""

import os
import sys
import argparse
from pathlib import Path

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print("Warning: psycopg2 not available. Install with: pip install psycopg2-binary")


def parse_connection_string(supabase_url, service_role_key):
    """Construct a PostgreSQL connection string from Supabase details."""
    # Supabase URLs follow pattern: https://[project-ref].supabase.co
    # We need to connect to: [project-ref].supabase.co:5432
    parts = supabase_url.replace("https://", "").split(".")
    project_ref = parts[0]
    
    # Standard Supabase connection
    host = f"{project_ref}.supabase.co"
    port = "5432"
    database = "postgres"
    user = "postgres"
    password = service_role_key  # Using the service role key as password (unlikely to work)
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode=require"


def load_sql_file(path: Path) -> str:
    """Load and read SQL file."""
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")
    return path.read_text(encoding="utf-8")


def split_sql_statements(sql_text: str) -> list:
    """Split SQL text into individual statements."""
    statements = []
    current = ""
    in_string = False
    string_char = None
    
    for char in sql_text:
        if char in ("'", '"') and not in_string:
            in_string = True
            string_char = char
        elif char == string_char and in_string:
            in_string = False
            string_char = None
        elif char == ";" and not in_string:
            if current.strip():
                statements.append(current.strip() + ";")
            current = ""
            continue
        
        current += char
    
    if current.strip():
        statements.append(current.strip())
    
    return statements


def apply_schema_via_psycopg2(sql_path: Path, supabase_url: str, service_role_key: str) -> bool:
    """Attempt to apply schema using direct PostgreSQL connection."""
    if not HAS_PSYCOPG2:
        return False
    
    try:
        conn_str = parse_connection_string(supabase_url, service_role_key)
        sql = load_sql_file(sql_path)
        
        print(f"Attempting direct PostgreSQL connection...")
        print(f"Connection string (redacted): postgresql://postgres:***@{conn_str.split('@')[1]}")
        
        with psycopg2.connect(conn_str) as conn:
            with conn.cursor() as cur:
                statements = split_sql_statements(sql)
                for i, stmt in enumerate(statements, 1):
                    if stmt.strip().startswith("--"):
                        continue
                    try:
                        print(f"  Executing statement {i}/{len(statements)}...", end=" ", flush=True)
                        cur.execute(stmt)
                        print("✓")
                    except Exception as e:
                        print(f"✗ Error: {str(e)[:100]}")
                        return False
            conn.commit()
        
        print(f"✅ Schema applied successfully from {sql_path.name}")
        return True
    
    except Exception as e:
        print(f"❌ Failed to connect or apply schema: {e}")
        return False


def print_manual_instructions(boundary: str, sql_path: Path, supabase_url: str):
    """Print instructions for manual schema application via Supabase dashboard."""
    print(f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║ MANUAL SCHEMA APPLICATION REQUIRED FOR: {boundary.upper():45} ║
╚══════════════════════════════════════════════════════════════════════════════╝

⚠️  Direct database connection failed. You must apply the schema manually:

1. Go to Supabase Dashboard:
   {supabase_url}

2. Navigate to: SQL Editor (left sidebar)

3. Click "New Query" button

4. Copy the entire contents of:
   {sql_path}

5. Paste into the query editor

6. Click "Run" button

7. Wait for execution to complete (should see "✓" checkmarks)

8. Once complete, run the import again:
   BOUNDARY_ONLY={boundary} bash scripts/import_only.sh

After all three schemas are applied, re-run the full import:
   bash scripts/import_all_boundaries.sh
""")


def main():
    parser = argparse.ArgumentParser(description="Apply Supabase schema SQL files")
    parser.add_argument(
        "boundary",
        nargs="?",
        choices=["identity", "core", "wallet", "all"],
        default="all",
        help="Which boundary schema to apply (default: all)"
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Try automatic application only; don't show manual instructions"
    )
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    export_dir = project_root / "exports" / "old_project"
    
    schemas = {
        "identity": {
            "file": export_dir / "identity_apply.sql",
            "url_env": "IDENTITY_SUPABASE_URL",
            "key_env": "IDENTITY_SUPABASE_SERVICE_ROLE_KEY",
        },
        "core": {
            "file": export_dir / "core_apply.sql",
            "url_env": "CORE_SUPABASE_URL",
            "key_env": "CORE_SUPABASE_SERVICE_ROLE_KEY",
        },
        "wallet": {
            "file": export_dir / "wallet_apply.sql",
            "url_env": "WALLET_SUPABASE_URL",
            "key_env": "WALLET_SUPABASE_SERVICE_ROLE_KEY",
        },
    }
    
    boundaries = ["identity", "core", "wallet"] if args.boundary == "all" else [args.boundary]
    
    for boundary in boundaries:
        schema = schemas[boundary]
        url = os.environ.get(schema["url_env"])
        key = os.environ.get(schema["key_env"])
        
        if not url or not key:
            print(f"⚠️  Skipping {boundary}: Missing {schema['url_env']} or {schema['key_env']}")
            continue
        
        print(f"\n{'='*80}")
        print(f"Applying {boundary.upper()} schema")
        print(f"{'='*80}")
        
        success = apply_schema_via_psycopg2(schema["file"], url, key)
        
        if not success:
            if args.auto:
                print(f"❌ Failed to apply {boundary} schema automatically")
            else:
                print_manual_instructions(boundary, schema["file"], url)


if __name__ == "__main__":
    main()
