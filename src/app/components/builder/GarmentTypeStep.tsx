import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Label } from '../ui/label';

interface GarmentTypeOption {
  id: string;
  name: string;
}

const garmentTypes: GarmentTypeOption[] = [
  { id: 'tshirt', name: 'T-Shirt' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'sweatshirt', name: 'Sweatshirt' },
  { id: 'trousers', name: 'Trousers' },
  { id: 'shorts', name: 'Shorts' },
  { id: 'jacket', name: 'Jacket' },
  { id: 'dress', name: 'Dress' },
  { id: 'skirt', name: 'Skirt' }
];

interface GarmentTypeStepProps {
  garmentType: string;
  onGarmentTypeChange: (type: string) => void;
}

export function GarmentTypeStep({ garmentType, onGarmentTypeChange }: GarmentTypeStepProps) {
  useCerigaTranslation();

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-3 block text-white/60 text-xs uppercase tracking-wider">{cerigaTranslate("interface.text_dbfcdb2d0e9b5f72")}</Label>
        <div className="grid grid-cols-2 gap-3">
          {garmentTypes.map((option) => (
            <button
              key={option.id}
              onClick={() => onGarmentTypeChange(option.id)}
              className={`p-4 border-2 rounded-xl text-center transition-all ${
                garmentType === option.id
                  ? 'border-[#CC2D24] bg-[#CC2D24]/10 text-white'
                  : 'border-[#252528] hover:border-white/30 text-white/60 hover:text-white bg-white/5'
              }`}
            >
              <div className="font-semibold">{cerigaTranslateLabel(option.name)}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 bg-white/5 border border-[#252528] rounded-xl">
        <div className="text-white/60 text-xs uppercase tracking-wider mb-2">{cerigaTranslate("interface.text_991cc279d57acd3f")}</div>
        <div className="text-xl font-bold text-white capitalize">
          {garmentTypes.find(g => g.id === garmentType)?.name || cerigaTranslate("interface.text_df12aeba9bb9f9b0")}
        </div>
      </div>
    </div>
  );
}
