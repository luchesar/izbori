import { useState, useEffect } from 'react';
import Map from './components/Map';
import BottomSheet from './components/BottomSheet';
import SearchBar from './components/SearchBar';
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
  const [municipalities, setMunicipalities] = useState<MunicipalityData[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load geographic data and settlement election data
        const [geo, placesGeoJSON, settlementResults] = await Promise.all([
          loadMunicipalitiesGeoJSON(),
          loadSettlementsGeoJSON(), // This loads places.geojson with polygons
          getElectionData({ electionId: '2024-10-27', regionType: 'settlement' })
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
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleRegionSelect = (data: SelectedRegion) => {
    setSelectedRegion(data);
  };

  const handleCloseSheet = () => {
    setSelectedRegion(null);
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
      <SearchBar onSearch={handleSearch} onSelect={handleRegionSelect} />
      
      <Map 
        municipalities={municipalities}
        places={places}
        selectedRegion={selectedRegion}
        onRegionSelect={handleRegionSelect} 
      />
      
      <BottomSheet 
        data={selectedRegion} 
        onClose={handleCloseSheet} 
      />
    </div>
  );
}

export default App;
