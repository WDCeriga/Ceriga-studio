import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../components/ui/utils';
import type { OrderQuantityPlan } from '../data/orderQuantities';
import type { OrderDeliveryInfo } from '../data/orderDelivery';
import { createOrderFromSubmit } from '../data/userOrders';
import { useAuth } from '../contexts/AuthContext';

const fieldClass =
  'h-10 border-[#252528] bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:border-[#CC2D24] focus-visible:ring-[#CC2D24]/25';

const COUNTRIES = [
  { value: 'UK', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'PT', label: 'Portugal' },
  { value: 'IE', label: 'Ireland' },
  { value: 'EU', label: 'Other EU' },
];

type DeliveryForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  country: string;
  instructions: string;
};

function validate(form: DeliveryForm): Partial<Record<keyof DeliveryForm, string>> {
  const errors: Partial<Record<keyof DeliveryForm, string>> = {};
  if (!form.firstName.trim()) errors.firstName = 'Required';
  if (!form.lastName.trim()) errors.lastName = 'Required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email';
  if (!form.phone.trim()) errors.phone = 'Required';
  if (!form.address1.trim()) errors.address1 = 'Required';
  if (!form.city.trim()) errors.city = 'Required';
  if (!form.postcode.trim()) errors.postcode = 'Required';
  if (!form.country) errors.country = 'Required';
  return errors;
}

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-red-400">{message}</p>;
}

export default function Delivery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DeliveryForm, string>>>({});
  const [form, setForm] = useState<DeliveryForm>(() => ({
    firstName: user?.name?.trim().split(/\s+/)[0] ?? '',
    lastName: user?.name?.trim().split(/\s+/).slice(1).join(' ') ?? '',
    email: user?.email ?? '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    postcode: '',
    country: 'UK',
    instructions: '',
  }));

  const set = (key: keyof DeliveryForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const st = useMemo(
    () =>
      location.state as
        | {
            productId?: string;
            productName?: string;
            garmentType?: string;
            orderQuantities?: OrderQuantityPlan;
            from?: string;
          }
        | undefined,
    [location.state],
  );

  const handleBack = () => {
    const productId = st?.productId;
    if (st?.from === 'manufacturer') {
      navigate(
        productId
          ? `/create/manufacturer?productId=${encodeURIComponent(productId)}`
          : '/create/manufacturer',
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

  const deliveryFromForm = (): OrderDeliveryInfo => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address1: form.address1.trim(),
    address2: form.address2.trim() || undefined,
    city: form.city.trim(),
    postcode: form.postcode.trim(),
    country: form.country,
    instructions: form.instructions.trim() || undefined,
  });

  const handleSubmitOrder = async () => {
    const nextErrors = validate(form);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    const isTechPackExport = st?.orderQuantities?.mode === 'techpack';
    const isPackaging = st?.from === 'packaging';
    const delivery = deliveryFromForm();
    setSubmitting(true);
    try {
      const order = await createOrderFromSubmit({
        productId: st?.productId,
        productName: st?.productName ?? (isPackaging ? 'Packaging order' : undefined),
        garmentType: st?.garmentType ?? (isPackaging ? 'Packaging' : undefined),
        kind: isTechPackExport ? 'tech-pack' : 'production',
        orderQuantities: st?.orderQuantities,
        contactName: `${delivery.firstName} ${delivery.lastName}`.trim(),
        contactEmail: delivery.email,
        contactPhone: delivery.phone,
        delivery,
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#09090B] text-white">
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8 md:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
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

        <div className="space-y-6 rounded-xl border border-[#252528] bg-white/[0.03] p-4 sm:p-6">
          <Section title="Contact information">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="mb-1.5 text-xs text-white/55">
                  First name
                </Label>
                <Input
                  id="firstName"
                  className={fieldClass}
                  placeholder="Enter first name"
                  value={form.firstName}
                  onChange={(e) => set('firstName')(e.target.value)}
                  autoComplete="given-name"
                />
                <FieldError message={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName" className="mb-1.5 text-xs text-white/55">
                  Last name
                </Label>
                <Input
                  id="lastName"
                  className={fieldClass}
                  placeholder="Enter last name"
                  value={form.lastName}
                  onChange={(e) => set('lastName')(e.target.value)}
                  autoComplete="family-name"
                />
                <FieldError message={errors.lastName} />
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
                  value={form.email}
                  onChange={(e) => set('email')(e.target.value)}
                  autoComplete="email"
                />
                <FieldError message={errors.email} />
              </div>
              <div>
                <Label htmlFor="phone" className="mb-1.5 text-xs text-white/55">
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  className={fieldClass}
                  placeholder="+44 123 456 7890"
                  value={form.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                  autoComplete="tel"
                />
                <FieldError message={errors.phone} />
              </div>
            </div>
          </Section>

          <div className="border-t border-[#252528]" />

          <Section title="Shipping address">
            <div className="space-y-3">
              <div>
                <Label htmlFor="address1" className="mb-1.5 text-xs text-white/55">
                  Address line 1
                </Label>
                <Input
                  id="address1"
                  className={fieldClass}
                  placeholder="Street address"
                  value={form.address1}
                  onChange={(e) => set('address1')(e.target.value)}
                  autoComplete="address-line1"
                />
                <FieldError message={errors.address1} />
              </div>
              <div>
                <Label htmlFor="address2" className="mb-1.5 text-xs text-white/55">
                  Address line 2 <span className="text-white/30">(optional)</span>
                </Label>
                <Input
                  id="address2"
                  className={fieldClass}
                  placeholder="Apartment, suite, etc."
                  value={form.address2}
                  onChange={(e) => set('address2')(e.target.value)}
                  autoComplete="address-line2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="city" className="mb-1.5 text-xs text-white/55">
                    City
                  </Label>
                  <Input
                    id="city"
                    className={fieldClass}
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => set('city')(e.target.value)}
                    autoComplete="address-level2"
                  />
                  <FieldError message={errors.city} />
                </div>
                <div>
                  <Label htmlFor="postcode" className="mb-1.5 text-xs text-white/55">
                    Postcode
                  </Label>
                  <Input
                    id="postcode"
                    className={fieldClass}
                    placeholder="Postcode"
                    value={form.postcode}
                    onChange={(e) => set('postcode')(e.target.value)}
                    autoComplete="postal-code"
                  />
                  <FieldError message={errors.postcode} />
                </div>
                <div>
                  <Label htmlFor="country" className="mb-1.5 text-xs text-white/55">
                    Country
                  </Label>
                  <select
                    id="country"
                    value={form.country}
                    onChange={(e) => set('country')(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[#252528] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-[#CC2D24] focus:outline-none focus:ring-2 focus:ring-[#CC2D24]/25"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.country} />
                </div>
              </div>
            </div>
          </Section>

          <div className="border-t border-[#252528]" />

          <Section title="Special instructions">
            <div>
              <Label htmlFor="instructions" className="mb-1.5 text-xs text-white/55">
                Notes <span className="text-white/30">(optional)</span>
              </Label>
              <Textarea
                id="instructions"
                className="min-h-[88px] resize-none border-[#252528] bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:border-[#CC2D24] focus-visible:ring-[#CC2D24]/25"
                placeholder="Add any special delivery instructions..."
                value={form.instructions}
                onChange={(e) => set('instructions')(e.target.value)}
              />
            </div>
          </Section>

          <div className="border-t border-[#252528] pt-2">
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmitOrder()}
              className="h-11 w-full rounded-lg bg-[#CC2D24] text-sm font-semibold text-white hover:bg-[#CC2D24]/90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
