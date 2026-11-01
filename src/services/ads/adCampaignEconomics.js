export function calculateCampaignEconomics(inputBudget, feeMode) {
  const budget = Math.floor(Number(inputBudget));
  if (!Number.isFinite(budget) || budget <= 0) {
    return { budget: 0, commission: 0, creatorPool: 0, totalEscrow: 0 };
  }
  const commission = Math.ceil(budget * 0.1);
  return {
    budget,
    commission,
    creatorPool: feeMode === "included" ? budget - commission : budget,
    totalEscrow: feeMode === "included" ? budget : budget + commission,
  };
}
