// Premium split + billing-period helpers for the settlement ledger. Pure and
// unit-tested; the ledger INSERT lives in the distribution controller.
// All money is handled as exact 2-dp decimals (never floats-as-currency).

export interface PremiumSplit {
  gross: number;
  commissionRate: number;
  commission: number;
  platformFeeRate: number;
  platformFee: number;
  levy: number;
  hmoMarginRate: number;
  hmoMargin: number;  // the offering HMO's capitation/admin margin
  net: number;        // due to the underwriter (or the HMO itself, if standalone)
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Split a gross premium into partner commission, the MobiCova platform fee, a
// statutory levy, the offering HMO's margin, and the net due to the underwriter.
// All rates are percentages of gross. hmoMarginRate defaults to 0 (no HMO / a
// plan with no margin set), so the split is unchanged for legacy flows.
export function computePremiumSplit(
  gross: number, commissionRate: number, platformFeeRate: number, levy = 0, hmoMarginRate = 0
): PremiumSplit {
  const g = round2(Math.max(0, gross));
  const commission = round2(g * (commissionRate / 100));
  const platformFee = round2(g * (platformFeeRate / 100));
  const lv = round2(Math.max(0, levy));
  const hmoMargin = round2(g * (Math.max(0, hmoMarginRate) / 100));
  const net = round2(g - commission - platformFee - lv - hmoMargin);
  return { gross: g, commissionRate, commission, platformFeeRate, platformFee, levy: lv, hmoMarginRate, hmoMargin, net };
}

// 'YYYY-MM' billing cycle in WAT (UTC+1), so period boundaries match Nigeria.
export function billingPeriod(d: Date): string {
  const wat = new Date(d.getTime() + 60 * 60 * 1000);
  return `${wat.getUTCFullYear()}-${String(wat.getUTCMonth() + 1).padStart(2, '0')}`;
}
