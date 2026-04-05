"""Ensure `globalflow` can be imported even when the working directory is the package dir.

Render can be configured with `rootDir: globalflow` or an old start command like
`uvicorn globalflow.main:app`. In that case Python starts with the package directory
itself on ``sys.path`` and cannot resolve the top-level ``globalflow`` package.

Python imports `sitecustomize` automatically at interpreter startup when present on
``sys.path``. This file inserts the repository root so both import modes work.
"""

from __future__ import annotations

import sys
from pathlib import Path


current_dir = Path(__file__).resolve().parent
repo_root = current_dir.parent
repo_root_str = str(repo_root)

if repo_root_str not in sys.path:
    sys.path.insert(0, repo_root_str)
