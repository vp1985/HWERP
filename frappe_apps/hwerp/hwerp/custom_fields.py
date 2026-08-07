from __future__ import annotations

from copy import deepcopy
from typing import Any


_CUSTOM_FIELDS: dict[str, list[dict[str, Any]]] = {
	"Quotation": [
		{
			"fieldname": "custom_hwerp_calculation",
			"label": "HWERP Kalkulation",
			"fieldtype": "Link",
			"options": "HWERP Kalkulation",
			"insert_after": "company",
			"read_only": 1,
			"no_copy": 1,
			"search_index": 1,
		},
		{
			"fieldname": "custom_hwerp_transfer_key",
			"label": "HWERP Übertragungsschlüssel",
			"fieldtype": "Data",
			"insert_after": "custom_hwerp_calculation",
			"read_only": 1,
			"no_copy": 1,
			"unique": 1,
			"hidden": 1,
		},
		{
			"fieldname": "custom_hwerp_changed_after_sending",
			"label": "Nach Versand geändert",
			"fieldtype": "Check",
			"insert_after": "custom_hwerp_transfer_key",
			"read_only": 1,
			"no_copy": 1,
			"default": "0",
		},
	],
	"Quotation Item": [
		{
			"fieldname": "custom_hwerp_source_calculation",
			"label": "HWERP Quellkalkulation",
			"fieldtype": "Link",
			"options": "HWERP Kalkulation",
			"insert_after": "description",
			"read_only": 1,
			"no_copy": 1,
			"search_index": 1,
		},
		{
			"fieldname": "custom_hwerp_source_position",
			"label": "HWERP Quellposition",
			"fieldtype": "Data",
			"insert_after": "custom_hwerp_source_calculation",
			"read_only": 1,
			"no_copy": 1,
			"search_index": 1,
		},
		{
			"fieldname": "custom_hwerp_transfer_snapshot_hash",
			"label": "HWERP Snapshot-Prüfsumme",
			"fieldtype": "Data",
			"insert_after": "custom_hwerp_source_position",
			"read_only": 1,
			"no_copy": 1,
			"hidden": 1,
		},
	],
}


def get_custom_fields() -> dict[str, list[dict[str, Any]]]:
	"""Return an isolated copy so callers cannot mutate the installation contract."""
	return deepcopy(_CUSTOM_FIELDS)


def setup_custom_fields() -> None:
	"""Create or update HWERP metadata without patching ERPNext core."""
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(get_custom_fields(), update=True)
