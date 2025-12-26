import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Activity } from 'lucide-react';
import type { SelectedRegion, MunicipalityData } from '../types';
import clsx from 'clsx';

interface BottomSheetProps {
  data: SelectedRegion | null;
  onClose: () => void;
}

export default function BottomSheet({ data, onClose }: BottomSheetProps) {
  // Helper to check if data has election results
  const hasElectionData = (d: SelectedRegion): d is MunicipalityData => {
    return 'electionData' in d && !!d.electionData;
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
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20 max-h-[80vh] flex flex-col md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-2xl md:bottom-4 md:mb-safe"
          >
            {/* Handle bar for mobile hint */}
            <div className="w-full flex justify-center pt-3 pb-1 md:hidden" onClick={onClose}>
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full cursor-pointer" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {data.properties.name}
                </h2>
                <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400">
                    {'ekatte' in data.properties ? (
                        <>
                            <span>Obshtina: {data.properties.obshtina}</span>
                            <span>Oblast: {data.properties.oblast}</span>
                        </>
                    ) : (
                         <span>NUTS4: {data.properties.nuts4}</span>
                    )}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close details"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {hasElectionData(data) ? (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                <Users size={20} className="text-blue-500 mb-2" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {data.electionData?.totalVotes.toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">
                                    Total Votes
                                </span>
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                <Activity size={20} className="text-emerald-500 mb-2" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(data.electionData!.activity * 100).toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">
                                    Activity
                                </span>
                            </div>
                        </div>

                        {/* Parties Table */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                Results
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
                                            {result.votes.toLocaleString()} votes
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        No election data available for detailed settlements yet.
                    </div>
                )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
