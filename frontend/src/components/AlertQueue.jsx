import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Send,
  FileCode,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Eye
} from 'lucide-react';

export default function AlertQueue({
  alerts,
  selectedWard,
  onApproveAlert,
  onOpenCap,
  onSelectWardById,
  onClearPastAlerts,
  isExpandedView = false,
  language
}) {
  const [filterTier, setFilterTier] = useState('all');
  const [approvingId, setApprovingId] = useState(null);

  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const filtered = safeAlerts.filter(a => {
    if (!a) return false;
    if (filterTier === 'clicked' && selectedWard) return a.ward_id === selectedWard.ward_id;
    if (filterTier === 'all') return true;
    if (filterTier === 'pending') return a.status === 'pending_approval';
    return a.tier?.toLowerCase() === filterTier;
  });

  const handleApprove = async (alertId) => {
    setApprovingId(alertId);
    try {
      await onApproveAlert(alertId);
    } finally {
      setApprovingId(null);
    }
  };

  const isTa = language === 'ta';

  return (
    <div className="glass-panel" style={{ padding: isExpandedView ? '24px' : '18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: isExpandedView ? '1.15rem' : '0.98rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <ShieldAlert size={18} color="var(--tier-orange)" />
            {isTa ? 'அவசர எச்சரிக்கை வரிசை (SMS மட்டும்)' : 'Citizen Emergency Alerts (To Send / Active)'}
          </h3>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Plain-language warnings broadcast to opted-in residents per ward (Zero emails)
          </p>
        </div>

        {/* Sync & Filter Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {onClearPastAlerts && (
            <button
              onClick={onClearPastAlerts}
              title="Clear old simulation alerts and sync with current conditions"
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={11} /> Sync Live
            </button>
          )}

          {selectedWard && (
            <button
              onClick={() => setFilterTier(filterTier === 'clicked' ? 'all' : 'clicked')}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                border: filterTier === 'clicked' ? '1px solid #38bdf8' : '1px solid rgba(56,189,248,0.3)',
                background: filterTier === 'clicked' ? '#0284c7' : 'rgba(56,189,248,0.12)',
                color: filterTier === 'clicked' ? '#fff' : '#38bdf8',
                cursor: 'pointer',
                fontWeight: 700
              }}
              title={`Filter alerts specifically for Ward ${selectedWard.ward_number}`}
            >
              📍 Ward {selectedWard.ward_number}
            </button>
          )}

          {['all', 'pending', 'red', 'orange', 'yellow'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterTier(t)}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                border: '1px solid var(--border-color)',
                background: filterTier === t ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                color: filterTier === t ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: filterTier === t ? 700 : 400
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List Container (Larger and spacious) */}
      <div style={{
        flex: 1,
        minHeight: isExpandedView ? '560px' : '380px',
        maxHeight: isExpandedView ? '720px' : '440px',
        overflowY: 'auto',
        paddingRight: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            <CheckCircle2 size={32} color="var(--tier-green)" style={{ margin: '0 auto 8px auto', opacity: 0.7 }} />
            <div>No active flood alerts for this filter.</div>
            <div style={{ fontSize: '0.74rem', marginTop: '4px' }}>
              All 100 wards are currently safe under current rainfall conditions.
            </div>
          </div>
        ) : (
          filtered.map((alt) => {
            const isRed = alt.tier === 'red';
            const isGreen = alt.tier === 'green';
            const isPending = alt.status === 'pending_approval';
            const isSelectedWard = selectedWard && selectedWard.ward_id === alt.ward_id;

            return (
              <div
                key={alt.alert_id}
                className={`alert-item ${isGreen ? 'green-border' : (isRed ? 'red-border' : 'orange-border')}`}
                style={{
                  background: isSelectedWard
                    ? 'rgba(14,165,233,0.14)'
                    : (isGreen ? 'rgba(34,197,94,0.06)' : (isRed ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.07)')),
                  border: isSelectedWard
                    ? '1.5px solid #38bdf8'
                    : (isGreen ? '1px solid rgba(34,197,94,0.35)' : (isRed ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(249,115,22,0.35)')),
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Alert Top Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className={`tier-tag ${alt.tier}`}
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        background: isGreen ? 'rgba(34,197,94,0.18)' : undefined,
                        color: isGreen ? '#4ade80' : undefined,
                        border: isGreen ? '1px solid rgba(34,197,94,0.4)' : undefined
                      }}
                    >
                      {alt.tier === 'red' && '🚨 '}
                      {alt.tier === 'orange' && '⚠️ '}
                      {alt.tier === 'yellow' && '🚩 '}
                      {alt.tier === 'green' && '✅ '}
                      {isGreen ? 'ALL CLEAR' : `${(alt.tier || 'yellow').toUpperCase()} ALERT`}
                    </span>
                    {isSelectedWard && (
                      <span style={{ fontSize: '0.64rem', background: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        CLICKED REGION
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {alt.ward_id}
                    </span>
                  </div>

                  {isPending ? (
                    <span style={{ fontSize: '0.74rem', color: 'var(--tier-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} />
                      Awaiting Human Approval
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.74rem', color: 'var(--tier-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} />
                      Dispatched
                    </span>
                  )}
                </div>

                {/* Headline */}
                <div style={{ fontSize: isExpandedView ? '0.96rem' : '0.88rem', fontWeight: 700, color: '#fff' }}>
                  {isTa ? alt.headline_ta : alt.headline_en}
                </div>

                {/* Plain Layman Body */}
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.5', background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '6px' }}>
                  {isTa ? alt.description_ta : alt.description_en}
                </div>

                {/* Footer with Probability, Map Focus, and Approval Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                    Risk: <strong style={{ color: '#fff' }}>{(alt.calibrated_prob * 100).toFixed(1)}%</strong> &bull; {alt.issued_at?.slice(11, 16)} UTC
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {onSelectWardById && (
                      <button
                        onClick={() => onSelectWardById(alt.ward_id)}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} color="var(--accent-cyan)" /> Focus on Map
                      </button>
                    )}

                    <button
                      onClick={() => onOpenCap(alt.alert_id)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FileCode size={12} /> CAP 1.2
                    </button>

                    {isPending && (
                      <button
                        onClick={() => handleApprove(alt.alert_id)}
                        disabled={approvingId === alt.alert_id}
                        className="btn-danger"
                        style={{ padding: '5px 12px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Send size={13} />
                        {approvingId === alt.alert_id ? 'Dispatching...' : 'Authorize & Broadcast SMS'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
