from __future__ import annotations

import importlib
from types import ModuleType
import sys


def load_methods(monkeypatch):
	fake_frappe = ModuleType("frappe")

	def whitelist(*, methods):
		def decorate(function):
			function.allowed_methods = methods
			return function

		return decorate

	fake_frappe.whitelist = whitelist
	monkeypatch.setitem(sys.modules, "frappe", fake_frappe)
	sys.modules.pop("hwerp.api.methods", None)
	return importlib.import_module("hwerp.api.methods"), fake_frappe


def test_transfer_endpoint_is_post_only_and_delegates_to_tested_service(monkeypatch) -> None:
	methods, fake_frappe = load_methods(monkeypatch)
	called = {}

	class FakeGateway:
		def __init__(self, frappe_module):
			assert frappe_module is fake_frappe

	def fake_transfer(gateway, calculation_name, idempotency_key):
		called.update(
			gateway=gateway,
			calculation_name=calculation_name,
			idempotency_key=idempotency_key,
		)
		return {"quotation": "QTN-0001"}

	monkeypatch.setattr(methods, "FrappeQuotationGateway", FakeGateway)
	monkeypatch.setattr(methods, "transfer_with_gateway", fake_transfer)

	assert methods.transfer_calculation("KALK-1", "request-1") == {"quotation": "QTN-0001"}
	assert methods.transfer_calculation.allowed_methods == ["POST"]
	assert called["calculation_name"] == "KALK-1"
	assert called["idempotency_key"] == "request-1"
