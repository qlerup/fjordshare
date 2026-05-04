from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

BRING_API_URL = "https://api.bring.com/tracking/api/v2/tracking.json"
BRING_PUBLIC_TRACKING_URL = "https://tracking.bring.com/tracking/{tracking_number}?lang=da"
DEFAULT_TIMEOUT_SECONDS = int(str(os.getenv("BRING_TRACKING_TIMEOUT", "20") or "20"))


@dataclass
class TrackingLookupResult:
    carrier: str
    tracking_number: str
    status: str = ""
    status_code: str = ""
    summary: str = ""
    last_event_at: str = ""
    last_event_text: str = ""
    last_event_location: str = ""
    events: list[dict[str, Any]] = field(default_factory=list)
    tracking_url: str = ""
    source: str = ""
    error: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "carrier": self.carrier,
            "tracking_number": self.tracking_number,
            "status": self.status,
            "status_code": self.status_code,
            "summary": self.summary,
            "last_event_at": self.last_event_at,
            "last_event_text": self.last_event_text,
            "last_event_location": self.last_event_location,
            "events": self.events,
            "tracking_url": self.tracking_url,
            "source": self.source,
            "error": self.error,
        }


def normalize_tracking_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Indtast tracking- eller pakkenummer")
    cleaned = re.sub(r"[^0-9A-Za-z#_.()*\-\s]", "", raw).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        raise ValueError("Trackingnummer indeholder ingen gyldige tegn")
    if len(cleaned) > 90:
        raise ValueError("Trackingnummer er for langt")
    return cleaned


def fetch_bring_tracking(tracking_number: Any, client_url: str = "", timeout: Optional[int] = None) -> TrackingLookupResult:
    number = normalize_tracking_number(tracking_number)
    timeout_seconds = int(timeout or DEFAULT_TIMEOUT_SECONDS or 20)
    uid = str(os.getenv("BRING_API_UID", "") or "").strip()
    api_key = str(os.getenv("BRING_API_KEY", "") or "").strip()

    if uid and api_key:
        try:
            return _fetch_bring_api_tracking(
                number,
                uid=uid,
                api_key=api_key,
                client_url=client_url,
                timeout=timeout_seconds,
            )
        except Exception as exc:
            # Fall back to the public tracking page so a temporary API/auth issue
            # does not make manual refresh useless.
            fallback = _fetch_bring_public_tracking(number, timeout=timeout_seconds)
            if not fallback.error:
                fallback.error = f"Bring API fejlede, public scrape blev brugt: {str(exc)[:180]}"
            return fallback

    return _fetch_bring_public_tracking(number, timeout=timeout_seconds)


def _tracking_url(number: str) -> str:
    return BRING_PUBLIC_TRACKING_URL.format(tracking_number=urllib_parse.quote(number, safe=""))


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _listify(value: Any, *nested_keys: str) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in nested_keys:
            nested = value.get(key)
            if isinstance(nested, list):
                return nested
            if isinstance(nested, dict):
                return [nested]
        return [value]
    return []


def _first_text(source: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = source.get(key)
        if value is not None:
            text = _text(value)
            if text:
                return text
    return ""


def _event_location(event: dict[str, Any]) -> str:
    city = _first_text(event, "city", "City")
    country = _first_text(event, "country", "Country")
    if city and country:
        return f"{city}, {country}"
    return city or country


def _fetch_bring_api_tracking(
    number: str,
    *,
    uid: str,
    api_key: str,
    client_url: str,
    timeout: int,
) -> TrackingLookupResult:
    query = urllib_parse.urlencode({"q": number, "lang": "da"})
    req = urllib_request.Request(
        f"{BRING_API_URL}?{query}",
        method="GET",
        headers={
            "Accept": "application/json",
            "User-Agent": "fjordshare-tracking/1.0",
            "api-version": "2",
            "X-Mybring-API-Uid": uid,
            "X-Mybring-API-Key": api_key,
            "X-Bring-Client-URL": _client_url(client_url),
        },
    )
    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib_error.HTTPError as exc:
        body = _http_error_body(exc)
        if int(exc.code or 0) == 404:
            return TrackingLookupResult(
                carrier="bring",
                tracking_number=number,
                status="Ikke fundet",
                tracking_url=_tracking_url(number),
                source="bring-api",
                error=body or "Bring fandt ingen forsendelse på dette nummer.",
            )
        raise RuntimeError(body or f"Bring API svarede HTTP {int(exc.code or 0)}") from exc

    payload = json.loads(raw or "{}")
    result = _parse_bring_api_payload(payload, number)
    result.source = "bring-api"
    result.tracking_url = _tracking_url(number)
    return result


def _client_url(client_url: str) -> str:
    value = str(client_url or os.getenv("BRING_CLIENT_URL", "") or "").strip()
    if value:
        return value
    return "https://fjordshare.local/"


def _http_error_body(exc: urllib_error.HTTPError) -> str:
    try:
        raw = exc.read().decode("utf-8", errors="ignore")
    except Exception:
        raw = ""
    msg = _text(raw)
    return msg[:260]


def _parse_bring_api_payload(payload: dict[str, Any], number: str) -> TrackingLookupResult:
    err = payload.get("error")
    if isinstance(err, dict):
        message = _first_text(err, "message", "Message") or "Bring returnerede en fejl."
        return TrackingLookupResult(
            carrier="bring",
            tracking_number=number,
            status="Fejl",
            tracking_url=_tracking_url(number),
            source="bring-api",
            error=message[:260],
        )

    consignments_raw = payload.get("consignmentSet") or payload.get("ConsignmentSet") or []
    if isinstance(consignments_raw, dict):
        consignments = _listify(consignments_raw.get("consignment") or consignments_raw.get("Consignment"), "consignment", "Consignment")
    else:
        consignments = _listify(consignments_raw)
    if not consignments and isinstance(payload, dict) and (payload.get("packageSet") or payload.get("PackageSet")):
        consignments = [payload]

    consignment = next((c for c in consignments if isinstance(c, dict) and not c.get("error")), None)
    if not isinstance(consignment, dict):
        return TrackingLookupResult(
            carrier="bring",
            tracking_number=number,
            status="Ikke fundet",
            tracking_url=_tracking_url(number),
            source="bring-api",
            error="Bring fandt ingen forsendelse på dette nummer.",
        )

    packages_raw = consignment.get("packageSet") or consignment.get("PackageSet") or []
    if isinstance(packages_raw, dict):
        packages = _listify(packages_raw.get("package") or packages_raw.get("Package") or packages_raw.get("PackageType"))
    else:
        packages = _listify(packages_raw)
    package = _pick_package(packages, number) or consignment

    event_set_raw = package.get("eventSet") or package.get("EventSet") or []
    if isinstance(event_set_raw, dict):
        raw_events = _listify(event_set_raw.get("event") or event_set_raw.get("Event"))
    else:
        raw_events = _listify(event_set_raw)

    events = [_normalize_api_event(e) for e in raw_events if isinstance(e, dict)]
    events = [e for e in events if e.get("description") or e.get("status") or e.get("display_date") or e.get("date_iso")]
    last_event = events[0] if events else {}

    product_name = _first_text(package, "productName", "ProductName")
    sender = _first_text(consignment, "senderName", "SenderName")
    summary = " - ".join([part for part in (product_name, sender) if part])
    status = (
        _first_text(package, "statusDescription", "StatusDescription")
        or str(last_event.get("description") or "").strip()
        or "Fundet hos Bring"
    )
    status_code = str(last_event.get("status") or "").strip()
    return TrackingLookupResult(
        carrier="bring",
        tracking_number=number,
        status=status,
        status_code=status_code,
        summary=summary,
        last_event_at=str(last_event.get("date_iso") or last_event.get("display_date") or ""),
        last_event_text=str(last_event.get("description") or ""),
        last_event_location=str(last_event.get("location") or ""),
        events=events[:30],
        tracking_url=_tracking_url(number),
        source="bring-api",
        error="",
    )


def _pick_package(packages: list[Any], number: str) -> Optional[dict[str, Any]]:
    normalized = number.replace(" ", "").lower()
    first_package = next((p for p in packages if isinstance(p, dict)), None)
    for package in packages:
        if not isinstance(package, dict):
            continue
        package_number = _first_text(package, "packageNumber", "PackageNumber")
        if package_number.replace(" ", "").lower() == normalized:
            return package
    return first_package


def _normalize_api_event(event: dict[str, Any]) -> dict[str, Any]:
    display_date = _first_text(event, "displayDate", "OccuredAtDisplayDate", "DisplayDate")
    display_time = _first_text(event, "displayTime", "DisplayTime")
    return {
        "description": _first_text(event, "description", "Description"),
        "status": _first_text(event, "status", "Status"),
        "date_iso": _first_text(event, "dateIso", "DateIso"),
        "display_date": " ".join([part for part in (display_date, display_time) if part]).strip(),
        "display_time": display_time,
        "location": _event_location(event),
    }


class _BringTrackingHtmlParser(HTMLParser):
    VOID_TAGS = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._active_testids: list[str] = []
        self._tag_stack: list[tuple[str, str]] = []
        self.testid_text: dict[str, list[str]] = {}
        self.events: list[str] = []
        self._current_event: Optional[list[str]] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        tag_name = tag.lower()
        attrs_dict = {str(k): (v or "") for k, v in attrs}
        testid = attrs_dict.get("data-testid", "")
        if tag_name in self.VOID_TAGS:
            return
        self._tag_stack.append((tag_name, testid))
        if testid:
            self._active_testids.append(testid)
            self.testid_text.setdefault(testid, [])
        if tag_name == "li" and "parcel-history" in self._active_testids:
            self._current_event = []

    def handle_endtag(self, tag: str) -> None:
        tag_name = tag.lower()
        if tag_name == "li" and self._current_event is not None:
            text = _text(" ".join(self._current_event))
            if text:
                self.events.append(text)
            self._current_event = None
        while self._tag_stack:
            open_tag, testid = self._tag_stack.pop()
            if testid and self._active_testids:
                self._active_testids.pop()
            if open_tag == tag_name:
                break

    def handle_data(self, data: str) -> None:
        text = _text(data)
        if not text:
            return
        for testid in self._active_testids:
            self.testid_text.setdefault(testid, []).append(text)
        if self._current_event is not None:
            self._current_event.append(text)


def _fetch_bring_public_tracking(number: str, timeout: int) -> TrackingLookupResult:
    req = urllib_request.Request(
        _tracking_url(number),
        method="GET",
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "fjordshare-tracking/1.0",
        },
    )
    status_code = 200
    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            status_code = int(getattr(resp, "status", 200) or 200)
            html = resp.read().decode("utf-8", errors="replace")
    except urllib_error.HTTPError as exc:
        status_code = int(exc.code or 0)
        html = exc.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return TrackingLookupResult(
            carrier="bring",
            tracking_number=number,
            status="Fejl ved opdatering",
            tracking_url=_tracking_url(number),
            source="bring-public",
            error=str(exc)[:260],
        )

    parser = _BringTrackingHtmlParser()
    parser.feed(html)

    def testid_text(testid: str) -> str:
        return _text(" ".join(parser.testid_text.get(testid, [])))

    not_found_text = testid_text("errorboundary-errorstate-notfound")
    if status_code == 404 or not_found_text:
        return TrackingLookupResult(
            carrier="bring",
            tracking_number=number,
            status="Ikke fundet",
            tracking_url=_tracking_url(number),
            source="bring-public",
            error=(not_found_text or "Bring fandt ingen forsendelse på dette nummer.")[:260],
        )

    events = _normalize_public_events(parser.events)
    last_event = events[0] if events else {}
    status = testid_text("parcel-status-heading") or str(last_event.get("description") or "") or "Fundet hos Bring"
    delivery_method = testid_text("parcel-details-delivery-method")
    sender = testid_text("trackingnumber-sender-summary")
    summary = " - ".join([part for part in (delivery_method, sender) if part])
    return TrackingLookupResult(
        carrier="bring",
        tracking_number=number,
        status=status,
        status_code="",
        summary=summary,
        last_event_at=str(last_event.get("display_date") or ""),
        last_event_text=str(last_event.get("description") or ""),
        last_event_location=str(last_event.get("location") or ""),
        events=events[:30],
        tracking_url=_tracking_url(number),
        source="bring-public",
        error="",
    )


def _normalize_public_events(raw_events: list[str]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    seen: set[str] = set()
    date_pattern = re.compile(
        r"(\d{1,2}\.\s+[A-Za-zÆØÅæøå]+\s+\d{4}(?:\s+kl\.\s+\d{1,2}\.\d{2})?)"
    )
    for raw in raw_events:
        text = _text(raw)
        if not text or text in seen:
            continue
        seen.add(text)
        match = date_pattern.search(text)
        display_date = match.group(1) if match else ""
        description = _text(text[: match.start()]) if match else text
        events.append(
            {
                "description": description,
                "status": "",
                "date_iso": "",
                "display_date": display_date,
                "display_time": "",
                "location": "",
            }
        )
    return events
