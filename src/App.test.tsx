import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { getElectionData, loadMunicipalitiesGeoJSON, loadSettlementsGeoJSON } from './utils/elections';

// Mock the modules
vi.mock('./utils/elections', async () => {
    const actual = await vi.importActual('./utils/elections');
    return {
        ...actual,
        getElectionData: vi.fn(),
        loadMunicipalitiesGeoJSON: vi.fn(),
        loadSettlementsGeoJSON: vi.fn(),
        mergeData: actual.mergeData, // Keep real merge logic to test integration
        searchRegions: actual.searchRegions,
    };
});

describe('App', () => {
    it('renders loading state initially', () => {
        (loadMunicipalitiesGeoJSON as any).mockImplementation(() => new Promise(() => {})); // Hang forever
        render(<App />);
        expect(screen.getByText(/Loading Data/i)).toBeInTheDocument();
    });

    it('renders map and search bar after data loads', async () => {
        (loadMunicipalitiesGeoJSON as any).mockResolvedValue({ type: 'FeatureCollection', features: [] });
        (getElectionData as any).mockResolvedValue({});
        (loadSettlementsGeoJSON as any).mockResolvedValue({ type: 'FeatureCollection', features: [] });

        render(<App />);

        await waitFor(() => {
            expect(screen.queryByText(/Loading Data/i)).not.toBeInTheDocument();
        });

        // Search bar should be present (placeholder text)
        expect(screen.getByPlaceholderText(/Търсене на населено място/i)).toBeInTheDocument();
    });
});
