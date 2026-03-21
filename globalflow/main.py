import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
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

AUTOPILOT_BOOT_ENABLED = os.getenv("GLOBALFLOW_AUTOPILOT_ENABLED", "1").lower() not in {"0", "false", "no"}
EDGE_STATIC_ENABLED = os.getenv("GLOBALFLOW_EDGE_STATIC", "0").lower() in {"1", "true", "yes"}

if not EDGE_STATIC_ENABLED:
    app.mount("/static", StaticFiles(directory=root / "static"), name="static")


@app.on_event("startup")
async def start_autopilot():
    if AUTOPILOT_BOOT_ENABLED:
        await autopilot.enable()
    else:
        logger.info("Autopilot startup disabled by environment")


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
    {
        "icon": "phone",
        "domain": "Call follow-up",
        "headline": "Close the loop after every customer conversation.",
        "description": "Summaries, action items, and next steps land in the right system without a coordinator chasing people.",
    },
    {
        "icon": "receipt",
        "domain": "Billing recovery",
        "headline": "Keep invoices, approvals, and collections moving.",
        "description": "GlobalFlow routes invoice work automatically so finance teams recover revenue faster with less manual admin.",
    },
    {
        "icon": "shield",
        "domain": "Tax readiness",
        "headline": "Stay prepared for deadlines instead of scrambling late.",
        "description": "Compliance tasks, supporting docs, and reminders stay visible in one workflow before they become urgent.",
    },
    {
        "icon": "folder",
        "domain": "Document control",
        "headline": "Organize contracts and files without creating another inbox.",
        "description": "Files are classified, routed, and attached to the right workflow so teams stop losing time to document hunts.",
    },
    {
        "icon": "spark",
        "domain": "Ops orchestration",
        "headline": "Run repetitive back-office work from one calm dashboard.",
        "description": "Approvals, retries, audits, and handoffs stay coordinated across billing, files, calls, and follow-up.",
    },
]

AI_AGENTS = [
    {
        "name": "Pulse",
        "scope": "Global status",
        "summary": "Streams reports from Prefect runs, highlights bottlenecks, and nudges finance and operations teams when action is needed.",
    },
    {
        "name": "Clarity",
        "scope": "Docs + billing",
        "summary": "Reads invoices, validates records, uploads tax-ready ledgers, and pre-fills the next finance step.",
    },
    {
        "name": "Orbit",
        "scope": "Engagement flows",
        "summary": "Schedules follow-ups, drafts handoffs, and escalates to humans when a workflow needs review.",
    },
]

TASKS: Dict[str, Dict[str, str]] = {
    "calls": {
        "id": "calls",
        "domain": "Call follow-up",
        "status": "ready",
        "next_action": "Summarize recent calls",
        "last_run": "-",
        "note": "Ready to capture call notes, assign follow-up, and sync outcomes.",
    },
    "billing": {
        "id": "billing",
        "domain": "Billing Ops",
        "status": "ready",
        "next_action": "Match invoices to payments",
        "last_run": "-",
        "note": "Prepared to route approvals, issue invoices, and flag exceptions.",
    },
    "taxes": {
        "id": "taxes",
        "domain": "Taxes & Compliance",
        "status": "ready",
        "next_action": "Prepare jurisdiction snapshot",
        "last_run": "-",
        "note": "Standing by to assemble filing readiness and compliance evidence.",
    },
    "files": {
        "id": "files",
        "domain": "Files + Documents",
        "status": "ready",
        "next_action": "Classify latest uploads",
        "last_run": "-",
        "note": "Queued to organize contracts, receipts, and supporting documents.",
    },
}

FEATURES = [
    {
        "icon": "phone",
        "title": "Call summaries that drive action",
        "headline": "Every customer call ends with the next step already assigned.",
        "detail": "GlobalFlow turns conversations into summaries, owners, and follow-up tasks so nothing important gets lost after the call.",
        "href": "#demo",
    },
    {
        "icon": "receipt",
        "title": "Billing that keeps moving",
        "headline": "Invoices, approvals, and reminders move without manual chasing.",
        "detail": "Finance teams can route invoice work automatically, spot bottlenecks early, and keep collections on schedule.",
        "href": "#pricing",
    },
    {
        "icon": "shield",
        "title": "Compliance that feels manageable",
        "headline": "Important tax and compliance work stays visible before deadlines hit.",
        "detail": "The workflow collects documents, tracks status, and keeps operations teams ahead of filing and review pressure.",
        "href": "#why-globalflow",
    },
    {
        "icon": "folder",
        "title": "Files that stay organized",
        "headline": "Documents reach the right place without extra admin work.",
        "detail": "Contracts, receipts, and records are classified and routed so teams stop digging through shared drives and inboxes.",
        "href": "#integrations",
    },
    {
        "icon": "spark",
        "title": "Orchestration with clear oversight",
        "headline": "Automation runs fast, but people still stay in control.",
        "detail": "Operators can launch workflows, inspect every step, and intervene when needed from a single control room.",
        "href": "#flowboard",
    },
]

TRUSTED_LOGOS = [
    {"name": "Northwind Ops", "label": "Placeholder partner"},
    {"name": "Atlas Freight", "label": "Placeholder partner"},
    {"name": "Cedar Accounting", "label": "Placeholder partner"},
    {"name": "FieldMint Health", "label": "Placeholder partner"},
    {"name": "Harbor Services", "label": "Placeholder partner"},
]

TESTIMONIALS = [
    {
        "name": "Maya Chen",
        "role": "Operations Director",
        "company": "Northwind Ops",
        "quote": "We stopped stitching billing, follow-up, and file work together by hand. GlobalFlow gave the team one place to run the week.",
        "result": "Recovered 23 hours each week in the first month.",
        "photo": "/static/avatar-maya.svg",
    },
    {
        "name": "Daniel Brooks",
        "role": "Finance Lead",
        "company": "Cedar Accounting",
        "quote": "The biggest win was visibility. We can see every handoff, every invoice request, and every exception without checking three tools.",
        "result": "Cut invoice turnaround from 4 days to under 1 day.",
        "photo": "/static/avatar-daniel.svg",
    },
    {
        "name": "Leila Hassan",
        "role": "Client Services Manager",
        "company": "FieldMint Health",
        "quote": "Call notes, documents, and follow-up tasks now show up together. The team spends more time responding and less time reorganizing work.",
        "result": "Removed 80+ hours of admin work each month.",
        "photo": "/static/avatar-leila.svg",
    },
]

FOUNDERS = [
    {
        "name": "Kidus Yared",
        "role": "Founder and workflow operator",
        "bio": "Built GlobalFlow after seeing small teams waste entire weeks on call notes, invoice follow-up, file cleanup, and compliance prep. The product is designed for operators who need calm visibility, not another noisy dashboard.",
        "photo": "/static/founder-kidus.svg",
    }
]

TRUST_SIGNALS = [
    {
        "title": "256-bit encryption",
        "detail": "Sensitive billing, document, and workflow data is protected in transit and at rest.",
    },
    {
        "title": "Human override built in",
        "detail": "Autonomous runs remain inspectable, reversible, and easy to pause when a team wants manual review.",
    },
    {
        "title": "Data stays traceable",
        "detail": "Activity feeds, audit trails, and connector logs make workflow decisions easy to verify.",
    },
]

BUILT_WITH = [
    "FastAPI",
    "Temporal",
    "Prefect",
    "LangChain",
    "Whisper",
    "Polars",
    "SQLAlchemy",
    "Jinja",
]

PAYMENT_METHODS = [
    {
        "id": "paypal",
        "name": "PayPal",
        "description": "Instant digital invoices with multi-currency support.",
        "action": "Open the PayPal billing desk",
        "portal_url": "/payment/paypal",
        "help_url": "https://www.paypal.com/us/business",
        "note": "Use the in-app PayPal desk to request a payment handoff without leaving GlobalFlow.",
        "instructions": [
            "Open the GlobalFlow PayPal desk.",
            "Enter your business email, amount, and project tier.",
            "Request the invoice or handoff directly from the in-app form.",
            "Finance will reconcile the payment and unlock the workspace.",
        ],
    },
    {
        "id": "mastercard",
        "name": "Mastercard",
        "description": "Recurring billing with enhanced reconciliation.",
        "action": "Launch the Mastercard billing desk",
        "portal_url": "/payment/mastercard",
        "help_url": "https://www.mastercard.us/en-us/personal/find-a-card.html",
        "note": "Use the in-app Mastercard desk to request a routed invoice instead of a broken external checkout.",
        "instructions": [
            "Open the GlobalFlow Mastercard desk.",
            "Submit your billing amount and subscription tier.",
            "Finance routes the charge request through the configured billing workflow.",
            "Once confirmed, the subscription unlocks inside GlobalFlow.",
        ],
    },
    {
        "id": "amex",
        "name": "American Express",
        "description": "Premium rewards plus CFO program controls.",
        "action": "Open the AmEx billing desk",
        "portal_url": "/payment/amex",
        "help_url": "https://www.americanexpress.com/us/credit-cards/",
        "note": "Use the in-app AmEx desk for concierge billing without hitting a dead merchant page.",
        "instructions": [
            "Open the GlobalFlow American Express desk.",
            "Enter the amount, email, and any procurement notes.",
            "Finance prepares the payment route and confirmation steps.",
            "Your billing request stays visible inside the activity workflow.",
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
    "theme": "light",
}

SUBSCRIPTIONS: List[Dict[str, str]] = []

SUBSCRIPTION_TIERS = [
    {
        "id": "starter",
        "name": "Starter",
        "price": "Free",
        "monthly_price": "Free",
        "annual_price": "Free",
        "amount": 0,
        "currency": "USD",
        "annual_amount": 0,
        "description": "For teams testing one workflow before rolling automation out more broadly.",
        "qualification": "Best for first pilots and evaluation teams.",
        "pain": "You need to prove one workflow can run cleanly before replacing your current process.",
        "roi": "Most starter teams validate one automation path and remove 6 to 10 hours of admin work each week.",
        "risk_reversal": "No payment required. Start with 1 workflow and 100 runs each month.",
        "certainty_line": "A clean way to test fit before expanding into a larger rollout.",
        "features": [
            "1 live workflow",
            "100 workflow runs per month",
            "2 app connections",
            "Email support",
        ],
        "preferred_method": "paypal",
        "payment_links": {
            "paypal": "/payment/paypal?tier=starter&amount=0",
            "mastercard": "/payment/mastercard?tier=starter&amount=0",
            "amex": "/payment/amex?tier=starter&amount=0",
        },
        "badge": "Free trial",
        "annual_badge": "",
        "cta": "Start free",
        "comparison_key": "starter",
    },
    {
        "id": "pilot",
        "name": "Pilot",
        "price": "$349 / month",
        "monthly_price": "$349 / month",
        "annual_price": "$290 / month billed annually",
        "amount": 349,
        "currency": "USD",
        "annual_amount": 3490,
        "description": "For small teams ready to automate the first set of back-office bottlenecks.",
        "qualification": "Best for teams with recurring billing, file, and follow-up work every week.",
        "pain": "Manual billing and follow-up work consume 20+ hours each week.",
        "roi": "Pilot teams typically recover 80+ hours each month in the first 30 days.",
        "risk_reversal": "Guided launch with weekly proof reports and a 30-day optimization pass.",
        "certainty_line": "Shielded rework guarantee: if month-one outcomes miss the agreed target, we rework the workflow at no extra charge.",
        "features": [
            "Dedicated AutoPilot queue with live telemetry",
            "4 production integrations",
            "Weekly outcomes brief tied to time-saved metrics",
            "Rework guarantee",
        ],
        "preferred_method": "paypal",
        "payment_links": {
            "paypal": "/payment/paypal?tier=pilot&amount=349",
            "mastercard": "/payment/mastercard?tier=pilot&amount=349",
            "amex": "/payment/amex?tier=pilot&amount=349",
        },
        "badge": "Popular",
        "annual_badge": "Save 17%",
        "cta": "Start Pilot",
        "comparison_key": "pilot",
    },
    {
        "id": "launch",
        "name": "Launch",
        "price": "$549 / month",
        "monthly_price": "$549 / month",
        "annual_price": "$458 / month billed annually",
        "amount": 549,
        "currency": "USD",
        "annual_amount": 5490,
        "description": "For operations teams running multiple workflows across billing, files, and customer handoffs.",
        "qualification": "Best for growing teams with clear process ownership and active cross-team coordination.",
        "pain": "Leads, invoices, and compliance tasks stall across disconnected systems.",
        "roi": "Launch teams usually recover 120+ hours each month while improving response and billing speed.",
        "risk_reversal": "Structured onboarding with connector validation and milestone-based rollout.",
        "certainty_line": "You get a clear KPI baseline and verified automation gains before expansion.",
        "features": [
            "8 production integrations",
            "Dedicated automations for billing, taxes, and files",
            "Live dashboards and team approvals",
            "Slack implementation channel",
        ],
        "preferred_method": "mastercard",
        "payment_links": {
            "paypal": "/payment/paypal?tier=launch&amount=549",
            "mastercard": "/payment/mastercard?tier=launch&amount=549",
            "amex": "/payment/amex?tier=launch&amount=549",
        },
        "annual_badge": "Save 17%",
        "cta": "Talk to sales",
        "comparison_key": "launch",
    },
    {
        "id": "captain",
        "name": "Captain",
        "price": "$899 / month",
        "monthly_price": "$899 / month",
        "annual_price": "$749 / month billed annually",
        "amount": 899,
        "currency": "USD",
        "annual_amount": 8990,
        "description": "For teams that need wide automation coverage, executive reporting, and white-glove rollout support.",
        "qualification": "Best for high-volume operators with global process load and tighter reliability requirements.",
        "pain": "Fragmented workflows create compounding risk across billing, taxes, files, and call handling.",
        "roi": "Captain teams centralize the highest-volume workflows and usually free up 200+ hours each month.",
        "risk_reversal": "Priority deployment lane, executive workflow reviews, and custom connector support.",
        "certainty_line": "Built for teams that want automation depth with clear executive oversight.",
        "features": [
            "Unlimited workflow runs",
            "Custom API and ERP connector support",
            "Executive readiness reviews",
            "White-glove onboarding",
        ],
        "preferred_method": "amex",
        "payment_links": {
            "paypal": "/payment/paypal?tier=captain&amount=899",
            "mastercard": "/payment/mastercard?tier=captain&amount=899",
            "amex": "/payment/amex?tier=captain&amount=899",
        },
        "badge": "Scale",
        "annual_badge": "Save 17%",
        "cta": "Book a rollout call",
        "comparison_key": "captain",
    },
]
SUBSCRIPTION_LOOKUP = {tier["id"]: tier for tier in SUBSCRIPTION_TIERS}

PRICING_COMPARISON = [
    {"label": "Workflow runs / month", "starter": "100", "pilot": "2,000", "launch": "10,000", "captain": "Unlimited"},
    {"label": "Connected apps", "starter": "2", "pilot": "4", "launch": "8", "captain": "Custom"},
    {"label": "Human approvals", "starter": "Basic", "pilot": "Advanced", "launch": "Advanced", "captain": "Executive guardrails"},
    {"label": "Reporting", "starter": "Weekly digest", "pilot": "Weekly proof report", "launch": "Live dashboards", "captain": "Executive reviews"},
    {"label": "Support", "starter": "Community", "pilot": "Priority email", "launch": "Slack channel", "captain": "White-glove"},
]

FOOTER_LINKS = [
    {"label": "About", "href": "#why-globalflow"},
    {"label": "Blog", "href": "#founder"},
    {"label": "Changelog", "href": "https://github.com/ykidus053-create/globalflo/commits/main"},
    {"label": "Docs", "href": "#under-the-hood"},
    {"label": "Privacy Policy", "href": "/privacy"},
    {"label": "Terms of Service", "href": "/terms"},
    {"label": "Contact", "href": "mailto:hello@globalflow.ai"},
]

SOCIAL_LINKS = [
    {"label": "GitHub", "href": "https://github.com/ykidus053-create/globalflo"},
    {"label": "Roadmap", "href": "https://github.com/ykidus053-create/globalflo/issues"},
    {"label": "Founder inbox", "href": "mailto:hello@globalflow.ai?subject=Talk%20to%20the%20founder"},
]

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


def _active_theme() -> str:
    theme = USER_SETTINGS.get("theme", "light")
    return theme if theme in {"light", "dark"} else "light"

@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    autopilot_status = autopilot.status()
    execution_status = "Active" if autopilot_status["enabled"] else "Human-in-the-loop"
    stats = [
        {"label": "Recovered in most pilot teams", "value": "20+ hours / week"},
        {"label": "Operator confidence", "value": "99.2%"},
        {"label": "Time to first live workflow", "value": "72 hours"},
        {"label": "Autonomous execution", "value": execution_status},
    ]
    return templates.TemplateResponse(
        "flow.html",
        {
            "request": request,
            "page_url": str(request.url),
            "world_tasks": WORLD_TASKS,
            "agents": AI_AGENTS,
            "stats": stats,
            "features": FEATURES,
            "payment_methods": PAYMENT_METHODS,
            "toolkit": AUTOMATION_TOOLS,
            "autopilot": autopilot_status,
            "connectors": CONNECTORS,
            "subscription_tiers": SUBSCRIPTION_TIERS,
            "trusted_logos": TRUSTED_LOGOS,
            "testimonials": TESTIMONIALS,
            "founders": FOUNDERS,
            "trust_signals": TRUST_SIGNALS,
            "built_with": BUILT_WITH,
            "pricing_comparison": PRICING_COMPARISON,
            "footer_links": FOOTER_LINKS,
            "social_links": SOCIAL_LINKS,
            "theme": _active_theme(),
        },
    )


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return RedirectResponse(url="/static/favicon.svg")


@app.get("/api/flow", response_class=JSONResponse)
async def flow_summary():
    return {
        "status": "operational",
        "tasks": WORLD_TASKS,
        "agents": AI_AGENTS,
        "next_steps": [
            "Spin up billing follow-up for overdue invoices.",
            "Trigger the call summary agent to assign owners.",
            "Refresh the compliance snapshot before the next deadline.",
        ],
    }


@app.get("/api/tasks", response_class=JSONResponse)
async def list_tasks():
    return {"tasks": _tasks_list()}


@app.get("/api/metrics", response_class=JSONResponse)
async def metrics():
    return monitoring.snapshot()


@app.get("/health", response_class=JSONResponse)
async def healthcheck():
    return {
        "status": "ok",
        "autopilot_enabled": autopilot.enabled,
        "tasks": len(_tasks_list()),
    }


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
        "checkout_url": f"/checkout/{tier['id']}",
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
            "theme": _active_theme(),
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
            "theme": _active_theme(),
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
        "message": f"{portal['name']} request received - expect a secure link in your inbox shortly.",
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
        message=f"Connector hit - {response.status_code}",
        detail=response.text[:200],
    )
    details = {}
    if response.headers.get("content-type", "").startswith("application/json"):
        details = response.json()
    return {
        "status": "ok",
        "message": f"{connector['name']} triggered - {response.status_code}",
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
        "message": f"{tool['name']} alignment requested - refreshing templates, enforcing formatting, and checking runtime hints.",
        "focus": tool["focus"],
    }


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy(request: Request):
    return templates.TemplateResponse(
        "privacy.html",
        {
            "request": request,
            "updated_on": "March 20, 2026",
            "theme": _active_theme(),
        },
    )


@app.get("/terms", response_class=HTMLResponse)
async def terms_of_service(request: Request):
    return templates.TemplateResponse(
        "terms.html",
        {
            "request": request,
            "updated_on": "March 20, 2026",
            "theme": _active_theme(),
        },
    )


@app.get("/account", response_class=HTMLResponse)
async def account_center(request: Request):
    return templates.TemplateResponse(
        "account.html",
        {
            "request": request,
            "profile": USER_PROFILE,
            "settings": USER_SETTINGS,
            "theme": _active_theme(),
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
    theme = payload.get("theme", USER_SETTINGS.get("theme", "light"))
    USER_SETTINGS["theme"] = theme if theme in {"light", "dark"} else "light"
    return {"status": "updated", "profile": USER_PROFILE, "settings": USER_SETTINGS}
