// src/components/Modals/ConfirmModal.jsx
import React from 'react';

const ConfirmModal = ({ 
  show, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  dangerous = false 
}) => {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }} onClick={onCancel}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid rgba(132, 204, 22, 0.3)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '450px',
        width: '90%'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '16px', fontWeight: '700' }}>
          {title}
        </h3>
        <p style={{ fontSize: '15px', color: '#a3a3a3', marginBottom: '24px', lineHeight: '1.6' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onCancel} style={{
            flex: 1,
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(132, 204, 22, 0.3)',
            borderRadius: '8px',
            color: '#84cc16',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '15px'
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1,
            padding: '12px',
            background: dangerous 
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
              : 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
            border: 'none',
            borderRadius: '8px',
            color: dangerous ? '#fff' : '#000',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '15px'
          }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;