import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, List, Optional

try:
    from .activity import ActivityLog
    from .automations import FlowOrchestrator
except ImportError:  # pragma: no cover - fallback when running as a top-level module
    from activity import ActivityLog
    from automations import FlowOrchestrator

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
            "autopilot_cycles": 0,
            "errors": 0,
        }

    def record(self, key: str, amount: int = 1) -> None:
        self._metrics[key] = self._metrics.get(key, 0) + amount

    def snapshot(self) -> Dict[str, int]:
        return dict(self._metrics)


class TaskManager:
    def __init__(
        self,
        tasks: Dict[str, Dict[str, Any]],
        monitoring: Monitoring,
        orchestrator: Optional[FlowOrchestrator] = None,
        execution_hook: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]] = None,
    ):
        self._tasks = tasks
        self._monitoring = monitoring
        self._orchestrator = orchestrator
        self._execution_hook = execution_hook

    def set_execution_hook(self, execution_hook: Optional[Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]]) -> None:
        self._execution_hook = execution_hook

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
            if self._orchestrator:
                await self._orchestrator.run(task_id)
            else:
                await asyncio.sleep(2)
            hook_summary: Dict[str, Any] = {}
            if self._execution_hook:
                hook_summary = await self._execution_hook(task_id, task)
            hook_suffix = ""
            if hook_summary:
                total = int(hook_summary.get("total", 0))
                ok = int(hook_summary.get("ok", 0))
                if total > 0:
                    hook_suffix = f" Connectors {ok}/{total} dispatched."
            completed = self.update_task(
                task_id,
                status="ready",
                note=f"Workflow complete at {datetime.utcnow().strftime('%H:%M UTC')}; next trigger scheduled.{hook_suffix}",
            )
            logger.info("Task %s completed", task_id)
            return completed
        except Exception as err:
            self._monitoring.record("errors")
            self.update_task(task_id, status="error", note=f"Error: {err}")
            logger.exception("Task %s failed", task_id)
            raise


class AutoPilot:
    def __init__(self, task_manager: TaskManager, monitoring: Monitoring, activity_log: ActivityLog, interval_seconds: int = 45):
        self.task_manager = task_manager
        self.monitoring = monitoring
        self.interval_seconds = interval_seconds
        self.enabled = False
        self.cycle_count = 0
        self.last_run: Optional[datetime] = None
        self._loop_task: Optional[asyncio.Task] = None
        self.activity_log = activity_log

    def status(self) -> Dict[str, Optional[str]]:
        next_run = None
        if self.last_run:
            next_eta = self.last_run + timedelta(seconds=self.interval_seconds)
            next_run = next_eta.isoformat()
        return {
            "enabled": self.enabled,
            "interval": self.interval_seconds,
            "cycles": self.cycle_count,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": next_run,
        }

    async def enable(self) -> None:
        if self.enabled:
            return
        self.enabled = True
        self._loop_task = asyncio.create_task(self._loop())

    async def disable(self) -> None:
        if not self.enabled:
            return
        self.enabled = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None

    async def _loop(self) -> None:
        try:
            while self.enabled:
                try:
                    await self._execute_cycle()
                except Exception:
                    self.monitoring.record("errors")
                    logger.exception("Autopilot cycle failed")
                await asyncio.sleep(self.interval_seconds)
        except asyncio.CancelledError:
            pass

    async def _execute_cycle(self) -> None:
        tasks = list(self.task_manager.list_tasks())
        for task in tasks:
            if not self.enabled:
                break
            try:
                await self.task_manager.kickoff(task["id"])
            except KeyError:
                continue
            except Exception:
                self.monitoring.record("errors")
                logger.exception("Autopilot task failed: %s", task.get("id"))
                continue
        self.cycle_count += 1
        self.last_run = datetime.utcnow()
        self.monitoring.record("autopilot_cycles")
        if self.activity_log:
            self.activity_log.record(
                kind="autopilot",
                source="autopilot",
                message=f"Cycle {self.cycle_count} completed",
                detail=f"{len(tasks)} automation(s) executed",
            )
