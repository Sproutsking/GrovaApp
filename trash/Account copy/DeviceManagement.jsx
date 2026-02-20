// ============================================================================
// src/components/Account/DeviceManagement.jsx - PERFECT SESSION MANAGEMENT
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Loader, X, MapPin, Globe, Clock, Monitor, Smartphone, Shield } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import ConfirmModal from '../Modals/ConfirmModal';
import StatusModal from '../Modals/StatusModal';

const DeviceManagement = ({ userId, onClose, onDeviceRemoved }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingSession, setRemovingSession] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, session: null });
  const [statusModal, setStatusModal] = useState({ show: false, type: 'success', message: '' });
  const [currentSessionId, setCurrentSessionId] = useState(null);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);

      // Get current session info
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setCurrentSessionId(currentSession.access_token);
      }

      // Get all user sessions from database
      const { data: userSessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (sessionsError) {
        console.error('Sessions error:', sessionsError);
      }

      // Get device fingerprints
      const { data: devices, error: devicesError } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', userId)
        .order('last_seen', { ascending: false });

      if (devicesError) {
        console.error('Devices error:', devicesError);
      }

      // Combine sessions and devices data
      const combined = [];

      // Add active sessions
      if (userSessions && userSessions.length > 0) {
        userSessions.forEach(session => {
          // Find matching device
          const device = devices?.find(d => d.id === session.device_fingerprint_id);
          
          combined.push({
            id: session.id,
            type: 'session',
            sessionToken: session.session_token,
            deviceName: session.user_agent || 'Unknown Device',
            browser: extractBrowser(session.user_agent),
            os: extractOS(session.user_agent),
            ipAddress: session.ip_address,
            location: formatLocation(session.location_data),
            lastActivity: session.last_activity,
            createdAt: session.created_at,
            isActive: session.is_active,
            isTrusted: device?.is_trusted || false,
            isCurrent: session.session_token === currentSessionId
          });
        });
      }

      // Add devices without active sessions
      if (devices && devices.length > 0) {
        devices.forEach(device => {
          const hasSession = combined.some(s => s.deviceFingerprint === device.fingerprint_hash);
          
          if (!hasSession) {
            combined.push({
              id: device.id,
              type: 'device',
              deviceName: device.device_name || `${device.browser} on ${device.os}`,
              browser: device.browser,
              os: device.os,
              ipAddress: device.ip_address,
              location: `${device.location_city || 'Unknown'}, ${device.location_country || ''}`,
              lastActivity: device.last_seen,
              createdAt: device.first_seen,
              isActive: false,
              isTrusted: device.is_trusted,
              isCurrent: false
            });
          }
        });
      }

      // Sort by last activity
      combined.sort((a, b) => {
        const aTime = new Date(a.lastActivity || a.createdAt).getTime();
        const bTime = new Date(b.lastActivity || b.createdAt).getTime();
        return bTime - aTime;
      });

      setSessions(combined);

    } catch (error) {
      console.error('Failed to load sessions:', error);
      showStatus('error', 'Failed to load device sessions');
    } finally {
      setLoading(false);
    }
  };

  const extractBrowser = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  };

  const extractOS = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone')) return 'iOS';
    return 'Unknown';
  };

  const formatLocation = (locationData) => {
    if (!locationData) return 'Unknown location';
    if (typeof locationData === 'string') return locationData;
    if (locationData.city && locationData.country) {
      return `${locationData.city}, ${locationData.country}`;
    }
    return 'Unknown location';
  };

  const showStatus = (type, message) => {
    setStatusModal({ show: true, type, message });
  };

  const hideStatus = () => {
    setStatusModal({ show: false, type: 'success', message: '' });
  };

  const handleRemoveSession = (session) => {
    if (session.isCurrent) {
      showStatus('error', 'Cannot remove current session');
      return;
    }
    setConfirmModal({ show: true, session });
  };

  const confirmRemoveSession = async () => {
    const session = confirmModal.session;
    if (!session) return;

    try {
      setRemovingSession(session.id);
      setConfirmModal({ show: false, session: null });

      if (session.type === 'session') {
        // End the session
        const { error } = await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', session.id);

        if (error) throw error;
      } else {
        // Remove device trust
        const { error } = await supabase
          .from('device_fingerprints')
          .update({ 
            is_trusted: false
          })
          .eq('id', session.id);

        if (error) throw error;
      }

      // Log security event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: session.type === 'session' ? 'session_ended' : 'device_untrusted',
        severity: 'info',
        metadata: { 
          session_id: session.id,
          device_name: session.deviceName,
          browser: session.browser,
          os: session.os
        }
      });

      setSessions(prev => prev.filter(s => s.id !== session.id));
      showStatus('success', `${session.type === 'session' ? 'Session' : 'Device'} removed successfully`);
      
      if (onDeviceRemoved) {
        onDeviceRemoved();
      }

    } catch (error) {
      console.error('Failed to remove session:', error);
      showStatus('error', 'Failed to remove session');
    } finally {
      setRemovingSession(null);
    }
  };

  const getDeviceIcon = (os, isMobile) => {
    const osLower = (os || '').toLowerCase();
    if (osLower.includes('android') || osLower.includes('ios') || osLower.includes('iphone')) {
      return <Smartphone size={24} />;
    }
    return <Monitor size={24} />;
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Active now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }
        
        .modal-content {
          background: #0a0a0a;
          border-radius: 20px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 2px solid rgba(132, 204, 22, 0.3);
        }
        
        .modal-header {
          padding: 24px;
          border-bottom: 2px solid rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(132, 204, 22, 0.05);
        }
        
        .modal-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.4);
        }
        
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }
        
        .session-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          transition: all 0.3s;
          position: relative;
        }
        
        .session-card.current {
          border: 2px solid #84cc16;
          background: rgba(132, 204, 22, 0.05);
        }
        
        .session-card.current::before {
          content: 'Current Session';
          position: absolute;
          top: -12px;
          left: 16px;
          background: #84cc16;
          color: #000;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
        }
        
        .session-card:hover:not(.current) {
          border-color: rgba(132, 204, 22, 0.4);
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
        }
        
        .session-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          flex-shrink: 0;
        }
        
        .session-info {
          flex: 1;
          min-width: 0;
        }
        
        .session-name {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .trusted-badge {
          padding: 2px 8px;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 6px;
          color: #22c55e;
          font-size: 10px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .session-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .session-detail {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #a3a3a3;
        }
        
        .session-detail svg {
          color: #84cc16;
          flex-shrink: 0;
        }
        
        .remove-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
          transition: all 0.3s;
          align-self: flex-start;
        }
        
        .remove-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          transform: translateY(-2px);
        }
        
        .remove-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-left">
              <div className="modal-icon">
                <Shield size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', margin: 0 }}>
                  Active Sessions & Devices
                </h2>
                <p style={{ fontSize: '13px', color: '#a3a3a3', margin: '4px 0 0 0' }}>
                  {sessions.length} device{sessions.length !== 1 ? 's' : ''} • Manage your account security
                </p>
              </div>
            </div>
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
                <p style={{ color: '#a3a3a3' }}>Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
                <h3 style={{ color: '#fff', marginBottom: '8px', fontSize: '20px' }}>No Active Sessions</h3>
                <p style={{ color: '#a3a3a3', fontSize: '14px' }}>
                  Your account is secure. New sessions will appear here.
                </p>
              </div>
            ) : (
              <>
                <p style={{ marginBottom: '20px', color: '#a3a3a3', fontSize: '14px', lineHeight: '1.6' }}>
                  These are all devices and browsers where you're currently signed in. Remove any sessions you don't recognize or no longer use.
                </p>
                {sessions.map(session => (
                  <div key={session.id} className={`session-card ${session.isCurrent ? 'current' : ''}`}>
                    <div className="session-icon-wrapper">
                      {getDeviceIcon(session.os)}
                    </div>
                    
                    <div className="session-info">
                      <div className="session-name">
                        {session.browser} on {session.os}
                        {session.isTrusted && (
                          <span className="trusted-badge">
                            <Shield size={10} />
                            Trusted
                          </span>
                        )}
                      </div>
                      
                      <div className="session-details">
                        {session.ipAddress && (
                          <div className="session-detail">
                            <Globe size={14} />
                            <span>{session.ipAddress}</span>
                          </div>
                        )}
                        
                        {session.location && (
                          <div className="session-detail">
                            <MapPin size={14} />
                            <span>{session.location}</span>
                          </div>
                        )}
                        
                        <div className="session-detail">
                          <Clock size={14} />
                          <span>
                            Last active: {formatLastSeen(session.lastActivity)}
                          </span>
                        </div>
                        
                        {session.createdAt && (
                          <div className="session-detail" style={{ color: '#666', fontSize: '12px' }}>
                            Signed in {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!session.isCurrent && (
                      <button
                        disabled={removingSession === session.id}
                        onClick={() => handleRemoveSession(session)}
                        className="remove-btn"
                      >
                        {removingSession === session.id ? (
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
                          '🗑️ Remove'
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        show={confirmModal.show}
        title="Remove Session"
        message={`Are you sure you want to remove this session? You will need to sign in again on this device.`}
        confirmText="Remove Session"
        dangerous={true}
        onConfirm={confirmRemoveSession}
        onCancel={() => setConfirmModal({ show: false, session: null })}
      />

      <StatusModal {...statusModal} onClose={hideStatus} />
    </>
  );
};

export default DeviceManagement;