import { useState } from 'react';
import {
  ImagePlus,
  Plus,
  Trash2,
  Edit3,
  Shirt,
  Sparkles,
  Layers,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';
import {
  loadCompleteManufacturerProfile,
  saveCompleteManufacturerProfile,
} from '../../data/manufacturerOnboardingStore';
import {
  ALL_GARMENT_CATEGORIES,
  type GarmentCategory,
  type PortfolioItem,
} from '../../data/manufacturerOnboardingTypes';

export function ManufacturerPortfolio() {
  const [profile, setProfile] = useState(() => loadCompleteManufacturerProfile());
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(profile.portfolio || []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);

  // Form Fields
  const [productName, setProductName] = useState('');
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>('Hoodies');
  const [materials, setMaterials] = useState('');
  const [gsm, setGsm] = useState('');
  const [productionMethods, setProductionMethods] = useState('');
  const [customisationTechniques, setCustomisationTechniques] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const openCreateDialog = () => {
    setEditingItem(null);
    setProductName('');
    setGarmentCategory('Hoodies');
    setMaterials('100% Organic French Terry');
    setGsm('420');
    setProductionMethods('Cut and sew, Flatlock stitch');
    setCustomisationTechniques('Screen print, Woven neck label');
    setDescription('Heavyweight oversized hoodie with double-layered hood and drop shoulders.');
    setImageUrl('https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&fit=crop');
    setDialogOpen(true);
  };

  const openEditDialog = (item: PortfolioItem) => {
    setEditingItem(item);
    setProductName(item.productName);
    setGarmentCategory(item.garmentCategory);
    setMaterials(item.materials);
    setGsm(item.gsm ? String(item.gsm) : '');
    setProductionMethods(item.productionMethods.join(', '));
    setCustomisationTechniques(item.customisationTechniques?.join(', ') || '');
    setDescription(item.description);
    setImageUrl(item.images[0] || '');
    setDialogOpen(true);
  };

  const handleSaveItem = () => {
    if (!productName.trim()) {
      toast.error('Product name is required');
      return;
    }

    const newItem: PortfolioItem = {
      id: editingItem?.id || `pf-${Date.now()}`,
      productName: productName.trim(),
      garmentCategory,
      materials: materials.trim(),
      gsm: Number(gsm) || undefined,
      productionMethods: productionMethods
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      customisationTechniques: customisationTechniques
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      description: description.trim(),
      images: imageUrl.trim() ? [imageUrl.trim()] : [],
      createdAt: editingItem?.createdAt || new Date().toISOString().slice(0, 10),
    };

    let nextPortfolio: PortfolioItem[];
    if (editingItem) {
      nextPortfolio = portfolio.map((p) => (p.id === editingItem.id ? newItem : p));
      toast.success('Portfolio item updated');
    } else {
      nextPortfolio = [newItem, ...portfolio];
      toast.success('New production example added');
    }

    setPortfolio(nextPortfolio);
    const nextProfile = { ...profile, portfolio: nextPortfolio };
    setProfile(nextProfile);
    saveCompleteManufacturerProfile(nextProfile);
    setDialogOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    const nextPortfolio = portfolio.filter((p) => p.id !== id);
    setPortfolio(nextPortfolio);
    const nextProfile = { ...profile, portfolio: nextPortfolio };
    setProfile(nextProfile);
    saveCompleteManufacturerProfile(nextProfile);
    toast.message('Portfolio item removed');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <ImagePlus className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Factory Showcase
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Production Portfolio
          </h1>
          <p className="mt-1 text-sm text-white/45 max-w-2xl">
            Upload garments you have manufactured. Demonstrating real stitch quality, GSM weights, and print fidelity significantly improves matching confidence with streetwear and fashion brands.
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-4 font-semibold"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Garment Sample
        </Button>
      </div>

      {/* Portfolio Grid */}
      {portfolio.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#252528] bg-[#111113] p-12 text-center">
          <Shirt className="h-10 w-10 text-white/20 mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-white">No Portfolio Samples Yet</h3>
          <p className="mt-1 text-xs text-white/40 max-w-md mx-auto">
            Add sample images of past cuts, fabric weights, or specialty prints to enrich your matching profile.
          </p>
          <Button
            onClick={openCreateDialog}
            className="mt-5 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add First Garment
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[#252528] bg-[#111113] overflow-hidden flex flex-col group transition hover:border-white/20"
            >
              {/* Image Preview Container */}
              <div className="relative h-48 w-full bg-black/40 overflow-hidden">
                {item.images[0] ? (
                  <img
                    src={item.images[0]}
                    alt={item.productName}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white/20">
                    <Shirt className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white border border-white/10">
                  {item.garmentCategory}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{item.productName}</h3>
                  <p className="mt-1 text-xs text-white/50 line-clamp-2">{item.description}</p>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#252528] text-xs">
                  <div className="flex justify-between text-white/60">
                    <span>Fabric:</span>
                    <span className="font-medium text-white">{item.materials}</span>
                  </div>
                  {item.gsm && (
                    <div className="flex justify-between text-white/60">
                      <span>Weight:</span>
                      <span className="font-medium text-white">{item.gsm} GSM</span>
                    </div>
                  )}

                  {/* Technique Tags */}
                  {item.productionMethods.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {item.productionMethods.map((m) => (
                        <span
                          key={m}
                          className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252528]">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(item)}
                    className="h-8 text-xs text-white/60 hover:text-white"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[#252528] bg-[#161618] p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#252528] pb-4">
              <h3 className="text-base font-semibold text-white">
                {editingItem ? 'Edit Garment Sample' : 'Add Production Sample'}
              </h3>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <Label className="text-white/80">Product / Garment Name *</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Heavyweight Pullover Hoodie (Sample #12)"
                  className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/80">Garment Category</Label>
                  <select
                    value={garmentCategory}
                    onChange={(e) => setGarmentCategory(e.target.value as GarmentCategory)}
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-[#1e1e22] px-3 text-xs text-white focus:outline-none"
                  >
                    {ALL_GARMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-white/80">Fabric Weight (GSM)</Label>
                  <Input
                    type="number"
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    placeholder="e.g. 420"
                    className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white/80">Fabric & Composition</Label>
                <Input
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="e.g. 100% Organic French Terry Cotton"
                  className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                />
              </div>

              <div>
                <Label className="text-white/80">Production Methods (comma-separated)</Label>
                <Input
                  value={productionMethods}
                  onChange={(e) => setProductionMethods(e.target.value)}
                  placeholder="e.g. Cut and sew, 5-thread overlock, Ribbed cuffs"
                  className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                />
              </div>

              <div>
                <Label className="text-white/80">Customisation Techniques</Label>
                <Input
                  value={customisationTechniques}
                  onChange={(e) => setCustomisationTechniques(e.target.value)}
                  placeholder="e.g. 3D Puff Embroidery, Screen Print, Acid wash"
                  className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                />
              </div>

              <div>
                <Label className="text-white/80">Sample Image URL</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                />
              </div>

              <div>
                <Label className="text-white/80">Description & Construction Notes</Label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specify stitch tension, shrinkage testing, wash feel, etc."
                  className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#252528]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs border-white/15 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveItem}
                className="text-xs bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 font-semibold"
              >
                Save Garment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
