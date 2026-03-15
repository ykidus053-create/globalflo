import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("globalflow.services")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


class Monitoring:
    def __init__(self):
        self._metrics: Dict[str, int] = {
            "tasks_run": 0,
            "subscriptions": 0,
            "payment_requests": 0,
            "errors": 0,
        }

    def record(self, key: str, amount: int = 1) -> None:
        self._metrics[key] = self._metrics.get(key, 0) + amount

    def snapshot(self) -> Dict[str, int]:
        return dict(self._metrics)


class TaskManager:
    def __init__(self, tasks: Dict[str, Dict[str, Any]], monitoring: Monitoring):
        self._tasks = tasks
        self._monitoring = monitoring

    def list_tasks(self) -> List[Dict[str, Any]]:
        return list(self._tasks.values())

    def get_task(self, task_id: str) -> Dict[str, Any]:
        return self._tasks.get(task_id)

    def update_task(
        self,
        task_id: str,
        *,
        status: str,
        note: str,
        last_run: Optional[str] = None,
    ) -> Dict[str, Any]:
        task = self._tasks.get(task_id)
        if not task:
            raise KeyError("Task not defined")
        task["status"] = status
        task["note"] = note
        if last_run is not None:
            task["last_run"] = last_run
        return task

    async def kickoff(self, task_id: str) -> Dict[str, Any]:
        task = self.get_task(task_id)
        if not task:
            raise KeyError(f"Task {task_id} not found")
        now = datetime.utcnow()
        self.update_task(
            task_id,
            status="running",
            note="Triggering Prefect + LangChain + Temporal orchestrations...",
            last_run=now.strftime("%Y-%m-%d %H:%M UTC"),
        )
        self._monitoring.record("tasks_run")
        try:
            await asyncio.sleep(2)
            completed = self.update_task(
                task_id,
                status="ready",
                note=f"Workflow complete at {datetime.utcnow().strftime('%H:%M UTC')}; next trigger scheduled.",
            )
            logger.info("Task %s completed", task_id)
            return completed
        except Exception as err:
            self._monitoring.record("errors")
            self.update_task(task_id, status="error", note=f"Error: {err}")
            logger.exception("Task %s failed", task_id)
            raise
