#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import requests


def load_manifest(export_dir: Path) -> List[Dict[str, Any]]:
    manifest_path = export_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Missing manifest: {manifest_path}")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


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
        return {"table": table_name, "inserted": 0, "status": "skipped"}

    payload = rows
    response = requests.post(endpoint, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    return {"table": table_name, "inserted": len(rows), "status": "inserted"}


def main() -> None:
    export_dir = Path(os.environ.get("EXPORT_DIR", "exports/old_project"))
    target_url = os.environ.get("TARGET_SUPABASE_URL", "").rstrip("/")
    target_key = os.environ.get("TARGET_SUPABASE_SERVICE_ROLE_KEY", "")
    if not target_url or not target_key:
        print("Set TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY first.", file=sys.stderr)
        sys.exit(2)

    manifest = load_manifest(export_dir)
    headers = {
        "apikey": target_key,
        "Authorization": f"Bearer {target_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    summary = []
    for item in manifest:
        table_name = item["table"]
        rows = read_ndjson_rows(export_dir / item["file"])
        endpoint = f"{target_url}/rest/v1/{table_name}"
        try:
            result = post_rows(table_name, rows, endpoint, headers)
            summary.append(result)
            print(json.dumps(result))
        except Exception as exc:
            print(json.dumps({"table": table_name, "inserted": 0, "status": "error", "error": str(exc)}))

    print(json.dumps({"summary": summary}, indent=2))


if __name__ == "__main__":
    main()
