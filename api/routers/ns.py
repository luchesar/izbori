"""
National Assembly (Народно събрание) election endpoints.

All endpoints are prefixed with /ns via the router mount in main.py.
"""

from typing import Optional
from fastapi import APIRouter, Query

from services.elections import (
    AVAILABLE_ELECTIONS,
    load_municipalities_geojson,
    load_settlements_geojson,
    load_places_data,
    load_parties,
    get_election_data,
    get_national_results,
    get_top_parties_from_last_n_elections,
    format_election_date,
)

router = APIRouter()


@router.get("/elections")
async def list_elections():
    """
    List all available National Assembly elections.
    
    Returns list of elections with id, date, type, and formatted date.
    """
    return [
        {
            **election,
            "formattedDate": format_election_date(election["id"]),
        }
        for election in AVAILABLE_ELECTIONS
    ]


@router.get("/geo/municipalities")
async def get_municipalities_geojson():
    """
    Get municipalities GeoJSON for map rendering.
    
    Returns GeoJSON FeatureCollection with municipality boundaries.
    """
    return load_municipalities_geojson()


@router.get("/geo/settlements")
async def get_settlements_geojson():
    """
    Get settlements GeoJSON (places.geojson) for map rendering.
    
    Returns GeoJSON FeatureCollection with settlement boundaries.
    """
    return load_settlements_geojson()


@router.get("/geo/places")
async def get_places_data():
    """
    Get places metadata (places.json).
    
    Returns array of settlements with EKATTE codes, coordinates, and location info.
    """
    return load_places_data()


@router.get("/parties")
async def get_parties():
    """
    Get all parties with their labels and colors.
    
    Returns dict keyed by party name with:
    - name: Party name (same as key)
    - label: Human-readable label
    - color: HSL color string for visualization
    """
    return load_parties()


@router.get("/data/{election_id}")
async def get_election_results(
    election_id: str,
    region_type: str = Query("settlement", description="'municipality' or 'settlement'"),
    region_id: Optional[str] = Query(None, description="Optional specific region ID"),
    parties: Optional[str] = Query(None, description="Comma-separated list of parties to include"),
):
    """
    Get election results for a specific election.
    
    Args:
        election_id: Election identifier (e.g., '2024-10-27-ns')
        region_type: 'municipality' or 'settlement'
        region_id: Optional region ID to filter (NUTS4 for municipality, EKATTE for settlement)
        parties: Optional comma-separated list of parties to include
    
    Returns:
        Dict keyed by region ID with election results including:
        - id: Region identifier
        - total: Total votes
        - results: Dict of party -> votes
        - meta: { activity, eligible }
    """
    party_list = parties.split(",") if parties else None
    return get_election_data(election_id, region_type, region_id, party_list)


@router.get("/stats/national/{election_id}")
async def get_national_stats(election_id: str):
    """
    Get aggregated national statistics for an election.
    
    Returns:
        - totalVotes: Total votes nationwide
        - activity: Voter turnout (0-1)
        - eligibleVoters: Total eligible voters
        - topParties: Array of { party, votes, percentage } sorted by votes
    """
    return get_national_results(election_id)


@router.get("/stats/top-parties")
async def get_top_parties(
    n: int = Query(3, description="Number of recent NS elections to analyze"),
):
    """
    Get top 5 parties by aggregated votes from the last N National Assembly elections.
    
    Returns:
        Array of party names (top 5 by total votes)
    """
    return get_top_parties_from_last_n_elections(n)
