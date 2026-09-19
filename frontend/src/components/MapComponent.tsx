import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Hospital, Emergency } from '../types';

interface MapComponentProps {
  hospitals: Hospital[];
  emergency?: Emergency | null;
  selectedHospital?: Hospital | null;
  routeCoordinates?: [number, number][];
  height?: string;
  onSelectHospital?: (hospital: Hospital) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  hospitals,
  emergency,
  selectedHospital,
  routeCoordinates,
  height = '500px',
  onSelectHospital
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centered over Lagos State
      const map = L.map(mapContainerRef.current, {
        center: [6.5244, 3.3792],
        zoom: 12,
        zoomControl: true,
      });

      // Clean Light CartoDB Voyager Map Tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Render Hospital Markers
    hospitals.forEach(hosp => {
      const isSelected = selectedHospital && selectedHospital.id === hosp.id;
      const isStale = hosp.is_stale;
      
      let badgeColor = 'bg-emerald-600 border-white text-white shadow-md';
      if (hosp.emergency_status === 'CLOSED' || !hosp.accepting_emergencies) {
        badgeColor = 'bg-rose-600 border-white text-white shadow-md';
      } else if (hosp.emergency_status === 'LIMITED' || isStale) {
        badgeColor = 'bg-amber-500 border-white text-white shadow-md';
      }
      if (isSelected) {
        badgeColor = 'bg-blue-600 border-white text-white ring-4 ring-blue-300 shadow-lg';
      }

      const iconHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center">
          <div class="w-8 h-8 rounded-full ${badgeColor} border-2 flex items-center justify-center font-bold text-xs transition-transform transform hover:scale-110">
            <span>H</span>
          </div>
          ${isSelected ? '<div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></div>' : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-hospital-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([hosp.latitude, hosp.longitude], { icon: customIcon });

      const popupContent = `
        <div class="p-2 space-y-1.5 min-w-[210px]">
          <div class="font-bold text-xs text-slate-900">${hosp.name}</div>
          <div class="text-[11px] text-slate-500">${hosp.address}</div>
          <div class="flex items-center justify-between gap-2 text-[10px] pt-1.5 border-t border-slate-100">
            <span class="px-2 py-0.5 rounded-full ${hosp.accepting_emergencies ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'} font-semibold">
              ${hosp.accepting_emergencies ? 'ACCEPTING' : 'DIVERTED'}
            </span>
            <span class="text-slate-700 font-semibold">${hosp.available_emergency_beds} Beds Free</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      if (onSelectHospital) {
        marker.on('click', () => onSelectHospital(hosp));
      }

      markersLayer.addLayer(marker);
      bounds.extend([hosp.latitude, hosp.longitude]);
    });

    // 2. Render Emergency Pin (Clean SVG Icon, No Emojis)
    if (emergency) {
      const emergencyHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center text-white shadow-lg pulse-red">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      `;

      const emergencyIcon = L.divIcon({
        html: emergencyHtml,
        className: 'custom-emergency-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const emgMarker = L.marker([emergency.latitude, emergency.longitude], { icon: emergencyIcon });
      emgMarker.bindPopup(`
        <div class="p-2 space-y-1">
          <div class="flex items-center gap-1 text-[11px] font-bold text-rose-700">
            <span class="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
            ACTIVE INCIDENT
          </div>
          <div class="text-xs text-slate-900 font-bold">${emergency.incident_reference} (${emergency.severity})</div>
          <div class="text-[11px] text-slate-500">${emergency.location_name}</div>
        </div>
      `);

      markersLayer.addLayer(emgMarker);
      bounds.extend([emergency.latitude, emergency.longitude]);
    }

    // 3. Draw Route Polyline
    if (emergency && selectedHospital) {
      const routePoints: [number, number][] = routeCoordinates && routeCoordinates.length > 0 
        ? routeCoordinates 
        : [
            [emergency.latitude, emergency.longitude],
            [selectedHospital.latitude, selectedHospital.longitude]
          ];

      const polyline = L.polyline(routePoints, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round',
      }).addTo(map);

      routeLayerRef.current = polyline;
      bounds.extend([selectedHospital.latitude, selectedHospital.longitude]);
    }

    // Auto-fit bounds if markers exist
    if (bounds.isValid() && (hospitals.length > 0 || emergency)) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [hospitals, emergency, selectedHospital, routeCoordinates, onSelectHospital]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      
      {/* Clean Light Map Legend Overlay */}
      <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-xs space-y-1">
        <div className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-1">Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          <span className="text-[11px] text-slate-700">Accepting (Normal)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span className="text-[11px] text-slate-700">Limited / Stale</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
          <span className="text-[11px] text-slate-700">Closed / Diverted</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-rose-200"></span>
          <span className="text-[11px] text-slate-700">Active Incident</span>
        </div>
      </div>
    </div>
  );
};
