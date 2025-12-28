import { Layers, Map as MapIcon, Table2 } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface ViewSelectorProps {
    viewMode: 'map' | 'table';
    onChange: (mode: 'map' | 'table') => void;
}

export default function ViewSelector({ viewMode, onChange }: ViewSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative z-20 flex flex-col items-end">

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Смени изглед"
            >
                {viewMode === 'map' ? (
                    <MapIcon className="text-gray-700 dark:text-gray-200" size={24} />
                ) : (
                    <Table2 className="text-gray-700 dark:text-gray-200" size={24} />
                )}
            </button>

            {/* Dropdown / Sheet */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop to close */}
                        <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setIsOpen(false)}
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute top-14 right-0 z-20 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800 p-2 min-w-[200px]"
                        >
                            <div className="space-y-1">
                                <button
                                    onClick={() => { onChange('map'); setIsOpen(false); }}
                                    className={clsx(
                                        "w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors",
                                        viewMode === 'map' 
                                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                                            : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
                                    )}
                                >
                                    <MapIcon size={20} />
                                    <span>Карта</span>
                                </button>
                                <button
                                    onClick={() => { onChange('table'); setIsOpen(false); }}
                                    className={clsx(
                                        "w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors",
                                        viewMode === 'table' 
                                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                                            : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
                                    )}
                                >
                                    <Table2 size={20} />
                                    <span>Таблица</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
