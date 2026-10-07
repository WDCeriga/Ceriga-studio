import type { BuilderGarmentPreviewProps } from '../components/builder/BuilderGarmentPreview';
import type { FabricPart } from './garmentFabrics';

export type SchematicFabricProps = Pick<BuilderGarmentPreviewProps,
  'garmentType' | 'neckType' | 'sleeveType' | 'sleeveLength' | 'hemType' | 'cuffType' | 'pocketType' | 'zipType'>;

/** Mirrors only filled surfaces in the fallback schematic, not specification-only ink. */
export function schematicFabricParts(props: SchematicFabricProps): FabricPart[] {
  const parts: FabricPart[] = [{ id: 'base', label: 'Body', role: 'body' }];
  const isTop = ['tshirt', 'hoodie', 'sweatshirt', 'jacket', 'dress'].includes(props.garmentType);
  if (isTop) {
    if (props.sleeveType !== 'sleeveless') {
      parts.push(
        { id: 'sleeveLeft', label: 'Left sleeve', role: 'sleeve', group: 'sleeves' },
        { id: 'sleeveRight', label: 'Right sleeve', role: 'sleeve', group: 'sleeves' },
      );
      if (props.cuffType !== 'raw' && props.cuffType !== 'elasticated') {
        parts.push(
          { id: 'sleeveHemLeft', label: 'Left cuff / sleeve hem', role: 'cuff', group: 'cuffs', materialCategory: props.cuffType === 'ribbed' ? 'cuffs' : 'sleeves' },
                    { id: 'sleeveHemRight', label: 'Right cuff / sleeve hem', role: 'cuff', group: 'cuffs', materialCategory: props.cuffType === 'ribbed' ? 'cuffs' : 'sleeves' },
        );
      }
    }
    if (props.garmentType === 'hoodie') {
      parts.push({ id: 'hood', label: 'Hood', role: 'hood' });
      if (props.neckType !== 'fullzip' && props.neckType !== 'halfzip') {
        parts.push({ id: 'hoodInterior', label: 'Hood interior', role: 'hood', interior: true, surface: 'reverse', exteriorPartId: 'hood' });
      }
    } else {
      parts.push({ id: 'neck', label: 'Neck / collar', role: 'neck' });
    }
  } else {
    parts.push({ id: 'waistband', label: 'Waistband', role: 'waistband' });
  }
  if (props.hemType === 'ribbed') parts.push({ id: 'hem', label: 'Hem band', role: 'hem' });
  // Every current PocketLayer variant is unfilled construction ink; none is a fabric panel.
  return parts;
}
