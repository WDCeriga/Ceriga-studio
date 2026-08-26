import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FolderOpen, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  listReusablePackaging,
  saveLocalPackaging,
  type PackagingSnapshot,
  type ReusablePackagingItem,
} from '../../lib/packagingLibrary';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type Props = {
  snapshot: PackagingSnapshot;
  onApply: (snapshot: PackagingSnapshot) => void;
};

/** Save / reuse packaging designs (local library + cloud packaging projects). */
export function PackagingReuseBar({ snapshot, onApply }: Props) {
  const { isAuthenticated, authReady } = useAuth();
  const [items, setItems] = useState<ReusablePackagingItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [saveName, setSaveName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listReusablePackaging({ isAuthenticated });
    setItems(list);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, refresh]);

  const handleApply = () => {
    const item = items.find((i) => i.id === selectedId);
    if (!item) {
      toast.error('Pick a saved packaging design first');
      return;
    }
    onApply(structuredClone(item.snapshot));
    toast.success(`Applied “${item.name}”`);
  };

  const handleSaveLocal = () => {
    setBusy(true);
    try {
      const entry = saveLocalPackaging(saveName || 'Packaging design', snapshot);
      setSaveName('');
      void refresh();
      setSelectedId(entry.id);
      toast.success('Saved to packaging library');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[6px] border border-[#252528] bg-[#111113] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="ceriga-mono text-[10px] uppercase tracking-[0.08em] text-[#8A8A90]">
          Save & reuse
        </p>
        <Link
          to="/projects"
          className="text-[10px] text-[#6B6B72] underline-offset-2 hover:text-[#A3A3A8] hover:underline"
        >
          All projects
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#6B6B72]">
            Apply saved
          </label>
          <Select value={selectedId || undefined} onValueChange={setSelectedId}>
            <SelectTrigger className="h-9 border-[#252528] bg-black/40 text-[12px] text-[#F0EEEE]">
              <SelectValue placeholder={items.length ? 'Choose packaging…' : 'No saved packaging yet'} />
            </SelectTrigger>
            <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id} className="text-[12px]">
                  {item.name}
                  <span className="ml-1 text-[#6B6B72]">
                    · {item.source === 'project' ? 'project' : 'library'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!selectedId}
          onClick={handleApply}
          className="h-9 shrink-0 border-[#3A3A40] text-[11px] !text-white hover:bg-white/10"
        >
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          Apply
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#6B6B72]">
            Save current to library
          </label>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g. Polybag — SS26"
            className="h-9 border-[#252528] bg-black/40 text-[12px] text-[#F0EEEE] placeholder:text-[#6B6B72]"
          />
        </div>
        <Button
          type="button"
          disabled={busy || snapshot.packagingType === 'none'}
          onClick={handleSaveLocal}
          className="h-9 shrink-0 bg-[#CC2D24] text-[11px] font-semibold hover:bg-[#CC2D24]/90"
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Save
        </Button>
      </div>
      <p className="text-[10px] leading-relaxed text-[#45454B]">
        Library saves in this browser. Packaging-only projects you save while signed in also appear
        here for reuse in any tech pack.
      </p>
    </div>
  );
}
