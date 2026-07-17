import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../components/ui/utils';
import type { OrderQuantityPlan } from '../data/orderQuantities';
import { createOrderFromSubmit } from '../data/userOrders';

const fieldClass =
  'h-10 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:border-[#CC2D24] focus-visible:ring-[#CC2D24]/25';

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{title}</h2>
      {children}
    </section>
  );
}

export default function Delivery() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const st = location.state as { productId?: string; from?: string } | undefined;
    const productId = st?.productId;
    if (st?.from === 'manufacturer') {
      navigate(
        productId
          ? `/studio/manufacturer?productId=${encodeURIComponent(productId)}`
          : '/studio/manufacturer',
      );
      return;
    }
    if (st?.from === 'packaging') {
      navigate('/packaging');
      return;
    }
    if (productId) {
      navigate(`/builder/${productId}`, { state: { currentStep: 13 } });
      return;
    }
    window.history.back();
  };

  const handleSubmitOrder = () => {
    const st = location.state as {
      productId?: string;
      productName?: string;
      garmentType?: string;
      orderQuantities?: OrderQuantityPlan;
    } | undefined;

    const isTechPack = st?.orderQuantities?.mode === 'techpack';
    const order = createOrderFromSubmit({
      productId: st?.productId,
      productName: st?.productName,
      garmentType: st?.garmentType,
      kind: isTechPack ? 'tech-pack' : 'production',
      orderQuantities: st?.orderQuantities,
    });
    navigate(`/orders/${order.id}`);
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F] text-white">
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8 md:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <header className="mb-6">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
            Checkout
          </p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-white sm:text-[1.65rem]">
            Delivery
          </h1>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/50 sm:text-sm">
            Enter where we should send your order and how to reach you.
          </p>
        </header>

        <div className="space-y-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <Section title="Contact information">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="mb-1.5 text-xs text-white/55">
                  First name
                </Label>
                <Input id="firstName" className={fieldClass} placeholder="Enter first name" />
              </div>
              <div>
                <Label htmlFor="lastName" className="mb-1.5 text-xs text-white/55">
                  Last name
                </Label>
                <Input id="lastName" className={fieldClass} placeholder="Enter last name" />
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 text-xs text-white/55">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  className={fieldClass}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="mb-1.5 text-xs text-white/55">
                  Phone
                </Label>
                <Input id="phone" type="tel" className={fieldClass} placeholder="+44 123 456 7890" />
              </div>
            </div>
          </Section>

          <div className="border-t border-white/10" />

          <Section title="Shipping address">
            <div className="space-y-3">
              <div>
                <Label htmlFor="address1" className="mb-1.5 text-xs text-white/55">
                  Address line 1
                </Label>
                <Input id="address1" className={fieldClass} placeholder="Street address" />
              </div>
              <div>
                <Label htmlFor="address2" className="mb-1.5 text-xs text-white/55">
                  Address line 2 <span className="text-white/30">(optional)</span>
                </Label>
                <Input id="address2" className={fieldClass} placeholder="Apartment, suite, etc." />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="city" className="mb-1.5 text-xs text-white/55">
                    City
                  </Label>
                  <Input id="city" className={fieldClass} placeholder="City" />
                </div>
                <div>
                  <Label htmlFor="postcode" className="mb-1.5 text-xs text-white/55">
                    Postcode
                  </Label>
                  <Input id="postcode" className={fieldClass} placeholder="Postcode" />
                </div>
                <div>
                  <Label htmlFor="country" className="mb-1.5 text-xs text-white/55">
                    Country
                  </Label>
                  <select
                    id="country"
                    className="flex h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-[#CC2D24] focus:outline-none focus:ring-2 focus:ring-[#CC2D24]/25"
                  >
                    <option value="UK">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="EU">European Union</option>
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <div className="border-t border-white/10" />

          <Section title="Special instructions">
            <div>
              <Label htmlFor="instructions" className="mb-1.5 text-xs text-white/55">
                Notes <span className="text-white/30">(optional)</span>
              </Label>
              <Textarea
                id="instructions"
                className="min-h-[88px] resize-none border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:border-[#CC2D24] focus-visible:ring-[#CC2D24]/25"
                placeholder="Add any special delivery instructions..."
              />
            </div>
          </Section>

          <div className="border-t border-white/10 pt-2">
            <Button
              type="button"
              onClick={handleSubmitOrder}
              className="h-11 w-full rounded-lg bg-[#CC2D24] text-sm font-semibold text-white hover:bg-[#CC2D24]/90"
            >
              Submit order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
