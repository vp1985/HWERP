from __future__ import annotations

import importlib
import sys
from types import ModuleType, SimpleNamespace


def load_api(monkeypatch):
    frappe = ModuleType("frappe")

    def whitelist(*, methods):
        def decorate(function):
            function.allowed_methods = methods
            return function

        return decorate

    frappe.whitelist = whitelist
    frappe.conf = {"hwerp_3cx_dial_url_template": "https://pbx.example.test/webclient/#/call?phone={number}"}
    monkeypatch.setitem(sys.modules, "frappe", frappe)
    sys.modules.pop("hwerp.api.v1.threecx", None)
    return importlib.import_module("hwerp.api.v1.threecx")


def test_click_to_call_is_a_post_only_authenticated_site_config_adapter(monkeypatch) -> None:
    api = load_api(monkeypatch)

    result = api.click_to_call("0049 30 12345")

    assert api.click_to_call.allowed_methods == ["POST"]
    assert result == {"launch_url": "https://pbx.example.test/webclient/#/call?phone=%2B493012345"}


def test_click_to_call_does_not_return_missing_or_invalid_configuration(monkeypatch) -> None:
    api = load_api(monkeypatch)
    api.frappe.conf = {}

    error = getattr(api.frappe, "ValidationError", ValueError)
    try:
        api.click_to_call("+493012345")
    except error as exc:
        assert "nicht konfiguriert" in str(exc)
    else:
        raise AssertionError("Eine fehlende 3CX-Konfiguration muss abgelehnt werden")
