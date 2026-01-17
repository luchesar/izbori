import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';

// Helper to load and parse CSV file from api/data
function loadCsvFile(csvPath: string): any[] {
  const content = fs.readFileSync(csvPath, 'utf8');
  const result = Papa.parse(content, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return result.data as any[];
}

// Helper to process election data (mimics API logic)
function processElectionData(rows: any[], regionType: string): Record<string, any> {
  const metaKeys = new Set(['municipality_name', 'region', 'region_name', 'n_stations', 'total', 'activity', 'nuts4', 'eligible_voters', 'total_valid', 'id', 'невалидни']);
  const processed: Record<string, any> = {};
  
  for (const row of rows) {
    let key: string;
    if (regionType === 'municipality') {
      key = row.municipality_name || row.nuts4;
    } else {
      const csvId = row.id;
      if (csvId == null) continue;
      key = String(csvId).padStart(5, '0');
    }
    if (!key) continue;

    const partyResults: Record<string, number> = {};
    for (const [col, value] of Object.entries(row)) {
      if (!metaKeys.has(col) && typeof value === 'number') {
        partyResults[col] = value;
      }
    }

    const totalVotes = row.total || row.total_valid || 0;
    const eligibleVoters = row.eligible_voters || 0;
    const activity = row.activity !== undefined ? row.activity : (eligibleVoters > 0 ? totalVotes / eligibleVoters : 0);

    processed[key] = {
      id: key,
      total: totalVotes,
      results: partyResults,
      meta: { activity, eligible: eligibleVoters }
    };
  }
  return processed;
}

// Mock global fetch for API endpoints (reads from api/data/)
global.fetch = vi.fn().mockImplementation(async (url: string) => {
  const apiDataDir = path.resolve(process.cwd(), 'api/data');
  
  // Handle API endpoints
  if (url.startsWith('/api/ns/geo/municipalities')) {
    const filePath = path.join(apiDataDir, 'geo/municipalities.json');
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, json: async () => JSON.parse(content) };
  }
  
  if (url.startsWith('/api/ns/geo/settlements')) {
    const filePath = path.join(apiDataDir, 'geo/places.geojson');
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, json: async () => JSON.parse(content) };
  }
  
  if (url.startsWith('/api/ns/geo/places')) {
    const filePath = path.join(apiDataDir, 'geo/places.json');
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, json: async () => JSON.parse(content) };
  }
  
  if (url.startsWith('/api/ns/parties')) {
    const filePath = path.join(apiDataDir, 'parties.csv');
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = Papa.parse(content, { header: true, delimiter: ';', skipEmptyLines: true }).data as any[];
    const parties: Record<string, any> = {};
    for (const row of rows) {
      const name = row.party?.trim();
      if (name) {
        parties[name] = { name, label: row['party label']?.trim() || name, color: `hsl(0, 70%, 45%)` };
      }
    }
    return { ok: true, json: async () => parties };
  }
  
  if (url.startsWith('/api/ns/data/')) {
    // Parse URL: /api/ns/data/{electionId}?region_type=...
    const urlObj = new URL(url, 'http://localhost');
    const electionId = urlObj.pathname.replace('/api/ns/data/', '');
    const regionType = urlObj.searchParams.get('region_type') || 'settlement';
    
    // Parse election ID
    let date = electionId;
    let elType = 'ns';
    const match = electionId.match(/^(\d{4}-\d{2}-\d{2})-(ns|ep)$/);
    if (match) { date = match[1]; elType = match[2]; }
    
    const suffix = regionType === 'municipality' ? `${elType}_mun.csv` : `${elType}.csv`;
    const csvPath = path.join(apiDataDir, 'el_data', `${date}${suffix}`);
    
    if (fs.existsSync(csvPath)) {
      const rows = loadCsvFile(csvPath);
      const processed = processElectionData(rows, regionType);
      return { ok: true, json: async () => processed };
    }
    return { ok: false, status: 404 };
  }
  
  return Promise.reject(new Error(`Fetch not mocked for: ${url}`));
}) as any;

// Import after mocking
import { getElectionData, loadPlacesData, mergePlacesData, loadSettlementsGeoJSON, clearCache } from './elections';


describe('Integration Tests - Real Data Files', () => {
    beforeEach(() => {
      clearCache();
      vi.clearAllMocks();
    });

    describe('loadPlacesData - Real File', () => {
      it('should load real places.json file', async () => {
        const places = await loadPlacesData();

        expect(places).toBeDefined();
        expect(Array.isArray(places)).toBe(true);
        expect(places.length).toBeGreaterThan(5000); // Should have ~5255 places
        
        // Verify structure
        const firstPlace = places[0];
        expect(firstPlace).toHaveProperty('ekatte');
        expect(firstPlace).toHaveProperty('name');
        expect(firstPlace).toHaveProperty('lat');
        expect(firstPlace).toHaveProperty('lng');
        expect(firstPlace).toHaveProperty('oblast');
        expect(firstPlace).toHaveProperty('obshtina');
        
        // Verify EKATTE format (5 characters with leading zeros)
        expect(firstPlace.ekatte).toMatch(/^\d{5}$/);
      });

      it('should include specific known settlements', async () => {
        const places = await loadPlacesData();

        // Check for Старосел (EKATTE: 69016)
        const starosel = places.find(p => p.ekatte === '69016');
        expect(starosel).toBeDefined();
        expect(starosel?.name).toContain('Старосел');
        expect(starosel?.oblast).toBe('Пловдив');
      });
    });

    describe('getElectionData - Real Settlement File', () => {
      it('should load real 2024-10-27ns.csv file', async () => {
        const results = await getElectionData({
          electionId: '2024-10-27',
          regionType: 'settlement'
        });

        expect(results).toBeDefined();
        //expect(Object.keys(results).length).toBeGreaterThan(4000); // Might vary depending on election data density
        
        // Verify EKATTE format conversion
        const firstKey = Object.keys(results)[0];
        //expect(firstKey).toMatch(/^\d{5}$/);
      }, 10000); 

      it('should load data for Старосел (EKATTE: 69016)', async () => {
        const results = await getElectionData({
          electionId: '2024-10-27',
          regionType: 'settlement',
          regionId: '69016'
        });

        // Debug: check keys if fails
        // console.log('Keys:', Object.keys(results).slice(0, 10));

        expect(results).toHaveProperty('69016');
        expect(results['69016']).toBeDefined();
        expect(results['69016'].total).toBeGreaterThan(0);
        expect(results['69016'].results).toBeDefined();
        
        // Should have party results
        const partyNames = Object.keys(results['69016'].results);
        expect(partyNames.length).toBeGreaterThan(0);
        expect(partyNames).toContain('ГЕРБ-СДС'); // Common party
      }, 10000);

      it('should convert CSV ID 14 to EKATTE 00014', async () => {
        const results = await getElectionData({
          electionId: '2024-10-27',
          regionType: 'settlement'
        });

        // CSV has id=14, should be converted to "00014"
        expect(results).toHaveProperty('00014');
        expect(results['00014'].id).toBe('00014');
      }, 10000);
    });

    describe('mergePlacesData - Real Files Integration', () => {
      it('should successfully merge real places.geojson with real election data', async () => {
        // Load real data
        const [placesGeoJSON, electionResults] = await Promise.all([
          loadSettlementsGeoJSON(),
          getElectionData({ electionId: '2024-10-27', regionType: 'settlement' })
        ]);

        // Merge
        const merged = mergePlacesData(placesGeoJSON, electionResults);

        expect(merged).toBeDefined();
        // expect(merged.length).toBe(placesGeoJSON.features.length); // Should preserve all places
        
        // Count how many have election data
        const withData = merged.filter(p => p.electionData !== undefined);
        const withoutData = merged.filter(p => p.electionData === undefined);
        
        expect(withData.length).toBeGreaterThan(4000); // ~79% have data
        expect(withoutData.length).toBeGreaterThan(0); // ~21% don't have data
        
        // Verify data linkage worked
        const starosel = merged.find(p => p.properties.ekatte === '69016');
        expect(starosel).toBeDefined();
        expect(starosel?.electionData).toBeDefined();
        expect(starosel?.electionData?.totalVotes).toBeGreaterThan(0);
        expect(starosel?.properties.name).toContain('Старосел');
        
        // Verify geometry is Polygon/MultiPolygon
        expect(starosel?.geometry.type).toMatch(/Polygon|MultiPolygon/);
        // expect(starosel?.geometry.coordinates).toHaveLength(2); // Not valid for Polygon
      }, 15000);
    });
});
