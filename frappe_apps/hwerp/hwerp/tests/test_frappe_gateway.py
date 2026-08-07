from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from hwerp.api.frappe_gateway import FrappeQuotationGateway


class FakeDb:
	def get_value(self, doctype: str, filters: Any, fieldname: str) -> Any:
		if doctype == "HWERP Kalkulationspreisgruppe":
			return "Standardverkauf"
		if doctype == "Quotation" and filters == {"custom_hwerp_transfer_key": "request-1"}:
			return "QTN-0001"
		return None


class FakeDocument:
	def __init__(self, payload: dict[str, Any]) -> None:
		self.payload = payload
		self.flags = SimpleNamespace()
		self.name = payload.get("name", "QTN-NEW")
		self.status = payload.get("status", "Draft")
		self.items = [SimpleNamespace(name=f"QI-{index}") for index, _ in enumerate(payload.get("items", []), 1)]

	def insert(self, **kwargs: Any) -> "FakeDocument":
		self.insert_kwargs = kwargs
		return self

	def set(self, fieldname: str, value: Any) -> None:
		self.payload[fieldname] = value

	def save(self, **kwargs: Any) -> "FakeDocument":
		self.save_kwargs = kwargs
		self.payload["modified"] = "v2"
		return self

	def as_dict(self) -> dict[str, Any]:
		return dict(self.payload)


class FakeFrappe:
	def __init__(self) -> None:
		self.session = SimpleNamespace(user="user@example.com")
		self.db = FakeDb()
		self.created: list[FakeDocument] = []
		self.loaded: list[FakeDocument] = []

	def get_roles(self, user: str) -> list[str]:
		assert user == self.session.user
		return ["HWERP Quotation Transfer"]

	def has_permission(self, doctype: str, ptype: str, doc: str, user: str) -> bool:
		return (doctype, ptype, doc, user) == (
			"HWERP Kalkulation",
			"read",
			"HWERP-KALK-2026-00001",
			"user@example.com",
		)

	def get_doc(self, payload_or_doctype: Any, name: str | None = None) -> FakeDocument:
		if isinstance(payload_or_doctype, dict):
			doc = FakeDocument(payload_or_doctype)
			self.created.append(doc)
			return doc
		assert payload_or_doctype == "HWERP Kalkulation"
		doc = FakeDocument({"name": name, "price_group": "STANDARD", "positions": []})
		self.loaded.append(doc)
		return doc


def test_gateway_uses_current_frappe_user_roles_and_record_permission() -> None:
	gateway = FrappeQuotationGateway(FakeFrappe())
	assert gateway.roles == {"HWERP Quotation Transfer"}
	assert gateway.current_user() == "user@example.com"
	assert gateway.has_calculation_permission("HWERP-KALK-2026-00001")


def test_gateway_resolves_standard_price_list_and_idempotency_key() -> None:
	gateway = FrappeQuotationGateway(FakeFrappe())
	assert gateway.get_selling_price_list("STANDARD") == "Standardverkauf"
	assert gateway.find_quotation_by_key("request-1") == "QTN-0001"


def test_gateway_creates_standard_quotation_without_bypassing_erpnext_permission() -> None:
	frappe = FakeFrappe()
	gateway = FrappeQuotationGateway(frappe)
	created = gateway.create_quotation({"doctype": "Quotation", "items": [{"description": "Test"}]})

	assert created == {"name": "QTN-NEW", "status": "Draft", "items": [{"name": "QI-1"}]}
	assert frappe.created[0].insert_kwargs == {}


def test_gateway_saves_one_complete_calculation_document_with_standard_permission() -> None:
	frappe = FakeFrappe()
	gateway = FrappeQuotationGateway(frappe)
	result = gateway.save_calculation_bundle(
		{"name": "KALK-1"},
		{
			"name": "KALK-1",
			"title": "Neu",
			"company": "HTV GmbH",
			"customer": "KUNDE-1",
			"positions": [{"position_id": "POS-1"}],
			"participants": [],
			"main_objects": [],
		},
	)

	assert result["title"] == "Neu"
	assert result["positions"] == [{"position_id": "POS-1"}]
	assert result["modified"] == "v2"


def test_gateway_marks_controlled_status_change_before_standard_save() -> None:
	frappe = FakeFrappe()
	gateway = FrappeQuotationGateway(frappe)

	result = gateway.set_calculation_status(
		{"name": "KALK-1", "status": "Entwurf"},
		"Freigegeben",
	)

	assert result["status"] == "Freigegeben"
	assert frappe.loaded[-1].flags.hwerp_status_change is True
	assert frappe.loaded[-1].save_kwargs == {}
