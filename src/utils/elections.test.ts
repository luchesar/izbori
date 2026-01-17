
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  getSettlementsByVotersInMunicipality,
  getPartyColor
} from './elections';
import type { MunicipalityData, Place, SelectedRegion } from '../types';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Helper to create mock fetch response
const mockJsonResponse = (data: any) => ({
  ok: true,
  json: async () => data,
});

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
      fetchMock.mockResolvedValue(mockJsonResponse(mockData));

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
      fetchMock.mockResolvedValueOnce(mockJsonResponse({}));

      // Second call should try again
      await loadMunicipalitiesGeoJSON();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getElectionData', () => {
    const mockApiData = {
      'TestMun': { id: 'TestMun', total: 100, results: { 'Party A': 60 }, meta: { activity: 50, eligible: 200 } }
    };

    it('should cache parsed election data', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(mockApiData));

      // First call
      await getElectionData({ electionId: '2021-04-04', regionType: 'municipality' });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call (same ID/Type means same request)
      const result = await getElectionData({ electionId: '2021-04-04', regionType: 'municipality' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      // Verify data integrity
      expect(result['TestMun'].total).toBe(100);
    });
    
    it('should filter by regionId (municipality)', async () => {
       const mockData = {
         'TestMun': { id: 'TestMun', total: 100, results: {}, meta: {} }
       };
       fetchMock.mockResolvedValue(mockJsonResponse(mockData));

       const result = await getElectionData({
         electionId: '2021-04-04',
         regionType: 'municipality',
         regionId: 'TestMun',
       });

       // API returns filtered data
       expect(result).toHaveProperty('TestMun');
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
        .mockResolvedValueOnce(mockJsonResponse(mockMun)) // municipalities
        .mockResolvedValueOnce(mockJsonResponse(mockSettlements)); // settlements

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
                // Mock the /ns/stats/top-parties endpoint
                fetchMock.mockResolvedValue(mockJsonResponse(['Party C', 'Party A', 'Party B']));

                const top2 = await getTopPartiesFromLastNElections(2);
                expect(top2).toEqual(['Party C', 'Party A', 'Party B']);
          });
      });

      describe('getNationalResults', () => {
          it('should aggregate all settlements data to national level', async () => {
                // Mock the /ns/stats/national/{id} endpoint
                const mockNationalStats = {
                    totalVotes: 300,
                    eligibleVoters: 500,
                    activity: 0.6,
                    topParties: [
                        { party: 'Party A', votes: 200, percentage: 66.67 },
                        { party: 'Party B', votes: 100, percentage: 33.33 }
                    ]
                };
                fetchMock.mockResolvedValue(mockJsonResponse(mockNationalStats));
                
                const result = await getNationalResults('2024-10-27-ns');
                
                expect(result.totalVotes).toBe(300);
                expect(result.eligibleVoters).toBe(500);
                expect(result.activity).toBe(0.6);
                expect(result.topParties[0].party).toBe('Party A');
                expect(result.topParties[0].votes).toBe(200);
          });
      });
      
      describe('getMunicipalitiesByVoters', () => {
          it('should return municipalities sorted by eligible voters', async () => {
              // Mock Geo data
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
              
              // Mock Election Data returned from API
              const mockElectionData = {
                  '00001': { id: '00001', total: 50, results: {}, meta: { eligible: 100, activity: 0.5 } },
                  '00002': { id: '00002', total: 500, results: {}, meta: { eligible: 1000, activity: 0.5 } },
                  '00003': { id: '00003', total: 2000, results: {}, meta: { eligible: 5000, activity: 0.4 } }
              };
                
              fetchMock
               .mockResolvedValueOnce(mockJsonResponse(mockMunGeo))
               .mockResolvedValueOnce(mockJsonResponse(mockPlacesGeo))
               .mockResolvedValueOnce(mockJsonResponse(mockElectionData));

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
                
                const mockElectionData = {
                    '00001': { id: '00001', total: 10, results: {}, meta: { eligible: 100, activity: 0.1 } },
                    '00002': { id: '00002', total: 20, results: {}, meta: { eligible: 200, activity: 0.1 } },
                    '00003': { id: '00003', total: 30, results: {}, meta: { eligible: 300, activity: 0.1 } }
                };
                
                fetchMock
                  .mockResolvedValueOnce(mockJsonResponse(mockPlacesGeo))
                  .mockResolvedValueOnce(mockJsonResponse(mockElectionData));
                
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

  describe('getPartyColor', () => {
    it('should return consistent color for same party name', () => {
      const color1 = getPartyColor('ГЕРБ-СДС');
      const color2 = getPartyColor('ГЕРБ-СДС');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different parties', () => {
      const colorGerb = getPartyColor('ГЕРБ-СДС');
      const colorBsp = getPartyColor('БСП');
      const colorDps = getPartyColor('ДПС');
      
      // All should be different
      expect(colorGerb).not.toBe(colorBsp);
      expect(colorGerb).not.toBe(colorDps);
      expect(colorBsp).not.toBe(colorDps);
    });

    it('should return valid HSL color string', () => {
      const color = getPartyColor('Test Party');
      expect(color).toMatch(/^hsl\(\d+, 70%, 45%\)$/);
    });
  });

});
