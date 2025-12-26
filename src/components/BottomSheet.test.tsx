import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomSheet from './BottomSheet';
import type { Place, MunicipalityData, ElectionResult } from '../types';

describe('BottomSheet', () => {
    describe('Basic functionality', () => {
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
            
            const closeBtn = screen.getByLabelText('Затвори детайли');
            fireEvent.click(closeBtn);
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Settlement with election data', () => {
        it('should display election data for settlement with results', () => {
            const mockPlace: Place = {
                type: 'Feature',
                properties: {
                    ekatte: '00014',
                    name: 'гр. Старосел',
                    oblast: 'Пловдив',
                    obshtina: 'Хисаря'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [24.0, 42.0]
                },
                electionData: {
                    totalVotes: 1131,
                    activity: 0.488,
                    topParties: [
                        { party: 'ДПС-Доган', votes: 544, percentage: 48.3 },
                        { party: 'ДПС-Пеев', votes: 298, percentage: 26.5 },
                        { party: 'ГЕРБ-СДС', votes: 124, percentage: 11.0 }
                    ] as ElectionResult[]
                }
            };

            render(<BottomSheet data={mockPlace} onClose={() => {}} />);

            // Check that the settlement name is displayed
            expect(screen.getByText('гр. Старосел')).toBeInTheDocument();

            // Check that election results are displayed
            expect(screen.getByText('ГЕРБ-СДС')).toBeInTheDocument();
            expect(screen.getByText('ДПС-Доган')).toBeInTheDocument();
            expect(screen.getByText('ДПС-Пеев')).toBeInTheDocument();

            // Check that percentages are displayed (with .toFixed(2))
            expect(screen.getByText(/48\.30%/)).toBeInTheDocument();
            expect(screen.getByText(/26\.50%/)).toBeInTheDocument();
            expect(screen.getByText(/11\.00%/)).toBeInTheDocument();
        });

        it('should display turnout information for settlements', () => {
            const mockPlace: Place = {
                type: 'Feature',
                properties: {
                    ekatte: '00014',
                    name: 'гр. Старосел',
                    oblast: 'Пловдив',
                    obshtina: 'Хисаря'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [24.0, 42.0]
                },
                electionData: {
                    totalVotes: 1131,
                    activity: 0.488,
                    topParties: [
                        { party: 'ГЕРБ-СДС', votes: 124, percentage: 11.0 }
                    ] as ElectionResult[]
                }
            };

            render(<BottomSheet data={mockPlace} onClose={() => {}} />);

            // Check activity/turnout percentage (activity * 100)
            expect(screen.getByText(/48\.8%/)).toBeInTheDocument();
            
            // Check voter counts (formatted with commas)
            expect(screen.getByText(/1,131/)).toBeInTheDocument(); // total votes
        });
    });

    describe('Settlement without election data', () => {
        it('should display Bulgarian message when no election data is available', () => {
            const mockPlace: Place = {
                type: 'Feature',
                properties: {
                    ekatte: '12345',
                    name: 'с. Тестово',
                    oblast: 'София',
                    obshtina: 'София'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [23.0, 42.0]
                }
                // No electionData field
            };

            render(<BottomSheet data={mockPlace} onClose={() => {}} />);

            // Check that the settlement name is displayed
            expect(screen.getByText('с. Тестово')).toBeInTheDocument();

            // Check that the Bulgarian "no data" message is displayed
            expect(screen.getByText('Няма изборни данни за това населено място')).toBeInTheDocument();
        });

        it('should display Bulgarian message for settlement with undefined electionData', () => {
            const mockPlace: Place = {
                type: 'Feature',
                properties: {
                    ekatte: '99999',
                    name: 'с. Друго село',
                    oblast: 'Варна',
                    obshtina: 'Варна'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [27.0, 43.0]
                },
                electionData: undefined
            };

            render(<BottomSheet data={mockPlace} onClose={() => {}} />);

            expect(screen.getByText('с. Друго село')).toBeInTheDocument();
            expect(screen.getByText('Няма изборни данни за това населено място')).toBeInTheDocument();
        });
    });

    describe('Municipality with election data', () => {
        it('should display election data for municipality', () => {
            const mockMunicipality: MunicipalityData = {
                type: 'Feature',
                properties: {
                    name: 'Пловдив',
                    nuts4: 'PLV',
                    oblast: 'Пловдив'
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[24.0, 42.0], [24.1, 42.0], [24.1, 42.1], [24.0, 42.1], [24.0, 42.0]]]
                },
                electionData: {
                    totalVotes: 14500,
                    activity: 0.483,
                    topParties: [
                        { party: 'ГЕРБ-СДС', votes: 5000, percentage: 35.0 },
                        { party: 'ПП/ДБ', votes: 3000, percentage: 21.0 }
                    ] as ElectionResult[]
                }
            };

            render(<BottomSheet data={mockMunicipality} onClose={() => {}} />);

            expect(screen.getByText('Пловдив')).toBeInTheDocument();
            expect(screen.getByText('ГЕРБ-СДС')).toBeInTheDocument();
            expect(screen.getByText('ПП/ДБ')).toBeInTheDocument();
            expect(screen.getByText(/35\.00%/)).toBeInTheDocument();
            expect(screen.getByText(/21\.00%/)).toBeInTheDocument();
        });
    });

    describe('Cyrillic name display', () => {
        it('should correctly display settlement names with Cyrillic characters', () => {
            const cyrillicNames = [
                'гр. София',
                'с. Баня',
                'гр. Пловдив',
                'с. Червен бряг'
            ];

            cyrillicNames.forEach(name => {
                const mockPlace: Place = {
                    type: 'Feature',
                    properties: {
                        ekatte: '00001',
                        name: name,
                        oblast: 'София',
                        obshtina: 'София'
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [23.0, 42.0]
                    }
                };

                const { unmount } = render(<BottomSheet data={mockPlace} onClose={() => {}} />);
                expect(screen.getByText(name)).toBeInTheDocument();
                unmount();
            });
        });

        it('should correctly display oblast and obshtina in Cyrillic', () => {
            const mockPlace: Place = {
                type: 'Feature',
                properties: {
                    ekatte: '00014',
                    name: 'гр. Старосел',
                    oblast: 'Пловдив',
                    obshtina: 'Хисаря'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [24.0, 42.0]
                }
            };

            render(<BottomSheet data={mockPlace} onClose={() => {}} />);

            // These should be displayed somewhere in the component
            expect(screen.getByText(/Пловдив/)).toBeInTheDocument();
            expect(screen.getByText(/Хисаря/)).toBeInTheDocument();
        });
    });
});
