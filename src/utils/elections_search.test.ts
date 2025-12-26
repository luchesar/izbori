import { describe, it, expect } from 'vitest';
import { searchRegions } from './elections';
import type { MunicipalityData, Place, SelectedRegion } from '../types';

describe('searchRegions', () => {
    const mockMunicipalities: MunicipalityData[] = [
        {
            type: "Feature",
            properties: { name: "Sofia-Grad", nuts4: "BG411", type: "municipality" },
            geometry: { type: "Polygon", coordinates: [] },
        },
        {
            type: "Feature",
            properties: { name: "Plovdiv", nuts4: "BG421", type: "municipality" },
            geometry: { type: "Polygon", coordinates: [] },
        },
        {
            type: "Feature",
            properties: { name: "Varna", nuts4: "BG331", type: "municipality" },
            geometry: { type: "Polygon", coordinates: [] },
        }
    ] as any[];

    const mockPlaces: Place[] = [
        {
            type: "Feature",
            properties: { name: "Sofia", ekatte: "68134", oblast: "SOF", obshtina: "SOF46" },
            geometry: { type: "Polygon", coordinates: [] },
        },
        {
             type: "Feature",
            properties: { name: "Sopot", ekatte: "68080", oblast: "PDV", obshtina: "PDV32" },
            geometry: { type: "Polygon", coordinates: [] },
        },
        {
            type: "Feature",
            properties: { name: "Varnentsi", ekatte: "10135", oblast: "SLS", obshtina: "SLS35" },
            geometry: { type: "Polygon", coordinates: [] },
        }
    ] as any[];


    it('should return empty array for query length less than 2', () => {
        expect(searchRegions('', mockMunicipalities, mockPlaces)).toEqual([]);
        expect(searchRegions('a', mockMunicipalities, mockPlaces)).toEqual([]);
    });

    it('should filter municipalities correctly (case-insensitive)', () => {
        const results = searchRegions('plovdiv', mockMunicipalities, mockPlaces);
        expect(results).toHaveLength(1);
        expect(results[0].properties.name).toBe('Plovdiv');
    });

     it('should filter places correctly (case-insensitive)', () => {
        const results = searchRegions('sopot', mockMunicipalities, mockPlaces);
        expect(results).toHaveLength(1);
        expect(results[0].properties.name).toBe('Sopot');
    });

    it('should return both municipalities and places matching query', () => {
         const results = searchRegions('sofia', mockMunicipalities, mockPlaces);
         // Expect Sofia-Grad (mun) and Sofia (place)
         expect(results).toHaveLength(2);
         const names = results.map(r => r.properties.name);
         expect(names).toContain('Sofia-Grad');
         expect(names).toContain('Sofia');
    });
    
    it('should partial match', () => {
         const results = searchRegions('var', mockMunicipalities, mockPlaces);
         // Expect Varna (mun) and Varnentsi (place)
         expect(results).toHaveLength(2);
         const names = results.map(r => r.properties.name);
         expect(names).toContain('Varna');
         expect(names).toContain('Varnentsi');
    });

    it('should limit results to 10', () => {
        // Create a large list of matches
        const manyPlaces = Array.from({ length: 20 }, (_, i) => ({
             type: "Feature",
            properties: { name: `TestPlace ${i}`, ekatte: `${i}`, oblast: "TST", obshtina: "TST01" },
            geometry: { type: "Polygon", coordinates: [] },
        })) as any[];

         const results = searchRegions('test', [], manyPlaces);
         expect(results).toHaveLength(10);
    });
});
