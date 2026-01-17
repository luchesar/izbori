"""
Election data service for National Assembly elections.

Handles loading, caching, and processing of election data.
"""

import json
import csv
from pathlib import Path
from functools import lru_cache
from typing import Optional

# Base path for data files (relative to api/)
DATA_DIR = Path(__file__).parent.parent / "data"


# Bulgarian month names for date formatting
BULGARIAN_MONTHS = {
    "01": "Януари",
    "02": "Февруари",
    "03": "Март",
    "04": "Април",
    "05": "Май",
    "06": "Юни",
    "07": "Юли",
    "08": "Август",
    "09": "Септември",
    "10": "Октомври",
    "11": "Ноември",
    "12": "Декември",
}

# Available elections
AVAILABLE_ELECTIONS = [
    {"id": "2013-05-12-ns", "date": "2013-05-12", "type": "ns"},
    {"id": "2014-10-05-ns", "date": "2014-10-05", "type": "ns"},
    {"id": "2017-03-26-ns", "date": "2017-03-26", "type": "ns"},
    {"id": "2021-04-04-ns", "date": "2021-04-04", "type": "ns"},
    {"id": "2021-07-11-ns", "date": "2021-07-11", "type": "ns"},
    {"id": "2021-11-14-ns", "date": "2021-11-14", "type": "ns"},
    {"id": "2022-10-02-ns", "date": "2022-10-02", "type": "ns"},
    {"id": "2023-04-02-ns", "date": "2023-04-02", "type": "ns"},
    {"id": "2024-06-09-ns", "date": "2024-06-09", "type": "ns"},
    {"id": "2024-06-09-ep", "date": "2024-06-09", "type": "ep"},
    {"id": "2024-10-27-ns", "date": "2024-10-27", "type": "ns"},
]


def get_party_color(party_name: str) -> str:
    """
    Generates a consistent color for a party based on its name.
    Uses hash of party name to produce deterministic HSL color.
    Matches the TypeScript implementation in elections.ts.
    """
    hash_val = 0
    for char in party_name:
        hash_val = ord(char) + ((hash_val << 5) - hash_val)
        # JavaScript-like 32-bit signed integer behavior
        hash_val = hash_val & 0xFFFFFFFF
        if hash_val >= 0x80000000:
            hash_val -= 0x100000000
    hue = abs(hash_val % 360)
    return f"hsl({hue}, 70%, 45%)"


def format_election_date(election_id: str) -> str:
    """Format election ID to Bulgarian date string."""
    date = election_id
    el_type = "ns"
    
    # Parse election ID (e.g., '2024-06-09-ns')
    parts = election_id.rsplit("-", 1)
    if len(parts) == 2 and parts[1] in ("ns", "ep"):
        date = parts[0]
        el_type = parts[1]
    
    year, month, day = date.split("-")
    month_name = BULGARIAN_MONTHS.get(month, month)
    
    suffix = ""
    if el_type == "ep":
        suffix = " (ЕП)"
    elif el_type == "ns" and date == "2024-06-09":
        suffix = " (НС)"
    
    return f"{day} {month_name} {year}{suffix}"


@lru_cache(maxsize=1)
def load_municipalities_geojson() -> dict:
    """Load and cache municipalities GeoJSON."""
    path = DATA_DIR / "geo" / "municipalities.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_settlements_geojson() -> dict:
    """Load and cache settlements GeoJSON (places.geojson)."""
    path = DATA_DIR / "geo" / "places.geojson"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_places_data() -> list:
    """Load and cache places metadata (places.json)."""
    path = DATA_DIR / "geo" / "places.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_parties() -> dict:
    """
    Load parties data including colors.
    Returns dict with party name as key and full data (label, color) as value.
    """
    path = DATA_DIR / "parties.csv"
    parties = {}
    
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            party_name = row.get("party", "").strip()
            if party_name:
                parties[party_name] = {
                    "name": party_name,
                    "label": row.get("party label", party_name).strip(),
                    "color": get_party_color(party_name),
                }
    
    return parties


@lru_cache(maxsize=32)
def load_election_csv(election_id: str, region_type: str) -> list[dict]:
    """
    Load and parse election CSV file.
    
    Args:
        election_id: e.g., '2024-10-27-ns'
        region_type: 'municipality' or 'settlement'
    
    Returns:
        List of row dicts from the CSV
    """
    # Parse election ID to get date and type
    date = election_id
    el_type = "ns"
    
    parts = election_id.rsplit("-", 1)
    if len(parts) == 2 and parts[1] in ("ns", "ep"):
        date = parts[0]
        el_type = parts[1]
    
    # Construct filename
    if region_type == "municipality":
        filename = f"{date}{el_type}_mun.csv"
    else:
        filename = f"{date}{el_type}.csv"
    
    path = DATA_DIR / "el_data" / filename
    
    if not path.exists():
        return []
    
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert numeric fields
            processed = {}
            for key, value in row.items():
                if value is None or value == "":
                    processed[key] = None
                else:
                    try:
                        # Try integer first
                        processed[key] = int(value)
                    except ValueError:
                        try:
                            # Then float
                            processed[key] = float(value)
                        except ValueError:
                            # Keep as string
                            processed[key] = value
            rows.append(processed)
    
    return rows


def get_election_data(
    election_id: str,
    region_type: str = "settlement",
    region_id: Optional[str] = None,
    parties: Optional[list[str]] = None,
) -> dict:
    """
    Get processed election results.
    
    Args:
        election_id: e.g., '2024-10-27-ns'
        region_type: 'municipality' or 'settlement'
        region_id: Optional specific region to filter
        parties: Optional list of parties to include
    
    Returns:
        Dict keyed by region ID with election results
    """
    rows = load_election_csv(election_id, region_type)
    
    # Filter by region ID if provided
    if region_id:
        if region_type == "municipality":
            rows = [r for r in rows if r.get("nuts4") == region_id or r.get("municipality_name") == region_id]
        else:
            # Settlement: region_id is EKATTE code (5 chars with leading zeros)
            csv_id = int(region_id)
            rows = [r for r in rows if r.get("id") == csv_id]
    
    # Meta keys to exclude from party results
    meta_keys = {
        "municipality_name", "region", "region_name", "n_stations",
        "total", "activity", "nuts4", "eligible_voters", "total_valid",
        "id", "невалидни"
    }
    
    processed = {}
    
    for row in rows:
        # Determine key
        if region_type == "municipality":
            key = row.get("municipality_name") or row.get("nuts4")
        else:
            # Convert CSV integer ID to EKATTE format (5 chars with leading zeros)
            csv_id = row.get("id")
            if csv_id is not None:
                key = str(csv_id).zfill(5)
            else:
                continue
        
        if not key:
            continue
        
        # Extract party results
        party_results = {}
        for col, value in row.items():
            if col not in meta_keys and isinstance(value, (int, float)):
                if parties is None or len(parties) == 0 or col in parties:
                    party_results[col] = value
        
        # Calculate activity (turnout)
        total_votes = row.get("total") or row.get("total_valid") or 0
        eligible_voters = row.get("eligible_voters") or 0
        activity = row.get("activity")
        
        if activity is None:
            activity = total_votes / eligible_voters if eligible_voters > 0 else 0
        
        processed[key] = {
            "id": key,
            "total": total_votes,
            "results": party_results,
            "meta": {
                "activity": activity,
                "eligible": eligible_voters,
            },
        }
    
    return processed


def get_national_results(election_id: str) -> dict:
    """
    Aggregate settlement-level data for national totals.
    """
    settlement_results = get_election_data(election_id, region_type="settlement")
    
    total_votes = 0
    total_eligible = 0
    aggregated_parties = {}
    
    for data in settlement_results.values():
        total_votes += data.get("total", 0)
        total_eligible += data.get("meta", {}).get("eligible", 0)
        
        for party, votes in data.get("results", {}).items():
            aggregated_parties[party] = aggregated_parties.get(party, 0) + votes
    
    # Build top parties list
    top_parties = [
        {
            "party": party,
            "votes": votes,
            "percentage": (votes / total_votes * 100) if total_votes > 0 else 0,
        }
        for party, votes in aggregated_parties.items()
    ]
    top_parties.sort(key=lambda x: x["votes"], reverse=True)
    
    activity = total_votes / total_eligible if total_eligible > 0 else 0
    
    return {
        "totalVotes": total_votes,
        "activity": activity,
        "eligibleVoters": total_eligible,
        "topParties": top_parties,
    }


def get_top_parties_from_last_n_elections(n: int = 3) -> list[str]:
    """
    Analyze the last N National Assembly elections and return top 5 parties by total aggregated votes.
    """
    # Filter for NS elections and sort by date descending
    ns_elections = [e for e in AVAILABLE_ELECTIONS if e["type"] == "ns"]
    ns_elections.sort(key=lambda e: e["date"], reverse=True)
    ns_elections = ns_elections[:n]
    
    global_party_votes = {}
    
    for election in ns_elections:
        data = get_election_data(election["id"], region_type="settlement")
        
        for row in data.values():
            for party, votes in row.get("results", {}).items():
                if isinstance(votes, (int, float)):
                    global_party_votes[party] = global_party_votes.get(party, 0) + votes
    
    # Sort and pick top 5
    sorted_parties = sorted(global_party_votes.items(), key=lambda x: x[1], reverse=True)
    return [party for party, _ in sorted_parties[:5]]


@lru_cache(maxsize=1)
def load_fraud_analysis() -> dict:
    """Load and cache fraud analysis data."""
    path = DATA_DIR / "fraud_analysis.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_history_data(region_type: str, region_id: str) -> list[dict]:
    """
    Get voting history for a specific region across all available elections.
    """
    history = []
    # Sort elections by date
    sorted_elections = sorted(AVAILABLE_ELECTIONS, key=lambda x: x["date"])
    
    for election in sorted_elections:
        eid = election["id"]
        # Fetch data for this election and region
        # Reusing get_election_data ensures consistent filtering and processing
        data_map = get_election_data(eid, region_type, region_id=region_id)
        
        if data_map:
            # We expect single entry for the specific region
            # Extract it from the dict
            item = next(iter(data_map.values()))
            
            history.append({
                "electionId": eid,
                "date": election["date"],
                "type": election["type"],
                "formattedDate": format_election_date(eid),
                "total": item["total"],
                "results": item["results"],
                "meta": item["meta"]
            })
            
    return history
