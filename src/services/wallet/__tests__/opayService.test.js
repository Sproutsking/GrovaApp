import { opayService } from '../opayService';
import { supabase } from '../../config/supabase';

jest.mock('../../config/supabase', () => ({
  __esModule: true,
  supabase: {
    rpc: jest.fn(),
  },
}));

test('buyAirtime calls RPC and returns success shape', async () => {
  supabase.rpc.mockResolvedValueOnce({ data: { success: true, transaction_id: 'tx-1' }, error: null });
  const res = await opayService.buyAirtime({ userId: 'u1', network: 'mtn', phone: '08012345678', amount: 200 });
  expect(res.success).toBe(true);
});

test('buyAirtime handles RPC errors', async () => {
  supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc error' } });
  const res = await opayService.buyAirtime({ userId: 'u1', network: 'mtn', phone: '08012345678', amount: 200 });
  expect(res.success).toBe(false);
});
