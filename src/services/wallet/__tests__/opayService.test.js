import { opayService } from '../opayService';
import { supabase } from '../../config/supabase';

const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();

jest.mock('../../config/supabase', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle.mockResolvedValue({ data: { id: 'tx-1' }, error: null });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data: null, error: null });

  supabase.from.mockReturnValue({
    insert: mockInsert,
    update: mockUpdate,
  });
});

test('buyAirtime calls RPC and returns success shape', async () => {
  supabase.rpc.mockResolvedValueOnce({ data: { success: true, transaction_id: 'tx-1' }, error: null });

  const res = await opayService.buyAirtime({ userId: 'u1', network: 'mtn', phone: '08012345678', amount: 200 });

  expect(res.success).toBe(true);
  expect(supabase.from).toHaveBeenCalledWith('paywave_transactions');
  expect(supabase.rpc).toHaveBeenCalledWith('opay_buy_airtime', expect.objectContaining({ p_network: 'mtn' }));
});

test('buyAirtime handles RPC errors', async () => {
  supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc error' } });

  const res = await opayService.buyAirtime({ userId: 'u1', network: 'mtn', phone: '08012345678', amount: 200 });

  expect(res.success).toBe(false);
  expect(res.error).toBe('rpc error');
});
