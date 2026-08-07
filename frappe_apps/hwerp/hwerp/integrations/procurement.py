from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterable


ALLOWED_SOURCE_DOCTYPES = frozenset({"Supplier Quotation", "Purchase Order", "Purchase Invoice"})
SOURCE_LINK_DOCTYPE = "HWERP Fremdleistungsverknuepfung"

_SOURCE_DOCUMENT_FIELDS = {
	"Supplier Quotation": "supplier_quotation",
	"Purchase Order": "purchase_order",
	"Purchase Invoice": "purchase_invoice",
}


class ProcurementLinkError(ValueError):
	pass


@dataclass(frozen=True, slots=True)
class SourceLine:
	doctype: str
	docstatus: int
	company: str
	currency: str
	net_amount: Decimal
	is_return: bool = False


def allocated_net_amount(
	source: SourceLine,
	allocated: Decimal,
	*,
	company: str,
	currency: str,
) -> Decimal:
	if source.doctype not in ALLOWED_SOURCE_DOCTYPES:
		raise ProcurementLinkError("Nicht unterstützte Belegart")
	if source.company != company:
		raise ProcurementLinkError("Beleg und Kalkulation gehören nicht derselben Company an")
	if source.currency != currency:
		raise ProcurementLinkError("Währung des Belegs entspricht nicht der Basiswährung der Kalkulation")
	if allocated < 0:
		raise ProcurementLinkError("Der Zuordnungsbetrag darf nicht negativ sein")
	if source.doctype == "Purchase Invoice" and source.is_return:
		return Decimal("0")
	if source.docstatus != 1:
		return Decimal("0")
	if source.net_amount < 0 or allocated > source.net_amount:
		raise ProcurementLinkError("Zuordnung überschreitet den Quellnettobetrag")
	return allocated


def summarize_external_service_links(
	links: Iterable[tuple[SourceLine, Decimal]],
	*,
	company: str,
	currency: str,
) -> dict[str, Decimal]:
	result = {
		"quoted_net": Decimal("0"),
		"ordered_net": Decimal("0"),
		"invoiced_net": Decimal("0"),
	}
	keys = {
		"Supplier Quotation": "quoted_net",
		"Purchase Order": "ordered_net",
		"Purchase Invoice": "invoiced_net",
	}
	for source, allocated in links:
		value = allocated_net_amount(source, allocated, company=company, currency=currency)
		result[keys[source.doctype]] += value
	return result


def on_source_document_changed(doc: Any, method: str | None = None) -> None:
	"""Refresh link snapshots only; never rewrite a calculation or quotation."""
	import frappe
	from frappe.utils import flt

	source_document_field = _SOURCE_DOCUMENT_FIELDS.get(doc.doctype)
	if source_document_field is None:
		return
	link_names = frappe.get_all(
		SOURCE_LINK_DOCTYPE,
		filters={source_document_field: doc.name, "source_type": doc.doctype},
		pluck="name",
	)
	if not link_names:
		return

	rows = {row.name: row for row in getattr(doc, "items", [])}
	for link_name in link_names:
		link = frappe.get_doc(SOURCE_LINK_DOCTYPE, link_name)
		source_row = rows.get(link.source_row_id)
		if source_row is None:
			link.db_set(
				{
					"source_docstatus": doc.docstatus,
					"active": 0,
					"source_status": "Source row missing",
				},
				update_modified=True,
			)
			continue

		source_net = Decimal(str(flt(getattr(source_row, "net_amount", 0))))
		source = SourceLine(
			doctype=doc.doctype,
			docstatus=int(doc.docstatus),
			company=doc.company,
			currency=doc.currency,
			net_amount=source_net,
			is_return=bool(getattr(doc, "is_return", 0)),
		)
		active = allocated_net_amount(
			source,
			Decimal(str(link.allocated_net_amount)),
			company=link.company,
			currency=link.currency,
		)
		link.db_set(
			{
				"source_docstatus": doc.docstatus,
				"source_net_amount": source_net,
				"active": int(active != 0),
				"source_status": "Submitted" if doc.docstatus == 1 else "Inactive",
			},
			update_modified=True,
		)
