#!/usr/bin/env python3
import json
from pathlib import Path

EXPORT_DIR = Path('exports/old_project')

def backup(src: Path):
    bak = src.with_suffix(src.suffix + '.orig')
    if not bak.exists():
        src.rename(bak)
        return bak
    return bak

def write_filtered(src: Path, transform):
    bak = src.with_suffix(src.suffix + '.orig')
    if not bak.exists():
        src.rename(bak)
    else:
        # original already backed up, use bak
        pass

    out = src
    with bak.open('r', encoding='utf-8') as inf, out.open('w', encoding='utf-8') as outf:
        for line in inf:
            line=line.strip()
            if not line:
                continue
            obj=json.loads(line)
            new=transform(obj)
            if new is None:
                continue
            outf.write(json.dumps(new, separators=(',',':'))+"\n")

def filter_wallets(obj):
    # Null out withdrawal_pin_hash if it looks like a hex/hash (not a timestamp)
    v = obj.get('withdrawal_pin_hash')
    if isinstance(v, str) and v and not v.strip().startswith(('0000','0001')):
        # if looks hex (only hex chars)
        import re
        if re.fullmatch(r'[0-9a-fA-F]{16,}', v):
            obj['withdrawal_pin_hash'] = None
    return obj

def filter_wallet_addresses(obj):
    # Null out address if it looks like a hex/0x value
    addr = obj.get('address')
    if isinstance(addr, str) and addr.startswith(('0x','0X')):
        obj['address'] = None
    return obj

def filter_p2p_payment_methods(obj):
    # Ensure method_type is valid; if not, move original to provider and set default method_type
    allowed = {'bank_account','mobile_money','crypto_wallet','card'}
    t = obj.get('type')
    if t and t not in allowed:
        obj['provider'] = t
        obj['type'] = 'bank_account'
    return obj

def filter_p2p_rate_limits(obj):
    # Drop rows with unknown action values (only keep transfer/withdrawal)
    action = obj.get('action') or obj.get('action_type')
    if action not in ('transfer','withdrawal'):
        return None
    # normalize key
    if 'action' in obj and 'action_type' not in obj:
        obj['action_type']=obj.pop('action')
    return obj

def filter_paywave_fee_config(obj):
    # Only allow recognized fee types; otherwise drop
    allowed = {'platform_fee','withdrawal_fee','transfer_fee','conversion_fee'}
    t = obj.get('transaction_type') or obj.get('fee_type')
    if t not in allowed:
        return None
    return obj

def main():
    mapping = [
        ('wallets.ndjson', filter_wallets),
        ('wallet_addresses.ndjson', filter_wallet_addresses),
        ('p2p_payment_methods.ndjson', filter_p2p_payment_methods),
        ('p2p_rate_limits.ndjson', filter_p2p_rate_limits),
        ('paywave_fee_config.ndjson', filter_paywave_fee_config),
    ]

    for fname, fn in mapping:
        src = EXPORT_DIR / fname
        if not src.exists():
            print('missing', fname)
            continue
        write_filtered(src, fn)
        print('filtered', fname)

    # create a boundary map that skips admin_revenue_summary and admin_user_stats
    bm_path = EXPORT_DIR / 'boundary_map_wallet_retry.json'
    import json as _json
    orig = EXPORT_DIR / 'boundary_map.json'
    if orig.exists():
        data = _json.loads(orig.read_text(encoding='utf-8'))
        wallet_list = [t for t in data.get('wallet', []) if t not in ('admin_revenue_summary','admin_user_stats')]
        data['wallet'] = wallet_list
        bm_path.write_text(_json.dumps(data, indent=2), encoding='utf-8')
        print('wrote', bm_path)

if __name__ == '__main__':
    main()
