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
  // Anomalies mode props
  anomaliesMode?: boolean;
  fraudData?: {
    meta?: { elections: string[]; top_parties: string[]; threshold: number };
    settlements?: Record<string, { total_cv: number; party_cv: Record<string, number>; elections_count: number }>;
  } | null;
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

// Component to restore saved map view (from browser history) - only on initial mount
function MapViewRestorer({ targetZoom, targetCenter }: { targetZoom: number, targetCenter: [number, number] }) {
  const map = useMap();
  const hasInitialized = React.useRef(false);

  useEffect(() => {
    // Only restore once on mount - don't react to prop changes
    // This prevents jumping when selectors change
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      
      // Check if we need to restore (current view differs from target)
      const needsRestore = 
        Math.abs(currentZoom - targetZoom) > 0.1 ||
        Math.abs(currentCenter.lat - targetCenter[0]) > 0.0001 ||
        Math.abs(currentCenter.lng - targetCenter[1]) > 0.0001;
      
      if (needsRestore) {
        map.setView(targetCenter, targetZoom, { animate: false });
      }
    }
  }, [map]); // Only depend on map, not on target values

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
  partyColor = '#888',
  anomaliesMode = false,
  fraudData = null
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
      // In visualization mode, include party percentage in tooltip
      if (visualizationMode && selectedParty) {
        const partyResult = feature.electionData?.topParties?.find(
          (p: { party: string }) => p.party === selectedParty
        );
        const percentage = partyResult?.percentage || 0;
        const tooltipText = percentage > 0 
          ? `${feature.properties.name}: ${percentage.toFixed(1)}%`
          : `${feature.properties.name}: няма данни`;
        layer.bindTooltip(tooltipText, { direction: 'top', sticky: true });
      } else {
        layer.bindTooltip(feature.properties.name, { direction: 'top', sticky: true });
      }
    }
    
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onRegionSelect(feature);
      },
      mouseover: (e) => {
        // In visualization or anomalies mode, just add a highlight border
        if (visualizationMode || anomaliesMode) {
          const l = e.target as L.Path;
          l.setStyle({ weight: 2 });
        } else {
          const l = e.target as L.Path;
          l.setStyle({ fillOpacity: 0.15, color: '#991b1b', weight: 2 });
        }
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        // In anomalies mode, restore the CV-based styling
        if (anomaliesMode && fraudData?.settlements) {
          const ekatte = feature.properties?.ekatte;
          const settlementData = ekatte ? fraudData.settlements[ekatte] : null;
          
          if (!settlementData) {
            l.setStyle({ fillOpacity: 0, weight: 0, opacity: 0 });
            return;
          }
          
          let cv = settlementData.total_cv;
          if (selectedParty && settlementData.party_cv[selectedParty] !== undefined) {
            cv = settlementData.party_cv[selectedParty];
          }
          
          const threshold = fraudData.meta?.threshold || 30;
          
          if (cv < threshold) {
            l.setStyle({ fillOpacity: 0, weight: 0, opacity: 0 });
            return;
          }
          
          const normalizedCV = Math.min(1, (cv - threshold) / (100 - threshold));
          const opacity = 0.3 + normalizedCV * 0.7;
          const color = `hsl(${Math.max(0, 30 - normalizedCV * 30)}, 80%, 50%)`;
          
          l.setStyle({
            fillColor: color,
            fillOpacity: opacity,
            color: color,
            weight: 1,
            opacity: 1
          });
        }
        // In visualization mode, restore the party-based styling
        else if (visualizationMode && selectedParty && partyColor) {
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
    // Anomalies mode: color by CV (Coefficient of Variation)
    if (anomaliesMode && fraudData?.settlements) {
      const ekatte = feature.properties?.ekatte;
      const settlementData = ekatte ? fraudData.settlements[ekatte] : null;
      
      if (!settlementData) {
        return { fillOpacity: 0, weight: 0, opacity: 0 }; // Hide if no data
      }
      
      // Get CV based on selected party or total
      let cv = settlementData.total_cv;
      if (selectedParty && settlementData.party_cv[selectedParty] !== undefined) {
        cv = settlementData.party_cv[selectedParty];
      }
      
      const threshold = fraudData.meta?.threshold || 30;
      
      // Hide if CV < threshold
      if (cv < threshold) {
        return { fillOpacity: 0, weight: 0, opacity: 0 };
      }
      
      // Scale opacity from 0.3 (at threshold) to 1.0 (at 100% CV or higher)
      const normalizedCV = Math.min(1, (cv - threshold) / (100 - threshold));
      const opacity = 0.3 + normalizedCV * 0.7;
      
      // Use red/orange color for anomalies
      const color = `hsl(${Math.max(0, 30 - normalizedCV * 30)}, 80%, 50%)`; // orange to red
      
      return {
        fillColor: color,
        fillOpacity: opacity,
        color: color,
        weight: 1,
        opacity: 1
      };
    }
    
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
                    {/* Hide municipalities in visualization and anomalies mode */}
                    {!visualizationMode && !anomaliesMode && municipalities.length > 0 && (
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
            {/* In visualization/anomalies mode, always show settlements; otherwise only when zoomed in */}
            {(visualizationMode || anomaliesMode || zoom > 9 || (selectedRegion && !('electionData' in selectedRegion))) && places && (
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
