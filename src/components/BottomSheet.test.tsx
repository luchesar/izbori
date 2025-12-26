import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomSheet from './BottomSheet';

describe('BottomSheet', () => {
    it('does not render when data is null', () => {
        render(<BottomSheet data={null} onClose={() => {}} />);
        expect(screen.queryByText('Total Votes')).not.toBeInTheDocument();
    });

    it('renders region name and closes on button click', () => {
        const mockData = {
            type: 'Feature' as const,
            properties: { name: 'Test Region', nuts4: 'BG001' },
            geometry: { type: 'Polygon' as const, coordinates: [] }
        };
        const onClose = vi.fn();

        render(<BottomSheet data={mockData as any} onClose={onClose} />);

        expect(screen.getByText('Test Region')).toBeInTheDocument();
        
        const closeBtn = screen.getByLabelText('Close details');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });

    it('shows election data when available', () => {
        const mockData = {
             type: 'Feature' as const,
             properties: { name: 'Test City' },
             geometry: { type: 'Polygon' as const, coordinates: [] },
             electionData: {
                 totalVotes: 12345,
                 activity: 0.45,
                 topParties: [
                     { party: 'Party A', votes: 5000, percentage: 40.5 },
                     { party: 'Party B', votes: 3000, percentage: 24.3 }
                 ]
             }
        };

        render(<BottomSheet data={mockData as any} onClose={() => {}} />);

        expect(screen.getByText('12,345')).toBeInTheDocument(); // formatted number
        expect(screen.getByText('45.0%')).toBeInTheDocument();
        expect(screen.getByText('Party A')).toBeInTheDocument();
    });
});
