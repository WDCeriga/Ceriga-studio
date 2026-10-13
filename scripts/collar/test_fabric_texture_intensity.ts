import {
  DEFAULT_FABRIC_TEXTURE_INTENSITY, clampFabricTextureIntensity, garmentTextureIntensity,
  partTextureIntensity, resetFabricTextureIntensity, setGarmentTextureIntensity, setPartTextureIntensity,
} from '../../src/app/data/fabricTextureIntensity';
import { check } from './test_garment_fabrics';

export function verifyFabricTextureIntensity() {
  const defaults = resetFabricTextureIntensity();
  check(DEFAULT_FABRIC_TEXTURE_INTENSITY === 40 && garmentTextureIntensity() === 40, 'Texture intensity default is not 40%');
  check(garmentTextureIntensity(defaults) === 40 && partTextureIntensity(defaults, 'base') === 40, 'Default part inheritance failed');
  check(clampFabricTextureIntensity(-1) === 0 && clampFabricTextureIntensity(101) === 100 && clampFabricTextureIntensity(Number.NaN) === 40, 'Texture intensity range validation failed');
  const garment = setGarmentTextureIntensity(defaults, 70);
  check(garmentTextureIntensity(garment) === 70 && partTextureIntensity(garment, 'base') === 70, 'Garment intensity inheritance failed');
  const overridden = setPartTextureIntensity(garment, 'neck', 55);
  check(partTextureIntensity(overridden, 'neck') === 55 && partTextureIntensity(overridden, 'base') === 70, 'Part override leaked to other parts');
  check(garmentTextureIntensity(setGarmentTextureIntensity(overridden, 25)) === 25 && partTextureIntensity(setGarmentTextureIntensity(overridden, 25), 'neck') === 55, 'Garment change discarded part override');
  const inherited = setPartTextureIntensity(overridden, 'neck', undefined);
  check(!inherited.parts?.neck && partTextureIntensity(inherited, 'neck') === 70, 'Cleared part override failed to inherit');
  check(garmentTextureIntensity(resetFabricTextureIntensity()) === 40 && Object.keys(resetFabricTextureIntensity().parts ?? {}).length === 0, 'Reset did not restore 40% and clear overrides');
  check(partTextureIntensity(setPartTextureIntensity(defaults, 'base', 100), 'base') === 100, 'Maximum part override failed');
  return { checks: 8 };
}
