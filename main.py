"""ASGI entrypoint that works from the repository root on Render and locally."""

from globalflow.main import app

__all__ = ["app"]
