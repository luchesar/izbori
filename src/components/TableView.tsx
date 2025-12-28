import { useState, useEffect } from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import type { MunicipalityData, Place, SelectedRegion } from '../types';
import { 
    getNationalResults, 
    getMunicipalitiesByVoters, 
    getSettlementsByVotersInMunicipality
} from '../utils/elections';
import type { AggregatedElectionStats } from '../utils/elections';

interface TableViewProps {
    selectedElections: string[];
    onRegionSelect: (region: SelectedRegion) => void;
    // Controlled drill-down state
    viewedMunicipality: string | null;
    onViewedMunicipalityChange: (mun: string | null) => void;
}

export default function TableView({ 
    selectedElections, 
    onRegionSelect, 
    viewedMunicipality, 
    onViewedMunicipalityChange 
}: TableViewProps) {
    // Data state
    const [nationalStats, setNationalStats] = useState<AggregatedElectionStats | null>(null);
    const [municipalities, setMunicipalities] = useState<MunicipalityData[]>([]);
    const [settlements, setSettlements] = useState<Place[]>([]);
    const [loading, setLoading] = useState(false);

    const electionId = selectedElections[0]; // Primary election

    // Load National Data
    useEffect(() => {
        if (!electionId) return;
        
        async function loadNational() {
            setLoading(true);
            try {
                const [stats, muns] = await Promise.all([
                    getNationalResults(electionId),
                    getMunicipalitiesByVoters(electionId)
                ]);
                setNationalStats(stats);
                setMunicipalities(muns);
            } catch (e) {
                console.error("Failed to load table data", e);
            } finally {
                setLoading(false);
            }
        }
        
        loadNational();
    }, [electionId]);

    // Load Settlement Data when municipality selected
    useEffect(() => {
        if (!electionId || !viewedMunicipality) {
            setSettlements([]);
            return;
        }

        async function loadSettlements() {
            setLoading(true);
            try {
                const places = await getSettlementsByVotersInMunicipality(electionId, viewedMunicipality);
                setSettlements(places);
            } catch (e) {
                console.error("Failed to load settlements", e);
            } finally {
                setLoading(false);
            }
        }
        loadSettlements();
    }, [electionId, viewedMunicipality]);

    const handleBack = () => {
        onViewedMunicipalityChange(null);
    };

    const handleMunicipalityClick = (mun: MunicipalityData) => {
        onViewedMunicipalityChange(mun.properties.name);
    };

    // Derived data for header
    const viewedMunicipalityData = viewedMunicipality 
        ? municipalities.find(m => m.properties.name === viewedMunicipality) 
        : null;

    if (loading && !nationalStats) {
        return <div className="p-8 text-center text-gray-500">Зареждане на таблица...</div>;
    }

    return (
        <div className="flex-1 h-full overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">
           {/* Header / Stats */}
           <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-black/20">
               {viewedMunicipality ? (
                   <div className="flex items-center gap-4">
                       <button onClick={handleBack} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full">
                           <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
                       </button>
                       <div>
                           <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewedMunicipality}</h2>
                           {viewedMunicipalityData?.electionData && (
                               <div className="text-sm text-gray-500 flex gap-4 mt-1">
                                   <span>Гласували: <b>{viewedMunicipalityData.electionData.totalVotes.toLocaleString()}</b></span>
                                   <span>Активност: <b>{(viewedMunicipalityData.electionData.activity * 100).toFixed(1)}%</b></span>
                               </div>
                           )}
                       </div>
                   </div>
               ) : (
                   <div>
                       <h2 className="text-xl font-bold text-gray-900 dark:text-white">Резултати за цялата страна</h2>
                       {nationalStats && (
                           <div className="text-sm text-gray-500 flex gap-4 mt-1">
                               <span>Гласували: <b>{nationalStats.totalVotes.toLocaleString()}</b></span>
                               <span>Право на глас: <b>{nationalStats.eligibleVoters.toLocaleString()}</b></span>
                               <span>Активност: <b>{(nationalStats.activity * 100).toFixed(1)}%</b></span>
                           </div>
                       )}
                   </div>
               )}
           </div>
           
           {/* Table */}
           <div className="flex-1 overflow-auto">
               <table className="w-full text-left border-collapse">
                   <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                       <tr>
                           <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                               {viewedMunicipality ? "Населено място" : "Община"}
                           </th>
                           <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                               Право на глас
                           </th>
                           <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                               Гласували
                           </th>
                           <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                               %
                           </th>
                           <th className="p-3 w-10"></th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                       {!viewedMunicipality ? (
                           municipalities.map(mun => (
                               <tr 
                                 key={mun.properties.name} 
                                 className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                 onClick={() => handleMunicipalityClick(mun)}
                               >
                                   <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">
                                       {mun.properties.name}
                                   </td>
                                   <td className="p-3 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                       {mun.electionData?.eligibleVoters?.toLocaleString() || '-'}
                                   </td>
                                   <td className="p-3 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                       {mun.electionData?.totalVotes.toLocaleString() || '-'}
                                   </td>
                                   <td className="p-3 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                       {(mun.electionData?.activity ? (mun.electionData.activity * 100).toFixed(1) : '0.0')}%
                                   </td>
                                   <td className="p-3 text-center">
                                       <button 
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               onRegionSelect(mun);
                                           }}
                                           className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full"
                                       >
                                           <ChevronRight size={16} className="text-gray-400" />
                                       </button>
                                   </td>
                               </tr>
                           ))
                       ) : (
                           settlements.map(place => (
                               <tr 
                                 key={place.properties.ekatte} 
                                 className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                                 onClick={() => onRegionSelect(place)}
                               >
                                   <td className="p-3 text-sm font-medium text-gray-900 dark:text-white">
                                       {place.properties.name}
                                   </td>
                                   <td className="p-3 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                       {place.electionData?.eligibleVoters?.toLocaleString() || '-'}
                                   </td>
                                   <td className="p-3 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                       {place.electionData?.totalVotes.toLocaleString() || '-'}
                                   </td>
                                   <td className="p-3 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                                       {(place.electionData?.activity ? (place.electionData.activity * 100).toFixed(1) : '0.0')}%
                                   </td>
                                   <td className="p-3 text-center">
                                       <ChevronRight size={16} className="text-gray-400" />
                                   </td>
                               </tr>
                           ))
                       )}
                   </tbody>
               </table>
           </div>
        </div>
    );
}
