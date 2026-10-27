import { CAPABILITY_GROUPS, type CapabilityCategory, type CapabilityDefinition, type CompleteManufacturerProfile, type CustomMethodMoq } from './manufacturerOnboardingTypes';

export const normalizeCapabilityName = (name: string) => name.normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const standardDefinitions: CapabilityDefinition[] = CAPABILITY_GROUPS.flatMap(group => group.items.map(name => ({
  id: `standard:${group.category}:${encodeURIComponent(normalizeCapabilityName(name))}`,
  name, category: group.category, custom: false,
})));

export const METHOD_CATEGORIES = [
  ...CAPABILITY_GROUPS.map(group => ({ id: group.category, label: group.title.replace(/^[A-Z]\.\s*/, '') })),
  { id: 'custom' as const, label: 'Other custom methods' },
];

type CapabilityProfile = Pick<CompleteManufacturerProfile, 'capabilitiesMap' | 'customCapabilities' | 'capabilityCatalog' | 'customMethodMoqs'>;

export function getCapabilityCatalog(profile: CapabilityProfile): CapabilityDefinition[] {
  const definitions = new Map(standardDefinitions.map(definition => [normalizeCapabilityName(definition.name), definition]));
  // Persisted custom IDs survive category changes and selection toggles.
  for (const definition of profile.capabilityCatalog ?? []) {
    const key = normalizeCapabilityName(definition.name);
    if (!definitions.has(key)) definitions.set(key, definition);
  }
  for (const name of [...Object.keys(profile.capabilitiesMap ?? {}), ...(profile.customCapabilities ?? [])]) {
    const key = normalizeCapabilityName(name);
    if (key && !definitions.has(key)) definitions.set(key, {
      id: `custom:${encodeURIComponent(key)}`, name: name.trim(), category: 'custom', custom: true,
    });
  }
  return [...definitions.values()];
}

export function getSelectedMethods(profile: CapabilityProfile): CapabilityDefinition[] {
  const selected = new Set(Object.entries(profile.capabilitiesMap ?? {}).filter(([, source]) => source === 'in_house' || source === 'outsourced').map(([name]) => normalizeCapabilityName(name)));
  return getCapabilityCatalog(profile).filter(definition => selected.has(normalizeCapabilityName(definition.name)));
}

export function resolveConstraintMethod(constraint: CustomMethodMoq, catalog: CapabilityDefinition[]): CapabilityDefinition | undefined {
  // An existing identifier is authoritative; never silently rebind by label.
  return constraint.capabilityId ? catalog.find(definition => definition.id === constraint.capabilityId)
    : catalog.find(definition => normalizeCapabilityName(definition.name) === normalizeCapabilityName(constraint.method));
}

export function linkLegacyMethodConstraints(profile: CapabilityProfile): CustomMethodMoq[] {
  const catalog = getCapabilityCatalog(profile);
  return (profile.customMethodMoqs ?? []).map(constraint => {
    const definition = resolveConstraintMethod(constraint, catalog);
    return !constraint.capabilityId && definition ? { ...constraint, capabilityId: definition.id } : constraint;
  });
}

export function isValidMethodMoq(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function getActiveMethodConstraints(profile: CapabilityProfile): CustomMethodMoq[] {
  const catalog = getCapabilityCatalog(profile), selected = new Set(getSelectedMethods(profile).map(definition => definition.id));
  const active = new Map<string, CustomMethodMoq>();
  for (const constraint of profile.customMethodMoqs ?? []) {
    const definition = resolveConstraintMethod(constraint, catalog);
    if (!definition || !selected.has(definition.id) || !isValidMethodMoq(constraint.moq)) continue;
    const previous = active.get(definition.id);
    // Preserve legacy duplicates in storage, but use the strictest MOQ safely.
    if (!previous || constraint.moq > previous.moq) active.set(definition.id, { ...constraint, capabilityId: definition.id });
  }
  return [...active.values()];
}

export function addCustomCapabilityDefinition(profile: CapabilityProfile, name: string, category: CapabilityCategory) {
  const catalog = getCapabilityCatalog(profile), key = normalizeCapabilityName(name);
  const existing = catalog.find(definition => normalizeCapabilityName(definition.name) === key);
  const definition = existing ?? { id: `custom:${crypto.randomUUID()}`, name: name.trim(), category, custom: true };
  return { definition, catalog: existing ? catalog : [...catalog, definition] };
}
