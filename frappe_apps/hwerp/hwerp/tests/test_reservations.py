from __future__ import annotations

from datetime import datetime, timezone

import pytest

from hwerp.integrations.reservations import (
	ALLOWED_RESOURCE_TYPES,
	ReservationConflict,
	ResourceInterval,
	assert_no_conflict,
	intervals_overlap,
)

UTC = timezone.utc


def at(hour: int) -> datetime:
	return datetime(2026, 8, 7, hour, tzinfo=UTC)


def booking(*, start: int = 8, end: int = 10, resource_id: str = "ASSET-1") -> ResourceInterval:
	return ResourceInterval("ERPNext Asset", resource_id, at(start), at(end))


def test_adjacent_half_open_intervals_do_not_overlap() -> None:
	assert not intervals_overlap(booking(start=8, end=10), booking(start=10, end=12))
	assert intervals_overlap(booking(start=8, end=10), booking(start=9, end=12))


def test_interval_requires_start_before_end() -> None:
	with pytest.raises(ValueError, match="Beginn"):
		booking(start=10, end=10)


def test_only_identifiable_v1_resource_types_are_reservable() -> None:
	assert ALLOWED_RESOURCE_TYPES == {
		"ERPNext Asset",
		"HWERP Technikobjekt",
		"Wiederverwendbares externes Mietmittel",
	}
	with pytest.raises(ValueError, match="Ressourcentyp"):
		ResourceInterval("Customer Asset", "A-1", at(8), at(10))
	with pytest.raises(ValueError, match="eindeutige"):
		ResourceInterval("ERPNext Asset", "", at(8), at(10))


def test_conflict_check_blocks_only_same_resource_with_overlap() -> None:
	existing = [booking(), booking(resource_id="ASSET-2")]

	with pytest.raises(ReservationConflict, match="ASSET-1"):
		assert_no_conflict(booking(start=9, end=11), existing)

	assert_no_conflict(booking(start=10, end=12), existing)
	assert_no_conflict(booking(start=9, end=11, resource_id="ASSET-3"), existing)
