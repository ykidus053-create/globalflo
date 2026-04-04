from __future__ import annotations

from pathlib import Path
import hashlib
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "globalflow" / "static"
MIRROR = ROOT / "frontend" / "static"

REQUIRED = [
    "flow.css",
    "flow-system.css",
    "flow.js",
    "workflow.js",
    "workflow-elite.js",
    "render-layer.js",
    "site-boot.js",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main() -> int:
    problems: list[str] = []
    for rel in REQUIRED:
        src = SOURCE / rel
        dst = MIRROR / rel
        if not src.exists():
            problems.append(f"Missing source file: {src}")
            continue
        if not dst.exists():
            problems.append(f"Missing mirror file: {dst}")
            continue
        if sha256(src) != sha256(dst):
            problems.append(f"Out-of-sync file: {rel}")

    if problems:
        print("Static sync check failed:")
        for issue in problems:
            print(f"- {issue}")
        print("\nRun: python export_static_frontend.py")
        return 1

    print("Static sync check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
