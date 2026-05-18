from __future__ import annotations

import json
import os
import re
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from .bring import TrackingLookupResult, normalize_tracking_number

COOLRUNNER_API_URL = "https://api.coolrunner.dk/frontend/tracking/{tracking_number}"
COOLRUNNER_PUBLIC_TRACKING_URL = "https://coolrunner.dk/tracking/?trackandtrace={tracking_number}"
DEFAULT_TIMEOUT_SECONDS = int(str(os.getenv("COOLRUNNER_TRACKING_TIMEOUT", "20") or "20"))


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _strip_markup_text(value: Any) -> str:
    text = re.sub(r"<[^>]*>", " ", str(value or ""))
    text = re.sub(r"\s+([.,;:!?])", r"\1", text)
    return _text(text)


def _first_text(source: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = source.get(key)
        if value is None:
            continue
        text = _text(value)
        if text:
            return text
    return ""


def _tracking_url(number: str) -> str:
    return COOLRUNNER_PUBLIC_TRACKING_URL.format(tracking_number=urllib_parse.quote(number, safe=""))


def _error_message_from_http_error(exc: urllib_error.HTTPError) -> str:
    try:
        raw = exc.read().decode("utf-8", errors="replace")
    except Exception:
        return ""

    body = _text(raw)
    if not body:
        return ""

    try:
        payload = json.loads(raw)
    except Exception:
        return body[:260]

    if isinstance(payload, dict):
        message = _text(payload.get("message") or payload.get("error") or "")
        if message:
            return message[:260]
    return body[:260]


def _normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    timestamp = _first_text(event, "timestamp", "created_at", "datetime", "time", "date")
    title = _strip_markup_text(_first_text(event, "title"))
    event_text = _strip_markup_text(_first_text(event, "event", "description", "message"))
    description = title or event_text or "Haendelse"
    location = _strip_markup_text(_first_text(event, "location", "city", "place"))
    status = _first_text(event, "carrier_code", "status", "event_code")
    return {
        "description": description,
        "status": status,
        "date_iso": timestamp,
        "display_date": timestamp,
        "display_time": "",
        "location": location,
    }


def _parse_tracking_payload(payload: dict[str, Any], tracking_number: str) -> TrackingLookupResult:
    data = payload.get("response_data")
    if not isinstance(data, dict):
        message = _text(payload.get("message") or payload.get("error") or "")
        if "no shipments" in message.lower():
            return TrackingLookupResult(
                carrier="coolrunner",
                tracking_number=tracking_number,
                status="Ikke fundet",
                tracking_url=_tracking_url(tracking_number),
                source="coolrunner-api",
                error=(message or "No shipments matching your search could be found")[:260],
            )
        raise RuntimeError(message or "Ugyldigt svar fra CoolRunner tracking API")

    raw_events = data.get("events")
    events = []
    if isinstance(raw_events, list):
        events = [_normalize_event(item) for item in raw_events if isinstance(item, dict)]
    events = [
        item
        for item in events
        if item.get("description") or item.get("status") or item.get("date_iso") or item.get("display_date")
    ][:30]

    latest = events[0] if events else {}
    carrier = _first_text(data, "carrier", "carrier_name", "provider") or "coolrunner"
    status = (
        _first_text(data, "status", "status_text", "statusText")
        or str(latest.get("description") or "").strip()
        or "Fundet hos CoolRunner"
    )
    status_code = str(latest.get("status") or _first_text(data, "status_code", "statusCode"))
    summary_parts = [
        _first_text(data, "delivery_method", "deliveryMethod"),
        _first_text(data, "title", "shipment_title", "shipmentTitle"),
    ]
    summary = " - ".join([part for part in summary_parts if part])

    return TrackingLookupResult(
        carrier=carrier,
        tracking_number=tracking_number,
        status=status,
        status_code=status_code,
        summary=summary,
        last_event_at=str(latest.get("date_iso") or latest.get("display_date") or ""),
        last_event_text=str(latest.get("description") or ""),
        last_event_location=str(latest.get("location") or ""),
        events=events,
        tracking_url=_tracking_url(tracking_number),
        source="coolrunner-api",
        error="",
    )


def fetch_coolrunner_tracking(
    tracking_number: Any,
    timeout: Optional[int] = None,
) -> TrackingLookupResult:
    number = normalize_tracking_number(tracking_number)
    timeout_seconds = int(timeout or DEFAULT_TIMEOUT_SECONDS or 20)

    req = urllib_request.Request(
        COOLRUNNER_API_URL.format(tracking_number=urllib_parse.quote(number, safe="")),
        method="GET",
        headers={
            "Accept": "application/json",
            "User-Agent": "fjordshare-tracking/1.0",
        },
    )

    try:
        with urllib_request.urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib_error.HTTPError as exc:
        message = _error_message_from_http_error(exc)
        code = int(exc.code or 0)
        if code == 404:
            return TrackingLookupResult(
                carrier="coolrunner",
                tracking_number=number,
                status="Ikke fundet",
                tracking_url=_tracking_url(number),
                source="coolrunner-api",
                error=(message or "No shipments matching your search could be found")[:260],
            )
        if code == 400:
            return TrackingLookupResult(
                carrier="coolrunner",
                tracking_number=number,
                status="Fejl ved opdatering",
                tracking_url=_tracking_url(number),
                source="coolrunner-api",
                error=(message or "Ugyldigt trackingnummer")[:260],
            )
        return TrackingLookupResult(
            carrier="coolrunner",
            tracking_number=number,
            status="Fejl ved opdatering",
            tracking_url=_tracking_url(number),
            source="coolrunner-api",
            error=(message or f"CoolRunner API svarede HTTP {code}")[:260],
        )
    except Exception as exc:
        return TrackingLookupResult(
            carrier="coolrunner",
            tracking_number=number,
            status="Fejl ved opdatering",
            tracking_url=_tracking_url(number),
            source="coolrunner-api",
            error=str(exc)[:260],
        )

    try:
        payload = json.loads(raw or "{}")
    except Exception as exc:
        return TrackingLookupResult(
            carrier="coolrunner",
            tracking_number=number,
            status="Fejl ved opdatering",
            tracking_url=_tracking_url(number),
            source="coolrunner-api",
            error=f"Ugyldigt JSON svar fra CoolRunner: {str(exc)[:180]}",
        )

    if not isinstance(payload, dict):
        return TrackingLookupResult(
            carrier="coolrunner",
            tracking_number=number,
            status="Fejl ved opdatering",
            tracking_url=_tracking_url(number),
            source="coolrunner-api",
            error="Ugyldigt svarformat fra CoolRunner",
        )

    try:
        return _parse_tracking_payload(payload, number)
    except Exception as exc:
        return TrackingLookupResult(
            carrier="coolrunner",
            tracking_number=number,
            status="Fejl ved opdatering",
            tracking_url=_tracking_url(number),
            source="coolrunner-api",
            error=str(exc)[:260],
        )
