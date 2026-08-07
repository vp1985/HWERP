from decimal import Decimal

import pytest

from hwerp.domain.rules import RuleCandidate, RuleConflictError, select_winning_rules


def test_highest_priority_rule_wins_for_each_target_field() -> None:
	selected = select_winning_rules(
		(
			RuleCandidate("RISK-LOW", "risk", 10, Decimal("0.05")),
			RuleCandidate("RISK-HIGH", "risk", 20, Decimal("0.08")),
			RuleCandidate("MARGIN", "target_margin", 5, Decimal("0.20")),
		)
	)

	assert selected["risk"].name == "RISK-HIGH"
	assert selected["target_margin"].name == "MARGIN"


def test_equal_highest_priority_for_one_target_blocks_calculation() -> None:
	with pytest.raises(RuleConflictError, match="RISK-A.*RISK-B"):
		select_winning_rules(
			(
				RuleCandidate("RISK-A", "risk", 20, Decimal("0.05")),
				RuleCandidate("RISK-B", "risk", 20, Decimal("0.08")),
			)
		)
