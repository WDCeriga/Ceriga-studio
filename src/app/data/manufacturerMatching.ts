import type { CompleteManufacturerProfile, GarmentCategory } from './manufacturerOnboardingTypes';

export type BrandOrderMatchingCriteria = {
  garmentCategory: GarmentCategory;
  quantity: number;
  maxLeadTimeDays?: number;
  deliveryCountry?: string;
  minGsm?: number;
  maxGsm?: number;
  requiredCapabilities?: string[];
  requiresInHouseOnly?: boolean;
};

export type MatchResult = {
  matched: boolean;
  score: number; // 0 - 100
  reasons: string[];
  warnings: string[];
  disqualifiers: string[];
};

/**
 * High-precision matching evaluation between a Brand Order Spec and a Manufacturer's Onboarded Profile
 */
export function evaluateManufacturerMatch(
  profile: CompleteManufacturerProfile,
  order: BrandOrderMatchingCriteria,
): MatchResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const disqualifiers: string[] = [];
  let score = 100;

  // 1. Garment Category Check
  if (!profile.garments.includes(order.garmentCategory)) {
    disqualifiers.push(`Manufacturer does not produce ${order.garmentCategory}.`);
    score -= 40;
  } else {
    reasons.push(`Produces ${order.garmentCategory}.`);
  }

  // 2. Minimum Order Quantity (MOQ) Check
  const effectiveMoq =
    profile.garmentMoqOverrides?.[order.garmentCategory] ?? profile.generalMoq;
  if (order.quantity < effectiveMoq) {
    disqualifiers.push(
      `Order quantity (${order.quantity}) is below factory MOQ (${effectiveMoq} units for ${order.garmentCategory}).`,
    );
    score -= 30;
  } else {
    reasons.push(`Order quantity meets factory MOQ (${effectiveMoq} units).`);
  }

  // 3. Max Quantity / Capacity Check
  if (profile.maxSingleOrderQuantity && order.quantity > profile.maxSingleOrderQuantity) {
    disqualifiers.push(
      `Order quantity exceeds factory single-order ceiling (${profile.maxSingleOrderQuantity} units).`,
    );
    score -= 25;
  }
  if (
    profile.currentAvailableMonthlyCapacity &&
    order.quantity > profile.currentAvailableMonthlyCapacity
  ) {
    warnings.push(
      `Order size (${order.quantity}) is larger than currently available monthly capacity (${profile.currentAvailableMonthlyCapacity} units). May require split scheduling.`,
    );
    score -= 15;
  }

  // 4. GSM Weight Check
  const detail = profile.garmentDetails?.[order.garmentCategory];
  if (detail) {
    if (order.minGsm && detail.maxGsm && order.minGsm > detail.maxGsm) {
      warnings.push(
        `Desired fabric weight (${order.minGsm} GSM) exceeds factory usual ceiling for ${order.garmentCategory} (${detail.maxGsm} GSM).`,
      );
      score -= 10;
    }
    if (order.maxGsm && detail.minGsm && order.maxGsm < detail.minGsm) {
      warnings.push(
        `Desired fabric weight (${order.maxGsm} GSM) is lighter than factory minimum (${detail.minGsm} GSM).`,
      );
      score -= 10;
    }
  }

  // 5. Capabilities Check
  if (order.requiredCapabilities && order.requiredCapabilities.length > 0) {
    for (const cap of order.requiredCapabilities) {
      const source = profile.capabilitiesMap?.[cap];
      if (!source) {
        disqualifiers.push(`Missing required technique: "${cap}".`);
        score -= 20;
      } else if (order.requiresInHouseOnly && source === 'outsourced') {
        warnings.push(`Technique "${cap}" is outsourced to partner, not in-house.`);
        score -= 10;
      } else {
        reasons.push(`Supports "${cap}" (${source === 'in_house' ? 'In-house' : 'Outsourced partner'}).`);
      }
    }
  }

  // 6. Lead Time Check
  if (order.maxLeadTimeDays && profile.bulkLeadTimeMinDays) {
    if (profile.bulkLeadTimeMinDays > order.maxLeadTimeDays) {
      warnings.push(
        `Factory bulk lead time (${profile.bulkLeadTimeMinDays} days) exceeds requested timeline (${order.maxLeadTimeDays} days).`,
      );
      score -= 15;
    }
  }

  // 7. Shipping Destination Check
  if (order.deliveryCountry) {
    const shipsWorldwide = profile.shippingDestinations.some(
      (d) => d.toLowerCase() === 'worldwide',
    );
    const shipsDirect = profile.shippingDestinations.some(
      (d) =>
        d.toLowerCase() === order.deliveryCountry?.toLowerCase() ||
        (order.deliveryCountry === 'UK' && d === 'United Kingdom') ||
        (order.deliveryCountry === 'US' && d === 'United States'),
    );
    if (!shipsWorldwide && !shipsDirect) {
      warnings.push(
        `Destination country (${order.deliveryCountry}) is not in factory standard shipping regions. Freight forwarding may be required.`,
      );
      score -= 10;
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const matched = disqualifiers.length === 0 && finalScore >= 50;

  return {
    matched,
    score: finalScore,
    reasons,
    warnings,
    disqualifiers,
  };
}
