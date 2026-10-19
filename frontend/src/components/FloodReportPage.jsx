import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Building,
  Users,
  Compass,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function FloodReportPage({
  language,
  selectedWard,
  appliedRain,
  appliedApi
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rainMm, setRainMm] = useState(appliedRain || 75.0);
  const [apiMm, setApiMm] = useState(appliedApi || 110.0);

  const fetchReport = async (r, a) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analyzer/comprehensive-report?rain_24h_mm=${r}&api_7d_mm=${a}`);
      const data = await res.json();
      setReport(data);
    } catch (e) {
      console.error('Error fetching report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(rainMm, apiMm);
  }, [rainMm, apiMm]);

  useEffect(() => {
    if (appliedRain && appliedRain !== rainMm) {
      setRainMm(appliedRain);
      if (appliedApi) setApiMm(appliedApi);
    }
  }, [appliedRain, appliedApi]);

  const handlePrint = () => {
    window.print();
  };

  const isTa = language === 'ta';

  return (
    <div style={{ maxWidth: '1080px', margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="font-heading" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="var(--accent-blue)" />
            {isTa ? 'அதிகாரப்பூர்வ வெள்ள அபாய மற்றும் மூழ்கல் மதிப்பீட்டு அறிக்கை' : 'Official Flood Risk & Inundation Assessment Report'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Prepared for Coimbatore City Municipal Corporation (CCMC) & TNSDMA Emergency Operations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setRainMm(65.0); setApiMm(85.0); }}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            Moderate Monsoon (65mm)
          </button>
          <button
            onClick={() => { setRainMm(110.0); setApiMm(180.0); }}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            Severe Storm (110mm)
          </button>
          <button
            onClick={handlePrint}
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Official Assessment Document Container */}
      {report && (
        <div className="glass-panel printable-report" style={{ padding: '36px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.95)' }}>
          {/* Document Header & State Emblem Text */}
          <div style={{ borderBottom: '2px solid rgba(255,255,255,0.15)', paddingBottom: '18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                GOVERNMENT OF TAMIL NADU &bull; DISASTER MANAGEMENT
              </div>
              <h1 className="font-heading" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                COIMBATORE CITY MUNICIPAL CORPORATION FLOOD RISK ASSESSMENT
              </h1>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Operational 24-Hour Lead-Time Spatial Inundation Advisory
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                {report.report_id}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Generated: {report.generated_at}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--tier-orange)', fontWeight: 600, marginTop: '2px' }}>
                Lead Time: Next 24 Hours
              </div>
            </div>
          </div>

          {/* Meteorological Baseline */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              1. Meteorological & Hydrological Context
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>24h Rainfall Forecast</span>
                <div className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                  {report.meteorological_conditions.forecast_24h_rainfall_mm} mm
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>7-Day API (Soil Saturation)</span>
                <div className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                  {report.meteorological_conditions.antecedent_precipitation_index_mm} mm
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Event Classification</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tier-orange)' }}>
                  {report.meteorological_conditions.storm_classification}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Assessed Geographic Scope</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                  {report.study_area}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              2. Executive Operational Summary
            </h4>
            <p style={{ fontSize: '0.88rem', lineHeight: '1.6', color: '#e2e8f0', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', borderLeft: '4px solid var(--accent-blue)' }}>
              {report.executive_summary}
            </p>
          </div>

          {/* Target Inspected Ward Profile (Mapped from Clicked Map Area) */}
          {selectedWard && (
            <div style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                    TARGET INSPECTED WARD FOCUS
                  </span>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Ward {selectedWard.ward_number}: {selectedWard.ward_name} ({selectedWard.zone_name} Zone)
                  </h4>
                </div>
                <span className={`tier-tag ${selectedWard.risk_tier || 'green'}`} style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 800 }}>
                  {selectedWard.risk_tier?.toUpperCase()} TIER
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                <div>Centroid GPS: <strong style={{ color: '#fff' }}>{selectedWard.centroid_lat?.toFixed(4)}°N, {selectedWard.centroid_lon?.toFixed(4)}°E</strong></div>
                <div>Mean Elevation: <strong style={{ color: '#fff' }}>{selectedWard.elevation_mean_m}m MSL</strong></div>
                <div>Drainage Gap (HAND): <strong style={{ color: '#fff' }}>{selectedWard.hand_m}m</strong></div>
                <div>Topographic Wetness (TWI): <strong style={{ color: '#fff' }}>{selectedWard.twi}</strong></div>
                <div>Calibrated Probability: <strong style={{ color: '#fff' }}>{(selectedWard.calibrated_probability * 100).toFixed(1)}%</strong></div>
                <div>Resident Population: <strong style={{ color: '#fff' }}>{selectedWard.population?.toLocaleString()}</strong></div>
              </div>
            </div>
          )}

          {/* Citywide Tier Aggregates */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div className="stat-pill" style={{ borderLeft: '3px solid var(--tier-red)' }}>
              <span className="stat-label">RED ALERT WARDS</span>
              <span className="stat-value" style={{ color: 'var(--tier-red)' }}>{report.tier_distribution.red}</span>
            </div>
            <div className="stat-pill" style={{ borderLeft: '3px solid var(--tier-orange)' }}>
              <span className="stat-label">ORANGE WARNING WARDS</span>
              <span className="stat-value" style={{ color: 'var(--tier-orange)' }}>{report.tier_distribution.orange}</span>
            </div>
            <div className="stat-pill" style={{ borderLeft: '3px solid var(--tier-yellow)' }}>
              <span className="stat-label">YELLOW WATCH WARDS</span>
              <span className="stat-value" style={{ color: 'var(--tier-yellow)' }}>{report.tier_distribution.yellow}</span>
            </div>
            <div className="stat-pill" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
              <span className="stat-label">TOTAL EXPOSED POPULATION</span>
              <span className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{report.total_exposed_population.toLocaleString()}</span>
            </div>
            <div className="stat-pill" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
              <span className="stat-label">INUNDATED LAND AREA</span>
              <span className="stat-value" style={{ color: 'var(--accent-purple)' }}>{report.total_inundated_area_sqkm} km&sup2;</span>
            </div>
          </div>

          {/* Priority At-Risk Wards Table */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              3. Priority Intervention Wards & Estimated Waterlogging Depths
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Ward</th>
                    <th style={{ padding: '8px 10px' }}>Zone</th>
                    <th style={{ padding: '8px 10px' }}>Risk Tier</th>
                    <th style={{ padding: '8px 10px' }}>Calibrated Probability</th>
                    <th style={{ padding: '8px 10px' }}>Waterlogging Depth (cm)</th>
                    <th style={{ padding: '8px 10px' }}>HAND (m)</th>
                    <th style={{ padding: '8px 10px' }}>Primary Physical Bottleneck</th>
                  </tr>
                </thead>
                <tbody>
                  {report.priority_wards_at_risk.map((w, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#fff' }}>
                        Ward {w.ward_number}: {w.ward_name}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{w.zone_name}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span className={`tier-tag ${w.risk_tier || 'green'}`}>
                          {(w.risk_tier || 'clear').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                        {(w.probability * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: w.estimated_waterlogging_depth_cm >= 60 ? 'var(--tier-red)' : 'var(--tier-orange)' }}>
                        {w.estimated_waterlogging_depth_cm} cm
                      </td>
                      <td style={{ padding: '8px 10px' }}>{w.hand_m} m</td>
                      <td style={{ padding: '8px 10px', color: '#cbd5e1', fontSize: '0.74rem' }}>
                        {w.primary_bottleneck}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Critical Emergency Recommendations & Directives */}
          <div>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              4. Immediate Emergency Directives & Pump Mobilization Plan
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.critical_action_recommendations.map((rec, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <ShieldAlert size={16} color="var(--accent-cyan)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {rec}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Official Sign-off Footer */}
          <div style={{ marginTop: '36px', paddingTop: '18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div>
              <div>System: Coimbatore Urban Flood AI Operational Engine v2.0</div>
              <div>Model: Calibrated XGBoost (202,000 Sample Historical Training Archive)</div>
              <div>Helpline: District Disaster Emergency Center 1077</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#fff' }}>CCMC / TNSDMA Duty Officer</div>
              <div>Emergency Operations Center, Coimbatore</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
