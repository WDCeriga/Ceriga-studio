import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../components/ui/utils';
import { setOrderMode, type OrderQuantityPlan } from '../data/orderQuantities';
import type { OrderDeliveryInfo } from '../data/orderDelivery';
import { createOrderFromSubmit, type UserOrder } from '../data/userOrders';
import { requestMessage } from '../lib/requestErrors';
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
  useCerigaTranslation();

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
            orderIntent?: 'production';
            sourceOrderId?: string;
            mockup?: Blob;
            useApprovedSample?: boolean;
            productId?: string;
            productName?: string;
            garmentType?: string;
            orderQuantities?: OrderQuantityPlan;
            specifications?: UserOrder['specifications'];
            from?: string;
          }
        | undefined,
    [location.state],
  );

  const handleBack = () => {
    const productId = st?.productId;
    if (st?.sourceOrderId) {
      navigate('/orders/' + st.sourceOrderId);
      return;
    }
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

    const isProductionOrder = st?.orderIntent === 'production' || st?.from === 'builder';
    const isTechPackExport = !isProductionOrder && st?.orderQuantities?.mode === 'techpack';
    const isPackaging = st?.from === 'packaging';
    const delivery = deliveryFromForm();
    setSubmitting(true);
    try {
      const order = await createOrderFromSubmit({
        sourceOrderId: st?.sourceOrderId,
        useApprovedSample: st?.useApprovedSample,
        productId: st?.productId,
        productName: st?.productName ?? (isPackaging ? 'Packaging order' : undefined),
        garmentType: st?.garmentType ?? (isPackaging ? 'Packaging' : undefined),
        kind: isTechPackExport ? 'tech-pack' : 'production',
        orderQuantities: isProductionOrder && st?.orderQuantities
          ? setOrderMode(st.orderQuantities, 'custom_clothing') : st?.orderQuantities,
        specifications: st?.specifications,
        files: st?.mockup ? [new File([st.mockup], 'submitted-mockup.png', { type: 'image/png' })] : undefined,
        contactName: `${delivery.firstName} ${delivery.lastName}`.trim(),
        contactEmail: delivery.email,
        contactPhone: delivery.phone,
        delivery,
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(cerigaTranslateLabel(requestMessage(err, cerigaTranslate("interface.text_9aa34d8b2d01f24c"))));
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
        >{cerigaTranslate("common.back")}</button>

        <header className="mb-6">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">{cerigaTranslate("interface.text_99e71f48c48f121b")}</p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-white sm:text-[1.65rem]">{cerigaTranslate("nav.delivery")}</h1>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/50 sm:text-sm">{cerigaTranslate("interface.text_4e2c59b265233f0d")}</p>
        </header>

        <div className="space-y-6 rounded-xl border border-[#252528] bg-white/[0.03] p-4 sm:p-6">
          <Section title={cerigaTranslate("interface.text_cbc7311e953e2ca2")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_702ef921ed1d89bf")}</Label>
                <Input
                  id="firstName"
                  className={fieldClass}
                  placeholder={cerigaTranslate("interface.text_05786ecba6926b28")}
                  value={form.firstName}
                  onChange={(e) => set('firstName')(e.target.value)}
                  autoComplete="given-name"
                />
                <FieldError message={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_7b4888049459f04a")}</Label>
                <Input
                  id="lastName"
                  className={fieldClass}
                  placeholder={cerigaTranslate("interface.text_6efd92ba0d0b41ff")}
                  value={form.lastName}
                  onChange={(e) => set('lastName')(e.target.value)}
                  autoComplete="family-name"
                />
                <FieldError message={errors.lastName} />
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("authentication.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  className={fieldClass}
                  placeholder={cerigaTranslate("interface.text_97af051a28d9808c")}
                  value={form.email}
                  onChange={(e) => set('email')(e.target.value)}
                  autoComplete="email"
                />
                <FieldError message={errors.email} />
              </div>
              <div>
                <Label htmlFor="phone" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("adminOrders.phone")}</Label>
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

          <Section title={cerigaTranslate("interface.text_37441a6666ff3dbd")}>
            <div className="space-y-3">
              <div>
                <Label htmlFor="address1" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_ee760b6e81b981e2")}</Label>
                <Input
                  id="address1"
                  className={fieldClass}
                  placeholder={cerigaTranslate("interface.text_8a386dd14cb9a70f")}
                  value={form.address1}
                  onChange={(e) => set('address1')(e.target.value)}
                  autoComplete="address-line1"
                />
                <FieldError message={errors.address1} />
              </div>
              <div>
                <Label htmlFor="address2" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_350b2b85c4af1724")}{" "}<span className="text-white/30">{cerigaTranslate("interface.text_0059798b7f7023e4")}</span>
                </Label>
                <Input
                  id="address2"
                  className={fieldClass}
                  placeholder={cerigaTranslate("interface.text_2088543fd0df27c4")}
                  value={form.address2}
                  onChange={(e) => set('address2')(e.target.value)}
                  autoComplete="address-line2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="city" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_fc33f73246f48295")}</Label>
                  <Input
                    id="city"
                    className={fieldClass}
                    placeholder={cerigaTranslate("interface.text_fc33f73246f48295")}
                    value={form.city}
                    onChange={(e) => set('city')(e.target.value)}
                    autoComplete="address-level2"
                  />
                  <FieldError message={errors.city} />
                </div>
                <div>
                  <Label htmlFor="postcode" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_0a4387d25c62e78b")}</Label>
                  <Input
                    id="postcode"
                    className={fieldClass}
                    placeholder={cerigaTranslate("interface.text_0a4387d25c62e78b")}
                    value={form.postcode}
                    onChange={(e) => set('postcode')(e.target.value)}
                    autoComplete="postal-code"
                  />
                  <FieldError message={errors.postcode} />
                </div>
                <div>
                  <Label htmlFor="country" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("interface.text_701d021d08c54579")}</Label>
                  <select
                    id="country"
                    value={form.country}
                    onChange={(e) => set('country')(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-[#252528] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-[#CC2D24] focus:outline-none focus:ring-2 focus:ring-[#CC2D24]/25"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {cerigaTranslateLabel(c.label)}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.country} />
                </div>
              </div>
            </div>
          </Section>

          <div className="border-t border-[#252528]" />

          <Section title={cerigaTranslate("interface.text_4e80e96365cc0517")}>
            <div>
              <Label htmlFor="instructions" className="mb-1.5 text-xs text-white/55">{cerigaTranslate("adminOrders.notes")}{" "}<span className="text-white/30">{cerigaTranslate("interface.text_0059798b7f7023e4")}</span>
              </Label>
              <Textarea
                id="instructions"
                className="min-h-[88px] resize-none border-[#252528] bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:border-[#CC2D24] focus-visible:ring-[#CC2D24]/25"
                placeholder={cerigaTranslate("interface.text_91d3ca101c3d2cfc")}
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
              {submitting ? cerigaTranslate("interface.text_49195f559e4a9f5b") : cerigaTranslate("interface.text_6dde50f964d9b8f0")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
