"""
Tests for routers/ns.py API endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


class TestElectionsEndpoint:
    """Tests for /ns/elections endpoint."""

    def test_returns_list(self):
        response = client.get("/ns/elections")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_election_has_required_fields(self):
        response = client.get("/ns/elections")
        election = response.json()[0]
        assert "id" in election
        assert "date" in election
        assert "type" in election
        assert "formattedDate" in election

    def test_formatted_date_is_bulgarian(self):
        response = client.get("/ns/elections")
        election = response.json()[-1]  # Latest election
        # Should contain Bulgarian month name
        assert any(month in election["formattedDate"] for month in [
            "Януари", "Февруари", "Март", "Април", "Май", "Юни",
            "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"
        ])


class TestPartiesEndpoint:
    """Tests for /ns/parties endpoint."""

    def test_returns_dict(self):
        response = client.get("/ns/parties")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_party_has_required_fields(self):
        response = client.get("/ns/parties")
        data = response.json()
        if data:
            party = list(data.values())[0]
            assert "name" in party
            assert "label" in party
            assert "color" in party

    def test_color_is_hsl(self):
        response = client.get("/ns/parties")
        data = response.json()
        if data:
            party = list(data.values())[0]
            assert party["color"].startswith("hsl(")


class TestGeoEndpoints:
    """Tests for /ns/geo/* endpoints."""

    def test_municipalities_returns_geojson(self):
        response = client.get("/ns/geo/municipalities")
        assert response.status_code == 200
        data = response.json()
        assert data.get("type") == "FeatureCollection"
        assert "features" in data

    def test_settlements_returns_geojson(self):
        response = client.get("/ns/geo/settlements")
        assert response.status_code == 200
        data = response.json()
        assert data.get("type") == "FeatureCollection"
        assert "features" in data

    def test_places_returns_list(self):
        response = client.get("/ns/geo/places")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestDataEndpoint:
    """Tests for /ns/data/{election_id} endpoint."""

    def test_returns_dict(self):
        response = client.get("/ns/data/2024-10-27-ns?region_type=settlement")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_settlement_data_has_required_fields(self):
        response = client.get("/ns/data/2024-10-27-ns?region_type=settlement")
        data = response.json()
        if data:
            item = list(data.values())[0]
            assert "id" in item
            assert "total" in item
            assert "results" in item
            assert "meta" in item

    def test_ekatte_format(self):
        response = client.get("/ns/data/2024-10-27-ns?region_type=settlement")
        data = response.json()
        if data:
            key = list(data.keys())[0]
            # EKATTE should be 5 digits with leading zeros
            assert len(key) == 5
            assert key.isdigit()


class TestStatsEndpoints:
    """Tests for /ns/stats/* endpoints."""

    def test_national_stats_returns_aggregates(self):
        response = client.get("/ns/stats/national/2024-10-27-ns")
        assert response.status_code == 200
        data = response.json()
        assert "totalVotes" in data
        assert "activity" in data
        assert "eligibleVoters" in data
        assert "topParties" in data
        assert isinstance(data["topParties"], list)

    def test_top_parties_returns_list(self):
        response = client.get("/ns/stats/top-parties?n=2")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5  # Returns top 5


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_health_check(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestETagCaching:
    """Tests for ETag caching functionality."""

    def test_returns_etag_header(self):
        response = client.get("/ns/elections")
        assert response.status_code == 200
        assert "etag" in response.headers

    def test_returns_cache_control_header(self):
        response = client.get("/ns/geo/municipalities")
        assert response.status_code == 200
        assert "cache-control" in response.headers
        assert "max-age" in response.headers["cache-control"]

    def test_304_on_matching_etag(self):
        # First request to get ETag
        response1 = client.get("/ns/elections")
        assert response1.status_code == 200
        etag = response1.headers["etag"]
        
        # Second request with If-None-Match
        response2 = client.get("/ns/elections", headers={"If-None-Match": etag})
        assert response2.status_code == 304
        assert response2.content == b""  # No body on 304

    def test_200_on_different_etag(self):
        response = client.get("/ns/elections", headers={"If-None-Match": "invalid-etag"})
        assert response.status_code == 200
        assert len(response.json()) > 0

