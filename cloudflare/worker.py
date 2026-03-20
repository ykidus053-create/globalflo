import os
import sys
from pathlib import Path

import asgi
from workers import WorkerEntrypoint

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))

# Workers do not support the long-lived background loop used on server hosts.
os.environ.setdefault("GLOBALFLOW_AUTOPILOT_ENABLED", "0")

from globalflow.main import app


class Default(WorkerEntrypoint):
  async def fetch(self, request):
    return await asgi.fetch(app, request, self.env)
