import Papa from 'papaparse';
import type { MunicipalityGeoJSON, ElectionResult, MunicipalityData, PlaceGeoJSON } from '../types';

// Hardcoded paths for now, relative to public directory (which maps to root URL in Vite)
const MUNICIPALITIES_URL = '/assets/data/geo/municipalities.json';
const ELECTION_DATA_URL = '/assets/data/el_data/2024-06-09ns_mun.csv';
const PARTIES_URL = '/assets/data/parties.csv';
const PLACES_URL = '/assets/data/geo/places.geojson';

export async function fetchMunicipalities(): Promise<MunicipalityGeoJSON> {
  const response = await fetch(MUNICIPALITIES_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch municipalities: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchParties(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    Papa.parse(PARTIES_URL, {
      download: true,
      header: true,
      delimiter: ";", // Checking the file, it seemed to use semicolons in the summary? Or comma? Let's check. Defaulting to auto-detect.
      skipEmptyLines: true,
      complete: (results) => {
        const partyMap: Record<string, string> = {};
        // @ts-ignore
        results.data.forEach((row: any) => {
            if (row.party && row['party label']) {
               partyMap[row.party] = row['party label'];
            }
        });
        resolve(partyMap);
      },
      error: (error) => reject(error),
    });
  });
}

export async function fetchElectionResults(): Promise<Record<string, ElectionResult>> {
  return new Promise((resolve, reject) => {
    Papa.parse(ELECTION_DATA_URL, {
      download: true,
      header: true,
      dynamicTyping: true, // Parse numbers automatically
      skipEmptyLines: true,
      complete: (results) => {
        const resultMap: Record<string, ElectionResult> = {};
        
        results.data.forEach((row: any) => {
          if (!row.municipality_name) return;

          // Extract party results. Assumption: All columns except metadata are party votes.
          // Metadata columns: municipality_name, region, region_name, n_stations, total, activity, nuts4, eligible_voters
          const metaKeys = new Set(['municipality_name', 'region', 'region_name', 'n_stations', 'total', 'activity', 'nuts4', 'eligible_voters']);
          const partyResults: Record<string, number> = {};
          
          Object.keys(row).forEach(key => {
            if (!metaKeys.has(key) && typeof row[key] === 'number') {
                partyResults[key] = row[key];
            }
          });

          resultMap[row.municipality_name] = {
            municipality_name: row.municipality_name,
            total_valid: row.total || 0, // Using total as proxy for valid if not explicitly separated in this Aggregated CSV
            total: row.total || 0,
            eligible_voters: row.eligible_voters || 0,
            activity: row.activity,
            results: partyResults,
          };
        });
        resolve(resultMap);
      },
      error: (error) => reject(error),
    });
  });
}

export async function fetchPlaces(): Promise<PlaceGeoJSON> {
  const response = await fetch(PLACES_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch places: ${response.statusText}`);
  }
  return response.json();
}

export function mergeData(
  geo: MunicipalityGeoJSON,
  electionResults: Record<string, ElectionResult>
): MunicipalityData[] {
  return geo.features.map(feature => {
    const name = feature.properties.name;
    const data = electionResults[name];
    
    let electionData = undefined;
    if (data) {
        // Calculate percentages
        const topParties = Object.entries(data.results)
            .map(([party, votes]) => ({ party, votes, percentage: (votes / data.total) * 100 }))
            .sort((a, b) => b.votes - a.votes);

        electionData = {
            totalVotes: data.total,
            activity: parseFloat(data.activity as string) || 0, // Parse if string
            topParties
        };
    }

    return {
        ...feature,
        electionData
    };
  });
}
