from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

root = Path(__file__).resolve().parent

app = FastAPI(title="Automation Workflow for Small Business")
templates = Jinja2Templates(directory=root / "templates")
app.mount("/static", StaticFiles(directory=root / "static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    workflows = [
        {
            "name": "Invoice Reconciliation",
            "steps": ["Fetch transactions", "Match receipts", "Notify finance"],
            "impact": "2h saved weekly",
        },
        {
            "name": "Lead Follow-Up",
            "steps": ["Enrich CRM", "Send personalized SMS", "Schedule demo"],
            "impact": "30% faster pipeline",
        },
        {
            "name": "Inventory Alerts",
            "steps": ["Monitor SKUs", "Trigger reorder bots", "Slack summary"],
            "impact": "0 stockouts/month",
        },
    ]
    automation_tools = [
        "FastAPI endpoints + scheduled Prefect flows",
        "Transformers / LangChain for email triage",
        "Streamlit dashboards embedded into Jinja layout",
        "Polars + SQLAlchemy for clean data pipelines",
    ]
    return templates.TemplateResponse(
        "workflow.html",
        {
            "request": request,
            "workflows": workflows,
            "automation_tools": automation_tools,
        },
    )
