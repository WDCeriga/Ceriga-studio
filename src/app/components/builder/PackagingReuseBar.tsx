import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FolderOpen, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  listReusablePackaging,
  savePackagingToLibrary,
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

/** Save / reuse packaging designs (DB library + packaging projects). */
export function PackagingReuseBar({ snapshot, onApply }: Props) {
  useCerigaTranslation();

  const { isAuthenticated, authReady, usingSupabase } = useAuth();
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
      toast.error(cerigaTranslate("interface.text_a50c1470b78cd369"));
      return;
    }
    onApply(structuredClone(item.snapshot));
    toast.success(cerigaTranslate("interface.text_d1c5043e7806d425",{value0:(item.name)}));
  };

  const handleSaveLibrary = async () => {
    if (!usingSupabase || !isAuthenticated) {
      toast.error(cerigaTranslate("interface.text_70fc94abcb1d4957"));
      return;
    }
    setBusy(true);
    try {
      const entry = await savePackagingToLibrary(saveName || 'Packaging design', snapshot);
      setSaveName('');
      await refresh();
      setSelectedId(entry.id);
      toast.success(cerigaTranslate("interface.text_d999c46eff32fc5d"));
    } catch (err) {
      toast.error(cerigaTranslateLabel(err instanceof Error ? err.message : cerigaTranslate("interface.text_effd4fdb6f4ab10a")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[6px] border border-[#252528] bg-[#111113] p-3">
      <div className="flex items-center gap-2 justify-between">
        <p className="ceriga-mono text-[10px] uppercase tracking-[0.08em] text-[#8A8A90]">{cerigaTranslate("interface.text_c94cbd24980de9ee")}</p>
        <Link
          to="/projects"
          className="text-[10px] text-[#6B6B72] underline-offset-2 hover:text-[#A3A3A8] hover:underline"
        >{cerigaTranslate("interface.text_4b87271b6b8170d4")}</Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#6B6B72]">{cerigaTranslate("interface.text_b16aee48015280f9")}</label>
          <Select value={selectedId || undefined} onValueChange={setSelectedId}>
            <SelectTrigger className="h-9 border-[#252528] bg-black/40 text-[12px] text-[#F0EEEE]">
              <SelectValue placeholder={items.length ? cerigaTranslate("interface.text_3f5b140e7ecd1304") : cerigaTranslate("interface.text_e3fa6217ac5a4984")} />
            </SelectTrigger>
            <SelectContent className="border-[#252528] bg-[#161618] text-[#F0EEEE]">
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id} className="text-[12px]">
                  {item.name}
                  <span className="ml-1 text-[#6B6B72]">
                    · {item.source === 'project' ? cerigaTranslate("interface.text_244210e48437b655") : cerigaTranslate("interface.text_b718f1354f724731")}
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
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_31e392d1c0378bec")}</Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#6B6B72]">{cerigaTranslate("interface.text_dd0b1ee72ac4a67b")}</label>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={cerigaTranslate("interface.text_80c3ff4838ffd3ed")}
            className="h-9 border-[#252528] bg-black/40 text-[12px] text-[#F0EEEE] placeholder:text-[#6B6B72]"
          />
        </div>
        <Button
          type="button"
          disabled={busy || snapshot.packagingType === 'none'}
          onClick={() => void handleSaveLibrary()}
          className="h-9 shrink-0 bg-[#CC2D24] text-[11px] font-semibold hover:bg-[#CC2D24]/90"
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("common.save")}</Button>
      </div>
      <p className="text-[10px] leading-relaxed text-[#45454B]">{cerigaTranslate("interface.text_2d50a80432827411")}</p>
    </div>
  );
}
