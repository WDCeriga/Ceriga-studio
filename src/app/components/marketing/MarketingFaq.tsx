import { ChevronDown } from 'lucide-react';
import { cn } from '../ui/utils';

export function MarketingFaq({
  id,
  eyebrow = 'FAQ',
  title,
  items,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  items: { q: string; a: string }[];
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'px-[max(1rem,env(safe-area-inset-left))] py-10 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-14 md:px-8 lg:px-10 lg:py-16',
        className,
      )}
    >
      <div className="mx-auto max-w-[640px]">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">{eyebrow}</p>
        <h2 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold tracking-tight text-[#F2F0EC] sm:text-2xl">
          {title}
        </h2>
        <div className="mt-8 space-y-2">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-[14px] border border-white/[0.08] bg-[#111113] transition-colors open:border-white/[0.12]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-[#F2F0EC] sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
                <span className="pr-2">{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/35 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-white/[0.06] px-4 pb-4 pt-0 sm:px-5">
                <p className="pt-3 text-sm leading-relaxed text-white/45">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
