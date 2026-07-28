import { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { getProductsByCategory, type Product } from '../data/products';
import { ArrowUpRight, Layers, Package } from 'lucide-react';
import { productGridClass, productGridStyle } from '../styles/productGrid';
import { Button } from '../components/ui/button';
import { CatalogGridSkeleton } from '../components/CatalogGridSkeleton';
import { cn } from '../components/ui/utils';

const categories = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Dresses'];

export function Catalog() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const builderFlow = (location.state as { builderFlow?: string } | null)?.builderFlow;
  const techpackSpecFlow =
    searchParams.get('flow') === 'techpack-spec' || builderFlow === 'techpack-spec';
  const packagingOnly =
    builderFlow === 'packaging-only' || builderFlow === 'packaging';
  const [selectedCategory, setSelectedCategory] = useState('All');
  const filteredProducts = getProductsByCategory(selectedCategory);
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setCatalogReady(true), 320);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="ceriga-page mx-auto max-w-[1240px] overflow-x-hidden px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-7">
        <div className="ceriga-page-eyebrow">Product library</div>
        <h1 className="ceriga-page-title">Catalog</h1>
        <p className="ceriga-page-sub">
          {packagingOnly
            ? 'Packaging opens in its own workspace — no garment pick. Use Studio → Design packaging, or open it below.'
            : techpackSpecFlow
              ? 'Pick a garment template, then complete measurements and construction — upload artwork first, without on-shirt placement editing.'
              : 'Choose a garment to start building your custom tech pack.'}
        </p>
        {packagingOnly && (
          <div className="mt-5 flex flex-col gap-3 rounded-[6px] border border-[#5A4530] bg-[#1C0F0F] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-[#CC2D24]" />
              <p className="text-xs leading-relaxed text-[#A3A3A8]">
                Skip the grid — go straight to the packaging canvas. You can still browse products
                below for reference.
              </p>
            </div>
            <Button
              asChild
              className="h-9 shrink-0 bg-[#CC2D24] text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-[#E5534A]"
            >
              <Link to="/packaging">Open packaging</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="scrollbar-dark mb-5 flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-[#252528] pb-4 sm:mb-6 sm:flex-wrap sm:gap-2.5 sm:pb-5">
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'ceriga-mono shrink-0 rounded-[4px] border px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
                active
                  ? 'border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
                  : 'border-[#252528] bg-transparent text-[#8A8A90] hover:border-[#333338] hover:text-[#A3A3A8]',
              )}
            >
              {cat}
            </button>
          );
        })}
        <span className="ceriga-mono ml-auto shrink-0 pl-2 text-[10px] uppercase tracking-[0.06em] text-[#6B6B72]">
          {filteredProducts.length} items
        </span>
      </div>

      {!catalogReady ? (
        <CatalogGridSkeleton />
      ) : (
        <div className={productGridClass} style={productGridStyle}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              packagingOnly={packagingOnly}
              techpackSpecFlow={techpackSpecFlow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  packagingOnly,
  techpackSpecFlow,
}: {
  product: Product;
  packagingOnly: boolean;
  techpackSpecFlow: boolean;
}) {
  const href = packagingOnly
    ? '/packaging'
    : techpackSpecFlow
      ? `/builder/${product.id}?flow=techpack-spec`
      : `/builder/${product.id}`;

  const linkState = packagingOnly
    ? { builderFlow: 'packaging-only' }
    : techpackSpecFlow
      ? { builderFlow: 'techpack-spec' }
      : undefined;

  return (
    <div className="ceriga-card group flex flex-col overflow-hidden transition-colors hover:border-[#333338]">
      <div className="relative aspect-[3/2] overflow-hidden border-b border-[#252528] bg-[#111113]">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111113]/70" />
        <span className="ceriga-mono absolute bottom-2.5 left-2.5 rounded-[3px] border border-[#252528] bg-[#09090B] px-2 py-[3px] text-[9px] uppercase tracking-[0.08em] text-[#A3A3A8]">
          {product.garmentType}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3.5">
        <h3 className="mb-1 text-[14px] font-semibold tracking-[-0.01em] text-[#F0EEEE]">
          {product.name}
        </h3>
        <p className="mb-3.5 line-clamp-2 flex-1 text-[11px] leading-relaxed text-[#6B6B72]">
          {product.description}
        </p>

        <div className="mb-3 flex items-start gap-2 rounded-[4px] border border-[#252528] bg-[#111113] px-2.5 py-2">
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A8A90]" />
          <p className="m-0 text-[10px] leading-relaxed text-[#8A8A90]">
            Build measurements, fabrics, construction, and artwork in the guided tech pack flow.
          </p>
        </div>

        <Link
          to={href}
          state={linkState}
          className="ceriga-btn-ghost group-hover:border-[#CC2D24] group-hover:bg-[#CC2D24] group-hover:text-white"
        >
          {packagingOnly ? 'Open workspace' : 'Configure'}
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
        </Link>
      </div>
    </div>
  );
}
