import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, MapPin, Flag, AlertTriangle, ShieldCheck } from 'lucide-react';

// IMD tier visual configurations
// Normal (green) has fillOpacity: 0 so OpenStreetMap streets and topography are clean & visible.
// Only flagged regions (yellow, orange, red) are highlighted.
const TIER_COLORS = {
  green: { fill: 'transparent', border: 'rgba(148, 163, 184, 0.45)', opacity: 0.0, weight: 1.0 },
  yellow: { fill: '#f59e0b', border: '#d97706', opacity: 0.50, weight: 2.5 },
  orange: { fill: '#f97316', border: '#ea580c', opacity: 0.70, weight: 3.0 },
  red: { fill: '#ef4444', border: '#b91c1c', opacity: 0.85, weight: 3.5 }
};

export default function WardMap({ wards, selectedWard, onSelectWard, alerts, highlightedWards = [], language }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const geojsonLayerRef = useRef(null);
  const flagMarkersLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapStyle, setMapStyle] = useState('osm'); // 'osm' or 'topo'

  // Initialize Leaflet Map with authentic OpenStreetMap
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Centered on Coimbatore Core (Noyyal river & central wards)
    const map = L.map(mapRef.current, {
      center: [11.008, 76.960],
      zoom: 12,
      zoomControl: false,
      attributionControl: true
    });

    // Standard OpenStreetMap Tile Layer (Clean roads, topography, landmarks)
    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    }).addTo(map);

    tileLayerRef.current = osmLayer;
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Group for flood flag markers
    flagMarkersLayerRef.current = L.layerGroup().addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update Tile Style if toggled
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current) return;
    mapInstance.current.removeLayer(tileLayerRef.current);

    let newUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attr = '&copy; OpenStreetMap contributors';

    if (mapStyle === 'topo') {
      newUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attr = 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap';
    }

    const newLayer = L.tileLayer(newUrl, { maxZoom: 19, attribution: attr }).addTo(mapInstance.current);
    tileLayerRef.current = newLayer;

    // Bring polygon layers to front
    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.bringToFront();
    }
  }, [mapStyle]);

  // Update GeoJSON Polygons & Flag Markers when ward risk data or alerts change
  useEffect(() => {
    if (!mapInstance.current || !wards || wards.length === 0) return;

    // Clear previous geojson layer
    if (geojsonLayerRef.current) {
      mapInstance.current.removeLayer(geojsonLayerRef.current);
    }
    // Clear previous markers
    if (flagMarkersLayerRef.current) {
      flagMarkersLayerRef.current.clearLayers();
    }

    // Check for pending duty-officer alerts (RED alerts needing authorization)
    const pendingApprovalMap = {};
    (alerts || []).forEach(a => {
      if (a.status === 'pending_approval' && a.tier === 'red') {
        pendingApprovalMap[a.ward_id] = true;
      }
    });

    const featureCollection = {
      type: "FeatureCollection",
      features: (wards || []).filter(w => w && w.polygon_geojson).map(w => ({
        type: "Feature",
        id: w.ward_id,
        properties: { ...w },
        geometry: typeof w.polygon_geojson === 'string' ? JSON.parse(w.polygon_geojson) : w.polygon_geojson
      }))
    };

    // Render Polygons (Flagged regions illuminated with tier colors; normal green wards are transparent)
    const layer = L.geoJSON(featureCollection, {
      style: (feature) => {
        const wardId = feature.properties.ward_id;
        const tier = feature.properties.risk_tier || 'green';
        const isSelected = selectedWard && selectedWard.ward_id === wardId;
        const isHighlightedIssue = highlightedWards && highlightedWards.includes(wardId);
        const conf = TIER_COLORS[tier] || TIER_COLORS.green;
        const hasPendingApproval = pendingApprovalMap[wardId];

        if (isHighlightedIssue) {
          return {
            fillColor: tier === 'red' ? '#ef4444' : (tier === 'orange' ? '#f97316' : '#eab308'),
            fillOpacity: 0.82,
            color: '#ff0055',
            weight: 4.5,
            dashArray: '6 3'
          };
        }

        if (isSelected) {
          return {
            fillColor: tier === 'green' ? 'rgba(59, 130, 246, 0.25)' : conf.fill,
            fillOpacity: tier === 'green' ? 0.35 : 0.85,
            color: '#3b82f6',
            weight: 3.5,
            dashArray: '4 2'
          };
        }

        if (hasPendingApproval) {
          return {
            fillColor: '#ef4444',
            fillOpacity: 0.80,
            color: '#b91c1c',
            weight: 3.5
          };
        }

        return {
          fillColor: conf.fill,
          fillOpacity: conf.opacity,
          color: conf.border,
          weight: conf.weight
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const tier = p.risk_tier || 'green';
        const probPct = (p.calibrated_probability * 100).toFixed(1);
        const isFlagged = tier !== 'green';
        const hasPendingApproval = pendingApprovalMap[p.ward_id];

        layer.bindTooltip(
          `<div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #0f172a; padding: 4px;">
            <strong>Ward ${p.ward_number}: ${p.ward_name}</strong><br/>
            Zone: ${p.zone_name} | Status: <span style="text-transform: uppercase; font-weight: bold; color:${TIER_COLORS[tier]?.border}">
              ${isFlagged ? `🚩 ${tier.toUpperCase()}` : 'NORMAL / CLEAR'}
              ${hasPendingApproval ? ' (🚨 PENDING RED APPROVAL)' : ''}
            </span> (${probPct}%)<br/>
            HAND: ${p.hand_m}m | Wetness TWI: ${p.twi} | Rain: ${p.rain_24h_mm}mm
          </div>`,
          { sticky: true, className: 'leaflet-tooltip-clean' }
        );

        layer.on({
          click: () => {
            onSelectWard(p);
          },
          mouseover: (e) => {
            if (tier === 'green') {
              e.target.setStyle({ weight: 2.0, color: '#38bdf8' });
            } else {
              e.target.setStyle({ weight: 4.0 });
            }
          },
          mouseout: (e) => {
            if (geojsonLayerRef.current) {
              geojsonLayerRef.current.resetStyle(e.target);
            }
          }
        });
      }
    }).addTo(mapInstance.current);

    geojsonLayerRef.current = layer;

    // Add Visible Flood Flag Markers ONLY to genuinely flagged regions (Yellow, Orange, Red)
    // Clear/Normal (Green / 0% Risk) wards NEVER get clutter flag pins
    const flaggedWards = wards.filter(w => {
      const tier = w.risk_tier;
      return tier && tier !== 'green';
    });

    flaggedWards.forEach(w => {
      const tier = w.risk_tier; // 'yellow', 'orange', 'red'
      const iconSymbol = tier === 'red' ? '🚨' : (tier === 'orange' ? '⚠️' : '🚩');
      const tierLabel = tier === 'red' ? 'ALERT' : (tier === 'orange' ? 'WARN' : 'WATCH');

      const flagHtml = `
        <div class="map-flood-flag ${tier}" title="Ward ${w.ward_number}: ${w.ward_name} (${(w.calibrated_probability * 100).toFixed(0)}% Risk)">
          <span>${iconSymbol}</span>
          <span>W${w.ward_number} ${tierLabel}</span>
        </div>
      `;

      const flagIcon = L.divIcon({
        className: 'custom-div-flag',
        html: flagHtml,
        iconSize: [85, 24],
        iconAnchor: [42, 12]
      });

      const marker = L.marker([w.centroid_lat, w.centroid_lon], { icon: flagIcon });
      marker.on('click', () => {
        onSelectWard(w);
      });
      flagMarkersLayerRef.current.addLayer(marker);
    });

  }, [wards, selectedWard, alerts, highlightedWards]);

  // Pan smoothly to selected ward
  useEffect(() => {
    if (selectedWard && mapInstance.current) {
      mapInstance.current.flyTo([selectedWard.centroid_lat, selectedWard.centroid_lon], 13.5, {
        duration: 0.8
      });
    }
  }, [selectedWard]);

  const isTa = language === 'ta';

  return (
    <div className="map-viewport" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '440px', borderRadius: '12px', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Basemap Switcher (Clean OpenStreetMap standard / Topography - zero API key requirement) */}
      <div style={{
        position: 'absolute',
        top: '14px',
        right: '14px',
        zIndex: 800,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(12px)',
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.74rem'
      }}>
        <Layers size={13} color="var(--accent-cyan)" />
        <span style={{ color: 'var(--text-muted)' }}>Map:</span>
        <button
          onClick={() => setMapStyle('osm')}
          style={{
            background: mapStyle === 'osm' ? 'var(--accent-blue)' : 'transparent',
            color: mapStyle === 'osm' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          OSM Streets
        </button>
        <button
          onClick={() => setMapStyle('topo')}
          style={{
            background: mapStyle === 'topo' ? 'var(--accent-blue)' : 'transparent',
            color: mapStyle === 'topo' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Topography
        </button>
      </div>

      {/* Selected Ward Floating Inspector */}
      {selectedWard && (
        <div className="map-floating-panel" style={{ zIndex: 850 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <span className="font-heading" style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                Ward {selectedWard.ward_number}: {selectedWard.ward_name}
              </span>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Zone: {selectedWard.zone_name} | Population: {selectedWard.population?.toLocaleString()}
              </div>
            </div>
            <span className={`tier-tag ${selectedWard.risk_tier || 'green'}`}>
              {selectedWard.risk_tier === 'red' && '🚨 '}
              {selectedWard.risk_tier === 'orange' && '⚠️ '}
              {selectedWard.risk_tier === 'yellow' && '🚩 '}
              {(selectedWard.risk_tier || 'green').toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div className="stat-pill">
              <span className="stat-label">24h Calibrated Risk</span>
              <span className="stat-value" style={{ color: TIER_COLORS[selectedWard.risk_tier]?.border || '#38bdf8' }}>
                {(selectedWard.calibrated_probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Forecast Rain</span>
              <span className="stat-value">{selectedWard.rain_24h_mm} mm</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">HAND (Drainage Elev)</span>
              <span className="stat-value">{selectedWard.hand_m} m</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Wetness Index (TWI)</span>
              <span className="stat-value">{selectedWard.twi}</span>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '8px', textAlign: 'right' }}>
            Factor Decomposition Active Below &darr;
          </div>
        </div>
      )}

      {/* Map Legend (Refined: Clear OpenStreetMap with highlighted flood flags) */}
      <div className="map-legend" style={{ zIndex: 800 }}>
        <div className="legend-item">
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid #94a3b8', background: 'transparent' }}></span>
          <span>Clear / Normal (&lt;30%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot yellow"></span>
          <span>🚩 Watch (30–60%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot orange"></span>
          <span>⚠️ Warning (60–80%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot red"></span>
          <span>🚨 Alert (&ge;80%)</span>
        </div>
      </div>
    </div>
  );
}
