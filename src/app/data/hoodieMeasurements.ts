import { hoodieNeckline, hoodiePositionOption } from './hoodieNecklines';
import { GARMENT_SIZES, type MeasurementValues } from '../lib/measurementGrading';
import type { GarmentAssetSelection } from './garmentSvgCatalog';
import { hoodieFitBlock } from './regularHoodie';

function grade(medium: number, step: number) {
  return Object.fromEntries(GARMENT_SIZES.map((size, index) => [size, String(medium + (index - 2) * step)]));
}

export function hoodieMeasurementPresets(selection: GarmentAssetSelection): MeasurementValues {
  const [chest, length, hem, sleeve, shoulder, armhole, cuff] =
    hoodieFitBlock(selection.hoodieFit).measurements;
  const crewneck = selection.hoodieStyle === 'crewneck';
  const [position] = hoodiePositionOption(selection.hoodiePosition, selection.hoodieProfile);
  const hoodHeight = position === 'relaxed' ? 29 : 34;
  const neckline = hoodieNeckline(selection.hoodieNeckline);
  const dropped = selection.hoodieSleeve === 'sleeveless' || selection.hoodieShoulder === 'drop-shoulder';
  const measurements = {
    halfLength: grade(length, 2),
    chestWidth: grade(chest, 3),
    bottomWidth: grade(hem, 3),
    sleeveLength: grade((selection.hoodieSleeve === 'extended-short' ? Math.round(sleeve * .53) : sleeve)
      + (dropped ? -3 : 0) + (selection.hoodieSleeve === 'extended-long' ? 2 : 0), 1),
    shoulderWidth: grade(shoulder + (dropped ? 5 : 0), 2),
    armhole: grade(armhole + (dropped ? -2 : 0), 1),
    sleeveOpening: grade(cuff + (selection.hoodieSleeve === 'extended-short' ? 10 : selection.hoodieSleeve === 'flared' ? 6
      : selection.hoodieSleeve === 'tapered' ? -2 : 0), .5),
    neckOpening: grade(crewneck ? (neckline.asset ? 25 : 19) : 22, .5),
    neckDrop: grade(crewneck ? Math.round((neckline.depth - 605) / 12) : 5, .25),
  };
  return {
    ...measurements,
    ...(crewneck ? {} : { hoodHeight: grade(hoodHeight, .5) }),
  };
}
