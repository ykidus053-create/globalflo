from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

root = Path(__file__).resolve().parent

app = FastAPI(title="Ops Pulse for SMBs")
templates = Jinja2Templates(directory=root / "templates")
app.mount("/static", StaticFiles(directory=root / "static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    tasks = [
        {"name": "Customer Onboarding", "status": "Automated", "time": "5 min"},
        {"name": "Social Media Scheduler", "status": "Pending approval", "time": "2h"},
        {"name": "Expense capture", "status": "Running", "time": "30s"},
        {"name": "Service reminders", "status": "Idle", "time": "Ready"},
    ]
    automation_points = [
        "Kick off Prefect flow when Stripe invoices close.",
        "LangChain assistant triages email replies for you.",
        "Polars streamlines data from your CRM, accounting, and ops apps.",
        "Temporal orchestrates retries + SLA notifications.",
        "Streamlit previews show real-time metrics on any device.",
    ]
    return templates.TemplateResponse(
        "ops.html",
        {
            "request": request,
            "tasks": tasks,
            "automation_points": automation_points,
        },
    )
