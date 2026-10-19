import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCheck,
  Radio,
  Send,
  Phone,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Zap,
  TowerControl
} from 'lucide-react';

export default function SmsConsole({
  deliveries = [],
  selectedWard,
  onRefreshDeliveries,
  isExpandedView = false,
  language
}) {
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const [testPhone, setTestPhone] = useState('+91 6381649722');
  const [testTier, setTestTier] = useState('red');
  const [testLang, setTestLang] = useState('en');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState(null);
  const [testErrorMsg, setTestErrorMsg] = useState(null);
  const [clearing, setClearing] = useState(false);

  // Handle Clearing Sent SMS Messages
  const handleClearDeliveries = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/alerts/clear-sms-deliveries', { method: 'POST' });
      if (res.ok) {
        if (onRefreshDeliveries) onRefreshDeliveries();
      }
    } catch (err) {
      console.error('Error clearing SMS deliveries:', err);
    } finally {
      setClearing(false);
    }
  };

  // Handle Direct SMS Dispatch (Telecom Carrier Simulation)
  const handleSendTestSms = async (e) => {
    e.preventDefault();
    if (!testPhone || testPhone.trim().length < 8) return;

    setSendingTest(true);
    setTestSuccessMsg(null);
    setTestErrorMsg(null);
    try {
      const targetWardNum = selectedWard ? selectedWard.ward_number : 53;
      const targetWardName = selectedWard ? selectedWard.ward_name : 'Railway Station Zone (Lanka Corner)';
      const targetTier = selectedWard?.risk_tier || testTier;

      const payload = {
        phone_number: testPhone.trim(),
        tier: targetTier,
        ward_number: targetWardNum,
        ward_name: targetWardName,
        language: testLang,
        gateway_provider: 'simulator'
      };

      const res = await fetch('/api/alerts/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setTestSuccessMsg(`Dispatched to ${testPhone}! Carrier ACK: ${data.carrier_ack} (${data.gateway_feedback || '200 OK'})`);
        if (onRefreshDeliveries) onRefreshDeliveries();
      } else {
        setTestErrorMsg(`Dispatch Failed: ${data.gateway_feedback || 'Gateway error'}`);
      }
    } catch (err) {
      console.error('Error dispatching SMS:', err);
      setTestErrorMsg('Network failure during SMS dispatch.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: isExpandedView ? '24px' : '18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: isExpandedView ? '1.15rem' : '0.98rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <Radio size={18} color="var(--accent-cyan)" />
            Real-Time SMS Early Warning Console
          </h3>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TowerControl size={12} color="#38bdf8" />
            Telecom Carrier Gateway: <strong style={{ color: '#38bdf8' }}>Airtel & Jio DLT Networks</strong> &bull; Strictly SMS Only (Zero emails)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            borderRadius: '12px',
            background: 'rgba(56,189,248,0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.3)',
            fontWeight: 700
          }}>
            {safeDeliveries.length} SMS Delivered
          </span>

          {safeDeliveries.length > 0 && (
            <button
              onClick={handleClearDeliveries}
              disabled={clearing}
              className="btn-secondary"
              style={{
                padding: '3px 10px',
                fontSize: '0.72rem',
                color: '#f87171',
                borderColor: 'rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Clear all sent SMS logs from database"
            >
              <Trash2 size={12} />
              {clearing ? 'Clearing...' : 'Clear Sent SMS'}
            </button>
          )}
        </div>
      </div>

      {/* Clicked Ward SMS Dispatch Targeting Banner */}
      {selectedWard && (
        <div style={{
          background: 'rgba(14,165,233,0.08)',
          border: '1px solid rgba(56,189,248,0.3)',
          borderRadius: '8px',
          padding: '9px 12px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.68rem', background: '#0284c7', color: '#fff', padding: '2px 7px', borderRadius: '4px', fontWeight: 800 }}>
              MAPPED TARGET AREA
            </span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
              Ward {selectedWard.ward_number}: {selectedWard.ward_name} ({selectedWard.zone_name})
            </span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            Probability: <strong style={{ color: '#fff' }}>{(selectedWard.calibrated_probability * 100).toFixed(1)}%</strong> &bull; Tier: <span className={`tier-tag ${selectedWard.risk_tier || 'green'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{(selectedWard.risk_tier || 'clear').toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Direct SMS Dispatch Form */}
      <form onSubmit={handleSendTestSms} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Send size={13} color="var(--tier-orange)" />
            Dispatch Layman Emergency SMS Alert:
          </div>
          <span style={{
            fontSize: '0.68rem',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'rgba(56,189,248,0.15)',
            color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.3)',
            fontWeight: 700
          }}>
            ● CARRIER SIMULATOR READY (TRAI DLT)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>
              Mobile Number:
            </label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+91 98XXXXXXXX"
              style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>
              Alert Tier:
            </label>
            <select
              value={testTier}
              onChange={(e) => setTestTier(e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem' }}
            >
              <option value="red">RED (Emergency Flood)</option>
              <option value="orange">ORANGE (Road Warning)</option>
              <option value="yellow">YELLOW (Rain Advisory)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>
              Language:
            </label>
            <select
              value={testLang}
              onChange={(e) => setTestLang(e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem' }}
            >
              <option value="en">English (Plain Words)</option>
              <option value="ta">தமிழ் (எளிய நடை)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={sendingTest}
            className="btn-primary"
            style={{ padding: '7px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Send size={13} />
            {sendingTest ? 'Sending...' : 'Send SMS'}
          </button>
        </div>

        {testSuccessMsg && (
          <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--tier-green)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} /> {testSuccessMsg}
          </div>
        )}
        {testErrorMsg && (
          <div style={{ marginTop: '8px', fontSize: '0.74rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} /> {testErrorMsg}
          </div>
        )}
      </form>

      {/* Dispatched Messages Feed */}
      <div style={{
        flex: 1,
        minHeight: isExpandedView ? '480px' : '260px',
        maxHeight: isExpandedView ? '640px' : '360px',
        overflowY: 'auto',
        paddingRight: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {safeDeliveries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            <Radio size={28} color="var(--text-dim)" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <div>No SMS messages in queue.</div>
            <div style={{ fontSize: '0.74rem', marginTop: '4px' }}>
              Enter any mobile number above and click <strong>Send SMS</strong> to test carrier dispatch!
            </div>
          </div>
        ) : (
          safeDeliveries.map((del) => (
            <div
              key={del.delivery_id}
              className="sms-log-item"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} color="var(--accent-blue)" />
                  <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                    {del.phone_or_token}
                  </span>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: del.dispatch_status === 'failed' ? '#f87171' : 'var(--tier-green)', fontSize: '0.72rem', fontWeight: 700 }}>
                  <CheckCheck size={14} />
                  {(del.dispatch_status || 'sent').toUpperCase()} {del.dispatch_status === 'failed' ? '(ERROR)' : '(200 OK)'}
                </span>
              </div>

              {/* Layman understandable SMS text */}
              <div style={{ fontSize: '0.8rem', color: '#e2e8f0', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid var(--accent-cyan)' }}>
                {del.payload_text}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', paddingTop: '4px' }}>
                <span className="mono" style={{ color: '#38bdf8' }}>
                  Carrier ACK: {del.gateway_message_id}
                </span>
                <span>
                  Dispatched: {del.dispatched_at?.slice(0, 19).replace('T', ' ')} UTC
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
