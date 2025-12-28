import { describe, it, expect, vi, beforeEach } from 'vitest';
import Papa from 'papaparse';

// Crucial: mock BEFORE import of module under test
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

// Now import module
import { getTopPartiesFromLastNElections } from './elections';

describe('Elections Analysis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should aggregate votes from last N NS elections correctly', async () => {
        // Mock Papa.parse to return controlled data based on URL
        (Papa.parse as any).mockImplementation((url: string, config: any) => {
            let data: any[] = [];
            
            if (url.includes('2024-10-27ns.csv')) {
                // Election 1: A=100, B=50
                data = [{ id: 1, 'Party A': 100, 'Party B': 50 }];
            } else if (url.includes('2024-06-09ns.csv')) {
                // Election 2: A=50, B=50, C=200
                data = [{ id: 1, 'Party A': 50, 'Party B': 50, 'Party C': 200 }];
            } else if (url.includes('2023-04-02ns.csv')) {
                 // Election 3: A=50, D=500
                 data = [{ id: 1, 'Party A': 50, 'Party D': 500 }];
            } else {
                 data = [];
            }
            
            config.complete({ data });
        });

        // Test with N=2 (First two elections)
        // Aggregates:
        // Party A: 100 + 50 = 150
        // Party B: 50 + 50 = 100
        // Party C: 200
        // Expected Order: C (200), A (150), B (100)
        
        const top3 = await getTopPartiesFromLastNElections(2);
        
        expect(top3).toEqual(['Party C', 'Party A', 'Party B']);
        expect(top3).toHaveLength(3);
        
        // Test with N=3
        // Aggregates include Election 3:
        // Party A: 150 + 50 = 200
        // Party B: 100
        // Party C: 200
        // Party D: 500
        // Expected Order: D (500), Party C (200), Party A (200), Party B (100)
        
        const top4 = await getTopPartiesFromLastNElections(3);
        expect(top4[0]).toBe('Party D'); 
        expect(top4).toContain('Party C');
        expect(top4).toContain('Party A');
        expect(top4).toContain('Party B');
        expect(top4.length).toBeGreaterThanOrEqual(4);
    });
});
