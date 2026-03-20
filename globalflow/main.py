import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from .activity import ActivityLog
from .automations import FlowOrchestrator
from .connectors import CONNECTOR_LOOKUP, CONNECTORS
from .services import AutoPilot, Monitoring, TaskManager

root = Path(__file__).resolve().parent

logger = logging.getLogger("globalflow.app")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

app = FastAPI(title="Global Flow Automation")
templates = Jinja2Templates(directory=root / "templates")
app.mount("/static", StaticFiles(directory=root / "static"), name="static")


@app.on_event("startup")
async def start_autopilot():
    await autopilot.enable()


@app.middleware("http")
async def request_logger(request: Request, call_next):
    logger.info("Processing %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        return response
    except Exception:
        monitoring.record("errors")
        logger.exception("Unhandled error for %s %s", request.method, request.url.path)
        raise

WORLD_TASKS = [
    {"domain": "Calls", "description": "Auto-summarize and tag every support/lead call with LangChain agents."},
    {"domain": "Billing", "description": "Generate invoices, reconcile payments, and flag anomalies with Polars + SQLAlchemy."},
    {"domain": "Taxes", "description": "Prefect flows keep jurisdictional filings ready, plus AI reminders for deadlines."},
    {"domain": "Files", "description": "Auto-classify, version, and push contracts/documents to secure storage via Transformers."},
    {"domain": "Ops", "description": "Temporal orchestrates pipelines across streams, Slack, email, and Zapier connectors."},
]

AI_AGENTS = [
    {
        "name": "Pulse",
        "scope": "Global status",
        "summary": "Streams reports from Prefect runs, highlights bottlenecks, and nudges CFOs via Slack.",
    },
    {
        "name": "Clarity",
        "scope": "Docs + billing",
        "summary": "Reads invoices, validates against SAP/QuickBooks, uploads tax-ready ledgers, and pre-fills forms.",
    },
    {
        "name": "Orbit",
        "scope": "Engagement flows",
        "summary": "Schedules follow-ups, transcribes calls, drafts proposals, and escalates to humans when needed.",
    },
]

TASKS: Dict[str, Dict[str, str]] = {
    "calls": {
        "id": "calls",
        "domain": "Global Calls",
        "status": "ready",
        "next_action": "Summarize recent calls",
        "last_run": "—",
        "note": "LangChain agent primed for CRM engine.",
    },
    "billing": {
        "id": "billing",
        "domain": "Billing Ops",
        "status": "ready",
        "next_action": "Match invoices to payments",
        "last_run": "—",
        "note": "Polars-led reconciliation queued.",
    },
    "taxes": {
        "id": "taxes",
        "domain": "Taxes & Compliance",
        "status": "ready",
        "next_action": "Prepare jurisdiction snapshot",
        "last_run": "—",
        "note": "Prefect job stands by for data.",
    },
    "files": {
        "id": "files",
        "domain": "Files + Documents",
        "status": "ready",
        "next_action": "Classify latest uploads",
        "last_run": "—",
        "note": "Transformer embeddings warming up.",
    },
}

FEATURES = [
    {"title": "AI Call Summaries", "detail": "LangChain + Whisper triage every conversation, tag CRM records, and surface anomalies."},
    {"title": "Smart Billing Ops", "detail": "Polars + SQLAlchemy align invoices/payments, then Prefect auto-reminds finance."},
    {"title": "Compliance Engine", "detail": "Temporal & Prefect dual-control flows ensure filing readiness across regions."},
    {"title": "File Intelligence", "detail": "Transformer embeddings classify and secure sensitive documents instantly."},
    {"title": "Workflow Studio", "detail": "Visualizing retries, SLAs, and audit logs alongside dashboards and APIs."},
]

PAYMENT_METHODS = [
    {
        "id": "paypal",
        "name": "PayPal",
        "description": "Instant digital invoices with multi-currency support.",
        "action": "Open the PayPal send page",
        "portal_url": "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=ops%40globalflow.ai&item_name=GlobalFlow+Automation&currency_code=USD",
        "note": "Send funds to ops@globalflow.ai and mention your subscription tier.",
        "instructions": [
            "Sign in to PayPal and choose the Send Money flow.",
            "Add ops@globalflow.ai as the recipient and set the amount.",
            "Attach your automation tier or project name in the note field.",
            "Forward the confirmation to ops@globalflow.ai so we can reconcile immediately.",
        ],
    },
    {
        "id": "mastercard",
        "name": "Mastercard",
        "description": "Recurring billing with enhanced reconciliation.",
        "action": "Launch the Mastercard billing desk",
        "portal_url": "https://buy.stripe.com/test_4gwcOn7h3h7p5Dq6oo",
        "note": "Our finance desk will issue a secure Stripe invoice that accepts Mastercard.",
        "instructions": [
            "Click continue to visit the Mastercard payment resources.",
            "Email ops@globalflow.ai with the amount you want to charge.",
            "We will return a secure link powered by Stripe that favors Mastercard.",
            "Pay the invoice and the automation tier instantly unlocks.",
        ],
    },
    {
        "id": "amex",
        "name": "American Express",
        "description": "Premium rewards plus CFO program controls.",
        "action": "Visit the American Express payments hub",
        "portal_url": "https://buy.stripe.com/test_aEU8yMcgvhvE8cS4gj",
        "note": "AmEx cards get dedicated concierge onboarding and detailed receipts.",
        "instructions": [
            "Follow the AmEx guidance to understand the requirements.",
            "Send your desired billing amount and tier to ops@globalflow.ai.",
            "We issue a secure invoice that accepts American Express via our gateway.",
            "Complete the charge once you receive the encrypted payment link.",
        ],
    },
]

PAYMENT_LOOKUP = {entry["id"]: entry for entry in PAYMENT_METHODS}

PAYMENT_HISTORY: List[Dict[str, str]] = []

USER_PROFILE: Dict[str, str] = {
    "name": "Nova Ops",
    "email": "ops@globalflow.ai",
    "role": "Automation Architect",
    "timezone": "UTC",
}

USER_SETTINGS: Dict[str, str] = {
    "daily_digest": "enabled",
    "alert_channel": "Slack",
    "automation_tier": "High trust",
}

SUBSCRIPTIONS: List[Dict[str, str]] = []

SUBSCRIPTION_TIERS = [
    {
        "id": "pilot",
        "name": "Pilot Tier",
        "price": "$349 / month",
        "amount": 349,
        "currency": "USD",
        "description": "For small teams with urgent admin drag and direct owner oversight.",
        "qualification": "Best fit: teams with active operations pain, budget approval, and immediate urgency.",
        "pain": "Manual billing and follow-up work consume 20+ hours each week.",
        "inaction_cost": "Doing nothing typically leaks about $2,400 per month in delays and missed follow-through.",
        "risk_reversal": "Guided launch with weekly proof reports and a 30-day optimization pass.",
        "certainty_line": "If measurable admin hours do not drop in month one, we rework the workflow at no extra charge.",
        "features": [
            "Dedicated AutoPilot queue with Slack signals",
            "Prefect + Temporal retries and live telemetry",
            "Weekly outcomes brief tied to time-saved metrics",
        ],
        "preferred_method": "paypal",
        "payment_links": {
            "paypal": "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=ops%40globalflow.ai&item_name=GlobalFlow+Pilot&amount=349&currency_code=USD",
            "mastercard": "https://buy.stripe.com/test_14kaHh0G87aF7gMdQT",
            "amex": "https://buy.stripe.com/test_aEU8yMcgvhvE8cS4gj",
        },
        "badge": "Popular",
    },
    {
        "id": "launch",
        "name": "Launch Tier",
        "price": "$549 / month",
        "amount": 549,
        "currency": "USD",
        "description": "For growing operations teams where process delays now cost revenue.",
        "qualification": "Best fit: teams with high-volume workflows, cross-team handoffs, and decision authority in place.",
        "pain": "Leads, invoices, and compliance tasks stall across disconnected systems.",
        "inaction_cost": "Staying manual can burn $5,000+ monthly in cycle-time loss and uncollected opportunities.",
        "risk_reversal": "Structured onboarding with connector validation and milestone-based rollout.",
        "certainty_line": "You get a clear KPI baseline and verified automation gains before expansion.",
        "features": [
            "Multi-region Temporal + Prefect coverage",
            "Dedicated AI agents for billing, taxes, and files",
            "Enterprise connectors for Slack, HubSpot, and QuickBooks",
        ],
        "preferred_method": "mastercard",
        "payment_links": {
            "paypal": "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=ops%40globalflow.ai&item_name=GlobalFlow+Launch&amount=549&currency_code=USD",
            "mastercard": "https://buy.stripe.com/test_4gwcOn7h3h7p5Dq6oo",
            "amex": "https://buy.stripe.com/test_28ob24dMr1wk1G8cMR",
        },
    },
    {
        "id": "captain",
        "name": "Captain Tier",
        "price": "$899 / month",
        "amount": 899,
        "currency": "USD",
        "description": "For high-stakes operators who need autonomous execution with executive certainty.",
        "qualification": "Best fit: teams with global process load, clear budget ownership, and mission-critical urgency.",
        "pain": "Fragmented workflows create compounding risk across billing, taxes, files, and call handling.",
        "inaction_cost": "Without automation orchestration, loss exposure can exceed $10,000+ monthly in preventable overhead and delay.",
        "risk_reversal": "Priority deployment lane, advanced guardrails, and executive workflow reviews.",
        "certainty_line": "This tier is built for teams ready to execute now, not evaluate forever.",
        "features": [
            "Human-in-the-loop guardrails with AI suggestions",
            "Instant connector wiring + custom API scaffolding",
            "Quarterly automation readiness report",
        ],
        "preferred_method": "amex",
        "payment_links": {
            "paypal": "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=ops%40globalflow.ai&item_name=GlobalFlow+Captain&amount=899&currency_code=USD",
            "mastercard": "https://buy.stripe.com/test_5kAdUD4Hn9Qf0yQ4gK",
            "amex": "https://buy.stripe.com/test_dR6hcS4Hf0Ee3zi7su",
        },
        "badge": "Elite",
    },
]
SUBSCRIPTION_LOOKUP = {tier["id"]: tier for tier in SUBSCRIPTION_TIERS}

AUTOMATION_TOOLS = [
    {
        "id": "ms-python.python",
        "name": "Python Intelligence",
        "short": "Full workspace linting + debugging",
        "detail": "The official Python extension brings auto-complete, debugging overlays, and test runners that keep your workflows humming.",
        "focus": "type-aware completion & live debugging",
        "doc": "https://marketplace.visualstudio.com/items?itemName=ms-python.python",
    },
    {
        "id": "ms-python.vscode-pylance",
        "name": "Pylance",
        "short": "Type checking and semantic analysis",
        "detail": "Pylance adds lightning-speed type inference and in-editor hints so every automation script stays trustworthy before deployment.",
        "focus": "type inference engine",
        "doc": "https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance",
    },
    {
        "id": "ms-python.black-formatter",
        "name": "Black Formatter",
        "short": "Deterministic formatting",
        "detail": "Code that is automatically formatted before each CI run keeps automation specs consistent across every device.",
        "focus": "automatic formatting",
        "doc": "https://marketplace.visualstudio.com/items?itemName=ms-python.black-formatter",
    },
    {
        "id": "ms-python.isort",
        "name": "isort",
        "short": "Organize imports automatically",
        "detail": "isort keeps dependencies sorted, making build diffs easy to review and preventing accidental loops in orchestrated tasks.",
        "focus": "import hygiene",
        "doc": "https://marketplace.visualstudio.com/items?itemName=ms-python.isort",
    },
    {
        "id": "ms-toolsai.jupyter",
        "name": "Jupyter",
        "short": "Notebook automation",
        "detail": "Jupyter lets you craft data experiments that feed into the GlobalFlow analytics pipeline without leaving VS Code.",
        "focus": "live data experiments",
        "doc": "https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter",
    },
    {
        "id": "ms-azuretools.vscode-docker",
        "name": "Docker for VS Code",
        "short": "Container-aware workflow",
        "detail": "Build, debug, and push Docker images for GlobalFlow from a single interface, ensuring deployments match local expectations.",
        "focus": "container builds & logs",
        "doc": "https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker",
    },
]

AUTOMATION_TOOL_LOOKUP = {tool["id"]: tool for tool in AUTOMATION_TOOLS}

monitoring = Monitoring()
activity_log = ActivityLog()
orchestrator = FlowOrchestrator(activity_log)
task_manager = TaskManager(TASKS, monitoring, orchestrator)
autopilot = AutoPilot(task_manager, monitoring, activity_log, interval_seconds=55)


def _tasks_list() -> List[Dict[str, str]]:
    return task_manager.list_tasks()


@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    metrics = monitoring.snapshot()
    stats = [
        {"label": "Minutes saved daily", "value": "4,260"},
        {"label": "Countries orchestrated", "value": "23"},
        {"label": "AI agents active", "value": "14"},
        {
            "label": "Automations kicked off",
            "value": f'{metrics["tasks_run"]:,}',
            "key": "tasks_run",
        },
        {
            "label": "Subscriptions captured",
            "value": f'{metrics["subscriptions"]:,}',
            "key": "subscriptions",
        },
        {
            "label": "Payment requests routed",
            "value": f'{metrics["payment_requests"]:,}',
            "key": "payment_requests",
        },
    ]
    autopilot_status = autopilot.status()
    stats.append(
        {
            "label": "Autonomous cycles",
            "value": f'{autopilot_status["cycles"]:,}',
            "key": "autopilot_cycles",
        }
    )
    return templates.TemplateResponse(
        "flow.html",
        {
            "request": request,
            "world_tasks": WORLD_TASKS,
            "agents": AI_AGENTS,
            "stats": stats,
            "features": FEATURES,
            "payment_methods": PAYMENT_METHODS,
            "toolkit": AUTOMATION_TOOLS,
            "autopilot": autopilot_status,
            "connectors": CONNECTORS,
            "subscription_tiers": SUBSCRIPTION_TIERS,
        },
    )


@app.get("/api/flow", response_class=JSONResponse)
async def flow_summary():
    return {
        "status": "operational",
        "tasks": WORLD_TASKS,
        "agents": AI_AGENTS,
        "next_steps": [
            "Spin up Temporal retry bus for billing recon.",
            "Trigger LangChain assistant to follow up on late payments.",
            "Push Prefect job to re-run compliance snapshot.",
        ],
    }


@app.get("/api/tasks", response_class=JSONResponse)
async def list_tasks():
    return {"tasks": _tasks_list()}


@app.get("/api/metrics", response_class=JSONResponse)
async def metrics():
    return monitoring.snapshot()


@app.post("/api/tasks/{task_id}/run", response_class=JSONResponse)
async def run_task(task_id: str, background_tasks: BackgroundTasks):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    background_tasks.add_task(task_manager.kickoff, task_id)
    return {"task": task}


@app.post("/api/subscribe", response_class=JSONResponse)
async def subscribe(payload: Dict[str, str]):
    email = payload.get("email")
    name = payload.get("name", "Subscriber")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    tier_id = payload.get("tier") or SUBSCRIPTION_TIERS[0]["id"]
    tier = SUBSCRIPTION_LOOKUP.get(tier_id, SUBSCRIPTION_TIERS[0])
    SUBSCRIPTIONS.append(
        {
            "name": name,
            "email": email,
            "tier": tier["name"],
            "time": datetime.utcnow().isoformat(),
        }
    )
    monitoring.record("subscriptions")
    return {
        "status": "ok",
        "message": f"Thanks {name}, {tier['name']} is reserved. Follow the checkout link to complete payment.",
        "checkout_url": tier["payment_links"].get(tier["preferred_method"]),
    }


@app.get("/api/subscriptions", response_class=JSONResponse)
async def catalog_subscriptions():
    return {"tiers": SUBSCRIPTION_TIERS}


@app.get("/payment/{method}", response_class=HTMLResponse)
async def payment_portal(request: Request, method: str):
    portal = PAYMENT_LOOKUP.get(method)
    if not portal:
        raise HTTPException(status_code=404, detail="Payment method unavailable")
    return templates.TemplateResponse(
        "payment.html",
        {
            "request": request,
            "portal": portal,
        },
    )


@app.get("/checkout/{tier_id}", response_class=HTMLResponse)
async def checkout_page(request: Request, tier_id: str):
    tier = SUBSCRIPTION_LOOKUP.get(tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Subscription tier unavailable")
    return templates.TemplateResponse(
        "checkout.html",
        {
            "request": request,
            "tier": tier,
            "payment_methods": PAYMENT_METHODS,
        },
    )


@app.post("/api/payments/{method}", response_class=JSONResponse)
async def submit_payment_request(method: str, payload: Dict[str, str]):
    portal = PAYMENT_LOOKUP.get(method)
    if not portal:
        raise HTTPException(status_code=404, detail="Payment method unavailable")
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required to issue an invoice")
    PAYMENT_HISTORY.append(
        {
            "method": method,
            "email": email,
            "amount": payload.get("amount", "TBD"),
            "notes": payload.get("notes", ""),
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
    monitoring.record("payment_requests")
    return {
        "status": "ok",
        "message": f"{portal['name']} request received – expect a secure link in your inbox shortly.",
    }


@app.post("/api/connectors/{connector_id}", response_class=JSONResponse)
async def trigger_connector(connector_id: str, payload: Dict[str, str]):
    connector = CONNECTOR_LOOKUP.get(connector_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not available")
    target_url = payload.get("target_url") or connector.get("resolved_url") or connector["default_url"]
    field_name = connector.get("sample_field", "message")
    body = {
        field_name: payload.get(field_name) or connector.get("sample_message"),
        "timestamp": datetime.utcnow().isoformat(),
        "context": payload.get("context", "GlobalFlow automation"),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(target_url, json=body)
    except httpx.HTTPError as exc:
        logger.warning("Connector %s failed: %s", connector_id, exc)
        activity_log.record(
            kind="connector",
            source=connector["name"],
            message="Connector failed",
            detail=str(exc),
        )
        raise HTTPException(status_code=502, detail="Connector endpoint unreachable")
    monitoring.record("tasks_run")
    activity_log.record(
        kind="connector",
        source=connector["name"],
        message=f"Connector hit – {response.status_code}",
        detail=response.text[:200],
    )
    details = {}
    if response.headers.get("content-type", "").startswith("application/json"):
        details = response.json()
    return {
        "status": "ok",
        "message": f"{connector['name']} triggered – {response.status_code}",
        "details": details,
    }


@app.get("/api/activity", response_class=JSONResponse)
async def activity_stream():
    return {"events": activity_log.snapshot()}


@app.get("/api/autopilot", response_class=JSONResponse)
async def autopilot_status():
    return autopilot.status()


@app.post("/api/autopilot", response_class=JSONResponse)
async def set_autopilot(payload: Dict[str, Any]):
    enabled = payload.get("enabled")
    if enabled is None:
        raise HTTPException(status_code=400, detail="enabled field required")
    if enabled:
        await autopilot.enable()
    else:
        await autopilot.disable()
    return autopilot.status()


@app.get("/api/toolkit/{tool_id}", response_class=JSONResponse)
async def toolkit_action(tool_id: str):
    tool = AUTOMATION_TOOL_LOOKUP.get(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Automation tool unavailable")
    monitoring.record("tasks_run")
    return {
        "status": "queued",
        "message": f"{tool['name']} alignment requested – refreshing templates, enforcing formatting, and checking runtime hints.",
        "focus": tool["focus"],
    }


@app.get("/account", response_class=HTMLResponse)
async def account_center(request: Request):
    return templates.TemplateResponse(
        "account.html",
        {
            "request": request,
            "profile": USER_PROFILE,
            "settings": USER_SETTINGS,
        },
    )


@app.post("/api/account", response_class=JSONResponse)
async def update_account(payload: Dict[str, str]):
    USER_PROFILE["name"] = payload.get("name", USER_PROFILE["name"])
    USER_PROFILE["email"] = payload.get("email", USER_PROFILE["email"])
    USER_PROFILE["role"] = payload.get("role", USER_PROFILE["role"])
    USER_PROFILE["timezone"] = payload.get("timezone", USER_PROFILE["timezone"])
    USER_SETTINGS["daily_digest"] = payload.get("daily_digest", USER_SETTINGS["daily_digest"])
    USER_SETTINGS["alert_channel"] = payload.get("alert_channel", USER_SETTINGS["alert_channel"])
    USER_SETTINGS["automation_tier"] = payload.get("automation_tier", USER_SETTINGS["automation_tier"])
    return {"status": "updated", "profile": USER_PROFILE, "settings": USER_SETTINGS}
