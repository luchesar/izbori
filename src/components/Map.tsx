import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { MunicipalityData, Place, SelectedRegion } from '../types';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  municipalities: MunicipalityData[];
  places: Place[];
  selectedRegion: SelectedRegion | null;
  shouldNavigate: boolean;
  onRegionSelect: (data: SelectedRegion) => void;
  initialZoom?: number;
  initialCenter?: [number, number];
  onViewChange?: (zoom: number, center: [number, number]) => void;
  // Visualization mode props
  visualizationMode?: boolean;
  selectedParty?: string | null;
  partyColor?: string;
}

// Component to adjust map view bounds based on data
function MapBounds({ data }: { data: MunicipalityData[] }) {
  const map = useMap();
  const hasInitialized = React.useRef(false);

  useEffect(() => {
    if (data.length > 0 && !hasInitialized.current) {
      // Create a feature group to calculate bounds
      const geoJsonLayer = L.geoJSON(data as any);
      map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
      hasInitialized.current = true;
    }
  }, [data, map]);

  return null;
}

// Component to track zoom level and center changes
function ViewChangeHandler({ onViewChange }: { onViewChange?: (zoom: number, center: [number, number]) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      if (onViewChange) {
        const center = map.getCenter();
        onViewChange(map.getZoom(), [center.lat, center.lng]);
      }
    },
    moveend: () => {
      if (onViewChange) {
        const center = map.getCenter();
        onViewChange(map.getZoom(), [center.lat, center.lng]);
      }
    },
  });
  
  // Also track local zoom for styling
  const [, setLocalZoom] = useState(map.getZoom());
  useEffect(() => {
    const handleZoom = () => setLocalZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => { map.off('zoomend', handleZoom); };
  }, [map]);
  
  return null;
}

// Component to navigate to selected region
function RegionNavigator({ region, shouldNavigate }: { region: SelectedRegion | null; shouldNavigate: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (region && shouldNavigate) {
      // Create a GeoJSON layer from the feature to get its bounds
      const geoJsonLayer = L.geoJSON(region as any);
      const bounds = geoJsonLayer.getBounds();
      
      if (bounds.isValid()) {
        // Determine appropriate zoom based on region type
        const isSettlement = 'ekatte' in region.properties;
        const maxZoom = isSettlement ? 13 : 10;
        
        // Get the center of the bounds
        const center = bounds.getCenter();
        
        // Offset the center upwards to account for bottom sheet
        // Convert lat offset: move center up by offsetting latitude
        const mapContainer = map.getContainer();
        const containerHeight = mapContainer.clientHeight;
        const offsetPixels = containerHeight * 0.15; // Offset by 15% of viewport height upwards
        
        // First fit to bounds to get appropriate zoom
        map.fitBounds(bounds, { maxZoom: maxZoom, animate: false });
        
        // Then pan to offset center
        const point = map.latLngToContainerPoint(center);
        point.y += offsetPixels; // Move up (y increases downward in screen coords)
        const offsetCenter = map.containerPointToLatLng(point);
        
        map.setView(offsetCenter, map.getZoom(), {
          animate: true,
          duration: 0.5
        });
      }
    }
  }, [region, shouldNavigate, map]);

  return null;
}

// Component to restore saved map view (from browser history)
function MapViewRestorer({ targetZoom, targetCenter }: { targetZoom: number, targetCenter: [number, number] }) {
  const map = useMap();
  const prevTargetRef = React.useRef<{ zoom: number, center: [number, number] }>({ zoom: targetZoom, center: targetCenter });

  useEffect(() => {
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    
    // Check if target has changed from previous render
    const targetChanged = 
      prevTargetRef.current.zoom !== targetZoom ||
      prevTargetRef.current.center[0] !== targetCenter[0] ||
      prevTargetRef.current.center[1] !== targetCenter[1];
    
    // Check if we need to restore (current view differs from target)
    const needsRestore = 
      Math.abs(currentZoom - targetZoom) > 0.1 ||
      Math.abs(currentCenter.lat - targetCenter[0]) > 0.0001 ||
      Math.abs(currentCenter.lng - targetCenter[1]) > 0.0001;
    
    if (targetChanged && needsRestore) {
      console.log('MapViewRestorer: Flying to', targetZoom, targetCenter);
      prevTargetRef.current = { zoom: targetZoom, center: targetCenter };
      map.flyTo(targetCenter, targetZoom, {
        duration: 2, // 2 seconds animation
        easeLinearity: 0.25
      });
    } else if (targetChanged) {
      // Update prev even if no restore needed
      prevTargetRef.current = { zoom: targetZoom, center: targetCenter };
    }
  }, [targetZoom, targetCenter, map]);

  return null;
}

export default function Map({ 
  municipalities, 
  places, 
  selectedRegion, 
  shouldNavigate, 
  onRegionSelect, 
  initialZoom = 7, 
  initialCenter = [42.7339, 25.4858], 
  onViewChange,
  visualizationMode = false,
  selectedParty = null,
  partyColor = '#888'
}: MapProps) {
  const [zoom, setZoom] = useState(initialZoom);

  const onEachFeature = (feature: MunicipalityData, layer: L.Layer) => {
    layer.on({
      click: () => {
        onRegionSelect(feature);
      },
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ fillOpacity: 0.15, color: '#7f1d1d', weight: 2 });
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        if (!isSelected(feature)) {
             l.setStyle({ fillOpacity: 0, weight: zoom > 9 ? 2 : 1, color: '#6b7280' });
        } else {
             l.setStyle({
                weight: (zoom > 9 ? 2 : 1) + 2,
                color: '#3b82f6',
                fillOpacity: 0.3,
                fillColor: '#3b82f6'
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
        // In visualization mode, just add a highlight border
        if (visualizationMode) {
          const l = e.target as L.Path;
          l.setStyle({ weight: 2 });
        } else {
          const l = e.target as L.Path;
          l.setStyle({ fillOpacity: 0.15, color: '#991b1b', weight: 2 });
        }
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        // In visualization mode, restore the party-based styling
        if (visualizationMode && selectedParty && partyColor) {
          const partyResult = feature.electionData?.topParties?.find(
            (p: { party: string }) => p.party === selectedParty
          );
          const percentage = partyResult?.percentage || 0;
          // Same calculation as placesStyle
          const opacity = percentage < 1 ? 0 : Math.min(0.95, Math.max(0.2, percentage / 100 * 2 + 0.15));
          l.setStyle({
            fillColor: partyColor,
            fillOpacity: opacity,
            color: partyColor,
            weight: 0.5
          });
        } else if (!isSelected(feature)) {
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
    // Thicker borders when settlements are visible (zoom > 9) for better distinction
    const baseWeight = zoom > 9 ? 2 : 1;
    return {
      fillColor: selected ? '#3b82f6' : '#6b7280', // blue-500 when selected, gray-500 otherwise
      weight: selected ? baseWeight + 2 : baseWeight, // Much thicker when selected
      opacity: 1,
      color: selected ? '#3b82f6' : '#6b7280', // bright blue when selected, gray otherwise
      fillOpacity: selected ? 0.3 : 0 // more visible fill when selected
    };
  };

  const placesStyle = (feature: any) => {
    // Visualization mode: color by party percentage
    if (visualizationMode && selectedParty && partyColor) {
      const partyResult = feature.electionData?.topParties?.find(
        (p: { party: string }) => p.party === selectedParty
      );
      const percentage = partyResult?.percentage || 0;
      // 0 if near 0, otherwise 0.2-0.95 range
      const opacity = percentage < 1 ? 0 : Math.min(0.95, Math.max(0.2, percentage / 100 * 2 + 0.15));
      return {
        fillColor: partyColor,
        fillOpacity: opacity,
        color: partyColor,
        weight: 0.5,
        opacity: 1
      };
    }

    // Normal mode
    const selected = isSelected(feature);
    return {
      fillColor: '#7f1d1d', // dark red-900
      weight: selected ? 2 : 1,
      opacity: 1,
      color: '#7f1d1d', // dark red-900
      fillOpacity: selected ? 0.2 : 0 // transparent unless selected
    };
  };
  
  // Update local zoom when view changes
  const handleViewChange = (newZoom: number, center: [number, number]) => {
    setZoom(newZoom);
    if (onViewChange) {
      onViewChange(newZoom, center);
    }
  };

  return (
    <div className="h-full w-full relative z-0">
        <MapContainer 
            center={initialCenter} 
            zoom={initialZoom} 
            className="h-full w-full bg-white dark:bg-zinc-900"
            zoomControl={false}
        >
            <ViewChangeHandler onViewChange={handleViewChange} />
            <RegionNavigator region={selectedRegion} shouldNavigate={shouldNavigate} />
            <MapViewRestorer targetZoom={initialZoom} targetCenter={initialCenter} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
                    {/* Hide municipalities in visualization mode */}
                    {!visualizationMode && municipalities.length > 0 && (
                <>
                    <GeoJSON 
                        key={`municipalities-layer-${selectedRegion && !('ekatte' in selectedRegion.properties) ? selectedRegion.properties.name : 'none'}`}
                        data={municipalities as any} 
                        style={geoJsonStyle} 
                        onEachFeature={(feature, layer) => onEachFeature(feature as MunicipalityData, layer)}
                    />
                    <MapBounds data={municipalities} />
                </>
            )}
            {/* In visualization mode, always show settlements; otherwise only when zoomed in */}
            {(visualizationMode || zoom > 9 || (selectedRegion && !('electionData' in selectedRegion))) && places && (
                <GeoJSON 
                    key={`places-layer-${visualizationMode ? selectedParty : ''}-${selectedRegion && 'ekatte' in selectedRegion.properties ? selectedRegion.properties.ekatte : 'none'}`}
                    data={places as any}
                    style={placesStyle}
                    onEachFeature={(feature, layer) => onEachPlaceFeature(feature as Place, layer)}
                />
            )}
        </MapContainer>
    </div>
  );
}
