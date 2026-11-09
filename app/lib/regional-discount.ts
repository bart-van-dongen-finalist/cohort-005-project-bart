// ─── Regional discount ───
// Hardcoded discount levels and the country-to-level mapping.
// A country's level sets the discount percentage applied at purchase time.

export const REGIONAL_DISCOUNTS = {
  1: { discount: 0, label: "Full price" },
  2: { discount: 0.3, label: "30% off" },
  3: { discount: 0.5, label: "50% off" },
  4: { discount: 0.7, label: "70% off" },
} as const;

export type RegionalDiscountLevel = keyof typeof REGIONAL_DISCOUNTS;

const COUNTRY_DISCOUNT_LEVELS: Record<string, RegionalDiscountLevel> = {
  // Level 1 — Full price
  US: 1, CA: 1, GB: 1, AU: 1, DE: 1, FR: 1, NL: 1, SE: 1, NO: 1, CH: 1, JP: 1, SG: 1,
  // Level 2 — 30% off
  PL: 2, MX: 2, BR: 2, TR: 2, TH: 2, MY: 2, CZ: 2, CL: 2,
  // Level 3 — 50% off
  IN: 3, CO: 3, AR: 3, ZA: 3, PH: 3, VN: 3, UA: 3, ID: 3,
  // Level 4 — 70% off
  NG: 4, PK: 4, BD: 4, EG: 4, KE: 4, ET: 4,
};

export function getRegionalDiscountLevel(countryCode: string | null): RegionalDiscountLevel {
  if (!countryCode) return 1;
  return COUNTRY_DISCOUNT_LEVELS[countryCode.toUpperCase()] ?? 1;
}

export function getDiscountForCountry(countryCode: string | null): number {
  const level = getRegionalDiscountLevel(countryCode);
  return REGIONAL_DISCOUNTS[level].discount;
}

export function calculateRegionalPrice(priceInCents: number, countryCode: string | null): number {
  const discount = getDiscountForCountry(countryCode);
  return Math.round(priceInCents * (1 - discount));
}

export function getDiscountLevelInfo(countryCode: string | null) {
  const level = getRegionalDiscountLevel(countryCode);
  const { discount, label } = REGIONAL_DISCOUNTS[level];
  return { level, discount, label };
}

/**
 * Pure function to check if a Regional discount blocks access.
 * Returns blocked=true when a discounted purchase is accessed from a different country.
 */
export function checkRegionalDiscountAccess(
  coursePrice: number,
  regionalDiscountEnabled: boolean,
  purchaseCountry: string | null,
  currentCountry: string | null
): { blocked: boolean; blockedCountry: string | null; purchaseCountry: string | null } {
  const result = { blocked: false, blockedCountry: null as string | null, purchaseCountry: null as string | null };

  // Skip: free courses or courses without a Regional discount
  if (coursePrice <= 0 || !regionalDiscountEnabled) return result;

  // Skip: no purchase country recorded
  if (!purchaseCountry) return result;

  // Skip: full-price (level 1) purchases — no geographic restriction
  const purchaseLevel = getRegionalDiscountLevel(purchaseCountry);
  if (purchaseLevel === 1) return result;

  // Discounted purchase — verify country match
  if (currentCountry && currentCountry !== purchaseCountry) {
    result.blocked = true;
    result.blockedCountry = currentCountry;
    result.purchaseCountry = purchaseCountry;
  }

  return result;
}

/**
 * A country code as a name, falling back to the code itself.
 *
 * A purchase can carry a code this list has never heard of — the code is
 * recorded at purchase time and the list is hardcoded here — and showing the
 * raw code beats showing nothing.
 */
export function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

// All countries with their names, for the dev UI dropdown
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },
  { code: "BD", name: "Bangladesh" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CZ", name: "Czech Republic" },
  { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
];
