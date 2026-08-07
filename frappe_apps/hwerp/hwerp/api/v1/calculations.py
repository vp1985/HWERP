from __future__ import annotations

import json

import frappe

from hwerp.api.calculation_service import (
	CalculationConflictError,
	change_status_with_gateway,
	save_with_gateway,
)
from hwerp.api.frappe_gateway import FrappeQuotationGateway
from hwerp.api.pdf import generate_internal_calculation_pdf
from hwerp.api.presentation import present_calculation
from hwerp.api.quotation import transfer_with_gateway
from hwerp.permissions import PriceLevel, price_level_for_roles, redact_price_data


_SAFE_LIST_FIELDS = [
	"name",
	"title",
	"company",
	"customer",
	"project",
	"responsible_user",
	"status",
	"currency",
	"version_no",
	"modified",
]

_PROTECTED_LIST_FIELDS = [
	"cost_total",
	"risk_amount",
	"minimum_selling_price",
	"target_selling_price",
	"gross_selling_amount",
	"net_selling_amount",
	"partial_margin_amount",
]


def _roles() -> list[str]:
	return list(frappe.get_roles(frappe.session.user))


@frappe.whitelist(methods=["GET"])
def session_context() -> dict:
	"""Return only the active Frappe security context required by the SPA."""
	user = frappe.session.user
	roles = _roles()
	role_set = set(roles)
	return {
		"user": user,
		"roles": roles,
		"price_level": price_level_for_roles(role_set).value,
		"csrf_token": frappe.sessions.get_csrf_token(),
	}


@frappe.whitelist(methods=["GET"])
def get(name: str) -> dict:
	doc = frappe.get_doc("HWERP Kalkulation", name)
	if not frappe.has_permission(
		"HWERP Kalkulation",
		"read",
		doc=doc,
		user=frappe.session.user,
	):
		raise getattr(frappe, "PermissionError", PermissionError)("Kein Zugriff auf die Kalkulation")
	document = doc.as_dict()
	margin_method = frappe.db.get_value(
		"HWERP Kalkulationspreisgruppe",
		document["price_group"],
		"margin_method",
	)
	return present_calculation(
		document,
		roles=set(_roles()),
		current_user=frappe.session.user,
		margin_method=margin_method,
	)


@frappe.whitelist(methods=["GET"])
def list_calculations(limit: int = 100) -> list[dict]:
	level = price_level_for_roles(set(_roles()))
	fields = list(_SAFE_LIST_FIELDS)
	if level in {PriceLevel.A, PriceLevel.B}:
		fields.extend(_PROTECTED_LIST_FIELDS)
	return frappe.get_list(
		"HWERP Kalkulation",
		fields=fields,
		order_by="modified desc",
		limit_page_length=min(max(int(limit), 1), 500),
	)


@frappe.whitelist(methods=["POST"])
def save(calculation: dict | str, expected_modified: str | None = None) -> dict:
	payload = json.loads(calculation) if isinstance(calculation, str) else calculation
	conflict_token = expected_modified or getattr(
		frappe,
		"get_request_header",
		lambda _name: None,
	)("If-Match")
	try:
		result = save_with_gateway(
			FrappeQuotationGateway(frappe),
			payload,
			expected_modified=conflict_token,
		)
	except CalculationConflictError as exc:
		if hasattr(frappe, "local"):
			frappe.local.response["http_status_code"] = 409
		error_type = getattr(frappe, "TimestampMismatchError", CalculationConflictError)
		raise error_type(str(exc)) from exc
	margin_method = frappe.db.get_value(
		"HWERP Kalkulationspreisgruppe",
		result["price_group"],
		"margin_method",
	)
	return present_calculation(
		result,
		roles=set(_roles()),
		current_user=frappe.session.user,
		margin_method=margin_method,
	)


def _status_change(calculation_name: str, status: str) -> dict:
	conflict_token = getattr(frappe, "get_request_header", lambda _name: None)("If-Match")
	try:
		return change_status_with_gateway(
			FrappeQuotationGateway(frappe),
			calculation_name,
			status,
			expected_modified=conflict_token,
		)
	except CalculationConflictError as exc:
		if hasattr(frappe, "local"):
			frappe.local.response["http_status_code"] = 409
		error_type = getattr(frappe, "TimestampMismatchError", CalculationConflictError)
		raise error_type(str(exc)) from exc


@frappe.whitelist(methods=["POST"])
def approve(calculation_name: str) -> dict:
	return _status_change(calculation_name, "Freigegeben")


@frappe.whitelist(methods=["POST"])
def cancel(calculation_name: str) -> dict:
	return _status_change(calculation_name, "Storniert")


@frappe.whitelist(methods=["GET"])
def internal_pdf(calculation_name: str) -> None:
	filename, content = generate_internal_calculation_pdf(frappe, calculation_name)
	frappe.local.response.update(
		{
			"filename": filename,
			"filecontent": content,
			"type": "download",
			"display_content_as": "attachment",
		}
	)


@frappe.whitelist(methods=["POST"])
def transfer(calculation_name: str, idempotency_key: str) -> dict:
	return transfer_with_gateway(
		FrappeQuotationGateway(frappe),
		calculation_name,
		idempotency_key,
	)
