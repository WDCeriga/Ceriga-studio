import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Link2, MonitorSmartphone } from 'lucide-react';
import { useBuilderDevice } from './builderDevice';
import './builder-device-gate.css';

/** The Builder needs an iPad or a computer. Phones and very narrow windows get this page instead. */
export function BuilderDeviceGate({ children }: { children: ReactNode }) {
  const { device } = useBuilderDevice(), [copied, setCopied] = useState(false);
  if (device !== 'phone' && device !== 'narrow') return <>{children}</>;
  const phone = device === 'phone';
  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  };
  return <main className="builder-device-gate">
    <section aria-labelledby="builder-device-gate-title">
      <span className="builder-device-gate-icon" aria-hidden="true"><MonitorSmartphone size={28} strokeWidth={1.5} /></span>
      <h1 id="builder-device-gate-title">{phone ? 'Open the Builder on iPad or computer' : 'Make this window wider'}</h1>
      <p>{phone ? 'Designing garments needs a bigger screen. Your drafts are saved to your account, so you can pick up where you left off.' : 'The Builder needs a window at least 768 pixels wide. Widen the window or use full screen.'}</p>
      <div className="builder-device-gate-actions">
        <a className="is-primary" href="/catalog"><ArrowLeft size={16} />Back to products</a>
        {phone && <button type="button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Link2 size={16} />}{copied ? 'Link copied' : 'Copy link'}</button>}
      </div>
      {phone && <small>Works on iPad, iPad mini and up, and any laptop or desktop.</small>}
    </section>
  </main>;
}
