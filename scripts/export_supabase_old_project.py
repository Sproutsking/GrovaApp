#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from typing import Dict, List

import requests


def fetch_json(url: str, headers: Dict[str, str], params: Dict[str, str] | None = None) -> List[dict]:
    response = requests.get(url, headers=headers, params=params, timeout=120)
    response.raise_for_status()
    return response.json()


def main() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    output_dir = Path(os.environ.get("EXPORT_DIR", "exports/old_project"))

    if not supabase_url or not service_role_key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.", file=sys.stderr)
        sys.exit(2)

    output_dir.mkdir(parents=True, exist_ok=True)

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }

    openapi_url = f"{supabase_url}/rest/v1/"
    openapi_resp = requests.get(openapi_url, headers={**headers, "Accept": "application/openapi+json"}, timeout=120)
    openapi_resp.raise_for_status()
    openapi_spec = openapi_resp.json()

    definitions = openapi_spec.get("definitions", {})
    table_names = [name for name in sorted(definitions.keys()) if name not in {"metadata"}]

    schema_path = output_dir / "schema_definitions.json"
    with schema_path.open("w", encoding="utf-8") as handle:
        json.dump({"tables": table_names, "definitions": definitions}, handle, indent=2)

    manifest = []

    for table_name in table_names:
        ndjson_path = output_dir / f"{table_name}.ndjson"
        if ndjson_path.exists():
            ndjson_path.unlink()

        rows_written = 0
        offset = 0
        page_size = 1000
        while True:
            params = {"select": "*", "limit": str(page_size), "offset": str(offset)}
            try:
                rows = fetch_json(f"{supabase_url}/rest/v1/{table_name}", headers, params=params)
            except requests.HTTPError as exc:
                print(f"Skipping {table_name}: {exc}", file=sys.stderr)
                break

            if not rows:
                break

            with ndjson_path.open("a", encoding="utf-8") as handle:
                for row in rows:
                    handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
                    handle.write("\n")
            rows_written += len(rows)
            if len(rows) < page_size:
                break
            offset += page_size

        manifest.append({"table": table_name, "rows": rows_written, "file": f"{table_name}.ndjson"})
        print(f"Exported {rows_written} rows from {table_name}")

    manifest_path = output_dir / "manifest.json"
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"Done. Exported data to {output_dir}")


if __name__ == "__main__":
    main()
