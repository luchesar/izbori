#!/usr/bin/env python3
"""
Election Fraud Analysis Script

Analyzes voting data across all elections to calculate variability metrics
for each settlement. High variability (CV > 30%) may indicate potential anomalies.

Usage:
    python analyze_fraud.py

Output:
    public/assets/data/fraud_analysis.json
"""

import csv
import json
import math
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def calculate_cv(values: List[float]) -> Optional[float]:
    """
    Calculate Coefficient of Variation (CV) for a list of values.
    CV = (standard_deviation / mean) * 100
    
    Returns None if there's not enough data or mean is zero.
    """
    # Filter out zeros and None values
    valid_values = [v for v in values if v is not None and v > 0]
    
    if len(valid_values) < 2:
        return None
    
    mean = sum(valid_values) / len(valid_values)
    if mean == 0:
        return None
    
    variance = sum((x - mean) ** 2 for x in valid_values) / len(valid_values)
    std_dev = math.sqrt(variance)
    
    return (std_dev / mean) * 100


def load_election_data(file_path: str) -> Dict[str, Dict]:
    """
    Load election data from a CSV file.
    Returns a dict mapping settlement ID to vote data.
    """
    data = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            settlement_id = row['id']
            # Get total votes
            total = float(row.get('total', 0) or 0)
            
            # Get party votes (all columns except special ones)
            special_cols = {'id', 'невалидни', 'total_valid', 'total', 
                           'eligible_voters', 'n_stations', 'не подкрепям никого'}
            parties = {}
            for col, val in row.items():
                if col not in special_cols and col != 'id':
                    try:
                        votes = float(val or 0)
                        if total > 0:
                            # Store as percentage
                            parties[col] = (votes / total) * 100
                        else:
                            parties[col] = 0
                    except (ValueError, TypeError):
                        pass
            
            data[settlement_id] = {
                'total': total,
                'parties': parties
            }
    
    return data


def get_top_parties(all_elections: List[Dict[str, Dict]], n: int = 5) -> List[str]:
    """
    Get the top N parties by total votes across all elections.
    """
    party_totals = {}
    for election_data in all_elections:
        for settlement_data in election_data.values():
            for party, pct in settlement_data.get('parties', {}).items():
                party_totals[party] = party_totals.get(party, 0) + pct
    
    # Sort by total and return top N
    sorted_parties = sorted(party_totals.items(), key=lambda x: x[1], reverse=True)
    return [p[0] for p in sorted_parties[:n]]


def calculate_national_cv(
    all_elections: List[Dict[str, Dict]], 
    top_parties: List[str]
) -> Dict:
    """
    Calculate national-level CV for total turnout and each party.
    This represents the baseline variability due to national political trends.
    """
    # Aggregate total turnout per election
    national_totals = []
    party_national_pcts = {p: [] for p in top_parties}
    
    for election_data in all_elections:
        # Sum all votes for this election
        election_total = sum(s.get('total', 0) for s in election_data.values())
        national_totals.append(election_total)
        
        # Calculate weighted national percentage for each party
        for party in top_parties:
            party_votes = sum(
                s.get('parties', {}).get(party, 0) * s.get('total', 0) / 100
                for s in election_data.values()
            )
            if election_total > 0:
                party_national_pcts[party].append((party_votes / election_total) * 100)
            else:
                party_national_pcts[party].append(0)
    
    # Calculate national CVs
    national_total_cv = calculate_cv(national_totals) or 0
    national_party_cv = {}
    for party in top_parties:
        cv = calculate_cv(party_national_pcts[party])
        if cv is not None:
            national_party_cv[party] = cv
    
    return {
        'total_cv': national_total_cv,
        'party_cv': national_party_cv
    }


def analyze_settlements(
    all_elections: List[Dict[str, Dict]], 
    election_dates: List[str],
    top_parties: List[str],
    national_cv: Dict
) -> Dict:
    """
    Analyze all settlements for voting variability.
    Normalizes by subtracting national CV to isolate local anomalies.
    """
    # Collect all settlement IDs
    all_settlements = set()
    for election_data in all_elections:
        all_settlements.update(election_data.keys())
    
    settlements_analysis = {}
    
    for settlement_id in all_settlements:
        # Collect total votes across elections
        totals = []
        party_votes = {p: [] for p in top_parties}
        
        for election_data in all_elections:
            if settlement_id in election_data:
                settlement = election_data[settlement_id]
                totals.append(settlement.get('total', 0))
                
                for party in top_parties:
                    pct = settlement.get('parties', {}).get(party, 0)
                    party_votes[party].append(pct)
            else:
                totals.append(0)
                for party in top_parties:
                    party_votes[party].append(0)
        
        # Calculate CV for total and normalize against national
        raw_total_cv = calculate_cv(totals)
        if raw_total_cv is not None:
            # Subtract national CV to get excess local variability
            normalized_total_cv = max(0, raw_total_cv - national_cv['total_cv'])
        else:
            normalized_total_cv = None
        
        # Calculate CV for each party and normalize
        party_cv = {}
        for party in top_parties:
            cv = calculate_cv(party_votes[party])
            if cv is not None:
                national_party = national_cv['party_cv'].get(party, 0)
                normalized = max(0, cv - national_party)
                party_cv[party] = round(normalized, 1)
        
        if normalized_total_cv is not None:
            settlements_analysis[settlement_id] = {
                'total_cv': round(normalized_total_cv, 1),
                'party_cv': party_cv,
                'elections_count': len([t for t in totals if t > 0])
            }
    
    return settlements_analysis


def get_top_by_variability(
    settlements: Dict, 
    key: str = 'total_cv',
    party: Optional[str] = None,
    threshold: float = 30.0,
    limit: int = 100
) -> List[str]:
    """
    Get settlement IDs with highest variability above threshold.
    """
    items = []
    for sid, data in settlements.items():
        if party:
            cv = data.get('party_cv', {}).get(party, 0)
        else:
            cv = data.get(key, 0)
        
        if cv >= threshold:
            items.append((sid, cv))
    
    items.sort(key=lambda x: x[1], reverse=True)
    return [sid for sid, _ in items[:limit]]


def main():
    # Find all election files
    data_dir = Path(__file__).parent.parent / 'public' / 'assets' / 'data' / 'el_data'
    
    election_files = sorted([
        f for f in data_dir.glob('*ns.csv') 
        if '_mun' not in f.name and 'ep' not in f.name
    ])
    
    print(f"Found {len(election_files)} election files")
    
    # Load all election data
    all_elections = []
    election_dates = []
    
    for file_path in election_files:
        print(f"Loading {file_path.name}...")
        election_data = load_election_data(str(file_path))
        all_elections.append(election_data)
        # Extract date from filename (e.g., "2024-10-27ns.csv" -> "2024-10-27")
        election_dates.append(file_path.stem.replace('ns', ''))
    
    # Get top parties across all elections
    top_parties = get_top_parties(all_elections, n=10)
    print(f"Top parties: {top_parties}")
    
    # Calculate national-level baselines
    print("Calculating national baselines...")
    national_cv = calculate_national_cv(all_elections, top_parties)
    print(f"National total CV: {national_cv['total_cv']:.1f}%")
    for party, cv in national_cv['party_cv'].items():
        print(f"  {party}: {cv:.1f}%")
    
    # Analyze settlements (normalized against national trends)
    print("Analyzing settlements (normalized against national trends)...")
    settlements = analyze_settlements(all_elections, election_dates, top_parties, national_cv)
    print(f"Analyzed {len(settlements)} settlements")
    
    # Get top by variability
    top_total_cv = get_top_by_variability(settlements, threshold=30.0)
    print(f"Found {len(top_total_cv)} settlements with normalized total CV > 30%")
    
    top_party_cv = {}
    for party in top_parties:
        top_for_party = get_top_by_variability(settlements, party=party, threshold=30.0)
        if top_for_party:
            top_party_cv[party] = top_for_party
    
    # Build output
    output = {
        'meta': {
            'elections': election_dates,
            'top_parties': top_parties,
            'threshold': 30.0,
            'national_cv': {
                'total_cv': round(national_cv['total_cv'], 1),
                'party_cv': {p: round(v, 1) for p, v in national_cv['party_cv'].items()}
            }
        },
        'settlements': settlements,
        'rankings': {
            'by_total_cv': top_total_cv,
            'by_party_cv': top_party_cv
        }
    }
    
    # Write output
    output_path = Path(__file__).parent.parent / 'public' / 'assets' / 'data' / 'fraud_analysis.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"Output written to {output_path}")


if __name__ == '__main__':
    main()
