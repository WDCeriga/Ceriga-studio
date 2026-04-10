import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { getProductsByCategory } from "../data/products";
import { ArrowUpRight, Layers, Package } from "lucide-react";
import { productGridClass, productGridStyle } from "../styles/productGrid";
import { Button } from "../components/ui/button";
import { CatalogGridSkeleton } from "../components/CatalogGridSkeleton";

const categories = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Dresses'];
const RED = '#CC2D24';

export function Catalog() {
  const location = useLocation();
  const builderFlow = (location.state as { builderFlow?: string } | null)?.builderFlow;
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
    <div className="min-h-dvh overflow-x-hidden bg-[#0C0C0D] px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] sm:px-5 sm:py-6 md:px-7 md:py-8">

      {/* header */}
      <div className="mb-6 sm:mb-7">
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: RED, marginBottom: 8 }}>
          Product Library
        </div>
        <h1
          className="mb-2 font-bold leading-tight tracking-[-0.03em] text-[#F2F0EC]"
          style={{ fontSize: 'clamp(1.35rem, 4.5vw, 1.65rem)' }}
        >
          Product Catalog
        </h1>
        <p className="max-w-[min(100%,420px)] text-[11px] leading-relaxed text-[#ffffff38] sm:text-xs" style={{ margin: 0 }}>
          {packagingOnly
            ? 'Packaging opens in its own workspace — no garment pick. Use Studio → Design packaging, or open it below.'
            : 'Choose a garment to start building your custom tech pack.'}
        </p>
        {packagingOnly && (
          <div className="mt-5 flex flex-col gap-3 rounded-[14px] border border-[#CC2D24]/25 bg-[#CC2D24]/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-[#CC2D24]" />
              <p className="text-xs leading-relaxed text-white/60">
                Skip the grid — go straight to the packaging canvas. You can still browse products below for reference.
              </p>
            </div>
            <Button
              asChild
              className="h-9 shrink-0 bg-[#CC2D24] text-[10px] font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90"
            >
              <Link to="/packaging">Open packaging</Link>
            </Button>
          </div>
        )}
      </div>

      {/* filters */}
      <div className="scrollbar-dark mb-5 flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-white/[0.06] pb-4 sm:mb-6 sm:flex-wrap sm:gap-2.5 sm:pb-5 sm:pr-0">
        {categories.map(cat => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="shrink-0"
              style={{
                padding: '5px 13px', borderRadius: 6,
                fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: active ? RED : 'transparent',
                color: active ? '#fff' : '#ffffff40',
                border: `1px solid ${active ? RED : '#ffffff0e'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = '#ffffff80'; el.style.borderColor = '#ffffff20'; }}}
              onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = '#ffffff40'; el.style.borderColor = '#ffffff0e'; }}}
            >
              {cat}
            </button>
          );
        })}
        <span
          className="ml-auto shrink-0 pl-2 text-[10px] text-white/20 sm:pl-0"
          style={{ fontSize: 10, color: '#ffffff22' }}
        >
          {filteredProducts.length} items
        </span>
      </div>

      {/* grid */}
      {!catalogReady ? (
        <CatalogGridSkeleton />
      ) : (
        <div className={productGridClass} style={productGridStyle}>
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              builderFlow={builderFlow}
              packagingOnly={packagingOnly}
            />
          ))}
        </div>
      )}

    </div>
  );
}

function ProductCard({
  product,
  builderFlow,
  packagingOnly,
}: {
  product: any;
  builderFlow?: string;
  packagingOnly: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111113',
        border: `1px solid ${hovered ? '#ffffff18' : '#ffffff0a'}`,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 0.2s, transform 0.22s, box-shadow 0.22s',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.45)' : '0 0 0 rgba(0,0,0,0)',
      }}
    >
      {/* image */}
      <div className="relative aspect-[3/2] overflow-hidden bg-[#0a0a0b]">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
        />

        {/* soft bottom vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(17,17,19,0.6) 100%)',
          pointerEvents: 'none',
        }} />

        {/* garment type — bottom left on image */}
        <div style={{
          position: 'absolute', bottom: 9, left: 10,
          fontSize: 8, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 4,
          background: 'rgba(0,0,0,0.55)',
          color: '#ffffff80',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {product.garmentType}
        </div>

      </div>

      {/* body */}
      <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* name */}
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#F2F0EC',
          lineHeight: 1.3, marginBottom: 5,
          letterSpacing: '-0.01em',
        }}>
          {product.name}
        </div>

        {/* description */}
        <div style={{
          fontSize: 11, color: '#ffffff32', lineHeight: 1.55,
          marginBottom: 14, flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {product.description}
        </div>

        {/* what you configure in-studio (replaces pricing / MOQ / lead rows) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: '#0d0d0f',
            border: '1px solid #ffffff08',
          }}
        >
          <Layers style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1, color: '#ffffff38' }} />
          <div style={{ fontSize: 10, color: '#ffffff38', lineHeight: 1.45 }}>
            Build measurements, fabrics, construction, and artwork in the guided tech pack flow.
          </div>
        </div>

        {/* CTA */}
        <Link
          to={packagingOnly ? '/packaging' : `/builder/${product.id}`}
          state={packagingOnly ? { builderFlow: 'packaging-only' } : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px 0', borderRadius: 8, textDecoration: 'none',
            background: hovered ? RED : 'transparent',
            border: `1px solid ${hovered ? RED : '#ffffff10'}`,
            color: hovered ? '#fff' : '#ffffff45',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.09em',
            textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
        >
          {packagingOnly ? 'Open workspace' : 'Configure'}
          <ArrowUpRight style={{
            width: 11, height: 11,
            transform: hovered ? 'translate(1px,-1px)' : 'translate(0,0)',
            transition: 'transform 0.2s',
          }} />
        </Link>
      </div>
    </div>
  );
}