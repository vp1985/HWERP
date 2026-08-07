from decimal import Decimal

import pytest

from hwerp.domain.pricing import MarginMethod, PricingLine, calculate_pricing


def test_cost_basis_sums_known_internal_line_costs() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("2"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("5.00"),
			),
			PricingLine(
				quantity=Decimal("3"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("2.00"),
			),
		),
		risk_rate=Decimal("0"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.cost_basis == Decimal("16.00")


def test_risk_is_added_to_cost_basis_for_minimum_price() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("10000.00"),
			),
		),
		risk_rate=Decimal("0.05"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.risk_amount == Decimal("500.00")
	assert result.minimum_price == Decimal("10500.00")


def test_markup_calculates_target_price_on_minimum_price() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("10000.00"),
			),
		),
		risk_rate=Decimal("0.05"),
		target_margin=Decimal("0.20"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.target_price == Decimal("12600.00")


def test_sales_margin_calculates_target_as_share_of_sales_price() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("10000.00"),
			),
		),
		risk_rate=Decimal("0.05"),
		target_margin=Decimal("0.20"),
		margin_method=MarginMethod.SALES_MARGIN,
	)

	assert result.target_price == Decimal("13125.00")


def test_sales_margin_rejects_one_hundred_percent() -> None:
	with pytest.raises(ValueError, match="smaller than 1"):
		calculate_pricing(
			lines=(),
			risk_rate=Decimal("0"),
			target_margin=Decimal("1"),
			margin_method=MarginMethod.SALES_MARGIN,
		)


def test_pre_discount_total_sums_commercially_rounded_lines() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(quantity=Decimal("1"), unit_price=Decimal("1.005")),
			PricingLine(quantity=Decimal("1"), unit_price=Decimal("1.005")),
		),
		risk_rate=Decimal("0"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.pre_discount_total == Decimal("2.02")


def test_risk_and_target_are_rounded_after_each_step() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("0.05"),
			),
		),
		risk_rate=Decimal("0.10"),
		target_margin=Decimal("0.25"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.risk_amount == Decimal("0.01")
	assert result.minimum_price == Decimal("0.06")
	assert result.target_price == Decimal("0.08")


def test_currency_precision_controls_money_rounding() -> None:
	result = calculate_pricing(
		lines=(PricingLine(quantity=Decimal("1"), unit_price=Decimal("1.0005")),),
		risk_rate=Decimal("0"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
		currency_precision=3,
	)

	assert result.pre_discount_total == Decimal("1.001")


def test_cost_basis_sums_rounded_internal_line_amounts() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("1.005"),
			),
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("0"),
				internal_unit_cost=Decimal("1.005"),
			),
		),
		risk_rate=Decimal("0"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.cost_basis == Decimal("2.02")


def test_percentage_discount_is_applied_after_pre_discount_total() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("13000.00"),
				internal_unit_cost=Decimal("10000.00"),
			),
		),
		risk_rate=Decimal("0.05"),
		target_margin=Decimal("0.20"),
		margin_method=MarginMethod.MARKUP,
		discount_rate=Decimal("0.10"),
	)

	assert result.discount_amount == Decimal("1300.00")
	assert result.final_price == Decimal("11700.00")


def test_fixed_discount_calculates_the_equivalent_rate() -> None:
	result = calculate_pricing(
		lines=(PricingLine(quantity=Decimal("1"), unit_price=Decimal("13000.00")),),
		risk_rate=Decimal("0"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
		discount_amount=Decimal("1300.00"),
	)

	assert result.discount_rate == Decimal("0.10")
	assert result.discount_amount == Decimal("1300.00")
	assert result.final_price == Decimal("11700.00")


def test_discount_rate_and_fixed_amount_are_mutually_exclusive() -> None:
	with pytest.raises(ValueError, match="either discount rate or amount"):
		calculate_pricing(
			lines=(PricingLine(quantity=Decimal("1"), unit_price=Decimal("100.00")),),
			risk_rate=Decimal("0"),
			target_margin=Decimal("0"),
			margin_method=MarginMethod.MARKUP,
			discount_rate=Decimal("0.10"),
			discount_amount=Decimal("10.00"),
		)


def test_discount_cannot_exceed_the_pre_discount_total() -> None:
	with pytest.raises(ValueError, match="between zero and total"):
		calculate_pricing(
			lines=(PricingLine(quantity=Decimal("1"), unit_price=Decimal("100.00")),),
			risk_rate=Decimal("0"),
			target_margin=Decimal("0"),
			margin_method=MarginMethod.MARKUP,
			discount_amount=Decimal("100.01"),
		)


def test_markup_result_reports_partial_cost_margin_after_risk() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("1"),
				unit_price=Decimal("13000.00"),
				internal_unit_cost=Decimal("10000.00"),
			),
		),
		risk_rate=Decimal("0.05"),
		target_margin=Decimal("0.20"),
		margin_method=MarginMethod.MARKUP,
		discount_rate=Decimal("0.10"),
	)

	assert result.contribution_amount == Decimal("1200.00")
	assert result.contribution_ratio == Decimal("0.1142857142857142857142857143")


def test_internal_labor_without_cost_is_reported_as_missing_not_zero_cost() -> None:
	result = calculate_pricing(
		lines=(
			PricingLine(
				quantity=Decimal("8"),
				unit_price=Decimal("120.00"),
				internal_unit_cost=None,
				is_internal_labor=True,
			),
		),
		risk_rate=Decimal("0"),
		target_margin=Decimal("0"),
		margin_method=MarginMethod.MARKUP,
	)

	assert result.cost_basis == Decimal("0.00")
	assert result.has_missing_labor_costs is True
