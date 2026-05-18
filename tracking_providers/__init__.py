from __future__ import annotations

from typing import Any, Optional

from .bring import TrackingLookupResult, fetch_bring_tracking, normalize_tracking_number
from .coolrunner import fetch_coolrunner_tracking


def _result_has_events(result: TrackingLookupResult) -> bool:
    return bool(result and isinstance(result.events, list) and len(result.events) > 0)


def _result_is_not_found(result: TrackingLookupResult) -> bool:
    status = str(getattr(result, "status", "") or "").strip().lower()
    error = str(getattr(result, "error", "") or "").strip().lower()
    return (
        "ikke fundet" in status
        or "no shipments matching" in error
        or "ingen forsendelse" in error
    )


def _result_is_error(result: TrackingLookupResult) -> bool:
    status = str(getattr(result, "status", "") or "").strip().lower()
    error = str(getattr(result, "error", "") or "").strip()
    return bool(error) or ("fejl" in status and not _result_has_events(result))


def _result_is_success(result: TrackingLookupResult) -> bool:
    if _result_has_events(result):
        return True
    if _result_is_not_found(result):
        return False
    if _result_is_error(result):
        return False
    status = str(getattr(result, "status", "") or "").strip()
    return bool(status)


def fetch_tracking(
    tracking_number: Any,
    client_url: str = "",
    timeout: Optional[int] = None,
) -> TrackingLookupResult:
    bring_result = fetch_bring_tracking(tracking_number, client_url=client_url, timeout=timeout)
    if _result_is_success(bring_result):
        return bring_result

    coolrunner_result = fetch_coolrunner_tracking(tracking_number, timeout=timeout)
    if _result_is_success(coolrunner_result):
        return coolrunner_result

    if _result_is_not_found(bring_result):
        # Keep Bring as the default source for true not-found, but retain the
        # CoolRunner message if Bring has no explicit message.
        if not str(bring_result.error or "").strip() and str(coolrunner_result.error or "").strip():
            bring_result.error = str(coolrunner_result.error or "")[:260]
        return bring_result

    if _result_is_error(bring_result) and not _result_is_error(coolrunner_result):
        return coolrunner_result

    if str(bring_result.error or "").strip() and str(coolrunner_result.error or "").strip():
        cool_msg = str(coolrunner_result.error or "").strip()
        bring_msg = str(bring_result.error or "").strip()
        if cool_msg and cool_msg not in bring_msg:
            bring_result.error = f"{bring_msg} | CoolRunner: {cool_msg[:140]}"

    return bring_result

__all__ = [
    "TrackingLookupResult",
    "fetch_tracking",
    "fetch_bring_tracking",
    "fetch_coolrunner_tracking",
    "normalize_tracking_number",
]
