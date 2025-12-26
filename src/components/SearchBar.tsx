import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SelectedRegion } from '../types';

interface SearchBarProps {
  onSearch: (query: string) => SelectedRegion[];
  onSelect: (region: SelectedRegion) => void;
}

export default function SearchBar({ onSearch, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SelectedRegion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (val.length >= 2) {
      setResults(onSearch(val));
    } else {
      setResults([]);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsFocused(false);
  };

  const handleSelect = (region: SelectedRegion) => {
    onSelect(region);
    handleClear();
  };

  return (
    <div 
        ref={wrapperRef}
        className="absolute top-4 left-4 right-4 z-[9999] md:left-1/2 md:-translate-x-1/2 md:max-w-md"
    >
      <div className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Търсене на населено място ..."
          className="block w-full pl-10 pr-10 py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full shadow-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm font-medium"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isFocused && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute w-full mt-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden"
          >
            <ul className="max-h-[60vh] overflow-y-auto py-2">
              {results.map((result) => {
                 const isMunicipality = 'electionData' in result; // or check properties structure
                 const name = result.properties.name;
                 const type = isMunicipality ? 'Municipality' : 'Place';
                 
                 return (
                    <li key={result.properties.name + ('ekatte' in result.properties ? result.properties.ekatte : 'mun')}>
                        <button
                            onClick={() => handleSelect(result)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 flex items-center gap-3 transition-colors"
                        >
                            <div className={`p-2 rounded-full ${isMunicipality ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {isMunicipality ? <Building2 size={18} /> : <MapPin size={18} />}
                            </div>
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                    {name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {type}
                                    {!isMunicipality && 'obshtina' in result.properties && ` • ${result.properties.obshtina}`}
                                </div>
                            </div>
                        </button>
                    </li>
                 );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
