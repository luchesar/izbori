import { Map as MapIcon, Table2, BarChart2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { ViewMode } from '../types';

interface ViewSelectorProps {
    viewMode: ViewMode;
    onChange: (mode: ViewMode) => void;
}

export default function ViewSelector({ viewMode, onChange }: ViewSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const getIcon = () => {
        switch (viewMode) {
            case 'map': return <MapIcon className="text-gray-700 dark:text-gray-200" size={24} />;
            case 'table': return <Table2 className="text-gray-700 dark:text-gray-200" size={24} />;
            case 'visualization': return <BarChart2 className="text-gray-700 dark:text-gray-200" size={24} />;
            case 'anomalies': return <AlertTriangle className="text-gray-700 dark:text-gray-200" size={24} />;
        }
    };

    const options: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
        { mode: 'map', icon: <MapIcon size={20} />, label: 'Карта' },
        { mode: 'table', icon: <Table2 size={20} />, label: 'Таблица' },
        { mode: 'visualization', icon: <BarChart2 size={20} />, label: 'Визуализация' },
        { mode: 'anomalies', icon: <AlertTriangle size={20} />, label: 'Аномалии' },
    ];

    return (
        <div className="relative z-20 flex flex-col items-end">

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Смени изглед"
            >
                {getIcon()}
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
                                {options.map(opt => (
                                    <button
                                        key={opt.mode}
                                        onClick={() => { onChange(opt.mode); setIsOpen(false); }}
                                        className={clsx(
                                            "w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors",
                                            viewMode === opt.mode 
                                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                                                : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
                                        )}
                                    >
                                        {opt.icon}
                                        <span>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
