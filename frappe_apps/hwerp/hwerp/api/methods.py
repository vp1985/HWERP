from __future__ import annotations

import frappe

from hwerp.api.frappe_gateway import FrappeQuotationGateway
from hwerp.api.quotation import transfer_with_gateway


@frappe.whitelist(methods=["POST"])
def transfer_calculation(calculation_name: str, idempotency_key: str) -> dict:
	"""Create one ERPNext Quotation from an approved HWERP calculation."""
	return transfer_with_gateway(
		FrappeQuotationGateway(frappe),
		calculation_name,
		idempotency_key,
	)
