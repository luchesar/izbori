
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Papa from 'papaparse';
import {
  getElectionData,
  loadMunicipalitiesGeoJSON,
  loadSettlementsGeoJSON,
  searchRegions,
  AVAILABLE_ELECTIONS,
  clearCache,
  mergePlacesData,
  getTopPartiesFromLastNElections,
  getNationalResults,
  getMunicipalitiesByVoters,
  getSettlementsByVotersInMunicipality
} from './elections';
import type { MunicipalityData, Place, SelectedRegion } from '../types';

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Elections API & Analysis', () => {
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

  describe('getElectionData', () => {
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
    
    it('should filter by regionId (municipality)', async () => {
       const mockData = [
           { municipality_name: 'TestMun', nuts4: 'BG123', total: 100 },
           { municipality_name: 'OtherMun', nuts4: 'BG456', total: 150 }
       ];
       (Papa.parse as any).mockImplementation((url, config) => {
           config.complete({ data: mockData });
       });

       const result = await getElectionData({
         electionId: '2021-04-04',
         regionType: 'municipality',
         regionId: 'TestMun',
       });

       expect(Object.keys(result)).toHaveLength(1);
       expect(result).toHaveProperty('TestMun');
       expect(result).not.toHaveProperty('OtherMun');
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
          { properties: { name: 'Sofievka' } }, 
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
    
    it('should work with synchronous inputs', () => {
        const mockMunicipalities: MunicipalityData[] = [
            { type: "Feature", properties: { name: "Sofia-Grad" }, geometry: { type: "Polygon", coordinates: [] } } as any,
        ];
        const mockPlaces: Place[] = [
            { type: "Feature", properties: { name: "Sofia", ekatte: "68134", oblast: "SOF", obshtina: "SOF46" }, geometry: { type: "Polygon", coordinates: [] } } as any,
        ];

        const results = searchRegions('sofia', mockMunicipalities, mockPlaces);
        expect(results).toHaveLength(2);
    });
  });
  
  describe('Analysis Utilities', () => {
      
      describe('getTopPartiesFromLastNElections', () => {
          it('should aggregate votes from last N elections', async () => {
                // Mock Papa.parse to return different data based on URL (Election ID)
                (Papa.parse as any).mockImplementation((url: string, config: any) => {
                    let data: any[] = [];
                    if (url.includes('2024-10-27ns.csv')) {
                        // Election 1 (Latest): A=100, B=50
                        data = [{ id: 1, 'Party A': 100, 'Party B': 50 }];
                    } else if (url.includes('2024-06-09ns.csv')) {
                        // Election 2: A=50, B=50, C=200
                        data = [{ id: 1, 'Party A': 50, 'Party B': 50, 'Party C': 200 }];
                    } else if (url.includes('2023-04-02ns.csv')) {
                         // Election 3: A=50, D=500
                         data = [{ id: 1, 'Party A': 50, 'Party D': 500 }];
                    } else {
                        // Other elections (should typically not be called if N=3 and we sorted correct)
                         data = [];
                    }
                    config.complete({ data });
                });

                // Top 2 elections (2024-10-27 and 2024-06-09)
                // A: 100 + 50 = 150
                // B: 50 + 50 = 100
                // C: 200
                // Order: C, A, B
                const top2 = await getTopPartiesFromLastNElections(2);
                expect(top2).toEqual(['Party C', 'Party A', 'Party B']);
          });
      });

      describe('getNationalResults', () => {
          it('should aggregate all settlements data to national level', async () => {
                const mockSettlementData = [
                    { id: 1, total: 100, eligible: 200, activity: 0.5, 'Party A': 60, 'Party B': 40 },
                    { id: 2, total: 200, eligible: 300, activity: 0.66, 'Party A': 140, 'Party B': 60 }
                ];
                // Note: getElectionData logic puts 'eligible' in 'meta' usually, but mock CSV has 'eligible_voters' or 'eligible'?
                // getElectionData maps `eligible_voters` col to `meta.eligible`.
                // So mock CSV should have `eligible_voters`.
                
                (Papa.parse as any).mockImplementation((url, config) => {
                     config.complete({
                         data: [
                             { id: 1, total: 100, eligible_voters: 200, 'Party A': 60, 'Party B': 40 },
                             { id: 2, total: 200, eligible_voters: 300, 'Party A': 140, 'Party B': 60 }
                         ]
                     });
                });
                
                const result = await getNationalResults('2024-10-27-ns');
                
                expect(result.totalVotes).toBe(300); // 100 + 200
                expect(result.eligibleVoters).toBe(500); // 200 + 300
                expect(result.activity).toBe(300 / 500); // 0.6
                
                // Party A: 60 + 140 = 200
                // Party B: 40 + 60 = 100
                expect(result.topParties[0].party).toBe('Party A');
                expect(result.topParties[0].votes).toBe(200);
                expect(result.topParties[0].percentage).toBeCloseTo(66.67, 1);
          });
      });
      
      describe('getMunicipalitiesByVoters', () => {
          it('should return municipalities sorted by eligible voters', async () => {
              // Mock Geo and Places
              const mockMunGeo = {

                  features: [
                      { type: 'Feature', properties: { name: 'MunSmall' } },
                      { type: 'Feature', properties: { name: 'MunLarge' } },
                      { type: 'Feature', properties: { name: 'Столична община' } }
                  ]
              };
              const mockPlacesGeo = {
                  features: [
                      { properties: { ekatte: '00001', obshtina: 'MunSmall' } },
                      { properties: { ekatte: '00002', obshtina: 'MunLarge' } },
                      { properties: { ekatte: '00003', obshtina: 'Столична' } }
                  ]
              };
              
              // Mock Election Data
              // Place 1 (Small): 100 eligible
              // Place 2 (Large): 1000 eligible
               (Papa.parse as any).mockImplementation((url, config) => {
                     config.complete({
                         data: [
                             { id: 1, total: 50, eligible_voters: 100 },
                             { id: 2, total: 500, eligible_voters: 1000 },
                             { id: 3, total: 2000, eligible_voters: 5000 }
                         ]
                     });
                });
                
               fetchMock
                .mockResolvedValueOnce({ ok: true, json: async () => mockMunGeo })
                .mockResolvedValueOnce({ ok: true, json: async () => mockPlacesGeo });

               const result = await getMunicipalitiesByVoters('2024-10-27-ns');
               

               // Sorted by eligible voters: Sofia(5000) > MunLarge(1000) > MunSmall(100)
               expect(result).toHaveLength(3);
               expect(result[0].properties.name).toBe('Столична община');
               expect(result[0].electionData?.eligibleVoters).toBe(5000);
               expect(result[1].properties.name).toBe('MunLarge');
               expect(result[1].electionData?.eligibleVoters).toBe(1000);
               expect(result[2].properties.name).toBe('MunSmall');
               expect(result[2].electionData?.eligibleVoters).toBe(100);
          });
      });

      describe('getSettlementsByVotersInMunicipality', () => {
          it('should return settlements in municipality sorted by eligible voters', async () => {
                const mockPlacesGeo = {
                    features: [
                        { properties: { ekatte: '00001', obshtina: 'TargetMun', name: 'S1' } },
                        { properties: { ekatte: '00002', obshtina: 'OtherMun', name: 'S2' } },
                        { properties: { ekatte: '00003', obshtina: 'TargetMun', name: 'S3' } }
                    ]
                };
                
                 (Papa.parse as any).mockImplementation((url, config) => {
                     config.complete({
                         data: [
                             { id: 1, total: 10, eligible_voters: 100 },
                             { id: 2, total: 20, eligible_voters: 200 },
                             { id: 3, total: 30, eligible_voters: 300 }
                         ]
                     });
                });
                
                fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockPlacesGeo });
                
                const result = await getSettlementsByVotersInMunicipality('2024-10-27-ns', 'TargetMun');
                
                // Should return S3 (300) then S1 (100). S2 is other mun.
                expect(result).toHaveLength(2);
                expect(result[0].properties.name).toBe('S3');
                expect(result[0].electionData?.eligibleVoters).toBe(300);
                expect(result[1].properties.name).toBe('S1');
                expect(result[1].electionData?.eligibleVoters).toBe(100);
          });
      });
  });

});
