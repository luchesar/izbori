import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { getPartyColor } from '../utils/elections';

interface HistorySheetProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[]; // History data from getHistory
    selectedParties: string[];
    isLoading?: boolean;
}

export default function HistorySheet({ isOpen, onClose, data, selectedParties, isLoading }: HistorySheetProps) {
    // Calculate chart dimensions
    const chartHeight = 300;
    const barWidth = 40;
    const gap = 20;
    
    // Calculate max value for Y axis scaling
    const maxValue = data.reduce((max, election) => {
        let electionTotal = 0;
        if (selectedParties.length > 0) {
            electionTotal = selectedParties.reduce((sum, party) => sum + (election.results[party] || 0), 0);
        } else {
            electionTotal = election.total;
        }
        return Math.max(max, electionTotal);
    }, 0);

    // Padding for top labels
    const scaleMax = maxValue * 1.1; 

    // Calculate ticks (5 ticks)
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
        const value = (scaleMax / tickCount) * i;
        return Math.round(value);
    }).reverse();

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-[100]"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-xl z-[101] flex flex-col h-[60vh] min-h-[500px] md:max-w-5xl md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">История на гласуването</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {selectedParties.length > 0 
                                        ? `${selectedParties.length} избрани партии` 
                                        : 'Обща избирателна активност'}
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Legend */}
                        {selectedParties.length > 0 && (
                            <div className="px-6 py-3 border-b border-gray-50 dark:border-zinc-800/50 flex flex-wrap gap-3 overflow-x-auto shrink-0">
                                {selectedParties.map(party => (
                                    <div key={party} className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        <div 
                                            className="w-2.5 h-2.5 rounded-full" 
                                            style={{ backgroundColor: getPartyColor(party) }}
                                        />
                                        {party}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Chart Area */}
                        <div className="flex-1 flex overflow-hidden p-6 pl-2">
                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    Зареждане...
                                </div>
                            ) : data.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    Няма данни за избрания регион
                                </div>
                            ) : (
                                <>
                                    {/* Y Axis Legend */}
                                    <div className="flex flex-col justify-between items-end pr-3 pb-8 h-[300px] border-r border-gray-100 dark:border-zinc-800/50 shrink-0 select-none">
                                        {ticks.map((tick, i) => (
                                            <div key={i} className="text-[10px] text-gray-400 font-mono relative">
                                                <span className="absolute right-0 translate-y-1/2">{tick.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Scrollable Bars */}
                                    <div className="flex-1 overflow-x-auto overflow-y-hidden pl-4 pb-2">
                                        <div className="h-[300px] flex items-end gap-x-6 min-w-max pb-6 relative">
                                            {/* Grid lines */}
                                            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                                {ticks.map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className="absolute w-full border-t border-gray-50 dark:border-zinc-800/30 border-dashed"
                                                        style={{ top: `${(i / tickCount) * 100}%` }}
                                                    />
                                                ))}
                                            </div>

                                            {data.map((election) => {
                                                // Calculate stack
                                                let stackHeight = 0;
                                                const totalVotes = selectedParties.length > 0
                                                    ? selectedParties.reduce((sum, p) => sum + (election.results[p] || 0), 0)
                                                    : election.total;

                                                const barHeight = (totalVotes / scaleMax) * chartHeight;

                                                return (
                                                    <div key={election.electionId} className="flex flex-col items-center gap-2 group cursor-pointer z-10 relative">
                                                        
                                                        {/* Tooltip */}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-xl border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs z-20 pointer-events-none min-w-[140px]">
                                                            <div className="font-bold text-gray-900 dark:text-white mb-1.5 border-b border-gray-200 dark:border-zinc-700 pb-1">
                                                                {election.date}
                                                                <span className="text-[10px] text-gray-500 font-normal ml-2">
                                                                    {election.type === 'ns' ? 'НС' : 'ЕП'}
                                                                </span>
                                                            </div>
                                                            
                                                            {selectedParties.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {selectedParties.map(party => {
                                                                        const votes = election.results[party] || 0;
                                                                        const percent = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : '0.0';
                                                                        if (votes === 0) return null;
                                                                        return (
                                                                            <div key={party} className="flex items-center justify-between gap-3">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getPartyColor(party) }} />
                                                                                    <span className="text-gray-600 dark:text-gray-300 truncate max-w-[80px]">{party}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 font-mono">
                                                                                    <span className="text-gray-900 dark:text-white">{votes.toLocaleString()}</span>
                                                                                    <span className="text-gray-400 text-[10px]">{percent}%</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    <div className="pt-1 mt-1 border-t border-gray-100 dark:border-zinc-800 flex justify-between font-medium">
                                                                        <span>Общо</span>
                                                                        <span>{totalVotes.toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-gray-600 dark:text-gray-400">Общо гласове:</span>
                                                                    <span className="font-mono font-medium">{totalVotes.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Bar Container */}
                                                        <div className="relative w-12 bg-gray-100 dark:bg-zinc-800/50 rounded-t-lg overflow-hidden transition-all group-hover:bg-gray-200 dark:group-hover:bg-zinc-800" 
                                                             style={{ height: `${barHeight}px` }}>
                                                            
                                                            {selectedParties.length > 0 ? (
                                                                // Stacked Bars
                                                                selectedParties.map((party) => {
                                                                    const votes = election.results[party] || 0;
                                                                    if (votes === 0) return null;
                                                                    
                                                                    const heightPercent = (votes / totalVotes) * 100;
                                                                    const currentStack = stackHeight;
                                                                    stackHeight += votes;

                                                                    return (
                                                                        <div 
                                                                            key={party}
                                                                            className="w-full absolute left-0 transition-opacity hover:brightness-110"
                                                                            style={{ 
                                                                                height: `${heightPercent}%`,
                                                                                bottom: `${(currentStack / totalVotes) * 100}%`,
                                                                                backgroundColor: getPartyColor(party) 
                                                                            }}
                                                                        />
                                                                    );
                                                                })
                                                            ) : (
                                                                // Total Votes Bar
                                                                <div className="w-full h-full bg-blue-500/50 dark:bg-blue-500/30 hover:bg-blue-500/60" />
                                                            )}
                                                        </div>

                                                        {/* X Axis Label */}
                                                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap -rotate-45 origin-top-left translate-y-3 translate-x-2">
                                                            {election.date.substring(0, 4)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
