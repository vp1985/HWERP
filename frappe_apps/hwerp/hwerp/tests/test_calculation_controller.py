from __future__ import annotations

import importlib
from types import ModuleType, SimpleNamespace
import sys

import pytest


def load_controller(monkeypatch):
	frappe = ModuleType("frappe")
	frappe.db = SimpleNamespace(
		get_value=lambda doctype, name, fieldname: (
			"EUR" if (doctype, fieldname) == ("Company", "default_currency") else None
		)
	)
	frappe.get_cached_doc = lambda doctype, name: SimpleNamespace(
		name=name,
		margin_method="Aufschlag auf Kostenbasis",
	)
	frappe.throw = lambda message: (_ for _ in ()).throw(ValueError(message))

	class Document:
		flags = SimpleNamespace()

	document_module = ModuleType("frappe.model.document")
	document_module.Document = Document
	model_module = ModuleType("frappe.model")
	model_module.document = document_module
	frappe.model = model_module
	monkeypatch.setitem(sys.modules, "frappe", frappe)
	monkeypatch.setitem(sys.modules, "frappe.model", model_module)
	monkeypatch.setitem(sys.modules, "frappe.model.document", document_module)
	module_name = "hwerp.hwerp.doctype.hwerp_kalkulation.hwerp_kalkulation"
	sys.modules.pop(module_name, None)
	return importlib.import_module(module_name), frappe


def calculation(controller):
	doc = controller.HWERPKalkulation()
	doc.company = "HWERP GmbH"
	doc.currency = None
	doc.price_group = "Standard"
	doc.status = "Entwurf"
	doc.positions = []
	doc.main_objects = []
	doc.get_doc_before_save = lambda: None
	doc.flags = SimpleNamespace()
	return doc


def test_validate_derives_company_currency_and_applies_server_calculation(monkeypatch) -> None:
	controller, _frappe = load_controller(monkeypatch)
	doc = calculation(controller)
	seen = []
	monkeypatch.setattr(controller, "apply_calculation_values", lambda target, group: seen.append((target, group.name)))

	doc.validate()

	assert doc.currency == "EUR"
	assert seen == [(doc, "Standard")]


def test_direct_status_change_without_controlled_api_flag_is_rejected(monkeypatch) -> None:
	controller, _frappe = load_controller(monkeypatch)
	doc = calculation(controller)
	doc.status = "Freigegeben"
	doc.get_doc_before_save = lambda: SimpleNamespace(status="Entwurf")
	monkeypatch.setattr(controller, "apply_calculation_values", lambda *_args: None)

	with pytest.raises(ValueError, match="Statuswechsel"):
		doc.validate()


def test_approval_is_blocked_when_a_price_effective_position_has_no_rate(monkeypatch) -> None:
	controller, _frappe = load_controller(monkeypatch)
	doc = calculation(controller)
	doc.status = "Freigegeben"
	doc.positions = [SimpleNamespace(position_type="Material", effective_rate=None)]
	monkeypatch.setattr(controller, "apply_calculation_values", lambda *_args: None)

	with pytest.raises(ValueError, match="wirksamer Verkaufspreis"):
		doc.validate()
