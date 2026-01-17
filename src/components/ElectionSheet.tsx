import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { AVAILABLE_ELECTIONS, formatElectionDate } from '../utils/elections';

interface ElectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElections: string[];
  onToggle: (id: string) => void;
}

export default function ElectionSheet({ isOpen, onClose, selectedElections, onToggle }: ElectionSheetProps) {
  // Mock local elections for the disabled section
  const localElections = [
    { id: '2023-10-29-mi', date: '2023-10-29', type: 'mi' },
    { id: '2019-10-27-mi', date: '2019-10-27', type: 'mi' },
  ];

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
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-xl z-[101] max-h-[80vh] flex flex-col md:max-w-2xl md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Изберете избори</h2>
              <button 
                onClick={onClose}
                className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* National Assembly Section */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Избори за Народно Събрание
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                  {AVAILABLE_ELECTIONS.map((election) => {
                    const isSelected = selectedElections.includes(election.id);
                    return (
                      <button
                        key={election.id}
                        onClick={() => onToggle(election.id)}
                        className={`
                          flex-shrink-0 px-4 py-3 rounded-xl text-sm font-medium transition-all
                          border border-gray-200 dark:border-zinc-700
                          ${isSelected 
                            ? 'bg-blue-500 text-white border-blue-600 shadow-md transform scale-105' 
                            : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
                          }
                        `}
                      >
                        <div className="text-xs opacity-70 mb-0.5">{election.date.split('-')[0]}</div>
                        <div className="whitespace-nowrap">{formatElectionDate(election.id).split(' ').slice(0, 2).join(' ')}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Local Elections Section (Disabled) */}
              <section className="opacity-50 grayscale pointer-events-none select-none">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Местни Избори
                  </h3>
                  <span className="text-xs bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-gray-500">Скоро</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
                  {localElections.map((election) => (
                    <button
                      key={election.id}
                      disabled
                      className="flex-shrink-0 px-4 py-3 rounded-xl text-sm font-medium bg-gray-100 dark:bg-zinc-800/50 text-gray-400 border border-gray-200 dark:border-zinc-800/50"
                    >
                      <div className="text-xs opacity-70 mb-0.5">{election.date.split('-')[0]}</div>
                      <div className="whitespace-nowrap">{formatElectionDate(election.id).split(' ').slice(0, 2).join(' ')}</div>
                    </button>
                  ))}
                  <div className="flex-shrink-0 px-4 py-3 flex items-center text-gray-400 text-sm italic">
                    Очаквайте скоро...
                  </div>
                </div>
              </section>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

