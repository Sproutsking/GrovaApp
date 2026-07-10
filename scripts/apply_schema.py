#!/usr/bin/env python3
"""
Apply database schema to Supabase projects via direct Postgres connection.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 not available, attempting to install...", file=sys.stderr)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2
    import psycopg2.extras


def build_postgres_url(project_id: str, database_password: str) -> str:
    """Build Postgres connection URL for Supabase project."""
    # Supabase provides postgres at: postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
    return f"postgresql://postgres:{database_password}@db.{project_id}.supabase.co:5432/postgres"


def apply_schema(postgres_url: str, schema_file: Path, boundary: str) -> bool:
    """Apply SQL schema to Postgres database."""
    if not schema_file.exists():
        print(f"❌ Schema file not found: {schema_file}")
        return False

    schema_sql = schema_file.read_text(encoding="utf-8")

    try:
        print(f"\n{'='*70}")
        print(f"Applying schema for {boundary} project")
        print(f"Database: {postgres_url.split('@')[1]}")
        print(f"{'='*70}")

        with psycopg2.connect(postgres_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                # Execute the schema
                cur.execute(schema_sql)
                conn.commit()

                # Get table count
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                table_count = cur.fetchone()[0]

                print(f"✓ Schema applied successfully")
                print(f"✓ Tables created: {table_count}")
                return True

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        print(f"Details: {e.pgerror if hasattr(e, 'pgerror') else str(e)}")
        return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False


def main() -> None:
    export_dir = Path(os.environ.get("EXPORT_DIR", "exports/old_project"))

    # Get database password from environment (derived from service role key or provided separately)
    projects = {
        "identity": {
            "project_id": "pevhyriszemvnrwvfshm",
            "password_env": "IDENTITY_DB_PASSWORD",
        },
        "core": {
            "project_id": "hhqohlzzpzgkfdeanudw",
            "password_env": "CORE_DB_PASSWORD",
        },
        "wallet": {
            "project_id": "wyqtcjqbdniwebvrwdnk",
            "password_env": "WALLET_DB_PASSWORD",
        },
    }

    all_success = True

    for boundary, project_info in projects.items():
        password = os.environ.get(project_info["password_env"])
        if not password:
            print(f"⚠ Skipping {boundary}: {project_info['password_env']} not set")
            continue

        project_id = project_info["project_id"]
        schema_file = export_dir / f"schema_{boundary}.sql"
        postgres_url = build_postgres_url(project_id, password)

        success = apply_schema(postgres_url, schema_file, boundary)
        if not success:
            all_success = False

    print(f"\n{'='*70}")
    if all_success:
        print("✓ All schemas applied successfully")
    else:
        print("❌ Some schemas failed to apply")
    print(f"{'='*70}\n")

    sys.exit(0 if all_success else 1)


if __name__ == "__main__":
    main()
