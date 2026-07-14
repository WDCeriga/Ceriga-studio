/** Manufacturer user id → plan id. Kept separate to avoid circular imports. */

const planByUserId: Record<string, string> = {};

export function setManufacturerPlan(userId: string, planId: string | undefined): void {
  if (planId) {
    planByUserId[userId] = planId;
  } else {
    delete planByUserId[userId];
  }
}

export function getManufacturerPlan(userId: string): string | undefined {
  return planByUserId[userId];
}

export function seedManufacturerPlans(entries: Record<string, string>): void {
  for (const [userId, planId] of Object.entries(entries)) {
    planByUserId[userId] = planId;
  }
}
