import json

from hwerp.api.presentation import present_calculation


RAW = {
	"name": "HWERP-KALK-2026-00001",
	"company": "HWERP GmbH",
	"customer": "CUST-1",
	"project": None,
	"price_group": "Standard",
	"responsible_user": "owner@example.com",
	"status": "Entwurf",
	"currency": "EUR",
	"notes": "Montage",
	"internal_notes": "Intern",
	"modified": "2026-08-07 10:00:00",
	"risk_percent": "5",
	"target_margin": "20",
	"cost_total": "10000.00",
	"risk_amount": "500.00",
	"minimum_selling_price": "10500.00",
	"target_selling_price": "12600.00",
	"gross_selling_amount": "13000.00",
	"discount_amount": "1300.00",
	"net_selling_amount": "11700.00",
	"partial_margin_amount": "1200.00",
	"has_missing_labor_cost": 1,
	"main_objects": [
		{
			"object_id": "OBJ-1",
			"object_type": "Kundenasset",
			"asset": "ASSET-1",
			"description": "Trafo",
			"sort_order": 10,
		}
	],
	"positions": [
		{
			"position_id": "POS-1",
			"position_type": "Material",
			"main_object_id": "OBJ-1",
			"description": "Kabelsatz",
			"item": "ITEM-1",
			"quantity": "2",
			"uom": "Stk",
			"idx": 1,
			"internal_cost_amount": "10000.00",
			"price_list_rate": "6500.00",
			"pricing_rule_rate": None,
			"effective_rate": "6500.00",
			"line_amount": "13000.00",
			"selected_price_source": "Preislistenpreis",
		}
	],
}


def test_price_hidden_presentation_uses_wire_whitelist_without_protected_values() -> None:
	presented = present_calculation(
		RAW,
		roles={"HWERP Calculation User"},
		current_user="owner@example.com",
		margin_method="Aufschlag auf Kostenbasis",
	)

	assert presented["permissions"]["price_access"] == "hidden"
	assert presented["calculation"]["status"] == "draft"
	assert presented["calculation"]["lines"][0]["description"] == "Kabelsatz"
	serialized = json.dumps(presented)
	for protected in ("10000.00", "6500.00", "13000.00", "1200.00"):
		assert protected not in serialized


def test_price_authorized_presentation_keeps_decimal_strings_in_pricing_sections() -> None:
	presented = present_calculation(
		RAW,
		roles={"HWERP Price User"},
		current_user="owner@example.com",
		margin_method="Aufschlag auf Kostenbasis",
	)

	assert presented["permissions"]["price_access"] == "edit"
	assert presented["pricing"]["cost_base"] == "10000.00"
	assert presented["calculation"]["lines"][0]["pricing"] == {
		"internal_cost_amount": "10000.00",
		"price_list_rate": "6500.00",
		"pricing_rule_rate": None,
		"effective_unit_price": "6500.00",
		"rounded_net_amount": "13000.00",
		"price_source": "price_list",
	}
