import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urlsplit, urlunsplit

import httpx
from fastapi import BackgroundTasks, FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from subprocess import CalledProcessError, check_output
from starlette.requests import Request

try:
    from .activity import ActivityLog
    from .automations import FlowOrchestrator
    from .connectors import CONNECTOR_LOOKUP, CONNECTORS
    from .services import AutoPilot, Monitoring, TaskManager
except ImportError:  # pragma: no cover - fallback when running as a top-level module
    from activity import ActivityLog
    from automations import FlowOrchestrator
    from connectors import CONNECTOR_LOOKUP, CONNECTORS
    from services import AutoPilot, Monitoring, TaskManager

root = Path(__file__).resolve().parent
AUTH_STATE_MAX_AGE_SECONDS = 900

logger = logging.getLogger("globalflow.app")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

app = FastAPI(title="Global Flow Automation")
app.add_middleware(GZipMiddleware, minimum_size=1200)

allowed_origins = [origin.strip() for origin in os.getenv("GLOBALFLOW_ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

cors_options = {
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if allowed_origins == ["*"]:
    cors_options["allow_origins"] = ["*"]
else:
    cors_options["allow_origins"] = allowed_origins

app.add_middleware(CORSMiddleware, **cors_options)
templates = Jinja2Templates(directory=root / "templates")
# Disable Jinja template caching to avoid unhashable cache key issues in this environment
templates.env.cache = None

# Asset version for cache-busting (env > git hash > fallback)
ASSET_VERSION = os.getenv("ASSET_VERSION")
if not ASSET_VERSION:
    try:
        ASSET_VERSION = (
            check_output(["git", "rev-parse", "--short", "HEAD"], cwd=root)
            .decode()
            .strip()
        )
    except (CalledProcessError, FileNotFoundError):
        ASSET_VERSION = "dev"


def _render_html(template_name: str, context: Dict[str, Any]) -> HTMLResponse:
    context = dict(context)
    context.setdefault("asset_version", ASSET_VERSION)
    template = templates.get_template(template_name)
    return HTMLResponse(template.render(context))

AUTOPILOT_BOOT_ENABLED = os.getenv("GLOBALFLOW_AUTOPILOT_ENABLED", "1").lower() not in {"0", "false", "no"}
EDGE_STATIC_ENABLED = os.getenv("GLOBALFLOW_EDGE_STATIC", "0").lower() in {"1", "true", "yes"}

if not EDGE_STATIC_ENABLED:
    app.mount("/static", StaticFiles(directory=root / "static"), name="static")


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _auth_secret() -> str:
    return os.getenv("GLOBALFLOW_AUTH_SECRET", "globalflow-dev-auth-secret")


def _sign_token(payload: str) -> str:
    return _urlsafe_b64encode(hmac.new(_auth_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest())


def _encode_signed_state(data: Dict[str, Any]) -> str:
    payload = _urlsafe_b64encode(json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _sign_token(payload)
    return f"{payload}.{signature}"


def _decode_signed_state(token: str) -> Dict[str, Any]:
    payload, signature = token.split(".", 1)
    expected = _sign_token(payload)
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid auth state signature")
    return json.loads(_urlsafe_b64decode(payload).decode("utf-8"))


def _encode_frontend_session(data: Dict[str, str]) -> str:
    return _urlsafe_b64encode(json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def _default_frontend_url(request: Request) -> str:
    configured = os.getenv("GLOBALFLOW_FRONTEND_BASE_URL")
    if configured:
        return configured.rstrip("/")
    return str(request.base_url).rstrip("/")


def _safe_return_to(request: Request, return_to: Optional[str]) -> str:
    fallback = _default_frontend_url(request)
    if not return_to:
        return fallback

    parsed = urlsplit(return_to)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return fallback

    allowed_hosts = {urlsplit(fallback).hostname, request.url.hostname, "globalflow.onrender.com", "globalflow-static.onrender.com"}
    extra_hosts = {host.strip() for host in os.getenv("GLOBALFLOW_ALLOWED_RETURN_HOSTS", "").split(",") if host.strip()}
    allowed_hosts.update(extra_hosts)

    if parsed.hostname not in allowed_hosts:
        return fallback

    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, ""))


def _public_base_url(request: Request) -> str:
    configured = os.getenv("GLOBALFLOW_PUBLIC_BASE_URL")
    if configured:
        return configured.rstrip("/")
    return str(request.base_url).rstrip("/")


def _auth_redirect_uri(request: Request, provider: str) -> str:
    configured = os.getenv(f"GLOBALFLOW_{provider.upper()}_REDIRECT_URI")
    if configured:
        return configured
    return f"{_public_base_url(request)}/auth/{provider}/callback"


def _build_auth_state(request: Request, provider: str, return_to: Optional[str]) -> str:
    return _encode_signed_state(
        {
            "provider": provider,
            "return_to": _safe_return_to(request, return_to),
            "nonce": secrets.token_urlsafe(18),
            "ts": int(time.time()),
        }
    )


def _resolve_auth_state(token: str, provider: str) -> Dict[str, Any]:
    state = _decode_signed_state(token)
    if state.get("provider") != provider:
        raise ValueError("Auth provider mismatch")
    if int(time.time()) - int(state.get("ts", 0)) > AUTH_STATE_MAX_AGE_SECONDS:
        raise ValueError("Auth state expired")
    return state


def _session_redirect(target_url: str, *, session: Optional[Dict[str, str]] = None, error: Optional[str] = None) -> RedirectResponse:
    fragment_payload: Dict[str, str] = {}
    if session:
        fragment_payload["auth_session"] = _encode_frontend_session(session)
    if error:
        fragment_payload["auth_error"] = error
    fragment = urlencode(fragment_payload)
    location = f"{target_url}#{fragment}" if fragment else target_url
    return RedirectResponse(url=location, status_code=303)


def _decode_jwt_payload(token: str) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    try:
        return json.loads(_urlsafe_b64decode(parts[1]).decode("utf-8"))
    except (json.JSONDecodeError, ValueError):
        return {}


def _provider_credentials(provider: str) -> Dict[str, str]:
    upper = provider.upper()
    return {
        "client_id": os.getenv(f"GLOBALFLOW_{upper}_CLIENT_ID", "").strip(),
        "client_secret": os.getenv(f"GLOBALFLOW_{upper}_CLIENT_SECRET", "").strip(),
    }


def _frontend_identity(provider: str, email: str, name: str, avatar_url: str = "") -> Dict[str, str]:
    session = {
        "email": email,
        "name": name,
        "api_key": "",
        "provider": provider,
        "login_method": provider.capitalize(),
    }
    if avatar_url:
        session["avatar_url"] = avatar_url
    return session


def _display_name_from_email(email: str) -> str:
    local_part = (email or "").split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
    if not local_part:
        return "GlobalFlow user"
    return " ".join(part[:1].upper() + part[1:] for part in local_part.split())


def _auth_error_redirect(request: Request, provider_label: str, return_to: Optional[str], message: str) -> RedirectResponse:
    return _session_redirect(_safe_return_to(request, return_to), error=f"{provider_label} sign-in {message}")


async def _post_form_json(url: str, payload: Dict[str, str]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, data=payload, headers={"Accept": "application/json"})
        response.raise_for_status()
    return response.json()


async def _get_json(url: str, headers: Dict[str, str]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
    return response.json()


def _parse_apple_user(user: Optional[str]) -> Dict[str, Any]:
    if not user:
        return {}
    try:
        parsed = json.loads(user)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _apple_display_name(user_payload: Dict[str, Any], email: str) -> str:
    name_payload = user_payload.get("name") if isinstance(user_payload, dict) else {}
    if isinstance(name_payload, dict):
        first = str(name_payload.get("firstName", "")).strip()
        last = str(name_payload.get("lastName", "")).strip()
        full_name = " ".join(part for part in (first, last) if part)
        if full_name:
            return full_name
    return _display_name_from_email(email)


@app.on_event("startup")
async def start_autopilot():
    if AUTOPILOT_BOOT_ENABLED:
        await autopilot.enable()
    else:
        logger.info("Autopilot startup disabled by environment")


@app.on_event("shutdown")
async def stop_autopilot():
    await autopilot.disable()


@app.middleware("http")
async def request_logger(request: Request, call_next):
    path = request.url.path
    should_log = not (path.startswith("/static/") or path in {"/health", "/favicon.ico"})
    if should_log:
        logger.info("Processing %s %s", request.method, path)
    try:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if path.startswith("/static/"):
            response.headers.setdefault("Cache-Control", "public, max-age=3600")
        elif request.method == "GET":
            response.headers.setdefault("Cache-Control", "no-cache")
        return response
    except Exception:
        if "monitoring" in globals():
            monitoring.record("errors")
        logger.exception("Unhandled error for %s %s", request.method, path)
        raise


WORLD_TASKS = [
    {
        "icon": "phone",
        "domain": "Call follow-up",
        "headline": "Close the loop after every call.",
        "description": "Summaries, action items, and next steps land in the right system without a coordinator chasing people.",
    },
    {
        "icon": "receipt",
        "domain": "Billing recovery",
        "headline": "Keep invoices moving.",
        "description": "GlobalFlow routes invoice work automatically so finance teams recover revenue faster with less manual admin.",
    },
    {
        "icon": "shield",
        "domain": "Tax readiness",
        "headline": "Stay ahead of deadlines.",
        "description": "Compliance tasks, supporting docs, and reminders stay visible in one workflow before they become urgent.",
    },
    {
        "icon": "folder",
        "domain": "Document control",
        "headline": "Route documents automatically.",
        "description": "Files are classified, routed, and attached to the right workflow so teams stop losing time to document hunts.",
    },
    {
        "icon": "spark",
        "domain": "Ops orchestration",
        "headline": "Run ops work from one dashboard.",
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
        "title": "Call summaries",
        "headline": "Calls end with the next step assigned.",
        "detail": "GlobalFlow turns conversations into summaries, owners, and follow-up tasks so nothing important gets lost after the call.",
        "href": "#demo",
    },
    {
        "icon": "receipt",
        "title": "Billing",
        "headline": "Invoices and approvals keep moving.",
        "detail": "Finance teams can route invoice work automatically, spot bottlenecks early, and keep collections on schedule.",
        "href": "#pricing",
    },
    {
        "icon": "shield",
        "title": "Compliance",
        "headline": "Deadlines stay visible.",
        "detail": "The workflow collects documents, tracks status, and keeps operations teams ahead of filing and review pressure.",
        "href": "#why-globalflow",
    },
    {
        "icon": "folder",
        "title": "Files",
        "headline": "Documents reach the right place.",
        "detail": "Contracts, receipts, and records are classified and routed so teams stop digging through shared drives and inboxes.",
        "href": "#integrations",
    },
    {
        "icon": "spark",
        "title": "Orchestration",
        "headline": "Automation stays under operator control.",
        "detail": "Operators can launch workflows, inspect every step, and intervene when needed from a single control room.",
        "href": "#integrations",
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
        "detail": "Data is protected in transit and at rest.",
    },
    {
        "title": "Human override built in",
        "detail": "Pause, inspect, or review any run.",
    },
    {
        "title": "Data stays traceable",
        "detail": "Logs and audit history stay visible.",
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
        "description": "Digital invoices",
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
        "description": "Recurring billing",
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
        "description": "Card billing",
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
FEEDBACK: List[Dict[str, Any]] = []

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
        "description": "One workflow for evaluation.",
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
        "description": "First production workflow.",
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
        "description": "Multiple workflows for growing teams.",
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
        "description": "Wide automation coverage.",
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
    {"label": "Changelog", "href": "https://github.com/ykidus053-create/globalflo/commits/main"},
    {"label": "Privacy Policy", "href": "/privacy"},
    {"label": "Terms of Service", "href": "/terms"},
    {"label": "Contact", "href": "mailto:hello@globalflow.ai"},
]

SOCIAL_LINKS = [
    {"label": "GitHub", "href": "https://github.com/ykidus053-create/globalflo"},
    {"label": "Roadmap", "href": "https://github.com/ykidus053-create/globalflo/issues"},
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

@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def homepage(request: Request):
    if request.method == "HEAD":
        return Response(status_code=200)
    autopilot_status = autopilot.status()
    execution_status = "Active" if autopilot_status["enabled"] else "Human-in-the-loop"
    stats = [
        {"label": "Time saved", "value": "20+ hrs / week"},
        {"label": "Confidence", "value": "99.2%"},
        {"label": "Time to live", "value": "72 hours"},
        {"label": "Autonomy", "value": execution_status},
    ]
    return _render_html(
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
            "oauth_configured": {
                "google": bool(_provider_credentials("google")["client_id"] and _provider_credentials("google")["client_secret"]),
                "apple": bool(_provider_credentials("apple")["client_id"] and _provider_credentials("apple")["client_secret"]),
            },
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


@app.get("/auth/google/start", include_in_schema=False)
async def google_auth_start(request: Request, return_to: Optional[str] = None):
    credentials = _provider_credentials("google")
    if not credentials["client_id"] or not credentials["client_secret"]:
        return _auth_error_redirect(request, "Google", return_to, "is not configured yet.")

    state = _build_auth_state(request, "google", return_to)
    params = {
        "client_id": credentials["client_id"],
        "redirect_uri": _auth_redirect_uri(request, "google"),
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}",
        status_code=303,
    )


@app.get("/auth/google/callback", include_in_schema=False)
async def google_auth_callback(
    request: Request,
    state: Optional[str] = None,
    code: Optional[str] = None,
    error: Optional[str] = None,
):
    target_url = _default_frontend_url(request)
    if state:
        try:
            target_url = _resolve_auth_state(state, "google")["return_to"]
        except ValueError as exc:
            return _session_redirect(target_url, error=str(exc))

    if error:
        return _session_redirect(target_url, error=f"Google sign-in failed: {error.replace('_', ' ')}")
    if not state or not code:
        return _session_redirect(target_url, error="Google sign-in did not complete.")

    credentials = _provider_credentials("google")
    if not credentials["client_id"] or not credentials["client_secret"]:
        return _session_redirect(target_url, error="Google sign-in is not configured yet.")

    try:
        token_payload = await _post_form_json(
            "https://oauth2.googleapis.com/token",
            {
                "code": code,
                "client_id": credentials["client_id"],
                "client_secret": credentials["client_secret"],
                "redirect_uri": _auth_redirect_uri(request, "google"),
                "grant_type": "authorization_code",
            },
        )
        access_token = str(token_payload.get("access_token", "")).strip()
        if not access_token:
            raise ValueError("Google token exchange returned no access token")
        profile = await _get_json(
            "https://openidconnect.googleapis.com/v1/userinfo",
            {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
    except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Google sign-in failed: %s", exc)
        return _session_redirect(target_url, error="Google sign-in could not be completed.")

    email = str(profile.get("email", "")).strip()
    if not email:
        return _session_redirect(target_url, error="Google account did not return an email address.")
    name = str(profile.get("name") or profile.get("given_name") or _display_name_from_email(email)).strip()
    session = _frontend_identity("google", email, name, avatar_url=str(profile.get("picture", "")).strip())
    return _session_redirect(target_url, session=session)


@app.get("/auth/apple/start", include_in_schema=False)
async def apple_auth_start(request: Request, return_to: Optional[str] = None):
    credentials = _provider_credentials("apple")
    if not credentials["client_id"] or not credentials["client_secret"]:
        return _auth_error_redirect(request, "Apple", return_to, "is not configured yet.")

    state = _build_auth_state(request, "apple", return_to)
    params = {
        "client_id": credentials["client_id"],
        "redirect_uri": _auth_redirect_uri(request, "apple"),
        "response_type": "code",
        "response_mode": "form_post",
        "scope": "name email",
        "state": state,
    }
    return RedirectResponse(
        url=f"https://appleid.apple.com/auth/authorize?{urlencode(params)}",
        status_code=303,
    )


async def _complete_apple_auth(
    request: Request,
    *,
    state: Optional[str],
    code: Optional[str],
    error: Optional[str],
    user: Optional[str] = None,
):
    target_url = _default_frontend_url(request)
    if state:
        try:
            target_url = _resolve_auth_state(state, "apple")["return_to"]
        except ValueError as exc:
            return _session_redirect(target_url, error=str(exc))

    if error:
        return _session_redirect(target_url, error=f"Apple sign-in failed: {error.replace('_', ' ')}")
    if not state or not code:
        return _session_redirect(target_url, error="Apple sign-in did not complete.")

    credentials = _provider_credentials("apple")
    if not credentials["client_id"] or not credentials["client_secret"]:
        return _session_redirect(target_url, error="Apple sign-in is not configured yet.")

    try:
        token_payload = await _post_form_json(
            "https://appleid.apple.com/auth/token",
            {
                "client_id": credentials["client_id"],
                "client_secret": credentials["client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _auth_redirect_uri(request, "apple"),
            },
        )
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        logger.warning("Apple sign-in failed: %s", exc)
        return _session_redirect(target_url, error="Apple sign-in could not be completed.")

    id_token_payload = _decode_jwt_payload(str(token_payload.get("id_token", "")))
    user_payload = _parse_apple_user(user)
    email = str(user_payload.get("email") or id_token_payload.get("email") or "").strip()
    if not email:
        return _session_redirect(target_url, error="Apple account did not return an email address.")
    name = _apple_display_name(user_payload, email)
    session = _frontend_identity("apple", email, name)
    return _session_redirect(target_url, session=session)


@app.get("/auth/apple/callback", include_in_schema=False)
async def apple_auth_callback_get(
    request: Request,
    state: Optional[str] = None,
    code: Optional[str] = None,
    error: Optional[str] = None,
    user: Optional[str] = None,
):
    return await _complete_apple_auth(request, state=state, code=code, error=error, user=user)


@app.post("/auth/apple/callback", include_in_schema=False)
async def apple_auth_callback_post(
    request: Request,
    state: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    error: Optional[str] = Form(None),
    user: Optional[str] = Form(None),
):
    return await _complete_apple_auth(request, state=state, code=code, error=error, user=user)


@app.get("/payment/{method}", response_class=HTMLResponse)
async def payment_portal(request: Request, method: str):
    portal = PAYMENT_LOOKUP.get(method.lower())
    if not portal:
        raise HTTPException(status_code=404, detail="Payment method unavailable")
    return _render_html(
        "payment.html",
        {
            "request": request,
            "portal": portal,
            "theme": _active_theme(),
        },
    )


@app.get("/checkout/{tier_id}", response_class=HTMLResponse)
async def checkout_page(request: Request, tier_id: str):
    tier = SUBSCRIPTION_LOOKUP.get(tier_id.lower())
    if not tier:
        raise HTTPException(status_code=404, detail="Subscription tier unavailable")
    return _render_html(
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
    method = method.lower()
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
        "redirect_url": "/automation",
    }


@app.post("/api/connectors/{connector_id}", response_class=JSONResponse)
async def trigger_connector(connector_id: str, payload: Dict[str, str]):
    connector = CONNECTOR_LOOKUP.get(connector_id.lower())
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
            response.raise_for_status()
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
    details: Dict[str, Any] = {}
    if response.headers.get("content-type", "").startswith("application/json"):
        try:
            details = response.json()
        except ValueError:
            details = {"raw": response.text[:200]}
    return {
        "status": "ok",
        "message": f"{connector['name']} triggered - {response.status_code}",
        "details": details,
    }

@app.post("/api/feedback", response_class=JSONResponse)
async def capture_feedback(payload: Dict[str, Any]):
    rating = int(payload.get("rating") or 0)
    comment = str(payload.get("comment") or "").strip()
    email = str(payload.get("email") or "").strip()

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="rating must be between 1 and 5")
    if not comment:
        raise HTTPException(status_code=400, detail="comment is required")
    if len(comment) > 2000:
        raise HTTPException(status_code=400, detail="comment is too long")

    entry = {
        "rating": rating,
        "comment": comment,
        "email": email[:200],
        "timestamp": datetime.utcnow().isoformat(),
        "ua": str(payload.get("ua") or "")[:200],
        "path": str(payload.get("path") or "")[:200],
    }
    FEEDBACK.append(entry)
    monitoring.record("feedback")
    activity_log.record(
        kind="feedback",
        source="website",
        message=f"Feedback received ({rating}/5)",
        detail=comment[:200],
    )
    return {"status": "ok", "message": "Thanks. Feedback received."}


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
    return _render_html(
        "privacy.html",
        {
            "request": request,
            "updated_on": "March 20, 2026",
            "theme": _active_theme(),
        },
    )


@app.get("/terms", response_class=HTMLResponse)
async def terms_of_service(request: Request):
    return _render_html(
        "terms.html",
        {
            "request": request,
            "updated_on": "March 20, 2026",
            "theme": _active_theme(),
        },
    )


@app.get("/account", response_class=HTMLResponse)
async def account_center(request: Request):
    return _render_html(
        "account.html",
        {
            "request": request,
            "profile": USER_PROFILE,
            "settings": USER_SETTINGS,
            "theme": _active_theme(),
        },
    )


@app.get("/automation", response_class=HTMLResponse)
async def automation_workspace(request: Request):
    return _render_html(
        "automation.html",
        {
            "request": request,
            "autopilot": autopilot.status(),
            "connectors": CONNECTORS,
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


@app.get("/api/account", response_class=JSONResponse)
async def account_state():
    return {"profile": USER_PROFILE, "settings": USER_SETTINGS}
