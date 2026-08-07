from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable


class RuleConflictError(ValueError):
	pass


@dataclass(frozen=True, slots=True)
class RuleCandidate:
	name: str
	target_field: str
	priority: int
	value: Decimal


def select_winning_rules(rules: Iterable[RuleCandidate]) -> dict[str, RuleCandidate]:
	selected: dict[str, RuleCandidate] = {}
	for rule in rules:
		current = selected.get(rule.target_field)
		if current is not None and rule.priority == current.priority:
			raise RuleConflictError(
				f"conflicting rules for {rule.target_field}: {current.name}, {rule.name}"
			)
		if current is None or rule.priority > current.priority:
			selected[rule.target_field] = rule
	return selected
