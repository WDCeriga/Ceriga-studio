import { isSupabaseConfigured } from '../lib/supabaseClient';
import { completeFactoryOnboarding } from './manufacturerPortalMock';
import {
  saveMyManufacturerProfile,
  type ManufacturerProfile,
} from './manufacturerDb';

/**
 * Persist factory onboarding to Supabase when configured; always fall back to
 * the local demo workspace so the preview stays functional without env keys.
 */
export async function completeOnboardingInDb(input: {
  factoryName: string;
  garments: string[];
  capabilities: string[];
  shippingRegions: string[];
  moq: number;
  monthlyCapacity: number;
}): Promise<ManufacturerProfile | null> {
  // Keep the local workspace in sync either way (layout uses it as fallback).
  completeFactoryOnboarding({
    garments: input.garments as never[],
    capabilities: input.capabilities as never[],
    shippingRegions: input.shippingRegions,
    moq: input.moq,
    monthlyCapacity: input.monthlyCapacity,
  });

  if (!isSupabaseConfigured) return null;

  return saveMyManufacturerProfile({
    factoryName: input.factoryName,
    garments: input.garments,
    capabilities: input.capabilities,
    shippingRegions: input.shippingRegions,
    moq: input.moq,
    monthlyCapacity: input.monthlyCapacity,
    onboardingComplete: true,
  });
}
