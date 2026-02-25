// paywave/modals/index.jsx
// All modal overlays in one place — import individually by name.

import React, { useState } from "react";
import { X, CheckCircle, Info, Upload } from "lucide-react";

const Overlay = ({ children }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 300,
    background: "rgba(0,0,0,0.82)",
    backdropFilter: "blur(5px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    {children}
  </div>
);

const ModalBox = ({ children }) => (
  <div className="glass" style={{ width: 310, maxWidth: "92%", padding: 20 }}>
    {children}
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <span style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{title}</span>
    <button onClick={onClose}
      style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-soft)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <X size={15} />
    </button>
  </div>
);

// ── PIN modal ──────────────────────────────────────────────
export const PinModal = ({ onClose, onVerify }) => {
  const [pin, setPin] = useState("");
  return (
    <Overlay>
      <ModalBox>
        <ModalHeader title="Enter Transaction PIN" onClose={onClose} />
        <input type="password" value={pin} onChange={e => setPin(e.target.value)}
          placeholder="••••" maxLength={4}
          style={{ width: "100%", background: "var(--surface)", padding: "13px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", color: "var(--text)", outline: "none", textAlign: "center", fontSize: 22, fontFamily: "var(--font-d)", letterSpacing: "0.3em", marginBottom: 8 }}
          onFocus={e => e.target.style.borderColor = "var(--lime-border)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <p style={{ color: "var(--text-soft)", fontSize: 11.5, textAlign: "center", marginBottom: 14 }}>Demo PIN: 1234</p>
        <button className="btn-lime full" onClick={() => onVerify(pin)}>Confirm</button>
      </ModalBox>
    </Overlay>
  );
};

// ── Success modal ──────────────────────────────────────────
export const SuccessModal = ({ message, onClose }) => (
  <Overlay>
    <ModalBox>
      <div style={{ textAlign: "center" }}>
        {/* Gold ring around lime check — the gold touch */}
        <div style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 14px", background: "linear-gradient(135deg, var(--gold-dim), rgba(163,230,53,0.08))", border: "1.5px solid var(--gold-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={38} color="var(--lime)" />
        </div>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Done!</div>
        <div style={{ color: "var(--text-soft)", fontSize: 13, marginBottom: 20, lineHeight: 1.65, whiteSpace: "pre-line" }}>{message}</div>
        <button className="btn-lime full" onClick={onClose}>Back to Home</button>
      </div>
    </ModalBox>
  </Overlay>
);

// ── Verification code modal ────────────────────────────────
export const CodeModal = ({ onClose, onVerify }) => {
  const [code, setCode] = useState("");
  return (
    <Overlay>
      <ModalBox>
        <ModalHeader title="Verify Code" onClose={onClose} />
        <p style={{ color: "var(--text-soft)", fontSize: 12, marginBottom: 12 }}>Code sent to your phone/email — Demo: 123456</p>
        <input type="text" value={code} onChange={e => setCode(e.target.value)}
          placeholder="••••••" maxLength={6}
          style={{ width: "100%", background: "var(--surface)", padding: "13px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", color: "var(--text)", outline: "none", textAlign: "center", fontSize: 22, fontFamily: "var(--font-d)", letterSpacing: "0.3em", marginBottom: 14 }}
          onFocus={e => e.target.style.borderColor = "var(--lime-border)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <button className="btn-lime full" onClick={() => onVerify(code)}>Verify</button>
      </ModalBox>
    </Overlay>
  );
};

// ── Transfer type picker ───────────────────────────────────
export const SendTypeModal = ({ onClose, onSelect }) => (
  <Overlay>
    <ModalBox>
      <ModalHeader title="Choose Transfer Type" onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="btn-lime full" onClick={() => onSelect("paywave")}>To Paywave User</button>
        <button className="btn-ghost full" onClick={() => onSelect("other")} style={{ width: "100%" }}>To Other Bank</button>
      </div>
    </ModalBox>
  </Overlay>
);

// ── Document upload ────────────────────────────────────────
export const DocUploadModal = ({ onClose, onSubmit }) => (
  <Overlay>
    <ModalBox>
      <ModalHeader title="Upload Documents" onClose={onClose} />
      <p style={{ color: "var(--text-soft)", fontSize: 12, marginBottom: 13 }}>Upload a valid ID and proof for verification.</p>
      <div className="glass" style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", borderStyle: "dashed", borderColor: "var(--lime-border)" }}>
        <Upload size={24} color="var(--lime)" />
        <span style={{ color: "var(--text-soft)", fontSize: 13 }}>Tap to upload file</span>
      </div>
      <button className="btn-lime full" onClick={onSubmit}>Submit Documents</button>
    </ModalBox>
  </Overlay>
);

// ── Under review notice ────────────────────────────────────
export const ReviewModal = ({ onClose }) => (
  <Overlay>
    <ModalBox>
      <div style={{ textAlign: "center" }}>
        {/* Gold accent — this is one of its rare homes */}
        <div style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 14px", background: "var(--gold-dim)", border: "1px solid var(--gold-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Info size={30} color="var(--gold)" />
        </div>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 7 }}>Under Review</div>
        <div style={{ color: "var(--text-soft)", fontSize: 13, marginBottom: 20 }}>Your changes will be processed within 24 hours.</div>
        <button className="btn-lime full" onClick={onClose}>Got It</button>
      </div>
    </ModalBox>
  </Overlay>
);