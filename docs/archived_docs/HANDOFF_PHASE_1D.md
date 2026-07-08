# 🎯 HANDOFF PROMPT — Web3 Phase 1D: Automatic Payment UI Integration

**⚠️ BUDGET CRITICAL**: Only 5% unit budget remaining. Zero tolerance for token waste. Follow directives exactly.

---

## 🔴 IMMEDIATE CONTEXT (Read First)

**Current State**: Phase 1C ✅ COMPLETE. All backend infrastructure deployed.
- ✅ Database: 3 tracking tables + RPC functions
- ✅ Edge Functions: 5 functions handling full payment lifecycle
- ✅ Frontend Services: `web3PaymentService.js` + `useWalletConnect.js` ready
- ✅ Manual Path: Enhanced with sender wallet validation
- ✅ Webhook System: Confirmation listener + 30s poller deployed

**What's Next**: Phase 1D — Build automatic wallet payment UI (QuickPayTab)

**Budget Strategy**: 
- NO exploratory searches — use provided code references only
- NO file reads beyond what's explicitly listed below
- NO code refactoring — create new files only
- NO modifications to Phase 1C files (they're locked/tested)
- Single tool calls in parallel where safe
- Reuse provided context fully

---

## 📋 PHASE 1D EXACT REQUIREMENTS

### Goal
Create unified **"Quick Pay" tab** in DepositTab.jsx that handles automatic wallet payment flow:

1. **Wallet Selection Modal** → Detect connected wallets (MetaMask, Phantom, TronLink, etc.)
2. **Amount Input** → Enter USD amount (min $1, max $10,000)
3. **Gas Fee Display** → Show estimated gas per chain (EVM $25, Polygon $0.50, etc.)
4. **Real-Time Confirmation Counter** → Show current/required confirmations with progress bar
5. **Auto-Credit Notification** → "Payment confirmed! +100 EP credited" with sound

### Key Dependencies (Already Built)

**`src/services/wallet/web3PaymentService.js`** (325 lines)
- `initiateAutoPayment()` → Returns {sessionId, nonce, treasuryAddress, amountFormatted, estimatedGas}
- `submitAutoPayment()` → Submits signed TX, returns {paymentId, txHash, requiredConfirmations}
- `pollPaymentStatus()` → Real-time confirmation polling with callbacks
- `disconnectWallet()` → Clean up session

**`src/hooks/useWalletConnect.js`** (380 lines)
- `connectWallet(walletId, chainType, chainId)` → Returns connected address
- `requestSignature()` → Signs message with connected wallet
- `requestPayment()` → Initiates stablecoin transfer approval
- Returns: `{wallets, connected, connecting, error, isConnected, connectedAddress}`

**`DepositTab.jsx` Current Structure**:
- Already has `ImportMode` (smart import wallet selection)
- Already has `ReceiveMode` (manual deposit with sender wallet)
- **Need to add**: `QuickPayMode` (automatic wallet payment)

---

## 🔨 EXACT BUILD PLAN (No Deviation)

### Step 1: Prepare DepositTab States
**File**: `src/components/wallet/tabs/DepositTab.jsx`

Add to main component state (around line 150-170, after existing states):
```javascript
// Quick Pay mode state
const [walletConnecting, setWalletConnecting] = useState(false);
const [selectedChain, setSelectedChain] = useState("polygon"); // Default chain
const [quickPayAmount, setQuickPayAmount] = useState("");
const [quickPayPhase, setQuickPayPhase] = useState(null); // null|connecting|signing|confirming|completed
const [signatureError, setSignatureError] = useState("");
const [currentConfirmations, setCurrentConfirmations] = useState(0);
const [requiredConfirmations, setRequiredConfirmations] = useState(12);
```

**Location**: Add just before the main return statement but in the main component

---

### Step 2: Create QuickPayMode Component
**File**: Create NEW file `src/components/wallet/tabs/QuickPayMode.jsx`

**Requirements**:
1. Import: `useWalletConnect`, `web3PaymentService`, `SUPPORTED_CHAINS` from constants
2. Props: `{resolvedUserId, currency, rate, onRefresh}`
3. State: Handle phase progression (null → connecting → signing → confirming → completed)

**Components within QuickPayMode**:

#### A) Wallet Selection Panel
```javascript
<div className="qpm-wallets">
  <div className="qpm-label">Select Wallet</div>
  {wallets.map(w => (
    <button
      key={w.id}
      className={`qpm-wallet-btn${selected?.id === w.id ? " active" : ""}`}
      onClick={() => {
        connectWallet(w.id, chainType, chainId);
        setPhase("connecting");
      }}
    >
      <w.icon size={16} />
      {w.name}
    </button>
  ))}
</div>
```

#### B) Chain Selection (Dropdown)
```javascript
<select value={selectedChain} onChange={e => setSelectedChain(e.target.value)}>
  {SUPPORTED_CHAINS.map(c => (
    <option key={c.name} value={c.name}>
      {c.label} (Gas: ${c.gasEstimate})
    </option>
  ))}
</select>
```

#### C) Amount Input
```javascript
<div className="qpm-amount-input">
  <label>Amount (USD)</label>
  <input
    type="number"
    placeholder="100"
    min="1"
    max="10000"
    value={quickPayAmount}
    onChange={e => setQuickPayAmount(e.target.value)}
  />
  <div className="qpm-gas-estimate">
    Est. Gas: ${gasEstimate.toFixed(2)}
  </div>
</div>
```

#### D) Confirmation Progress Bar
```javascript
{phase === "confirming" && (
  <div className="qpm-progress">
    <div className="qpm-label">
      {currentConfirmations}/{requiredConfirmations} Confirmations
    </div>
    <div className="qpm-bar">
      <div
        className="qpm-bar-fill"
        style={{width: `${(currentConfirmations/requiredConfirmations)*100}%`}}
      />
    </div>
    <div className="qpm-status-msg">
      {currentConfirmations >= requiredConfirmations
        ? "✓ Payment confirmed! Credits applied"
        : `Waiting for confirmations (${currentConfirmations}/${requiredConfirmations})`}
    </div>
  </div>
)}
```

#### E) Action Button
```javascript
<button
  className="qpm-cta"
  disabled={!connected || !quickPayAmount || phase !== null}
  onClick={handleQuickPaySubmit}
>
  {phase === "connecting" && "Connecting..."}
  {phase === "signing" && "Sign in wallet..."}
  {phase === "confirming" && "Confirming..."}
  {phase === "completed" && "✓ Done!"}
  {!phase && "Pay Now"}
</button>
```

---

### Step 3: Implement Flow Logic
**In QuickPayMode.jsx**:

#### handleQuickPaySubmit Function
```javascript
const handleQuickPaySubmit = async () => {
  if (!connected || !quickPayAmount) return;
  
  try {
    setPhase("signing");
    
    // 1. Initiate payment session (nonce + treasury address)
    const init = await web3PaymentService.initiateAutoPayment({
      userId: userId,
      walletAddress: connectedAddress,
      walletName: connectedWalletName,
      chainType: "EVM", // for now
      chainName: selectedChain,
      amountUSD: parseFloat(quickPayAmount),
      productId: null, // No product ID for direct payment
      tokenSymbol: "USDC" // Default to USDC
    });
    
    // 2. Request wallet signature
    const signature = await web3PaymentService.requestSignature({
      message: `Authorize payment of $${quickPayAmount}`,
      chainType: "EVM"
    });
    
    // 3. Get transaction hash from wallet (simulate signing)
    // User's wallet will submit the TX, capture hash
    const txHash = await requestPayment(stablecoinAddress, treasuryAddress, amount);
    
    // 4. Submit to backend (record payment)
    const submit = await web3PaymentService.submitAutoPayment({
      sessionId: init.sessionId,
      nonce: init.nonce,
      txHash: txHash,
      signature: signature,
      chainType: "EVM"
    });
    
    setPhase("confirming");
    setRequiredConfirmations(submit.requiredConfirmations);
    
    // 5. Poll for confirmations in real-time
    await web3PaymentService.pollPaymentStatus({
      paymentId: submit.paymentId,
      onStatusChange: (status) => console.log("Status:", status),
      onConfirmed: (confirmations) => {
        setCurrentConfirmations(confirmations);
        setPhase("completed");
        if (onRefresh) onRefresh();
        playSuccessSound(); // Optional: celebratory tone
      },
      onFailed: (error) => {
        setPhase(null);
        setSignatureError(error.message);
      },
      maxWaitMs: 600_000 // 10 minutes
    });
    
  } catch (e) {
    setPhase(null);
    setSignatureError(e.message);
  }
};
```

---

### Step 4: Export & Add to DepositTab
**In DepositTab.jsx** (main component):

Add import at top:
```javascript
import QuickPayMode from "./QuickPayMode";
```

Add tab selector buttons (around line 220-240, in main return):
```javascript
<div className="dt-tabs">
  <button className={`dt-tab${mode==="import"?" active":""}`} onClick={()=>setMode("import")}>
    Import Wallet
  </button>
  <button className={`dt-tab${mode==="quick"?" active":""}`} onClick={()=>setMode("quick")}>
    Quick Pay
  </button>
  <button className={`dt-tab${mode==="receive"?" active":""}`} onClick={()=>setMode("receive")}>
    Manual/Receive
  </button>
</div>
```

Replace existing conditional rendering with:
```javascript
{mode === "import" && <ImportMode ... />}
{mode === "quick" && <QuickPayMode resolvedUserId={resolvedUserId} currency={currency} rate={rate} onRefresh={onRefresh} />}
{mode === "receive" && <ReceiveMode ... />}
```

---

### Step 5: Styling (CSS)
**File**: Create NEW file `src/components/wallet/tabs/QuickPayMode.css`

**Essential Classes** (minimal styling for function):
```css
.qpm-wallets { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.qpm-wallet-btn { padding: 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: transparent; cursor: pointer; }
.qpm-wallet-btn.active { border-color: #34d399; background: rgba(52,211,153,.05); }
.qpm-amount-input { display: flex; flex-direction: column; gap: 8px; }
.qpm-progress { margin-top: 24px; }
.qpm-bar { width: 100%; height: 6px; background: rgba(255,255,255,.1); border-radius: 3px; overflow: hidden; }
.qpm-bar-fill { background: #34d399; height: 100%; transition: width 0.3s ease; }
.qpm-cta { width: 100%; padding: 14px; background: #34d399; border: none; border-radius: 8px; color: #070809; font-weight: 700; cursor: pointer; }
.qpm-cta:disabled { opacity: 0.5; cursor: not-allowed; }
```

---

## 🔒 CRITICAL CONSTRAINTS (Enforce Strictly)

**DO NOT:**
- ❌ Modify `web3PaymentService.js` — it's tested & locked
- ❌ Modify `useWalletConnect.js` — it's tested & locked
- ❌ Modify Phase 1C edge functions
- ❌ Add new database fields or migrations
- ❌ Search for "how to" examples — use provided context only
- ❌ Add complex error recovery UI yet (Phase 1E)

**DO:**
- ✅ Create new `.jsx` files only (QuickPayMode.jsx)
- ✅ Reuse existing hooks/services without modification
- ✅ Keep styling minimal (no Tailwind complexity)
- ✅ Test on testnet (Polygon Mumbai) first
- ✅ Follow the exact component structure provided

---

## 📦 EXISTING CODE REFERENCES (No Search Needed)

**Wallet Selection Modal**: `src/components/wallet/tabs/ImportMode.jsx` (lines 200-300) — copy pattern
**Manual Input Validation**: `src/components/wallet/tabs/DepositTab.jsx` (lines 810-830) — reuse pattern
**Payment Service Methods**: `src/services/wallet/web3PaymentService.js` (all documented with JSDoc)
**Chain Constants**: `src/constants/rates.js` or check web3PaymentService.js for SUPPORTED_CHAINS

---

## ✅ DELIVERABLES (Phase 1D)

After completion, you should have:

1. **QuickPayMode.jsx** (250 lines)
   - Wallet selection
   - Chain selector
   - Amount input
   - Gas fee display
   - Confirmation progress
   - Auto-credit on finalization

2. **QuickPayMode.css** (150 lines)
   - Minimal styling for functionality

3. **Updated DepositTab.jsx**
   - Import QuickPayMode
   - Add tab selector
   - Add mode state handling
   - All existing modes still work

4. **Updated .gitignore** (if needed)
   - No new deps added

---

## 🧪 TESTING CHECKLIST (After Build)

- [ ] QuickPayMode renders without errors
- [ ] Wallet selection modal shows detected wallets
- [ ] Chain selector updates gas estimate correctly
- [ ] Amount input validates $1-$10,000 range
- [ ] Signing request flows to wallet without error
- [ ] Confirmation counter updates in real-time
- [ ] Auto-credit displays on 100% confirmations
- [ ] Error message displays if signature rejected
- [ ] Tab switching works (Import ↔ Quick Pay ↔ Receive)

---

## 🎯 SUCCESS CRITERIA

Phase 1D is complete when:
1. ✅ User can select wallet from modal
2. ✅ User can enter USD amount
3. ✅ Wallet prompts for signature
4. ✅ Real-time confirmation counter shows progress
5. ✅ Payment auto-credits on finalization
6. ✅ No console errors
7. ✅ No modifications to Phase 1C code

---

## 📊 BUDGET NOTES

**Token Budget Left**: 5% of total  
**Per Action Cost**:
- File read: ~500 tokens (minimize)
- File write: ~1000 tokens (batch when possible)
- Search: ~800 tokens (use references only)
- Test: ~200 tokens

**Strategy**:
1. Build QuickPayMode.jsx — complete, no edits
2. Update DepositTab.jsx with minimal changes
3. Add CSS file
4. Test immediately
5. Push & declare complete

**No room for**: Refactoring, optimization, extra features

---

## 🚀 NEXT PHASE (1E) — After 1D Complete

Phase 1E: **End-to-End Testnet Validation**
- All payment paths tested on Polygon Mumbai
- Idempotency verified (same nonce twice = no double-credit)
- Replay protection tested (different user + same TX hash = rejected)
- Confirmation tracking validated
- Error recovery flows tested

**Then Phase 2**: OPay integration (separate system, doesn't touch Web3)

---

## 💡 TOKEN-SAVING TIPS

1. **Don't re-read Phase 1C docs** — use this summary
2. **Don't search for wallet detection** — copy from ImportMode.jsx
3. **Don't refactor** — new file + minimal changes only
4. **Don't add features** — exactly as spec'd above
5. **Batch file operations** — write QuickPayMode.jsx in one call
6. **Test in-app immediately** — catch errors before next iteration
7. **Use provided code patterns** — no creative experiments

---

## 📞 HANDOFF COMPLETE

**Handed off by**: GitHub Copilot (Phase 1C)  
**Handed off to**: Next Agent (Phase 1D)  
**Commit**: c35d9eb (Web3 Phase 1C complete)  
**Date**: 2026-06-29  

**Status**: 🟢 All backend complete. Ready for UI build. Zero ambiguity in spec. Follow exactly.
