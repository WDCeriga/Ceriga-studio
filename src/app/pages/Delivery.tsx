import { useLocation, useNavigate } from 'react-router';

export default function Delivery() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmitOrder = () => {
    navigate('/orders');
  };

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

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F] text-white">
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8 md:px-8">
        <div className="mb-6">
          <h1 className="mb-1 text-2xl font-bold">Delivery Information</h1>
          <p className="text-sm text-white/60">Enter your delivery details to complete your order</p>
        </div>

        <div className="space-y-5 rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6">
          <div>
            <h2 className="mb-3 text-base font-semibold text-white">Contact Information</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1.5 block text-xs text-white/60">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#FF3B30] focus:outline-none"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1.5 block text-xs text-white/60">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs text-white/60">Email</label>
                <input
                  type="email"
                  id="email"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs text-white/60">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                  placeholder="+44 123 456 7890"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h2 className="mb-3 text-base font-semibold text-white">Shipping Address</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="address1" className="mb-1.5 block text-xs text-white/60">Address Line 1</label>
                <input
                  type="text"
                  id="address1"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                  placeholder="Street address"
                />
              </div>
              <div>
                <label htmlFor="address2" className="mb-1.5 block text-xs text-white/60">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  id="address2"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                  placeholder="Apartment, suite, etc."
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label htmlFor="city" className="mb-1.5 block text-xs text-white/60">City</label>
                  <input
                    type="text"
                    id="city"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label htmlFor="postcode" className="mb-1.5 block text-xs text-white/60">Postcode</label>
                  <input
                    type="text"
                    id="postcode"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
                    placeholder="Postcode"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="mb-1.5 block text-xs text-white/60">Country</label>
                  <select
                    id="country"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#CC2D24] focus:outline-none"
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
          </div>

          <div className="border-t border-white/10 pt-4">
            <h2 className="mb-3 text-base font-semibold text-white">Special Instructions (Optional)</h2>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CC2D24] focus:outline-none"
              placeholder="Add any special delivery instructions..."
            />
          </div>

          <div className="flex gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-white/10 bg-white/5 px-6 py-2 text-sm text-white transition-all hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="submit"
              onClick={handleSubmitOrder}
              className="flex-1 rounded-lg bg-[#CC2D24] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#CC2D24]/90"
            >
              Submit Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
