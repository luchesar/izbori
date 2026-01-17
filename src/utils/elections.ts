import type { Place, MunicipalityData, MunicipalityGeoJSON, SelectedRegion } from '../types';

// API base URL - configurable for development vs production
const API_BASE_URL = '/api';

// Bulgarian month names for client-side date formatting
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
  let date = id;
  let type = 'ns';
  const match = id.match(/^(\d{4}-\d{2}-\d{2})-(ns|ep)$/);
  if (match) {
      date = match[1];
      type = match[2];
  }
  
  const [year, month] = date.split('-'); 
  const monthName = BULGARIAN_MONTHS[month] || month;
  const suffix = type === 'ep' ? ' (ЕП)' : type === 'ns' && date === '2024-06-09' ? ' (НС)' : '';
  
  return `${monthName} ${year}${suffix}`;
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
// Types
// ---------------------------

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

export interface AggregatedElectionStats {
    totalVotes: number;
    activity: number;
    eligibleVoters: number;
    topParties: Array<{ party: string; votes: number; percentage: number }>;
}

export interface PartyInfo {
  name: string;
  label: string;
  color: string;
}

// ---------------------------
// API Endpoints
// ---------------------------

// Available elections - fetched from API but cached locally for quick access
let _cachedElections: Array<{ id: string; date: string; type: string; formattedDate: string }> | null = null;

export async function fetchAvailableElections() {
  if (_cachedElections) return _cachedElections;
  
  const response = await fetch(`${API_BASE_URL}/ns/elections`);
  if (!response.ok) throw new Error('Failed to fetch elections');
  _cachedElections = await response.json();
  return _cachedElections!;
}

// For backwards compatibility - synchronous access to elections
// This will be populated after first fetch
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

// ---------------------------
// Geo Data Loaders
// ---------------------------

export async function loadMunicipalitiesGeoJSON(): Promise<any> {
  return withCache('municipalities-geo', async () => {
    const response = await fetch(`${API_BASE_URL}/ns/geo/municipalities`);
    if (!response.ok) throw new Error('Failed to load municipalities geojson');
    return response.json();
  });
}

export async function loadSettlementsGeoJSON(): Promise<any> {
  return withCache('settlements-geo', async () => {
    const response = await fetch(`${API_BASE_URL}/ns/geo/settlements`);
    if (!response.ok) throw new Error('Failed to load settlements geojson');
    return response.json();
  });
}

export async function loadPlacesData(): Promise<any[]> {
  return withCache('places-data', async () => {
    const response = await fetch(`${API_BASE_URL}/ns/geo/places`);
    if (!response.ok) throw new Error('Failed to load places data');
    return response.json();
  });
}

// ---------------------------
// Party Data
// ---------------------------

let _partiesCache: Record<string, PartyInfo> | null = null;

export async function fetchParties(): Promise<Record<string, PartyInfo>> {
  if (_partiesCache) return _partiesCache;
  
  return withCache('parties', async () => {
    const response = await fetch(`${API_BASE_URL}/ns/parties`);
    if (!response.ok) throw new Error('Failed to load parties');
    _partiesCache = await response.json();
    return _partiesCache!;
  });
}

/**
 * Gets a party's color from the cached parties data.
 * Falls back to generating a color if parties aren't loaded yet.
 */
export function getPartyColor(partyName: string): string {
  // If we have cached party data, use it
  if (_partiesCache && _partiesCache[partyName]) {
    return _partiesCache[partyName].color;
  }
  
  // Fallback: generate color client-side (matches server algorithm)
  let hash = 0;
  for (let i = 0; i < partyName.length; i++) {
    hash = partyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 45%)`;
}

// ---------------------------
// Election Data
// ---------------------------

export async function getElectionData(request: RegionDataRequest): Promise<Record<string, any>> {
  const { electionId, regionType, parties, regionId } = request;
  
  // Build query params
  const params = new URLSearchParams();
  params.set('region_type', regionType);
  if (regionId) params.set('region_id', regionId);
  if (parties && parties.length > 0) params.set('parties', parties.join(','));
  
  const cacheKey = `election-data-${electionId}-${params.toString()}`;
  
  return withCache(cacheKey, async () => {
    const response = await fetch(`${API_BASE_URL}/ns/data/${electionId}?${params.toString()}`);
    if (!response.ok) throw new Error(`Failed to load election data for ${electionId}`);
    return response.json();
  });
}

// ---------------------------
// Data Merge Functions
// ---------------------------

export function mergeData(
  geo: MunicipalityGeoJSON,
  electionResults: Record<string, any>
): MunicipalityData[] {
  return geo.features.map(feature => {
    const name = feature.properties.name;
    const data = electionResults[name];
    
    let electionData = undefined;
    if (data) {
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

    return {
        ...feature,
        electionData
    };
  });
}

export function mergePlacesData(
  placesGeoJSON: any,
  electionResults: Record<string, any>
): Place[] {
  const features = placesGeoJSON.features || placesGeoJSON;
  
  return features.map((feature: any) => {
    const ekatte = feature.properties.ekatte;
    const data = electionResults[ekatte];
    
    let electionData = undefined;
    if (data) {
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

    return {
        ...feature,
        electionData
    } as Place;
  });
}

export function aggregateSettlementsToMunicipalities(
  placesData: any[],
  settlementResults: Record<string, any>,
  municipalityGeo: MunicipalityGeoJSON
): MunicipalityData[] {
  const byMunicipality = new Map<string, any[]>();
  
  placesData.forEach(place => {
    const munName = place.obshtina;
    if (!byMunicipality.has(munName)) {
      byMunicipality.set(munName, []);
    }
    byMunicipality.get(munName)!.push(place);
  });

  return municipalityGeo.features.map(feature => {
    const munName = feature.properties.name;
    
    let lookupName = munName;
    if (munName === 'Столична община') lookupName = 'Столична';
    
    const placesInMun = byMunicipality.get(lookupName) || [];
    
    const aggregatedParties: Record<string, number> = {};
    let totalVotes = 0;
    let totalEligible = 0;
    
    placesInMun.forEach(place => {
      const electionData = settlementResults[place.ekatte];
      if (electionData) {
        totalVotes += electionData.total || 0;
        totalEligible += electionData.meta?.eligible || 0;
        
        Object.entries(electionData.results as Record<string, number>).forEach(([party, votes]) => {
          aggregatedParties[party] = (aggregatedParties[party] || 0) + votes;
        });
      }
    });

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
        eligibleVoters: totalEligible,
        topParties
      };
    }

    return {
      ...feature,
      electionData
    };
  });
}

// ---------------------------
// Search
// ---------------------------

export function searchRegions(query: string, municipalities: MunicipalityData[], places: Place[]): SelectedRegion[];
export function searchRegions(query: string): Promise<any[]>;

export function searchRegions(
    query: string, 
    municipalities?: MunicipalityData[], 
    places?: Place[]
): SelectedRegion[] | Promise<any[]> {
    if (municipalities && places) {
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

    return (async () => {
        const lowerQ = query.toLowerCase();
        
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

// ---------------------------
// Statistics
// ---------------------------

export async function getTopPartiesFromLastNElections(n: number = 3): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/ns/stats/top-parties?n=${n}`);
  if (!response.ok) throw new Error('Failed to fetch top parties');
  return response.json();
}

export async function getNationalResults(electionId: string): Promise<AggregatedElectionStats> {
  return withCache(`national-results-${electionId}`, async () => {
    const response = await fetch(`${API_BASE_URL}/ns/stats/national/${electionId}`);
    if (!response.ok) throw new Error('Failed to fetch national results');
    return response.json();
  });
}

export async function getMunicipalitiesByVoters(electionId: string): Promise<MunicipalityData[]> {
    const [geo, placesGeo, results] = await Promise.all([
        loadMunicipalitiesGeoJSON(),
        loadSettlementsGeoJSON(),
        getElectionData({ electionId, regionType: 'settlement' })
    ]);
    
    const placesData = placesGeo.features.map((f: any) => ({
             ekatte: f.properties.ekatte,
             name: f.properties.name,
             oblast: f.properties.oblast,
             obshtina: f.properties.obshtina
    }));

    const municipalities = aggregateSettlementsToMunicipalities(placesData, results, geo);
    
    return municipalities.sort((a, b) => {
        const eligibleA = a.electionData?.eligibleVoters || 0;
        const eligibleB = b.electionData?.eligibleVoters || 0;
        return eligibleB - eligibleA;
    });
}

export async function getSettlementsByVotersInMunicipality(electionId: string, munName: string): Promise<Place[]> {
    const [placesGeo, results] = await Promise.all([
        loadSettlementsGeoJSON(),
        getElectionData({ electionId, regionType: 'settlement' })
    ]);
    
    const settlementsInMun = mergePlacesData(placesGeo, results)
        .filter(p => p.properties.obshtina === munName);
        
    return settlementsInMun.sort((a, b) => {
        const eligibleA = results[a.properties.ekatte]?.meta?.eligible || 0;
        const eligibleB = results[b.properties.ekatte]?.meta?.eligible || 0;
        return eligibleB - eligibleA;
    }).map(s => {
        if (s.electionData) {
             s.electionData.eligibleVoters = results[s.properties.ekatte]?.meta?.eligible || 0;
        }
        return s;
    });
}

// Preload parties on module load for synchronous getPartyColor access
fetchParties().catch(() => {});
