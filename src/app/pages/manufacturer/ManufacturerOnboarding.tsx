import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Factory, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_FACTORY_CAPABILITIES,
  ALL_FACTORY_GARMENTS,
  completeFactoryOnboarding,
  getFactoryWorkspace,
  type FactoryCapability,
  type FactoryGarment,
} from '../../data/manufacturerPortalMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';

export function ManufacturerOnboarding() {
  const navigate = useNavigate();
  const seed = getFactoryWorkspace();
  const [step, setStep] = useState(0);
  const [garments, setGarments] = useState<FactoryGarment[]>(seed.garments);
  const [capabilities, setCapabilities] = useState<FactoryCapability[]>(seed.capabilities);
  const [regions, setRegions] = useState(seed.shippingRegions.join(', '));
  const [moq, setMoq] = useState(String(seed.moq));
  const [capacity, setCapacity] = useState(String(seed.monthlyCapacity));
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  const toggleGarment = (g: FactoryGarment) => {
    setGarments((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };
  const toggleCapability = (c: FactoryCapability) => {
    setCapabilities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const requestFinish = () => {
    if (garments.length === 0) {
      toast.error('Select at least one garment type');
      return;
    }
    if (capabilities.length === 0) {
      toast.error('Select at least one capability');
      return;
    }
    setFinishConfirmOpen(true);
  };

  const finish = () => {
    completeFactoryOnboarding({
      garments,
      capabilities,
      shippingRegions: regions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      moq: Number(moq) || 50,
      monthlyCapacity: Number(capacity) || 1000,
    });
    toast.success('Factory profile ready — welcome to your inbox');
    navigate('/manufacturer');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Onboarding</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Set up {seed.factoryName}
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Tell Ceriga what you can produce so we can auto-route matching brand orders to your
          inbox.
        </p>
      </div>

      <div className="flex gap-2">
        {['Clothes', 'Capabilities', 'Capacity'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[11px] font-medium transition',
              step === i
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                : 'border-white/10 text-white/40 hover:text-white/70',
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-[#CC2D24]" />
            <h2 className="text-sm font-semibold text-white">What clothes can you produce?</h2>
          </div>
          <p className="mt-1 text-[12px] text-white/40">
            This powers automatic order matching from Ceriga.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ALL_FACTORY_GARMENTS.map((g) => {
              const on = garments.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGarment(g)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[12px] font-medium transition',
                    on
                      ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-red-100'
                      : 'border-white/10 bg-white/[0.02] text-white/45 hover:text-white/75',
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <Button
            className="mt-6 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
            onClick={() => setStep(1)}
          >
            Continue
          </Button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">What can you do on garments?</h2>
          <p className="mt-1 text-[12px] text-white/40">
            Embroidery, fading, print methods, and finishing — used for matching specialities.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ALL_FACTORY_CAPABILITIES.map((c) => {
              const on = capabilities.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCapability(c)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[12px] font-medium transition',
                    on
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                      : 'border-white/10 bg-white/[0.02] text-white/45 hover:text-white/75',
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white/5"
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Capacity & shipping</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-white/45">MOQ (units)</Label>
              <Input
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                className="mt-1.5 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-white/45">Monthly capacity (units)</Label>
              <Input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="mt-1.5 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-white/45">Shipping regions (comma-separated)</Label>
              <Input
                value={regions}
                onChange={(e) => setRegions(e.target.value)}
                className="mt-1.5 border-white/15 bg-white/5 text-white"
                placeholder="UK, EU, US"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white/5"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90" onClick={requestFinish}>
              Enter factory portal
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={finishConfirmOpen}
        onOpenChange={setFinishConfirmOpen}
        title="Finish factory setup?"
        description={`Confirm ${garments.length} garment type${garments.length === 1 ? '' : 's'} and ${capabilities.length} capacit${capabilities.length === 1 ? 'y' : 'ies'} for order matching.`}
        confirmLabel="Enter portal"
        onConfirm={finish}
      />
    </div>
  );
}
