from decimal import Decimal

from hwerp.domain.calculation import calculate_document_pricing
from hwerp.domain.pricing import MarginMethod


def test_document_pricing_maps_frappe_percentages_positions_and_totals() -> None:
	result = calculate_document_pricing(
		{
			"risk_percent": "5",
			"target_margin": "20",
			"discount_input_type": "Prozent",
			"discount_percent": "10",
			"discount_amount": "0",
			"positions": [
				{
					"position_id": "P-1",
					"position_type": "Material",
					"quantity": "1",
					"internal_cost_rate": "10000.00",
					"effective_rate": "13000.00",
				}
			],
		},
		margin_method=MarginMethod.MARKUP,
	)

	assert result["positions"]["P-1"] == {
		"internal_cost_amount": Decimal("10000.00"),
		"line_amount": Decimal("13000.00"),
	}
	assert result["cost_total"] == Decimal("10000.00")
	assert result["risk_amount"] == Decimal("500.00")
	assert result["minimum_selling_price"] == Decimal("10500.00")
	assert result["target_selling_price"] == Decimal("12600.00")
	assert result["gross_selling_amount"] == Decimal("13000.00")
	assert result["discount_amount"] == Decimal("1300.00")
	assert result["discount_percent"] == Decimal("10")
	assert result["net_selling_amount"] == Decimal("11700.00")
	assert result["partial_margin_amount"] == Decimal("1200.00")


def test_unknown_internal_labor_cost_remains_null_instead_of_becoming_zero() -> None:
	result = calculate_document_pricing(
		{
			"positions": [
				{
					"position_id": "LAB-1",
					"position_type": "Arbeitszeit",
					"quantity": "8",
					"internal_cost_rate": None,
					"effective_rate": "120.00",
				}
			]
		},
		margin_method=MarginMethod.MARKUP,
	)

	assert result["positions"]["LAB-1"]["internal_cost_amount"] is None
	assert result["has_missing_labor_cost"] is True
