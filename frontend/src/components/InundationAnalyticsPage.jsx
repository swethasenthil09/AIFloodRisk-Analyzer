import React, { useState, useEffect } from 'react';
import {
  Waves,
  Droplets,
  AlertOctagon,
  Users,
  Building,
  MapPin,
  Filter,
  Search,
  ArrowUpDown,
  Compass,
  Layers,
  ShieldAlert,
  Sliders
} from 'lucide-react';

export default function InundationAnalyticsPage({
  language,
  selectedWard,
  onSelectWard,
  appliedRain,
  appliedApi
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rainMm, setRainMm] = useState(appliedRain || 65.0);
  const [apiMm, setApiMm] = useState(appliedApi || 85.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedDepthCat, setSelectedDepthCat] = useState('ALL');
  const [sortField, setSortField] = useState('waterlogging_depth_cm');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch Inundation Distribution from backend
  const fetchInundationData = async (rain, api) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analyzer/inundation-distribution?rain_24h_mm=${rain}&api_7d_mm=${api}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Error fetching inundation distribution:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInundationData(rainMm, apiMm);
  }, [rainMm, apiMm]);

  // Sync with external appliedRain when changed
  useEffect(() => {
    if (appliedRain && appliedRain !== rainMm) {
      setRainMm(appliedRain);
      if (appliedApi) setApiMm(appliedApi);
    }
  }, [appliedRain, appliedApi]);

  const handlePreset = (r, a) => {
    setRainMm(r);
    setApiMm(a);
  };

  const isTa = language === 'ta';

  const selectedWardInundation = selectedWard && data?.all_wards_inundation
    ? data.all_wards_inundation.find(w => w.ward_id === selectedWard.ward_id)
    : null;

  // Filter and sort wards
  const filteredWards = (data?.all_wards_inundation || []).filter(w => {
    if (!w) return false;
    const wName = w.ward_name || '';
    const zName = w.zone_name || '';
    const matchesSearch =
      wName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(w.ward_number ?? '').includes(searchQuery) ||
      zName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesZone = selectedZone === 'ALL' || zName === selectedZone;
    const matchesCat = selectedDepthCat === 'ALL' || w.depth_category === selectedDepthCat;

    return matchesSearch && matchesZone && matchesCat;
  }).sort((a, b) => {
    const mult = sortOrder === 'asc' ? 1 : -1;
    const valA = a?.[sortField] ?? 0;
    const valB = b?.[sortField] ?? 0;
    return (valA > valB ? 1 : -1) * mult;
  });

  return (
    <div style={{ maxWidth: '1240px', margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(6,182,212,0.15)', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
              <Waves size={24} />
            </div>
            <div>
              <h2 className="font-heading" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isTa ? 'வார்டு வாரியான வெள்ள மூழ்கல் மற்றும் ஆழ விநியோக பகுப்பாய்வு' : 'Ward Inundation Distribution & Waterlogging Depth Analytics'}
                {loading && <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(6,182,212,0.1)' }}>Recalculating...</span>}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isTa
                  ? 'கோயம்புத்தூர் 100 வார்டுகளின் வெள்ளப் பரப்பளவு, நீர்மட்ட ஆழம் (செ.மீ) மற்றும் கட்டமைப்பு பாதிப்பு'
                  : 'Physics-Based Runoff & HAND Topographic Inundation Across Coimbatore City (100 Wards)'}
              </p>
            </div>
          </div>
        </div>

        {/* Historical Disaster / Storm Scenario Presets */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            {isTa ? 'மழை அளவு தேர்வு:' : 'Rain Scenarios:'}
          </span>
          <button
            onClick={() => handlePreset(25.0, 35.0)}
            className={`btn-secondary ${rainMm === 25.0 ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
          >
            25mm (Normal)
          </button>
          <button
            onClick={() => handlePreset(65.0, 85.0)}
            className={`btn-secondary ${rainMm === 65.0 ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
          >
            65mm (Monsoon)
          </button>
          <button
            onClick={() => handlePreset(100.0, 150.0)}
            className={`btn-secondary ${rainMm === 100.0 ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
          >
            100mm (Cloudburst)
          </button>
          <button
            onClick={() => handlePreset(140.0, 240.0)}
            className={`btn-secondary ${rainMm === 140.0 ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
          >
            140mm (Extreme)
          </button>
        </div>
      </div>

      {/* Clicked Ward Live Inundation & Topographic Summary Banner */}
      {selectedWard && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.14), rgba(37,99,235,0.08))',
          border: '1px solid rgba(56,189,248,0.4)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.72rem', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                📍 {isTa ? 'வரைபடத்தில் கிளிக் செய்யப்பட்ட பகுதி' : 'MAPPED CLICKED REGION'}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                Ward {selectedWard.ward_number}: {selectedWard.ward_name} ({selectedWard.zone_name} Zone)
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              Centroid: {selectedWard.centroid_lat?.toFixed(4)}°N, {selectedWard.centroid_lon?.toFixed(4)}°E &bull; Elevation: {selectedWard.elevation_mean_m}m MSL &bull; HAND: {selectedWard.hand_m}m &bull; Wetness TWI: {selectedWard.twi} &bull; Population: {selectedWard.population?.toLocaleString()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Estimated Waterlogging Depth</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: (selectedWardInundation?.waterlogging_depth_cm || 0) >= 30 ? 'var(--tier-red)' : '#38bdf8' }}>
                {selectedWardInundation ? `${selectedWardInundation.waterlogging_depth_cm} cm` : 'Evaluating...'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Inundation Runoff Volume</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>
                {selectedWardInundation?.inundated_area_sqkm
                  ? `${Math.round(selectedWardInundation.inundated_area_sqkm * 1000 * (selectedWardInundation.waterlogging_depth_cm || 10) * 10).toLocaleString()} m³`
                  : '--'}
              </div>
            </div>
            <span className={`tier-tag ${selectedWard.risk_tier || 'green'}`} style={{ fontSize: '0.85rem', padding: '6px 14px', fontWeight: 800 }}>
              {selectedWard.risk_tier?.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Dynamic Range Slider Card */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={15} color="var(--accent-blue)" />
            {isTa ? 'மழை அழுத்த வரம்பு (24 மணி நேரம்):' : 'Interactive Rainfall Stress Simulation:'}
          </span>
          <span className="mono" style={{ fontSize: '1.05rem', color: 'var(--accent-blue)', fontWeight: 800 }}>
            {rainMm} mm / 24h &bull; <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>API: {apiMm} mm</span>
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="200"
          step="5"
          value={rainMm}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setRainMm(val);
            setApiMm(Math.round(val * 1.3));
          }}
          style={{ width: '100%', height: '7px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '6px' }}>
          <span>10mm (Dry baseline)</span>
          <span>50mm (Moderate monsoon)</span>
          <span>100mm (Intense cloudburst)</span>
          <span>150mm (Severe urban flash flood)</span>
          <span>200mm (Catastrophic deluge)</span>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--accent-cyan)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {isTa ? 'மொத்த வெள்ளப் பரப்பளவு' : 'Total City Inundated Area'}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {data.total_city_inundated_sqkm}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>sq. km</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Out of 194.2 sq. km total municipal area
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--tier-orange)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {isTa ? 'பாதிக்கப்படக்கூடிய மக்கள் தொகை' : 'Exposed Population'}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--tier-orange)' }}>
                {data.total_city_exposed_population?.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>citizens</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Estimated ~{Math.round(data.total_city_exposed_population / 4.2).toLocaleString()} residential buildings
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--tier-red)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {isTa ? 'அபாயகரமான மூழ்கல் வார்டுகள் (>60 செ.மீ)' : 'Extreme Submergence (>60cm)'}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--tier-red)' }}>
                {data.depth_categories?.extreme_over_60cm?.count || 0}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>wards</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Vehicular submergence & immediate pump deployment
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--tier-yellow)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {isTa ? 'கடுமையான நீர்த்தேக்க வார்டுகள் (30-60 செ.மீ)' : 'Severe Waterlogging (30–60cm)'}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--tier-yellow)' }}>
                {data.depth_categories?.severe_30_60cm?.count || 0}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>wards</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Arterial road traffic diversion required
            </div>
          </div>
        </div>
      )}

      {/* Waterlogging Depth Classification Breakdown */}
      {data?.depth_categories && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
            {isTa ? 'நீர்மட்ட ஆழ வகைப்பாடு மற்றும் தாக்க விநியோகம்' : 'Waterlogging Depth Classification & Impact Distribution'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
            {/* Category 1: Minor */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
                  &lt; 15 cm (Minor Film)
                </span>
                <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>
                  {data.depth_categories?.minor_under_15cm?.count ?? 0} Wards
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Passable to pedestrian & light traffic; street surface pooling only.
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Area: {data.depth_categories?.minor_under_15cm?.area_sqkm ?? 0} km&sup2; &bull; Pop: {data.depth_categories?.minor_under_15cm?.population?.toLocaleString() ?? 0}
              </div>
            </div>

            {/* Category 2: Moderate */}
            <div style={{ background: 'rgba(245,158,11,0.04)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--tier-yellow)' }}>
                  15 – 30 cm (Kerb Level)
                </span>
                <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tier-yellow)' }}>
                  {data.depth_categories?.moderate_15_30cm?.count ?? 0} Wards
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Water reaches walkway curbs; 2-wheeler skidding risk; slow traffic flow.
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Area: {data.depth_categories?.moderate_15_30cm?.area_sqkm ?? 0} km&sup2; &bull; Pop: {data.depth_categories?.moderate_15_30cm?.population?.toLocaleString() ?? 0}
              </div>
            </div>

            {/* Category 3: Severe */}
            <div style={{ background: 'rgba(249,115,22,0.06)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(249,115,22,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--tier-orange)' }}>
                  30 – 60 cm (Severe Hazard)
                </span>
                <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tier-orange)' }}>
                  {data.depth_categories?.severe_30_60cm?.count ?? 0} Wards
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Exceeds exhaust level of cars/autos; ground floors in low areas enter risk.
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Area: {data.depth_categories?.severe_30_60cm?.area_sqkm ?? 0} km&sup2; &bull; Pop: {data.depth_categories?.severe_30_60cm?.population?.toLocaleString() ?? 0}
              </div>
            </div>

            {/* Category 4: Extreme */}
            <div style={{ background: 'rgba(239,68,68,0.08)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--tier-red)' }}>
                  &gt; 60 cm (Extreme / Pump)
                </span>
                <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tier-red)' }}>
                  {data.depth_categories?.extreme_over_60cm?.count ?? 0} Wards
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Subway & underpass submergence; immediate road closure & heavy pumps.
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Area: {data.depth_categories?.extreme_over_60cm?.area_sqkm ?? 0} km&sup2; &bull; Pop: {data.depth_categories?.extreme_over_60cm?.population?.toLocaleString() ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Aggregation Breakdown Table */}
      {data?.zone_summary && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
            {isTa ? 'மண்டல வாரியான வெள்ள பாதிப்பு சுருக்கம் (Zone Aggregation)' : 'Zone-Wise Inundation Aggregate Summary'}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Zone</th>
                  <th style={{ padding: '10px 14px' }}>Total Wards</th>
                  <th style={{ padding: '10px 14px' }}>Severe/Critical Wards (&ge;30cm)</th>
                  <th style={{ padding: '10px 14px' }}>Inundated Area (km&sup2;)</th>
                  <th style={{ padding: '10px 14px' }}>Exposed Population</th>
                  <th style={{ padding: '10px 14px' }}>Priority Level</th>
                </tr>
              </thead>
              <tbody>
                {data.zone_summary.map((z, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#fff' }}>
                      {z.zone_name} Zone
                    </td>
                    <td style={{ padding: '12px 14px' }}>{z.total_wards}</td>
                    <td style={{ padding: '12px 14px', color: z.severe_or_critical_wards > 0 ? 'var(--tier-red)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {z.severe_or_critical_wards} wards
                    </td>
                    <td style={{ padding: '12px 14px' }}>{z.total_inundated_sqkm} km&sup2;</td>
                    <td style={{ padding: '12px 14px' }}>{z.total_exposed_pop?.toLocaleString() ?? 0}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`tier-tag ${z.severe_or_critical_wards >= 4 ? 'red' : (z.severe_or_critical_wards > 0 ? 'orange' : 'green')}`}>
                        {z.severe_or_critical_wards >= 4 ? 'EMERGENCY' : (z.severe_or_critical_wards > 0 ? 'MONITOR' : 'LOW RISK')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ward-by-Ward Master Inundation Distribution Table */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <div>
            <h3 className="font-heading" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              {isTa ? '100 வார்டு நீர்மட்ட ஆழ விவரப் பட்டியல்' : 'Detailed 100-Ward Inundation & Infrastructure Ledger'}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Showing {filteredWards.length} wards matching filters
            </span>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#1e293b', borderRadius: '8px', padding: '4px 10px', border: '1px solid var(--border-color)' }}>
              <Search size={14} color="var(--text-muted)" style={{ marginRight: '6px' }} />
              <input
                type="text"
                placeholder={isTa ? 'வார்டு பெயர் / எண்...' : 'Search ward or landmark...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.78rem', outline: 'none', width: '160px' }}
              />
            </div>

            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '8px', outline: 'none' }}
            >
              <option value="ALL">All Zones</option>
              <option value="Central">Central Zone</option>
              <option value="East">East Zone</option>
              <option value="West">West Zone</option>
              <option value="North">North Zone</option>
              <option value="South">South Zone</option>
            </select>

            <select
              value={selectedDepthCat}
              onChange={(e) => setSelectedDepthCat(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '8px', outline: 'none' }}
            >
              <option value="ALL">All Depth Categories</option>
              <option value="extreme_over_60cm">&gt; 60 cm (Extreme)</option>
              <option value="severe_30_60cm">30 – 60 cm (Severe)</option>
              <option value="moderate_15_30cm">15 – 30 cm (Moderate)</option>
              <option value="minor_under_15cm">&lt; 15 cm (Minor)</option>
            </select>
          </div>
        </div>

        {/* Master Table */}
        <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Ward</th>
                <th style={{ padding: '10px 12px' }}>Zone</th>
                <th style={{ padding: '10px 12px' }}>HAND (m)</th>
                <th style={{ padding: '10px 12px' }}>24h Rain</th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => { setSortField('waterlogging_depth_cm'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Waterlogging Depth (cm) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ padding: '10px 12px' }}>Inundation Category</th>
                <th style={{ padding: '10px 12px' }}>Inundated Area</th>
                <th style={{ padding: '10px 12px' }}>Exposed Citizens</th>
                <th style={{ padding: '10px 12px' }}>Critical Facilities & Chokepoints</th>
              </tr>
            </thead>
            <tbody>
              {filteredWards.map((w, idx) => {
                const isSelected = selectedWard && selectedWard.ward_id === w.ward_id;
                const isCritical = w.waterlogging_depth_cm >= 60.0;
                const isSevere = w.waterlogging_depth_cm >= 30.0 && w.waterlogging_depth_cm < 60.0;
                const depthColor = isCritical ? 'var(--tier-red)' : (isSevere ? 'var(--tier-orange)' : (w.waterlogging_depth_cm >= 15.0 ? 'var(--tier-yellow)' : '#94a3b8'));

                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectWard && onSelectWard(w)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: isSelected ? 'rgba(14,165,233,0.2)' : undefined,
                      boxShadow: isSelected ? 'inset 3px 0 0 #38bdf8' : undefined,
                      cursor: 'pointer'
                    }}
                    title="Click to map this ward across all telemetry and models"
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#fff' }}>
                      Ward {w.ward_number}: {w.ward_name}
                      {isSelected && (
                        <span style={{ marginLeft: '8px', fontSize: '0.65rem', background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          CLICKED
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                      {w.zone_name}
                    </td>
                    <td style={{ padding: '10px 12px', color: w.hand_m <= 2.5 ? 'var(--tier-orange)' : 'var(--text-muted)' }}>
                      {w.hand_m} m
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {w.rain_24h_mm} mm
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: depthColor, fontSize: '0.88rem' }}>
                      {w.waterlogging_depth_cm} cm
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`tier-tag ${w.risk_tier}`}>
                        {w.depth_label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {w.inundated_area_sqkm} km&sup2; <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({w.total_ward_area_sqkm ? Math.round((w.inundated_area_sqkm / w.total_ward_area_sqkm) * 100) : 0}%)</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {w.exposed_population?.toLocaleString() ?? 0}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#cbd5e1', fontSize: '0.74rem' }}>
                      {Array.isArray(w.critical_facilities) ? w.critical_facilities.join(', ') : w.critical_facilities}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
