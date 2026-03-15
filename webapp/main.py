from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

root = Path(__file__).resolve().parent

app = FastAPI(title="Elite Coding Console")

templates = Jinja2Templates(directory=root / "templates")
app.mount("/static", StaticFiles(directory=root / "static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    metrics = [
        {"title": "Velocity", "value": "98%", "detail": "CI/CD build success rate"},
        {"title": "Automation", "value": "534 pipelines", "detail": "Prefect/Temporal flows ready"},
        {"title": "Quality", "value": "100%", "detail": "Pyright + Ruff coverage"},
    ]
    highlights = [
        "FastAPI + Streamlit front end",
        "LangChain agents + Transformers backing the assistant",
        "Prefect + Temporal for autonomous pipelines",
        "Polars datalake + SQLAlchemy orchestration",
    ]
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "metrics": metrics,
            "highlights": highlights,
        },
    )
