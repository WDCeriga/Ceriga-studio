import type { CompleteManufacturerProfile } from './manufacturerOnboardingTypes';

type MoqSettings = Pick<CompleteManufacturerProfile, 'garmentMoqOverrides' | 'confirmedGarmentMoqOverrides'>;

/** Retire the old seeded values without removing newly entered custom MOQs. */
export function garmentMoqOverridesForProfile(profile: MoqSettings): Record<string, number> {
  const overrides = { ...profile.garmentMoqOverrides };
  for (const garment of ['Hoodies', 'Sweatshirts', 'T-shirts']) {
    if (!profile.confirmedGarmentMoqOverrides?.includes(garment)) delete overrides[garment];
  }
  return overrides;
}
