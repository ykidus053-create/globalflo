import asyncio
import logging
import random
from datetime import datetime
from typing import Awaitable, Callable, Dict, List

logger = logging.getLogger("globalflow.automations")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


async def _simulate_step(name: str, duration: float) -> Dict[str, str]:
    start = datetime.utcnow().isoformat()
    await asyncio.sleep(duration)
    end = datetime.utcnow().isoformat()
    message = f"{name} completed in {duration:.1f}s"
    logger.info(message)
    return {
        "name": name,
        "start": start,
        "end": end,
        "message": message,
    }


async def _calls_summary() -> Dict[str, str]:
    return await _simulate_step("Call summary stream", random.uniform(0.3, 0.6))


async def _crm_enrichment() -> Dict[str, str]:
    return await _simulate_step("CRM enrichment", random.uniform(0.25, 0.5))


async def _billing_reconciliation() -> Dict[str, str]:
    return await _simulate_step("Billing reconciliation", random.uniform(0.35, 0.7))


async def _tax_snapshot() -> Dict[str, str]:
    return await _simulate_step("Tax snapshot", random.uniform(0.3, 0.6))


async def _file_intelligence() -> Dict[str, str]:
    return await _simulate_step("File intelligence", random.uniform(0.2, 0.45))


FlowFn = Callable[[], Awaitable[Dict[str, List[Dict[str, str]]]]]


async def calls_flow() -> Dict[str, List[Dict[str, str]]]:
    steps = []
    steps.append(await _calls_summary())
    steps.append(await _crm_enrichment())
    return {"steps": steps}


async def billing_flow() -> Dict[str, List[Dict[str, str]]]:
    steps = []
    steps.append(await _billing_reconciliation())
    steps.append(await _crm_enrichment())
    return {"steps": steps}


async def taxes_flow() -> Dict[str, List[Dict[str, str]]]:
    steps = []
    steps.append(await _tax_snapshot())
    steps.append(await _crm_enrichment())
    return {"steps": steps}


async def files_flow() -> Dict[str, List[Dict[str, str]]]:
    steps = []
    steps.append(await _file_intelligence())
    steps.append(await _calls_summary())
    return {"steps": steps}


FLOW_REGISTRY: Dict[str, FlowFn] = {
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
            self.logger.warning("No automation flow registered for %s", task_id)
            return
        self.logger.info("Executing automation flow for %s", task_id)
        await flow_fn()
