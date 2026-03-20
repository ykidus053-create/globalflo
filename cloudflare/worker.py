from workers import WorkerEntrypoint


class Default(WorkerEntrypoint):
  async def fetch(self, request):
    import os
    import sys
    from pathlib import Path

    import asgi

    root = Path(__file__).resolve().parent
    if str(root) not in sys.path:
      sys.path.insert(0, str(root))

    # Workers do not support the long-lived background loop used on server hosts.
    os.environ.setdefault("GLOBALFLOW_AUTOPILOT_ENABLED", "0")
    os.environ.setdefault("GLOBALFLOW_EDGE_STATIC", "1")

    from globalflow.main import app

    return await asgi.fetch(app, request, self.env)
