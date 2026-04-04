from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]

# bytes
BUDGETS = {
    "globalflow/static/flow.css": 230_000,
    "globalflow/static/flow-system.css": 60_000,
    "globalflow/static/flow.js": 80_000,
    "globalflow/static/workflow.js": 20_000,
    "globalflow/static/render-layer.js": 20_000,
}

COMBINED_BUDGETS = {
    "css_total": (["globalflow/static/flow.css", "globalflow/static/flow-system.css"], 280_000),
    "js_total": (["globalflow/static/flow.js", "globalflow/static/workflow.js", "globalflow/static/render-layer.js"], 140_000),
}


def fmt_bytes(value: int) -> str:
    if value < 1024:
        return f"{value} B"
    if value < 1024 * 1024:
        return f"{value / 1024:.1f} KB"
    return f"{value / (1024 * 1024):.2f} MB"


def main() -> int:
    failures: list[str] = []

    for rel_path, budget in BUDGETS.items():
        path = ROOT / rel_path
        if not path.exists():
            failures.append(f"Missing required asset: {rel_path}")
            continue
        size = path.stat().st_size
        if size > budget:
            failures.append(
                f"{rel_path} exceeds budget: {fmt_bytes(size)} > {fmt_bytes(budget)}"
            )
        else:
            print(f"OK {rel_path}: {fmt_bytes(size)} / {fmt_bytes(budget)}")

    for name, (paths, budget) in COMBINED_BUDGETS.items():
        total = 0
        missing = []
        for rel_path in paths:
            path = ROOT / rel_path
            if path.exists():
                total += path.stat().st_size
            else:
                missing.append(rel_path)
        if missing:
            failures.append(f"{name} missing assets: {', '.join(missing)}")
            continue
        if total > budget:
            failures.append(f"{name} exceeds budget: {fmt_bytes(total)} > {fmt_bytes(budget)}")
        else:
            print(f"OK {name}: {fmt_bytes(total)} / {fmt_bytes(budget)}")

    if failures:
        print("\nPerformance budget check failed:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("\nPerformance budget check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
