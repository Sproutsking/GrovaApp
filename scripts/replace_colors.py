#!/usr/bin/env python3
import re
from pathlib import Path

# Conservative mapping for common rgba patterns to CSS variables
replacements = [
    # accent greens
    (r"rgba\(132,\s*204,\s*22,\s*0?\.03\)", "var(--accent-glow)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.05\)", "var(--accent-glow)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.08\)", "var(--accent-bg-soft)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.1\)", "var(--accent-glow)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.12\)", "var(--accent-bg-soft)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.15\)", "var(--accent-glow-strong)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.2\)", "var(--accent-bg-strong)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.25\)", "var(--accent-border)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.3\)", "var(--accent-border-strong)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.5\)", "var(--accent-border-strong)"),
    (r"rgba\(132,\s*204,\s*22,\s*0?\.95\)", "var(--accent)"),

    # whites / glass
    (r"rgba\(255,\s*255,\s*255,\s*0?\.04\)", "var(--surface)") ,
    (r"rgba\(255,\s*255,\s*255,\s*0?\.05\)", "var(--surface-strong)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.06\)", "var(--panel-soft)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.07\)", "var(--surface-border)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.08\)", "var(--surface-border)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.09\)", "var(--surface-border)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.12\)", "var(--glass-border)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.18\)", "var(--glass-border)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.35\)", "var(--indicator-bg)"),
    (r"rgba\(255,\s*255,\s*255,\s*0?\.6\)", "var(--text-inverse)"),

    # blacks / panels
    (r"rgba\(0,\s*0,\s*0,\s*0?\.28\)", "var(--overlay-secondary)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.3\)", "var(--overlay-secondary)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.5\)", "var(--panel)") ,
    (r"rgba\(0,\s*0,\s*0,\s*0?\.72\)", "var(--panel)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.78\)", "var(--panel)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.85\)", "var(--panel-strong)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.88\)", "var(--panel-strong)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.9\)", "var(--panel-strong)"),
    (r"rgba\(0,\s*0,\s*0,\s*0?\.96\)", "var(--overlay)"),

    # misc colors -> text vars
    (r"#9ca3af", "var(--text-secondary)"),
    (r"#6b7280", "var(--text-muted)"),
    (r"#f0f0f0", "var(--text)"),
    (r"#0a0a0a", "var(--panel-strong)"),
    (r"#0f0f0f", "var(--surface)")
]


def process_file(path: Path):
    text = path.read_text()
    orig = text
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)
    if text != orig:
        backup = path.with_suffix(path.suffix + '.bak')
        path.write_text(text)
        print(f"Patched: {path}")


def main():
    roots = [Path('src/styles'), Path('src/components')]
    for root in roots:
        for p in root.rglob('*.css'):
            process_file(p)

if __name__ == '__main__':
    main()
