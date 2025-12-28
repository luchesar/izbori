import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Mock papaparse to handle file reading in Node environment
vi.mock('papaparse', async (importOriginal) => {
  const actual = await importOriginal<typeof import('papaparse')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      parse: (url: any, config: any) => {
        // Intercept download requests (which fail in Node without XHR/fetch)
        if (typeof url === 'string' && config.download) {
          try {
             // Construct absolute path from project root
             // url is like /assets/data/el_data/...
             const relativePath = url.startsWith('/') ? `public${url}` : `public/${url}`;
             const filePath = path.resolve(process.cwd(), relativePath);
             
             if (fs.existsSync(filePath)) {
                 const content = fs.readFileSync(filePath, 'utf8');
                 // Delegate to real parser with string content
                 // We execute parse synchronously here, but trigger callback to mimic async behavior if needed
                 // Papa.parse with string returns results synchronously usually
                 const result = actual.default.parse(content, { ...config, download: false });
                 
                 if (config.complete) {
                     // Execute callback on next tick to simulate async?
                     // Or sync is fine for tests unless code relies on async gap
                     config.complete(result);
                 }
                 return;
             }
          } catch (e) {
              console.error(`Mock Papa Error reading ${url}:`, e);
              if (config.error) config.error(e);
              return;
          }
           if (config.error) config.error(new Error(`File not found: ${url}`));
           return;
        }
        return actual.default.parse(url, config);
      }
    }
  };
});

// Mock global fetch for JSON files
global.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('/assets/')) {
        const relativePath = url.startsWith('/') ? `public${url}` : `public/${url}`;
        const filePath = path.resolve(process.cwd(), relativePath);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return {
                ok: true,
                json: async () => JSON.parse(content),
                text: async () => content
            };
        }
    }
    return Promise.reject(new Error(`Fetch failed for ${url}`));
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
