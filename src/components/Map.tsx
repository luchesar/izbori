import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { fetchMunicipalities, fetchElectionResults, mergeData, fetchPlaces } from '../utils/data';
import type { MunicipalityData, PlaceGeoJSON, Place, SelectedRegion } from '../types';
import 'leaflet/dist/leaflet.css';

interface MapProps {
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

export default function Map({ onRegionSelect }: MapProps) {
  const [data, setData] = useState<MunicipalityData[]>([]);
  const [places, setPlaces] = useState<PlaceGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(7);

  useEffect(() => {
    async function loadData() {
      try {
        const [geo, results, placesData] = await Promise.all([
          fetchMunicipalities(),
          fetchElectionResults(),
          fetchPlaces()
        ]);
        const merged = mergeData(geo, results);
        setData(merged);
        setPlaces(placesData);
      } catch (error) {
        console.error("Failed to load map data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const onEachFeature = (feature: MunicipalityData, layer: L.Layer) => {
    layer.on({
      click: () => {
        onRegionSelect(feature);
        (layer as L.Path).setStyle({
            weight: 3,
            color: '#3b82f6', // blue-500
            fillOpacity: 0.6
        });
      },
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.5 });
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.2, weight: 1, color: '#6b7280' }); // Reset to default
      }
    });
  };

  const onEachPlaceFeature = (feature: Place, layer: L.Layer) => {
    // Bind tooltip for hover name
    if (feature.properties && feature.properties.name) {
       layer.bindTooltip(feature.properties.name, { direction: 'top', sticky: true });
    }
    
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e); // Prevent click from bubbling to municipality
        onRegionSelect(feature);
        
        // Highlight logic for place
        (layer as L.Path).setStyle({
            weight: 2,
            color: '#ef4444', // red-500
            fillOpacity: 0.6
        });
      },
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.6, color: '#ef4444' });
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        // Reset directly to default style function result or hardcoded default
        l.setStyle({ fillOpacity: 0.4, weight: 1, color: '#ef4444', fillColor: '#ef4444' });
      }
    });
  };

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const geoJsonStyle = (_feature: any) => {
    return {
      fillColor: '#374151', // gray-700
      weight: 1,
      opacity: 1,
      color: '#6b7280', // gray-500
      fillOpacity: 0.2
    };
  };

  const placesStyle = (_feature: any) => {
    return {
      fillColor: '#ef4444', // red-500
      weight: 1,
      opacity: 1,
      color: '#ef4444', 
      fillOpacity: 0.4
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-zinc-900 text-gray-500">
        Loading Map Data...
      </div>
    );
  }

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
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {data.length > 0 && (
                <>
                    <GeoJSON 
                        data={data as any} 
                        style={geoJsonStyle} 
                        onEachFeature={(feature, layer) => onEachFeature(feature as MunicipalityData, layer)}
                    />
                    <MapBounds data={data} />
                </>
            )}
            {zoom > 10 && places && (
                <GeoJSON 
                    data={places as any}
                    style={placesStyle}
                    onEachFeature={(feature, layer) => onEachPlaceFeature(feature as Place, layer)}
                />
            )}
        </MapContainer>
    </div>
  );
}
