import { epToNgn, EP_PER_USD } from '../../../models/WalletModel';

test('epToNgn computes NGN correctly from ngn_rate', () => {
  const ngnRate = 1600; // ₦1600 per $1
  const ep = 100; // 100 EP = $1
  const ngn = epToNgn(ngnRate, ep);
  expect(ngn).toBeCloseTo(1600);
  // per EP should be ngnRate / EP_PER_USD
  const perEp = ngnRate / EP_PER_USD;
  expect(perEp).toBeCloseTo(16);
});
