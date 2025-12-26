import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from './SearchBar';

describe('SearchBar', () => {
    it('should render input field', () => {
        render(<SearchBar onSearch={() => []} onSelect={() => {}} />);
        expect(screen.getByPlaceholderText('Търсене на населено място ...')).toBeInTheDocument();
    });

    it('should call onSearch when typing', () => {
        const handleSearch = vi.fn().mockReturnValue([]);
        render(<SearchBar onSearch={handleSearch} onSelect={() => {}} />);
        
        const input = screen.getByPlaceholderText('Търсене на населено място ...');
        fireEvent.change(input, { target: { value: 'Sofia' } });
        
        expect(handleSearch).toHaveBeenCalledWith('Sofia');
    });

    it('should display results', () => {
        const mockResults = [
            {
                type: "Feature",
                properties: { name: "Sofia-Grad", type: "municipality" },
                electionData: {} // Simulating municipality property
            }
        ] as any[];
        
        const handleSearch = vi.fn().mockImplementation((query) => {
             return query.length >= 2 ? mockResults : [];
        });

        render(<SearchBar onSearch={handleSearch} onSelect={() => {}} />);
        
        const input = screen.getByPlaceholderText('Търсене на населено място ...');
        // Type enough characters to trigger results
        fireEvent.change(input, { target: { value: 'Sofia' } });
        // Focus to make list visible
        fireEvent.focus(input);

        expect(screen.getByText('Sofia-Grad')).toBeInTheDocument();
        expect(screen.getByText('Municipality')).toBeInTheDocument();
    });

    it('should call onSelect when a result is clicked', () => {
         const mockResult = {
            type: "Feature",
            properties: { name: "Sofia-Grad", type: "municipality" },
            electionData: {}
        } as any;
        
        const handleSearch = vi.fn().mockReturnValue([mockResult]);
        const handleSelect = vi.fn();

        render(<SearchBar onSearch={handleSearch} onSelect={handleSelect} />);
        
        const input = screen.getByPlaceholderText('Търсене на населено място ...');
        fireEvent.change(input, { target: { value: 'Sofia' } });
        fireEvent.focus(input);

        const resultItem = screen.getByText('Sofia-Grad');
        fireEvent.click(resultItem);

        expect(handleSelect).toHaveBeenCalledWith(mockResult);
    });
    
     it('should not show results when query is short', () => {
        const handleSearch = vi.fn().mockReturnValue([]);
        render(<SearchBar onSearch={handleSearch} onSelect={() => {}} />);
        
        const input = screen.getByPlaceholderText('Търсене на населено място ...');
        fireEvent.change(input, { target: { value: 'S' } });
        fireEvent.focus(input);
        
        const list = screen.queryByRole('list');
        expect(list).not.toBeInTheDocument();
    });
});
