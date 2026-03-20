from collections import deque
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Deque, Dict, List


@dataclass
class ActivityEvent:
    kind: str
    source: str
    message: str
    detail: str
    timestamp: str


class ActivityLog:
    def __init__(self, max_entries: int = 40):
        self._events: Deque[ActivityEvent] = deque(maxlen=max_entries)

    def record(self, kind: str, source: str, message: str, detail: str = "") -> None:
        event = ActivityEvent(kind=kind, source=source, message=message, detail=detail, timestamp=datetime.utcnow().isoformat())
        self._events.appendleft(event)

    def snapshot(self) -> List[Dict[str, str]]:
        return [asdict(event) for event in list(self._events)]
