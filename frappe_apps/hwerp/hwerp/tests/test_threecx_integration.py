from __future__ import annotations

import pytest


def test_normalize_phone_preserves_e164_and_converts_international_prefix() -> None:
    from hwerp.integrations.threecx import normalize_phone

    assert normalize_phone(" +49 (30) 123-45  ") == "+493012345"
    assert normalize_phone("0049 30 12345") == "+493012345"


def test_normalize_phone_rejects_empty_and_non_dialable_values() -> None:
    from hwerp.integrations.threecx import PhoneNumberError, normalize_phone

    with pytest.raises(PhoneNumberError, match="Telefonnummer fehlt"):
        normalize_phone("  ")
    with pytest.raises(PhoneNumberError, match="keine Ziffer"):
        normalize_phone("Durchwahl")


def test_prepare_click_to_call_url_requires_a_safe_number_placeholder() -> None:
    from hwerp.integrations.threecx import ConfigurationError, prepare_click_to_call_url

    assert prepare_click_to_call_url(
        "https://pbx.example.test/webclient/#/call?phone={number}", "+49 30 12345"
    ) == "https://pbx.example.test/webclient/#/call?phone=%2B493012345"

    with pytest.raises(ConfigurationError, match="{number}"):
        prepare_click_to_call_url("https://pbx.example.test/webclient/", "+493012345")


def test_parse_call_event_accepts_inbound_event_and_rejects_unknown_direction() -> None:
    from hwerp.integrations.threecx import CallEventError, parse_call_event

    event = parse_call_event(
        {
            "event_id": "3cx-4711",
            "direction": "inbound",
            "external_number": "0049 30 12345",
            "extension": "101",
            "started_at": "2026-08-11T13:00:00Z",
        }
    )

    assert event.event_id == "3cx-4711"
    assert event.direction == "incoming"
    assert event.external_number == "+493012345"

    with pytest.raises(CallEventError, match="Richtung"):
        parse_call_event({"event_id": "x", "direction": "sideways", "external_number": "+493012345"})
