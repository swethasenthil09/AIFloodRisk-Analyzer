import React, { useState, useEffect } from 'react';
import {
  Compass,
  Waves,
  FileText,
  Radio,
  Users,
  Globe,
  FileCode,
  X,
  Droplets,
  CheckCircle2,
  ShieldAlert,
  Brain,
  Zap
} from 'lucide-react';

import WardMap from './components/WardMap';
import RiskAnalyzerPanel from './components/RiskAnalyzerPanel';
import InundationAnalyticsPage from './components/InundationAnalyticsPage';
import FloodReportPage from './components/FloodReportPage';
import CitizenPortal from './components/CitizenPortal';
import AlertQueue from './components/AlertQueue';
import SmsConsole from './components/SmsConsole';
import LiveWeatherPanel from './components/LiveWeatherPanel';
import ModelEvaluationPage from './components/ModelEvaluationPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('analyzer'); // 'analyzer', 'inundation', 'report', 'alerts', 'citizen'
  const [language, setLanguage] = useState('en'); // 'en' or 'ta'
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [tierDistribution, setTierDistribution] = useState({ green: 0, yellow: 0, orange: 0, red: 0 });

  // Current Rainfall State
  const [appliedRain, setAppliedRain] = useState(30.4);
  const [appliedApi, setAppliedApi] = useState(24.0);
  const [isFetchingLive, setIsFetchingLive] = useState(false);

  // CAP Modal State
  const [capData, setCapData] = useState(null);

  // Issue Highlighting & Action Approval Modal State
  const [highlightedIssuesWards, setHighlightedIssuesWards] = useState([]);
  const [actionApprovalModal, setActionApprovalModal] = useState(null);
  const [isBroadcastingSms, setIsBroadcastingSms] = useState(false);

  // Load Live Telemetry and Initial Risk
  const loadLiveRisk = async () => {
    try {
      const res = await fetch('/api/inference/latest');
      if (!res.ok) return;
      const data = await res.json();
      const pred = data?.prediction_results || {};
      setWards(pred.all_wards || []);
      setTierDistribution(pred.tier_distribution || {});
      setTelemetry(pred.telemetry || null);
      setAppliedRain(pred.applied_rain_24h_mm || 30.4);
      setAppliedApi(pred.applied_api_7d_mm || 24.0);

      if (pred.all_wards && pred.all_wards.length > 0 && !selectedWard) {
        // Default to Ward 75 or Ward 53 (Lanka Corner hotspot)
        setSelectedWard(pred.all_wards[52] || pred.all_wards[0]);
      }
    } catch (e) {
      console.error('Error loading live inference:', e);
    }
  };

  // Dedicated Live Telemetry Fetch Action
  const handleFetchLiveTelemetry = async () => {
    setIsFetchingLive(true);
    try {
      await fetch('/api/alerts/clear-simulation-alerts', { method: 'POST' });
      const targetQuery = selectedWard
        ? `?trigger_alerts=false&ward_id=${selectedWard.ward_id}&lat=${selectedWard.centroid_lat}&lon=${selectedWard.centroid_lon}`
        : `?trigger_alerts=false`;
      const res = await fetch(`/api/inference/latest${targetQuery}`);
      if (!res.ok) return;
      const data = await res.json();
      const pred = data?.prediction_results || {};
      setWards(pred.all_wards || []);
      setTierDistribution(pred.tier_distribution || {});
      setTelemetry(pred.telemetry || null);
      setAppliedRain(pred.applied_rain_24h_mm || 30.4);
      setAppliedApi(pred.applied_api_7d_mm || 24.0);

      // Re-map selected ward with fresh calculations
      if (selectedWard && pred.all_wards) {
        const refreshed = pred.all_wards.find(w => w.ward_id === selectedWard.ward_id);
        if (refreshed) setSelectedWard(refreshed);
      }

      await loadAlertsAndDeliveries();
    } catch (e) {
      console.error('Error fetching live telemetry:', e);
    } finally {
      setIsFetchingLive(false);
    }
  };

  // Synchronized Ward Selection (Maps live telemetry, risk calculations, and terrain factors)
  const handleSelectWard = async (wardData) => {
    if (!wardData) return;
    const full = (wards || []).find(w => w.ward_id === wardData.ward_id) || wardData;
    setSelectedWard(full);

    // Immediately fetch and map live telemetry for the clicked area's coordinates
    try {
      setIsFetchingLive(true);
      const res = await fetch(`/api/weather/live?ward_id=${full.ward_id}&lat=${full.centroid_lat}&lon=${full.centroid_lon}`);
      if (res.ok) {
        const liveTel = await res.json();
        setTelemetry(liveTel);
      }
    } catch (e) {
      console.error('Error mapping live telemetry to clicked ward:', e);
    } finally {
      setIsFetchingLive(false);
    }
  };

  // Load Alerts & SMS Deliveries
  const loadAlertsAndDeliveries = async () => {
    try {
      const [resAlt, resDel] = await Promise.all([
        fetch('/api/alerts?limit=60'),
        fetch('/api/alerts/deliveries/recent?limit=40')
      ]);
      const dataAlt = resAlt.ok ? await resAlt.json() : [];
      const dataDel = resDel.ok ? await resDel.json() : [];
      setAlerts(Array.isArray(dataAlt) ? dataAlt : []);
      setDeliveries(Array.isArray(dataDel) ? dataDel : []);
    } catch (e) {
      console.error('Error loading alerts:', e);
    }
  };

  useEffect(() => {
    loadLiveRisk();
    loadAlertsAndDeliveries();
    const interval = setInterval(() => {
      loadAlertsAndDeliveries();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Apply Rainfall Range from Analyzer Slider / Presets
  const handleApplyRainfall = async (rain, api, isLiveReset = false) => {
    if (isLiveReset || rain <= 35.0) {
      await handleFetchLiveTelemetry();
      setHighlightedIssuesWards([]);
      return;
    }
    setAppliedRain(rain);
    setAppliedApi(api);
    try {
      const res = await fetch('/api/inference/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rain_24h_mm: parseFloat(rain),
          api_7d_mm: parseFloat(api),
          trigger_alerts: true,
          operator_name: 'Risk_Analyzer_Console'
        })
      });
      const data = await res.json();
      const pred = data?.prediction_results || {};
      const allWards = pred.all_wards || [];
      setWards(allWards);
      setTierDistribution(pred.tier_distribution || {});
      await loadAlertsAndDeliveries();

      // Detect wards where possible issues are present
      const issueWards = allWards.filter(w => {
        const isHighTier = w.risk_tier === 'red' || w.risk_tier === 'orange';
        const isDepression = (w.hand_m || 3.0) <= 2.2 && (w.calibrated_probability || 0) >= 0.20;
        const isOverflow = (w.rain_24h_mm || 0) >= (w.drainage_capacity_mmhr || 35.0);
        return isHighTier || isDepression || isOverflow;
      });

      if (issueWards.length > 0 && rain >= 45.0) {
        setHighlightedIssuesWards(issueWards.map(w => w.ward_id));
        setActionApprovalModal({
          eventName: `${rain}mm Monsoon Storm Inundation`,
          rain_mm: rain,
          api_mm: api,
          issueWards,
          totalPopulation: issueWards.reduce((acc, w) => acc + (w.population || 38000), 0)
        });
      } else {
        setHighlightedIssuesWards([]);
      }
    } catch (e) {
      console.error('Inference simulation error:', e);
    }
  };

  // Dedicated Action Trigger with Map Highlighting and Citizen SMS Approval
  const handleTriggerActionWithApproval = async (rain, api, eventName = 'Heavy Rainfall Action') => {
    await handleApplyRainfall(rain, api, false);
  };

  // Confirm Citizen SMS Broadcast upon Officer Approval
  const handleConfirmAndSendWardSms = async () => {
    if (!actionApprovalModal) return;
    setIsBroadcastingSms(true);
    try {
      const targetWardIds = new Set(actionApprovalModal.issueWards.map(w => w.ward_id));
      const pendingAlerts = alerts.filter(a => targetWardIds.has(a.ward_id));

      if (pendingAlerts.length > 0) {
        for (const a of pendingAlerts) {
          await fetch(`/api/alerts/${a.alert_id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              officer_name: 'Duty Officer Authorization',
              notes: `Authorized emergency SMS delivery for ${actionApprovalModal.issueWards.length} flagged wards.`
            })
          });
        }
      }

      await loadAlertsAndDeliveries();
      alert(language === 'ta'
        ? `அங்கீகரிக்கப்பட்டது! ${actionApprovalModal.issueWards.length} வார்டுகளில் உள்ள பொதுமக்களுக்கு எச்சரிக்கை குறுஞ்செய்தி வெற்றிகரமாக அனுப்பப்பட்டது.`
        : `Approved & Broadcast! Emergency SMS dispatched to citizens across ${actionApprovalModal.issueWards.length} affected wards.`);
    } catch (e) {
      console.error('Error dispatching SMS:', e);
    } finally {
      setIsBroadcastingSms(false);
      setActionApprovalModal(null);
    }
  };

  // Approve Red Alert Action
  const handleApproveAlert = async (alertId) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officer_name: 'Dr. K. Swaminathan (TNSDMA Duty Officer)',
          notes: 'Emergency broadcast authorized per Coimbatore District SOP.'
        })
      });
      if (res.ok) {
        await loadAlertsAndDeliveries();
      }
    } catch (e) {
      console.error('Approval error:', e);
    }
  };

  // Open CAP 1.2 modal
  const handleOpenCap = async (alertId) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/cap`);
      const data = await res.json();
      setCapData(data);
    } catch (e) {
      console.error('Error fetching CAP:', e);
    }
  };

  // Clear old simulation alerts to sync with live weather baseline
  const handleClearPastAlerts = async () => {
    try {
      await fetch('/api/alerts/clear-simulation-alerts', { method: 'POST' });
      await loadAlertsAndDeliveries();
    } catch (e) {
      console.error('Error clearing alerts:', e);
    }
  };

  const isTa = language === 'ta';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-badge" style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)' }}>
            <Droplets size={24} />
          </div>
          <div className="brand-text">
            <h1>
              {isTa ? 'கோயம்புத்தூர் வெள்ள அபாய பகுப்பாய்வி மற்றும் முடிவு ஆதரவு தளம்' : 'COIMBATORE FLOOD RISK ANALYZER & DECISION PLATFORM'}
              <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(14,165,233,0.2)', color: '#38bdf8', fontWeight: 600 }}>
                OPERATIONAL v2.0
              </span>
            </h1>
            <p>
              {isTa ? 'தமிழ்நாடு பேரிடர் மேலாண்மை ஆணையம் (TNSDMA) & மாநகராட்சி (CCMC)' : 'TNSDMA & Coimbatore City Municipal Corporation (CCMC) Spatial Decision Support'}
            </p>
          </div>
        </div>

        {/* 5 Main Operational Tabs */}
        <div className="header-actions">
          <div className="nav-pill-group">
            <button
              className={`nav-pill ${activeTab === 'analyzer' ? 'active' : ''}`}
              onClick={() => setActiveTab('analyzer')}
            >
              <Compass size={15} />
              {isTa ? 'அபாய பகுப்பாய்வி' : 'Risk Analyzer'}
            </button>
            <button
              className={`nav-pill ${activeTab === 'inundation' ? 'active' : ''}`}
              onClick={() => setActiveTab('inundation')}
            >
              <Waves size={15} />
              {isTa ? 'நீர்மட்ட ஆழ விநியோகம்' : 'Inundation Distribution'}
            </button>
            <button
              className={`nav-pill ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              <FileText size={15} />
              {isTa ? 'மதிப்பீட்டு அறிக்கை' : 'Assessment Report'}
            </button>
            <button
              className={`nav-pill ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              <Radio size={15} />
              {isTa ? 'எச்சரிக்கைகள் & எஸ்எம்எஸ்' : 'Alerts & SMS'}
              {tierDistribution.red > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '10px', marginLeft: '4px' }}>
                  {tierDistribution.red}
                </span>
              )}
            </button>
            <button
              className={`nav-pill ${activeTab === 'citizen' ? 'active' : ''}`}
              onClick={() => setActiveTab('citizen')}
            >
              <Users size={15} />
              {isTa ? 'பொதுமக்கள் தளம்' : 'Citizen Advisory'}
            </button>
            <button
              className={`nav-pill ${activeTab === 'evaluation' ? 'active' : ''}`}
              onClick={() => setActiveTab('evaluation')}
            >
              <Brain size={15} />
              {isTa ? 'மாதிரி துல்லியம் & பயிற்சி/சோதனை' : 'Model Accuracy & Train/Test Data'}
            </button>
          </div>

          {/* Language Switcher */}
          <button
            className="lang-btn"
            onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
            title="Toggle English / தமிழ்"
          >
            <Globe size={14} />
            {language === 'en' ? 'தமிழ்' : 'English'}
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main style={{ flex: 1 }}>
        {/* TAB 1: SPATIAL-TEMPORAL RISK ANALYZER (PRIMARY MAP & FACTOR DECOMPOSITION) */}
        {activeTab === 'analyzer' && (
          <div className="dashboard-grid">
            {/* Left Column: Interactive Map (Clean OSM with illuminated flood flags) & Deep Risk Analyzer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
              {/* Live Meteorological Telemetry Panel & Mode Control */}
              <LiveWeatherPanel
                telemetry={telemetry}
                appliedRain={appliedRain}
                selectedWard={selectedWard}
                onFetchLive={handleFetchLiveTelemetry}
                onApplyStormSimulation={() => handleApplyRainfall(86.0, 140.0)}
                isFetchingLive={isFetchingLive}
                language={language}
              />

              {/* Emergency Action & Issue Highlighting Trigger Bar */}
              <div className="glass-panel" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(249,115,22,0.06))', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} color="#ef4444" />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>
                      {isTa ? 'அவசர இடர் நடவடிக்கை & எச்சரிக்கை சரிபார்ப்பு' : 'Emergency Action Assessment & Issue Highlighting'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {highlightedIssuesWards.length > 0 
                        ? `${highlightedIssuesWards.length} wards with detected issues highlighted in neon outline on map.` 
                        : (isTa ? 'அபாய வார்டுகளை வரைபடத்தில் ஒளிரச் செய்து பொதுமக்களுக்கு எஸ்எம்எஸ் அனுப்ப ஒப்புதல் கோரவும்.' : 'Trigger system action to highlight all vulnerable depression/overflow wards on the map and request citizen SMS dispatch authorization.')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleTriggerActionWithApproval(75.0, 95.0, '75mm Severe Monsoon Downpour')}
                    className="btn-danger"
                    style={{ padding: '5px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                  >
                    <Zap size={13} />
                    {isTa ? 'அபாய நடவடிக்கையைத் தூண்டுக (75mm)' : 'Trigger Action (75mm Storm)'}
                  </button>

                  {highlightedIssuesWards.length > 0 && (
                    <button
                      onClick={() => setHighlightedIssuesWards([])}
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                    >
                      Clear Highlights
                    </button>
                  )}
                </div>
              </div>

              <div style={{ height: '480px', width: '100%' }}>
                <WardMap
                  wards={wards}
                  selectedWard={selectedWard}
                  onSelectWard={handleSelectWard}
                  alerts={alerts}
                  highlightedWards={highlightedIssuesWards}
                  language={language}
                />
              </div>

              {/* In-depth Risk Analyzer & Factor Decomposition */}
              <RiskAnalyzerPanel
                selectedWard={selectedWard}
                onSelectWard={handleSelectWard}
                wards={wards}
                currentRain={appliedRain}
                currentApi={appliedApi}
                onApplyRainfall={handleApplyRainfall}
                language={language}
              />
            </div>

            {/* Right Column: Live Operational Status, Alert Queue & Layman SMS Stream */}
            <aside className="ops-sidebar">
              {/* Flagged Regions Quick Summary Card */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                    Active Flood Flags (100 Wards):
                  </span>
                  <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Rain: {appliedRain}mm
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="tier-tag green" style={{ flex: 1, justifyContent: 'center' }}>
                    {tierDistribution.green} Clear
                  </span>
                  <span className="tier-tag yellow" style={{ flex: 1, justifyContent: 'center' }}>
                    {tierDistribution.yellow} Watch
                  </span>
                  <span className="tier-tag orange" style={{ flex: 1, justifyContent: 'center' }}>
                    {tierDistribution.orange} Warn
                  </span>
                  <span className="tier-tag red" style={{ flex: 1, justifyContent: 'center' }}>
                    {tierDistribution.red} Alert
                  </span>
                </div>
              </div>

              {/* Layman Plain-Language SMS Citizen Alerts */}
              <AlertQueue
                alerts={alerts}
                selectedWard={selectedWard}
                onApproveAlert={handleApproveAlert}
                onOpenCap={handleOpenCap}
                onSelectWardById={(wId) => {
                  const found = wards.find(w => w.ward_id === wId);
                  if (found) {
                    setSelectedWard(found);
                  }
                }}
                onClearPastAlerts={handleClearPastAlerts}
                isExpandedView={false}
                language={language}
              />

              {/* Telecom SMS Gateway Stream (Strictly SMS, Zero Emails) */}
              <SmsConsole
                deliveries={deliveries}
                selectedWard={selectedWard}
                onRefreshDeliveries={loadAlertsAndDeliveries}
                isExpandedView={false}
                language={language}
              />
            </aside>
          </div>
        )}

        {/* TAB 2: DEDICATED WARD INUNDATION DISTRIBUTION & WATERLOGGING DEPTH ANALYTICS */}
        {activeTab === 'inundation' && (
          <InundationAnalyticsPage
            language={language}
            selectedWard={selectedWard}
            onSelectWard={handleSelectWard}
            appliedRain={appliedRain}
            appliedApi={appliedApi}
          />
        )}

        {/* TAB 3: OFFICIAL CCMC & TNSDMA ASSESSMENT REPORT GENERATOR */}
        {activeTab === 'report' && (
          <FloodReportPage
            language={language}
            selectedWard={selectedWard}
            appliedRain={appliedRain}
            appliedApi={appliedApi}
          />
        )}

        {/* TAB 4: ALERTS QUEUE & TELECOM SMS CONSOLE (EXPANDED DEDICATED PAGE) */}
        {activeTab === 'alerts' && (
          <div style={{ maxWidth: '1240px', margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
              <AlertQueue
                alerts={alerts}
                selectedWard={selectedWard}
                onApproveAlert={handleApproveAlert}
                onOpenCap={handleOpenCap}
                onSelectWardById={(wId) => {
                  const found = wards.find(w => w.ward_id === wId);
                  if (found) {
                    setSelectedWard(found);
                    setActiveTab('analyzer');
                  }
                }}
                onClearPastAlerts={handleClearPastAlerts}
                isExpandedView={true}
                language={language}
              />
              <SmsConsole
                deliveries={deliveries}
                selectedWard={selectedWard}
                onRefreshDeliveries={loadAlertsAndDeliveries}
                isExpandedView={true}
                language={language}
              />
            </div>
          </div>
        )}

        {/* TAB 5: CITIZEN PORTAL (PUBLIC ADVISORY & PLAIN-LANGUAGE SMS ENROLLMENT) */}
        {activeTab === 'citizen' && (
          <CitizenPortal wards={wards} selectedWard={selectedWard} language={language} />
        )}

        {/* TAB 6: MODEL EVALUATION & DATASET SPLIT (TRAIN VS TEST TOGGLE, ACCURACY, PREDICTIONS) */}
        {activeTab === 'evaluation' && (
          <ModelEvaluationPage language={language} />
        )}
      </main>

      {/* Standard OASIS CAP 1.2 XML/JSON Modal */}
      {capData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={20} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  OASIS CAP v1.2 Standard Alert Payload
                </h3>
              </div>
              <button
                onClick={() => setCapData(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <pre className="mono" style={{ fontSize: '0.78rem', color: '#38bdf8', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(capData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      {/* ACTION AUTHORIZATION & CITIZEN SMS DISPATCH APPROVAL MODAL */}
      {actionApprovalModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', border: '1px solid rgba(239,68,68,0.5)', boxShadow: '0 0 35px rgba(239,68,68,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444' }}>
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                    {isTa ? 'அவசர நடவடிக்கை அங்கீகாரம் & பொதுமக்களுக்கு எஸ்எம்எஸ் ஒப்புதல்' : 'Emergency Action Authorization & Citizen SMS Broadcast Approval'}
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: '#fca5a5' }}>
                    {isTa 
                      ? 'கண்டறியப்பட்ட பாதிப்புகள் வரைபடத்தில் ஒளிர்கின்றன. பொதுமக்களுக்கு குறுஞ்செய்தி அனுப்ப உங்கள் ஒப்புதல் தேவை.'
                      : 'Possible inundation issues detected and highlighted on map. Human authorization required before citizen dispatch.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActionApprovalModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: 'rgba(15,23,42,0.7)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Flagged Issue Wards:</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ef4444' }}>
                    {actionApprovalModal.issueWards.length} Wards
                  </div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.7)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Citizens in Danger Zone:</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>
                    {actionApprovalModal.totalPopulation.toLocaleString()} Residents
                  </div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.7)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Simulation Scenario:</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                    {actionApprovalModal.rain_mm} mm (24h)
                  </div>
                </div>
              </div>

              {/* Breakdown of Affected Wards & Detected Issues */}
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'block' }}>
                  Specific Issues Detected per Ward (Highlighted on Map):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {actionApprovalModal.issueWards.map((w, idx) => {
                    const issues = [];
                    if ((w.hand_m || 3.0) <= 2.2) issues.push(`Depression zone (HAND ${w.hand_m}m <= 2.2m)`);
                    if ((w.rain_24h_mm || 0) >= (w.drainage_capacity_mmhr || 35.0)) issues.push(`Drainage capacity exceeded (${w.rain_24h_mm}mm >= ${w.drainage_capacity_mmhr}mm/hr)`);
                    if ((w.calibrated_probability || 0) >= 0.60) issues.push(`High risk probability (${(w.calibrated_probability * 100).toFixed(0)}%)`);
                    if ((w.twi || 10) >= 13.0) issues.push(`High wetness index (TWI ${w.twi})`);

                    return (
                      <div key={idx} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                            Ward {w.ward_number}: {w.ward_name} ({w.zone_name} Zone)
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: '2px' }}>
                            ⚠️ Issues: {issues.join(' • ') || 'Elevated localized precipitation vulnerability'}
                          </div>
                        </div>
                        <span className={`tier-tag ${w.risk_tier || 'orange'}`} style={{ fontSize: '0.7rem' }}>
                          {w.risk_tier?.toUpperCase() || 'HIGH'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Citizen Warning SMS Payload Preview */}
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: '6px', display: 'block' }}>
                  Layman Citizen SMS Message Content (Ready for Carrier Dispatch):
                </span>
                <div style={{ background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                    <strong style={{ color: '#38bdf8' }}>English:</strong> "EMERGENCY ALERT: Severe waterlogging expected in your ward within 24 hours. Underpasses and low streets will be submerged. Move vehicles and valuables to higher ground. For rescue or help, call 1077 or 112. - Coimbatore Corporation"
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                    <strong style={{ color: '#34d399' }}>தமிழ்:</strong> "அவசர எச்சரிக்கை: உங்கள் வார்டில் அடுத்த 24 மணி நேரத்தில் கடுமையான வெள்ளம் ஏற்படும் அபாயம் உள்ளது. தாழ்வான தெருக்களில் அதிக நீர் தேங்கும். உடைமைகளை மேடான இடத்திற்கு மாற்றவும். அவசர உதவிக்கு 1077 அழைக்கவும். - கோவை மாநகராட்சி"
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                onClick={() => setActionApprovalModal(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                {isTa ? 'நிராகரி / கண்காணிப்பில் வை' : 'Decline / Keep in Monitor Mode'}
              </button>

              <button
                onClick={handleConfirmAndSendWardSms}
                disabled={isBroadcastingSms}
                className="btn-danger"
                style={{ padding: '8px 20px', fontSize: '0.84rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CheckCircle2 size={16} />
                {isBroadcastingSms ? 'Dispatching SMS...' : (isTa ? 'ஒப்புதல் வழங்கி எஸ்எம்எஸ் அனுப்புக' : 'Approve & Dispatch SMS to Ward Citizens')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
