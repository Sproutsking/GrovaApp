// src/components/Modals/StatusModal.jsx
import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

const StatusModal = ({ show, type, message, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease'
      }}>
        <div style={{
          background: '#1a1a1a',
          border: `2px solid ${type === 'success' ? '#84cc16' : '#ef4444'}`,
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          animation: 'slideUp 0.3s ease'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: type === 'success' ? 'rgba(132, 204, 22, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {type === 'success' ? (
              <Check size={40} style={{ color: '#84cc16' }} />
            ) : (
              <X size={40} style={{ color: '#ef4444' }} />
            )}
          </div>
          <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '20px', fontWeight: '700' }}>
            {type === 'success' ? 'Success!' : 'Error!'}
          </h3>
          <p style={{ color: '#a3a3a3', fontSize: '15px', margin: 0 }}>{message}</p>
        </div>
      </div>
    </>
  );
};

export default StatusModal;