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
      
      let bg = '#10A98B';
      if (hosp.emergency_status === 'CLOSED' || !hosp.accepting_emergencies) bg = '#D93320';
      else if (hosp.emergency_status === 'LIMITED' || isStale) bg = '#E5A00D';
      if (isSelected) bg = '#121F38';
      const ring = isSelected ? ';box-shadow:0 0 0 5px rgba(16,169,139,.35),0 6px 14px rgba(10,20,40,.35)' : ';box-shadow:0 4px 10px rgba(10,20,40,.3)';

      const iconHtml = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer">
          <div style="width:34px;height:34px;border-radius:12px;background:${bg};border:2.5px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;font-family:Onest,sans-serif${ring}">+</div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-hospital-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([hosp.latitude, hosp.longitude], { icon: customIcon });

      const popupContent = `
        <div style="min-width:210px;font-family:Onest,sans-serif">
          <div style="font-weight:800;font-size:13px;color:#121F38">${hosp.name.replace('SIMULATED HOSPITAL — ', '')}</div>
          <div style="font-size:11.5px;color:#61728B;margin-top:2px">${hosp.address}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #E4EAF2;font-size:11px">
            <span style="padding:2px 8px;border-radius:99px;font-weight:700;background:${hosp.accepting_emergencies ? '#E8FBF6' : '#FFF2F0'};color:${hosp.accepting_emergencies ? '#0A6D5C' : '#B32716'}">${hosp.accepting_emergencies ? 'Accepting' : 'Diverted'}</span>
            <span style="font-weight:700;color:#34445E">${hosp.available_emergency_beds} beds free</span>
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
        <div class="pulse-red" style="width:34px;height:34px;border-radius:50%;background:#F04B39;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 14px rgba(240,75,57,.5)">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.6" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
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
        <div style="font-family:Onest,sans-serif">
          <div style="font-size:11px;font-weight:800;color:#B32716;letter-spacing:.06em">ACTIVE INCIDENT</div>
          <div style="font-size:13px;font-weight:800;color:#121F38;margin-top:2px">${emergency.incident_reference} (${emergency.severity})</div>
          <div style="font-size:11.5px;color:#61728B">${emergency.location_name}</div>
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
        color: '#10A98B',
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
    <div className="relative overflow-hidden rounded-[18px] border border-ink-100 bg-white shadow-[var(--shadow-card)]">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      <div className="absolute bottom-3 left-3 z-[400] hidden space-y-1.5 rounded-2xl border border-ink-100 bg-white/95 px-3.5 py-3 shadow-[var(--shadow-lift)] backdrop-blur sm:block">
        <div className="eyebrow !text-[9.5px]">Legend</div>
        {[['#10A98B', 'Accepting'], ['#E5A00D', 'Limited / stale'], ['#D93320', 'Closed / diverted'], ['#F04B39', 'Active incident']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-2 text-[11.5px] font-semibold text-ink-700"><span className="size-2.5 rounded-full" style={{ background: c }} />{l}</div>
        ))}
      </div>
    </div>
  );
};
