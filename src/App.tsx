import { useState, useEffect } from 'react';
import Map from './components/Map';
import BottomSheet from './components/BottomSheet';
import SearchBar from './components/SearchBar';
import type { MunicipalityData, SelectedRegion, Place, PlaceGeoJSON } from './types';
import { fetchMunicipalities, fetchElectionResults, mergeData, fetchPlaces, searchRegions } from './utils/data';

function App() {
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [municipalities, setMunicipalities] = useState<MunicipalityData[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [geo, results, placesData] = await Promise.all([
          fetchMunicipalities(),
          fetchElectionResults(),
          fetchPlaces()
        ]);
        const merged = mergeData(geo, results);
        setMunicipalities(merged);
        
        if ('features' in placesData) {
            setPlaces((placesData as PlaceGeoJSON).features);
        } else {
             setPlaces((placesData as any));
        }
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
        Loading Data...
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
