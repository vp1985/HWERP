from __future__ import annotations

import importlib
from types import ModuleType, SimpleNamespace
import sys


def load_api(monkeypatch):
	frappe = ModuleType("frappe")

	def whitelist(*, methods):
		def decorate(function):
			function.allowed_methods = methods
			return function

		return decorate

	frappe.whitelist = whitelist
	frappe.session = SimpleNamespace(user="user@example.com")
	frappe.get_roles = lambda user: ["HWERP Calculation User"]
	frappe.sessions = SimpleNamespace(get_csrf_token=lambda: "csrf-token")
	monkeypatch.setitem(sys.modules, "frappe", frappe)
	sys.modules.pop("hwerp.api.v1.calculations", None)
	return importlib.import_module("hwerp.api.v1.calculations"), frappe


def test_session_context_is_safe_get_and_supplies_same_session_csrf(monkeypatch) -> None:
	api, _ = load_api(monkeypatch)

	result = api.session_context()

	assert api.session_context.allowed_methods == ["GET"]
	assert result == {
		"user": "user@example.com",
		"roles": ["HWERP Calculation User"],
		"price_level": "C",
		"csrf_token": "csrf-token",
	}


def test_transfer_endpoint_is_post_only_and_uses_idempotency_service(monkeypatch) -> None:
	api, frappe = load_api(monkeypatch)
	captured = {}

	class Gateway:
		def __init__(self, frappe_module):
			assert frappe_module is frappe

	def transfer(gateway, calculation_name, idempotency_key):
		captured.update(name=calculation_name, key=idempotency_key)
		return {"quotation": "QTN-1"}

	monkeypatch.setattr(api, "FrappeQuotationGateway", Gateway)
	monkeypatch.setattr(api, "transfer_with_gateway", transfer)

	assert api.transfer("KALK-1", "request-1") == {"quotation": "QTN-1"}
	assert api.transfer.allowed_methods == ["POST"]
	assert captured == {"name": "KALK-1", "key": "request-1"}


def test_get_enforces_record_permission_and_uses_role_aware_wire_presenter(monkeypatch) -> None:
	api, frappe = load_api(monkeypatch)
	raw = {
		"name": "KALK-1",
		"price_group": "Standard",
		"cost_total": 100,
	}
	doc = SimpleNamespace(as_dict=lambda: raw)
	frappe.get_doc = lambda doctype, name: doc
	frappe.has_permission = lambda doctype, ptype, doc, user: True
	frappe.db = SimpleNamespace(
		get_value=lambda doctype, name, fieldname: "Aufschlag auf Kostenbasis"
	)
	captured = {}
	monkeypatch.setattr(
		api,
		"present_calculation",
		lambda document, **kwargs: captured.update(document=document, **kwargs) or {"safe": True},
	)

	assert api.get("KALK-1") == {"safe": True}
	assert api.get.allowed_methods == ["GET"]
	assert captured == {
		"document": raw,
		"roles": {"HWERP Calculation User"},
		"current_user": "user@example.com",
		"margin_method": "Aufschlag auf Kostenbasis",
	}

	frappe.has_permission = lambda *args, **kwargs: False
	with __import__("pytest").raises(PermissionError):
		api.get("KALK-1")


def test_list_uses_permission_aware_frappe_get_list_and_safe_fields(monkeypatch) -> None:
	api, frappe = load_api(monkeypatch)
	captured = {}

	def get_list(doctype, **kwargs):
		captured.update(doctype=doctype, **kwargs)
		return [{"name": "KALK-1", "title": "Trafo"}]

	frappe.get_list = get_list
	assert api.list_calculations() == [{"name": "KALK-1", "title": "Trafo"}]
	assert api.list_calculations.allowed_methods == ["GET"]
	assert captured["doctype"] == "HWERP Kalkulation"
	assert "cost_total" not in captured["fields"]
	assert "net_selling_amount" not in captured["fields"]


def test_save_is_post_only_and_uses_if_match_conflict_token(monkeypatch) -> None:
	api, frappe = load_api(monkeypatch)
	frappe.get_request_header = lambda name: "v1" if name == "If-Match" else None
	captured = {}

	class Gateway:
		def __init__(self, frappe_module):
			assert frappe_module is frappe

	def save_service(gateway, payload, *, expected_modified):
		captured.update(payload=payload, expected_modified=expected_modified)
		return {"name": "KALK-1", "price_group": "Standard", "modified": "v2"}

	monkeypatch.setattr(api, "FrappeQuotationGateway", Gateway)
	monkeypatch.setattr(api, "save_with_gateway", save_service)
	frappe.db = SimpleNamespace(
		get_value=lambda doctype, name, fieldname: "Aufschlag auf Kostenbasis"
	)
	monkeypatch.setattr(
		api,
		"present_calculation",
		lambda document, **kwargs: {"document": document, "context": kwargs},
	)

	result = api.save({"name": "KALK-1", "title": "Neu"})

	assert result["document"]["modified"] == "v2"
	assert result["context"]["roles"] == {"HWERP Calculation User"}
	assert api.save.allowed_methods == ["POST"]
	assert captured == {
		"payload": {"name": "KALK-1", "title": "Neu"},
		"expected_modified": "v1",
	}


def test_approve_and_cancel_are_post_only_controlled_status_actions(monkeypatch) -> None:
	api, frappe = load_api(monkeypatch)
	frappe.get_request_header = lambda name: "v1" if name == "If-Match" else None
	calls = []
	monkeypatch.setattr(
		api,
		"change_status_with_gateway",
		lambda gateway, name, status, expected_modified: calls.append(
			(name, status, expected_modified)
		) or {"name": name, "status": status},
	)

	assert api.approve("KALK-1")["status"] == "Freigegeben"
	assert api.cancel("KALK-1")["status"] == "Storniert"
	assert api.approve.allowed_methods == ["POST"]
	assert api.cancel.allowed_methods == ["POST"]
	assert calls == [
		("KALK-1", "Freigegeben", "v1"),
		("KALK-1", "Storniert", "v1"),
	]


def test_internal_pdf_is_a_permission_checked_get_download(monkeypatch) -> None:
	api, frappe = load_api(monkeypatch)
	frappe.local = SimpleNamespace(response={})
	monkeypatch.setattr(
		api,
		"generate_internal_calculation_pdf",
		lambda frappe_module, name: ("KALK-1-intern.pdf", b"pdf-bytes"),
	)

	api.internal_pdf("KALK-1")

	assert api.internal_pdf.allowed_methods == ["GET"]
	assert frappe.local.response == {
		"filename": "KALK-1-intern.pdf",
		"filecontent": b"pdf-bytes",
		"type": "download",
		"display_content_as": "attachment",
	}
