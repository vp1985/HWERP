from __future__ import annotations

from typing import Any, Protocol

from hwerp.integrations.quotation import (
	build_quotation_payload,
	build_transfer_snapshot,
	calculation_doc_to_transfer_mapping,
)
from hwerp.permissions import Action, can


class QuotationTransferGateway(Protocol):
	roles: set[str]

	def current_user(self) -> str: ...

	def has_calculation_permission(self, name: str) -> bool: ...

	def get_calculation(self, name: str) -> dict[str, Any]: ...

	def get_selling_price_list(self, price_group: str) -> str: ...

	def find_quotation_by_key(self, key: str) -> str | None: ...

	def create_quotation(self, payload: dict[str, Any]) -> dict[str, Any]: ...

	def create_transfer_record(
		self,
		calculation: dict[str, Any],
		quotation: dict[str, Any],
		snapshot: dict[str, Any],
	) -> str: ...


def transfer_with_gateway(
	gateway: QuotationTransferGateway,
	calculation_name: str,
	idempotency_key: str,
) -> dict[str, Any]:
	"""Transfer one approved calculation exactly once.

	All record access remains in the gateway so the Frappe adapter can enforce
	DocType and participant permissions server-side.
	"""
	if not can(Action.TRANSFER_QUOTATION, gateway.roles):
		raise PermissionError("Keine Berechtigung zur Angebotsübertragung")
	if not gateway.has_calculation_permission(calculation_name):
		raise PermissionError("Kein Zugriff auf die Kalkulation")

	existing = gateway.find_quotation_by_key(idempotency_key)
	if existing:
		return {"quotation": existing, "idempotent_replay": True}

	calculation_doc = gateway.get_calculation(calculation_name)
	price_list = gateway.get_selling_price_list(calculation_doc["price_group"])
	calculation = calculation_doc_to_transfer_mapping(
		calculation_doc,
		selling_price_list=price_list,
	)
	quotation_payload = build_quotation_payload(calculation, transfer_key=idempotency_key)
	snapshot = build_transfer_snapshot(calculation, transfer_key=idempotency_key)
	quotation = gateway.create_quotation(quotation_payload)
	transfer_name = gateway.create_transfer_record(calculation_doc, quotation, snapshot)
	return {
		"quotation": quotation["name"],
		"transfer": transfer_name,
		"idempotent_replay": False,
	}
