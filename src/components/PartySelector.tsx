import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPartyColor } from '../utils/elections';

interface PartyResult {
    party: string;
    votes: number;
    percentage: number;
}

interface PartySelectorProps {
    parties: PartyResult[];
    selectedParty: string | null;
    onPartyChange: (party: string) => void;
}

export default function PartySelector({ parties, selectedParty, onPartyChange }: PartySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Take top 10 parties
    const topParties = parties.slice(0, 10);
    const selectedPartyData = topParties.find(p => p.party === selectedParty);
    const selectedColor = selectedParty ? getPartyColor(selectedParty) : '#888';

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-zinc-800/90 transition-colors"
                >
                    <span 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedColor }}
                    />
                    <span className="max-w-[100px] truncate">{selectedPartyData?.party || 'Партия'}</span>
                    <ChevronDown 
                        size={12} 
                        className={`text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full mt-1 right-0 w-48 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-lg shadow-lg overflow-hidden z-30"
                        >
                            <div className="max-h-56 overflow-y-auto">
                                {topParties.map((party) => {
                                    const color = getPartyColor(party.party);
                                    const isSelected = selectedParty === party.party;
                                    
                                    return (
                                        <button
                                            key={party.party}
                                            onClick={() => { onPartyChange(party.party); setIsOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                                                isSelected
                                                    ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-zinc-700/50'
                                            }`}
                                        >
                                            <span 
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="truncate flex-1">{party.party}</span>
                                            <span className="text-gray-400 text-[10px]">{party.percentage.toFixed(1)}%</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
