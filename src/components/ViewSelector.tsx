import { Map as MapIcon, Table2, BarChart2, AlertTriangle, History, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
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
            case 'history': return <History className="text-gray-700 dark:text-gray-200" size={24} />;
        }
    };

    const options: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
        { mode: 'map', icon: <MapIcon size={20} />, label: 'Карта' },
        { mode: 'table', icon: <Table2 size={20} />, label: 'Таблица' },
        { mode: 'visualization', icon: <BarChart2 size={20} />, label: 'Визуализация' },
        { mode: 'anomalies', icon: <AlertTriangle size={20} />, label: 'Аномалии' },
        { mode: 'history', icon: <History size={20} />, label: 'История' },
    ];

    return (
        <div className="relative z-20 flex flex-col items-end">
            <button
                onClick={() => setIsOpen(true)}
                className="bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Смени изглед"
            >
                {getIcon()}
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black z-[100]"
                            />

                            {/* Sheet */}
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-xl z-[101] flex flex-col md:max-w-2xl md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-2xl"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Изберете изглед</h2>
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Options */}
                                <div className="p-6 space-y-8">
                                    {/* National Assembly Section */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                            Избори за Народно Събрание
                                        </h3>
                                        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                                            {options.map(opt => (
                                                <button
                                                    key={opt.mode}
                                                    onClick={() => { onChange(opt.mode); setIsOpen(false); }}
                                                    className={clsx(
                                                        "flex flex-col items-center gap-2 p-2.5 rounded-xl min-w-[72px] transition-all border",
                                                        viewMode === opt.mode 
                                                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold" 
                                                            : "bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 border-transparent text-gray-700 dark:text-gray-300"
                                                    )}
                                                >
                                                    <div className={clsx("p-2 rounded-full", viewMode === opt.mode ? "bg-blue-100 dark:bg-blue-900/40" : "bg-white dark:bg-zinc-700")}>
                                                        {opt.icon}
                                                    </div>
                                                    <span className="text-[10px] sm:text-xs whitespace-nowrap">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Local Elections Section (Disabled) */}
                                    <section className="opacity-40 grayscale pointer-events-none select-none">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Местни Избори
                                            </h3>
                                            <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-500 uppercase font-medium">Скоро</span>
                                        </div>
                                        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                                            {options.map(opt => (
                                                <button
                                                    key={opt.mode}
                                                    disabled
                                                    className="flex flex-col items-center gap-2 p-2.5 rounded-xl min-w-[72px] border border-transparent bg-gray-50 dark:bg-zinc-800 text-gray-400"
                                                >
                                                    <div className="p-2 rounded-full bg-white dark:bg-zinc-700">
                                                        {opt.icon}
                                                    </div>
                                                    <span className="text-[10px] sm:text-xs whitespace-nowrap">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}


