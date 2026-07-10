#!/usr/bin/env python3
"""
Extract table schema from a Supabase project.
Fetches table and column information using Supabase's introspection endpoint.
"""

import json
import os
import sys
from typing import Any, Dict, List

import requests


def get_schema_info(supabase_url: str, service_role_key: str) -> Dict[str, Any]:
    """Get table schema info from Supabase project."""
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }

    # Supabase exposes table info via the introspection endpoint
    endpoint = f"{supabase_url}/rest/v1/?apiversion=1"

    try:
        response = requests.get(endpoint, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching schema: {e}", file=sys.stderr)
        return {}


def fetch_schema_from_old_project() -> None:
    """Fetch and display schema from the old Supabase project."""
    old_url = "https://rxtijxlvacqjiocdwzrh.supabase.co"
    old_key = os.environ.get("OLD_SUPABASE_SERVICE_ROLE_KEY", "")

    if not old_key:
        print("Set OLD_SUPABASE_SERVICE_ROLE_KEY to fetch schema from old project.", file=sys.stderr)
        sys.exit(2)

    print(f"Fetching schema from: {old_url}")
    schema = get_schema_info(old_url, old_key)

    # Try to get detailed info via pg_catalog
    headers = {
        "apikey": old_key,
        "Authorization": f"Bearer {old_key}",
    }

    # Query pg_tables and pg_attribute for schema info
    # This requires access to the internal Postgres tables
    queries = [
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
        """
        SELECT 
            t.table_name, 
            c.column_name, 
            c.udt_name as data_type,
            c.is_nullable,
            c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public'
        ORDER BY t.table_name, c.ordinal_position
        """,
    ]

    print("Schema info:", json.dumps(schema, indent=2))


if __name__ == "__main__":
    fetch_schema_from_old_project()
