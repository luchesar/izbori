import { useState, useEffect } from 'react';
import Map from './components/Map';
import BottomSheet from './components/BottomSheet';
import SearchBar from './components/SearchBar';
import ElectionSelector from './components/ElectionSelector';
import type { MunicipalityData, SelectedRegion, Place } from './types';
import { 
  loadMunicipalitiesGeoJSON, 
  loadSettlementsGeoJSON,
  getElectionData, 
  mergeData,
  mergePlacesData,
  aggregateSettlementsToMunicipalities,
  searchRegions 
} from './utils/elections';

function App() {
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedElections, setSelectedElections] = useState<string[]>(['2024-10-27-ns']);
  const [electionsData, setElectionsData] = useState<Record<string, { municipalities: MunicipalityData[], places: Place[] }>>({});
  
  // Primary data for the map (from the first selected election)
  const [municipalities, setMunicipalities] = useState<MunicipalityData[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

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
        
        // Use data from the first selected election for the map
        const primaryElectionId = selectedElections[0];
        if (newDataMap[primaryElectionId]) {
          setMunicipalities(newDataMap[primaryElectionId].municipalities);
          setPlaces(newDataMap[primaryElectionId].places);
          
          // Update selected region if exists
          if (selectedRegion) {
             const isSettlement = 'ekatte' in selectedRegion.properties;
             const primaryData = newDataMap[primaryElectionId];
             
             if (isSettlement) {
                const updated = primaryData.places.find(p => p.properties.ekatte === selectedRegion.properties.ekatte);
                if (updated) setSelectedRegion(updated);
             } else {
                const updated = primaryData.municipalities.find(m => m.properties.name === selectedRegion.properties.name);
                if (updated) setSelectedRegion(updated);
             }
          }
        }
        
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedElections]); // Reload when selected elections change

  // Handle selection from map click - no navigation
  const handleRegionSelect = (data: SelectedRegion) => {
    setSelectedRegion(data);
    setShouldNavigate(false);
  };

  // Handle selection from search - with navigation
  const handleSearchSelect = (data: SelectedRegion) => {
    setSelectedRegion(data);
    setShouldNavigate(true);
  };

  const handleCloseSheet = () => {
    setSelectedRegion(null);
    setShouldNavigate(false);
  };

  const handleSearch = (query: string) => {
    return searchRegions(query, municipalities, places);
  };

  // Calculate comparative data for the selected region across all selected elections
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

  if (loading && municipalities.length === 0) { // Only show full loading if we have nothing
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-black text-gray-500">
        Зареждане на данни...
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-black overflow-hidden relative">
      <SearchBar onSearch={handleSearch} onSelect={handleSearchSelect} />
      <ElectionSelector 
        selectedElections={selectedElections}
        onElectionChange={setSelectedElections}
        isOpen={selectorOpen}
        onToggle={() => setSelectorOpen(!selectorOpen)}
        onClose={() => setSelectorOpen(false)}
      />
      
      <Map 
        municipalities={municipalities}
        places={places}
        selectedRegion={selectedRegion}
        shouldNavigate={shouldNavigate}
        onRegionSelect={handleRegionSelect} 
      />
      
      <BottomSheet 
        data={selectedRegion} 
        selectedElections={selectedElections}
        comparativeData={comparativeData}
        onClose={handleCloseSheet} 
        onScroll={() => setSelectorOpen(false)}
      />
    </div>
  );
}

export default App;
