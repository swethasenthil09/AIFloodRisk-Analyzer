import React, { useState, useEffect } from 'react';
import {
  Leaf,
  Cpu,
  Gauge,
  Timer,
  Activity,
  RotateCcw,
  Play,
  Info,
  CheckCircle2,
  Zap,
  Flame,
  ShieldCheck,
  Layers,
  BarChart3,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function GreenComputingDashboard({ language = 'en' }) {
  const isTa = language === 'ta';

  // Backend Stats State
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Interactive Demo State
  const [demoRain, setDemoRain] = useState(65);
  const [demoApi, setDemoApi] = useState(85);
  const [isExecutingDemo, setIsExecutingDemo] = useState(false);
  const [lastDemoResult, setLastDemoResult] = useState(null);

  // Automated Benchmark State
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);

  // Active Tab within Dashboard
  const [activeSection, setActiveSection] = useState('overview'); // 'overview', 'benchmark', 'inventory', 'principles'

  // Fetch Live Statistics from Backend
  const fetchStats = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setIsRefreshing(true);
    try {
      const res = await fetch('/api/green/stats');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching green computing stats:', err);
      setError('Failed to connect to Green Computing metrics endpoint.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats(false);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Reset Statistics and Clear Cache
  const handleReset = async () => {
    if (!window.confirm(isTa ? 'அனைத்து புள்ளிவிவரங்களையும் மீட்டமைக்கவா?' : 'Reset all Green Computing statistics and clear cache?')) {
      return;
    }
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/green/reset', { method: 'POST' });
      if (res.ok) {
        setLastDemoResult(null);
        setBenchmarkResult(null);
        await fetchStats();
      }
    } catch (e) {
      console.error('Reset error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Interactive Prediction Trigger (Simulate request to demonstrate caching)
  const handleExecuteInteractivePrediction = async (customRain = null, customApi = null) => {
    const rainVal = customRain !== null ? customRain : demoRain;
    const apiVal = customApi !== null ? customApi : demoApi;

    setIsExecutingDemo(true);
    try {
      const res = await fetch('/api/inference/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rain_24h_mm: parseFloat(rainVal),
          api_7d_mm: parseFloat(apiVal),
          trigger_alerts: false,
          operator_name: 'Green_Computing_Console'
        })
      });
      const data = await res.json();
      const pred = data?.prediction_results || {};
      const gc = pred.green_computing || {
        cached: false,
        cache_hit: false,
        inferences_executed: 100,
        inferences_avoided: 0
      };

      setLastDemoResult({
        timestamp: new Date().toLocaleTimeString(),
        rain_24h_mm: rainVal,
        api_7d_mm: apiVal,
        green_computing: gc,
        tier_distribution: pred.tier_distribution || {}
      });

      await fetchStats();
    } catch (err) {
      console.error('Demo execution error:', err);
    } finally {
      setIsExecutingDemo(false);
    }
  };

  // Run Controlled 10-Trial Benchmark
  const handleRunBenchmark = async (trialsCount = 10) => {
    setBenchmarkLoading(true);
    try {
      const res = await fetch('/api/green/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iterations: trialsCount,
          rain_24h_mm: parseFloat(demoRain),
          api_7d_mm: parseFloat(demoApi)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkResult(data);
        await fetchStats();
      }
    } catch (e) {
      console.error('Benchmark execution error:', e);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const reqStats = stats?.request_statistics || {
    total_prediction_requests: 0,
    successful_cache_hits: 0,
    cache_misses: 0,
    cache_hit_rate_pct: 0,
    pipeline_runs_executed: 0,
    pipeline_runs_avoided: 0
  };

  const inferStats = stats?.inference_statistics || {
    model_inferences_executed: 0,
    model_inferences_avoided: 0,
    inferences_per_citywide_run: 100
  };

  const perfStats = stats?.performance_comparison || {
    cached_latency: { median_ms: 0, mean_ms: 0, count: 0 },
    uncached_latency: { median_ms: 0, mean_ms: 0, count: 0 },
    measured_latency_reduction_pct: 0,
    efficiency_factor: 1.0
  };

  const uncachedMedian = perfStats.uncached_latency?.median_ms || 0;
  const cachedMedian = perfStats.cached_latency?.median_ms || 0;
  const latencyReduction = perfStats.measured_latency_reduction_pct || 0;

  return (
    <div style={{ maxWidth: '1280px', margin: '20px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
          <AlertCircle size={18} color="#ef4444" />
          <span>{error}</span>
        </div>
      )}

      {loading && !stats && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Connecting to live Green Computing backend telemetry...
        </div>
      )}

      {/* SECTION A: HEADER & GREEN COMPUTING OVERVIEW BANNER */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 50%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '820px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
            }}>
              <Leaf size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {isTa ? 'பசுமை கணினி மற்றும் நிலைத்தன்மை பகுப்பாய்வு தளம்' : 'Green Computing & Sustainable AI Pipeline Dashboard'}
                </h2>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#34d399',
                  fontWeight: 700
                }}>
                  COMPUTATION-AWARE INFERENCE
                </span>
              </div>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.6 }}>
                {isTa
                  ? 'வெள்ள அபாய முன்னறிவிப்பு அமைப்பில் தேவையில்லாத மாதிரி கணக்கீடுகளை (XGBoost 100-வார்டு அனுமானங்கள்) தடுத்து, செல்லுபடியாகும் முந்தைய முடிவுகளை மீட்டெடுப்பதன் மூலம் மென்பொருள் அளவிலான ஆற்றல் செயல்திறனை உருவாக்குகிறது.'
                  : 'Demonstrates algorithmic energy efficiency and resource optimization in the flood risk prediction pipeline. By identifying identical or unchanged hydrological inputs, the system safely reuses valid prediction results, completely eliminating redundant XGBoost decision-tree traversals across all 100 Coimbatore wards.'}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh live metrics from backend"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
              {isRefreshing ? 'Refreshing...' : (isTa ? 'புதுப்பி' : 'Refresh Stats')}
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}
              title="Reset stats for college evaluation demonstration"
            >
              <RotateCcw size={14} />
              {isTa ? 'மீட்டமை' : 'Reset Session'}
            </button>
          </div>
        </div>

        {/* Navigation tabs inside dashboard */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <button
            onClick={() => setActiveSection('overview')}
            className={`nav-pill ${activeSection === 'overview' ? 'active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <Activity size={14} />
            {isTa ? 'நேரடி புள்ளிவிவரங்கள் & ஒப்பீடு' : 'Live Statistics & Latency'}
          </button>
          <button
            onClick={() => setActiveSection('benchmark')}
            className={`nav-pill ${activeSection === 'benchmark' ? 'active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <Play size={14} />
            {isTa ? 'கட்டுப்படுத்தப்பட்ட சோதனை (10-Trials)' : 'Automated 10-Trial Benchmark'}
          </button>
          <button
            onClick={() => setActiveSection('principles')}
            className={`nav-pill ${activeSection === 'principles' ? 'active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <ShieldCheck size={14} />
            {isTa ? 'பசுமை கணினி கோட்பாடுகள் & செல்லுபடியாகும் முறை' : 'Green Principles & Invalidation'}
          </button>
          <button
            onClick={() => setActiveSection('inventory')}
            className={`nav-pill ${activeSection === 'inventory' ? 'active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <Layers size={14} />
            {isTa ? 'நினைவக இருப்பு' : 'Cache Memory Inventory'}
          </button>
        </div>
      </div>

      {/* SECTION B: LIVE EFFICIENCY STATISTICS METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Total Prediction Requests */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isTa ? 'மொத்த முன்னறிவிப்பு கோரிக்கைகள்' : 'Total Prediction Requests'}
            </span>
            <Activity size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)' }}>
            {reqStats.total_prediction_requests}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isTa ? 'செயல்பாட்டு பைப்லைனுக்கு வந்த மொத்த கோரிக்கைகள்' : 'Total eligible inference calls evaluated'}
          </div>
        </div>

        {/* Card 2: Successful Cache Hits */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isTa ? 'வெற்றிகரமான கேச் மறுபயன்பாடுகள்' : 'Successful Cache Hits'}
            </span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
            {reqStats.successful_cache_hits}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isTa ? 'மறு கணக்கீடு தேவையின்றி வழங்கப்பட்டது' : 'Reused valid outputs without re-evaluating'}
          </div>
        </div>

        {/* Card 3: Cache Misses */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isTa ? 'கேச் தவறுகள் (புதிய கணக்கீடு)' : 'Cache Misses (Cold Runs)'}
            </span>
            <Zap size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
            {reqStats.cache_misses}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isTa ? 'புதிய அல்லது மாற்றப்பட்ட உள்ளீடுகள்' : 'Required fresh model tree inference'}
          </div>
        </div>

        {/* Card 4: Cache Hit Rate (%) */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #06b6d4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isTa ? 'கேச் மறுபயன்பாட்டு விகிதம்' : 'Cache Hit Rate'}
            </span>
            <Gauge size={16} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>
            {reqStats.cache_hit_rate_pct}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Formula: Hits / Total Eligible × 100
          </div>
        </div>

        {/* Card 5: Inferences Avoided */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isTa ? 'தவிர்க்கப்பட்ட மாதிரி கணக்கீடுகள்' : 'Inferences Avoided'}
            </span>
            <Cpu size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>
            {inferStats.model_inferences_avoided.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isTa ? '100 வார்டு மாதிரி மர கணக்கீடுகள் தவிர்க்கப்பட்டது' : '100 ward tree evaluations saved per hit'}
          </div>
        </div>

        {/* Card 6: Actual Inferences Executed */}
        <div className="glass-panel" style={{ padding: '18px', borderLeft: '4px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isTa ? 'உண்மையான மாதிரி கணக்கீடுகள்' : 'Actual Inferences Run'}
            </span>
            <Flame size={16} color="#ec4899" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f472b6', fontFamily: 'var(--font-mono)' }}>
            {inferStats.model_inferences_executed.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isTa ? 'செயல்படுத்தப்பட்ட தனித்தனி மாதிரி அனுமானங்கள்' : 'Total individual ward probabilities evaluated'}
          </div>
        </div>

      </div>

      {/* SECTION C & E: PERFORMANCE COMPARISON & INTERACTIVE DEMONSTRATION WORKFLOW */}
      {activeSection === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '22px' }}>
          
          {/* SECTION C: EMPIRICAL LATENCY COMPARISON */}
          <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Timer size={18} color="#06b6d4" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {isTa ? 'கணக்கீட்டு தாமத ஒப்பீடு (அளவிடப்பட்ட நேரம்)' : 'Measured Prediction Latency Comparison'}
                </h3>
              </div>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                time.perf_counter()
              </span>
            </div>

            {/* Comparison Cards Side-by-Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              
              {/* Uncached Cold Path */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: '#fca5a5', fontWeight: 700 }}>
                    {isTa ? 'கேச் இல்லாத முழு கணக்கீடு' : 'Uncached Cold Inference'}
                  </span>
                  <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(239,68,68,0.2)', borderRadius: '4px', color: '#fca5a5' }}>
                    {perfStats.uncached_latency?.count || 0} trials
                  </span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                  {uncachedMedian > 0 ? `${uncachedMedian} ms` : '—'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Median: {uncachedMedian} ms | Mean: {perfStats.uncached_latency?.mean_ms || 0} ms
                </div>
                <div style={{ fontSize: '0.68rem', color: '#fca5a5', marginTop: '4px' }}>
                  Executes DataFrame feature extraction & full XGBoost 100-ward evaluation.
                </div>
              </div>

              {/* Cached Warm Path */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: '#6ee7b7', fontWeight: 700 }}>
                    {isTa ? 'கேச் செய்யப்பட்ட விரைவு அணுகல்' : 'Cached Warm Retrieval'}
                  </span>
                  <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(16,185,129,0.2)', borderRadius: '4px', color: '#6ee7b7' }}>
                    {perfStats.cached_latency?.count || 0} trials
                  </span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                  {cachedMedian > 0 ? `${cachedMedian} ms` : '—'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Median: {cachedMedian} ms | Mean: {perfStats.cached_latency?.mean_ms || 0} ms
                </div>
                <div style={{ fontSize: '0.68rem', color: '#6ee7b7', marginTop: '4px' }}>
                  Bypasses decision trees; directly returns valid memory prediction payload.
                </div>
              </div>

            </div>

            {/* Visual Bar Comparison */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                <span>Execution Time Visual Scale:</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>
                  {latencyReduction > 0 ? `${latencyReduction}% Latency Reduction (${perfStats.efficiency_factor}x Speedup)` : 'Awaiting repeat trials'}
                </span>
              </div>
              
              {/* Uncached bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  <span>Uncached Pipeline (Full Model Run)</span>
                  <span className="mono">{uncachedMedian} ms</span>
                </div>
                <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
                </div>
              </div>

              {/* Cached bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  <span>Computation-Aware Cache Hit</span>
                  <span className="mono">{cachedMedian} ms</span>
                </div>
                <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(2, uncachedMedian > 0 ? (cachedMedian / uncachedMedian) * 100 : 4)}%`,
                    background: '#10b981'
                  }} />
                </div>
              </div>
            </div>

            {/* Measurement Methodology Note */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <Info size={14} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Measurement Methodology:</strong> High-precision monotonic timer (<code className="mono">time.perf_counter</code>) measuring model inference execution, DataFrame preparation, and result assembly within the FastAPI worker process.
              </div>
            </div>

          </div>

          {/* SECTION E: INTERACTIVE DEMONSTRATION SUPPORT CONSOLE */}
          <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={18} color="#10b981" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {isTa ? 'நேரடி மதிப்பீட்டாளர் செயல்விளக்க கன்சோல்' : 'Interactive Demonstration Console'}
                </h3>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                STEP-BY-STEP TEST RUNNER
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {isTa 
                ? 'கல்லூரி மதிப்பீட்டின் போது எளிதாக நிரூபிக்க, கீழே உள்ள 4-படி செயல்முறையைப் பயன்படுத்தவும்:' 
                : 'Follow this 4-step workflow to verify genuine computation-aware caching live during evaluation:'}
            </p>

            {/* Quick Demo Workflow Action Steps */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              {/* Step 1: Submit new inputs */}
              <button
                onClick={() => handleExecuteInteractivePrediction(50.0, 70.0)}
                disabled={isExecutingDemo}
                className="btn-secondary"
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '4px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#fff' }}>
                  <span style={{ background: '#3b82f6', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem' }}>1</span>
                  {isTa ? 'படி 1: புதிய உள்ளீடு (50mm)' : 'Step 1: Fresh Input (50mm)'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  Cold run → Cache Miss → Executes 100 model inferences.
                </div>
              </button>

              {/* Step 2: Repeat identical inputs */}
              <button
                onClick={() => handleExecuteInteractivePrediction(50.0, 70.0)}
                disabled={isExecutingDemo}
                className="btn-secondary"
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '4px', borderColor: 'rgba(16,185,129,0.4)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#34d399' }}>
                  <span style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem' }}>2</span>
                  {isTa ? 'படி 2: அதே உள்ளீடு (50mm)' : 'Step 2: Repeat Same (50mm)'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  Warm run → Cache Hit → Bypasses 100 model inferences.
                </div>
              </button>

              {/* Step 3: Change input */}
              <button
                onClick={() => handleExecuteInteractivePrediction(95.0, 130.0)}
                disabled={isExecutingDemo}
                className="btn-secondary"
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '4px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#fff' }}>
                  <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem' }}>3</span>
                  {isTa ? 'படி 3: புதிய உள்ளீடு (95mm)' : 'Step 3: Change Input (95mm)'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  Changed input → Cache Miss → Fresh 100 inferences.
                </div>
              </button>

              {/* Step 4: Repeat 95mm */}
              <button
                onClick={() => handleExecuteInteractivePrediction(95.0, 130.0)}
                disabled={isExecutingDemo}
                className="btn-secondary"
                style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '4px', borderColor: 'rgba(16,185,129,0.4)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#34d399' }}>
                  <span style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem' }}>4</span>
                  {isTa ? 'படி 4: மீண்டும் 95mm' : 'Step 4: Repeat 95mm'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  Warm run → Cache Hit → Increments hit counter.
                </div>
              </button>

            </div>

            {/* Custom Interactive Sliders */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Custom Rainfall Intensity:
                  </span>
                  <span className="mono" style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>
                    {demoRain} mm (24h)
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={demoRain}
                  onChange={(e) => setDemoRain(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Antecedent Precipitation Index (API):
                  </span>
                  <span className="mono" style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700 }}>
                    {demoApi} mm (7d)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="250"
                  step="5"
                  value={demoApi}
                  onChange={(e) => setDemoApi(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <button
                  onClick={() => handleExecuteInteractivePrediction()}
                  disabled={isExecutingDemo}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Play size={13} />
                  {isExecutingDemo ? 'Executing Pipeline...' : 'Test Selected Inputs'}
                </button>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  Evaluates 100 Coimbatore Wards
                </span>
              </div>
            </div>

            {/* Last Execution Feedback Box */}
            {lastDemoResult && (
              <div style={{
                background: lastDemoResult.green_computing?.cached ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${lastDemoResult.green_computing?.cached ? '#10b981' : '#f59e0b'}`,
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: lastDemoResult.green_computing?.cached ? '#34d399' : '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {lastDemoResult.green_computing?.cached ? <CheckCircle2 size={15} /> : <Zap size={15} />}
                    {lastDemoResult.green_computing?.cached
                      ? (isTa ? 'கேச் மறுபயன்பாடு வெற்றி! (Cache Hit)' : 'Cache Hit! 100 Model Inferences Avoided')
                      : (isTa ? 'கேச் தவறு (Cache Miss - புதிய கணக்கீடு)' : 'Cache Miss: 100 Fresh Ward Inferences Executed')}
                  </span>
                  <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                    {lastDemoResult.timestamp}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
                  <strong>Inputs:</strong> Rain: {lastDemoResult.rain_24h_mm}mm | API: {lastDemoResult.api_7d_mm}mm | 
                  <strong> Result:</strong> {lastDemoResult.green_computing?.cached ? `Reused in ${lastDemoResult.green_computing?.lookup_latency_ms || 0.02}ms` : `Computed in ${lastDemoResult.green_computing?.inference_latency_ms || 18}ms`}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* SECTION: AUTOMATED 10-TRIAL BENCHMARK VIEW */}
      {activeSection === 'benchmark' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {isTa ? 'தானியங்கி கட்டுப்படுத்தப்பட்ட சோதனை ஒப்பீடு' : 'Automated Controlled Experiment Benchmark'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Executes 1 cold baseline trial followed by 10 identical warm trials under identical machine conditions to measure empirical speedup and compute avoidance.
              </p>
            </div>
            <button
              onClick={() => handleRunBenchmark(10)}
              disabled={benchmarkLoading}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={15} />
              {benchmarkLoading ? 'Running Benchmark Trials...' : 'Run 10-Trial Benchmark Now'}
            </button>
          </div>

          {benchmarkResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Summary Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>Uncached Cold Latency (Trial 1):</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                    {benchmarkResult.uncached_baseline.latency_ms} ms
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    100 ward tree evaluations run
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>Median Cached Latency (10 Trials):</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                    {benchmarkResult.cached_reuse.median_latency_ms} ms
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Mean: {benchmarkResult.cached_reuse.mean_latency_ms} ms (10 trials)
                  </div>
                </div>

                <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#67e8f9' }}>Execution-Time Reduction:</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>
                    {benchmarkResult.measured_benefit.execution_time_reduction_pct}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {benchmarkResult.measured_benefit.speedup_factor}
                  </div>
                </div>

                <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#c4b5fd' }}>Avoided CPU Ward Inferences:</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>
                    {benchmarkResult.measured_benefit.avoided_cpu_inferences.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    10 trials × 100 wards avoided
                  </div>
                </div>
              </div>

              {/* Table of Trials */}
              <div style={{ background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '10px', display: 'block' }}>
                  Individual Benchmark Trial Latencies:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', fontSize: '0.74rem', color: '#fca5a5' }}>
                    Cold: {benchmarkResult.uncached_baseline.latency_ms}ms
                  </span>
                  {benchmarkResult.cached_reuse.all_latencies_ms.map((lat, idx) => (
                    <span key={idx} style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', fontSize: '0.74rem', color: '#6ee7b7' }}>
                      Trial #{idx + 1}: {lat}ms
                    </span>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
              <BarChart3 size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700 }}>
                No benchmark run yet for this session
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '6px auto 16px' }}>
                Click "Run 10-Trial Benchmark Now" above to trigger a reproducible series of cold and warm trials on this server.
              </p>
              <button
                onClick={() => handleRunBenchmark(10)}
                disabled={benchmarkLoading}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.8rem' }}
              >
                Launch Automated Benchmark
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION D: GREEN COMPUTING EXPLANATION & PRINCIPLES */}
      {activeSection === 'principles' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              {isTa ? 'மென்பொருள் அளவிலான பசுமை கணினி பொறியியல் கோட்பாடுகள்' : 'Software-Level Green Computing Engineering Principles'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Academic framework connecting computation-aware caching with sustainable computing in AI systems.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            
            {/* Principle 1 */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Cpu size={16} color="#34d399" />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                  1. Avoiding Redundant Decision Tree Inferences
                </h4>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Each full citywide flood evaluation runs 100 rows through an ensemble of calibrated XGBoost decision trees. When weather forecasts have not changed between polling intervals or when operators re-simulate identical storm depths, running matrix operations is completely wasteful. Caching stores the deterministic output of the tree evaluation.
              </p>
            </div>

            {/* Principle 2 */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldCheck size={16} color="#38bdf8" />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                  2. Cache Validation & Freshness Guarantees
                </h4>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Green computing must never compromise disaster warning correctness. The cache key includes:
                (1) model artifact version hash, (2) feature preprocessing schema version, (3) normalized meteorological inputs, and (4) hourly WMO weather observation time-buckets. A new weather observation immediately triggers a fresh model evaluation.
              </p>
            </div>

            {/* Principle 3 */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Flame size={16} color="#f59e0b" />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                  3. Academic Distinction: Time vs Physical Energy
                </h4>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                In academic evaluations, it is critical not to claim that a 95% latency reduction equals a 95% reduction in grid electricity. Execution time and CPU tree traversals are <strong>directly measured</strong> software metrics. Electrical power (Joules) and avoided CO2 emissions are <strong>expected proportional benefits</strong> that depend on CPU power state, thermal limits, and server hardware.
              </p>
            </div>

            {/* Principle 4 */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Layers size={16} color="#a78bfa" />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                  4. Concurrency Safety & Process Scope
                </h4>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                The cache utilizes a thread-safe mutex lock (<code className="mono">threading.Lock</code>) ensuring atomic counter updates and consistent reads across concurrent FastAPI requests. The storage is process-local in-memory with automatic TTL expiration (600s) and capacity limits to prevent server memory exhaustion.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* SECTION: CACHE MEMORY INVENTORY */}
      {activeSection === 'inventory' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {isTa ? 'செயலில் உள்ள கேச் உள்ளீடுகள் மற்றும் நினைவக இருப்பு' : 'Active In-Memory Cache Entries & TTL Inventory'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Inspect live SHA-256 keys, expiration time-to-live (TTL), and cumulative hit counts.
              </p>
            </div>
            <span className="mono" style={{ fontSize: '0.78rem', color: '#10b981' }}>
              Active Entries: {stats?.cache_inventory?.active_cached_entries || 0} / {stats?.cache_inventory?.max_cache_capacity || 256}
            </span>
          </div>

          {stats?.cache_inventory?.recent_entries && stats.cache_inventory.recent_entries.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '10px 12px' }}>Deterministic SHA-256 Key</th>
                    <th style={{ padding: '10px 12px' }}>Reuse Hits</th>
                    <th style={{ padding: '10px 12px' }}>Inferences Saved/Hit</th>
                    <th style={{ padding: '10px 12px' }}>TTL Remaining</th>
                    <th style={{ padding: '10px 12px' }}>Initial Compute Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.cache_inventory.recent_entries.map((entry, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#fff' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {entry.key_prefix}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#34d399' }}>
                        {entry.hits} hits
                      </td>
                      <td style={{ padding: '10px 12px', color: '#a78bfa' }}>
                        {entry.inferences_per_hit} wards
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {entry.ttl_remaining_s}s remaining
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                        {entry.original_calc_time_ms} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              Cache is currently empty. Run an interactive prediction or benchmark above to populate cache entries.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
