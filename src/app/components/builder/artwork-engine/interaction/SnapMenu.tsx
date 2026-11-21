import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, Magnet } from 'lucide-react';
import { setSnapSetting, useSnapSettings, type SnapSettings } from '../state/snapping';

const ITEMS: { key: keyof SnapSettings; label: string; hint: string }[] = [
  { key: 'garment', label: 'Garment centre', hint: 'Centre front / back' },
  { key: 'objects', label: 'Other artwork', hint: 'Edges and centres' },
  { key: 'spacing', label: 'Equal spacing', hint: 'Even gaps between objects' },
];

/** Bottom-bar Snapping menu: switch snap sources on and off (plan C.3 snap priorities). */
export function SnapMenu() {
  const settings = useSnapSettings();
  const active = ITEMS.filter(item => settings[item.key]).length;
  return <Menu.Root modal={false}>
    <Menu.Trigger asChild>
      <button type="button" className="cx-dock-toggle cx-snap-trigger" aria-label="Snapping" title="Snapping" aria-pressed={active > 0}>
        <Magnet size={15} /><span>Snap</span>
      </button>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content className="cx-context-menu" side="top" sideOffset={10} align="center" collisionPadding={12}>
        <Menu.Label className="cx-context-menu__label">Snap to</Menu.Label>
        {ITEMS.map(item => <Menu.CheckboxItem key={item.key} className="cx-context-menu__item" checked={settings[item.key]}
          onCheckedChange={value => setSnapSetting(item.key, Boolean(value))} onSelect={event => event.preventDefault()}>
          <span className="cx-context-menu__check">{settings[item.key] && <Check size={14} />}</span>
          <span>{item.label}<small>{item.hint}</small></span>
        </Menu.CheckboxItem>)}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
