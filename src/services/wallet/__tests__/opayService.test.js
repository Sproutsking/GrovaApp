jest.mock('../../config/supabase', () => {
  const mockClient = {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: { id: 'tx-1' }, error: null }),
        })),
      })),
      update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({}) })),
      select: jest.fn(() => ({ eq: jest.fn(), order: jest.fn(), limit: jest.fn() })),
    })),
  };

  return { __esModule: true, supabase: mockClient, default: mockClient };
});

jest.resetModules();
import * as opayService from '../opayService';
import { supabase } from '../../config/supabase';

test('buyAirtime calls RPC and returns success shape', async () => {
  supabase.rpc.mockResolvedValueOnce({ data: { success: true, transaction_id: 'tx-1' }, error: null });
  // debug: inspect mocked supabase
  // eslint-disable-next-line no-console
  console.log('DEBUG supabase.from:', typeof supabase.from, supabase.from && supabase.from.toString && supabase.from.toString());
  const res = await opayService.buyAirtime({ userId: 'u1', network: 'mtn', phone: '08012345678', amount: 200 });
  expect(res.success).toBe(true);
});

test('buyAirtime handles RPC errors', async () => {
  supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc error' } });
  const res = await opayService.buyAirtime({ userId: 'u1', network: 'mtn', phone: '08012345678', amount: 200 });
  expect(res.success).toBe(false);
});
