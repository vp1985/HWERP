from __future__ import annotations

import frappe

from hwerp.integrations.threecx import ConfigurationError, PhoneNumberError, prepare_click_to_call_url


@frappe.whitelist(methods=["POST"])
def click_to_call(phone: str) -> dict[str, str]:
    """Return the hosted-3CX Web Client URL for a user-initiated call.

    The endpoint never contacts the PBX and never exposes credentials.  The
    browser opens the returned URL in the authenticated 3CX Web Client.
    """
    template = frappe.conf.get("hwerp_3cx_dial_url_template")
    if not template:
        error_type = getattr(frappe, "ValidationError", ValueError)
        raise error_type("3CX ist für diese Site noch nicht konfiguriert")
    try:
        return {"launch_url": prepare_click_to_call_url(str(template), phone)}
    except (ConfigurationError, PhoneNumberError) as exc:
        error_type = getattr(frappe, "ValidationError", ValueError)
        raise error_type(str(exc)) from exc
