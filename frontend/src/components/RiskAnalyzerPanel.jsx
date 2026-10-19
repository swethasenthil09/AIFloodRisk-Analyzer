import React, { useState, useEffect } from 'react';
import {
  Sliders,
  HelpCircle,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Compass,
  Calendar,
  Layers,
  MapPin,
  Waves,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function RiskAnalyzerPanel({
  selectedWard,
  onSelectWard,
  wards,
  currentRain,
  currentApi,
  onApplyRainfall,
  language
}) {
  const [rainRange, setRainRange] = useState(currentRain || 65.0);
  const [apiRange, setApiRange] = useState(currentApi || 85.0);
  const [whyData, setWhyData] = useState(null);
  const [rangeCurve, setRangeCurve] = useState([]);
  const [scenarioMatrix, setScenarioMatrix] = useState([]);
  const [loadingWhy, setLoadingWhy] = useState(false);
  const [activeSubView, setActiveSubView] = useState('decomposition'); // 'decomposition', 'scenarios'

  // Fetch 'Why is this ward at risk?' factor breakdown
  useEffect(() => {
    if (!selectedWard) return;
    setLoadingWhy(true);
    fetch(`/api/analyzer/ward-why/${selectedWard.ward_id}?rain_24h_mm=${rainRange}`)
      .then(r => r.json())
      .then(data => setWhyData(data))
      .catch(e => console.error(e))
      .finally(() => setLoadingWhy(false));
  }, [selectedWard, rainRange]);

  // Fetch Progressive Exposure Curve
  useEffect(() => {
    fetch(`/api/analyzer/range-curve?api_7d_mm=${apiRange}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.curve) setRangeCurve(data.curve);
      })
      .catch(e => console.error(e));
  }, [apiRange]);

  // Fetch 5-Scenario Matrix
  useEffect(() => {
    fetch('/api/analyzer/scenario-matrix')
      .then(r => r.json())
      .then(data => {
        if (data && data.scenarios) setScenarioMatrix(data.scenarios);
      })
      .catch(e => console.error(e));
  }, []);

  const handleSliderChange = (newVal) => {
    setRainRange(newVal);
    onApplyRainfall(newVal, apiRange);
  };

  const handlePresetEvent = (presetRain, presetApi) => {
    setRainRange(presetRain);
    setApiRange(presetApi);
    onApplyRainfall(presetRain, presetApi);
  };

  const isTa = language === 'ta';

  // Calculate estimated waterlogging depth for selected ward
  const estimatedDepthCm = selectedWard ? Math.max(
    5,
    Math.round(
      ((rainRange / 5.5) - ((selectedWard.drainage_capacity_mmhr ?? selectedWard.baseline_drainage_capacity_mmhr ?? 40.0) * 0.35)) *
      2.2 *
      Math.max(0.2, (5.5 - (selectedWard.hand_m ?? selectedWard.hand_mean_m ?? 3.5)) * 1.4) +
      ((selectedWard.calibrated_probability ?? 0.1) * 18.0)
    )
  ) : 0;

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Panel Title & Ward Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={18} color="var(--accent-cyan)" />
            {isTa ? 'ஆழ்ந்த இடஞ்சார்ந்த அபாய பகுப்பாய்வி (Risk Analyser)' : 'In-Depth Spatial-Temporal Flood Risk Analyser'}
          </h3>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Physical Factor Decomposition &bull; Waterlogging Depth &bull; Stress Testing
          </p>
        </div>

        {/* Quick Ward Picker Dropdown */}
        {wards && wards.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color="var(--accent-blue)" />
            <select
              value={selectedWard?.ward_id || ''}
              onChange={(e) => {
                const found = wards.find(w => w.ward_id === e.target.value);
                if (found) onSelectWard(found);
              }}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.76rem',
                outline: 'none',
                maxWidth: '220px'
              }}
            >
              {wards.map(w => (
                <option key={w.ward_id} value={w.ward_id}>
                  Ward {w.ward_number}: {w.ward_name} ({w.zone_name}) - {(w.risk_tier || 'clear').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Historical Disaster Presets */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Historical Monsoon Presets:
          </span>
          <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>
            Rain: {rainRange} mm | API: {apiRange} mm
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handlePresetEvent(86.0, 140.0)}
            className={`btn-secondary ${rainRange === 86.0 ? 'active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Calendar size={12} /> 2024 NE Monsoon (86mm)
          </button>
          <button
            onClick={() => handlePresetEvent(110.0, 185.0)}
            className={`btn-secondary ${rainRange === 110.0 ? 'active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Calendar size={12} /> 2021 Severe Deluge (110mm)
          </button>
          <button
            onClick={() => handlePresetEvent(135.0, 240.0)}
            className={`btn-secondary ${rainRange === 135.0 ? 'active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Calendar size={12} /> 2018 Megaflood (135mm)
          </button>
          <button
            onClick={() => handlePresetEvent(25.0, 35.0)}
            className={`btn-secondary ${rainRange === 25.0 ? 'active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Calendar size={12} /> Normal Showers (25mm)
          </button>
        </div>
      </div>

      {/* Range Sensitivity Slider */}
      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
            Continuous 24h Rainfall Stress:
          </span>
          <span className="mono" style={{ fontSize: '0.92rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
            {rainRange} mm
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          step="5"
          value={rainRange}
          onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          style={{ width: '100%', height: '6px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '4px' }}>
          <span>0mm (Dry)</span>
          <span>50mm (Moderate)</span>
          <span>100mm (Cloudburst)</span>
          <span>150mm (Severe)</span>
          <span>200mm (Extreme)</span>
        </div>
      </div>

      {/* View Switcher: Factor Decomposition vs 5-Scenario Comparison */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveSubView('decomposition')}
          style={{
            background: activeSubView === 'decomposition' ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: activeSubView === 'decomposition' ? '#60a5fa' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Factor Decomposition ("Why at Risk?")
        </button>
        <button
          onClick={() => setActiveSubView('scenarios')}
          style={{
            background: activeSubView === 'scenarios' ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: activeSubView === 'scenarios' ? '#60a5fa' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Multi-Scenario Matrix (25mm &rarr; 160mm)
        </button>
      </div>

      {/* VIEW 1: FACTOR DECOMPOSITION */}
      {activeSubView === 'decomposition' && selectedWard && whyData && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Spatial Physical Risk Attribution:
              </span>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff' }}>
                Ward {selectedWard.ward_number}: {selectedWard.ward_name} ({selectedWard.zone_name})
              </h4>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`tier-tag ${whyData.risk_tier}`}>
                  {(whyData.calibrated_flood_probability * 100).toFixed(1)}% Risk
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--tier-orange)', fontWeight: 700, marginTop: '2px' }}>
                Est. Depth: ~{estimatedDepthCm} cm
              </div>
            </div>
          </div>

          {/* 4 Factor Contribution Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            {/* Factor 1: Low-Lying HAND Elevation */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                <span style={{ color: '#cbd5e1' }}>
                  1. Topographical Depression (HAND: {whyData.factor_breakdown.hand_value_m} m)
                </span>
                <span className="mono" style={{ color: 'var(--tier-orange)', fontWeight: 700 }}>
                  {whyData.factor_breakdown.hand_depression_score}%
                </span>
              </div>
              <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${whyData.factor_breakdown.hand_depression_score}%`, height: '100%', background: 'linear-gradient(90deg, #f97316, #ef4444)' }}></div>
              </div>
            </div>

            {/* Factor 2: Topographic Wetness Index Flow Convergence */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                <span style={{ color: '#cbd5e1' }}>
                  2. Overland Flow Convergence (TWI: {whyData.factor_breakdown.twi_value})
                </span>
                <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  {whyData.factor_breakdown.wetness_convergence_score}%
                </span>
              </div>
              <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${whyData.factor_breakdown.wetness_convergence_score}%`, height: '100%', background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }}></div>
              </div>
            </div>

            {/* Factor 3: Proximity to Stream / River Canal */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                <span style={{ color: '#cbd5e1' }}>
                  3. Drainage / Lake Proximity ({whyData.factor_breakdown.distance_to_drain_m} m)
                </span>
                <span className="mono" style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>
                  {whyData.factor_breakdown.drainage_proximity_score}%
                </span>
              </div>
              <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${whyData.factor_breakdown.drainage_proximity_score}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)' }}></div>
              </div>
            </div>

            {/* Factor 4: Storm Sewer Bottleneck Deficit */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                <span style={{ color: '#cbd5e1' }}>
                  4. Drainage Surcharge Deficit (Cap: {whyData.factor_breakdown.drainage_capacity_mmhr} mm/hr)
                </span>
                <span className="mono" style={{ color: 'var(--tier-red)', fontWeight: 700 }}>
                  {whyData.factor_breakdown.storm_drainage_deficit_score}%
                </span>
              </div>
              <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${whyData.factor_breakdown.storm_drainage_deficit_score}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }}></div>
              </div>
            </div>
          </div>

          {/* Physical Explanatory Findings */}
          <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
              <HelpCircle size={14} /> Physical Site Characteristics:
            </span>
            {whyData.explanatory_findings.map((note, idx) => (
              <div key={idx} style={{ fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '2px' }}>
                &bull; {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: 5-SCENARIO MATRIX */}
      {activeSubView === 'scenarios' && scenarioMatrix.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Scenario</th>
                <th style={{ padding: '6px 8px' }}>Rain/API</th>
                <th style={{ padding: '6px 8px' }}>Red Alert</th>
                <th style={{ padding: '6px 8px' }}>Orange Warn</th>
                <th style={{ padding: '6px 8px' }}>Exposed Pop</th>
                <th style={{ padding: '6px 8px' }}>Inundated Area</th>
              </tr>
            </thead>
            <tbody>
              {scenarioMatrix.map((sc, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px', fontWeight: 600, color: '#fff' }}>{sc.scenario_name}</td>
                  <td style={{ padding: '8px' }}>{sc.rain_24h_mm}mm / {sc.api_7d_mm}mm</td>
                  <td style={{ padding: '8px', color: sc.red_wards > 0 ? 'var(--tier-red)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {sc.red_wards} wards
                  </td>
                  <td style={{ padding: '8px', color: sc.orange_wards > 0 ? 'var(--tier-orange)' : 'var(--text-muted)' }}>
                    {sc.orange_wards} wards
                  </td>
                  <td style={{ padding: '8px' }}>{sc.exposed_population.toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{sc.exposed_area_sqkm} km&sup2;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Progressive Inundation Progression Curve */}
      {rangeCurve.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} color="var(--tier-orange)" />
            Progressive Inundation Curve (Rainfall vs High-Risk Wards):
          </h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px', paddingTop: '8px' }}>
            {rangeCurve.map((pt, idx) => {
              const maxHigh = 100;
              const barHeight = Math.max(8, (pt.high_risk_wards_count / maxHigh) * 65);
              const isCurrent = Math.abs(pt.rainfall_mm - rainRange) < 20;

              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <span className="mono" style={{ fontSize: '0.66rem', color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-dim)', fontWeight: isCurrent ? 700 : 400 }}>
                    {pt.high_risk_wards_count}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${barHeight}px`,
                      background: isCurrent ? 'linear-gradient(180deg, #f97316, #ef4444)' : 'rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      transition: 'all 0.3s'
                    }}
                  ></div>
                  <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                    {pt.rainfall_mm}mm
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
