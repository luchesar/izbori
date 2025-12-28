import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_ELECTIONS, formatElectionDate } from '../utils/elections';

interface ElectionSelectorProps {
  selectedElections: string[];
  onElectionChange: (electionIds: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export default function ElectionSelector({ selectedElections, onElectionChange, isOpen, onToggle, onClose }: ElectionSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Helper to toggle selection
  const handleToggle = (electionId: string) => {
    if (selectedElections.includes(electionId)) {
      // Don't allow deselecting the last one
      if (selectedElections.length > 1) {
        onElectionChange(selectedElections.filter(id => id !== electionId));
      }
    } else {
      onElectionChange([...selectedElections, electionId]);
    }
  };

  const buttonText = selectedElections.length === 1
    ? formatElectionDate(selectedElections[0])
    : `${selectedElections.length} избора`;

  return (
    <div className="absolute top-20 left-4 z-[9998]" ref={containerRef}>
      <div className="relative">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-2 py-1 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-zinc-800/90 transition-colors"
        >
          <Calendar size={12} className="text-gray-500 dark:text-gray-400" />
          <span>{buttonText}</span>
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
                  const electionId = election.id;
                  const isSelected = selectedElections.includes(electionId);
                  
                  return (
                    <button
                      key={electionId}
                      onClick={() => handleToggle(electionId)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-zinc-700/50'
                      }`}
                    >
                      <span>{formatElectionDate(electionId)}</span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
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
