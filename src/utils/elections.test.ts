
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Papa from 'papaparse';
import {
  getElectionData,
  loadMunicipalitiesGeoJSON,
  loadSettlementsGeoJSON,
  searchRegions,
  AVAILABLE_ELECTIONS,
  clearCache
} from './elections';

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Elections API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache(); // Reset cache for isolation
  });

  describe('AVAILABLE_ELECTIONS', () => {
    it('should have a list of available elections', () => {
      expect(AVAILABLE_ELECTIONS.length).toBeGreaterThan(0);
      expect(AVAILABLE_ELECTIONS[0]).toHaveProperty('date');
      expect(AVAILABLE_ELECTIONS[0]).toHaveProperty('type');
    });
  });

  describe('Geo Loaders (Caching)', () => {
    it('should cache municipalities fetch results', async () => {
      const mockData = { type: 'FeatureCollection', features: [] };
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      // First call
      await loadMunicipalitiesGeoJSON();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call (should hit cache)
      const result = await loadMunicipalitiesGeoJSON();
      expect(fetchMock).toHaveBeenCalledTimes(1); // Call count stays 1
      expect(result).toEqual(mockData);
    });

    it('should retry fetch after error (no negative caching)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      // First call fails
      await expect(loadMunicipalitiesGeoJSON()).rejects.toThrow();

      // Setup success for second call
      const mockData = { ok: true, json: async () => ({}) };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      // Second call should try again
      await loadMunicipalitiesGeoJSON();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getElectionData (Caching)', () => {
    const mockCsvData = [
        { municipality_name: 'TestMun', nuts4: 'BG123', total: 100, activity: 50, eligible_voters: 200, 'Party A': 60 }
    ];

    it('should cache parsed election data', async () => {
      (Papa.parse as any).mockImplementation((url, config) => {
        config.complete({ data: mockCsvData });
      });

      // First call
      await getElectionData({ electionId: '2021-04-04', regionType: 'municipality' });
      expect(Papa.parse).toHaveBeenCalledTimes(1);

      // Second call (same ID/Type means same file)
      const result = await getElectionData({ electionId: '2021-04-04', regionType: 'municipality' });
      expect(Papa.parse).toHaveBeenCalledTimes(1);
      
      // Verify data integrity
      expect(result['TestMun'].total).toBe(100);
    });

    it('should reuse cache for different filters on same file', async () => {
        (Papa.parse as any).mockImplementation((url, config) => {
          config.complete({ data: mockCsvData });
        });
  
        // First call: Load file
        await getElectionData({ electionId: '2021-04-04', regionType: 'municipality' });
        
        // Second call: Filter by region (should use cached file data)
        const filtered = await getElectionData({ 
            electionId: '2021-04-04', 
            regionType: 'municipality',
            regionId: 'TestMun' 
        });
  
        expect(Papa.parse).toHaveBeenCalledTimes(1);
        expect(filtered).toHaveProperty('TestMun');
      });
  });

  describe('getElectionData (Logic)', () => {
    const mockCsvData = [
      {
        municipality_name: 'TestMun',
        nuts4: 'BG123',
        total: 100,
        activity: 50,
        eligible_voters: 200,
        'Party A': 60,
        'Party B': 40,
        region: 'TestRegion', 
        region_name: 'TestRegionName',
        n_stations: 5
      },
      {
        municipality_name: 'OtherMun',
        nuts4: 'BG456',
        total: 150,
        activity: 60,
        eligible_voters: 250,
        'Party A': 100,
        'Party B': 50,
        region: 'TestRegion',
        region_name: 'TestRegionName',
        n_stations: 5
      },
    ];

    beforeEach(() => {
        (Papa.parse as any).mockImplementation((url, config) => {
            config.complete({ data: mockCsvData });
        });
    });

    it('should filter by regionId (municipality)', async () => {
      const result = await getElectionData({
        electionId: '2021-04-04',
        regionType: 'municipality',
        regionId: 'TestMun',
      });

      expect(Object.keys(result)).toHaveLength(1);
      expect(result).toHaveProperty('TestMun');
      expect(result).not.toHaveProperty('OtherMun');
    });

    it('should filter by parties', async () => {
      const result = await getElectionData({
        electionId: '2021-04-04',
        regionType: 'municipality',
        parties: ['Party A'],
      });

      expect(result['TestMun'].results).toHaveProperty('Party A');
      expect(result['TestMun'].results).not.toHaveProperty('Party B');
    });
  });

  describe('searchRegions', () => {
    it('should search across municipalities and settlements', async () => {
      const mockMun = {
        features: [
          { properties: { name: 'Sofia' } },
          { properties: { name: 'Plovdiv' } },
        ]
      };
      const mockSettlements = {
        features: [
          { properties: { name: 'Sofievka' } }, // hypothetical
          { properties: { name: 'Varna' } },
        ]
      };

      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => mockMun }) // municipalities
        .mockResolvedValueOnce({ ok: true, json: async () => mockSettlements }); // settlements

      const result = await searchRegions('Sof');
      
      expect(result).toHaveLength(2); // Sofia and Sofievka
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'Sofia', type: 'municipality' }),
        expect.objectContaining({ name: 'Sofievka', type: 'settlement' })
      ]));
    });
  });

  describe('loadPlacesData', () => {
    it('should load places.json data', async () => {
      const mockPlacesData = [
        { ekatte: '00014', name: 'с. Абланица', lat: 41.66, lng: 24.51, oblast: 'Смолян', obshtina: 'Чепеларе' },
        { ekatte: '69016', name: 'с. Старосел', lat: 42.52, lng: 24.52, oblast: 'Пловдив', obshtina: 'Хисаря' }
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesData
      });

      const { loadPlacesData } = await import('./elections');
      const result = await loadPlacesData();

      expect(result).toEqual(mockPlacesData);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('ekatte');
      expect(result[0].ekatte).toBe('00014');
    });

    it('should cache places.json data', async () => {
      const mockPlacesData = [
        { ekatte: '00014', name: 'с. Абланица', lat: 41.66, lng: 24.51, oblast: 'Смолян', obshtina: 'Чепеларе' }
      ];

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockPlacesData
      });

      const { loadPlacesData } = await import('./elections');
      
      // First call
      await loadPlacesData();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await loadPlacesData();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockPlacesData);
    });

    it('should throw error if places.json fails to load', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const { loadPlacesData } = await import('./elections');
      await expect(loadPlacesData()).rejects.toThrow('Failed to load places.json');
    });
  });

  describe('getElectionData - Settlement Support', () => {
    const mockSettlementCsvData = [
      {
        id: 14,  // Integer without leading zeros
        total: 1131,
        total_valid: 1126,
        activity: 0.488,
        eligible_voters: 2316,
        'ГЕРБ-СДС': 124,
        'ПП/ДБ': 20,
        'невалидни': 5
      },
      {
        id: 69016, // Старосел
        total: 216,
        total_valid: 211,
        activity: 0.283,
        eligible_voters: 763,
        'ГЕРБ-СДС': 40,
        'ПП/ДБ': 9,
        'невалидни': 5
      }
    ];

    beforeEach(() => {
      (Papa.parse as any).mockImplementation((url, config) => {
        config.complete({ data: mockSettlementCsvData });
      });
    });

    it('should convert CSV integer IDs to EKATTE format (with leading zeros)', async () => {
      const result = await getElectionData({
        electionId: '2024-10-27',
        regionType: 'settlement'
      });

      // CSV ID 14 should become EKATTE "00014"
      expect(result).toHaveProperty('00014');
      expect(result['00014'].id).toBe('00014');
      expect(result['00014'].total).toBe(1131);

      // CSV ID 69016 should become EKATTE "69016" (no change as it's already 5 digits)
      expect(result).toHaveProperty('69016');
      expect(result['69016'].id).toBe('69016');
      expect(result['69016'].total).toBe(216);
    });

    it('should filter settlements by EKATTE code', async () => {
      const result = await getElectionData({
        electionId: '2024-10-27',
        regionType: 'settlement',
        regionId: '00014' // EKATTE format with leading zeros
      });

      expect(Object.keys(result)).toHaveLength(1);
      expect(result).toHaveProperty('00014');
      expect(result).not.toHaveProperty('69016');
    });

    it('should exclude invalid votes (невалидни) from party results', async () => {
      const result = await getElectionData({
        electionId: '2024-10-27',
        regionType: 'settlement'
      });

      expect(result['00014'].results).toHaveProperty('ГЕРБ-СДС');
      expect(result['00014'].results).toHaveProperty('ПП/ДБ');
      expect(result['00014'].results).not.toHaveProperty('невалидни');
    });

    it('should include activity and eligible voters in meta', async () => {
      const result = await getElectionData({
        electionId: '2024-10-27',
        regionType: 'settlement',
        regionId: '69016'
      });

      expect(result['69016'].meta).toHaveProperty('activity');
      expect(result['69016'].meta.activity).toBe(0.283);
      expect(result['69016'].meta.eligible).toBe(763);
    });
  });

  describe('mergePlacesData', () => {
    const mockPlacesData = [
      { 
        type: 'Feature',
        properties: { ekatte: '00014', name: 'с. Абланица', oblast: 'Смолян', obshtina: 'Чепеларе' },
        geometry: { type: 'Point', coordinates: [24.51, 41.66] }
      },
      { 
        type: 'Feature',
        properties: { ekatte: '69016', name: 'с. Старосел', oblast: 'Пловдив', obshtina: 'Хисаря' },
        geometry: { type: 'Point', coordinates: [24.52, 42.52] }
      },
      { 
        type: 'Feature',
        properties: { ekatte: '12345', name: 'с. NoData', oblast: 'Test', obshtina: 'Test' },
        geometry: { type: 'Point', coordinates: [25.0, 42.0] }
      }
    ];

    const mockElectionResults = {
      '00014': {
        id: '00014',
        total: 1131,
        results: { 'ГЕРБ-СДС': 124, 'ПП/ДБ': 20 },
        meta: { activity: 0.488, eligible: 2316 }
      },
      '69016': {
        id: '69016',
        total: 216,
        results: { 'ГЕРБ-СДС': 40, 'ПП/ДБ': 9 },
        meta: { activity: 0.283, eligible: 763 }
      }
    };

    it('should merge places data with election results using EKATTE codes', async () => {
      const { mergePlacesData } = await import('./elections');
      const result = mergePlacesData(mockPlacesData, mockElectionResults);

      expect(result).toHaveLength(3);
      
      // Check place with election data
      const starosel = result.find(p => p.properties.ekatte === '69016');
      expect(starosel).toBeDefined();
      expect(starosel?.electionData).toBeDefined();
      expect(starosel?.electionData?.totalVotes).toBe(216);
      expect(starosel?.electionData?.activity).toBe(0.283);
      expect(starosel?.electionData?.topParties).toHaveLength(2);
    });

    it('should convert places to GeoJSON Point features', async () => {
      const { mergePlacesData } = await import('./elections');
      const result = mergePlacesData(mockPlacesData, mockElectionResults);

      const place = result[0];
      expect(place.type).toBe('Feature');
      expect(place.geometry.type).toBe('Point');
      expect(place.geometry.coordinates).toHaveLength(2);
      expect(place.geometry.coordinates[0]).toBe(24.51); // lng
      expect(place.geometry.coordinates[1]).toBe(41.66); // lat
    });

    it('should handle places without election data gracefully', async () => {
      const { mergePlacesData } = await import('./elections');
      const result = mergePlacesData(mockPlacesData, mockElectionResults);

      const noDataPlace = result.find(p => p.properties.ekatte === '12345');
      expect(noDataPlace).toBeDefined();
      expect(noDataPlace?.electionData).toBeUndefined();
      expect(noDataPlace?.properties.name).toBe('с. NoData');
    });

    it('should calculate party percentages correctly', async () => {
      const { mergePlacesData } = await import('./elections');
      const result = mergePlacesData(mockPlacesData, mockElectionResults);

      const starosel = result.find(p => p.properties.ekatte === '69016');
      const topParty = starosel?.electionData?.topParties[0];
      
      expect(topParty).toBeDefined();
      expect(topParty?.party).toBe('ГЕРБ-СДС');
      expect(topParty?.votes).toBe(40);
      expect(topParty?.percentage).toBeCloseTo((40 / 216) * 100, 2);
    });

    it('should sort parties by votes in descending order', async () => {
      const { mergePlacesData } = await import('./elections');
      const result = mergePlacesData(mockPlacesData, mockElectionResults);

      const place = result.find(p => p.properties.ekatte === '00014');
      const parties = place?.electionData?.topParties;
      
      expect(parties).toBeDefined();
      expect(parties![0].votes).toBeGreaterThanOrEqual(parties![1].votes);
      expect(parties![0].party).toBe('ГЕРБ-СДС'); // 124 votes
      expect(parties![1].party).toBe('ПП/ДБ'); // 20 votes
    });
  });

  // Integration tests with real files
  /* Integration Tests moved to elections_integration.test.ts */

});

