import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Pencil, Search, Shield } from 'lucide-react';
import {
  GARMENT_BASES,
  countEnabledForProduct,
  garmentBaseById,
  getCatalogStore,
  type GarmentBaseId,
} from '../../data/crmCatalogMock';
import { Button } from '../../components/ui/button';
import { productGridClass, productGridStyle } from '../../styles/productGrid';
import { cn } from '../../components/ui/utils';

export function SuperAdminCRM() {
  const catalog = getCatalogStore();
  const [search, setSearch] = useState('');
  const [baseFilter, setBaseFilter] = useState<GarmentBaseId | 'all'>('all');

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((p) => {
      if (baseFilter !== 'all' && p.baseId !== baseFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.baseId.includes(q)
      );
    });
  }, [catalog, search, baseFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            Catalog
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            CRM
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
          >
            <Link to="/superadmin/crm/access">
              <Shield className="mr-2 h-4 w-4" />
              Roles & access
            </Link>
          </Button>
          <Button asChild className="bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/superadmin/crm/products/new">
              <Plus className="mr-2 h-4 w-4" />
              New product
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBaseFilter('all')}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition',
              baseFilter === 'all'
                ? 'border-[#CC2D24]/50 bg-[#CC2D24]/15 text-white'
                : 'border-white/10 bg-[#111113] text-white/40 hover:border-white/20',
            )}
          >
            All bases
          </button>
          {GARMENT_BASES.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBaseFilter(b.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition',
                  baseFilter === b.id
                    ? 'border-[#CC2D24]/50 bg-[#CC2D24]/15 text-white'
                    : 'border-white/10 bg-[#111113] text-white/40 hover:border-white/20',
                )}
              >
                {b.name}
              </button>
              <Link
                to={`/superadmin/crm/bases/${b.id}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-[#111113] text-white/35 transition hover:border-white/20 hover:text-white/70"
                title={`Edit ${b.name} defaults`}
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="h-3 w-3" />
              </Link>
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-9 w-full border-0 border-b border-white/15 bg-transparent pl-7 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#CC2D24]/70"
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#111113] px-6 py-16 text-center">
          <p className="text-sm text-white/45">No products match your search.</p>
        </div>
      ) : (
        <div className={productGridClass} style={productGridStyle}>
          {filteredProducts.map((p) => {
            const base = garmentBaseById(p.baseId);
            return (
              <Link
                key={p.id}
                to={`/superadmin/crm/products/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113] transition-all duration-200 hover:border-white/[0.14] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
                  <img
                    src={p.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {!p.published ? (
                    <span className="absolute left-3 top-3 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                      Draft
                    </span>
                  ) : null}
                  <span
                    className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[9px] font-medium text-white/75 backdrop-blur-sm"
                    style={{ borderColor: `${base.accent}55` }}
                  >
                    {base.name}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-sm font-semibold tracking-tight text-[#F2F0EC] group-hover:text-white">
                    {p.name}
                  </h2>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                    <span className="font-mono text-[10px] text-white/30">{p.id}</span>
                    <span className="text-[10px] font-medium text-[#CC2D24]">
                      {countEnabledForProduct(p)} options
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
