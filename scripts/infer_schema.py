#!/usr/bin/env python3
"""
Infer Postgres table schemas from NDJSON data files.
Generate CREATE TABLE statements for each table.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


def infer_type_from_value(value: Any) -> str:
    """Map Python value types to PostgreSQL types."""
    if value is None:
        return "TEXT"  # Default for null
    if isinstance(value, bool):
        return "BOOLEAN"
    if isinstance(value, int):
        return "BIGINT"
    if isinstance(value, float):
        return "FLOAT8"
    if isinstance(value, str):
        # Check for UUID pattern
        if len(value) == 36 and value.count("-") == 4:
            return "UUID"
        # Check for timestamp pattern
        if value.endswith("Z") or value.endswith("+00:00") or "T" in value:
            return "TIMESTAMP WITH TIME ZONE"
        # Default text
        if len(value) > 255:
            return "TEXT"
        return "VARCHAR(255)"
    if isinstance(value, dict):
        return "JSONB"
    if isinstance(value, list):
        return "JSONB"
    return "TEXT"


def read_ndjson_sample(path: Path, max_rows: int = 100) -> List[Dict[str, Any]]:
    """Read sample rows from NDJSON file."""
    rows = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= max_rows:
                break
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def infer_column_types(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    """Infer column types from sample data."""
    column_types: Dict[str, Set[str]] = {}
    column_null_counts: Dict[str, int] = {}

    for row in rows:
        for key, value in row.items():
            if key not in column_types:
                column_types[key] = set()
                column_null_counts[key] = 0

            if value is None:
                column_null_counts[key] += 1
            else:
                inferred = infer_type_from_value(value)
                column_types[key].add(inferred)

    # Consolidate types (if mixed, use most general)
    consolidated: Dict[str, Tuple[str, bool]] = {}
    for col, types in column_types.items():
        types_set: Set[str] = types if types else {"TEXT"}
        is_not_null = column_null_counts.get(col, 0) < len(rows)
        
        if not types_set:
            consolidated[col] = ("TEXT", is_not_null)
        elif "TEXT" in types_set:
            consolidated[col] = ("TEXT", is_not_null)
        elif "JSONB" in types_set:
            consolidated[col] = ("JSONB", is_not_null)
        elif "FLOAT8" in types_set:
            consolidated[col] = ("FLOAT8", is_not_null)
        elif "BIGINT" in types_set:
            consolidated[col] = ("BIGINT", is_not_null)
        elif "UUID" in types_set:
            consolidated[col] = ("UUID", is_not_null)
        elif "BOOLEAN" in types_set:
            consolidated[col] = ("BOOLEAN", is_not_null)
        elif "TIMESTAMP WITH TIME ZONE" in types_set:
            consolidated[col] = ("TIMESTAMP WITH TIME ZONE", is_not_null)
        else:
            # Get any type from the set
            any_type = next(iter(types_set)) if types_set else "TEXT"
            consolidated[col] = (any_type, is_not_null)

    return consolidated


def generate_create_table_sql(table_name: str, column_types: Dict[str, str]) -> str:
    """Generate CREATE TABLE SQL statement."""
    lines = [f"CREATE TABLE IF NOT EXISTS public.{table_name} ("]

    # Add columns
    col_defs = []
    for col_name, (col_type, is_not_null) in column_types.items():
        nullable = "" if is_not_null else "-- nullable"
        col_defs.append(f"  {col_name} {col_type} {nullable}".rstrip())

    lines.append(",\n".join(col_defs))
    lines.append(");")

    return "\n".join(lines)


def main():
    export_dir = Path("exports/old_project")
    boundary_path = export_dir / "boundary_map.json"

    if not boundary_path.exists():
        print(f"Error: boundary_map.json not found at {boundary_path}")
        return

    boundary_map = json.loads(boundary_path.read_text())

    # Collect all tables
    all_tables = set()
    for tables in boundary_map.values():
        all_tables.update(tables)

    # Generate SQL for each table
    sql_statements: Dict[str, str] = {}

    for table_name in sorted(all_tables):
        ndjson_path = export_dir / f"{table_name}.ndjson"

        if not ndjson_path.exists():
            print(f"⊘ {table_name}: No data file")
            continue

        sample_rows = read_ndjson_sample(ndjson_path)
        if not sample_rows:
            print(f"⊘ {table_name}: No rows in sample")
            continue

        column_types = infer_column_types(sample_rows)
        sql = generate_create_table_sql(table_name, column_types)
        sql_statements[table_name] = sql

        print(f"✓ {table_name}: {len(column_types)} columns inferred")

    # Save SQL for each boundary
    for boundary, tables in boundary_map.items():
        output_path = export_dir / f"schema_{boundary}.sql"
        with output_path.open("w", encoding="utf-8") as f:
            f.write(f"-- Schema for {boundary} project\n\n")
            for table in tables:
                if table in sql_statements:
                    f.write(sql_statements[table])
                    f.write("\n\n")

        print(f"\n✓ Created schema_{boundary}.sql with {len([t for t in tables if t in sql_statements])} tables")

    # Also save consolidated schema
    consolidated_path = export_dir / "schema_all.sql"
    with consolidated_path.open("w", encoding="utf-8") as f:
        f.write("-- Complete schema for all tables\n\n")
        for table_name in sorted(sql_statements.keys()):
            f.write(sql_statements[table_name])
            f.write("\n\n")

    print(f"\n✓ Created schema_all.sql")


if __name__ == "__main__":
    main()
