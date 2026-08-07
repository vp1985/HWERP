from __future__ import annotations

from collections.abc import Callable
from typing import Any

from hwerp.api.presentation import present_calculation


def generate_internal_calculation_pdf(
	frappe_module: Any,
	calculation_name: str,
	*,
	pdf_renderer: Callable[[str], bytes] | None = None,
) -> tuple[str, bytes]:
	user = frappe_module.session.user
	doc = frappe_module.get_doc("HWERP Kalkulation", calculation_name)
	if not frappe_module.has_permission(
		"HWERP Kalkulation",
		"read",
		doc=doc,
		user=user,
	):
		raise getattr(frappe_module, "PermissionError", PermissionError)(
			"Kein Zugriff auf die Kalkulation"
		)
	document = doc.as_dict()
	margin_method = frappe_module.db.get_value(
		"HWERP Kalkulationspreisgruppe",
		document["price_group"],
		"margin_method",
	)
	view = present_calculation(
		document,
		roles=set(frappe_module.get_roles(user)),
		current_user=user,
		margin_method=margin_method,
	)
	html = frappe_module.render_template(
		"hwerp/templates/print_formats/internal_calculation.html",
		{"view": view},
	)
	if pdf_renderer is None:
		from frappe.utils.pdf import get_pdf

		pdf_renderer = get_pdf
	return f"{calculation_name}-interne-kalkulation.pdf", pdf_renderer(html)
