"""Deterministic pricing calculations without framework dependencies."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from typing import Iterable


class MarginMethod(StrEnum):
	"""Supported target-margin calculation methods."""

	MARKUP = "markup"
	SALES_MARGIN = "sales_margin"


@dataclass(frozen=True, slots=True)
class PricingLine:
	"""A price-effective line with an optional known internal unit cost."""

	quantity: Decimal
	unit_price: Decimal
	internal_unit_cost: Decimal | None = None
	is_internal_labor: bool = False


@dataclass(frozen=True, slots=True)
class PricingResult:
	"""Result values defined by specification section 15."""

	cost_basis: Decimal
	risk_amount: Decimal
	minimum_price: Decimal
	target_price: Decimal
	pre_discount_total: Decimal
	discount_rate: Decimal
	discount_amount: Decimal
	final_price: Decimal
	contribution_amount: Decimal
	contribution_ratio: Decimal | None
	has_missing_labor_costs: bool


def _money(value: Decimal, precision: int) -> Decimal:
	return value.quantize(Decimal(1).scaleb(-precision), rounding=ROUND_HALF_UP)


def calculate_pricing(
	*,
	lines: Iterable[PricingLine],
	risk_rate: Decimal,
	target_margin: Decimal,
	margin_method: MarginMethod,
	discount_rate: Decimal | None = None,
	discount_amount: Decimal | None = None,
	currency_precision: int = 2,
) -> PricingResult:
	"""Calculate deterministic net pricing values."""

	if discount_rate is not None and discount_amount is not None:
		raise ValueError("provide either discount rate or amount")
	if margin_method is MarginMethod.SALES_MARGIN and target_margin >= Decimal("1"):
		raise ValueError("sales margin must be smaller than 1")

	lines = tuple(lines)
	has_missing_labor_costs = any(
		line.is_internal_labor and line.internal_unit_cost is None
		for line in lines
	)
	cost_basis = sum(
		(
			_money(line.quantity * line.internal_unit_cost, currency_precision)
			for line in lines
			if line.internal_unit_cost is not None
		),
		start=_money(Decimal("0"), currency_precision),
	)
	risk_amount = _money(cost_basis * risk_rate, currency_precision)
	minimum_price = _money(cost_basis + risk_amount, currency_precision)
	if margin_method is MarginMethod.MARKUP:
		target_price = _money(minimum_price * (Decimal("1") + target_margin), currency_precision)
	else:
		target_price = _money(minimum_price / (Decimal("1") - target_margin), currency_precision)
	pre_discount_total = sum(
		(_money(line.quantity * line.unit_price, currency_precision) for line in lines),
		start=_money(Decimal("0"), currency_precision),
	)
	if discount_amount is None:
		discount_rate = discount_rate or Decimal("0")
		effective_discount_amount = _money(pre_discount_total * discount_rate, currency_precision)
	else:
		effective_discount_amount = _money(discount_amount, currency_precision)
		discount_rate = (
			effective_discount_amount / pre_discount_total
			if pre_discount_total
			else Decimal("0")
		)
	if effective_discount_amount < 0 or effective_discount_amount > pre_discount_total:
		raise ValueError("discount must be between zero and total")
	final_price = _money(pre_discount_total - effective_discount_amount, currency_precision)
	contribution_amount = _money(final_price - minimum_price, currency_precision)
	contribution_denominator = (
		minimum_price if margin_method is MarginMethod.MARKUP else final_price
	)
	contribution_ratio = (
		contribution_amount / contribution_denominator
		if contribution_denominator
		else None
	)
	return PricingResult(
		cost_basis=cost_basis,
		risk_amount=risk_amount,
		minimum_price=minimum_price,
		target_price=target_price,
		pre_discount_total=pre_discount_total,
		discount_rate=discount_rate,
		discount_amount=effective_discount_amount,
		final_price=final_price,
		contribution_amount=contribution_amount,
		contribution_ratio=contribution_ratio,
		has_missing_labor_costs=has_missing_labor_costs,
	)
