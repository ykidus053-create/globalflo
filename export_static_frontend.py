import os
import shutil
from pathlib import Path

os.environ.setdefault("GLOBALFLOW_AUTOPILOT_ENABLED", "0")

from fastapi.testclient import TestClient

from globalflow.main import PAYMENT_METHODS, SUBSCRIPTION_TIERS, app


REPO_ROOT = Path(__file__).resolve().parent
FRONTEND_ROOT = REPO_ROOT / "frontend"
SOURCE_STATIC = REPO_ROOT / "globalflow" / "static"
STATIC_BASE_URL = os.getenv("GLOBALFLOW_STATIC_BASE_URL", "https://globalflow-static.onrender.com").rstrip("/")
API_BASE_URL = os.getenv("GLOBALFLOW_API_BASE", "https://globalflow.onrender.com").rstrip("/")


def inject_runtime_config(html: str) -> str:
    runtime_script = (
        f'<script>window.GLOBALFLOW_API_BASE = "{API_BASE_URL}";'
        f'window.GLOBALFLOW_STATIC_MODE = true;</script>'
    )
    return html.replace("</head>", f"    {runtime_script}\n  </head>", 1)


def write_page(relative_path: str, html: str) -> None:
    if relative_path == "/":
        output = FRONTEND_ROOT / "index.html"
    else:
        output = FRONTEND_ROOT / relative_path.strip("/") / "index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(inject_runtime_config(html), encoding="utf-8")


def export_pages() -> None:
    FRONTEND_ROOT.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SOURCE_STATIC, FRONTEND_ROOT / "static", dirs_exist_ok=True)

    with TestClient(app, base_url=STATIC_BASE_URL) as client:
        pages = ["/", "/account", "/automation", "/workflow", "/privacy", "/terms"]
        pages.extend(f"/payment/{method['id']}" for method in PAYMENT_METHODS)
        pages.extend(f"/checkout/{tier['id']}" for tier in SUBSCRIPTION_TIERS)

        for page in pages:
            response = client.get(page)
            response.raise_for_status()
            write_page(page, response.text)


if __name__ == "__main__":
    export_pages()
