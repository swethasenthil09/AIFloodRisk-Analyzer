
import React, { useState, useEffect } from 'react';
import { PhoneCall, ShieldCheck, BellRing, MapPin, Send, AlertTriangle } from 'lucide-react';

export default function CitizenPortal({ wards = [], selectedWard, language }) {
  const safeWards = Array.isArray(wards) ? wards : [];
  const [selectedWardId, setSelectedWardId] = useState(selectedWard?.ward_id || safeWards[22]?.ward_id || 'WARD_023');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [subLang, setSubLang] = useState(language);
  const [minTier, setMinTier] = useState('orange');
  const [subMsg, setSubMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedWard && selectedWard.ward_id) {
      setSelectedWardId(selectedWard.ward_id);
    }
  }, [selectedWard]);

  const currentWard = safeWards.find(w => w.ward_id === selectedWardId) || safeWards[0];

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setSubmitting(true);
    setSubMsg('');
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          ward_id: selectedWardId,
          language_pref: subLang,
          alert_min_tier: minTier
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSubMsg(data.message || 'Successfully enrolled in flood warning SMS!');
        setPhoneNumber('');
      } else {
        setSubMsg(`Error: ${data.detail || 'Could not register subscription'}`);
      }
    } catch (err) {
      setSubMsg('Network error registering subscription.');
    } finally {
      setSubmitting(false);
    }
  };

  const isTa = language === 'ta';

  return (
    <div className="citizen-container">
      {/* Hero Header */}
      <div className="hero-banner">
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
          {isTa ? 'கோயம்புத்தூர் உள்ளூர் வெள்ள அபாய ஆலோசனை' : 'Coimbatore Ward-Level Flood Advisory Portal'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '620px', margin: '0 auto' }}>
          {isTa
            ? 'உங்கள் வார்டின் தற்போதைய வெள்ள அபாயத்தை சரிபார்த்து, அவசர கால எஸ்எம்எஸ் எச்சரிக்கைகளைப் பெறுங்கள்.'
            : 'Check calibrated 24-hour flood likelihood for your ward and enroll in targeted official SMS notifications.'}
        </p>

        {/* Ward Selector Dropdown */}
        <div className="search-box">
          <select
            className="select-ward-dropdown"
            value={selectedWardId}
            onChange={(e) => setSelectedWardId(e.target.value)}
          >
            {safeWards.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                Ward {w.ward_number}: {w.ward_name} ({w.zone_name} Zone)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ward Status Banner */}
      {currentWard && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isTa ? 'தேர்ந்தெடுக்கப்பட்ட வார்டு' : 'Selected Location'}
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
                Ward {currentWard.ward_number} - {currentWard.ward_name} ({currentWard.zone_name} Zone)
              </h3>
            </div>
            <span className={`tier-tag ${currentWard.risk_tier}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
              {currentWard.risk_tier} {isTa ? 'அபாயம்' : 'Risk'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            <div className="stat-pill">
              <span className="stat-label">{isTa ? '24 மணி நேர வெள்ள நிகழ்தகவு' : '24h Flood Probability'}</span>
              <span className="stat-value" style={{ color: currentWard.risk_tier === 'red' ? 'var(--tier-red)' : (currentWard.risk_tier === 'orange' ? 'var(--tier-orange)' : 'var(--tier-green)') }}>
                {(currentWard.calibrated_probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">{isTa ? 'எதிர்பார்க்கப்படும் மழை' : 'Forecast Rain (24h)'}</span>
              <span className="stat-value">{currentWard.rain_24h_mm} mm</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">{isTa ? 'வடிகால் மேட்டுயரம் (HAND)' : 'Drainage Elevation (HAND)'}</span>
              <span className="stat-value">{currentWard.hand_m} m</span>
            </div>
          </div>

          {/* Actionable Safety Advisory */}
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--tier-green)" />
              {isTa ? 'பாதுகாப்பு வழிகாட்டுதல்:' : 'Citizen Safety Guidelines:'}
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              {currentWard.risk_tier === 'red'
                ? (isTa ? 'தீவிர வெள்ள அபாயம். சுரங்கப்பாதைகள் மற்றும் நீர்நிலைகளின் ஓரங்களை தவிர்க்கவும். உடைமைகளை பாதுகாப்பான இடத்திற்கு மாற்றவும்.' : 'Extreme flood risk. Avoid railway underpasses (Lanka Corner/Kikani) and canal banks. Move valuable assets to higher ground.')
                : (currentWard.risk_tier === 'orange'
                  ? (isTa ? 'கனமழை காரணமாக சாலைகளில் நீர் தேங்க வாய்ப்புள்ளது. அவசியமின்றி வெளியே செல்வதை தவிர்க்கவும்.' : 'High waterlogging likely on arterial roads. Avoid low-lying bypass corridors during heavy downpours.')
                  : (isTa ? 'தற்போது உங்கள் பகுதியில் வெள்ள அபாயம் சாதாரணமாக உள்ளது. வானிலை தகவல்களை கவனிக்கவும்.' : 'Normal status. Municipal storm drains are flowing smoothly. Safe for routine travel.'))}
            </p>
          </div>
        </div>
      )}

      {/* Citizen Opt-In SMS Subscription Card */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BellRing size={20} color="var(--accent-blue)" />
          {isTa ? 'இலவச எஸ்எம்எஸ் எச்சரிக்கை பதிவு (DPDP சட்டம் 2023)' : 'Enroll for Ward Emergency SMS Warnings'}
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {isTa
            ? 'அவசரகால வெள்ள முன்னறிவிப்புகளை உங்கள் மொபைலில் உடனுக்குடன் பெறுங்கள். நீங்கள் விரும்பும் போது விலகிக் கொள்ளலாம்.'
            : 'Opt-in for localized SMS alerts broadcast to residents when flood risk in this ward crosses Watch/Warning levels.'}
        </p>

        <form onSubmit={handleSubscribe} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              {isTa ? 'மொபைல் எண்' : 'Mobile Number (+91)'}
            </label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '0.88rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              {isTa ? 'மொழி விருப்பம்' : 'SMS Language'}
            </label>
            <select
              value={subLang}
              onChange={(e) => setSubLang(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '0.88rem'
              }}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ height: '42px', width: '100%' }}
            >
              <Send size={15} />
              {submitting ? '...' : (isTa ? 'பதிவு செய்' : 'Enroll')}
            </button>
          </div>
        </form>

        {subMsg && (
          <div style={{ marginTop: '14px', padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd', fontSize: '0.84rem' }}>
            {subMsg}
          </div>
        )}
      </div>

      {/* Emergency Helpline Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        <div className="stat-pill" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tier-red)' }}>
            <PhoneCall size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>District Disaster Center</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>1077</div>
          </div>
        </div>

        <div className="stat-pill" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
            <PhoneCall size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>National Emergency Helpline</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>112</div>
          </div>
        </div>

        <div className="stat-pill" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tier-green)' }}>
            <PhoneCall size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CCMC Corporation Flood Cell</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>1913</div>
          </div>
        </div>
      </div>
    </div>
  );
}
