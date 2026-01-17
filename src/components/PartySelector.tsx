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
    selectedParty: string | string[] | null;
    onPartyChange: (party: any) => void;
    multiSelect?: boolean;
}

export default function PartySelector({ parties, selectedParty, onPartyChange, multiSelect = false }: PartySelectorProps) {
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
    
    // Helper to check selection
    const isSelected = (party: string) => {
        if (multiSelect) {
            return Array.isArray(selectedParty) && selectedParty.includes(party);
        }
        return selectedParty === party;
    };

    // Helper for button text/color
    const getButtonContent = () => {
        if (multiSelect) {
            const selected = (selectedParty as string[]) || [];
            if (selected.length === 0) return { text: 'Избери партии', color: '#888' };
            if (selected.length === 1) {
                const p = topParties.find(tp => tp.party === selected[0]);
                return { 
                    text: p ? p.party : selected[0], 
                    color: getPartyColor(selected[0]) 
                };
            }
            return { text: `${selected.length} партии`, color: '#888' };
        } else {
             const p = topParties.find(tp => tp.party === selectedParty);
             return {
                 text: p ? p.party : 'Партия',
                 color: selectedParty ? getPartyColor(selectedParty as string) : '#888'
             };
        }
    };

    const { text, color } = getButtonContent();

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-zinc-800/90 transition-colors"
                >
                    <span 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                    />
                    <span className="max-w-[100px] truncate">{text}</span>
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
                                    const selected = isSelected(party.party);
                                    
                                    return (
                                        <button
                                            key={party.party}
                                            onClick={() => { 
                                                if (multiSelect) {
                                                    const current = (selectedParty as string[]) || [];
                                                    if (selected) {
                                                        onPartyChange(current.filter(p => p !== party.party));
                                                    } else {
                                                        onPartyChange([...current, party.party]);
                                                    }
                                                    // Don't close on selection in multi mode
                                                } else {
                                                    onPartyChange(party.party); 
                                                    setIsOpen(false); 
                                                }
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                                                selected
                                                    ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-zinc-700/50'
                                            }`}
                                        >
                                            <div className={`w-3 h-3 rounded flex items-center justify-center border ${
                                                selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-zinc-600'
                                            }`}>
                                                {selected && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                                            </div>
                                            
                                            <span 
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="truncate flex-1">{party.party}</span>
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

