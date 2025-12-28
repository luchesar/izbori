import Papa from 'papaparse';
import type { Place, MunicipalityData, MunicipalityGeoJSON, ElectionResult, SelectedRegion } from '../types';

// Define base paths
const DATA_BASE_URL = '/assets/data';
const EL_DATA_PATH = `${DATA_BASE_URL}/el_data`;
const GEO_DATA_PATH = `${DATA_BASE_URL}/geo`;

// Define available dates and types likely available based on file scan
// Bulgarian month names
export const BULGARIAN_MONTHS: Record<string, string> = {
  '01': 'Януари',
  '02': 'Февруари',
  '03': 'Март',
  '04': 'Април',
  '05': 'Май',
  '06': 'Юни',
  '07': 'Юли',
  '08': 'Август',
  '09': 'Септември',
  '10': 'Октомври',
  '11': 'Ноември',
  '12': 'Декември'
};

export function formatElectionDate(id: string): string {
  let date = id;
  let type = 'ns';
  const match = id.match(/^(\d{4}-\d{2}-\d{2})-(ns|ep)$/);
  if (match) {
      date = match[1];
      type = match[2];
  }
  
  const [year, month, day] = date.split('-');
  const monthName = BULGARIAN_MONTHS[month] || month;
  const suffix = type === 'ep' ? ' (ЕП)' : type === 'ns' && date === '2024-06-09' ? ' (НС)' : '';
  
  return `${day} ${monthName} ${year}${suffix}`;
}

export function formatElectionMonthYear(id: string): string {
  const [year, month] = id.split('-'); // Works for YYYY-MM-DD-type too as year is first
  const monthName = BULGARIAN_MONTHS[month] || month;
  return `${monthName} ${year}`;
}

// Define available dates and types likely available based on file scan
export const AVAILABLE_ELECTIONS = [
  { id: '2013-05-12-ns', date: '2013-05-12', type: 'ns' },
  { id: '2014-10-05-ns', date: '2014-10-05', type: 'ns' },
  { id: '2017-03-26-ns', date: '2017-03-26', type: 'ns' },
  { id: '2021-04-04-ns', date: '2021-04-04', type: 'ns' },
  { id: '2021-07-11-ns', date: '2021-07-11', type: 'ns' },
  { id: '2021-11-14-ns', date: '2021-11-14', type: 'ns' },
  { id: '2022-10-02-ns', date: '2022-10-02', type: 'ns' },
  { id: '2023-04-02-ns', date: '2023-04-02', type: 'ns' },
  { id: '2024-06-09-ns', date: '2024-06-09', type: 'ns' },
  { id: '2024-06-09-ep', date: '2024-06-09', type: 'ep' },
  { id: '2024-10-27-ns', date: '2024-10-27', type: 'ns' },
];

export interface ElectionFilter {
  year?: string;
  month?: string; // MM
  day?: string; // DD
  date?: string; // YYYY-MM-DD
  type?: 'ns' | 'ep'; // National or European
  parties?: string[];
}

export interface RegionDataRequest {
  electionId: string; // e.g. '2021-04-04'
  regionType: 'municipality' | 'settlement';
  regionId?: string; // If omitted, returns all for that type
  parties?: string[]; // If omitted, returns all
}

// ---------------------------
// Caching
// ---------------------------

const cache: Record<string, Promise<any>> = {};

async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (cache[key]) {
    return cache[key];
  }
  const promise = fetcher().catch(err => {
    delete cache[key]; // Reduce cache poisoning on error
    throw err;
  });
  cache[key] = promise;
  return promise;
}

// Exposed for testing
export function clearCache() {
  for (const key in cache) {
    delete cache[key];
  }
}

// ---------------------------
// Base Loaders (Async)
// ---------------------------

export async function loadMunicipalitiesGeoJSON(): Promise<any> {
  return withCache('municipalities-geo', async () => {
    const response = await fetch(`${GEO_DATA_PATH}/municipalities.json`);
    if (!response.ok) throw new Error('Failed to load municipalities geojson');
    return response.json();
  });
}

export async function loadSettlementsGeoJSON(): Promise<any> {
  return withCache('settlements-geo', async () => {
    const response = await fetch(`${GEO_DATA_PATH}/places.geojson`);
    if (!response.ok) throw new Error('Failed to load places geojson');
    return response.json();
  });
}

export async function loadPlaceMetadata(): Promise<any[]> {
  return withCache('place-metadata', () => {
    return new Promise((resolve, reject) => {
      Papa.parse(`${GEO_DATA_PATH}/place_data.csv`, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      });
    });
  });
}

/**
 * Loads places data from places.json
 * Returns an array of settlements with EKATTE codes, coordinates, and location info
 */
export async function loadPlacesData(): Promise<any[]> {
  return withCache('places-data', async () => {
    const response = await fetch(`${GEO_DATA_PATH}/places.json`);
    if (!response.ok) throw new Error('Failed to load places.json');
    return response.json();
  });
}

// ---------------------------
// Election Data Loaders
// ---------------------------

/**
 * Loads aggregated election results for a specific election date.
 * Currently supports Municipality level (*_mun.csv) and Settlement level (*ns.csv).
 * 
 * For settlements: CSV IDs are integers without leading zeros.
 * They are converted to 5-character EKATTE codes (e.g., 14 -> "00014") for linkage with places.json
 */
export async function getElectionData(request: RegionDataRequest): Promise<Record<string, any>> {
  const { electionId, regionType, parties, regionId } = request;
  
  // Extract date and type from ID (e.g., '2024-06-09-ns' -> date='2024-06-09', type='ns')
  let date = electionId;
  let type = 'ns';
  const match = electionId.match(/^(\d{4}-\d{2}-\d{2})-(ns|ep)$/);
  if (match) {
      date = match[1];
      type = match[2];
  }
  
  // Construct filename
  const suffix = regionType === 'municipality' ? `${type}_mun.csv` : `${type}.csv`;
  const url = `${EL_DATA_PATH}/${date}${suffix}`;
  
  // Cache key includes URL but NOT filter params (we filter in memory to reuse the CSV parse)
  const cacheKey = `election-data-${url}`;

  // 1. Fetch & Parse (Cached)
  const fullData: any[] = await withCache(cacheKey, () => {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(new Error(`Failed to load election data for ${electionId}: ${err}`)),
      });
    });
  });

  // 2. Filter & Process (Per Request)
  let data = fullData;

  // Filter by Region ID if provided
  if (regionId) {
      if (regionType === 'municipality') {
            data = data.filter((row: any) => 
              row.nuts4 === regionId || row.municipality_name === regionId
            );
      } else {
          // Settlement/Section granular data
          // regionId should be an EKATTE code (5 chars with leading zeros)
          // CSV has integer IDs, so we need to convert for comparison
          const csvId = parseInt(regionId, 10);
          data = data.filter((row: any) => row.id == csvId);
      }
  }

  // Map to Output Format
  const processed: Record<string, any> = {};
  
  data.forEach((row: any) => {
      // Identifier key
      let key: string;
      if (regionType === 'municipality') {
          key = row.municipality_name || row.nuts4;
      } else {
          // Convert CSV integer ID to EKATTE format (5 chars with leading zeros)
          // e.g., 14 -> "00014", 2614 -> "02614"
          key = String(row.id).padStart(5, '0');
      }
      
      if (!key) return;

      // Extract Parties
      const partyResults: Record<string, number> = {};
      const metaKeys = new Set(['municipality_name', 'region', 'region_name', 'n_stations', 'total', 'activity', 'nuts4', 'eligible_voters', 'total_valid', 'id', 'невалидни']);
      
      Object.keys(row).forEach(col => {
          if (!metaKeys.has(col) && typeof row[col] === 'number') {
              // 3. Filter by Parties if provided
              if (!parties || parties.length === 0 || parties.includes(col)) {
                  partyResults[col] = row[col];
              }
          }
      });

      // Calculate activity (turnout) if not present in CSV
      // Settlement CSVs don't have activity column, municipality CSVs do
      const totalVotes = row.total || row.total_valid || 0;
      const eligibleVoters = row.eligible_voters || 0;
      const activity = row.activity !== undefined 
          ? row.activity 
          : (eligibleVoters > 0 ? totalVotes / eligibleVoters : 0);

      processed[key] = {
          id: key,
          total: totalVotes,
          results: partyResults,
          meta: {
              activity: activity,
              eligible: eligibleVoters
          }
      };
  });

  return processed;
}

export async function fetchParties(): Promise<Record<string, string>> {
  return withCache('parties', () => {
    return new Promise((resolve, reject) => {
      Papa.parse(`${DATA_BASE_URL}/parties.csv`, {
        download: true,
        header: true,
        delimiter: ";", 
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
  });
}

export function mergeData(
  geo: MunicipalityGeoJSON,
  electionResults: Record<string, any>
): MunicipalityData[] {
  return geo.features.map(feature => {
    const name = feature.properties.name;
    const data = electionResults[name];
    
    let electionData = undefined;
    if (data) {
        // Calculate percentages
        const topParties = Object.entries(data.results as Record<string, number>)
            .map(([party, votes]) => ({ party, votes, percentage: (votes / data.total) * 100 }))
            .sort((a, b) => b.votes - a.votes);

        // Handle both older ElectionResult format and newer getElectionData format
        // getElectionData puts activity/eligible in .meta
        const activityVal = data.meta?.activity ?? data.activity;
        const activity = typeof activityVal === 'string' ? parseFloat(activityVal) : activityVal || 0;

        electionData = {
            totalVotes: data.total,
            activity,
            topParties
        };
    }

    return {
        ...feature,
        electionData
    };
  });
}

/**
 * Merges settlement (place) GeoJSON data with election results
 * Links data using EKATTE codes (5-character strings with leading zeros)
 * Works with places.geojson which already has polygon/multipolygon geometries
 */
export function mergePlacesData(
  placesGeoJSON: any, // GeoJSON FeatureCollection from places.geojson
  electionResults: Record<string, any> // From getElectionData with settlement type
): Place[] {
  // If it's a FeatureCollection, use the features array
  const features = placesGeoJSON.features || placesGeoJSON;
  
  return features.map((feature: any) => {
    const ekatte = feature.properties.ekatte;
    const data = electionResults[ekatte];
    
    let electionData = undefined;
    if (data) {
        // Calculate percentages
        const topParties = Object.entries(data.results as Record<string, number>)
            .map(([party, votes]) => ({ party, votes, percentage: (votes / data.total) * 100 }))
            .sort((a, b) => b.votes - a.votes);

        const activityVal = data.meta?.activity ?? data.activity;
        const activity = typeof activityVal === 'string' ? parseFloat(activityVal) : activityVal || 0;

        electionData = {
            totalVotes: data.total,
            activity,
            topParties
        };
    }

    // Return the feature with electionData attached
    return {
        ...feature,
        electionData
    } as Place;
  });
}

/**
 * Aggregates settlement-level election data to municipality level
 * This is useful when municipality CSV file is not available (e.g., 2024-10-27)
 * 
 * @param placesData - Array of places from places.json
 * @param settlementResults - Election results keyed by EKATTE codes
 * @param municipalityGeo - Municipality GeoJSON for geography
 * @returns Municipality data with aggregated election results
 */
export function aggregateSettlementsToMunicipalities(
  placesData: any[],
  settlementResults: Record<string, any>,
  municipalityGeo: MunicipalityGeoJSON
): MunicipalityData[] {
  // Group places by municipality (obshtina)
  const byMunicipality = new Map<string, any[]>();
  
  placesData.forEach(place => {
    const munName = place.obshtina;
    if (!byMunicipality.has(munName)) {
      byMunicipality.set(munName, []);
    }
    byMunicipality.get(munName)!.push(place);
  });

  // Aggregate election data for each municipality
  return municipalityGeo.features.map(feature => {
    const munName = feature.properties.name;
    const placesInMun = byMunicipality.get(munName) || [];
    
    // Aggregate all party votes from settlements in this municipality
    const aggregatedParties: Record<string, number> = {};
    let totalVotes = 0;
    let totalEligible = 0;
    let totalValid = 0;
    
    placesInMun.forEach(place => {
      const electionData = settlementResults[place.ekatte];
      if (electionData) {
        totalVotes += electionData.total || 0;
        totalEligible += electionData.meta?.eligible || 0;
        totalValid += electionData.total || 0; // total is actually total_valid in most cases
        
        // Sum up party votes
        Object.entries(electionData.results as Record<string, number>).forEach(([party, votes]) => {
          aggregatedParties[party] = (aggregatedParties[party] || 0) + votes;
        });
      }
    });

    // Calculate election data if we have any votes
    let electionData = undefined;
    if (totalVotes > 0) {
      const topParties = Object.entries(aggregatedParties)
        .map(([party, votes]) => ({ 
          party, 
          votes, 
          percentage: (votes / totalVotes) * 100 
        }))
        .sort((a, b) => b.votes - a.votes);

      const activity = totalEligible > 0 ? totalVotes / totalEligible : 0;

      electionData = {
        totalVotes,
        activity,
        topParties
      };
    }

    return {
      ...feature,
      electionData
    };
  });
}

// Overload signatures
export function searchRegions(query: string, municipalities: MunicipalityData[], places: Place[]): SelectedRegion[];
export function searchRegions(query: string): Promise<any[]>;

// Implementation
export function searchRegions(
    query: string, 
    municipalities?: MunicipalityData[], 
    places?: Place[]
): SelectedRegion[] | Promise<any[]> {
    if (municipalities && places) {
        // Synchronous version (from data.ts)
        if (!query || query.length < 2) return [];
  
        const lowerQuery = query.toLowerCase();
        
        const matchedMunicipalities = municipalities.filter(m => 
            m.properties.name.toLowerCase().includes(lowerQuery)
        );
        
        const matchedPlaces = places.filter(p => 
            p.properties.name.toLowerCase().includes(lowerQuery)
        );
        
        return [...matchedMunicipalities, ...matchedPlaces].slice(0, 10);
    }

    // Async version (original elections.ts)
    return (async () => {
        const lowerQ = query.toLowerCase();
        
        // Load both (could be cached)
        const [munGeo, placesHelper] = await Promise.all([
            loadMunicipalitiesGeoJSON(),
            loadSettlementsGeoJSON()
        ]);
    
        const muns = munGeo.features
            .filter((f: any) => f.properties.name?.toLowerCase().includes(lowerQ))
            .map((f: any) => ({ type: 'municipality', ...f.properties }));
    
        const plcs = placesHelper.features
            .filter((f: any) => f.properties.name?.toLowerCase().includes(lowerQ))
            .map((f: any) => ({ type: 'settlement', ...f.properties }));
    
        return [...muns, ...plcs];
    })();
}

