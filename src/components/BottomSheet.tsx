import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { X, Users, Activity } from 'lucide-react';
import type { SelectedRegion, MunicipalityData } from '../types';
import clsx from 'clsx';
import { useState, useRef, useCallback } from 'react';

import { formatElectionDate, formatElectionMonthYear } from '../utils/elections';

const MIN_SHEET_HEIGHT = 15; // Minimum height as percentage of viewport
const MAX_SHEET_HEIGHT = 85; // Maximum height as percentage of viewport
const DEFAULT_SHEET_HEIGHT = 45; // Default height when opened
const CLOSE_THRESHOLD = 10; // Close if dragged below this percentage

interface BottomSheetProps {
  data: SelectedRegion | null;
  selectedElections: string[];
  comparativeData: Record<string, SelectedRegion | null>;
  onClose: () => void;
  onScroll?: () => void;
  anomaliesMode?: boolean;
  selectedParty?: string | null;
}





// Component for a single election result (either full or compact)
function ElectionResultView({ data, electionId, compact = false, anomaliesMode = false, filterParty = null }: { 
  data: SelectedRegion | null, 
  electionId: string, 
  compact?: boolean,
  anomaliesMode?: boolean,
  filterParty?: string | null
}) {
  if (!data || !hasElectionData(data)) {
     return (
        <div className={clsx("flex flex-col items-center justify-center text-gray-500 py-8", compact && "min-w-[280px] h-full border-r border-gray-100 dark:border-zinc-800")}>
            {compact && <div className="font-bold text-sm mb-4">{formatElectionMonthYear(electionId)}</div>}
            <div className="text-sm text-center">Няма данни</div>
        </div>
     );
  }

  return (
    <div className={clsx("space-y-4", compact && "min-w-[280px] max-w-[320px] p-2 border-r border-gray-100 dark:border-zinc-800 last:border-0")}>
        {compact && (
            <div className="font-bold text-center text-gray-900 dark:text-white border-b border-gray-100 dark:border-zinc-800 pb-2">
                {formatElectionMonthYear(electionId)}
            </div>
        )}

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
            {!compact && (
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Резултати
                </h3>
            )}
            <div className="space-y-2">
                {data.electionData?.topParties
                    ?.filter(result => !anomaliesMode || !filterParty || result.party === filterParty)
                    .map((result, idx) => (
                    <div key={result.party} className="group">
                        <div className="flex justify-between items-center text-sm mb-0.5">
                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate pr-2" title={result.party}>
                                {result.party}
                            </span>
                            <span className="font-mono text-gray-900 dark:text-white shrink-0">
                                {result.votes.toLocaleString()} ({result.percentage.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
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
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}

// Helper to check if data has election results
const hasElectionData = (d: SelectedRegion): d is MunicipalityData => {
  return 'electionData' in d && !!d.electionData;
};

export default function BottomSheet({ data, selectedElections, comparativeData, onClose, onScroll, anomaliesMode = false, selectedParty = null }: BottomSheetProps) {
  // Sheet height as percentage of viewport (0 = closed, 100 = full screen)
  const [sheetHeight, setSheetHeight] = useState(DEFAULT_SHEET_HEIGHT);
  const dragStartHeight = useRef(sheetHeight);

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    // Convert pixel offset to viewport percentage
    const viewportHeight = window.innerHeight;
    const heightChange = (-info.offset.y / viewportHeight) * 100;
    const newHeight = Math.min(MAX_SHEET_HEIGHT, Math.max(MIN_SHEET_HEIGHT, dragStartHeight.current + heightChange));
    setSheetHeight(newHeight);
  }, []);

  const handleDragStart = useCallback(() => {
    dragStartHeight.current = sheetHeight;
  }, [sheetHeight]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    // Close if dragged below threshold
    if (sheetHeight < CLOSE_THRESHOLD) {
      onClose();
      return;
    }
    // Otherwise, keep at current height (already set by handleDrag)
  }, [sheetHeight, onClose]);

  return (
    <AnimatePresence>
      {data && (
        <>
          {/* Backdrop - visible when sheet is expanded (height > 60%) */}
          {sheetHeight > 60 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: (sheetHeight - 60) / 100 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSheetHeight(DEFAULT_SHEET_HEIGHT)}
              className="fixed inset-0 bg-black z-10"
            />
          )}
          
          {/* Sheet */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${sheetHeight}vh` }}
            exit={{ height: 0 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={clsx(
                "fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20 flex flex-col",
                selectedElections.length > 1 ? "md:max-w-4xl md:left-1/2 md:-translate-x-1/2 md:rounded-2xl md:bottom-4" : "md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-2xl md:bottom-4"
            )}
            style={{ touchAction: 'none' }}
          >
            {/* Handle bar - tap to toggle between half and expanded */}
            <div 
              className="w-full flex justify-center pt-3 pb-1 cursor-ns-resize select-none" 
              onClick={() => setSheetHeight(sheetHeight < 60 ? MAX_SHEET_HEIGHT : DEFAULT_SHEET_HEIGHT)}
            >
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full" />
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
                      <span>•</span>
                      {selectedElections.length === 1 ? (
                          <span>{formatElectionDate(selectedElections[0])}</span>
                      ) : (
                          <span>Сравнение на {selectedElections.length} избора</span>
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
            <div 
                className={clsx("flex-1 overflow-y-auto p-4", selectedElections.length > 1 && "overflow-x-auto p-0 flex flex-row divide-x divide-gray-100 dark:divide-zinc-800")}
                onScroll={onScroll}
            >
                {selectedElections.length === 1 ? (
                    // Single view
                    <ElectionResultView 
                        data={comparativeData[selectedElections[0]] || data} 
                        electionId={selectedElections[0]}
                        anomaliesMode={anomaliesMode}
                        filterParty={selectedParty}
                    />
                ) : (
                    // Comparative view
                    <div className="flex h-full">
                        {selectedElections.map(electionId => (
                            <div key={electionId} className="h-full overflow-y-auto p-4" onScroll={onScroll}>
                                <ElectionResultView 
                                    data={comparativeData[electionId]} 
                                    electionId={electionId} 
                                    compact={true}
                                    anomaliesMode={anomaliesMode}
                                    filterParty={selectedParty}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
