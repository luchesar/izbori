import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { MunicipalityData, Place, SelectedRegion } from '../types';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  municipalities: MunicipalityData[];
  places: Place[];
  selectedRegion: SelectedRegion | null;
  onRegionSelect: (data: SelectedRegion) => void;
}

// Component to adjust map view bounds based on data
function MapBounds({ data }: { data: MunicipalityData[] }) {
  const map = useMap();

  useEffect(() => {
    if (data.length > 0) {
      // Create a feature group to calculate bounds
      const geoJsonLayer = L.geoJSON(data as any);
      map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
    }
  }, [data, map]);

  return null;
}

// Component to track zoom level
function ZoomHandler({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

export default function Map({ municipalities, places, selectedRegion, onRegionSelect }: MapProps) {
  const [zoom, setZoom] = useState(7);

  const onEachFeature = (feature: MunicipalityData, layer: L.Layer) => {
    layer.on({
      click: () => {
        onRegionSelect(feature);
      },
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.5 });
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        if (!isSelected(feature)) {
             l.setStyle({ fillOpacity: 0.2, weight: 1, color: '#6b7280' });
        } else {
             l.setStyle({
                weight: 3,
                color: '#3b82f6',
                fillOpacity: 0.6
             });
        }
      }
    });
  };

  const onEachPlaceFeature = (feature: Place, layer: L.Layer) => {
    if (feature.properties && feature.properties.name) {
       layer.bindTooltip(feature.properties.name, { direction: 'top', sticky: true });
    }
    
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onRegionSelect(feature);
      },
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.15, color: '#991b1b', weight: 2 });
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        if (!isSelected(feature)) {
            l.setStyle({ fillOpacity: 0, weight: 1, color: '#7f1d1d' });
        } else {
             l.setStyle({
                weight: 2,
                color: '#991b1b', 
                fillOpacity: 0.2
             });
        }
      }
    });
  };

  const isSelected = (feature: any) => {
    if (!selectedRegion) return false;
    
    // Check if both are places (have ekatte)
    if ('ekatte' in selectedRegion.properties && 'ekatte' in feature.properties) {
        return selectedRegion.properties.ekatte === feature.properties.ekatte;
    }
    
    // Check if both are municipalities (no ekatte, have name)
    if (!('ekatte' in selectedRegion.properties) && !('ekatte' in feature.properties)) {
        return selectedRegion.properties.name === feature.properties.name;
    }

    return false;
  };

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const geoJsonStyle = (feature: any) => {
    const selected = isSelected(feature);
    return {
      fillColor: '#374151', // gray-700
      weight: selected ? 3 : 1,
      opacity: 1,
      color: selected ? '#3b82f6' : '#6b7280', // blue-500 or gray-500
      fillOpacity: selected ? 0.6 : 0.2
    };
  };

  const placesStyle = (feature: any) => {
    const selected = isSelected(feature);
    return {
      fillColor: '#7f1d1d', // dark red-900
      weight: selected ? 2 : 1,
      opacity: 1,
      color: '#7f1d1d', // dark red-900
      fillOpacity: selected ? 0.2 : 0 // transparent unless selected
    };
  };

  return (
    <div className="h-full w-full relative z-0">
        <MapContainer 
            center={[42.7339, 25.4858]} 
            zoom={7} 
            className="h-full w-full bg-white dark:bg-zinc-900"
            zoomControl={false}
        >
            <ZoomHandler onZoomChange={setZoom} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
                    {municipalities.length > 0 && (
                <>
                    <GeoJSON 
                        key="municipalities-layer"
                        data={municipalities as any} 
                        style={geoJsonStyle} 
                        onEachFeature={(feature, layer) => onEachFeature(feature as MunicipalityData, layer)}
                    />
                    <MapBounds data={municipalities} />
                </>
            )}
            {(zoom > 9 || (selectedRegion && !('electionData' in selectedRegion))) && places && (
                <GeoJSON 
                    key="places-layer"
                    data={places as any}
                    style={placesStyle}
                    onEachFeature={(feature, layer) => onEachPlaceFeature(feature as Place, layer)}
                />
            )}
        </MapContainer>
    </div>
  );
}
