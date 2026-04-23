import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { getProductById } from '../../data/products';

export function SuperAdminCRM() {
  const sampleProduct = getProductById('ts-001');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">CRM</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Manage catalog products exposed in the builder, and configure role visibility for internal workers and
          manufacturer admins.
        </p>
      </div>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 border border-white/10 bg-[#111113] p-1">
          <TabsTrigger value="catalog" className="data-[state=active]:bg-[#CC2D24] data-[state=active]:text-white">
            Catalog & builder
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-[#CC2D24] data-[state=active]:text-white">
            Roles & access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Create / edit catalog product</h2>
            <p className="mt-1 text-xs text-white/45">
              Example: existing product <span className="font-mono text-white/60">{sampleProduct?.id ?? '—'}</span>
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/60">Display name</Label>
                <Input defaultValue={sampleProduct?.name} className="border-white/15 bg-white/5 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Slug / id</Label>
                <Input readOnly value={sampleProduct?.id} className="border-white/15 bg-white/5 text-white/70" />
              </div>
            </div>
            <Button className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={() => toast.success('Mock: product saved')}>
              Save product
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-6 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Role templates</h2>
            <p className="mt-1 text-xs text-white/45">
              Toggle which superadmin areas each role can see. Manufacturer portal permissions will mirror a subset.
            </p>
            <div className="mt-6 space-y-6">
              {[
                { role: 'Internal ops', desc: 'Staff helping the owner' },
                { role: 'Manufacturer admin', desc: 'Factory pricing & inbox' },
              ].map((r) => (
                <div key={r.role} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-white">{r.role}</div>
                      <div className="text-xs text-white/45">{r.desc}</div>
                    </div>
                    <Button size="sm" variant="outline" className="border-white/15 text-white" onClick={() => toast.success('Mock: role saved')}>
                      Save
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Users', true],
                      ['Orders', true],
                      ['Statistics', false],
                      ['CRM', false],
                      ['Pricing', false],
                      ['Messages', true],
                    ].map(([label, def]) => (
                      <label key={String(label)} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
                        <span className="text-sm text-white/80">{label}</span>
                        <Switch defaultChecked={def as boolean} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
