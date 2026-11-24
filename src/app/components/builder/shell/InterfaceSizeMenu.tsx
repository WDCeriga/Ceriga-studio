import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ALargeSmall, Check } from 'lucide-react';
import { INTERFACE_SIZES, readInterfaceSize, writeInterfaceSize, type InterfaceSize } from './builderDevice';
import './interface-size-menu.css';

/** Lets each person nudge the whole Builder smaller or larger on top of the automatic screen sizing. */
export function InterfaceSizeMenu() {
  const [size, setSize] = useState<InterfaceSize>(readInterfaceSize);
  useEffect(() => { const sync = () => setSize(readInterfaceSize()); addEventListener('ceriga-interface-size', sync); return () => removeEventListener('ceriga-interface-size', sync); }, []);
  return <Popover.Root>
    <Popover.Trigger asChild><button type="button" aria-label="Interface size" title="Interface size" data-size={size}><ALargeSmall size={17} /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="interface-size-menu" side="bottom" align="end" sideOffset={8}>
      <p>Interface size</p>
      <div role="radiogroup" aria-label="Interface size">{INTERFACE_SIZES.map(option => <button key={option.id} type="button" role="radio" aria-checked={size === option.id} onClick={() => { writeInterfaceSize(option.id); setSize(option.id); }}>
        <span>{option.label}</span><small>{option.hint}</small>{size === option.id && <Check size={14} />}
      </button>)}</div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
