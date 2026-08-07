from __future__ import annotations

from decimal import Decimal

import pytest

from hwerp.integrations.procurement import (
	ProcurementLinkError,
	SOURCE_LINK_DOCTYPE,
	SourceLine,
	allocated_net_amount,
	summarize_external_service_links,
)


def test_integration_targets_the_versioned_hwerp_link_doctype() -> None:
	assert SOURCE_LINK_DOCTYPE == "HWERP Fremdleistungsverknuepfung"


def line(**overrides) -> SourceLine:
	values = {
		"doctype": "Purchase Order",
		"docstatus": 1,
		"company": "HTV GmbH",
		"currency": "EUR",
		"net_amount": Decimal("1000.00"),
		"is_return": False,
	}
	values.update(overrides)
	return SourceLine(**values)


def test_only_submitted_same_company_base_currency_documents_count() -> None:
	assert allocated_net_amount(line(), Decimal("400"), company="HTV GmbH", currency="EUR") == Decimal("400")
	assert allocated_net_amount(line(docstatus=0), Decimal("400"), company="HTV GmbH", currency="EUR") == 0
	assert allocated_net_amount(line(docstatus=2), Decimal("400"), company="HTV GmbH", currency="EUR") == 0

	with pytest.raises(ProcurementLinkError, match="Company"):
		allocated_net_amount(line(company="Andere GmbH"), Decimal("400"), company="HTV GmbH", currency="EUR")
	with pytest.raises(ProcurementLinkError, match="Währung"):
		allocated_net_amount(line(currency="USD"), Decimal("400"), company="HTV GmbH", currency="EUR")


def test_purchase_invoice_returns_and_credits_are_excluded() -> None:
	credit = line(doctype="Purchase Invoice", is_return=True, net_amount=Decimal("-200"))
	assert allocated_net_amount(credit, Decimal("200"), company="HTV GmbH", currency="EUR") == 0


def test_allocation_cannot_exceed_source_line_net_amount() -> None:
	with pytest.raises(ProcurementLinkError, match="Quellnettobetrag"):
		allocated_net_amount(line(net_amount=Decimal("100")), Decimal("100.01"), company="HTV GmbH", currency="EUR")


def test_summary_keeps_quoted_ordered_and_invoiced_values_separate() -> None:
	links = [
		(line(doctype="Supplier Quotation"), Decimal("300")),
		(line(doctype="Purchase Order"), Decimal("280")),
		(line(doctype="Purchase Invoice"), Decimal("290")),
		(line(doctype="Purchase Invoice", is_return=True), Decimal("10")),
	]

	assert summarize_external_service_links(links, company="HTV GmbH", currency="EUR") == {
		"quoted_net": Decimal("300"),
		"ordered_net": Decimal("280"),
		"invoiced_net": Decimal("290"),
	}


def test_unknown_source_doctype_is_rejected() -> None:
	with pytest.raises(ProcurementLinkError, match="Belegart"):
		allocated_net_amount(line(doctype="Expense Claim"), Decimal("20"), company="HTV GmbH", currency="EUR")
