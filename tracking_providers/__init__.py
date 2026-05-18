from __future__ import annotations

from typing import Any, Optional

from .bring import TrackingLookupResult, fetch_bring_tracking, normalize_tracking_number
from .coolrunner import fetch_coolrunner_tracking

def fetch_tracking(
    tracking_number: Any,
    client_url: str = "",
    timeout: Optional[int] = None,
) -> TrackingLookupResult:
    # Bring provider is intentionally not used in the active flow right now.
    # Keep it available in the codebase for easy rollback later.
    _ = client_url
    return fetch_coolrunner_tracking(tracking_number, timeout=timeout)

__all__ = [
    "TrackingLookupResult",
    "fetch_tracking",
    "fetch_bring_tracking",
    "fetch_coolrunner_tracking",
    "normalize_tracking_number",
]
