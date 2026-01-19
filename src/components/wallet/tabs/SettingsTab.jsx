// src/components/wallet/tabs/SettingsTab.jsx
import React, { useState } from 'react';
import { X, Lock, Shield, Bell, Key, ChevronRight, QrCode, CheckCircle } from 'lucide-react';

const SettingsTab = ({ setActiveTab }) => {
  const [subView, setSubView] = useState(null);
  const [pinForm, setPinForm] = useState({ old: '', new: '', confirm: '' });
  const [twoFAForm, setTwoFAForm] = useState({ code: '' });
  const [biometrics, setBiometrics] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showPhrase, setShowPhrase] = useState(false);

  const handleChangePin = () => {
    if (pinForm.new === pinForm.confirm) {
      console.log('Changing PIN');
      alert('PIN changed successfully!');
      setSubView(null);
    } else {
      alert('Pins do not match');
    }
  };

  const handleVerify2FA = () => {
    console.log('Verifying 2FA code:', twoFAForm.code);
    alert('2FA enabled!');
    setSubView(null);
  };

  const demoPhrase = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';

  if (subView) {
    return (
      <>
        <div className="view-header">
          <button onClick={() => setSubView(null)} className="back-btn">
            <X size={20} />
          </button>
          <div>
            <h2 className="view-title">{subView.replace(/([A-Z])/g, ' $1').trim()}</h2>
          </div>
        </div>
        {subView === 'changePin' && (
          <div className="form-card">
            <div className="form-group">
              <label>Old PIN</label>
              <input type="password" value={pinForm.old} onChange={e => setPinForm({ ...pinForm, old: e.target.value })} />
            </div>
            <div className="form-group">
              <label>New PIN</label>
              <input type="password" value={pinForm.new} onChange={e => setPinForm({ ...pinForm, new: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Confirm New PIN</label>
              <input type="password" value={pinForm.confirm} onChange={e => setPinForm({ ...pinForm, confirm: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={handleChangePin}>Change PIN</button>
          </div>
        )}
        {subView === 'enableBiometrics' && (
          <div className="form-card">
            <div className="settings-item">
              <span>Enable Biometrics</span>
              <input type="checkbox" checked={biometrics} onChange={() => setBiometrics(!biometrics)} />
            </div>
            <button className="btn-primary" onClick={() => setSubView(null)}>Save</button>
          </div>
        )}
        {subView === 'twoFA' && (
          <div className="form-card">
            <p>Scan this QR with your authenticator app</p>
            <div className="qr-box"><QrCode size={80} /></div>
            <p>Secret: ABCDEF123456</p>
            <div className="form-group">
              <label>Enter Code to Verify</label>
              <input type="text" value={twoFAForm.code} onChange={e => setTwoFAForm({ ...twoFAForm, code: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={handleVerify2FA}><CheckCircle size={18} /> Verify</button>
          </div>
        )}
        {subView === 'transactionAlerts' && (
          <div className="form-card">
            <div className="settings-item">
              <span>Transaction Alerts</span>
              <input type="checkbox" checked={notifications} onChange={() => setNotifications(!notifications)} />
            </div>
            <button className="btn-primary" onClick={() => setSubView(null)}>Save</button>
          </div>
        )}
        {subView === 'recoveryPhrase' && (
          <div className="form-card">
            {!showPhrase ? (
              <button className="btn-primary" onClick={() => setShowPhrase(true)}>Show Recovery Phrase</button>
            ) : (
              <div>
                <p className="address-text">{demoPhrase}</p>
                <button className="btn-primary" onClick={() => setShowPhrase(false)}>Hide</button>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="view-header">
        <button onClick={() => setActiveTab('overview')} className="back-btn">
          <X size={20} />
        </button>
        <div>
          <h2 className="view-title">Settings</h2>
          <p className="view-subtitle">Manage your wallet preferences</p>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-group-title">Security</h3>
        <button className="settings-item" onClick={() => setSubView('changePin')}>
          <Lock size={20} />
          <div className="settings-item-info">
            <span>Change PIN</span>
            <p>Update your security PIN</p>
          </div>
          <ChevronRight size={20} />
        </button>
        <button className="settings-item" onClick={() => setSubView('enableBiometrics')}>
          <Shield size={20} />
          <div className="settings-item-info">
            <span>Enable Biometrics</span>
            <p>Use fingerprint or face ID</p>
          </div>
          <ChevronRight size={20} />
        </button>
        <button className="settings-item" onClick={() => setSubView('twoFA')}>
          <Shield size={20} />
          <div className="settings-item-info">
            <span>2FA Authentication</span>
            <p>Connect to external auth app</p>
          </div>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="settings-section">
        <h3 className="settings-group-title">Notifications</h3>
        <button className="settings-item" onClick={() => setSubView('transactionAlerts')}>
          <Bell size={20} />
          <div className="settings-item-info">
            <span>Transaction Alerts</span>
            <p>Get notified of wallet activity</p>
          </div>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="settings-section">
        <h3 className="settings-group-title">Advanced</h3>
        <button className="settings-item" onClick={() => setSubView('recoveryPhrase')}>
          <Key size={20} />
          <div className="settings-item-info">
            <span>Recovery Phrase</span>
            <p>View your backup phrase</p>
          </div>
          <ChevronRight size={20} />
        </button>
      </div>
    </>
  );
};

export default SettingsTab;