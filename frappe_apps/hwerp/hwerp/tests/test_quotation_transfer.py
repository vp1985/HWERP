from __future__ import annotations

from decimal import Decimal

import pytest

from hwerp.integrations.quotation import (
	SubmittedQuotationChangeError,
	TransferValidationError,
	build_quotation_payload,
	build_transfer_snapshot,
	calculation_doc_to_transfer_mapping,
	validate_submitted_quotation_change,
)


def approved_calculation() -> dict:
	return {
		"name": "KALK-0001",
		"status": "Freigegeben",
		"company": "HTV GmbH",
		"customer": "KUNDE-0001",
		"currency": "EUR",
		"selling_price_list": "Standardverkauf",
		"modified": "2026-08-07 12:00:00.000000",
		"items": [
			{
				"name": "POS-1",
				"item_code": "MAT-1",
				"description": "Material",
				"qty": "2",
				"uom": "Stk",
				"rate": "100.00",
			},
			{
				"name": "POS-2",
				"item_code": None,
				"description": "Freie Serviceleistung",
				"qty": "1.5",
				"uom": "Std",
				"rate": "80.00",
			},
		],
	}


def test_only_approved_calculation_can_be_transferred() -> None:
	calculation = approved_calculation()
	calculation["status"] = "Entwurf"

	with pytest.raises(TransferValidationError, match="freigegeben"):
		build_quotation_payload(calculation, transfer_key="request-1")


def test_payload_uses_same_customer_company_currency_and_exact_line_sum() -> None:
	payload = build_quotation_payload(approved_calculation(), transfer_key="request-1")

	assert payload["doctype"] == "Quotation"
	assert payload["quotation_to"] == "Customer"
	assert payload["party_name"] == "KUNDE-0001"
	assert payload["company"] == "HTV GmbH"
	assert payload["currency"] == "EUR"
	assert payload["custom_hwerp_calculation"] == "KALK-0001"
	assert payload["custom_hwerp_transfer_key"] == "request-1"
	assert sum(Decimal(row["amount"]) for row in payload["items"]) == Decimal("320.00")
	assert "grand_total" not in payload


def test_itemless_quotation_line_contains_required_erpnext_fields() -> None:
	payload = build_quotation_payload(approved_calculation(), transfer_key="request-1")
	free_text = payload["items"][1]

	assert "item_code" not in free_text
	assert free_text["item_name"] == "Freie Serviceleistung"
	assert free_text["description"] == "Freie Serviceleistung"
	assert free_text["qty"] == "1.5"
	assert free_text["uom"] == "Std"
	assert free_text["conversion_factor"] == "1"


def test_transfer_snapshot_is_deterministic_and_preserves_source_after_unlink() -> None:
	first = build_transfer_snapshot(approved_calculation(), transfer_key="request-1")
	second = build_transfer_snapshot(approved_calculation(), transfer_key="request-1")

	assert first == second
	assert first["source_calculation"] == "KALK-0001"
	assert first["source_modified"] == "2026-08-07 12:00:00.000000"
	assert first["snapshot_hash"]
	assert first["snapshot_json"]

	changed = approved_calculation()
	changed["items"][0]["rate"] = "101.00"
	assert build_transfer_snapshot(changed, transfer_key="request-1")["snapshot_hash"] != first["snapshot_hash"]


def test_transfer_rejects_missing_customer_company_or_key() -> None:
	for field in ("customer", "company"):
		calculation = approved_calculation()
		calculation[field] = ""
		with pytest.raises(TransferValidationError):
			build_quotation_payload(calculation, transfer_key="request-1")

	with pytest.raises(TransferValidationError, match="Idempotency"):
		build_quotation_payload(approved_calculation(), transfer_key="")


def test_frappe_calculation_schema_is_mapped_without_parallel_master_data() -> None:
	doc = {
		"name": "HWERP-KALK-2026-00001",
		"status": "Freigegeben",
		"company": "HTV GmbH",
		"customer": "KUNDE-0001",
		"currency": "EUR",
		"modified": "2026-08-07 12:00:00.000000",
		"positions": [
			{
				"position_id": "POS-1",
				"item": "MAT-1",
				"description": "Material",
				"quantity": 2,
				"uom": "Stk",
				"effective_rate": 100,
			}
		],
	}

	mapped = calculation_doc_to_transfer_mapping(doc, selling_price_list="Standardverkauf")

	assert mapped["selling_price_list"] == "Standardverkauf"
	assert mapped["items"] == [
		{
			"name": "POS-1",
			"item_code": "MAT-1",
			"description": "Material",
			"qty": 2,
			"uom": "Stk",
			"rate": 100,
		}
	]


def submitted_quotation() -> dict:
	return {
		"name": "QTN-0001",
		"docstatus": 1,
		"modified": "2026-08-07 12:00:00.000000",
		"company": "HTV GmbH",
		"party_name": "KUNDE-0001",
		"currency": "EUR",
		"custom_hwerp_calculation": "KALK-0001",
		"items": [
			{
				"name": "QI-1",
				"item_code": "MAT-1",
				"item_name": "Material",
				"description": "Material",
				"qty": "1",
				"uom": "Stk",
				"rate": "100",
				"custom_hwerp_source_calculation": "KALK-0001",
				"custom_hwerp_source_position": "POS-1",
				"custom_hwerp_transfer_snapshot_hash": "immutable",
			},
		],
	}


def test_submitted_change_requires_confirmation_and_optimistic_lock() -> None:
	before = submitted_quotation()
	after = {**before, "items": [{**before["items"][0], "qty": "2"}]}

	with pytest.raises(SubmittedQuotationChangeError, match="Bestätigung"):
		validate_submitted_quotation_change(before, after, expected_modified=before["modified"], confirmed=False)
	with pytest.raises(SubmittedQuotationChangeError, match="zwischenzeitlich"):
		validate_submitted_quotation_change(before, after, expected_modified="old", confirmed=True)


def test_submitted_change_keeps_identity_and_transfer_provenance_immutable() -> None:
	before = submitted_quotation()
	for field, value in (("company", "Andere GmbH"), ("party_name", "KUNDE-2"), ("currency", "USD")):
		after = {**before, field: value}
		with pytest.raises(SubmittedQuotationChangeError):
			validate_submitted_quotation_change(before, after, expected_modified=before["modified"], confirmed=True)

	row = {**before["items"][0], "custom_hwerp_transfer_snapshot_hash": "tampered"}
	after = {**before, "items": [row]}
	with pytest.raises(SubmittedQuotationChangeError, match="Herkunft"):
		validate_submitted_quotation_change(before, after, expected_modified=before["modified"], confirmed=True)


def test_submitted_change_requires_follow_up_acknowledgement() -> None:
	before = submitted_quotation()
	after = {**before, "items": [{**before["items"][0], "rate": "110"}]}

	with pytest.raises(SubmittedQuotationChangeError, match="Folgebelege"):
		validate_submitted_quotation_change(
			before,
			after,
			expected_modified=before["modified"],
			confirmed=True,
			follow_up_documents=["SO-0001"],
		)

	validated = validate_submitted_quotation_change(
		before,
		after,
		expected_modified=before["modified"],
		confirmed=True,
		follow_up_documents=["SO-0001"],
		follow_ups_acknowledged=True,
	)
	assert validated["items"][0]["rate"] == "110"
	assert before["items"][0]["rate"] == "100"
