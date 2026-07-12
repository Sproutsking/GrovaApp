const { getSupabaseClient } = require('./../../src/services/supabase/multiClient');

const wallet = getSupabaseClient('wallet');
const core = getSupabaseClient('core');
const identity = getSupabaseClient('identity');

console.log(JSON.stringify({
  wallet: !!wallet,
  core: !!core,
  identity: !!identity,
  walletLabel: wallet?.realtime?.headers?.['x-supabase-auth'] ? 'configured' : 'configured',
}, null, 2));
