"""3CX-independent primitives for the HWERP telephone integration.

No 3CX credentials are stored in this package.  A hosted 3CX deployment is
configured per Frappe site through ``hwerp_3cx_dial_url_template``.  The value
must contain the ``{number}`` placeholder and is deliberately kept outside
version control.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Mapping
from urllib.parse import quote


class PhoneNumberError(ValueError):
    """The submitted value cannot represent a callable phone number."""


class ConfigurationError(ValueError):
    """The local 3CX integration configuration is incomplete or unsafe."""


class CallEventError(ValueError):
    """An inbound call event does not have the minimum auditable shape."""


_DIALABLE = re.compile(r"[^0-9+]")
_DIRECTION_MAP = {"inbound": "incoming", "incoming": "incoming", "outbound": "outgoing", "outgoing": "outgoing"}


def normalize_phone(value: object) -> str:
    """Normalize a user-facing phone number to a conservative E.164-like key."""
    if not isinstance(value, str) or not value.strip():
        raise PhoneNumberError("Telefonnummer fehlt")
    number = _DIALABLE.sub("", value.strip())
    if not any(character.isdigit() for character in number):
        raise PhoneNumberError("Telefonnummer enthält keine Ziffer")
    if number.startswith("00"):
        number = "+" + number[2:]
    if number.count("+") > 1 or ("+" in number and not number.startswith("+")):
        raise PhoneNumberError("Telefonnummer hat ein ungültiges Format")
    return number


def prepare_click_to_call_url(template: str, phone: str) -> str:
    """Return a safely encoded hosted-3CX launch URL from an admin template."""
    if not isinstance(template, str) or "{number}" not in template:
        raise ConfigurationError("Die 3CX-Wähl-URL muss den Platzhalter {number} enthalten")
    if template.count("{number}") != 1:
        raise ConfigurationError("Die 3CX-Wähl-URL darf {number} nur einmal enthalten")
    normalized = normalize_phone(phone)
    return template.replace("{number}", quote(normalized, safe=""))


@dataclass(frozen=True)
class CallEvent:
    event_id: str
    direction: str
    external_number: str
    extension: str | None
    started_at: str | None


def parse_call_event(payload: Mapping[str, Any]) -> CallEvent:
    """Validate the provider-neutral event contract used by the webhook adapter."""
    event_id = str(payload.get("event_id", "")).strip()
    if not event_id:
        raise CallEventError("3CX-Ereignis ohne event_id")
    raw_direction = str(payload.get("direction", "")).strip().lower()
    direction = _DIRECTION_MAP.get(raw_direction)
    if not direction:
        raise CallEventError("Ungültige Richtung des Anrufs")
    raw_number = payload.get("external_number")
    try:
        external_number = normalize_phone(raw_number)
    except PhoneNumberError as exc:
        raise CallEventError(str(exc)) from exc
    extension = str(payload["extension"]).strip() if payload.get("extension") else None
    started_at = str(payload["started_at"]).strip() if payload.get("started_at") else None
    return CallEvent(event_id, direction, external_number, extension, started_at)
