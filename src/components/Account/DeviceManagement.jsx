// src/components/Account/DeviceManagement.jsx - UPDATED WITH REAL DATA
import React, { useState, useEffect } from 'react';
import { Loader, X } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import ConfirmModal from '../Modals/ConfirmModal';
import StatusModal from '../Modals/StatusModal';

const DeviceManagement = ({ userId, onClose, onDeviceRemoved }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingDevice, setRemovingDevice] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, device: null });
  const [statusModal, setStatusModal] = useState({ show: false, type: 'success', message: '' });

  useEffect(() => {
    loadDevices();
  }, [userId]);

  const loadDevices = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', userId)
        .eq('is_trusted', true)
        .order('last_seen', { ascending: false });

      if (error) throw error;

      setDevices(data || []);

    } catch (error) {
      console.error('Failed to load devices:', error);
      showStatus('error', 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type, message) => {
    setStatusModal({ show: true, type, message });
  };

  const hideStatus = () => {
    setStatusModal({ show: false, type: 'success', message: '' });
  };

  const handleRemoveDevice = (device) => {
    setConfirmModal({ show: true, device });
  };

  const confirmRemoveDevice = async () => {
    const device = confirmModal.device;
    if (!device) return;

    try {
      setRemovingDevice(device.id);
      setConfirmModal({ show: false, device: null });

      const { error } = await supabase
        .from('device_fingerprints')
        .update({ 
          is_trusted: false,
          revoked_at: new Date().toISOString()
        })
        .eq('id', device.id);

      if (error) throw error;

      // Log security event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'device_untrusted',
        severity: 'info',
        metadata: { 
          device_id: device.id,
          device_name: device.device_name || 'Unknown device',
          browser: device.browser,
          os: device.os
        }
      });

      setDevices(prev => prev.filter(d => d.id !== device.id));
      showStatus('success', 'Device removed successfully');
      
      if (onDeviceRemoved) {
        onDeviceRemoved();
      }

    } catch (error) {
      console.error('Failed to remove device:', error);
      showStatus('error', 'Failed to remove device');
    } finally {
      setRemovingDevice(null);
    }
  };

  const getDeviceIcon = (os) => {
    if (!os) return '🖥️';
    const osLower = os.toLowerCase();
    if (osLower.includes('windows')) return '💻';
    if (osLower.includes('mac')) return '🖥️';
    if (osLower.includes('iphone') || osLower.includes('ios')) return '📱';
    if (osLower.includes('android')) return '📱';
    if (osLower.includes('linux')) return '🐧';
    return '🖥️';
  };

  const getBrowserIcon = (browser) => {
    if (!browser) return '🌐';
    const browserLower = browser.toLowerCase();
    if (browserLower.includes('chrome')) return '🌐';
    if (browserLower.includes('firefox')) return '🦊';
    if (browserLower.includes('safari')) return '🧭';
    if (browserLower.includes('edge')) return '🔷';
    return '🌐';
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getDeviceName = (device) => {
    if (device.device_name) return device.device_name;
    const browser = device.browser || 'Unknown Browser';
    const os = device.os || 'Unknown OS';
    return `${browser} on ${os}`;
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          alignItems: center;
          justifyContent: center;
          zIndex: 9999;
          padding: 20px;
        }
        .modal-content {
          background: #1a1a1a;
          borderRadius: 16px;
          width: 100%;
          maxWidth: 700px;
          maxHeight: 90vh;
          overflow: hidden;
          display: flex;
          flexDirection: column;
          border: 1px solid rgba(132, 204, 22, 0.3);
        }
        .modal-header {
          padding: 24px;
          borderBottom: 1px solid rgba(132, 204, 22, 0.2);
          display: flex;
          alignItems: center;
          justifyContent: space-between;
        }
        .modal-body {
          padding: 24px;
          overflowY: auto;
          flex: 1;
        }
        .device-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          borderRadius: 12px;
          padding: 20px;
          display: flex;
          alignItems: center;
          gap: 16px;
          marginBottom: 16px;
          transition: all 0.3s;
        }
        .device-card:hover {
          borderColor: rgba(132, 204, 22, 0.4);
          background: rgba(255, 255, 255, 0.05);
        }
        .remove-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 8px 16px;
          borderRadius: 8px;
          cursor: pointer;
          fontSize: 14px;
          fontWeight: 600;
          transition: all 0.3s;
        }
        .remove-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          borderColor: #ef4444;
        }
        .remove-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', margin: 0 }}>
              📱 Manage Trusted Devices
            </h2>
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              color: '#a3a3a3',
              fontSize: '32px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1
            }}>×</button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader size={40} style={{ 
                  animation: 'spin 1s linear infinite',
                  color: '#84cc16',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: '#a3a3a3' }}>Loading devices...</p>
              </div>
            ) : devices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>📱</div>
                <h3 style={{ color: '#fff', marginBottom: '8px', fontSize: '20px' }}>No Trusted Devices</h3>
                <p style={{ color: '#a3a3a3', fontSize: '14px' }}>
                  You haven't trusted any devices yet. Devices you trust won't require additional verification when you sign in.
                </p>
              </div>
            ) : (
              <>
                <p style={{ marginBottom: '20px', color: '#a3a3a3', fontSize: '14px', lineHeight: '1.6' }}>
                  These devices are trusted and won't require additional verification when signing in. Remove any devices you don't recognize or no longer use.
                </p>
                {devices.map(device => (
                  <div key={device.id} className="device-card">
                    <div style={{ position: 'relative' }}>
                      <span style={{ fontSize: '32px' }}>{getDeviceIcon(device.os)}</span>
                      <span style={{
                        fontSize: '18px',
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px'
                      }}>
                        {getBrowserIcon(device.browser)}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 8px 0' }}>
                        {getDeviceName(device)}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#737373' }}>
                        <span>📍 {device.ip_address || device.location_city || 'Unknown location'}</span>
                        <span>•</span>
                        <span>🕐 {formatLastSeen(device.last_seen)}</span>
                        {device.location_country && (
                          <>
                            <span>•</span>
                            <span>🌍 {device.location_country}</span>
                          </>
                        )}
                      </div>
                      {device.first_seen && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          Trusted since {new Date(device.first_seen).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      disabled={removingDevice === device.id}
                      onClick={() => handleRemoveDevice(device)}
                      className="remove-btn"
                    >
                      {removingDevice === device.id ? (
                        <>
                          <Loader size={14} style={{ 
                            animation: 'spin 1s linear infinite',
                            display: 'inline',
                            marginRight: '6px',
                            verticalAlign: 'middle'
                          }} />
                          Removing...
                        </>
                      ) : (
                        <>🗑️ Remove</>
                      )}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        show={confirmModal.show}
        title="Remove Trusted Device"
        message={`Are you sure you want to remove "${confirmModal.device ? getDeviceName(confirmModal.device) : ''}"? You will need to verify your identity the next time you sign in from this device.`}
        confirmText="Remove Device"
        dangerous={true}
        onConfirm={confirmRemoveDevice}
        onCancel={() => setConfirmModal({ show: false, device: null })}
      />

      <StatusModal {...statusModal} onClose={hideStatus} />
    </>
  );
};

export default DeviceManagement;