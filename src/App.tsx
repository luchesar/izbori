import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import Map from './components/Map';
import BottomSheet from './components/BottomSheet';
import SearchBar from './components/SearchBar';
import ElectionSelector from './components/ElectionSelector';
import TableView from './components/TableView';
import ViewSelector from './components/ViewSelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { MunicipalityData, SelectedRegion, Place } from './types';
import { 
  loadMunicipalitiesGeoJSON, 
  loadSettlementsGeoJSON,
  getElectionData, 
  mergePlacesData,
  aggregateSettlementsToMunicipalities,
  searchRegions 
} from './utils/elections';

function App() {
  // --- Initialization from URL ---
  const getUrlParams = () => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  };

  const [viewMode, setViewMode] = useState<'map' | 'table'>(() => {
    const params = getUrlParams();
    return params.get('view') === 'table' ? 'table' : 'map';
  });

  const [selectedElections, setSelectedElections] = useState<string[]>(() => {
    const params = getUrlParams();
    const elections = params.get('elections');
    return elections ? elections.split(',') : ['2024-10-27-ns'];
  });

  const [tableMunicipality, setTableMunicipality] = useState<string | null>(() => {
    const params = getUrlParams();
    return params.get('table_mun') || null;
  });

  // Selected region is loaded later after data is available, 
  // but we store the initial ID to resolve it.
  const initialSelectionId = useRef<string | null>(getUrlParams().get('selection'));

  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // --- Data State ---
  const [electionsData, setElectionsData] = useState<Record<string, { municipalities: MunicipalityData[], places: Place[] }>>({});
  const [municipalities, setMunicipalities] = useState<MunicipalityData[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Data Loading ---
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const geo = await loadMunicipalitiesGeoJSON();
        const placesGeoJSON = await loadSettlementsGeoJSON();
        
        // Load data for all selected elections
        const newDataMap: Record<string, { municipalities: MunicipalityData[], places: Place[] }> = {};
        
        await Promise.all(selectedElections.map(async (electionId) => {
          const settlementResults = await getElectionData({ electionId, regionType: 'settlement' });
          
          // Aggregate for municipalities
          const placesDataForAgg = placesGeoJSON.features.map((f: any) => ({
            ekatte: f.properties.ekatte,
            name: f.properties.name,
            oblast: f.properties.oblast,
            obshtina: f.properties.obshtina
          }));
          
          const electionMunicipalities = aggregateSettlementsToMunicipalities(
            placesDataForAgg, 
            settlementResults, 
            geo
          );
          
          const electionPlaces = mergePlacesData(placesGeoJSON, settlementResults);
          
          newDataMap[electionId] = {
            municipalities: electionMunicipalities,
            places: electionPlaces
          };
        }));
        
        setElectionsData(newDataMap);
        
        // Use data from the first selected election for the map/resolution
        const primaryElectionId = selectedElections[0];
        if (newDataMap[primaryElectionId]) {
          const loadedMuns = newDataMap[primaryElectionId].municipalities;
          const loadedPlaces = newDataMap[primaryElectionId].places;

          setMunicipalities(loadedMuns);
          setPlaces(loadedPlaces);
          
          // Refresh current selection object with new data if exists
          if (selectedRegion) {
             const isSettlement = 'ekatte' in selectedRegion.properties;
             let updated: SelectedRegion | undefined;
             
             if (isSettlement) {
                updated = loadedPlaces.find(p => p.properties.ekatte === selectedRegion.properties.ekatte);
             } else {
                updated = loadedMuns.find(m => m.properties.name === selectedRegion.properties.name);
             }
             if (updated) setSelectedRegion(updated);
          }
        }
        
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedElections]);

  // --- Resolve Initial Selection from URL ---
  useEffect(() => {
    if (!loading && initialSelectionId.current && municipalities.length > 0) {
      const id = initialSelectionId.current;
      initialSelectionId.current = null; // Consume
      
      let found: SelectedRegion | undefined;
      
      if (id.startsWith('s-')) {
        const ekatte = id.substring(2);
        found = places.find(p => p.properties.ekatte === ekatte);
      } else if (id.startsWith('m-')) {
        const codeOrName = id.substring(2);
        // Try matching NUTS4 or Name
        found = municipalities.find(m => m.properties.nuts4 === codeOrName || m.properties.name === codeOrName);
      }
      
      if (found) {
        setSelectedRegion(found);
        setShouldNavigate(true); // Navigate to it
        
        // If in table mode, also drill down to municipality if it's a settlement?
        // Wait, tableMunicipality should handle drill down view.
        // But if user shares URL of a settlement selection in Table View, 
        // they probably want to see the table for that settlement's municipality.
        // If 'table_mun' is missing but selection is present, infer it?
        // Let's implement that inference.
        const isSettlement = 'ekatte' in found.properties;
        if (viewMode === 'table' && !tableMunicipality) {
             if (isSettlement) {
                setTableMunicipality(found.properties.obshtina || null);
             } else {
                setTableMunicipality(found.properties.name);
             }
        }
      }
    }
  }, [loading, municipalities, places, viewMode]); // Depend on data load

  // --- Sync State to URL ---
  useEffect(() => {
    const params = new URLSearchParams();
    
    // View Mode
    if (viewMode === 'table') params.set('view', 'table');
    
    // Elections
    if (selectedElections.length !== 1 || selectedElections[0] !== '2024-10-27-ns') {
      params.set('elections', selectedElections.join(','));
    }
    
    // Table Municipality (Drill down)
    if (viewMode === 'table' && tableMunicipality) {
      params.set('table_mun', tableMunicipality);
    }
    
    // Selection
    if (selectedRegion) {
      const isSettlement = 'ekatte' in selectedRegion.properties;
      if (isSettlement) {
        params.set('selection', `s-${selectedRegion.properties.ekatte}`);
      } else {
        // Prefer NUTS4 code for stability, fallback to name
        const id = selectedRegion.properties.nuts4 || selectedRegion.properties.name;
        params.set('selection', `m-${id}`);
      }
    }

    const queryString = params.toString();
    const newUrl = queryString 
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
      
    // Use replaceState to update URL without adding history entries for every click
    window.history.replaceState(null, '', newUrl);
    
  }, [viewMode, selectedElections, tableMunicipality, selectedRegion]);


  // --- Handlers ---

  const handleRegionSelect = (data: SelectedRegion) => {
    setSelectedRegion(data);
    setShouldNavigate(false); // Don't fly on manual click/select unless from search?
    // Wait, UI behavior: 
    // - Map click: select.
    // - Table click arrow: select.
    // - Search select: select + fly.
  };

  const handleSearchSelect = (data: SelectedRegion) => {
    setSelectedRegion(data);
    setShouldNavigate(true);
    
    // If in table view, also drill down to appropriate municipality
    if (viewMode === 'table') {
        const isSettlement = 'ekatte' in data.properties;
        if (isSettlement) {
            setTableMunicipality(data.properties.obshtina || null);
        } else {
            setTableMunicipality(data.properties.name);
        }
    }
  };

  const handleCloseSheet = () => {
    setSelectedRegion(null);
    setShouldNavigate(false);
  };

  const handleSearch = (query: string) => {
    return searchRegions(query, municipalities, places);
  };

  // Comparative data calculation
  const comparativeData = selectedRegion ? selectedElections.reduce((acc, electionId) => {
    const data = electionsData[electionId];
    if (data) {
      const isSettlement = 'ekatte' in selectedRegion.properties;
      if (isSettlement) {
        acc[electionId] = data.places.find(p => p.properties.ekatte === selectedRegion.properties.ekatte) || null;
      } else {
        acc[electionId] = data.municipalities.find(m => m.properties.name === selectedRegion.properties.name) || null;
      }
    }
    return acc;
  }, {} as Record<string, SelectedRegion | null>) : {};

  if (loading && municipalities.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-black text-gray-500">
        Зареждане на данни...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-full w-full bg-gray-50 dark:bg-black overflow-hidden relative flex flex-col">
        {/* Top Bar - All Controls */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center">
            <div className="w-full max-w-[680px] p-3 sm:p-4 flex flex-col gap-3">
                {/* Row 1: SearchBar + ViewSelector */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <SearchBar onSearch={handleSearch} onSelect={handleSearchSelect} />
                    </div>
                    <ViewSelector viewMode={viewMode} onChange={setViewMode} />
                </div>
                
                {/* Row 2: ElectionSelector */}
                <div className="flex items-center gap-2">
                    <ElectionSelector 
                      selectedElections={selectedElections}
                      onElectionChange={setSelectedElections}
                      isOpen={selectorOpen}
                      onToggle={() => setSelectorOpen(!selectorOpen)}
                      onClose={() => setSelectorOpen(false)}
                    />
                </div>
            </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
            <div className={clsx("absolute inset-0 z-0", viewMode === 'map' ? 'block' : 'hidden')}>
              <Map 
                  municipalities={municipalities}
                  places={places}
                  selectedRegion={selectedRegion}
                  shouldNavigate={shouldNavigate}
                  onRegionSelect={handleRegionSelect} 
              />
            </div>
            
            {viewMode === 'table' && (
                <div className="absolute inset-0 z-10 bg-white dark:bg-zinc-900 pt-36">
                  <ErrorBoundary>
                    <TableView 
                      selectedElections={selectedElections}
                      onRegionSelect={handleRegionSelect}
                      viewedMunicipality={tableMunicipality}
                      onViewedMunicipalityChange={setTableMunicipality}
                    />
                  </ErrorBoundary>
                </div>
            )}
        </div>
        
        <BottomSheet 
          data={selectedRegion} 
          selectedElections={selectedElections}
          comparativeData={comparativeData}
          onClose={handleCloseSheet} 
          onScroll={() => setSelectorOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
