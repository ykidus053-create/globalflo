import asyncio
import logging
import random
import time
from datetime import datetime
from typing import Callable, Dict

from prefect import flow, task

logger = logging.getLogger("globalflow.automations")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


def _simulate_step(name: str, duration: float) -> Dict[str, str]:
    start = datetime.utcnow().isoformat()
    time.sleep(duration)
    end = datetime.utcnow().isoformat()
    result = {
        "name": name,
        "start": start,
        "end": end,
        "message": f"{name} completed in {duration:.1f}s",
    }
    logger.info(result["message"])
    return result


@task(name="Summarize support calls")
def calls_summary() -> Dict[str, str]:
    return _simulate_step("Call summaries", duration=random.uniform(0.3, 0.6))


@task(name="CRM enrichment")
def crm_enrichment() -> Dict[str, str]:
    return _simulate_step("CRM enrichment", duration=random.uniform(0.2, 0.45))


@task(name="Billing reconciliation")
def billing_reconciliation() -> Dict[str, str]:
    return _simulate_step("Billing reconciliation", duration=random.uniform(0.4, 0.7))


@task(name="Tax check")
def tax_check() -> Dict[str, str]:
    return _simulate_step("Tax compliance snapshot", duration=random.uniform(0.3, 0.6))


@task(name="File intelligence")
def file_intelligence() -> Dict[str, str]:
    return _simulate_step("File classifier", duration=random.uniform(0.2, 0.5))


@flow(name="Calls automation")
def calls_flow() -> Dict[str, str]:
    result1 = calls_summary()
    result2 = crm_enrichment()
    return {"steps": [result1, result2]}


@flow(name="Billing automation")
def billing_flow() -> Dict[str, str]:
    step = billing_reconciliation()
    summary = crm_enrichment()
    return {"steps": [step, summary]}


@flow(name="Tax automation")
def taxes_flow() -> Dict[str, str]:
    summary = tax_check()
    compliance = crm_enrichment()
    return {"steps": [summary, compliance]}


@flow(name="Files automation")
def files_flow() -> Dict[str, str]:
    intelligence = file_intelligence()
    summary = calls_summary()
    return {"steps": [intelligence, summary]}


FLOW_REGISTRY: Dict[str, Callable[[], Dict[str, str]]] = {
    "calls": calls_flow,
    "billing": billing_flow,
    "taxes": taxes_flow,
    "files": files_flow,
}


class FlowOrchestrator:
    def __init__(self):
        self.logger = logger

    async def run(self, task_id: str) -> None:
        flow_fn = FLOW_REGISTRY.get(task_id)
        if not flow_fn:
            self.logger.warning("No flow linked for task %s", task_id)
            return
        self.logger.info("Running automation flow for %s", task_id)
        await asyncio.to_thread(flow_fn)
