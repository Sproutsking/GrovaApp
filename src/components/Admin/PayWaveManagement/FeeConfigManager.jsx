// src/components/Admin/PayWaveManagement/FeeConfigManager.jsx
// CEO/Super Admin only - Manage PayWave transaction fees
import React, { useState, useEffect, useCallback } from "react";
import { Settings, Save, AlertCircle, Plus, Trash2, Eye } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import { useAuth } from "../../Auth/AuthContext";

const FeeConfigManager = () => {
  const { profile } = useAuth();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showAudit, setShowAudit] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  // Check authorization
  const isAuthorized = profile && ['ceo_owner', 'super_admin'].includes(profile?.admin_role);

  if (!isAuthorized) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#f87171' }}>
        <AlertCircle size={28} style={{ margin: '0 auto 12px' }} />
        <p>Access denied. CEO or Super Admin access required.</p>
      </div>
    );
  }

  const fetchFees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('paywave_fee_config')
        .select('*')
        .order('transaction_type', { ascending: true });
      
      if (err) throw err;
      setFees(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load fee configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('paywave_admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (err) throw err;
      setAuditLog(data || []);
    } catch (e) {
      console.error('Failed to load audit log:', e);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const handleEdit = (fee) => {
    setEditing(fee.id);
    setEditValues({ ...fee });
  };

  const handleSave = async (feeId) => {
    if (!editValues.fee_percentage || Number(editValues.fee_percentage) < 0) {
      setError('Invalid fee percentage');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: err } = await supabase.rpc('update_paywave_fee_config', {
        p_admin_id: profile.id,
        p_transaction_type: editValues.transaction_type,
        p_new_fee_percentage: Number(editValues.fee_percentage),
        p_reason: editValues.reason || null,
      });

      if (err) throw err;

      setSuccess(`✓ Fee updated for ${editValues.transaction_type}`);
      setEditing(null);
      fetchFees();
      fetchAuditLog();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e.message || 'Failed to update fee');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setEditValues({});
  };

  return (
    <div style={{ padding: '24px', background: '#05070a', minHeight: '100vh' }}>
      <style>{`
        .fcc-container {
          max-width: 900px;
          margin: 0 auto;
        }
        .fcc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .fcc-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }
        .fcc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .fcc-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
        }
        .fcc-card:hover {
          background: rgba(255,255,255,0.035);
          border-color: rgba(163,230,53,0.2);
        }
        .fcc-card-label {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .fcc-card-type {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 12px;
          text-transform: capitalize;
        }
        .fcc-input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(163,230,53,0.3);
          border-radius: 6px;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .fcc-input:focus {
          outline: none;
          background: rgba(255,255,255,0.08);
          border-color: #a3e635;
        }
        .fcc-actions {
          display: flex;
          gap: 8px;
        }
        .fcc-btn {
          flex: 1;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .fcc-btn-primary {
          background: #a3e635;
          color: #060e02;
        }
        .fcc-btn-primary:hover {
          background: #84cc16;
          transform: translateY(-1px);
        }
        .fcc-btn-secondary {
          background: rgba(255,255,255,0.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .fcc-btn-secondary:hover {
          background: rgba(255,255,255,0.12);
        }
        .fcc-alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
        }
        .fcc-alert-error {
          background: rgba(244,63,94,0.1);
          border: 1px solid rgba(244,63,94,0.3);
          color: #ff6b7a;
        }
        .fcc-alert-success {
          background: rgba(163,230,53,0.1);
          border: 1px solid rgba(163,230,53,0.3);
          color: #a3e635;
        }
        .fcc-audit {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 16px;
          margin-top: 24px;
        }
        .fcc-audit-entry {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 12px;
          color: rgba(255,255,255,0.7);
        }
        .fcc-audit-entry:last-child {
          border-bottom: none;
        }
      `}</style>

      <div className="fcc-container">
        {/* Header */}
        <div className="fcc-header">
          <div className="fcc-title">
            <Settings size={24} color="#a3e635" />
            PayWave Transaction Fees
          </div>
          <button
            className="fcc-btn fcc-btn-secondary"
            onClick={() => {
              setShowAudit(!showAudit);
              if (!showAudit) fetchAuditLog();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Eye size={14} />
            {showAudit ? 'Hide' : 'View'} Audit Log
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="fcc-alert fcc-alert-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {success && (
          <div className="fcc-alert fcc-alert-success">
            {success}
          </div>
        )}

        {/* Fee Cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
            Loading fee configuration...
          </div>
        ) : (
          <>
            <div className="fcc-grid">
              {fees.map((fee) => (
                <div key={fee.id} className="fcc-card">
                  <div className="fcc-card-label">Transaction Type</div>
                  <div className="fcc-card-type">{fee.transaction_type}</div>

                  {editing === fee.id ? (
                    <>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="fcc-input"
                        value={editValues.fee_percentage}
                        onChange={(e) =>
                          setEditValues({ ...editValues, fee_percentage: e.target.value })
                        }
                        placeholder="Fee %"
                      />
                      <input
                        type="text"
                        className="fcc-input"
                        value={editValues.reason || ''}
                        onChange={(e) =>
                          setEditValues({ ...editValues, reason: e.target.value })
                        }
                        placeholder="Change reason (optional)"
                      />
                      <div className="fcc-actions">
                        <button
                          className="fcc-btn fcc-btn-primary"
                          onClick={() => handleSave(fee.id)}
                          disabled={loading}
                        >
                          <Save size={12} /> Save
                        </button>
                        <button
                          className="fcc-btn fcc-btn-secondary"
                          onClick={handleCancel}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        color: '#a3e635',
                        marginBottom: '12px',
                        fontFamily: 'DM Mono, monospace',
                      }}>
                        {fee.fee_percentage}%
                      </div>
                      {fee.description && (
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '12px',
                        }}>
                          {fee.description}
                        </div>
                      )}
                      <div className="fcc-actions">
                        <button
                          className="fcc-btn fcc-btn-primary"
                          onClick={() => handleEdit(fee)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Audit Log */}
            {showAudit && (
              <div className="fcc-audit">
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 16,
                }}>
                  Admin Audit Log
                </div>
                {auditLog.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>
                    No audit log entries
                  </div>
                ) : (
                  auditLog.map((entry) => (
                    <div key={entry.id} className="fcc-audit-entry">
                      <div style={{ color: '#a3e635', marginBottom: 4 }}>
                        {new Date(entry.created_at).toLocaleString('en-NG')}
                      </div>
                      <div>{entry.action}: {entry.target_type}</div>
                      {entry.reason && <div style={{ color: 'rgba(255,255,255,0.4)' }}>Reason: {entry.reason}</div>}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FeeConfigManager;
