/**
 * Shown while the Builder route chunk loads (first visit, reload, shared link).
 * Mirrors the builder shell's light layout so the page doesn't flash dark or blank,
 * and the garment area appears where the garment will be.
 */
export function BuilderLoadingFallback() {
  const bar = 'rounded bg-[#ececea] motion-safe:animate-pulse';
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-white text-[#171717]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading the builder</span>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#ececea] px-4">
        <div className={`${bar} h-3 w-48`} />
        <div className={`${bar} h-7 w-28`} />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[175px] shrink-0 flex-col gap-4 border-r border-[#ececea] bg-[#fafaf9] px-4 py-5 md:flex">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className={`${bar} h-3`} style={{ width: `${62 + (i % 3) * 12}%` }} />)}
        </aside>
        <main className="flex min-w-0 flex-1 items-center justify-center bg-white">
          <div className={`${bar} aspect-[3/4] w-[min(36vw,320px)] rounded-[28%_28%_6%_6%/14%_14%_4%_4%] bg-[#e9e9e7]`} />
        </main>
        <aside className="hidden w-[340px] shrink-0 flex-col gap-5 border-l border-[#ececea] px-5 py-6 lg:flex">
          <div className={`${bar} h-4 w-40`} />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${bar} aspect-square`} />)}
          </div>
          {Array.from({ length: 5 }, (_, i) => <div key={i} className={`${bar} h-9`} />)}
        </aside>
      </div>
    </div>
  );
}
