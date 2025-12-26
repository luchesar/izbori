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
  const [selectedElection, setSelectedElection] = useState('2024-10-27');
  const [municipalities, setMunicipalities] = useState<MunicipalityData[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load geographic data and settlement election data
        const [geo, placesGeoJSON, settlementResults] = await Promise.all([
          loadMunicipalitiesGeoJSON(),
          loadSettlementsGeoJSON(),
          getElectionData({ electionId: selectedElection, regionType: 'settlement' })
        ]);
        
        // For 2024-10-27, there's no municipality CSV file, so aggregate from settlements
        // Need to extract place data for aggregation from GeoJSON features
        const placesDataForAgg = placesGeoJSON.features.map((f: any) => ({
          ekatte: f.properties.ekatte,
          name: f.properties.name,
          oblast: f.properties.oblast,
          obshtina: f.properties.obshtina
        }));
        
        const mergedMunicipalities = aggregateSettlementsToMunicipalities(
          placesDataForAgg, 
          settlementResults, 
          geo
        );
        setMunicipalities(mergedMunicipalities);
        
        // Merge settlement data with polygons
        const mergedPlaces = mergePlacesData(placesGeoJSON, settlementResults);
        setPlaces(mergedPlaces);
        
        // If there's a selected region, update it with new election data
        if (selectedRegion) {
          const isSettlement = 'ekatte' in selectedRegion.properties;
          if (isSettlement) {
            // Find the same settlement in new data
            const updatedPlace = mergedPlaces.find(
              p => p.properties.ekatte === selectedRegion.properties.ekatte
            );
            if (updatedPlace) {
              setSelectedRegion(updatedPlace);
            }
          } else {
            // Find the same municipality in new data
            const updatedMunicipality = mergedMunicipalities.find(
              m => m.properties.name === selectedRegion.properties.name
            );
            if (updatedMunicipality) {
              setSelectedRegion(updatedMunicipality);
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
  }, [selectedElection]); // Reload when election changes

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

  if (loading) {
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
        selectedElection={selectedElection}
        onElectionChange={setSelectedElection}
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
        electionDate={selectedElection}
        onClose={handleCloseSheet} 
      />
    </div>
  );
}

export default App;
