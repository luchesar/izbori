import { useState } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_ELECTIONS } from '../utils/elections';

interface ElectionSelectorProps {
  selectedElection: string;
  onElectionChange: (electionId: string) => void;
}

// Bulgarian month names
const BULGARIAN_MONTHS: Record<string, string> = {
  '01': 'Януари',
  '02': 'Февруари',
  '03': 'Март',
  '04': 'Април',
  '05': 'Май',
  '06': 'Юни',
  '07': 'Юли',
  '08': 'Август',
  '09': 'Септември',
  '10': 'Октомври',
  '11': 'Ноември',
  '12': 'Декември'
};

function formatElectionDate(electionId: string): string {
  const [year, month] = electionId.split('-');
  const monthName = BULGARIAN_MONTHS[month] || month;
  return `${monthName} ${year}`;
}

export default function ElectionSelector({ selectedElection, onElectionChange }: ElectionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-20 left-4 z-[9998]">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-zinc-800/90 transition-colors"
        >
          <Calendar size={12} className="text-gray-500 dark:text-gray-400" />
          <span>{formatElectionDate(selectedElection)}</span>
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
              className="absolute top-full mt-1 w-48 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-lg shadow-lg overflow-hidden"
            >
              <div className="max-h-56 overflow-y-auto">
                {AVAILABLE_ELECTIONS.map((election) => {
                  const electionId = election.date;
                  const isSelected = electionId === selectedElection;
                  
                  return (
                    <button
                      key={electionId}
                      onClick={() => {
                        onElectionChange(electionId);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-zinc-700/50'
                      }`}
                    >
                      {formatElectionDate(electionId)}
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
