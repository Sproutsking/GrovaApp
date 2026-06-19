# OPay Integration Guide for Grova (PayWave)

## Overview

OPay serves as Grova's **singular money network gateway** for Naira transactions. This is NOT a banking application - we use OPay's API to facilitate money movement without holding a banking license.

## Architecture

```
Grova (Money Network)
    ↓
    ├─ PayWave (In-app Naira wallet)
    │  ├─ Transfers (user-to-user via OPay)
    │  ├─ Bills (airtime, data, electricity, cable)
    │  ├─ Deposits (to PayWave balance)
    │  └─ Withdrawals (to OPay account)
    │
    └─ OPay API (Money Movement)
       ├─ paywave_external_send (transfers)
       ├─ opay_buy_airtime (bills)
       ├─ opay_buy_data (bills)
       ├─ opay_buy_electricity (bills)
       ├─ opay_buy_cable (bills)
       ├─ opay_deposit_to_paywave (deposits)
       └─ opay_withdrawal_from_paywave (withdrawals)
```

## Service Layer

The `opayService.js` file provides a centralized interface for all OPay operations:

### Available Methods

#### 1. Transfer Money
```javascript
import opayService from "../../services/wallet/opayService";

const result = await opayService.transfer({
  fromUserId: "user-123",
  recipientPhone: "2347081234567",  // or 07081234567
  ngnAmount: 5000,
  note: "Payment for goods"
});

if (result.success) {
  console.log("Transferred:", result.data);
} else {
  console.error("Error:", result.error);
}
```

#### 2. Bill Payment
```javascript
const result = await opayService.billPayment({
  userId: "user-123",
  billType: "airtime",  // 'airtime' | 'data' | 'electricity' | 'cable'
  provider: "MTN",      // 'MTN' | 'GLO' | 'AIRTEL' | '9mobile' | 'NEPA' | 'DSTV' | 'GOTV'
  identifier: "07081234567",  // phone/meter/account
  ngnAmount: 500
});

if (result.success) {
  console.log("Bill paid! ID:", result.transactionId);
}
```

#### 3. Deposit to PayWave
```javascript
const result = await opayService.deposit({
  userId: "user-123",
  ngnAmount: 10000,
  currency: "EP"  // 'EP' or 'XEV'
});

if (result.success) {
  console.log("Deposited ₦10,000 = " + result.credit + " EP");
}
```

#### 4. Withdraw to OPay
```javascript
const result = await opayService.withdrawal({
  userId: "user-123",
  ngnAmount: 5000,
  opayPhone: "2347081234567"
});

if (result.success) {
  console.log("Withdrawal initiated:", result.transactionId);
}
```

#### 5. Get Balance
```javascript
const result = await opayService.getBalance("user-123");

if (result.success) {
  console.log("Balance: " + result.balance + " " + result.currency);
}
```

#### 6. Transaction History
```javascript
const result = await opayService.getTransactionHistory("user-123", 20, 0);

if (result.success) {
  console.log("Transactions:", result.transactions);
  console.log("Total:", result.total);
}
```

## RPC Functions Required

These Supabase RPC functions must be created (PostgreSQL functions):

### 1. `paywave_external_send`
Sends money to external phone number via OPay
```sql
PARAMETERS:
  p_from_user_id UUID
  p_opay_phone TEXT
  p_ngn_amount DECIMAL
  p_fee DECIMAL
  
RETURNS:
  {
    "success": boolean,
    "transaction_id": string,
    "reference": string,
    "amount": number,
    "fee": number,
    "total": number
  }
```

### 2. `opay_buy_airtime` / `opay_buy_data` / etc.
Process bill payments through OPay
```sql
PARAMETERS:
  p_user_id UUID
  p_amount DECIMAL
  p_provider TEXT (MTN, GLO, AIRTEL, 9mobile, NEPA, DSTV, GOTV)
  p_identifier TEXT (phone/meter/account)

RETURNS:
  {
    "success": boolean,
    "transaction_id": string,
    "status": string,
    "amount": number
  }
```

### 3. `opay_deposit_to_paywave`
Deposit funds from OPay to PayWave wallet
```sql
PARAMETERS:
  p_user_id UUID
  p_ngn_amount DECIMAL
  p_currency TEXT ('EP' or 'XEV')
  p_fee DECIMAL

RETURNS:
  {
    "success": boolean,
    "reference": string,
    "credit_amount": number,
    "currency": string
  }
```

### 4. `opay_withdrawal_from_paywave`
Withdraw from PayWave wallet to OPay account
```sql
PARAMETERS:
  p_user_id UUID
  p_ngn_amount DECIMAL
  p_opay_phone TEXT
  p_fee DECIMAL

RETURNS:
  {
    "success": boolean,
    "transaction_id": string,
    "amount": number,
    "fee": number
  }
```

## Usage Examples

### In PayWave Send Tab
```jsx
// src/components/wallet/paywave/tabs/WalletTab.jsx
import opayService from "../../../../services/wallet/opayService";

async function handleOPayTransfer() {
  const result = await opayService.transfer({
    fromUserId: profile.id,
    recipientPhone: recipient,
    ngnAmount: parseFloat(amount),
    note: "PayWave transfer"
  });
  
  if (result.success) {
    onSuccess(`Sent ₦${amount} via OPay`);
  } else {
    alert("Error: " + result.error);
  }
}
```

### In Bills Tab
```jsx
// src/components/wallet/paywave/tabs/BillsTab.jsx
import opayService from "../../../../services/wallet/opayService";

async function handleAirtimePurchase(network, amount) {
  const result = await opayService.billPayment({
    userId: profile.id,
    billType: "airtime",
    provider: network.toUpperCase(),  // MTN, GLO, etc.
    identifier: phoneNumber,
    ngnAmount: amount
  });
  
  if (result.success) {
    onSuccess(`₦${amount} airtime purchased`);
  } else {
    alert("Error: " + result.error);
  }
}
```

## Transaction Limits

- **Minimum**: ₦100
- **Maximum**: ₦5,000,000 per transaction
- **No daily limits** (but OPay account limits apply)

## Fees

- **Transfers**: ₦5 per transaction
- **Withdrawals**: ₦50 per transaction
- **Bills**: No fees
- **Deposits**: No fees

## Error Handling

All methods return a consistent response format:

```javascript
{
  success: boolean,
  data?: any,           // Success data (varies by operation)
  error?: string,       // Error message if failed
  transactionId?: string,
  reference?: string,
  // ... additional fields
}
```

### Common Errors

- **"Minimum deposit: ₦100"** - Amount too low
- **"Maximum transfer: ₦5,000,000"** - Amount too high
- **"Recipient phone required"** - Phone number missing or invalid
- **"User ID required"** - Session not found
- **"Insufficient balance"** - Not enough funds (from RPC)

## Validation Helpers

```javascript
import opayService from "../../services/wallet/opayService";

// Validate Nigerian phone
if (!OPayService.isValidNigerianPhone("07081234567")) {
  alert("Invalid Nigerian phone number");
}

// Format currency
const formatted = OPayService.formatNGN(5000);  // "₦5,000.00"

// Calculate fee
const fee = OPayService.calculateFee("transfer", 5000);  // 5
```

## Security Considerations

1. **Never store OPay credentials** - Use Supabase edge functions
2. **Phone numbers are case-sensitive** - Validate and sanitize
3. **Amounts in Naira (not kobo)** - All amounts are in Naira
4. **Rate limiting** - Implement on the RPC level
5. **User verification** - Require PIN for large transactions
6. **Audit logs** - Log all transactions for compliance

## Testing

### Test Amounts (if OPay provides sandbox)
```javascript
// These should work in sandbox mode
opayService.transfer({
  recipientPhone: "2347081234567",
  ngnAmount: 100  // Minimum amount
});
```

### Expected Responses
```javascript
// Success
{ success: true, data: {...}, transactionId: "TX_123" }

// Failure
{ success: false, error: "Insufficient balance" }
```

## Integration Checklist

- [ ] Create all RPC functions in Supabase
- [ ] Update BillsTab to use `opayService.billPayment()`
- [ ] Update WalletTab SendView to use `opayService.transfer()`
- [ ] Add OPay option to DepositTab
- [ ] Create WithdrawTab using `opayService.withdrawal()`
- [ ] Add transaction history view
- [ ] Test all bill payment types
- [ ] Test transfers and withdrawals
- [ ] Implement error handling UI
- [ ] Add transaction receipts
- [ ] Set up audit logging
- [ ] Create user documentation

## Support & Debugging

If a transaction fails:

1. **Check balance**: `opayService.getBalance(userId)`
2. **Verify phone**: `OPayService.isValidNigerianPhone(phone)`
3. **Check limits**: Amount must be ₦100 - ₦5,000,000
4. **Review history**: `opayService.getTransactionHistory(userId)`
5. **Check RPC**: Verify all RPC functions exist in Supabase

## Next Steps

1. Create Supabase RPC functions
2. Test with sample transactions
3. Integrate into remaining tabs (Deposits, Withdrawals)
4. Add transaction receipts and history
5. Implement notifications for successful transactions
