from __future__ import annotations

from hwerp.custom_fields import get_custom_fields


def test_custom_fields_keep_erpnext_as_canonical_document_store() -> None:
	fields = get_custom_fields()

	assert set(fields) == {"Quotation", "Quotation Item"}
	assert {field["fieldname"] for field in fields["Quotation"]} == {
		"custom_hwerp_calculation",
		"custom_hwerp_transfer_key",
		"custom_hwerp_changed_after_sending",
	}
	assert {field["fieldname"] for field in fields["Quotation Item"]} == {
		"custom_hwerp_source_calculation",
		"custom_hwerp_source_position",
		"custom_hwerp_transfer_snapshot_hash",
	}


def test_custom_fields_are_read_only_and_not_copied() -> None:
	for doctype_fields in get_custom_fields().values():
		for field in doctype_fields:
			assert field["read_only"] == 1
			assert field["no_copy"] == 1


def test_calculation_reference_targets_hwerp_calculation() -> None:
	quotation_fields = {field["fieldname"]: field for field in get_custom_fields()["Quotation"]}
	calculation = quotation_fields["custom_hwerp_calculation"]

	assert calculation["fieldtype"] == "Link"
	assert calculation["options"] == "HWERP Kalkulation"
	assert calculation["search_index"] == 1


def test_idempotency_key_is_unique() -> None:
	quotation_fields = {field["fieldname"]: field for field in get_custom_fields()["Quotation"]}
	key = quotation_fields["custom_hwerp_transfer_key"]

	assert key["fieldtype"] == "Data"
	assert key["unique"] == 1
