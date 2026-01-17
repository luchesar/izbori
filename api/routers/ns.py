"""
National Assembly (Народно събрание) election endpoints.

All endpoints are prefixed with /ns via the router mount in main.py.
Implements ETag caching for efficient client-side caching.
"""

import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import JSONResponse

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
    load_fraud_analysis,
)

router = APIRouter()

# Cache for computed ETags (keyed by id of the data object)
# Since data is loaded via lru_cache, same data object = same id = same ETag
_etag_cache: dict[int, str] = {}


def compute_etag(data: any) -> str:
    """
    Compute ETag hash from data.
    Uses object id as cache key since data objects are cached via lru_cache.
    """
    data_id = id(data)
    if data_id in _etag_cache:
        return _etag_cache[data_id]
    
    # Compute hash from serialized data
    content = json.dumps(data, sort_keys=True, ensure_ascii=False)
    etag = hashlib.md5(content.encode()).hexdigest()
    _etag_cache[data_id] = etag
    return etag


def etag_response(request: Request, data: any, cache_max_age: int = 300) -> Response:
    """
    Return JSONResponse with ETag header, or 304 Not Modified if ETag matches.
    
    Args:
        request: FastAPI Request object
        data: Data to serialize and return (should be from cached loader)
        cache_max_age: Cache-Control max-age in seconds (default 5 min)
    """
    etag = compute_etag(data)
    
    # Check If-None-Match header
    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    
    return JSONResponse(
        content=data,
        headers={
            "ETag": etag,
            "Cache-Control": f"public, max-age={cache_max_age}, stale-while-revalidate=3600",
        }
    )


@router.get("/elections")
async def list_elections(request: Request):
    """
    List all available National Assembly elections.
    
    Returns list of elections with id, date, type, and formatted date.
    """
    data = [
        {
            **election,
            "formattedDate": format_election_date(election["id"]),
        }
        for election in AVAILABLE_ELECTIONS
    ]
    return etag_response(request, data, cache_max_age=86400)  # 24h - rarely changes


@router.get("/geo/municipalities")
async def get_municipalities_geojson(request: Request):
    """
    Get municipalities GeoJSON for map rendering.
    
    Returns GeoJSON FeatureCollection with municipality boundaries.
    """
    data = load_municipalities_geojson()
    return etag_response(request, data, cache_max_age=86400)  # 24h - static


@router.get("/geo/settlements")
async def get_settlements_geojson(request: Request):
    """
    Get settlements GeoJSON (places.geojson) for map rendering.
    
    Returns GeoJSON FeatureCollection with settlement boundaries.
    """
    data = load_settlements_geojson()
    return etag_response(request, data, cache_max_age=86400)  # 24h - static


@router.get("/geo/places")
async def get_places_data(request: Request):
    """
    Get places metadata (places.json).
    
    Returns array of settlements with EKATTE codes, coordinates, and location info.
    """
    data = load_places_data()
    return etag_response(request, data, cache_max_age=86400)  # 24h - static


@router.get("/parties")
async def get_parties(request: Request):
    """
    Get all parties with their labels and colors.
    
    Returns dict keyed by party name with:
    - name: Party name (same as key)
    - label: Human-readable label
    - color: HSL color string for visualization
    """
    data = load_parties()
    return etag_response(request, data, cache_max_age=86400)  # 24h - rarely changes


@router.get("/data/{election_id}")
async def get_election_results(
    request: Request,
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
    data = get_election_data(election_id, region_type, region_id, party_list)
    return etag_response(request, data, cache_max_age=3600)  # 1h - election data


@router.get("/stats/national/{election_id}")
async def get_national_stats(request: Request, election_id: str):
    """
    Get aggregated national statistics for an election.
    
    Returns:
        - totalVotes: Total votes nationwide
        - activity: Voter turnout (0-1)
        - eligibleVoters: Total eligible voters
        - topParties: Array of { party, votes, percentage } sorted by votes
    """
    data = get_national_results(election_id)
    return etag_response(request, data, cache_max_age=3600)  # 1h


@router.get("/stats/top-parties")
async def get_top_parties(
    request: Request,
    n: int = Query(3, description="Number of recent NS elections to analyze"),
):
    """
    Get top 5 parties by aggregated votes from the last N National Assembly elections.
    
    Returns:
        Array of party names (top 5 by total votes)
    """
    data = get_top_parties_from_last_n_elections(n)
    return etag_response(request, data, cache_max_age=3600)  # 1h


@router.get("/stats/fraud")
async def get_fraud_analysis(request: Request):
    """
    Get fraud/anomaly analysis data.
    
    Returns:
        - meta: Analysis metadata (elections, top_parties, threshold, national_cv)
        - settlements: Dict of settlement EKATTE -> CV scores
    """
    data = load_fraud_analysis()
    return etag_response(request, data, cache_max_age=86400)  # 24h - rarely changes
