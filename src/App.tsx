import { useState } from 'react';
import Map from './components/Map';
import BottomSheet from './components/BottomSheet';
import type { SelectedRegion } from './types';

function App() {
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);

  const handleRegionSelect = (data: SelectedRegion) => {
    setSelectedRegion(data);
  };

  const handleCloseSheet = () => {
    setSelectedRegion(null);
  };

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-black overflow-hidden relative">
      <Map onRegionSelect={handleRegionSelect} />
      <BottomSheet 
        data={selectedRegion} 
        onClose={handleCloseSheet} 
      />
    </div>
  );
}

export default App;
