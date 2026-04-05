"""Forward `globalflow.main:app` to the existing local `main.py` module.

This supports misconfigured hosts that run from inside the `globalflow/` directory
while still using the package import path `globalflow.main:app`.
"""

from main import app

__all__ = ["app"]
