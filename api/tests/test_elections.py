"""
Tests for services/elections.py
"""

import pytest
from services.elections import (
    get_party_color,
    format_election_date,
    AVAILABLE_ELECTIONS,
    BULGARIAN_MONTHS,
)


class TestGetPartyColor:
    """Tests for party color generation."""

    def test_returns_hsl_format(self):
        color = get_party_color("Test Party")
        assert color.startswith("hsl(")
        assert "70%" in color
        assert "45%" in color

    def test_consistent_for_same_party(self):
        color1 = get_party_color("ГЕРБ-СДС")
        color2 = get_party_color("ГЕРБ-СДС")
        assert color1 == color2

    def test_different_for_different_parties(self):
        color_gerb = get_party_color("ГЕРБ-СДС")
        color_bsp = get_party_color("БСП")
        color_dps = get_party_color("ДПС")
        
        assert color_gerb != color_bsp
        assert color_gerb != color_dps
        assert color_bsp != color_dps

    def test_handles_empty_string(self):
        color = get_party_color("")
        assert color.startswith("hsl(")

    def test_handles_unicode(self):
        color = get_party_color("Партия с кирилица")
        assert color.startswith("hsl(")


class TestFormatElectionDate:
    """Tests for date formatting."""

    def test_formats_simple_date(self):
        result = format_election_date("2024-10-27-ns")
        assert "27" in result
        assert "Октомври" in result
        assert "2024" in result

    def test_formats_ep_election(self):
        result = format_election_date("2024-06-09-ep")
        assert "(ЕП)" in result

    def test_formats_ns_on_shared_date(self):
        result = format_election_date("2024-06-09-ns")
        assert "(НС)" in result

    def test_handles_date_without_type(self):
        result = format_election_date("2024-10-27")
        assert "27" in result
        assert "Октомври" in result


class TestAvailableElections:
    """Tests for election list."""

    def test_has_elections(self):
        assert len(AVAILABLE_ELECTIONS) > 0

    def test_election_structure(self):
        election = AVAILABLE_ELECTIONS[0]
        assert "id" in election
        assert "date" in election
        assert "type" in election

    def test_includes_recent_election(self):
        ids = [e["id"] for e in AVAILABLE_ELECTIONS]
        assert "2024-10-27-ns" in ids

    def test_includes_ep_election(self):
        types = [e["type"] for e in AVAILABLE_ELECTIONS]
        assert "ep" in types


class TestBulgarianMonths:
    """Tests for month translations."""

    def test_has_all_months(self):
        assert len(BULGARIAN_MONTHS) == 12

    def test_january(self):
        assert BULGARIAN_MONTHS["01"] == "Януари"

    def test_december(self):
        assert BULGARIAN_MONTHS["12"] == "Декември"
