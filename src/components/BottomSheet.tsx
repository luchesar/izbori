import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { X, Users, Activity } from 'lucide-react';
import type { SelectedRegion, MunicipalityData } from '../types';
import clsx from 'clsx';
import { useState } from 'react';

interface BottomSheetProps {
  data: SelectedRegion | null;
  onClose: () => void;
}

export default function BottomSheet({ data, onClose }: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to check if data has election results
  const hasElectionData = (d: SelectedRegion): d is MunicipalityData => {
    return 'electionData' in d && !!d.electionData;
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      // Dragged down - close
      onClose();
    } else if (info.offset.y < -100 && !isExpanded) {
      // Dragged up - expand
      setIsExpanded(true);
    } else if (info.offset.y > 50 && isExpanded) {
      // Dragged down from expanded - collapse to half
      setIsExpanded(false);
    }
  };

  return (
    <AnimatePresence>
      {data && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-10"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: isExpanded ? 0 : '50%' }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20 h-[90vh] flex flex-col md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-2xl md:bottom-4 md:mb-safe"
          >
            {/* Handle bar - tap to expand/collapse */}
            <div 
              className="w-full flex justify-center pt-3 pb-1 cursor-pointer" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full cursor-pointer" />
            </div>

            {/* Header */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                    {data.properties.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {'ekatte' in data.properties ? (
                          <>
                              <span>Община: {data.properties.obshtina}</span>
                              <span>•</span>
                              <span>Област: {data.properties.oblast}</span>
                          </>
                      ) : (
                           <span>NUTS4: {data.properties.nuts4}</span>
                      )}
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ml-2 flex-shrink-0"
                  aria-label="Затвори детайли"
                >
                  <X size={18} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {hasElectionData(data) ? (
                    <>
                        {/* Stats */}
                        <div className="flex gap-4 text-center">
                            <div className="flex-1 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-base font-bold text-gray-900 dark:text-white">
                                    <Users size={14} className="text-blue-500" />
                                    {data.electionData?.totalVotes.toLocaleString()}
                                </div>
                                <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">
                                    Общо гласове
                                </div>
                            </div>
                            <div className="flex-1 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-base font-bold text-gray-900 dark:text-white">
                                    <Activity size={14} className="text-emerald-500" />
                                    {(data.electionData!.activity * 100).toFixed(1)}%
                                </div>
                                <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">
                                    Активност
                                </div>
                            </div>
                        </div>

                        {/* Parties Table */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                Резултати
                            </h3>
                            <div className="space-y-3">
                                {data.electionData?.topParties.map((result, idx) => (
                                    <div key={result.party} className="group">
                                        <div className="flex justify-between items-center text-sm mb-1">
                                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate pr-2" title={result.party}>
                                                {result.party}
                                            </span>
                                            <span className="font-mono text-gray-900 dark:text-white shrink-0">
                                                {result.percentage.toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <div 
                                                className={clsx(
                                                    "h-full rounded-full transition-all duration-500 ease-out",
                                                    idx === 0 ? "bg-blue-500" :
                                                    idx === 1 ? "bg-indigo-500" :
                                                    idx === 2 ? "bg-violet-500" :
                                                    "bg-gray-400"
                                                )}
                                                style={{ width: `${result.percentage}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                             {result.votes.toLocaleString()} гласа
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        Няма изборни данни за това населено място
                    </div>
                )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
